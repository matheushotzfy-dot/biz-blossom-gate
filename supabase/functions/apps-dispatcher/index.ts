// Apps delivery worker — Z-API and UTMify.
// Picks pending app_deliveries rows whose next_retry_at is due and POSTs them
// to the right provider. Retries with exponential backoff. Can be invoked by
// cron, manually, or fire-and-forget after a confirmed payment event.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isInternalCall, unauthorizedResponse } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};

const RETRY_DELAYS_SECONDS = [10, 30, 120, 600, 3600];
const MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length;
const DELIVERY_TIMEOUT_MS = 10_000;
const BATCH_SIZE = 25;

// SSRF guard: reject non-HTTPS and internal/RFC1918 destinations for any
// seller-controlled outbound URL. Defence-in-depth on top of the DB trigger
// `validate_integration_url` (which blocks new/updated rows).
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1|fc|fd|172\.(1[6-9]|2[0-9]|3[01])\.)/i;
function assertSafeUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) throw new Error("URL da integração ausente");
  let u: URL;
  try { u = new URL(rawUrl.trim()); } catch { throw new Error("URL da integração inválida"); }
  if (u.protocol !== "https:") throw new Error("URL da integração deve usar HTTPS");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (PRIVATE_HOST_RE.test(host)) throw new Error("URL da integração aponta para endereço interno");
  return u.toString().replace(/\/+$/, "");
}

interface Delivery {
  id: string;
  integration_id: string;
  user_id: string;
  transaction_id: string | null;
  app_name: string;
  event: string;
  payload: Record<string, any>;
  attempt: number;
  is_test?: boolean;
}

// UTMify expects "YYYY-MM-DD HH:mm:ss" in UTC (per official docs)
function formatUtmifyDate(input?: string | null): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

interface Integration {
  id: string;
  app_name: string;
  api_key: string | null;
  api_url: string | null;
  webhook_url: string | null;
  is_active: boolean;
  config: Record<string, any>;
}

async function timedFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = await res.text().catch(() => "");
    return { status: res.status, body: body.slice(0, 2000), error: null as string | null };
  } catch (err) {
    return { status: 0, body: "", error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

// ────────────────── Z-API ──────────────────
// Z-API REST: https://{api_url=instance_id}/token/{api_key=instance_token}/send-text
// Optional Client-Token via webhook_url field.
async function deliverZapi(integration: Integration, d: Delivery) {
  const instanceId = integration.api_url?.trim();
  const instanceToken = integration.api_key?.trim();
  const clientToken = integration.webhook_url?.trim();
  if (!instanceId || !instanceToken) {
    return { status: 0, body: "", error: "Z-API missing instance_id or instance_token" };
  }
  const phone = String(d.payload?.customer?.phone || "").replace(/\D/g, "");
  if (!phone) {
    return { status: 0, body: "", error: "Z-API skipped: customer phone missing" };
  }
  const name = d.payload?.customer?.name || "";
  const amountBRL = Number(d.payload?.transaction?.amount || 0)
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const messages: Record<string, string> = {
    Purchase: `✅ Olá ${name}, sua compra de ${amountBRL} foi aprovada! Em instantes você receberá os detalhes de acesso.`,
    Refund: `Olá ${name}, identificamos o estorno da sua compra de ${amountBRL}.`,
    Chargeback: `Olá ${name}, notamos uma contestação no pagamento de ${amountBRL}. Entre em contato para regularizar.`,
    InitiateCheckout: `Olá ${name}, vimos que você iniciou um checkout de ${amountBRL}. Posso ajudar a finalizar?`,
    PixGenerated: `Olá ${name}, seu PIX de ${amountBRL} foi gerado. Pague em até 30 min para garantir.`,
    BoletoGenerated: `Olá ${name}, seu boleto de ${amountBRL} foi gerado.`,
  };
  const message = messages[d.event] ?? `Atualização do pedido: ${d.event}`;

  const url = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  return await timedFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone: phone.startsWith("55") ? phone : `55${phone}`, message }),
  });
}

