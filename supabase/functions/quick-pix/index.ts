// Quick PIX generation — creates a standalone PIX cobrança without a product
// Auth required: user_id is derived from the JWT
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { createVeopagDeposit, resolveAcquirerSlug } from "../_shared/veopag.ts";
import { createPodpayAppPix } from "../_shared/podpay-app.ts";
import { blockIfPaymentsPaused } from "../_shared/kill-switch.ts";
import { buildCorsHeaders } from "../_shared/security.ts";

// Schema estrito do corpo: tipo, range e formato validados no servidor.
const BodySchema = z.object({
  amount: z.coerce.number().finite().min(1).max(100_000),
  customerName: z.string().trim().min(3).max(200),
  customerEmail: z.string().trim().max(255).optional().nullable(),
  customerDocument: z.string().trim().min(11).max(20),
  description: z.string().trim().max(500).optional().nullable(),
  idempotencyKey: z.string().trim().regex(/^[a-zA-Z0-9:_-]{8,200}$/),
}).passthrough();


function safeLog(message: string, context: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  const ALLOWED = ["transactionId", "status", "amount", "podpayId", "error", "code", "acquirer"];
  for (const k of ALLOWED) if (k in context) safe[k] = context[k];
  console.log(`[quick-pix] ${message}`, JSON.stringify(safe));
}

