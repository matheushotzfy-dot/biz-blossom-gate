// Public PIX for payment links — no auth required
// Derives seller from payment_link.user_id
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createVeopagDeposit, resolveAcquirerSlug } from "../_shared/veopag.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function safeLog(msg: string, ctx: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  const ALLOWED = ["slug", "transactionId", "status", "amount", "gatewayId", "error", "acquirer"];
  for (const k of ALLOWED) if (k in ctx) safe[k] = ctx[k];
  console.log(`[pay-link-pix] ${msg}`, JSON.stringify(safe));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { slug, customerName, customerEmail, customerDocument } = body ?? {};

    if (!slug || typeof slug !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Link inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: link } = await supabase
      .from("payment_links")
      .select("id, user_id, title, amount, is_active, accept_pix, max_uses, current_uses, expires_at")
      .eq("slug", slug)
      .maybeSingle();

    if (!link || !link.is_active) {
      return new Response(JSON.stringify({ success: false, error: "Link inativo ou inexistente" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!link.accept_pix) {
      return new Response(JSON.stringify({ success: false, error: "Este link não aceita PIX" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: "Link expirado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (link.max_uses && link.current_uses >= link.max_uses) {
      return new Response(JSON.stringify({ success: false, error: "Link esgotado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const amt = Number(link.amount);
    const userId = link.user_id;

    const cleanDoc = String(customerDocument || "").replace(/\D/g, "");
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      return new Response(JSON.stringify({ success: false, error: "CPF ou CNPJ inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const safeName = String(customerName || "").trim().slice(0, 200);
    if (safeName.length < 3) {
      return new Response(JSON.stringify({ success: false, error: "Nome obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const emailRaw = String(customerEmail || "").trim().toLowerCase().slice(0, 255);
    const safeEmail = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
      ? emailRaw
      : `pl+${cleanDoc}@hotzfy.com.br`;

    // Fees
    const { data: fees } = await supabase.from("fees").select("*");
    const getFee = (name: string) => Number(fees?.find((f) => f.name === name)?.value ?? 0);
    const platformPixPct = getFee("Taxa PIX");
    const platformPixFixed = getFee("Taxa Fixa PIX");
    const platformExtraFx = getFee("Taxa Fixa por Transação");

    const { data: cuf } = await supabase
      .from("custom_user_fees")
      .select("pix_percentage, pix_fixed, transaction_percentage, transaction_fixed")
      .eq("user_id", userId)
      .maybeSingle();

    const pct = Number(cuf?.pix_percentage ?? cuf?.transaction_percentage ?? platformPixPct);
    const fixed = Number(cuf?.pix_fixed ?? platformPixFixed) + platformExtraFx;
    const feeAmount = Math.round(((amt * pct) / 100 + fixed) * 100) / 100;
    if (feeAmount < 0 || feeAmount >= amt) {
      return new Response(JSON.stringify({ success: false, error: "Configuração de taxas inválida" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const netAmount = Math.round((amt - feeAmount) * 100) / 100;

    const acquirerSlug = await resolveAcquirerSlug(supabase, userId);
    const preTxId = crypto.randomUUID();

    if (acquirerSlug === "veopag") {
      let veo;
      try {
        veo = await createVeopagDeposit({
          amount: amt, externalId: preTxId, payerName: safeName, payerDocument: cleanDoc,
        }, supabase);
      } catch (e) {
        safeLog("VeoPag error", { error: e instanceof Error ? e.message : "unknown" });
        return new Response(JSON.stringify({ success: false, error: "Falha ao gerar PIX" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const pixExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data: tx } = await supabase.from("transactions").insert({
        id: preTxId,
        user_id: userId,
        product_id: null,
        payment_link_id: link.id,
        amount: amt, fee_amount: feeAmount, net_amount: netAmount,
        status: "pending", payment_method: "pix",
        customer_name: safeName, customer_email: safeEmail, customer_document: cleanDoc,
        podpay_payment_id: veo.transactionId, external_id: preTxId,
        pix_expires_at: pixExpiresAt, pix_copy_paste: veo.qrcode, pix_qrcode: veo.qrcode,
        metadata: { acquirer: "veopag", payment_link_slug: slug },
      }).select().single();

      

      safeLog("VeoPag link PIX created", { transactionId: tx?.id, slug });
      return new Response(JSON.stringify({
        success: true,
        data: {
          transactionId: tx?.id ?? preTxId,
          gatewayId: veo.transactionId,
          acquirer: "veopag",
          amount: amt,
          pix: { qrcode: veo.qrcode, expiresAt: pixExpiresAt },
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PodPay fallback
    if (acquirerSlug !== "podpay") {
      return new Response(JSON.stringify({ success: false, error: "PIX indisponível para este vendedor" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const publicKey = Deno.env.get("PODPAY_PUBLIC_KEY")!;
    const secretKey = Deno.env.get("PODPAY_SECRET_KEY")!;
    const auth = "Basic " + btoa(publicKey + ":" + secretKey);
    const amountInCents = Math.round(amt * 100);

    const podpayResp = await fetch("https://api.podpay.co/v1/transactions", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        amount: amountInCents,
        paymentMethod: "pix",
        items: [{ externalRef: `pl-${slug}`, title: link.title.slice(0, 100), unitPrice: amountInCents, quantity: 1, tangible: false }],
        customer: { name: safeName, email: safeEmail, document: { number: cleanDoc, type: cleanDoc.length > 11 ? "cnpj" : "cpf" } },
        postbackUrl: `${supabaseUrl}/functions/v1/podpay-postback`,
        externalRef: `pl-${slug}-${preTxId}`,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0",
        pix: { expiresInMinutes: 30 },
      }),
    });
    const podpayData = await podpayResp.json();
    if (!podpayResp.ok) {
      safeLog("PodPay error", { status: podpayResp.status });
      return new Response(JSON.stringify({ success: false, error: "Falha ao gerar PIX" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const podpayId = podpayData.data?.id || podpayData.id;
    const pix = podpayData.data?.pix || podpayData.pix || null;

    const { data: tx } = await supabase.from("transactions").insert({
      user_id: userId, product_id: null, payment_link_id: link.id,
      amount: amt, fee_amount: feeAmount, net_amount: netAmount,
      status: "pending", payment_method: "pix",
      customer_name: safeName, customer_email: safeEmail, customer_document: cleanDoc,
      podpay_payment_id: podpayId ? String(podpayId) : null,
      metadata: { acquirer: "podpay", payment_link_slug: slug },
    }).select().single();

    safeLog("PodPay link PIX created", { transactionId: tx?.id, slug });
    return new Response(JSON.stringify({
      success: true,
      data: { transactionId: tx?.id, gatewayId: podpayId, acquirer: "podpay", amount: amt, pix },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    safeLog("Internal error", { error: error instanceof Error ? error.message : "unknown" });
    return new Response(JSON.stringify({ success: false, error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