// ────────────────── UTMify ──────────────────
// API: POST https://api.utmify.com.br/api-credentials/orders
// header: x-api-token
async function deliverUtmify(integration: Integration, d: Delivery) {
  const token = integration.api_key?.trim();
  if (!token) return { status: 0, body: "", error: "UTMify missing api_token" };

  const tx = d.payload?.transaction || {};
  const customer = d.payload?.customer || {};
  const utm = d.payload?.utm || {};

  // UTMify accepted statuses (per https://docs.utmify.com.br): paid | waiting_payment | refused | refunded | chargedback
  const statusMap: Record<string, string> = {
    Purchase: "paid",
    Refund: "refunded",
    Chargeback: "chargedback",
    InitiateCheckout: "waiting_payment",
    PixGenerated: "waiting_payment",
    BoletoGenerated: "waiting_payment",
  };

  // UTMify accepted payment methods: credit_card | pix | billet (boleto)
  const pmMap: Record<string, string> = {
    credit_card: "credit_card",
    creditcard: "credit_card",
    card: "credit_card",
    pix: "pix",
    boleto: "billet",
    billet: "billet",
  };
  const paymentMethod = pmMap[String(tx.payment_method || "").toLowerCase()] ?? "credit_card";

  const amount = Number(tx.amount || 0);
  const net = Number(tx.net_amount ?? tx.amount ?? 0);
  const amountCents = Math.round(amount * 100);
  const gatewayFeeCents = Math.max(0, Math.round((amount - net) * 100));
  const userCommissionCents = Math.max(0, Math.round(net * 100));

  // sanitize phone to digits-only (UTMify accepts null or string)
  const phoneDigits = String(customer.phone || "").replace(/\D/g, "");

  const nowUtmify = formatUtmifyDate(new Date().toISOString());

  const body = {
    orderId: String(tx.id || `venxpay_${Date.now()}`),
    platform: "Venxpay",
    paymentMethod,
    status: statusMap[d.event] ?? "waiting_payment",
    createdAt: formatUtmifyDate(tx.created_at) ?? nowUtmify,
    approvedDate: d.event === "Purchase" ? nowUtmify : null,
    refundedAt: d.event === "Refund" ? nowUtmify : null,
    customer: {
      name: customer.name || "Cliente",
      email: customer.email || "",
      phone: phoneDigits || null,
      document: String(customer.document || "").replace(/\D/g, "") || null,
      country: "BR",
      ip: d.payload?.customer?.ip ?? null,
    },
    products: [{
      id: String(tx.product_id || "unknown"),
      name: d.payload?.product_name || "Produto",
      planId: null,
      planName: null,
      quantity: 1,
      priceInCents: amountCents,
    }],
    trackingParameters: {
      src: utm.src ?? null,
      sck: utm.sck ?? null,
      utm_source: utm.utm_source ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      utm_medium: utm.utm_medium ?? null,
      utm_content: utm.utm_content ?? null,
      utm_term: utm.utm_term ?? null,
    },
    commission: {
      totalPriceInCents: amountCents,
      gatewayFeeInCents: gatewayFeeCents,
      userCommissionInCents: userCommissionCents,
    },
    isTest: d.is_test === true,
  };

  return await timedFetch("https://api.utmify.com.br/api-credentials/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "x-api-token": token,
    },
    body: JSON.stringify(body),
  });
}

