import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

/**
 * Abandoned Cart Recovery
 * Finds transactions that have been "pending" for more than 30 minutes (PIX/boleto expired)
 * and marks them as "expired". Also collects data for recovery campaigns.
 *
 * Run via pg_cron every 15 minutes.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Require service-role bearer auth (cron-only).
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    // PIX QR codes typically expire in 30 minutes
    const pixExpiry = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    // Boletos expire in 1-3 days — we mark after 3 days
    const boletoExpiry = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Expire PIX pending transactions older than 30 min
    const { data: expiredPix, error: pixErr } = await supabase
      .from("transactions")
      .update({ status: "expired" })
      .eq("status", "pending")
      .eq("payment_method", "pix")
      .lt("created_at", pixExpiry)
      .select("id, customer_email, customer_name, product_id, amount, user_id");

    if (pixErr) {
      console.error("[abandoned-cart] PIX expiry error:", pixErr.message);
    }

    // 2. Expire boleto pending transactions older than 3 days
    const { data: expiredBoleto, error: boletoErr } = await supabase
      .from("transactions")
      .update({ status: "expired" })
      .eq("status", "pending")
      .eq("payment_method", "boleto")
      .lt("created_at", boletoExpiry)
      .select("id, customer_email, customer_name, product_id, amount, user_id");

    if (boletoErr) {
      console.error("[abandoned-cart] Boleto expiry error:", boletoErr.message);
    }

    const allExpired = [...(expiredPix || []), ...(expiredBoleto || [])];

    // 3. Notify sellers about abandoned carts (via notifications table)
    const sellerAbandonedMap = new Map<string, number>();
    for (const tx of allExpired) {
      const count = sellerAbandonedMap.get(tx.user_id) || 0;
      sellerAbandonedMap.set(tx.user_id, count + 1);
    }

    for (const [sellerId, count] of sellerAbandonedMap) {
      await supabase.from("notifications").insert({
        user_id: sellerId,
        title: `🛒 ${count} carrinho(s) abandonado(s)`,
        message: `${count} pagamento(s) expiraram nas últimas horas. Considere criar uma campanha de recuperação.`,
        type: "abandoned_cart",
      });
    }

    // 4. Log summary
    const summary = {
      processed: allExpired.length,
      pixExpired: expiredPix?.length || 0,
      boletoExpired: expiredBoleto?.length || 0,
      sellersNotified: sellerAbandonedMap.size,
    };

    console.log("[abandoned-cart] Summary:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[abandoned-cart] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
