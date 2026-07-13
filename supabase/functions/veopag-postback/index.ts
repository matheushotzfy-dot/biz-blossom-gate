/**
 * VeoPag webhook receiver.
 *
 * Per user requirement, signature validation is intentionally skipped —
 * the upstream gateway forwards VeoPag events to this endpoint and we
 * trust the source. We still enforce:
 *   - amount match on completion
 *   - PIX expiration guard
 *   - no downgrade from a final status
 *   - lookup by our internal tx.id (external_id) first, then by veopag transactionId.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

/** VeoPag status → internal status. */
const STATUS_MAP: Record<string, string> = {
  PENDING: "pending",
  PROCESSING: "pending",
  COMPLETED: "completed",
  COMPLETE: "completed",
  PAID: "completed",
  APPROVED: "completed",
  SUCCESS: "completed",
  FAILED: "failed",
  FAIL: "failed",
  CANCELED: "failed",
  CANCELLED: "failed",
  EXPIRED: "expired",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "refunded",
};

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizeAmount(raw: unknown, txAmount: number): number | null {
  const parsed = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
  if (!Number.isFinite(parsed)) return null;
  // VeoPag/webhook bridges may send cents; local transactions store BRL.
  if (parsed > txAmount * 10 && Math.abs(parsed / 100 - txAmount) <= 0.01) return parsed / 100;
  return parsed;
}

function safeLog(message: string, context: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  const ALLOWED = [
    "transactionId",
    "veopagId",
    "externalId",
    "status",
    "type",
    "error",
    "ignored",
  ];
  for (const k of ALLOWED) if (k in context) safe[k] = context[k];
  console.log(`[veopag-postback] ${message}`, JSON.stringify(safe));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = (await req.json().catch(() => null)) as any;
    if (!payload || typeof payload !== "object") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nested = payload.transaction ?? payload.data ?? payload.payment ?? payload.qrCodeResponse ?? {};
    const type = String(payload.type ?? payload.event ?? nested.type ?? "").toLowerCase();
    const veoTxId = firstString(
      payload.transaction_id,
      payload.transactionId,
      payload.transactionID,
      payload.id,
      nested.transaction_id,
      nested.transactionId,
      nested.transactionID,
      nested.id,
    );
    const externalId = firstString(
      payload.external_id,
      payload.externalId,
      payload.external_ref,
      payload.externalRef,
      nested.external_id,
      nested.externalId,
      nested.external_ref,
      nested.externalRef,
    );
    const rawStatus = String(payload.status ?? nested.status ?? "").toUpperCase();
    const mapped = STATUS_MAP[rawStatus] ?? "pending";

    safeLog("received", { type, veopagId: veoTxId, externalId, status: rawStatus });

    // Withdrawals aren't wired yet — ack so VeoPag stops retrying.
    if (type === "withdrawal") {
      return new Response(
        JSON.stringify({ success: true, ignored: "withdrawal" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up the transaction: external_id (== our internal tx.id) is authoritative.
    let tx: any = null;
    if (externalId && /^[0-9a-f-]{36}$/i.test(externalId)) {
      const { data } = await supabase
        .from("transactions")
        .select("id, status, amount, payment_method, created_at, pix_expires_at, podpay_payment_id, metadata")
        .eq("id", externalId)
        .maybeSingle();
      tx = data;
    }
    if (!tx && veoTxId) {
      const { data } = await supabase
        .from("transactions")
        .select("id, status, amount, payment_method, created_at, pix_expires_at, podpay_payment_id, metadata")
        .eq("podpay_payment_id", veoTxId)
        .maybeSingle();
      tx = data;
    }

    if (!tx) {
      safeLog("no match — ignoring", { externalId, veopagId: veoTxId });
      // 200 so VeoPag doesn't retry forever on an unknown event.
      return new Response(
        JSON.stringify({ success: true, ignored: "no_match" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Don't downgrade a final status.
    const finalStatuses = ["completed", "refunded", "chargeback", "expired"];
    if (finalStatuses.includes(tx.status) && !finalStatuses.includes(mapped)) {
      safeLog("skipping downgrade", { transactionId: tx.id, status: `${tx.status}->${mapped}` });
      return new Response(
        JSON.stringify({ success: true, ignored: "no_downgrade" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Amount + expiration guard only when marking as paid.
    if (mapped === "completed") {
      const amountRaw = payload.amount ?? payload.value ?? nested.amount ?? nested.value;
      if (amountRaw != null) {
        const payloadAmt = normalizeAmount(amountRaw, Number(tx.amount));
        if (payloadAmt !== null && Math.abs(payloadAmt - Number(tx.amount)) > 0.01) {
          safeLog("amount mismatch — rejecting", {
            transactionId: tx.id,
            error: `payload=${payloadAmt} tx=${tx.amount}`,
          });
          return new Response(
            JSON.stringify({ success: false, error: "Amount mismatch" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      if (tx.status === "pending" && tx.pix_expires_at) {
        const exp = new Date(tx.pix_expires_at as string).getTime();
        if (Number.isFinite(exp) && Date.now() > exp) {
          safeLog("expired — rejecting late payment", { transactionId: tx.id });
          return new Response(
            JSON.stringify({ success: false, error: "Transaction expired" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    const patch: Record<string, unknown> = {
      status: mapped,
      metadata: {
        ...((tx.metadata as Record<string, unknown> | null) || {}),
        acquirer: "veopag",
        last_veopag_status: rawStatus,
        last_veopag_event_at: new Date().toISOString(),
      },
    };
    if (veoTxId && !tx.podpay_payment_id) patch.podpay_payment_id = veoTxId;

    const { error: updErr } = await supabase
      .from("transactions")
      .update(patch)
      .eq("id", tx.id);

    if (updErr) {
      safeLog("update error", { transactionId: tx.id, error: updErr.message });
      return new Response(
        JSON.stringify({ success: false, error: "update_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    safeLog("updated", { transactionId: tx.id, status: mapped });

    // Trigger central dispatchers so custom webhooks + apps get notified.
    try {
      const url = Deno.env.get("SUPABASE_URL")!;
      const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const h = { "Content-Type": "application/json", Authorization: `Bearer ${svc}` };
      const [webhookNudge, appsNudge] = await Promise.allSettled([
        fetch(`${url}/functions/v1/webhook-dispatcher`, { method: "POST", headers: h, body: "{}" }),
        fetch(`${url}/functions/v1/apps-dispatcher`, { method: "POST", headers: h, body: "{}" }),
      ]);
      if (webhookNudge.status === "rejected") {
        safeLog("webhook dispatcher nudge failed", { error: webhookNudge.reason instanceof Error ? webhookNudge.reason.message : "unknown" });
      }
      if (appsNudge.status === "rejected") {
        safeLog("apps dispatcher nudge failed", { error: appsNudge.reason instanceof Error ? appsNudge.reason.message : "unknown" });
      }
    } catch (error) {
      safeLog("dispatcher nudge failed", { error: error instanceof Error ? error.message : "unknown" });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    safeLog("internal error", { error: error instanceof Error ? error.message : "unknown" });
    return new Response(
      JSON.stringify({ success: false, error: "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
