import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Subscription Renewal Cron Job
 * Processes active subscriptions whose current_period_end has passed.
 * For each expired subscription:
 *  1. If still active → attempt renewal (create transaction, extend period)
 *  2. If trial ended → activate or cancel
 *  3. Mark as past_due if renewal fails
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Require service-role bearer auth (called by pg_cron / internal jobs only).
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();

    // 1. Find subscriptions that need renewal
    const { data: expiredSubs, error: fetchError } = await supabase
      .from("subscriptions")
      .select("*, subscription_plans(*)")
      .in("status", ["active", "trialing"])
      .lt("current_period_end", now)
      .limit(50);

    if (fetchError) {
      console.error("[subscription-renewal] Fetch error:", fetchError.message);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No subscriptions to renew" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let renewed = 0;
    let failed = 0;
    let canceled = 0;

    for (const sub of expiredSubs) {
      const plan = sub.subscription_plans;
      if (!plan) {
        // No plan found, mark as canceled
        await supabase.from("subscriptions").update({
          status: "canceled",
          canceled_at: now,
        }).eq("id", sub.id);
        canceled++;
        continue;
      }

      // If plan is no longer active, cancel subscription
      if (!plan.is_active) {
        await supabase.from("subscriptions").update({
          status: "canceled",
          canceled_at: now,
        }).eq("id", sub.id);
        canceled++;
        continue;
      }

      // If subscription was explicitly canceled, don't renew
      if (sub.canceled_at) {
        await supabase.from("subscriptions").update({ status: "canceled" }).eq("id", sub.id);
        canceled++;
        continue;
      }

      // Calculate next period
      const periodStart = new Date(sub.current_period_end);
      const periodEnd = new Date(periodStart);

      switch (plan.interval) {
        case "daily": periodEnd.setDate(periodEnd.getDate() + (plan.interval_count || 1)); break;
        case "weekly": periodEnd.setDate(periodEnd.getDate() + 7 * (plan.interval_count || 1)); break;
        case "monthly": periodEnd.setMonth(periodEnd.getMonth() + (plan.interval_count || 1)); break;
        case "yearly": periodEnd.setFullYear(periodEnd.getFullYear() + (plan.interval_count || 1)); break;
        default: periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Resolve fees — SAME source of truth as podpay-create-transaction / quick-pix.
      // Subscriptions renovam via PIX por padrão, então usamos: Taxa PIX + Taxa Fixa PIX
      // + Taxa Fixa por Transação (extra global). custom_user_fees continua sobrescrevendo.
      const { data: feeRows } = await supabase
        .from("fees")
        .select("name, value")
        .in("name", ["Taxa PIX", "Taxa Fixa PIX", "Taxa Fixa por Transação"]);
      const getFee = (n: string) =>
        Number((feeRows || []).find((f: { name: string; value: number | string }) => f.name === n)?.value ?? 0);

      let pctFee = getFee("Taxa PIX");                       // percentual (ex.: 1.99)
      let fixedFee = getFee("Taxa Fixa PIX") + getFee("Taxa Fixa por Transação"); // R$

      const { data: customFee } = await supabase
        .from("custom_user_fees")
        .select("transaction_percentage, transaction_fixed")
        .eq("user_id", sub.seller_user_id)
        .maybeSingle();
      if (customFee) {
        if (customFee.transaction_percentage != null) pctFee = Number(customFee.transaction_percentage);
        if (customFee.transaction_fixed != null) fixedFee = Number(customFee.transaction_fixed);
      }

      let feeAmount = Math.round(((plan.price * pctFee) / 100 + fixedFee) * 100) / 100;
      // Safety clamp — nunca cobrar >= valor da assinatura.
      if (feeAmount < 0 || feeAmount >= plan.price) {
        console.error(`[subscription-renewal] Fee out of range for sub ${sub.id}`, { feeAmount, price: plan.price });
        feeAmount = Math.min(Math.max(feeAmount, 0), Math.max(0, plan.price - 0.01));
      }
      const netAmount = Math.max(0, Math.round((plan.price - feeAmount) * 100) / 100);


      // Idempotency: one renewal tx per (subscription, period_end) via podpay_event_id
      const periodKey = `sub_${sub.id}_${periodEnd.toISOString()}`;
      const { data: existing } = await supabase
        .from("transactions")
        .select("id")
        .eq("podpay_event_id", periodKey)
        .maybeSingle();

      let txError: { message: string } | null = null;
      if (!existing) {
        const result = await supabase.from("transactions").insert({
          user_id: sub.seller_user_id,
          amount: plan.price,
          fee_amount: feeAmount,
          net_amount: netAmount,
          status: "completed",
          payment_method: "subscription",
          customer_email: sub.subscriber_email,
          customer_name: sub.subscriber_name,
          is_simulated: false,
          podpay_event_id: periodKey,
          metadata: { subscription_id: sub.id, plan_id: plan.id, period_end: periodEnd.toISOString() },
        });
        txError = result.error;
      }

      if (txError) {
        console.error(`[subscription-renewal] TX error for sub ${sub.id}:`, txError.message);
        // Mark as past_due
        await supabase.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
        failed++;
        continue;
      }

      // Extend subscription period — optimistic lock via eq on current_period_end,
      // evita corrida entre duas execuções sobrepostas do cron.
      const { error: updateError, data: updated } = await supabase.from("subscriptions").update({
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        status: "active",
      }).eq("id", sub.id).eq("current_period_end", sub.current_period_end).select("id");

      if (updated && updated.length === 0) {
        // Outra execução já estendeu — pula sem contar como sucesso nem erro.
        continue;
      }


      if (updateError) {
        console.error(`[subscription-renewal] Update error for sub ${sub.id}:`, updateError.message);
        failed++;
      } else {
        renewed++;
      }
    }

    console.log(`[subscription-renewal] Processed: ${renewed} renewed, ${failed} failed, ${canceled} canceled`);

    return new Response(JSON.stringify({ processed: expiredSubs.length, renewed, failed, canceled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[subscription-renewal] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
