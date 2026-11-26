import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Telas antigas que só abriam por endereço digitado (nenhum menu levava a elas) e prometiam recursos que não existem
 * ou calculavam números por conta própria. Os endereços continuam valendo, mas levam à tela real mais próxima.
 */
const REDIRECTS: Array<[string, string]> = [
  ["/gamificacao", "/premiacoes"],
  ["/vendas/ab-testing", "/vendas/checkout"],
  ["/vendas/auto-cupons", "/vendas/cupons"],
  ["/vendas/calculadora-lucro", "/financeiro/taxas"],
  ["/vendas/checkout-whatsapp", "/vendas/checkout"],
  ["/vendas/funil", "/vendas"],
  ["/vendas/prova-social", "/vendas/checkout"],
  ["/vendas/recuperacao-whatsapp", "/integracoes?tab=apps"],
  ["/vendas/churn", "/vendas/assinaturas"],
  ["/vendas/smart-checkout", "/vendas/checkout"],
  ["/vendas/upsell", "/vendas/produtos"],
];

describe("endereços antigos", () => {
  const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
  it.each(REDIRECTS)("%s leva a %s", (from, to) => {
    expect(app).toContain(`<Route path="${from}" element={<Navigate to="${to}" replace />} />`);
  });
});
