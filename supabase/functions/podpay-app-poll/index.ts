/**
 * PodPay v1 (nova) — polling fallback.
 * Roda a cada 2 minutos via pg_cron. Consulta status na PodPay pras vendas
 * PIX pendentes das últimas 24h roteadas por `podpay_app` que não receberam
 * webhook. Aplica as mesmas guardas do receiver (amount match, no downgrade).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchPodpayAppTransaction } from "../_shared/podpay-app.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

const STATUS_MAP: Record<string, string> = {
  pending: "pending", processing: "pending", waiting_payment: "pending",
  paid: "completed", approved: "completed", completed: "completed", success: "completed",
  failed: "failed", cancelled: "failed", canceled: "failed", blocked: "failed",
  expired: "expired", refunded: "refunded", partially_refunded: "refunded",
  chargeback: "chargeback", pre_chargeback: "chargeback",
};

const FINAL = new Set(["completed", "refunded", "chargeback", "expired"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: pending, error } = await supabase
      .from("transactions")
      .select("id, amount, status, podpay_payment_id, metadata, created_at")
      .eq("payment_method", "pix")
      .in("status", ["pending", "waiting_payment"])
      .not("podpay_payment_id", "is", null)
      .gte("created_at", since)
      .limit(200);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ success: true, checked: 0, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filtra apenas transações roteadas via podpay_app.
    const targets = pending.filter((t: any) => {
      const acq = String(t?.metadata?.acquirer ?? "").toLowerCase();
      return acq === "podpay_app";
    });

    if (targets.length === 0) {
      return new Response(JSON.stringify({ success: true, checked: 0, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let checked = 0;
    let updated = 0;

    for (const tx of targets) {
      if (Date.now() - started > 25_000) break;
      checked++;

      const result = await fetchPodpayAppTransaction(String(tx.podpay_payment_id), supabase);
      if (!result) continue;

      const mapped = STATUS_MAP[String(result.status).toLowerCase()] ?? "pending";
      if (mapped === "pending") continue;
      if (FINAL.has(tx.status)) continue;

      if (mapped === "completed" && result.amount != null) {
        let amt = result.amount;
        if (amt > Number(tx.amount) * 10 && Math.abs(amt / 100 - Number(tx.amount)) <= 0.01) amt = amt / 100;
        if (Math.abs(amt - Number(tx.amount)) > 0.01) continue;
      }

      const { error: updErr } = await supabase
        .from("transactions")
        .update({
          status: mapped,
          metadata: {
            ...((tx.metadata as any) ?? {}),
            acquirer: "podpay_app",
            last_podpay_app_status: result.status,
            last_podpay_app_event_at: new Date().toISOString(),
            reconciled_via: "poll",
          },
        })
        .eq("id", tx.id)
        .in("status", ["pending", "waiting_payment"]);

      if (updErr) continue;
      updated++;

      try {
        await supabase.rpc("log_transaction_event", {
          _transaction_id: tx.id,
          _event_type: "postback_received",
          _description: `Reconciliação PodPay (poll): ${result.status} → ${mapped}`,
          _actor: "system",
          _acquirer_slug: "podpay_app",
          _visibility: "admin",
          _metadata: { gateway_status: result.status, mapped_status: mapped, source: "poll" },
        });
      } catch (_) { /* non-blocking */ }
    }

    if (updated > 0) {
      const url = Deno.env.get("SUPABASE_URL")!;
      const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const h = { "Content-Type": "application/json", Authorization: `Bearer ${svc}` };
      await Promise.allSettled([
        fetch(`${url}/functions/v1/webhook-dispatcher`, { method: "POST", headers: h, body: "{}" }),
        fetch(`${url}/functions/v1/apps-dispatcher`, { method: "POST", headers: h, body: "{}" }),
      ]);
    }

    console.log(`[podpay-app-poll] checked=${checked} updated=${updated} elapsed=${Date.now() - started}ms`);
    return new Response(JSON.stringify({ success: true, checked, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[podpay-app-poll] error", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ success: false, error: "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
