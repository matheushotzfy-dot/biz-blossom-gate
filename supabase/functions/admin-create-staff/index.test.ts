// Integration tests for admin-create-staff edge function.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/admin-create-staff`;

Deno.test("admin-create-staff: OPTIONS preflight returns CORS headers", async () => {
  const res = await fetch(ENDPOINT, {
    method: "OPTIONS",
    headers: {
      Origin: "https://hotzfy.com.br",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  await res.text();
  assert(res.status === 200 || res.status === 204);
  const allowHeaders = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
  assert(allowHeaders.includes("authorization"));
  assert(allowHeaders.includes("content-type"));
});

Deno.test("admin-create-staff: missing Authorization returns 401", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "x@y.com", password: "12345678", full_name: "X" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assert(body.error);
});

Deno.test("admin-create-staff: anon JWT (non-admin) returns 403", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: "x@y.com", password: "12345678", full_name: "X" }),
  });
  const body = await res.json();
  // Anon token has no sub claim → function returns 401 ("Unauthorized")
  assert([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
  assert(body.error);
});

Deno.test("admin-create-staff: malformed JSON body is handled gracefully", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: "{not valid json",
  });
  const body = await res.json();
  // Should reject (401 from auth check first, or 400 if validation runs) — must NOT 500
  assert(res.status >= 400 && res.status < 500, `expected 4xx, got ${res.status}`);
  assert(body.error);
});

Deno.test("admin-create-staff: invalid email returns 400 (or 401 if auth runs first)", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: "not-an-email", password: "12345678", full_name: "John" }),
  });
  const body = await res.json();
  assert([400, 401, 403].includes(res.status));
  assert(body.error);
});

Deno.test("admin-create-staff: short password returns 400 (or 401 if auth runs first)", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: "valid@ex.com", password: "123", full_name: "John" }),
  });
  const body = await res.json();
  assert([400, 401, 403].includes(res.status));
  assert(body.error);
});