// ────────────────── ActiveCampaign ──────────────────
// 1) Upsert contact via POST {api_url}/api/3/contact/sync  (header: Api-Token)
// 2) Find/create tag for event (tag_name = `venxpay_${event_lower}`)
// 3) Apply tag via POST /api/3/contactTags
async function deliverActiveCampaign(integration: Integration, d: Delivery) {
  const apiKey = integration.api_key?.trim();
  if (!integration.api_url || !apiKey) return { status: 0, body: "", error: "ActiveCampaign missing api_url or api_key" };
  let apiUrl: string;
  try { apiUrl = assertSafeUrl(integration.api_url); } catch (e) { return { status: 0, body: "", error: (e as Error).message }; }

  const email = String(d.payload?.customer?.email || "").trim();
  if (!email) return { status: 0, body: "", error: "ActiveCampaign skipped: customer email missing" };

  const fullName = String(d.payload?.customer?.name || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ");
  const headers = { "Api-Token": apiKey, "Content-Type": "application/json", "Accept": "application/json" };
  const tagName = `venxpay_${d.event.toLowerCase()}`;

  // 1) sync contact
  const syncRes = await timedFetch(`${apiUrl}/api/3/contact/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contact: {
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: d.payload?.customer?.phone || undefined,
      },
    }),
  });
  if (syncRes.status < 200 || syncRes.status >= 300) return syncRes;
  let contactId: string | null = null;
  try { contactId = JSON.parse(syncRes.body)?.contact?.id ?? null; } catch { /* ignore */ }
  if (!contactId) return { status: syncRes.status, body: syncRes.body, error: "ActiveCampaign: contact id missing" };

  // 2) find or create tag
  let tagId: string | null = null;
  const tagSearch = await timedFetch(`${apiUrl}/api/3/tags?search=${encodeURIComponent(tagName)}`, {
    method: "GET",
    headers,
  });
  if (tagSearch.status >= 200 && tagSearch.status < 300) {
    try {
      const parsed = JSON.parse(tagSearch.body);
      tagId = parsed?.tags?.find((t: any) => t.tag === tagName)?.id ?? null;
    } catch { /* ignore */ }
  }
  if (!tagId) {
    const tagCreate = await timedFetch(`${apiUrl}/api/3/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tag: { tag: tagName, tagType: "contact", description: "Venxpay event tag" } }),
    });
    try { tagId = JSON.parse(tagCreate.body)?.tag?.id ?? null; } catch { /* ignore */ }
    if (!tagId) return { status: tagCreate.status, body: tagCreate.body, error: "ActiveCampaign: failed to create tag" };
  }

  // 3) apply tag
  return await timedFetch(`${apiUrl}/api/3/contactTags`, {
    method: "POST",
    headers,
    body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } }),
  });
}

