import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

      // Resolve fees dynamically: custom_user_fees override → fees table → safe default
      let pctFee = 0.0199;
      let fixedFee = 2.5;
      const { data: defaultPct } = await supabase
        .from("fees")
        .select("value")
        .eq("name", "Taxa de Transação")
        .eq("fee_type", "percentage")
        .maybeSingle();
      if (defaultPct?.value != null) pctFee = Number(defaultPct.value) / 100;
      const { data: defaultFixed } = await supabase
        .from("fees")
        .select("value")
        .eq("name", "Taxa de Transação")
        .eq("fee_type", "fixed")
        .maybeSingle();
      if (defaultFixed?.value != null) fixedFee = Number(defaultFixed.value);

      const { data: customFee } = await supabase
        .from("custom_user_fees")
        .select("transaction_percentage, transaction_fixed")
        .eq("user_id", sub.seller_user_id)
        .maybeSingle();
      if (customFee) {
        if (customFee.transaction_percentage != null) pctFee = Number(customFee.transaction_percentage) / 100;
        if (customFee.transaction_fixed != null) fixedFee = Number(customFee.transaction_fixed);
      }
      const feeAmount = Math.round((plan.price * pctFee + fixedFee) * 100) / 100;
      const netAmount = Math.max(0, Math.round((plan.price - feeAmount) * 100) / 100);

      // Create a renewal transaction
      const { error: txError } = await supabase.from("transactions").insert({
        user_id: sub.seller_user_id,
        amount: plan.price,
        fee_amount: feeAmount,
        net_amount: netAmount,
        status: "completed",
        payment_method: "subscription",
        customer_email: sub.subscriber_email,
        customer_name: sub.subscriber_name,
        is_simulated: false,
      });

      if (txError) {
        console.error(`[subscription-renewal] TX error for sub ${sub.id}:`, txError.message);
        // Mark as past_due
        await supabase.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
        failed++;
        continue;
      }

      // Extend subscription period
      const { error: updateError } = await supabase.from("subscriptions").update({
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        status: "active",
      }).eq("id", sub.id);

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
