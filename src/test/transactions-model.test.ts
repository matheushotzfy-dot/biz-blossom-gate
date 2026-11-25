import { describe, expect, it } from "vitest";
import { EXPORT_CAP, approvalRate, chargebackRate, exportPlan, methodLabel, parsePage, parseSummary, pct, situationLabel, transactionsCsv, type Tx } from "@/features/admin-transactions/transactionsModel";

describe("resumo vindo do banco", () => {
  it("converte textos em números e zera o que faltar", () => {
    expect(parseSummary({ total: "8", gross: "150.00", approved: 2, chargeback: null })).toMatchObject({ total: 8, gross: 150, approved: 2, chargeback: 0, fees: 0 });
    expect(parseSummary(undefined).total).toBe(0);
  });
  it("resposta sem lista de itens é erro, não 'nenhuma transação'", () => {
    expect(() => parsePage(null)).toThrow();
    expect(() => parsePage({ total: 3 })).toThrow();
    expect(parsePage({ items: [], total: 0, totals: { approved: 4 } }).summary.approved).toBe(4);
  });
  it("taxa de aprovação e de chargeback", () => {
    const s = parseSummary({ total: 10, approved: 4, chargeback: 1 });
    expect(approvalRate(s)).toBe(40);
    expect(chargebackRate(s)).toBe(20);
    expect(chargebackRate(parseSummary({}))).toBe(0);
    expect(pct(1.234, 2)).toBe("1,23%");
  });
});

describe("rótulos", () => {
  it("método e situação em português", () => {
    expect(methodLabel("pix")).toBe("Pix");
    expect(methodLabel("credit_card")).toBe("Cartão");
    expect(methodLabel(null)).toBe("—");
    const base = { payment_method: "pix", pix_expires_at: null, created_at: new Date().toISOString() };
    expect(situationLabel({ ...base, status: "approved" })).toBe("Aprovada");
    expect(situationLabel({ ...base, status: "waiting_payment" })).toBe("Pendente");
    expect(situationLabel({ ...base, status: "pending", created_at: new Date(Date.now() - 30 * 3600_000).toISOString() })).toBe("Expirada");
    expect(situationLabel({ ...base, status: "chargeback" })).toBe("MED Pix perdido");
    expect(situationLabel({ ...base, payment_method: "credit_card", status: "chargeback" })).toBe("Chargeback");
  });
});

describe("exportação", () => {
  it("planeja páginas e avisa quando passa do limite", () => {
    expect(exportPlan(0)).toEqual({ count: 0, pages: 0, truncated: false });
    expect(exportPlan(450)).toEqual({ count: 450, pages: 3, truncated: false });
    expect(exportPlan(EXPORT_CAP + 1)).toEqual({ count: EXPORT_CAP, pages: 50, truncated: true });
  });
  it("CSV: separador ;, vírgula decimal, BOM e células perigosas neutralizadas", () => {
    const tx = { id: "t1", external_id: null, created_at: "2026-11-25T01:30:00Z", customer_name: "=HYPERLINK(\"http://x\")", customer_email: "a@b.com", customer_document: "123", user_id: "s1", product_id: null, payment_method: "pix", amount: 1234.5, discount_amount: null, fee_amount: 10, net_amount: 1224.5, status: "approved", pix_expires_at: null, source: null } as unknown as Tx;
    const csv = transactionsCsv([tx], () => "Marina", (id) => (id ? "Curso" : "Sem produto"));
    expect(csv.startsWith("﻿\"ID\";")).toBe(true);
    const [, line] = csv.split("\r\n");
    expect(line).toContain("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(line).toContain("\"1234,50\";\"0,00\";\"10,00\";\"1224,50\";\"Aprovada\";\"checkout\"");
    expect(line).toContain("\"24/11/2026 às 22:30\"");
    expect(line).toContain("\"Sem produto\"");
  });
});
