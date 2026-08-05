/**
 * Guarda de acesso para funções internas (jobs agendados / reconciliação).
 *
 * Essas funções rodam com service role e alteram status financeiro, portanto
 * NÃO podem ser invocadas por qualquer visitante anônimo que conheça a URL.
 * Aceitamos duas provas de identidade:
 *   1. `x-cron-secret: <CRON_SECRET>` — usada pelos jobs do pg_cron.
 *   2. `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` — chamadas internas.
 *
 * Comparação em tempo constante para não vazar o segredo por timing.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isInternalCall(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const provided = req.headers.get("x-cron-secret") ?? "";
  if (cronSecret && provided && timingSafeEqual(provided, cronSecret)) return true;

  const auth = req.headers.get("authorization") ?? "";
  if (serviceKey && auth.startsWith("Bearer ")) {
    return timingSafeEqual(auth.slice(7).trim(), serviceKey);
  }

  return false;
}

export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
