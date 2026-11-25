import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  INSTALLMENT_RATE, MIN_CHARGE, couponDiscount, formatBRL, installmentOption, installmentOptions, orderTotals, roundMoney,
} from "@/features/public-checkout/pricing";
import { safeCheckoutSlug } from "@/features/public-checkout/slug";
import { checkoutUrlMatches, normalizeProduct } from "@/features/public-checkout/loadCheckout";
import { contrastRatio, inkOn, normalizeHex, readableOn, resolveThemeMode, themeVars, SURFACES } from "@/features/public-checkout/theme";
import { outcomeFromStatus, parsePaymentPayload, safeHttpsUrl } from "@/features/public-checkout/status";
import { AFFILIATE_TTL_MS, parseAffiliateSlug, recallAffiliate, rememberAffiliate } from "@/features/public-checkout/affiliate";
import { cleanCouponCode } from "@/features/public-checkout/coupon";
import { formatClock } from "@/features/public-checkout/useOfferTimer";
import type { AppliedCoupon } from "@/features/public-checkout/types";

const pct = (value: number, applyToBumps = false): AppliedCoupon => ({ code: "X", couponId: "c", discountType: "percentage", discountValue: value, applyToBumps });
const fixed = (value: number, applyToBumps = false): AppliedCoupon => ({ code: "X", couponId: "c", discountType: "fixed", discountValue: value, applyToBumps });

describe("preço do pedido (espelha validate_coupon)", () => {
  it("arredonda ao centavo", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
  });

  it("sem cupom, o total é o preço mais as ofertas escolhidas", () => {
    expect(orderTotals(297, [], null)).toEqual({ price: 297, bumpsTotal: 0, subtotal: 297, discount: 0, total: 297 });
    expect(orderTotals(297, [47.9, 39.9], null).total).toBe(384.8);
  });

  it("cupom em porcentagem incide só no produto, a menos que valha para as ofertas", () => {
    expect(couponDiscount(pct(20), 100, 50)).toBe(20);
    expect(couponDiscount(pct(20, true), 100, 50)).toBe(30);
  });

  it("cupom de valor fixo nunca passa do que sobra acima de R$ 0,01", () => {
    expect(couponDiscount(fixed(30), 100, 0)).toBe(30);
    expect(couponDiscount(fixed(500), 100, 0)).toBeCloseTo(99.99, 2);
    expect(couponDiscount(pct(100), 100, 0)).toBeCloseTo(99.99, 2);
  });

  it("o total nunca fica abaixo de R$ 0,01", () => {
    expect(orderTotals(100, [], fixed(100)).total).toBeGreaterThanOrEqual(MIN_CHARGE);
    expect(orderTotals(0.01, [], fixed(5)).total).toBe(0.01);
  });

  it("ignora valores quebrados em vez de virar NaN", () => {
    expect(couponDiscount(fixed(Number.NaN), 100, 0)).toBe(0);
    expect(orderTotals(100, [Number.NaN], null).total).toBe(100);
    expect(couponDiscount(null, 100, 0)).toBe(0);
    expect(couponDiscount(pct(10), 0, 0)).toBe(0);
  });

  it("a soma da divisão do desconto fecha no centavo", () => {
    const t = orderTotals(33.33, [], pct(33));
    expect(t.discount).toBe(11);
    expect(t.total).toBe(22.33);
  });
});

