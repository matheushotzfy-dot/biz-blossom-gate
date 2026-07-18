import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = Deno.env.get("PODPAY_APP_API_KEY")!;
  const results: any[] = [];

  const attempts: Array<{ name: string; body: any }> = [
    { name: "A_flat_items", body: {
      amount: 100, paymentMethod: "pix", externalId: crypto.randomUUID(),
      customer: { name: "Teste", email: "u@a.com", document: { number: "11144477735", type: "cpf" } },
      items: [{ title: "X", quantity: 1, unitPrice: 100, tangible: false }],
      pix: { expiresInMinutes: 30 },
    }},
    { name: "B_items_unitAmount", body: {
      amount: 100, paymentMethod: "pix", externalId: crypto.randomUUID(),
      customer: { name: "Teste", email: "u@a.com", document: { number: "11144477735", type: "cpf" } },
      items: [{ title: "X", quantity: 1, unitAmount: 100 }],
      pix: { expiresInMinutes: 30 },
    }},
    { name: "C_items_name", body: {
      amount: 100, paymentMethod: "pix", externalId: crypto.randomUUID(),
      customer: { name: "Teste", email: "u@a.com", document: { number: "11144477735", type: "cpf" } },
      items: [{ name: "X", quantity: 1, price: 100 }],
      pix: { expiresInMinutes: 30 },
    }},
    { name: "D_items_amount", body: {
      amount: 100, paymentMethod: "pix", externalId: crypto.randomUUID(),
      customer: { name: "Teste", email: "u@a.com", document: { number: "11144477735", type: "cpf" } },
      items: [{ title: "X", quantity: 1, amount: 100, tangible: false }],
      pix: { expiresInMinutes: 30 },
    }},
    { name: "E_items_only_top", body: {
      externalId: crypto.randomUUID(),
      paymentMethod: "pix",
      customer: { name: "Teste", email: "u@a.com", document: { number: "11144477735", type: "cpf" } },
      items: [{ title: "X", quantity: 1, unitPrice: 100, tangible: false }],
      pix: { expiresInMinutes: 30 },
    }},
    { name: "F_customer_documentString", body: {
      amount: 100, paymentMethod: "pix", externalId: crypto.randomUUID(),
      customer: { name: "Teste", email: "u@a.com", document: "11144477735", documentType: "cpf" },
      items: [{ title: "X", quantity: 1, unitPrice: 100, tangible: false }],
      pix: { expiresInMinutes: 30 },
    }},
  ];

  for (const a of attempts) {
    try {
      const r = await fetch("https://api.podpay.app/v1/transactions", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "X-Idempotency-Key": a.body.externalId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(a.body),
      });
      const txt = (await r.text()).slice(0, 600);
      results.push({ name: a.name, status: r.status, body: txt });
      if (r.ok) break;
    } catch (e) {
      results.push({ name: a.name, error: e instanceof Error ? e.message : "?" });
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
