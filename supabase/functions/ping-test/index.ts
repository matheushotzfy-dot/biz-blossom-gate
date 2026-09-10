Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  const url = Deno.env.get("SUPABASE_URL")!;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const out: Record<string, unknown> = { hasSvc: svc.length > 0, svcLen: svc.length };

  async function timed(name: string, fn: () => Promise<Response>) {
    const t = Date.now();
    try {
      const r = await fn();
      out[name] = { status: r.status, ms: Date.now() - t, body: (await r.text()).slice(0, 120) };
    } catch (e) {
      out[name] = { error: (e as Error).message, ms: Date.now() - t };
    }
  }

  await timed("rest_select", () =>
    fetch(`${url}/rest/v1/admin_login_attempts?select=id&limit=1`, {
      headers: { apikey: svc, Authorization: `Bearer ${svc}` },
      signal: AbortSignal.timeout(8000),
    }));

  await timed("rpc_abuse", () =>
    fetch(`${url}/rest/v1/rpc/check_and_block_abuse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: svc, Authorization: `Bearer ${svc}` },
      body: JSON.stringify({ _ip_hash: "test", _endpoint: "ping", _window_seconds: 10, _max_events: 100, _block_minutes: 15 }),
      signal: AbortSignal.timeout(8000),
    }));

  return new Response(JSON.stringify(out), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
