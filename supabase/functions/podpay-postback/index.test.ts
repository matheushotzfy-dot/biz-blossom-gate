import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  STATUS_MAP,
  computeHmacHex,
  verifySignature,
  computeSplitAmount,
} from "./index.ts";

const SECRET = "test_secret_key_123";
const BODY = JSON.stringify({ event_id: "evt_1", data: { id: "pay_1", status: "paid" } });

Deno.test("STATUS_MAP maps PodPay statuses correctly", () => {
  assertEquals(STATUS_MAP["paid"], "completed");
  assertEquals(STATUS_MAP["approved"], "completed");
  assertEquals(STATUS_MAP["waiting_payment"], "pending");
  assertEquals(STATUS_MAP["pending"], "pending");
  assertEquals(STATUS_MAP["authorized"], "pending");
  assertEquals(STATUS_MAP["refused"], "failed");
  assertEquals(STATUS_MAP["failed"], "failed");
  assertEquals(STATUS_MAP["cancelled"], "cancelled");
  assertEquals(STATUS_MAP["refunded"], "refunded");
  assertEquals(STATUS_MAP["chargeback"], "chargeback");
  assertEquals(STATUS_MAP["in_protest"], "dispute");
});

Deno.test("STATUS_MAP returns undefined for unknown status", () => {
  assertEquals(STATUS_MAP["nonexistent_status"], undefined);
});

Deno.test("computeHmacHex produces deterministic 64-char hex (SHA-256)", async () => {
  const a = await computeHmacHex(BODY, SECRET);
  const b = await computeHmacHex(BODY, SECRET);
  assertEquals(a, b);
  assertEquals(a.length, 64);
  assert(/^[0-9a-f]+$/.test(a));
});

Deno.test("computeHmacHex differs when body changes", async () => {
  const a = await computeHmacHex(BODY, SECRET);
  const b = await computeHmacHex(BODY + " ", SECRET);
  assert(a !== b);
});

Deno.test("computeHmacHex differs when secret changes", async () => {
  const a = await computeHmacHex(BODY, SECRET);
  const b = await computeHmacHex(BODY, SECRET + "x");
  assert(a !== b);
});

Deno.test("verifySignature accepts a valid signature", async () => {
  const sig = await computeHmacHex(BODY, SECRET);
  assert(await verifySignature(BODY, sig, SECRET));
});

Deno.test("verifySignature accepts uppercase hex (case-insensitive)", async () => {
  const sig = (await computeHmacHex(BODY, SECRET)).toUpperCase();
  assert(await verifySignature(BODY, sig, SECRET));
});

Deno.test("verifySignature rejects a tampered body", async () => {
  const sig = await computeHmacHex(BODY, SECRET);
  assertFalse(await verifySignature(BODY + "tampered", sig, SECRET));
});

Deno.test("verifySignature rejects a wrong secret", async () => {
  const sig = await computeHmacHex(BODY, SECRET);
  assertFalse(await verifySignature(BODY, sig, "wrong_secret"));
});

Deno.test("verifySignature rejects empty signature", async () => {
  assertFalse(await verifySignature(BODY, "", SECRET));
});

Deno.test("verifySignature rejects non-hex characters", async () => {
  assertFalse(await verifySignature(BODY, "z".repeat(64), SECRET));
});

Deno.test("verifySignature rejects odd-length hex", async () => {
  assertFalse(await verifySignature(BODY, "abc", SECRET));
});

Deno.test("verifySignature rejects wrong-length signature", async () => {
  assertFalse(await verifySignature(BODY, "ab".repeat(16), SECRET));
});

Deno.test("computeSplitAmount: 50% of 10000 = 5000", () => {
  assertEquals(computeSplitAmount(10000, 50), 5000);
});

Deno.test("computeSplitAmount: 30% of 9999 rounds correctly", () => {
  // 9999 * 30 = 299970; /100 = 2999.7; Math.round before /100 = 299970/100 = 2999.7
  // Implementation: Math.round(amount * pct) / 100 → Math.round(299970)/100 = 2999.7
  assertEquals(computeSplitAmount(9999, 30), 2999.7);
});

Deno.test("computeSplitAmount: 0% returns 0", () => {
  assertEquals(computeSplitAmount(10000, 0), 0);
});

Deno.test("computeSplitAmount: 100% returns full amount", () => {
  assertEquals(computeSplitAmount(12345, 100), 12345);
});

Deno.test("computeSplitAmount: zero amount returns 0", () => {
  assertEquals(computeSplitAmount(0, 50), 0);
});