// ────────────────── Notazz ──────────────────
// Notazz REST: POST https://app.notazz.com/api/emissaoNF.php
// auth via apikey in body (legacy form-encoded). Emits NF-e from data.
async function deliverNotazz(integration: Integration, d: Delivery) {
  const apiKey = integration.api_key?.trim();
  if (!apiKey) return { status: 0, body: "", error: "Notazz missing api_key" };
  // Only emit on Purchase, cancel on Refund
  if (d.event !== "Purchase" && d.event !== "Refund") {
    return { status: 200, body: "skipped: event not relevant for Notazz", error: null };
  }
  const tx = d.payload?.transaction || {};
  const customer = d.payload?.customer || {};
  const doc = String(customer.document || "").replace(/\D/g, "");
  if (!doc) return { status: 0, body: "", error: "Notazz: customer document missing" };

  const params = new URLSearchParams({
    API_KEY: apiKey,
    OPERATION: d.event === "Purchase" ? "ISSUE" : "CANCEL",
    DESTINATION_TAXID: doc,
    DESTINATION_NAME: String(customer.name || "Cliente"),
    DESTINATION_EMAIL: String(customer.email || ""),
    AMOUNT: Number(tx.amount || 0).toFixed(2),
    EXTERNAL_ID: String(tx.id || ""),
    CANCEL_REASON: d.event === "Refund" ? "Estorno solicitado pelo cliente" : "",
  });

  return await timedFetch("https://app.notazz.com/api/emissaoNF.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

// ────────────────── TheMembers ──────────────────
// POST {api_url || https://api.themembers.com.br}/integrations/transactions
// header: Authorization: Bearer {api_key}
async function deliverTheMembers(integration: Integration, d: Delivery) {
  const apiKey = integration.api_key?.trim();
  if (!apiKey) return { status: 0, body: "", error: "TheMembers missing api_key" };
  let base: string;
  try { base = assertSafeUrl(integration.api_url || "https://api.themembers.com.br"); } catch (e) { return { status: 0, body: "", error: (e as Error).message }; }
  const tx = d.payload?.transaction || {};
  const customer = d.payload?.customer || {};

  const statusMap: Record<string, string> = {
    Purchase: "approved",
    Refund: "refunded",
    Chargeback: "chargeback",
    PixGenerated: "pending",
    BoletoGenerated: "pending",
    InitiateCheckout: "pending",
  };

  return await timedFetch(`${base}/integrations/transactions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      transaction_id: tx.id,
      external_id: tx.external_id ?? tx.id,
      status: statusMap[d.event] ?? "pending",
      amount: Number(tx.amount || 0),
      payment_method: tx.payment_method,
      product_id: tx.product_id,
      customer: {
        name: customer.name,
        email: customer.email,
        document: customer.document,
        phone: customer.phone,
      },
      event: d.event,
      occurred_at: new Date().toISOString(),
    }),
  });
}

// ────────────────── Spedy ──────────────────
// POST https://api.spedy.com.br/v1/orders   header: Authorization: Bearer {token}
// Only triggers on Purchase (creates shipping order).
async function deliverSpedy(integration: Integration, d: Delivery) {
  const token = integration.api_key?.trim();
  if (!token) return { status: 0, body: "", error: "Spedy missing api_key" };
  if (d.event !== "Purchase") {
    return { status: 200, body: "skipped: Spedy only acts on Purchase", error: null };
  }
  const tx = d.payload?.transaction || {};
  const customer = d.payload?.customer || {};

  return await timedFetch("https://api.spedy.com.br/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      external_id: tx.id,
      total: Number(tx.amount || 0),
      payment_method: tx.payment_method,
      customer: {
        name: customer.name,
        email: customer.email,
        document: customer.document,
        phone: customer.phone,
      },
      items: [{
        sku: tx.product_id,
        name: "Produto digital",
        quantity: 1,
        price: Number(tx.amount || 0),
      }],
    }),
  });
}

// ────────────────── Astron Members ──────────────────
// POST {api_url || https://api.astronmembers.com}/v1/enrollments
// header: Authorization: Bearer {api_key}
// config.product_external_id (optional) – id do produto na Astron
async function deliverAstron(integration: Integration, d: Delivery) {
  const apiKey = integration.api_key?.trim();
  if (!apiKey) return { status: 0, body: "", error: "Astron missing api_key" };
  let base: string;
  try { base = assertSafeUrl(integration.api_url || "https://api.astronmembers.com"); } catch (e) { return { status: 0, body: "", error: (e as Error).message }; }
  const tx = d.payload?.transaction || {};
  const customer = d.payload?.customer || {};
  const productExternalId = (integration.config as any)?.product_external_id ?? tx.product_id;

  const actionMap: Record<string, string> = {
    Purchase: "create",
    Refund: "cancel",
    Chargeback: "cancel",
  };
  const action = actionMap[d.event];
  if (!action) return { status: 200, body: "skipped: event not relevant for Astron", error: null };

  const path = action === "create" ? "/v1/enrollments" : `/v1/enrollments/${encodeURIComponent(String(tx.id))}/cancel`;
  return await timedFetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      external_id: tx.id,
      product_id: productExternalId,
      student: {
        name: customer.name,
        email: customer.email,
        document: customer.document,
        phone: customer.phone,
      },
      reason: action === "cancel" ? d.event.toLowerCase() : undefined,
    }),
  });
}

// ────────────────── MemberKit ──────────────────
// POST {api_url || https://memberkit.com.br}/api/v1/subscribers
// header: Authorization: Token {api_key}
// config.classroom_id (recomendado) – id da turma
async function deliverMemberKit(integration: Integration, d: Delivery) {
  const apiKey = integration.api_key?.trim();
  if (!apiKey) return { status: 0, body: "", error: "MemberKit missing api_key" };
  let base: string;
  try { base = assertSafeUrl(integration.api_url || "https://memberkit.com.br"); } catch (e) { return { status: 0, body: "", error: (e as Error).message }; }
  const classroomId = (integration.config as any)?.classroom_id;
  const customer = d.payload?.customer || {};
  const email = String(customer.email || "").trim();
  if (!email) return { status: 0, body: "", error: "MemberKit: customer email missing" };

  const headers = {
    "Authorization": `Token ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  if (d.event === "Purchase") {
    return await timedFetch(`${base}/api/v1/subscribers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        subscriber: {
          name: customer.name || email,
          email,
          phone_number: customer.phone || undefined,
          classroom_ids: classroomId ? [classroomId] : undefined,
          send_welcome_email: true,
        },
      }),
    });
  }
  if (d.event === "Refund" || d.event === "Chargeback") {
    if (!classroomId) {
      return { status: 200, body: "skipped: classroom_id not configured for revoke", error: null };
    }
    return await timedFetch(`${base}/api/v1/subscribers/remove_from_classroom`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, classroom_id: classroomId }),
    });
  }
  return { status: 200, body: "skipped: event not relevant for MemberKit", error: null };
}

// ────────────────── SMSFunnel ──────────────────
// POST {api_url || https://api.smsfunnel.com.br}/v1/messages
// header: Authorization: Bearer {api_key}
async function deliverSmsFunnel(integration: Integration, d: Delivery) {
  const apiKey = integration.api_key?.trim();
  if (!apiKey) return { status: 0, body: "", error: "SMSFunnel missing api_key" };
  let base: string;
  try { base = assertSafeUrl(integration.api_url || "https://api.smsfunnel.com.br"); } catch (e) { return { status: 0, body: "", error: (e as Error).message }; }
  const phone = String(d.payload?.customer?.phone || "").replace(/\D/g, "");
  if (!phone) return { status: 0, body: "", error: "SMSFunnel: customer phone missing" };
  const name = d.payload?.customer?.name || "";
  const amountBRL = Number(d.payload?.transaction?.amount || 0)
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const templates: Record<string, string> = {
    Purchase: `Olá ${name}, sua compra de ${amountBRL} foi aprovada! Acesse seu produto.`,
    Refund: `Olá ${name}, seu estorno de ${amountBRL} foi processado.`,
    Chargeback: `Olá ${name}, há uma contestação no pagamento de ${amountBRL}. Entre em contato.`,
    PixGenerated: `Olá ${name}, seu PIX de ${amountBRL} foi gerado. Pague em até 30 min.`,
    BoletoGenerated: `Olá ${name}, seu boleto de ${amountBRL} foi gerado.`,
    InitiateCheckout: `Olá ${name}, finalize sua compra de ${amountBRL}.`,
  };
  const message = templates[d.event] ?? `Atualização: ${d.event}`;
  return await timedFetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      to: phone.startsWith("55") ? phone : `55${phone}`,
      message,
      external_id: d.payload?.transaction?.id,
    }),
  });
}

// ────────────────── Voxuy ──────────────────
// POST {api_url || https://api.voxuy.com}/v1/messages
// header: Authorization: Bearer {api_key}  ou  api_key como token simples
// config.instance_id (opcional)
async function deliverVoxuy(integration: Integration, d: Delivery) {
  const apiKey = integration.api_key?.trim();
  if (!apiKey) return { status: 0, body: "", error: "Voxuy missing api_key" };
  let base: string;
  try { base = assertSafeUrl(integration.api_url || "https://api.voxuy.com"); } catch (e) { return { status: 0, body: "", error: (e as Error).message }; }
  const instanceId = (integration.config as any)?.instance_id;
  const phone = String(d.payload?.customer?.phone || "").replace(/\D/g, "");
  if (!phone) return { status: 0, body: "", error: "Voxuy: customer phone missing" };
  const name = d.payload?.customer?.name || "";
  const amountBRL = Number(d.payload?.transaction?.amount || 0)
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const templates: Record<string, string> = {
    Purchase: `✅ Olá ${name}, sua compra de ${amountBRL} foi aprovada!`,
    Refund: `Olá ${name}, seu estorno de ${amountBRL} foi processado.`,
    Chargeback: `Olá ${name}, contestação detectada no valor de ${amountBRL}.`,
    PixGenerated: `Olá ${name}, seu PIX de ${amountBRL} foi gerado. Pague em até 30 min.`,
    BoletoGenerated: `Olá ${name}, seu boleto de ${amountBRL} foi gerado.`,
    InitiateCheckout: `Olá ${name}, finalize sua compra de ${amountBRL}.`,
  };
  const message = templates[d.event] ?? `Atualização: ${d.event}`;
  return await timedFetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      instance_id: instanceId,
      phone: phone.startsWith("55") ? phone : `55${phone}`,
      message,
      external_id: d.payload?.transaction?.id,
    }),
  });
}

// ────────────────── Cademi ──────────────────
// POST {api_url || https://api.cademi.com.br}/api/v1/enrollments
// header: Authorization: Bearer {api_key}
// config.course_id (recomendado)
async function deliverCademi(integration: Integration, d: Delivery) {
  const apiKey = integration.api_key?.trim();
  if (!apiKey) return { status: 0, body: "", error: "Cademi missing api_key" };
  let base: string;
  try { base = assertSafeUrl(integration.api_url || "https://api.cademi.com.br"); } catch (e) { return { status: 0, body: "", error: (e as Error).message }; }
  const courseId = (integration.config as any)?.course_id;
  const customer = d.payload?.customer || {};
  const email = String(customer.email || "").trim();
  if (!email) return { status: 0, body: "", error: "Cademi: customer email missing" };

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  if (d.event === "Purchase") {
    return await timedFetch(`${base}/api/v1/enrollments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        external_id: d.payload?.transaction?.id,
        course_id: courseId,
        student: {
          name: customer.name || email,
          email,
          document: customer.document,
          phone: customer.phone,
        },
        send_welcome_email: true,
      }),
    });
  }
  if (d.event === "Refund" || d.event === "Chargeback") {
    return await timedFetch(`${base}/api/v1/enrollments/cancel`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        course_id: courseId,
        reason: d.event.toLowerCase(),
      }),
    });
  }
  return { status: 200, body: "skipped: event not relevant for Cademi", error: null };
}

