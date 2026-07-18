import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = Deno.env.get("PODPAY_APP_API_KEY")!;
  const results: any[] = [];

  const base = {
    amount: 100,
    externalId: crypto.randomUUID(),
    customer: { name: "Teste Silva", email: "teste@exemplo.com", document: { number: "11144477735", type: "cpf" } },
    items: [{ title: "Cobrança", quantity: 1, unitPrice: 100, tangible: false }],
  };

  const attempts: Array<{ name: string; body: any }> = [
    { name: "A_PIX_upper", body: { ...base, paymentMethod: "PIX", pix: { expiresInMinutes: 30 } } },
    { name: "B_method_pix", body: { ...base, method: "pix", pix: { expiresInMinutes: 30 } } },
    { name: "C_type_pix", body: { ...base, type: "pix", pix: { expiresInMinutes: 30 } } },
    { name: "D_no_pix_block", body: { ...base, paymentMethod: "pix" } },
    { name: "E_pix_expires_seconds", body: { ...base, paymentMethod: "pix", pix: { expiresInSeconds: 1800 } } },
    { name: "F_document_upper_CPF", body: { ...base, customer: {...base.customer, document: { number: "11144477735", type: "CPF" }}, paymentMethod: "pix", pix: { expiresInMinutes: 30 } } },
    { name: "G_customer_phone", body: { ...base, customer: {...base.customer, phone: "11999999999"}, paymentMethod: "pix", pix: { expiresInMinutes: 30 } } },
    { name: "H_postbackUrl", body: { ...base, paymentMethod: "pix", pix: { expiresInMinutes: 30 }, postbackUrl: "https://example.com/wh" } },
    { name: "I_currency", body: { ...base, currency: "BRL", paymentMethod: "pix", pix: { expiresInMinutes: 30 } } },
    { name: "J_all", body: { ...base, currency: "BRL", customer: {...base.customer, phone: "11999999999", document: { number: "11144477735", type: "cpf"}}, paymentMethod: "pix", pix: { expiresInMinutes: 30 }, postbackUrl: "https://example.com/wh" } },
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
