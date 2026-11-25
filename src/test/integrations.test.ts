import { describe, expect, it } from "vitest";
import { ago, daysUntil, keyState, parseIntegrationTab, shortKey, MAX_API_KEYS, type ApiKeyRow } from "@/components/integrations/intMeta";

const NOW = new Date("2026-11-24T12:00:00Z").getTime();
const key = (over: Partial<ApiKeyRow> = {}): ApiKeyRow => ({
  id: "k", name: "Produção", public_key: "pk_live_x", secret_key_prefix: "sk_live_abcd", is_active: true,
  created_at: "2026-10-01T00:00:00Z", last_used_at: null, expires_at: "2027-01-01T00:00:00Z", revoked_at: null, ...over,
});

describe("keyState", () => {
  it("ativa, pausada, expirada e revogada", () => {
    expect(keyState(key(), NOW)).toBe("active");
    expect(keyState(key({ is_active: false }), NOW)).toBe("paused");
    expect(keyState(key({ expires_at: "2026-11-01T00:00:00Z" }), NOW)).toBe("expired");
    expect(keyState(key({ revoked_at: "2026-11-02T00:00:00Z", is_active: false }), NOW)).toBe("revoked");
  });
  it("revogada ganha de expirada, e expirada ganha de pausada", () => {
    expect(keyState(key({ revoked_at: "2026-11-02T00:00:00Z", expires_at: "2026-11-01T00:00:00Z" }), NOW)).toBe("revoked");
    expect(keyState(key({ is_active: false, expires_at: "2026-11-01T00:00:00Z" }), NOW)).toBe("expired");
  });
  it("sem validade nunca expira", () => {
    expect(keyState(key({ expires_at: null }), NOW)).toBe("active");
  });
});

describe("ago", () => {
  it("escala de agora até a data", () => {
    expect(ago(null, NOW)).toBe("");
    expect(ago("2026-11-24T11:59:40Z", NOW)).toBe("agora");
    expect(ago("2026-11-24T11:35:00Z", NOW)).toBe("há 25 min");
    expect(ago("2026-11-24T08:00:00Z", NOW)).toBe("há 4 h");
    expect(ago("2026-11-23T11:00:00Z", NOW)).toBe("há 1 dia");
    expect(ago("2026-11-20T12:00:00Z", NOW)).toBe("há 4 dias");
    expect(ago("2026-10-01T12:00:00Z", NOW)).toMatch(/out/);
  });
  it("data no futuro (relógio adiantado) vira agora", () => {
    expect(ago("2026-11-24T12:05:00Z", NOW)).toBe("agora");
  });
});

describe("daysUntil", () => {
  it("conta dias inteiros, arredondando para cima", () => {
    expect(daysUntil("2026-12-01T12:00:00Z", NOW)).toBe(7);
    expect(daysUntil("2026-11-24T13:00:00Z", NOW)).toBe(1);
    expect(daysUntil("2026-11-20T12:00:00Z", NOW)).toBeLessThanOrEqual(0);
  });
});

describe("shortKey e limite", () => {
  it("abrevia chaves longas e preserva as curtas", () => {
    expect(shortKey("pk_live_Qw8ErTyUiOpAsDfGhJkLzXcVbNm12345")).toBe("pk_live_Qw8E…2345");
    expect(shortKey("pk_live_abc")).toBe("pk_live_abc");
  });
  it("limite do banco", () => { expect(MAX_API_KEYS).toBe(5); });
});

describe("parseIntegrationTab", () => {
  it("aceita as abas, apelidos antigos e cai em apps", () => {
    expect(parseIntegrationTab("webhooks")).toBe("webhooks");
    expect(parseIntegrationTab("KEYS")).toBe("keys");
    expect(parseIntegrationTab("credenciais")).toBe("keys");
    expect(parseIntegrationTab("documentacao")).toBe("api");
    expect(parseIntegrationTab("nada")).toBe("apps");
    expect(parseIntegrationTab(null)).toBe("apps");
  });
});