// ────────────────── Worker ──────────────────
async function deliverOne(admin: ReturnType<typeof createClient>, d: Delivery) {
  const { data: integ } = await admin
    .rpc("get_app_integration_for_dispatch", { _integration_id: d.integration_id })
    .maybeSingle<Integration>();

  if (!integ || !integ.is_active) {
    await admin.from("app_deliveries").update({
      status: "exhausted",
      error: "Integration disabled or removed",
    }).eq("id", d.id);
    return;
  }

  let result: { status: number; body: string; error: string | null };
  if (integ.app_name === "zapi") result = await deliverZapi(integ, d);
  else if (integ.app_name === "utmify") result = await deliverUtmify(integ, d);
  else if (integ.app_name === "activecampaign") result = await deliverActiveCampaign(integ, d);
  else if (integ.app_name === "notazz") result = await deliverNotazz(integ, d);
  else if (integ.app_name === "themembers") result = await deliverTheMembers(integ, d);
  else if (integ.app_name === "spedy") result = await deliverSpedy(integ, d);
  else if (integ.app_name === "astron") result = await deliverAstron(integ, d);
  else if (integ.app_name === "memberkit") result = await deliverMemberKit(integ, d);
  else if (integ.app_name === "smsfunnel") result = await deliverSmsFunnel(integ, d);
  else if (integ.app_name === "voxuy") result = await deliverVoxuy(integ, d);
  else if (integ.app_name === "cademi") result = await deliverCademi(integ, d);
  else {
    await admin.from("app_deliveries").update({
      status: "exhausted",
      error: `Unsupported app_name: ${integ.app_name}`,
    }).eq("id", d.id);
    return;
  }

  const ok = result.status >= 200 && result.status < 300;
  const attempt = d.attempt + 1;

  if (ok) {
    await admin.from("app_deliveries").update({
      status: "delivered",
      attempt,
      response_status: result.status,
      response_body: result.body,
      delivered_at: new Date().toISOString(),
      error: null,
    }).eq("id", d.id);
    return;
  }

  if (attempt >= MAX_ATTEMPTS) {
    await admin.from("app_deliveries").update({
      status: "exhausted",
      attempt,
      response_status: result.status,
      response_body: result.body,
      error: result.error ?? `HTTP ${result.status}`,
    }).eq("id", d.id);
    return;
  }

  const delay = RETRY_DELAYS_SECONDS[Math.min(attempt - 1, RETRY_DELAYS_SECONDS.length - 1)];
  await admin.from("app_deliveries").update({
    status: "pending",
    attempt,
    response_status: result.status,
    response_body: result.body,
    error: result.error ?? `HTTP ${result.status}`,
    next_retry_at: new Date(Date.now() + delay * 1000).toISOString(),
  }).eq("id", d.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const admin = createClient(supabaseUrl, serviceKey);

  // Optional test mode: { action: "test", integration_id }
  let action: string | undefined;
  let testIntegrationId: string | undefined;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      action = typeof body?.action === "string" ? body.action : undefined;
      const rawId = typeof body?.integration_id === "string" ? body.integration_id : "";
      testIntegrationId = /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : undefined;
    } catch { /* ignore */ }
  }

  const internal = isInternalCall(req);
  // Sellers may only run "test" on their own integrations (validated JWT).
  let callerUserId: string | null = null;
  if (!internal) {
    if (action !== "test" || !testIntegrationId) return unauthorizedResponse(corsHeaders);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return unauthorizedResponse(corsHeaders);
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user) return unauthorizedResponse(corsHeaders);
    callerUserId = u.user.id;
  }

  if (action === "test" && testIntegrationId) {
    const { data: integ } = await admin
      .rpc("get_app_integration_for_dispatch", { _integration_id: testIntegrationId })
      .maybeSingle<Integration & { user_id: string }>();
    if (!integ || (callerUserId && integ.user_id !== callerUserId)) {
      return new Response(JSON.stringify({ ok: false, error: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const fakeDelivery: Delivery = {
      id: "test", integration_id: integ.id, user_id: integ.user_id, transaction_id: null,
      app_name: integ.app_name, event: "Purchase", attempt: 0, is_test: true,
      payload: {
        event: "Purchase",
        transaction: { id: "test_tx_" + Date.now(), product_id: "test_product", amount: 99.9, net_amount: 95, payment_method: "pix", created_at: new Date().toISOString() },
        customer: { name: "Cliente Teste", email: "teste@hotzfy.com", phone: "11999999999", document: "00000000000" },
        product_name: "Produto de Teste",
        utm: { utm_source: "venxpay_test", utm_campaign: "integration_test", utm_medium: "test" },
      },
    };
    const handlers: Record<string, (i: Integration, d: Delivery) => Promise<{ status: number; body: string; error: string | null }>> = {
      zapi: deliverZapi,
      utmify: deliverUtmify,
      activecampaign: deliverActiveCampaign,
      notazz: deliverNotazz,
      themembers: deliverTheMembers,
      spedy: deliverSpedy,
      astron: deliverAstron,
      memberkit: deliverMemberKit,
      smsfunnel: deliverSmsFunnel,
      voxuy: deliverVoxuy,
      cademi: deliverCademi,
    };
    const handler = handlers[integ.app_name];
    const result = handler
      ? await handler(integ, fakeDelivery)
      : { status: 0, body: "", error: `Unsupported: ${integ.app_name}` };

    const ok = result.status >= 200 && result.status < 300;
    return new Response(JSON.stringify({ ok, ...result }),
      { status: ok ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!internal) return unauthorizedResponse(corsHeaders);

  // Atomically claim a batch via RPC (FOR UPDATE SKIP LOCKED) so parallel cron
  // runs never pick the same delivery twice.
  const { data: pending, error } = await admin.rpc("claim_app_deliveries", { _limit: BATCH_SIZE });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const list = (pending ?? []) as Delivery[];
  await Promise.allSettled(list.map((d) => deliverOne(admin, d)));

  return new Response(JSON.stringify({ ok: true, processed: list.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
