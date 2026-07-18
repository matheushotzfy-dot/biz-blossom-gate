// Diagnostic smoke test — remove after validation.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const out: any = {};
  const key = Deno.env.get("PODPAY_APP_API_KEY");
  out.hasKey = !!key;
  out.keyPrefix = key ? key.slice(0, 8) : null;
  if (!key) {
    return new Response(JSON.stringify(out, null, 2), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Auth smoke: /v1/balance/available
  try {
    const bal = await fetch("https://api.podpay.app/v1/balance/available", {
      headers: { "x-api-key": key, "Accept": "application/json" },
    });
    out.balance = { status: bal.status, body: (await bal.text()).slice(0, 500) };
  } catch (e) {
    out.balance = { error: e instanceof Error ? e.message : "unknown" };
  }

  // 2. Criar PIX de R$1
  const extId = crypto.randomUUID();
  const body = {
    amount: 100,
    paymentMethod: "pix",
    externalId: extId,
    description: "Smoke test Hotzfy",
    customer: {
      name: "Cliente Teste",
      email: `user${Math.floor(Math.random()*1e8)}@gmail.com`,
      document: { number: "11144477735", type: "cpf" },
    },
    pix: { expiresInMinutes: 30 },
  };
  try {
    const r = await fetch("https://api.podpay.app/v1/transactions", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "X-Idempotency-Key": extId,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });
    out.createPix = { status: r.status, body: (await r.text()).slice(0, 1500) };
  } catch (e) {
    out.createPix = { error: e instanceof Error ? e.message : "unknown" };
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