Deno.serve(async (req) => {
  // CORS restrito à allowlist (endpoint autenticado chamado pelo painel).
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // === Auth: get user from JWT ===
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supaUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ success: false, error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // === Input validado por schema (tipo, range e formato) ===
    const rawBody = await req.json().catch(() => ({}));
    const parsedBody = BodySchema.safeParse(rawBody ?? {});
    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Dados inválidos para gerar o PIX." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const body = parsedBody.data;
    const { amount, customerName, customerEmail, customerDocument, description } = body;

    const amt = Number(amount);
    const cleanDoc = String(customerDocument).replace(/\D/g, "");
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      return new Response(
        JSON.stringify({ success: false, error: "CPF ou CNPJ inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const safeName = String(customerName).trim().slice(0, 200);
    const emailRaw = String(customerEmail || "").trim().toLowerCase().slice(0, 255);
    const safeEmail = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
      ? emailRaw
      : `pix+${cleanDoc}@hotzfy.com.br`;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Kill switch global de pagamentos (admin).
    const paused = await blockIfPaymentsPaused(supabase as never, corsHeaders);
    if (paused) return paused;

    const requestIp = req.headers.get("cf-connecting-ip")
      || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "0.0.0.0";

    // === Rate limit: 10 cobranças/min por usuário, 30/min por IP ===
    {
      const limits = await Promise.all([
        supabase.rpc("bump_rate_limit", { _bucket_key: `quick_pix_user:${userId}`, _window_seconds: 60, _max_count: 10 }),
        supabase.rpc("bump_rate_limit", { _bucket_key: `quick_pix_ip:${requestIp}`, _window_seconds: 60, _max_count: 30 }),
      ]);
      const blocked = limits.some((r) =>
        Array.isArray(r.data) ? (r.data[0] as { allowed?: boolean } | undefined)?.allowed === false : false
      );
      if (blocked) {
        return new Response(
          JSON.stringify({ success: false, error: "Muitas cobranças em pouco tempo. Aguarde um instante." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } },
        );
      }
    }

    // === Idempotency — obrigatória para impedir dupla cobrança em retries ===
    const rawIdem = body.idempotencyKey;


    {
      // Escopar por usuário para evitar colisão global cross-tenant
      const scopedKey = `qpix:${userId}:${rawIdem}`;
      const { data: cached } = await supabase
        .from("idempotency_keys")
        .select("response")
        .eq("key", scopedKey)
        .maybeSingle();
      if (cached?.response) {
        return new Response(JSON.stringify(cached.response), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Marcar chave "em uso" — se falhar por conflito, outro request já está processando
      const { error: claimErr } = await supabase
        .from("idempotency_keys")
        .insert({ key: scopedKey, response: null });
      if (claimErr && String(claimErr.message).includes("duplicate")) {
        return new Response(
          JSON.stringify({ success: false, error: "Cobrança em processamento. Aguarde alguns segundos." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (claimErr) {
        safeLog("Idempotency claim error", { error: claimErr.message });
        return new Response(
          JSON.stringify({ success: false, error: "Não foi possível reservar a cobrança" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // O limite deve ser validado antes de criar a cobrança na adquirente.
    const { data: maxTicket, error: maxTicketError } = await supaUser
      .rpc("get_user_max_ticket", { _user_id: userId });
    if (maxTicketError) {
      await supabase.from("idempotency_keys").delete().eq("key", `qpix:${userId}:${rawIdem}`);
      safeLog("Max ticket lookup failed", { error: maxTicketError.message });
      return new Response(
        JSON.stringify({ success: false, error: "Não foi possível validar o limite da cobrança" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const allowedMax = Number(maxTicket);
    if (Number.isFinite(allowedMax) && allowedMax > 0 && amt > allowedMax) {
      await supabase.from("idempotency_keys").delete().eq("key", `qpix:${userId}:${rawIdem}`);
      return new Response(
        JSON.stringify({ success: false, error: `Valor excede o limite máximo de R$ ${allowedMax.toFixed(2)}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // === Fees (PIX) — same source of truth as podpay-create-transaction + Taxas.tsx ===
    const { data: fees, error: feesError } = await supabase.from("fees").select("*");
    if (feesError || !fees || fees.length === 0) {
      safeLog("Fee configuration missing", { error: feesError?.message || "no fees" });
      return new Response(
        JSON.stringify({ success: false, error: "Configuração de taxas indisponível. Contate o suporte." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const getFee = (name: string) => Number(fees.find((f) => f.name === name)?.value ?? 0);
    const platformPixPct   = getFee("Taxa PIX");
    const platformPixFixed = getFee("Taxa Fixa PIX");
    const platformExtraFx  = getFee("Taxa Fixa por Transação");

    const { data: cuf } = await supabase
      .from("custom_user_fees")
      .select("pix_percentage, pix_fixed, transaction_percentage, transaction_fixed")
      .eq("user_id", userId)
      .maybeSingle();

    const pct   = Number(cuf?.pix_percentage ?? cuf?.transaction_percentage ?? platformPixPct);
    const fixed = Number(cuf?.pix_fixed      ?? platformPixFixed) + platformExtraFx;

    let feeAmount = Math.round(((amt * pct) / 100 + fixed) * 100) / 100;
    if (feeAmount < 0 || feeAmount >= amt) {
      safeLog("Fee out of safe range", { feeAmount, amt });
      return new Response(
        JSON.stringify({ success: false, error: "Erro na configuração de taxas. Contate o suporte." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const netAmount = Math.round((amt - feeAmount) * 100) / 100;
    const amountInCents = Math.round(amt * 100);

    // ===================================================================
    // === ACQUIRER ROUTING: VeoPag (PIX only) ============================
    // ===================================================================
    // Se o vendedor está roteado para VeoPag, gera na VeoPag em vez do
    // PodPay. Anonimização: sem nome/email da plataforma, email aleatório.
    const acquirerSlug = await resolveAcquirerSlug(supabase, userId);
    if (acquirerSlug === "veopag") {
      const preTxId = crypto.randomUUID();

      let veo;
      try {
        veo = await createVeopagDeposit({
          amount: amt,
          externalId: preTxId,
          payerName: safeName,
          payerDocument: cleanDoc,
        }, supabase);
      } catch (e) {
        safeLog("VeoPag error", { error: e instanceof Error ? e.message : "unknown" });
        return new Response(
          JSON.stringify({ success: false, error: "Não foi possível gerar o PIX. Tente novamente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const pixExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const { data: transaction } = await supabase
        .from("transactions")
        .insert({
          id: preTxId,
          user_id: userId,
          product_id: null,
          amount: amt,
          fee_amount: feeAmount,
          net_amount: netAmount,
          status: "pending",
          payment_method: "pix",
          customer_name: safeName,
          customer_email: safeEmail,
          customer_document: cleanDoc,
          buyer_ip: requestIp,
          podpay_payment_id: veo.transactionId,
          external_id: preTxId,
          pix_expires_at: pixExpiresAt,
          pix_copy_paste: veo.qrcode,
          pix_qrcode: veo.qrcode,
          metadata: { acquirer: "veopag" },
        })
        .select()
        .single();

      const responsePayload = {
        success: true,
        data: {
          transactionId: transaction?.id ?? preTxId,
          podpayId: veo.transactionId,
          gatewayId: veo.transactionId,
          acquirer: "veopag",
          amount: amt,
          pix: { qrcode: veo.qrcode, expiresAt: pixExpiresAt },
        },
      };

      const scopedKey = `qpix:${userId}:${rawIdem}`;
      await supabase.from("idempotency_keys").update({ response: responsePayload }).eq("key", scopedKey);

      safeLog("VeoPag quick PIX created", { transactionId: transaction?.id });
      return new Response(
        JSON.stringify(responsePayload),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // ===================================================================
    // === ACQUIRER ROUTING: PodPay (nova - api.podpay.app) ==============
    // ===================================================================
    if (acquirerSlug === "podpay_app") {
      const preTxId = crypto.randomUUID();

      let pod;
      try {
        pod = await createPodpayAppPix({
          amount: amt,
          externalId: preTxId,
          payerName: safeName,
          payerDocument: cleanDoc,
          description: String(description || "Cobrança PIX"),
        }, supabase);
      } catch (e) {
        safeLog("PodPay error", { error: e instanceof Error ? e.message : "unknown" });
        return new Response(
          JSON.stringify({ success: false, error: "Não foi possível gerar o PIX. Tente novamente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const pixExpiresAt = pod.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const { data: transaction } = await supabase
        .from("transactions")
        .insert({
          id: preTxId,
          user_id: userId,
          product_id: null,
          amount: amt,
          fee_amount: feeAmount,
          net_amount: netAmount,
          status: "pending",
          payment_method: "pix",
          customer_name: safeName,
          customer_email: safeEmail,
          customer_document: cleanDoc,
          buyer_ip: requestIp,
          podpay_payment_id: pod.transactionId,
          external_id: preTxId,
          pix_expires_at: pixExpiresAt,
          pix_copy_paste: pod.qrcode,
          pix_qrcode: pod.qrcode,
          metadata: { acquirer: "podpay_app" },
        })
        .select()
        .single();

      const responsePayload = {
        success: true,
        data: {
          transactionId: transaction?.id ?? preTxId,
          podpayId: pod.transactionId,
          gatewayId: pod.transactionId,
          acquirer: "podpay_app",
          amount: amt,
          pix: { qrcode: pod.qrcode, expiresAt: pixExpiresAt },
        },
      };

      const scopedKey = `qpix:${userId}:${rawIdem}`;
      await supabase.from("idempotency_keys").update({ response: responsePayload }).eq("key", scopedKey);

      safeLog("PodPay quick PIX created", { transactionId: transaction?.id });
      return new Response(
        JSON.stringify(responsePayload),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (acquirerSlug !== "podpay") {
      safeLog("Unsupported acquirer for quick PIX", { acquirer: acquirerSlug });
      return new Response(
        JSON.stringify({ success: false, error: "PIX indisponível para a adquirente configurada." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // ===================================================================
    // === Fim do desvio VeoPag — abaixo segue o fluxo PodPay normal =====
    // ===================================================================
    const publicKey = Deno.env.get("PODPAY_PUBLIC_KEY")!;
    const secretKey = Deno.env.get("PODPAY_SECRET_KEY")!;
    const auth = "Basic " + btoa(publicKey + ":" + secretKey);

    const desc = String(description || "Cobrança PIX").trim().slice(0, 100) || "Cobrança PIX";
    const podpayPayload = {
      amount: amountInCents,
      paymentMethod: "pix",
      items: [{
        externalRef: `quick-${userId.slice(0, 8)}`,
        title: desc,
        unitPrice: amountInCents,
        quantity: 1,
        tangible: false,
      }],
      customer: {
        name: safeName,
        email: safeEmail,
        document: {
          number: cleanDoc,
          type: cleanDoc.length > 11 ? "cnpj" : "cpf",
        },
      },
      postbackUrl: `${supabaseUrl}/functions/v1/podpay-postback`,
      externalRef: `quick-${userId}`,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0",
      pix: { expiresInMinutes: 30 },
    };

    safeLog("Creating quick PIX", { amount: amountInCents });

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch("https://api.podpay.co/v1/transactions", {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(podpayPayload),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(t);
      const isAbort = e instanceof Error && e.name === "AbortError";
      safeLog("PodPay fetch failed", { error: isAbort ? "timeout" : "network" });
      return new Response(
        JSON.stringify({ success: false, error: "Tempo esgotado. Tente novamente." }),
        { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } finally {
      clearTimeout(t);
    }

    const podpayData = await response.json();
    if (!response.ok) {
      safeLog("PodPay error", { status: response.status });
      return new Response(
        JSON.stringify({ success: false, error: "Não foi possível gerar o PIX. Tente novamente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const podpayId = podpayData.data?.id || podpayData.id;
    const pix = podpayData.data?.pix || podpayData.pix || null;

    const { data: transaction } = await supabase.from("transactions").insert({
      user_id: userId,
      product_id: null,
      amount: amt,
      fee_amount: feeAmount,
      net_amount: netAmount,
      status: "pending",
      payment_method: "pix",
      customer_name: safeName,
      customer_email: safeEmail,
      customer_document: cleanDoc,
      buyer_ip: requestIp,
      podpay_payment_id: podpayId ? String(podpayId) : null,
      metadata: { acquirer: "podpay" },
    }).select().single();

    safeLog("Quick PIX created", { transactionId: transaction?.id, podpayId });

    const responsePayload = {
      success: true,
      data: {
        transactionId: transaction?.id,
        podpayId,
        gatewayId: podpayId,
        acquirer: "podpay",
        amount: amt,
        pix,
      },
    };

    // Persistir resposta idempotente para retries subsequentes
    const scopedKey = `qpix:${userId}:${rawIdem}`;
    await supabase.from("idempotency_keys").update({ response: responsePayload }).eq("key", scopedKey);

    return new Response(
      JSON.stringify(responsePayload),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    safeLog("Internal error", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
