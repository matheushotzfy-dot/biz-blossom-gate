// Receives MED PIX notices from the acquirer. Fails closed: without ACQUIRER_WEBHOOK_SECRET
// configured, or with an invalid HMAC-SHA256 signature / stale timestamp, nothing is recorded.
// Idempotent by the acquirer's MED id (external_ref).
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

// No CORS needed: this endpoint is only called server-to-server by the
// acquirer, authenticated via HMAC signature. No browser origin is ever
// allowed to call it, so we never emit Access-Control-Allow-Origin.
const jsonHeaders: Record<string, string> = { "Content-Type": "application/json" };

const Body = z.object({
  event: z.literal("med.opened"),
  med_id: z.string().min(3).max(200),
  transaction_id: z.string().uuid().optional(),
  external_transaction_id: z.string().min(1).max(200).optional(),
  reason: z.string().max(1000).optional(),
  deadline_days: z.number().int().min(1).max(30).optional(),
}).refine((b) => b.transaction_id || b.external_transaction_id, { message: "transaction reference required" });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: jsonHeaders });

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const secret = Deno.env.get("ACQUIRER_WEBHOOK_SECRET");
    if (!secret) return json({ error: "acquirer not configured" }, 503);

    const raw = await req.text();
    const ts = req.headers.get("x-timestamp") ?? "";
    const sig = (req.headers.get("x-signature") ?? "").toLowerCase();
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return json({ error: "stale request" }, 401);
    if (!sig || !safeEqual(await hmacHex(secret, `${ts}.${raw}`), sig)) return json({ error: "invalid signature" }, 401);

    const parsed = Body.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let txId = b.transaction_id;
    if (!txId) {
      const { data } = await admin.from("transactions").select("id").eq("external_id", b.external_transaction_id!).maybeSingle();
      if (!data) return json({ error: "transaction not found" }, 404);
      txId = data.id;
    }
    // Owner's manual mode: unless auto-intake is explicitly enabled, only alert the admin.
    const { data: setting } = await admin.from("platform_settings").select("value").eq("key", "manual_approval").maybeSingle();
    const autoIntake = (setting?.value as { acquirer_auto_intake?: boolean } | null)?.acquirer_auto_intake === true;
    if (!autoIntake) {
      await admin.from("admin_alerts").insert({
        kind: "med_notice", severity: "critical",
        message: "MED PIX recebido da adquirente — aguardando abertura manual",
        metadata: { transaction_id: txId, med_id: b.med_id, reason: b.reason ?? null, deadline_days: b.deadline_days ?? 7 },
      });
      return json({ ok: true, queued_for_manual_review: true }, 202);
    }
    const { data: disputeId, error } = await admin.rpc("system_open_med", {
      _transaction_id: txId, _external_ref: `med:${b.med_id}`, _reason: b.reason ?? "MED PIX notificado pela adquirente", _deadline_days: b.deadline_days ?? 7,
    });
    if (error) return json({ error: error.message }, 422);
    return json({ ok: true, dispute_id: disputeId });
  } catch (e) {
    console.error("acquirer-med-webhook", e);
    return json({ error: "internal error" }, 500);
  }
});
