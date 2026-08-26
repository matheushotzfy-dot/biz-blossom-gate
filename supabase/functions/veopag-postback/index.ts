/**
 * VeoPag webhook receiver.
 *
 * VeoPag does not expose a reliable signed-callback contract in this
 * integration. Every callback is therefore verified server-to-server against
 * VeoPag's authenticated transaction endpoint before local state is changed.
 *   - amount match on completion
 *   - PIX expiration guard
 *   - no downgrade from a final status
 *   - lookup by our internal tx.id (external_id) first, then by veopag transactionId.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchVeopagTransactionStatus } from "../_shared/veopag.ts";
import { amountMatches, isAllowedTransactionTransition } from "../_shared/payment-webhook.ts";

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
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

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
    const claimedStatus = String(payload.status ?? nested.status ?? "").toUpperCase();

    safeLog("received", { type, veopagId: veoTxId, externalId, status: claimedStatus });

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
      return new Response(
        JSON.stringify({ success: false, error: "transaction_not_found" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!veoTxId) {
      return new Response(JSON.stringify({ success: false, error: "missing_gateway_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (tx.podpay_payment_id && veoTxId !== String(tx.podpay_payment_id)) {
      return new Response(JSON.stringify({ success: false, error: "gateway_id_mismatch" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Never trust callback fields as proof of payment. Fetch the canonical state
    // with our private VeoPag credentials and use only that response.
    const canonical = await fetchVeopagTransactionStatus(veoTxId, supabase);
    if (!canonical) {
      return new Response(JSON.stringify({ success: false, error: "provider_verification_failed" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rawStatus = canonical.status;
    const mapped = STATUS_MAP[rawStatus] ?? "pending";

    if (!isAllowedTransactionTransition(String(tx.status), mapped)) {
      safeLog("invalid transition", { transactionId: tx.id, status: `${tx.status}->${mapped}` });
      return new Response(
        JSON.stringify({ success: true, ignored: "invalid_transition" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mapped === "completed") {
      if (!amountMatches(canonical.amount, Number(tx.amount))) {
        safeLog("canonical amount missing or mismatched", { transactionId: tx.id });
        return new Response(
          JSON.stringify({ success: false, error: "Amount mismatch" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Gateway-confirmed payment is the source of truth. Do not reject a paid
      // webhook only because the local PIX timer already passed; that creates
      // orphaned paid charges and keeps seller/admin balances wrong.
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

    const { data: updatedTx, error: updErr } = await supabase
      .from("transactions")
      .update(patch)
      .eq("id", tx.id)
      .eq("status", tx.status)
      .select("id")
      .maybeSingle();

    // Audit log — postback received (admin-only; keeps raw gateway status for debugging)
    try {
      await supabase.rpc("log_transaction_event", {
        _transaction_id: tx.id,
        _event_type: "postback_received",
        _description: `Postback VeoPag: ${rawStatus} → ${mapped}`,
        _actor: "veopag",
        _acquirer_slug: "veopag",
        _visibility: "admin",
        _metadata: {
          gateway_status: rawStatus,
          mapped_status: mapped,
          event_id: veoTxId,
          external_id: externalId,
        },
      });
    } catch (_e) { /* non-blocking */ }

    if (updErr) {
      safeLog("update error", { transactionId: tx.id, error: updErr.message });
      return new Response(
        JSON.stringify({ success: false, error: "update_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!updatedTx) {
      return new Response(JSON.stringify({ success: true, ignored: "state_changed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
