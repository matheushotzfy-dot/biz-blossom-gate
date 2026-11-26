import { describe, expect, it } from "vitest";
import { mobileTabActive as tabActive } from "@/components/seller-shell/navConfig";

describe("barra de baixo do celular", () => {
  it("Vendas só acende nas telas de vendas; Produtos e Marketing ficam no Mais", () => {
    expect(tabActive("/vendas", "/vendas")).toBe(true);
    expect(tabActive("/vendas/assinaturas", "/vendas")).toBe(true);
    expect(tabActive("/vendas/checkout", "/vendas")).toBe(false);
    expect(tabActive("/vendas/produtos/p1/editar", "/vendas")).toBe(false);
    expect(tabActive("/vendas/cupons", "/vendas")).toBe(false);
  });

  it("Financeiro acende nas telas de saldo; Taxas está no Mais", () => {
    expect(tabActive("/financeiro/saques", "/financeiro/saques")).toBe(true);
    expect(tabActive("/financeiro/config", "/financeiro/saques")).toBe(true);
    expect(tabActive("/financeiro/taxas", "/financeiro/saques")).toBe(false);
    expect(tabActive("/dashboard", "/dashboard")).toBe(true);
    expect(tabActive("/vendas/link-pagamento", "/vendas/link-pagamento")).toBe(true);
  });
});
