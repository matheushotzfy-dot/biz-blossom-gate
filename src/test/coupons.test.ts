import { describe, expect, it } from "vitest";
import { STATE_META, applyDiscount, cleanCode, couponErrorMessage, couponState, endOfDayIso, expiryNote, parseAmount, type Coupon } from "@/components/marketing/couponMeta";

const base: Coupon = {
  id: "c", user_id: "u", code: "X", discount_type: "percentage", discount_value: 10, max_uses: null, current_uses: 0, is_active: true,
  expires_at: null, created_at: "2026-01-01T00:00:00Z", product_id: null, total_discount_amount: 0, apply_to_bumps: false, admin_hold_at: null, admin_hold_reason: null,
};

describe("cupons: regras de desconto (espelham validate_coupon)", () => {
  it("calcula porcentagem e valor fixo", () => {
    expect(applyDiscount("percentage", 20, 297)).toEqual({ discount: 59.4, final: 237.6 });
    expect(applyDiscount("fixed", 30, 100)).toEqual({ discount: 30, final: 70 });
  });
  it("nunca deixa o cliente pagar menos de R$ 0,01", () => {
    expect(applyDiscount("fixed", 500, 100)).toEqual({ discount: 99.99, final: 0.01 });
    expect(applyDiscount("percentage", 100, 50)).toEqual({ discount: 49.99, final: 0.01 });
  });
});

describe("cupons: entrada do vendedor", () => {
  it("limpa o código", () => {
    expect(cleanCode("caf é!#2 0")).toBe("CAFE20");
    expect(cleanCode("black-friday_25")).toBe("BLACK-FRIDAY_25");
    expect(cleanCode("A".repeat(50))).toHaveLength(30);
  });
  it("lê números no formato brasileiro", () => {
    expect(parseAmount("1.250,50")).toBe(1250.5);
    expect(parseAmount("12,5")).toBe(12.5);
    expect(parseAmount("30")).toBe(30);
    expect(Number.isNaN(parseAmount(""))).toBe(true);
    expect(Number.isNaN(parseAmount("abc"))).toBe(true);
  });
  it("o cupom vale até o fim do último dia, no horário de Brasília", () => {
    expect(endOfDayIso("2026-12-24")).toBe("2026-12-24T23:59:59-03:00");
  });
});

describe("cupons: situação", () => {
  const now = new Date("2026-11-24T12:00:00-03:00").getTime();
  it("segue a mesma prioridade do checkout", () => {
    expect(couponState(base, now)).toBe("active");
    expect(couponState({ ...base, is_active: false }, now)).toBe("paused");
    expect(couponState({ ...base, max_uses: 5, current_uses: 5 }, now)).toBe("exhausted");
    expect(couponState({ ...base, expires_at: "2026-11-20T23:59:59-03:00", is_active: false }, now)).toBe("expired");
  });
  it("pausa da equipe vence qualquer outra situação e tem rótulo próprio", () => {
    const held = { ...base, admin_hold_at: "2026-11-23T12:00:00Z", admin_hold_reason: "Autocompra", is_active: false };
    expect(couponState(held, now)).toBe("held");
    expect(couponState({ ...held, expires_at: "2026-11-20T23:59:59-03:00" }, now)).toBe("held");
    expect(STATE_META.held.label).toBe("Pausado pela equipe");
  });
  it("traduz a recusa do banco quando o vendedor tenta reativar", () => {
    expect(couponErrorMessage({ code: "42501", message: "A equipe pausou este cupom e ele só volta com a liberação do suporte." }, "x"))
      .toBe("A equipe pausou este cupom. Fale com o suporte para liberar.");
  });
  it("avisa quando o prazo está perto", () => {
    expect(expiryNote(base, now).text).toBe("Sem prazo");
    expect(expiryNote({ ...base, expires_at: "2026-11-26T23:59:59-03:00" }, now)).toMatchObject({ soon: true, sub: "Expira em 3 dias" });
    expect(expiryNote({ ...base, expires_at: "2026-12-30T23:59:59-03:00" }, now).soon).toBeUndefined();
    expect(expiryNote({ ...base, expires_at: "2026-11-01T23:59:59-03:00" }, now).past).toBe(true);
  });
});
