import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { json, preflight, safeError } from "../_shared/security.ts";

const PixSchema = z.object({
  action: z.literal("add_pix_key"),
  password: z.string().min(6).max(128),
  payload: z.object({
    key_type: z.enum(["cpf", "cnpj", "email", "phone", "random"]),
    key_value: z.string().trim().min(3).max(255),
  }).strict(),
}).strict();

const BankSchema = z.object({
  action: z.literal("add_bank_account"),
  password: z.string().min(6).max(128),
  payload: z.object({
    bank_name: z.string().trim().min(2).max(80),
    bank_code: z.string().trim().max(10).nullable().optional(),
    agency: z.string().trim().regex(/^\d{1,5}(-?\d)?$/),
    account_number: z.string().trim().regex(/^\d{1,15}(-?\d{1,2})?$/),
    account_type: z.enum(["corrente", "poupanca"]),
    holder_name: z.string().trim().min(3).max(120),
    holder_document: z.string().regex(/^\d{11}$|^\d{14}$/),
  }).strict(),
}).strict();

const DeleteSchema = z.object({
  action: z.enum(["delete_pix_key", "delete_bank_account"]),
  password: z.string().min(6).max(128),
  payload: z.object({ id: z.string().uuid() }).strict(),
}).strict();

const WithdrawalSchema = z.object({
  action: z.literal("request_withdrawal"),
  password: z.string().min(6).max(128),
  payload: z.object({
    amount: z.number().finite().positive().max(100_000_000),
    withdrawal_type: z.enum(["pix", "pix_copy_paste", "crypto"]),
    pix_key_id: z.string().uuid().nullable().optional(),
    pix_copy_paste_code: z.string().trim().min(20).max(1024).nullable().optional(),
    crypto_currency: z.enum(["BTC", "USDT", "XMR"]).nullable().optional(),
    crypto_network: z.string().trim().min(2).max(40).nullable().optional(),
    crypto_address: z.string().trim().min(12).max(255).nullable().optional(),
  }).strict(),
}).strict().superRefine(({ payload }, ctx) => {
  if (payload.withdrawal_type === "pix" && !payload.pix_key_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["payload", "pix_key_id"], message: "Chave PIX obrigatória" });
  }
  if (payload.withdrawal_type === "pix_copy_paste" && !payload.pix_copy_paste_code) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["payload", "pix_copy_paste_code"], message: "Código PIX obrigatório" });
  }
  if (payload.withdrawal_type === "crypto" && (!payload.crypto_currency || !payload.crypto_network || !payload.crypto_address)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["payload"], message: "Dados crypto incompletos" });
  }
});

const RequestSchema = z.union([PixSchema, BankSchema, DeleteSchema, WithdrawalSchema]);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json(req, { success: false, error: "Método não permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authHeader?.startsWith("Bearer ")) {
      return json(req, { success: false, error: "Não autorizado." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData.user;
    if (userError || !user?.email) return json(req, { success: false, error: "Sessão inválida." }, 401);

    const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json(req, { success: false, error: "Dados inválidos." }, 400);

    const verificationClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: verified, error: verificationError } = await verificationClient.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.password,
    });
    if (verificationError || verified.user?.id !== user.id) {
      return json(req, { success: false, error: "Senha atual incorreta." }, 403);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { action, payload } = parsed.data;
    let operationError: { message: string } | null = null;

    if (action === "add_pix_key") {
      const result = await admin.from("pix_keys").insert({ user_id: user.id, ...payload });
      operationError = result.error;
    } else if (action === "add_bank_account") {
      const result = await admin.from("bank_accounts").insert({ user_id: user.id, ...payload });
      operationError = result.error;
    } else if (action === "delete_pix_key" || action === "delete_bank_account") {
      const table = action === "delete_pix_key" ? "pix_keys" : "bank_accounts";
      const result = await admin.from(table).delete().eq("id", payload.id).eq("user_id", user.id);
      operationError = result.error;
    } else {
      if (payload.pix_key_id) {
        const { data: key } = await admin.from("pix_keys").select("id").eq("id", payload.pix_key_id).eq("user_id", user.id).maybeSingle();
        if (!key) return json(req, { success: false, error: "Chave PIX inválida." }, 400);
      }
      const result = await admin.from("withdrawals").insert({
        user_id: user.id,
        amount: payload.amount,
        withdrawal_type: payload.withdrawal_type,
        pix_key_id: payload.pix_key_id ?? null,
        pix_copy_paste_code: payload.pix_copy_paste_code ?? null,
        crypto_currency: payload.crypto_currency ?? null,
        crypto_network: payload.crypto_network ?? null,
        crypto_address: payload.crypto_address ?? null,
      });
      operationError = result.error;
    }

    if (operationError) {
      safeError("sensitive-financial-action", operationError);
      const knownMessage = /Saldo insuficiente|saques.*pausad|Máximo de 3|congelado|Primeiro saque crypto|Limite diário/i.test(operationError.message)
        ? operationError.message
        : "Não foi possível concluir a operação.";
      return json(req, { success: false, error: knownMessage }, 400);
    }

    await admin.from("security_audit_log").insert({
      event_type: "sensitive_financial_action",
      user_id: user.id,
      endpoint: "sensitive-financial-action",
      status_code: 200,
      metadata: { action },
    }).then(() => undefined, () => undefined);

    return json(req, { success: true });
  } catch (error) {
    safeError("sensitive-financial-action", error);
    return json(req, { success: false, error: "Erro interno." }, 500);
  }
});