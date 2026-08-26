import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  amountMatches,
  isAllowedTransactionTransition,
  verifyHmacSha256,
} from "./payment-webhook.ts";

async function sign(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.test("webhook HMAC verification is strict and constant-time", async () => {
  const body = JSON.stringify({ id: "pay_1", amount: 1000 });
  const secret = "webhook-secret";
  const signature = await sign(body, secret);
  assert(await verifyHmacSha256(body, signature, secret));
  assert(await verifyHmacSha256(body, `sha256=${signature}`, secret));
  assertFalse(await verifyHmacSha256(`${body}x`, signature, secret));
  assertFalse(await verifyHmacSha256(body, "", secret));
});

Deno.test("completed transitions require a valid source state", () => {
  assert(isAllowedTransactionTransition("pending", "completed"));
  assert(isAllowedTransactionTransition("expired", "completed"));
  assertFalse(isAllowedTransactionTransition("refunded", "completed"));
  assertFalse(isAllowedTransactionTransition("chargeback", "completed"));
  assertFalse(isAllowedTransactionTransition("failed", "completed"));
});

Deno.test("payment amount is mandatory and accepts BRL or cents", () => {
  assert(amountMatches(10, 10));
  assert(amountMatches(1000, 10));
  assert(amountMatches("10.00", 10));
  assertFalse(amountMatches(undefined, 10));
  assertFalse(amountMatches(11, 10));
  assertFalse(amountMatches(0, 10));
  assertEquals(amountMatches("invalid", 10), false);
});