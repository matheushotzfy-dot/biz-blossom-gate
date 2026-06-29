// Integration tests for admin-ban-seller edge function.
// Run with `supabase--test_edge_functions`. Hits the deployed function URL
// using anon credentials from the project's .env file.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/admin-ban-seller`;
const ALLOWED_ORIGIN = "https://hotzfy.com.br";

Deno.test("admin-ban-seller: OPTIONS preflight from allowed origin returns CORS headers", async () => {
  const res = await fetch(ENDPOINT, {
    method: "OPTIONS",
    headers: {
      Origin: ALLOWED_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  await res.text();
  assert(res.status === 200 || res.status === 204, `expected 2xx preflight, got ${res.status}`);
  assertEquals(res.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);
  const allowHeaders = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
  assert(allowHeaders.includes("authorization"), "must allow Authorization header");
});

Deno.test("admin-ban-seller: OPTIONS from disallowed origin does NOT echo Allow-Origin", async () => {
  const res = await fetch(ENDPOINT, {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example.com" },
  });
  await res.text();
  assertEquals(res.headers.get("access-control-allow-origin"), null);
});

Deno.test("admin-ban-seller: GET is rejected with 405", async () => {
  const res = await fetch(ENDPOINT, {
    method: "GET",
    headers: { Origin: ALLOWED_ORIGIN, apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  await res.text();
  assertEquals(res.status, 405);
});

Deno.test("admin-ban-seller: POST without Authorization is rejected", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Origin: ALLOWED_ORIGIN, apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("admin-ban-seller: anon caller (non-admin) is rejected", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Origin: ALLOWED_ORIGIN,
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetUserId: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await res.json();
  assertEquals(body.success, false);
  assert(
    ["Unauthorized", "Forbidden"].includes(body.error),
    `expected auth error, got "${body.error}"`,
  );
});

Deno.test("admin-ban-seller: invalid UUID is rejected by auth or validation", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Origin: ALLOWED_ORIGIN,
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetUserId: "not-a-uuid" }),
  });
  const body = await res.json();
  assertEquals(body.success, false);
  // Either auth rejects first ("Unauthorized"/"Forbidden") or UUID validation
  // catches it ("Invalid targetUserId") — both prove the unsafe path didn't run.
  assert(
    ["Unauthorized", "Forbidden", "Invalid targetUserId"].includes(body.error),
    `expected rejection, got "${body.error}"`,
  );
});