describe("parcelas", () => {
  it("1x é o total, sem acréscimo", () => {
    expect(installmentOption(297, 1)).toEqual({ count: 1, perInstallment: 297, total: 297, withInterest: false });
  });

  it("cada parcela além da primeira soma 1,99% (regra de sempre)", () => {
    expect(INSTALLMENT_RATE).toBe(0.0199);
    const twelve = installmentOption(1200, 12);
    expect(twelve.perInstallment).toBe(roundMoney((1200 * (1 + 0.0199 * 11)) / 12));
    expect(twelve.withInterest).toBe(true);
  });

  it("o total mostrado é exatamente parcela × quantidade (o que a pessoa paga)", () => {
    for (const option of installmentOptions(297.5)) {
      expect(option.total).toBe(roundMoney(option.perInstallment * option.count));
    }
  });

  it("gera de 1 a 12", () => {
    const list = installmentOptions(100);
    expect(list).toHaveLength(12);
    expect(list[0].count).toBe(1);
    expect(list[11].count).toBe(12);
    expect(list.every((option, index) => index === 0 || option.total >= list[index - 1].total)).toBe(true);
  });

  it("formata em reais", () => {
    expect(formatBRL(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(formatBRL(Number.NaN).replace(/\s/g, " ")).toBe("R$ 0,00");
  });
});

describe("slug e endereço do checkout", () => {
  it("só aceita letras, números, _ e -", () => {
    expect(safeCheckoutSlug("esc10x")).toBe("esc10x");
    expect(safeCheckoutSlug("a_b-C9")).toBe("a_b-C9");
    expect(safeCheckoutSlug("a.b")).toBeNull();
    expect(safeCheckoutSlug("a,checkout_url.neq.x")).toBeNull();
    expect(safeCheckoutSlug("a b")).toBeNull();
    expect(safeCheckoutSlug("")).toBeNull();
    expect(safeCheckoutSlug(undefined)).toBeNull();
    expect(safeCheckoutSlug("x".repeat(65))).toBeNull();
  });

  it("confere o fim do endereço (o LIKE trata _ como curinga)", () => {
    expect(checkoutUrlMatches("https://app.example/pay/esc10x", "esc10x")).toBe(true);
    expect(checkoutUrlMatches("https://app.example/checkout/esc10x", "esc10x")).toBe(true);
    expect(checkoutUrlMatches("esc10x", "esc10x")).toBe(true);
    expect(checkoutUrlMatches("/esc10x", "esc10x")).toBe(true);
    expect(checkoutUrlMatches("https://app.example/pay/esc10x?utm_source=a", "esc10x")).toBe(true);
    expect(checkoutUrlMatches("https://app.example/pay/esc_0x", "esc10x")).toBe(false);
    expect(checkoutUrlMatches("https://app.example/pay/xesc10x", "esc10x")).toBe(false);
    expect(checkoutUrlMatches(null, "esc10x")).toBe(false);
  });
});

describe("produto normalizado", () => {
  const row = {
    id: "p1", name: "Curso", description: "  ", price: "297.00", image_url: "", display_name: "Marina", checkout_button_color: "#12b886",
    checkout_theme: "dark", checkout_timer_enabled: true, checkout_timer_minutes: 90, checkout_pix_enabled: true, checkout_credit_card_enabled: false,
    checkout_boleto_enabled: true, checkout_address_required: true, checkout_email_confirm: false, checkout_guarantee_enabled: true,
  };

  it("converte tipos e deixa os métodos na ordem Pix, cartão, boleto", () => {
    const p = normalizeProduct(row);
    expect(p.price).toBe(297);
    expect(p.description).toBeNull();
    expect(p.imageUrl).toBeNull();
    expect(p.methods).toEqual(["pix", "boleto"]);
    expect(p.theme).toBe("dark");
    expect(p.sellerName).toBe("Marina");
    expect(normalizeProduct({ ...row, checkout_credit_card_enabled: true }).methods).toEqual(["pix", "credit_card", "boleto"]);
  });

  it("limita o cronômetro a 1–60 minutos (padrão 15) e cai no tema cinza", () => {
    expect(normalizeProduct(row).timerMinutes).toBe(15);
    expect(normalizeProduct({ ...row, checkout_timer_minutes: 30 }).timerMinutes).toBe(30);
    expect(normalizeProduct({ ...row, checkout_timer_minutes: 0 }).timerMinutes).toBe(15);
    expect(normalizeProduct({ ...row, checkout_theme: "neon" }).theme).toBe("gray");
    expect(normalizeProduct({ ...row, price: "abc" }).price).toBe(0);
  });
});

describe("tema do vendedor", () => {
  it("aceita só cor hex e normaliza #abc", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("#12b886")).toBe("#12b886");
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("#12b88")).toBeNull();
    expect(normalizeHex("#fff; background:url(x)")).toBeNull();
    expect(normalizeHex(null)).toBeNull();
  });

  it("o texto do botão é sempre legível sobre a cor escolhida", () => {
    for (const color of ["#10b981", "#ff5a1f", "#ffe600", "#111827", "#ffffff", "#2563eb", "#7c3aed"]) {
      const on = readableOn(color);
      expect(contrastRatio(color, on)).toBeGreaterThanOrEqual(contrastRatio(color, on === "#ffffff" ? "#0b1220" : "#ffffff"));
    }
    expect(readableOn("#ffe600")).toBe("#0b1220");
    expect(readableOn("#111827")).toBe("#ffffff");
  });

  it("a cor usada como texto ganha contraste mínimo com o fundo, nos três temas", () => {
    for (const color of ["#10b981", "#ffe600", "#facc15", "#111827", "#ff5a1f"]) {
      for (const mode of ["gray", "white", "dark"] as const) {
        const ink = inkOn(color, SURFACES[mode]);
        expect(contrastRatio(ink, SURFACES[mode])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("resolve o modo e entrega só variáveis seguras", () => {
    expect(resolveThemeMode("dark")).toBe("dark");
    expect(resolveThemeMode("white")).toBe("white");
    expect(resolveThemeMode("x")).toBe("gray");
    const vars = themeVars("gray", "javascript:alert(1)") as Record<string, string>;
    expect(vars["--ck-accent"]).toBe("#10b981");
  });
});

describe("status e dados do pagamento", () => {
  it("traduz o status do servidor; o desconhecido continua pendente", () => {
    for (const s of ["completed", "approved", "paid"]) expect(outcomeFromStatus(s)).toBe("approved");
    expect(outcomeFromStatus("expired")).toBe("expired");
    for (const s of ["failed", "cancelled", "refused"]) expect(outcomeFromStatus(s)).toBe("failed");
    for (const s of ["pending", "processing", "", null, undefined, 42, "refunded"]) expect(outcomeFromStatus(s)).toBe("pending");
  });

  it("só abre link https", () => {
    expect(safeHttpsUrl("https://banco.com/boleto.pdf")).toBe("https://banco.com/boleto.pdf");
    expect(safeHttpsUrl("http://banco.com/boleto.pdf")).toBeNull();
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl("data:text/html,<script>1</script>")).toBeNull();
    expect(safeHttpsUrl(null)).toBeNull();
  });

  it("lê os nomes conhecidos do Pix e do boleto e ignora o resto", () => {
    expect(parsePaymentPayload("pix", { qrCodeText: "000201abc" }).pixCode).toBe("000201abc");
    expect(parsePaymentPayload("pix", { qrcode: "000201def" }).pixCode).toBe("000201def");
    expect(parsePaymentPayload("pix", { pix_copia_e_cola: "000201ghi" }).pixCode).toBe("000201ghi");
    expect(parsePaymentPayload("pix", {}).pixCode).toBeNull();
    expect(parsePaymentPayload("pix", null).pixCode).toBeNull();
    const boleto = parsePaymentPayload("boleto", { url: "https://x.com/b.pdf", barCode: "3419 1790" });
    expect(boleto).toMatchObject({ boletoUrl: "https://x.com/b.pdf", boletoCode: "3419 1790", pixCode: null });
    expect(parsePaymentPayload("boleto", { url: "javascript:1" }).boletoUrl).toBeNull();
    expect(parsePaymentPayload("pix", { qrCodeText: "x", expiresAt: "2026-11-25T12:00:00Z" }).expiresAt).toBe(Date.parse("2026-11-25T12:00:00Z"));
  });
});

describe("afiliado no link", () => {
  beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });

  it("lê ?aff= ou ?ref= e recusa formato estranho", () => {
    expect(parseAffiliateSlug("?aff=aff-1a2b3c4d5e")).toBe("aff-1a2b3c4d5e");
    expect(parseAffiliateSlug("?ref=aff-1a2b3c4d5e")).toBe("aff-1a2b3c4d5e");
    expect(parseAffiliateSlug("?aff=ab")).toBeNull();
    expect(parseAffiliateSlug("?aff=a%20b;drop")).toBeNull();
    expect(parseAffiliateSlug("?utm_source=x")).toBeNull();
    expect(parseAffiliateSlug("")).toBeNull();
  });

  it("lembra por produto e esquece depois de 30 dias", () => {
    const now = Date.now();
    rememberAffiliate("p1", "aff-1a2b3c4d5e", now);
    expect(recallAffiliate("p1", now + 1000)).toBe("aff-1a2b3c4d5e");
    expect(recallAffiliate("p2", now + 1000)).toBeNull();
    expect(recallAffiliate("p1", now + AFFILIATE_TTL_MS + 1000)).toBeNull();
    expect(recallAffiliate("p1", now + 1000)).toBeNull(); // já foi apagado
  });

  it("ignora o que estiver guardado com formato inválido", () => {
    window.localStorage.setItem("vp-aff:p1", JSON.stringify({ slug: "x y", savedAt: Date.now() }));
    expect(recallAffiliate("p1")).toBeNull();
    window.localStorage.setItem("vp-aff:p1", "não é json");
    expect(recallAffiliate("p1")).toBeNull();
  });
});

describe("cupom e relógio", () => {
  it("limpa o código como o painel do vendedor aceita", () => {
    expect(cleanCouponCode(" black-20 ")).toBe("BLACK-20");
    expect(cleanCouponCode("a;b'c")).toBe("ABC");
    expect(cleanCouponCode("x".repeat(40))).toHaveLength(30);
    expect(cleanCouponCode(null)).toBe("");
  });

  it("mostra o relógio com dois dígitos", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(75)).toBe("01:15");
    expect(formatClock(15 * 60)).toBe("15:00");
  });
});

describe("armazenamento indisponível", () => {
  it("o afiliado não quebra quando o navegador bloqueia o storage", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => rememberAffiliate("p1", "aff-1a2b3c4d5e")).not.toThrow();
    spy.mockRestore();
  });
});
