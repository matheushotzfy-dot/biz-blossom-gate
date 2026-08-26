/**
 * PodPay v1 (nova) — webhook receiver.
 * Endpoint público: /functions/v1/podpay-app-webhook
 *
 * Guardas: assinatura HMAC obrigatória, amount match obrigatório em pagamento,
 * transições de estado explícitas e update atômico.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { amountMatches, isAllowedTransactionTransition, verifyHmacSha256 } from "../_shared/payment-webhook.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-podpay-signature",
};

const STATUS_MAP: Record<string, string> = {
  pending: "pending",
  processing: "pending",
  waiting_payment: "pending",
  paid: "completed",
  approved: "completed",
  completed: "completed",
  success: "completed",
  failed: "failed",
  cancelled: "failed",
  canceled: "failed",
  blocked: "failed",
  expired: "expired",
  refunded: "refunded",
  partially_refunded: "refunded",
  chargeback: "chargeback",
  pre_chargeback: "chargeback",
};

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function safeLog(msg: string, ctx: Record<string, unknown> = {}) {
  const ALLOWED = ["transactionId", "podpayId", "externalId", "status", "type", "error", "ignored"];
  const safe: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in ctx) safe[k] = ctx[k];
  console.log(`[podpay-app-webhook] ${msg}`, JSON.stringify(safe));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const rawBody = await req.text();

    // Fail closed: unsigned callbacks can never mutate financial state.
    const secret = Deno.env.get("PODPAY_APP_WEBHOOK_SECRET");
    const sig = req.headers.get("x-signature") ?? req.headers.get("x-podpay-signature");
    if (!secret) {
      return new Response(JSON.stringify({ success: false, error: "webhook_not_configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!sig || !(await verifyHmacSha256(rawBody, sig, secret))) {
      safeLog("invalid signature");
      return new Response(JSON.stringify({ success: false, error: "invalid_signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (() => { try { return JSON.parse(rawBody); } catch { return null; } }) as any;
    if (!payload || typeof payload !== "object") {
      return new Response(JSON.stringify({ success: false, error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nested = (payload as any).data ?? (payload as any).transaction ?? (payload as any).payment ?? {};
    const type = String((payload as any).type ?? (payload as any).event ?? nested?.type ?? "").toLowerCase();

    const podpayId = firstString(
      (payload as any).id, (payload as any).transactionId, (payload as any).transaction_id,
      nested?.id, nested?.transactionId, nested?.transaction_id,
    );
    const externalId = firstString(
      (payload as any).externalId, (payload as any).external_id,
      nested?.externalId, nested?.external_id, nested?.externalRef, nested?.external_ref,
    );
    const rawStatus = String(
      nested?.status ?? (payload as any).status ?? ""
    ).toLowerCase();
    const mapped = STATUS_MAP[rawStatus] ?? "pending";

    safeLog("received", { type, podpayId, externalId, status: rawStatus });

    // Withdrawals ainda não plugados — ack pra não ficar retry.
    if (type.includes("withdrawal")) {
      return new Response(JSON.stringify({ success: true, ignored: "withdrawal" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lookup: external_id (tx.id) tem prioridade; fallback via podpay_payment_id.
    let tx: any = null;
    if (externalId && /^[0-9a-f-]{36}$/i.test(externalId)) {
      const { data } = await supabase.from("transactions")
        .select("id, status, amount, payment_method, pix_expires_at, podpay_payment_id, metadata")
        .eq("id", externalId).maybeSingle();
      tx = data;
    }
    if (!tx && podpayId) {
      const { data } = await supabase.from("transactions")
        .select("id, status, amount, payment_method, pix_expires_at, podpay_payment_id, metadata")
        .eq("podpay_payment_id", podpayId).maybeSingle();
      tx = data;
    }

    if (!tx) {
      safeLog("no match", { externalId, podpayId });
      return new Response(JSON.stringify({ success: false, error: "transaction_not_found" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tx.podpay_payment_id && podpayId !== String(tx.podpay_payment_id)) {
      safeLog("gateway id mismatch", { transactionId: tx.id, podpayId });
      return new Response(JSON.stringify({ success: false, error: "gateway_id_mismatch" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAllowedTransactionTransition(String(tx.status), mapped)) {
      safeLog("invalid transition", { transactionId: tx.id, status: `${tx.status}->${mapped}` });
      return new Response(JSON.stringify({ success: true, ignored: "invalid_transition" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mapped === "completed") {
      const amountRaw = (payload as any).amount ?? nested?.amount ?? nested?.value;
      if (!amountMatches(amountRaw, Number(tx.amount))) {
        safeLog("amount missing or mismatched", { transactionId: tx.id });
        return new Response(JSON.stringify({ success: false, error: "amount_mismatch" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const patch: Record<string, unknown> = {
      status: mapped,
      metadata: {
        ...((tx.metadata as Record<string, unknown> | null) || {}),
        acquirer: "podpay_app",
        last_podpay_app_status: rawStatus,
        last_podpay_app_event_at: new Date().toISOString(),
      },
    };
    if (podpayId && !tx.podpay_payment_id) patch.podpay_payment_id = podpayId;

    const { data: updatedTx, error: updErr } = await supabase
      .from("transactions").update(patch)
      .eq("id", tx.id)
      .eq("status", tx.status)
      .select("id")
      .maybeSingle();

    try {
      await supabase.rpc("log_transaction_event", {
        _transaction_id: tx.id,
        _event_type: "postback_received",
        _description: `Postback PodPay: ${rawStatus} → ${mapped}`,
        _actor: "podpay_app",
        _acquirer_slug: "podpay_app",
        _visibility: "admin",
        _metadata: { gateway_status: rawStatus, mapped_status: mapped, event_id: podpayId, external_id: externalId },
      });
    } catch (_) { /* non-blocking */ }

    if (updErr) {
      safeLog("update error", { transactionId: tx.id, error: updErr.message });
      return new Response(JSON.stringify({ success: false, error: "update_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!updatedTx) {
      return new Response(JSON.stringify({ success: true, ignored: "state_changed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    safeLog("updated", { transactionId: tx.id, status: mapped });

    // Nudge dispatchers só quando muda pra status relevante
    if (mapped !== "pending") {
      try {
        const url = Deno.env.get("SUPABASE_URL")!;
        const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const h = { "Content-Type": "application/json", Authorization: `Bearer ${svc}` };
        await Promise.allSettled([
          fetch(`${url}/functions/v1/webhook-dispatcher`, { method: "POST", headers: h, body: "{}" }),
          fetch(`${url}/functions/v1/apps-dispatcher`, { method: "POST", headers: h, body: "{}" }),
        ]);
      } catch (_) { /* non-blocking */ }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    safeLog("internal error", { error: error instanceof Error ? error.message : "unknown" });
    return new Response(JSON.stringify({ success: false, error: "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
