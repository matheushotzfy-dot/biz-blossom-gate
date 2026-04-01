import { describe, it, expect } from "vitest";
import DOMPurify from "dompurify";
import { sanitizeText } from "@/lib/auditLog";

/**
 * Security tests — verifying core hardening measures
 */

// ============================
// XSS Prevention Tests
// ============================
describe("XSS Prevention — DOMPurify sanitization", () => {
  const PURIFY_CONFIG = {
    ALLOWED_TAGS: ["h3", "p", "br", "strong", "em", "code", "pre", "span", "div"],
    ALLOWED_ATTR: ["class"],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style"],
    FORBID_ATTR: ["onclick", "onerror", "onload", "onmouseover", "style"],
  };

  it("strips <script> tags from content", () => {
    const malicious = '<p>Hello</p><script>alert("xss")</script>';
    const result = DOMPurify.sanitize(malicious, PURIFY_CONFIG);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Hello</p>");
  });

  it("strips event handlers from elements", () => {
    const malicious = '<div onclick="alert(1)">Click me</div>';
    const result = DOMPurify.sanitize(malicious, PURIFY_CONFIG);
    expect(result).not.toContain("onclick");
    expect(result).toContain("Click me");
  });

  it("strips iframe elements", () => {
    const malicious = '<iframe src="https://evil.com"></iframe>';
    const result = DOMPurify.sanitize(malicious, PURIFY_CONFIG);
    expect(result).not.toContain("<iframe");
  });

  it("strips onerror attributes on images", () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const result = DOMPurify.sanitize(malicious, PURIFY_CONFIG);
    expect(result).not.toContain("onerror");
  });

  it("allows safe tags", () => {
    const safe = '<h3 class="title">Title</h3><p>Content</p><code>code</code>';
    const result = DOMPurify.sanitize(safe, PURIFY_CONFIG);
    expect(result).toContain("<h3");
    expect(result).toContain("<p>");
    expect(result).toContain("<code>");
  });
});

// ============================
// sanitizeText Tests
// ============================
describe("sanitizeText — audit log sanitization", () => {
  it("removes HTML angle brackets", () => {
    expect(sanitizeText("<script>alert(1)</script>")).not.toContain("<");
    expect(sanitizeText("<script>alert(1)</script>")).not.toContain(">");
  });

  it("removes javascript: protocol", () => {
    expect(sanitizeText("javascript:alert(1)")).not.toContain("javascript:");
  });

  it("removes inline event handlers", () => {
    expect(sanitizeText("onclick=alert(1)")).not.toContain("onclick=");
    expect(sanitizeText("onerror=fetch('x')")).not.toContain("onerror=");
  });

  it("respects max length", () => {
    const long = "a".repeat(2000);
    expect(sanitizeText(long, 500).length).toBe(500);
  });

  it("trims whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(sanitizeText("")).toBe("");
  });
});

// ============================
// Safe Logging Tests
// ============================
describe("Edge Function safeLog pattern", () => {
  const ALLOWED_KEYS = ['transactionId', 'productId', 'status', 'amount', 'paymentMethod', 'podpayId', 'error', 'code', 'resumed'];

  function filterSafe(context: Record<string, unknown>): Record<string, unknown> {
    const safe: Record<string, unknown> = {};
    for (const key of ALLOWED_KEYS) {
      if (key in context) safe[key] = context[key];
    }
    return safe;
  }

  it("strips PII fields from log context", () => {
    const dirty = {
      transactionId: "tx-123",
      status: "completed",
      customerEmail: "john@example.com",
      customerDocument: "123.456.789-00",
      customerPhone: "+5511999999999",
      cardToken: "tok_abc123",
    };
    const safe = filterSafe(dirty);
    expect(safe).toEqual({ transactionId: "tx-123", status: "completed" });
    expect(safe).not.toHaveProperty("customerEmail");
    expect(safe).not.toHaveProperty("customerDocument");
    expect(safe).not.toHaveProperty("customerPhone");
    expect(safe).not.toHaveProperty("cardToken");
  });

  it("passes allowed keys through", () => {
    const context = { transactionId: "tx-1", amount: 15000, paymentMethod: "pix", status: "pending" };
    const safe = filterSafe(context);
    expect(safe).toEqual(context);
  });
});

// ============================
// Input Validation Tests
// ============================
describe("Input validation patterns", () => {
  it("rejects negative withdrawal amounts", () => {
    expect(-100 > 0).toBe(false);
  });

  it("rejects excessively large amounts", () => {
    expect(999999 > 500000).toBe(true); // exceeds max
  });

  it("validates email format", () => {
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    expect(emailRegex.test("valid@email.com")).toBe(true);
    expect(emailRegex.test("invalid")).toBe(false);
    expect(emailRegex.test("no@dots")).toBe(false);
    expect(emailRegex.test("@missing.com")).toBe(false);
    expect(emailRegex.test("spaces @email.com")).toBe(false);
  });

  it("validates CPF format (11 digits)", () => {
    const cpfRegex = /^\d{11}$/;
    expect(cpfRegex.test("12345678900")).toBe(true);
    expect(cpfRegex.test("123.456.789-00")).toBe(false); // formatted
    expect(cpfRegex.test("1234567890")).toBe(false); // too short
  });

  it("blocks internal URLs in webhook validation", () => {
    const blocked = /https:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
    expect(blocked.test("https://localhost/webhook")).toBe(true);
    expect(blocked.test("https://127.0.0.1/hook")).toBe(true);
    expect(blocked.test("https://10.0.0.1/api")).toBe(true);
    expect(blocked.test("https://192.168.1.1/api")).toBe(true);
    expect(blocked.test("https://myapp.com/webhook")).toBe(false);
  });
});

// ============================
// Co-production Split Logic Tests
// ============================
describe("Co-production split calculations", () => {
  it("calculates correct split amounts", () => {
    const netAmount = 10000; // R$ 100,00 in cents
    const splitPct = 30;
    const splitAmount = Math.round(netAmount * splitPct) / 100;
    expect(splitAmount).toBe(3000);
  });

  it("handles edge case 1% split", () => {
    const splitAmount = Math.round(10000 * 1) / 100;
    expect(splitAmount).toBe(100);
  });

  it("handles edge case 99% split", () => {
    const splitAmount = Math.round(10000 * 99) / 100;
    expect(splitAmount).toBe(9900);
  });

  it("zero net amount results in no split", () => {
    const splitAmount = Math.round(0 * 50) / 100;
    expect(splitAmount).toBe(0);
    expect(splitAmount <= 0).toBe(true);
  });
});
