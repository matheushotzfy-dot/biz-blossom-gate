import { describe, expect, it } from "vitest";
import { affiliateCode, affiliateUrl, commissionOf, isPaidSale, shortUrl, type AffiliateSale } from "@/components/marketing/affiliateMeta";

describe("regras de afiliados", () => {
  it("calcula a comissão sobre o líquido com centavos", () => {
    expect(commissionOf(100, 30)).toBe(30);
    expect(commissionOf(297, 30)).toBe(89.1);
    expect(commissionOf(47.9, 25)).toBe(11.98);
    expect(commissionOf(0, 50)).toBe(0);
  });

  it("monta o link do afiliado a partir da página de pagamento", () => {
    // O link sempre usa o endereço atual do app, com a mesma página de pagamento do produto.
    expect(affiliateUrl("https://app.example/pay/abc", "aff-123")).toBe(`${window.location.origin}/pay/abc?aff=aff-123`);
    expect(affiliateUrl(null, "aff-123")).toBe("");
    expect(affiliateUrl("", "aff-123")).toBe("");
    expect(shortUrl("https://app.example/pay/abc?aff=x")).toBe("app.example/pay/abc?aff=x");
  });

  it("identifica o afiliado só por um código curto", () => {
    expect(affiliateCode("a1b2c3d4-0000-4000-8000-000000000001")).toBe("A1B2");
    expect(affiliateCode("9f8e7d6c-0000-4000-8000-000000000002")).toBe("9F8E");
  });

  it("só conta como venda do programa o que foi aprovado", () => {
    const sale = (status: string) => ({ status } as AffiliateSale);
    expect(isPaidSale(sale("approved"))).toBe(true);
    expect(isPaidSale(sale("pending"))).toBe(false);
    expect(isPaidSale(sale("refunded"))).toBe(false);
  });
});
