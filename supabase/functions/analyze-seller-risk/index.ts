import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai@2";
import { streamText } from "npm:ai@5";
import { baseHeaders, json, preflight, safeError } from "../_shared/security.ts";

const MODEL = "openai/gpt-6-astra";
const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Analysis {
  risk_level: "low" | "medium" | "high" | "critical";
  summary: string;
  risks: Array<{ title: string; detail: string; severity: "low" | "medium" | "high" }>;
  next_actions: Array<{ priority: number; action: string; reason: string }>;
}

function isAnalysis(v: unknown): v is Analysis {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return ["low", "medium", "high", "critical"].includes(String(a.risk_level)) && typeof a.summary === "string"
    && Array.isArray(a.risks) && Array.isArray(a.next_actions);
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== "POST") return json(req, { success: false, error: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const gatewayKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json(req, { success: false, error: "Não autorizado" }, 401);

  try {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(auth.slice(7));
    const callerId = String(claims?.claims?.sub ?? "");
    if (claimsErr || !callerId) return json(req, { success: false, error: "Não autorizado" }, 401);

    const admin = createClient(url, service);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (isAdmin !== true) return json(req, { success: false, error: "Acesso exclusivo do administrador" }, 403);

    const body = await req.json().catch(() => ({}));
    const sellerId = typeof body?.sellerId === "string" ? body.sellerId.trim() : "";
    const from = new Date(String(body?.from ?? ""));
    const to = new Date(String(body?.to ?? ""));
    if (!UUID_RE.test(sellerId)) return json(req, { success: false, error: "Seller inválido" }, 400);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) return json(req, { success: false, error: "Período inválido" }, 400);
    if (to.getTime() - from.getTime() > 366 * 86400000) return json(req, { success: false, error: "Período máximo de 1 ano" }, 400);
    if (!gatewayKey) return json(req, { success: false, error: "Análise de IA indisponível" }, 503);

    const f = from.toISOString(), t = to.toISOString();
    const [profile, txs, disputes, actions, balance] = await Promise.all([
      admin.from("profiles").select("created_at, account_status, frozen, balance_frozen").eq("user_id", sellerId).maybeSingle(),
      admin.from("transactions").select("amount, net_amount, status, payment_method, refunded_amount, created_at")
        .eq("user_id", sellerId).eq("is_simulated", false).gte("created_at", f).lt("created_at", t).limit(2000),
      admin.from("disputes").select("type, status, amount, reason, created_at, resolved_at, seller_response")
        .eq("seller_user_id", sellerId).gte("created_at", f).lt("created_at", t).limit(300),
      admin.from("financial_action_log").select("action, actor_role, amount, balance_before, balance_after, reason, created_at")
        .eq("seller_user_id", sellerId).gte("created_at", f).lt("created_at", t).order("created_at").limit(300),
      admin.rpc("calculate_ledger_balance", { _user_id: sellerId }),
    ]);
    if (!profile.data) return json(req, { success: false, error: "Seller não encontrado" }, 404);

    // Aggregate on the server so the model sees compact, factual numbers (no personal data).
    const tx = txs.data ?? [];
    const paid = tx.filter((x) => ["approved", "paid", "completed"].includes(x.status));
    const sum = (arr: { amount: number | null }[]) => arr.reduce((a, x) => a + Number(x.amount ?? 0), 0);
    const facts = {
      period: { from: f, to: t },
      account: { created_at: profile.data.created_at, status: profile.data.account_status, frozen: profile.data.frozen || profile.data.balance_frozen },
      current_ledger_balance: Number(balance.data ?? 0),
      sales: {
        total: tx.length, paid_count: paid.length, paid_amount: sum(paid),
        refunded_count: tx.filter((x) => x.status === "refunded" || Number(x.refunded_amount) > 0).length,
        refunded_amount: tx.reduce((a, x) => a + Number(x.refunded_amount ?? 0), 0),
        chargeback_count: tx.filter((x) => ["chargeback", "disputed"].includes(x.status)).length,
        by_method: Object.fromEntries(["pix", "credit_card", "boleto"].map((m) => [m, tx.filter((x) => x.payment_method === m).length])),
      },
      disputes: (disputes.data ?? []).map((d) => ({ ...d, reason: d.reason?.slice(0, 200), seller_response: d.seller_response ? "enviada" : "não enviada" })),
      balance_movements: (actions.data ?? []).map((a) => ({ ...a, reason: a.reason?.slice(0, 200) })),
    };

    let runId = req.headers.get(RUN_ID_HEADER)?.trim() || undefined;
    const gatewayFetch: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set(RUN_ID_HEADER, runId);
      const res = await fetch(input, { ...init, headers });
      runId ||= res.headers.get(RUN_ID_HEADER)?.trim() || undefined;
      return res;
    };
    const openai = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: gatewayKey,
      headers: { "Lovable-API-Key": gatewayKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" }, fetch: gatewayFetch,
    });

    const result = streamText({
      model: openai.responses(MODEL),
      system: "Você é analista de risco de uma plataforma de pagamentos brasileira. Analise somente os dados fornecidos, sem inventar fatos. Considere índice de chargeback/MED acima de 1% como crítico, reembolsos altos, disputas sem defesa, saldo negativo e ajustes manuais frequentes. Responda SOMENTE JSON válido, sem markdown, em português: {\"risk_level\":\"low|medium|high|critical\",\"summary\":\"até 4 frases\",\"risks\":[{\"title\":\"\",\"detail\":\"\",\"severity\":\"low|medium|high\"}],\"next_actions\":[{\"priority\":1,\"action\":\"ação concreta no painel\",\"reason\":\"\"}]}. No máximo 6 riscos e 6 ações. Se houver poucos dados, diga isso no resumo.",
      prompt: JSON.stringify(facts),
      abortSignal: req.signal,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "medium", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
    });
    const text = (await result.text).trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(text) as unknown;
    if (!isAnalysis(parsed)) throw new Error("invalid analysis");

    const analysis: Analysis = {
      risk_level: parsed.risk_level,
      summary: parsed.summary.slice(0, 2000),
      risks: parsed.risks.slice(0, 6).map((r) => ({ title: String(r.title).slice(0, 160), detail: String(r.detail).slice(0, 800), severity: ["low", "medium", "high"].includes(r.severity) ? r.severity : "medium" })),
      next_actions: parsed.next_actions.slice(0, 6).map((a, i) => ({ priority: i + 1, action: String(a.action).slice(0, 400), reason: String(a.reason).slice(0, 600) })),
    };

    await admin.from("audit_logs").insert({ admin_user_id: callerId, action: "seller_risk_ai_analysis", entity_type: "profile", entity_id: sellerId, details: { from: f, to: t, risk_level: analysis.risk_level, model: MODEL } });

    return new Response(JSON.stringify({ success: true, analysis, facts: { sales: facts.sales, disputes: facts.disputes.length, movements: facts.balance_movements.length, balance: facts.current_ledger_balance } }), {
      status: 200, headers: { ...baseHeaders(req), "Content-Type": "application/json", ...(runId ? { [RUN_ID_HEADER]: runId } : {}) },
    });
  } catch (error) {
    safeError("analyze-seller-risk", error);
    const status = (error as { statusCode?: number })?.statusCode;
    if (status === 402) return json(req, { success: false, error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
    if (status === 429) return json(req, { success: false, error: "Muitas análises seguidas. Tente em alguns instantes." }, 429);
    return json(req, { success: false, error: "Não foi possível concluir a análise" }, 500);
  }
});
