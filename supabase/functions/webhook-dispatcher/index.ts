// Webhook delivery worker.
// - Picks pending deliveries whose next_retry_at is due
// - POSTs to webhook_configs.url with HMAC-SHA256 signature
// - On failure, schedules retry with exponential backoff
// - Can be invoked by cron OR manually (admin retry)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const RETRY_DELAYS_SECONDS = [10, 30, 120, 600, 3600]; // 5 attempts
const MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length;
const DELIVERY_TIMEOUT_MS = 10_000;
const BATCH_SIZE = 20;

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface Delivery {
  id: string;
  webhook_config_id: string;
  user_id: string;
  transaction_id: string | null;
  event: string;
  payload: Record<string, unknown>;
  attempt: number;
}

interface WebhookConfig {
  id: string;
  url: string;
  secret: string | null;
  is_active: boolean;
}

async function deliverOne(
  admin: ReturnType<typeof createClient>,
  d: Delivery,
): Promise<void> {
  const { data: wc } = await admin
    .from("webhook_configs")
    .select("id, url, secret, is_active")
    .eq("id", d.webhook_config_id)
    .maybeSingle<WebhookConfig>();

  if (!wc || !wc.is_active) {
    await admin.from("webhook_deliveries").update({
      status: "exhausted",
      error: "Webhook config disabled or removed.",
    }).eq("id", d.id);
    return;
  }

  const body = JSON.stringify(d.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${body}`;
  const signature = wc.secret
    ? await hmacSha256Hex(wc.secret, signedPayload)
    : "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  let respStatus = 0;
  let respBody = "";
  let errMsg: string | null = null;

  try {
    const resp = await fetch(wc.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Hotzfy-Webhooks/1.0",
        "X-Hotzfy-Event": d.event,
        "X-Hotzfy-Delivery": d.id,
        "X-Hotzfy-Timestamp": timestamp,
        "X-Hotzfy-Signature": signature ? `t=${timestamp},v1=${signature}` : "",
      },
      body,
      signal: controller.signal,
    });
    respStatus = resp.status;
    respBody = (await resp.text().catch(() => "")).slice(0, 2000);
  } catch (e) {
    errMsg = e instanceof Error ? e.message : "unknown_error";
  } finally {
    clearTimeout(timer);
  }

  const success = respStatus >= 200 && respStatus < 300;
  const nextAttempt = d.attempt + 1;

  if (success) {
    await admin.from("webhook_deliveries").update({
      status: "success",
      attempt: nextAttempt,
      response_status: respStatus,
      response_body: respBody,
      delivered_at: new Date().toISOString(),
      next_retry_at: null,
      error: null,
    }).eq("id", d.id);
  } else if (nextAttempt >= MAX_ATTEMPTS) {
    await admin.from("webhook_deliveries").update({
      status: "exhausted",
      attempt: nextAttempt,
      response_status: respStatus || null,
      response_body: respBody,
      error: errMsg,
      next_retry_at: null,
    }).eq("id", d.id);
  } else {
    const delay = RETRY_DELAYS_SECONDS[nextAttempt];
    await admin.from("webhook_deliveries").update({
      status: "pending",
      attempt: nextAttempt,
      response_status: respStatus || null,
      response_body: respBody,
      error: errMsg,
      next_retry_at: new Date(Date.now() + delay * 1000).toISOString(),
    }).eq("id", d.id);
  }
}

async function processQueue(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("webhook_deliveries")
    .select("id, webhook_config_id, user_id, transaction_id, event, payload, attempt")
    .eq("status", "pending")
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error || !data || data.length === 0) {
    return { processed: 0 };
  }

  // Process in parallel but capped
  await Promise.all((data as Delivery[]).map((d) => deliverOne(admin, d).catch(() => {})));
  return { processed: data.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Require service-role bearer auth — this endpoint is internal-only (cron + postback).
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);



  try {
    // Optional manual retry: POST { delivery_id }
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body === "object" && "delivery_id" in body) {
        const { data } = await admin
          .from("webhook_deliveries")
          .select("id, webhook_config_id, user_id, transaction_id, event, payload, attempt")
          .eq("id", body.delivery_id)
          .maybeSingle<Delivery>();
        if (!data) {
          return new Response(JSON.stringify({ error: "delivery_not_found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await deliverOne(admin, data);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const result = await processQueue(admin);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.log("[webhook-dispatcher] error", err instanceof Error ? err.message : "unknown");
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
