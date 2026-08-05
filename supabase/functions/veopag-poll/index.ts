/**
 * VeoPag polling fallback.
 *
 * VeoPag envia respostas automáticas para o callback configurado, mas quando
 * o postback não chega (rede, retries falhos, callback não configurado no
 * portal) as transações ficam "pending" para sempre. Este job varre as
 * transações PIX pendentes das últimas 24h roteadas via VeoPag, consulta
 * o status atual na API e atualiza a transação — usando exatamente o
 * mesmo mapeamento e as mesmas guardas do webhook (`veopag-postback`).
 *
 * Roda a cada 2 minutos via pg_cron (ver migration).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getVeopagToken } from "../_shared/veopag.ts";
import { isInternalCall, unauthorizedResponse } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

const VEOPAG_BASE = "https://api.veopag.com";

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

const FINAL = new Set(["completed", "refunded", "chargeback", "expired"]);

async function fetchVeopagStatus(token: string, txId: string): Promise<{ status: string; amount?: number } | null> {
  // Tenta os endpoints conhecidos da VeoPag (ordem por popularidade).
  const paths = [
    `/api/payments/deposit/${txId}`,
    `/api/transactions/${txId}`,
    `/api/payments/${txId}`,
  ];
  for (const path of paths) {
    try {
      const resp = await fetch(`${VEOPAG_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (resp.status === 404) continue;
      if (!resp.ok) continue;
      const data = await resp.json().catch(() => ({} as any));
      const node = (data?.transaction ?? data?.data ?? data?.qrCodeResponse ?? data) as any;
      const rawStatus = String(node?.status ?? data?.status ?? "").toUpperCase();
      if (!rawStatus) continue;
      const amtRaw = node?.amount ?? data?.amount ?? node?.value ?? data?.value;
      const amount = typeof amtRaw === "number" ? amtRaw : (typeof amtRaw === "string" ? Number(amtRaw) : undefined);
      return { status: rawStatus, amount: Number.isFinite(amount as number) ? (amount as number) : undefined };
    } catch (_) {
      continue;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Job interno: só pg_cron (x-cron-secret) ou chamadas com service role.
  if (!isInternalCall(req)) return unauthorizedResponse(corsHeaders);

  const started = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Busca as transações PIX pending das últimas 24h que têm ID VeoPag.
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

    // Filtra apenas transações roteadas via VeoPag (evita bater na VeoPag com IDs da PodPay).
    const veopagTxs = pending.filter((t: any) => {
      const acq = String(t?.metadata?.acquirer ?? "").toLowerCase();
      // Se não tem acquirer no metadata assumimos VeoPag (default da plataforma).
      return acq === "" || acq === "veopag";
    });

    if (veopagTxs.length === 0) {
      return new Response(JSON.stringify({ success: true, checked: 0, updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getVeopagToken(supabase);
    let updated = 0;
    let checked = 0;

    for (const tx of veopagTxs) {
      // Timebox: no máximo 25s totais (edge function limit ~30s).
      if (Date.now() - started > 25_000) break;
      checked++;

      const result = await fetchVeopagStatus(token, String(tx.podpay_payment_id));
      if (!result) continue;

      const mapped = STATUS_MAP[result.status] ?? "pending";
      if (mapped === "pending") continue;
      if (FINAL.has(tx.status)) continue;

      // Amount guard quando marca como pago.
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
            acquirer: "veopag",
            last_veopag_status: result.status,
            last_veopag_event_at: new Date().toISOString(),
            reconciled_via: "poll",
          },
        })
        .eq("id", tx.id)
        .in("status", ["pending", "waiting_payment"]); // claim guard

      if (updErr) continue;
      updated++;

      try {
        await supabase.rpc("log_transaction_event", {
          _transaction_id: tx.id,
          _event_type: "postback_received",
          _description: `Reconciliação VeoPag (poll): ${result.status} → ${mapped}`,
          _actor: "system",
          _acquirer_slug: "veopag",
          _visibility: "admin",
          _metadata: { gateway_status: result.status, mapped_status: mapped, source: "poll" },
        });
      } catch (_) { /* non-blocking */ }
    }

    // Nudge dispatchers para disparar webhooks/apps.
    if (updated > 0) {
      const url = Deno.env.get("SUPABASE_URL")!;
      const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const h = { "Content-Type": "application/json", Authorization: `Bearer ${svc}` };
      await Promise.allSettled([
        fetch(`${url}/functions/v1/webhook-dispatcher`, { method: "POST", headers: h, body: "{}" }),
        fetch(`${url}/functions/v1/apps-dispatcher`, { method: "POST", headers: h, body: "{}" }),
      ]);
    }

    console.log(`[veopag-poll] checked=${checked} updated=${updated} elapsed=${Date.now() - started}ms`);
    return new Response(JSON.stringify({ success: true, checked, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[veopag-poll] error", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ success: false, error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
