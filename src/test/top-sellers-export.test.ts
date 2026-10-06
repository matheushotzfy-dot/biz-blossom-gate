import { describe, expect, it } from "vitest";
import { csvCell, topSellersCSV } from "@/features/admin-finance/topSellersExport";
import type { AnalyticsSeller } from "@/features/admin-finance/analyticsModel";

describe("Top Sellers export", () => {
  it.each(["=SUM(1)", "+formula", "@formula", "-formula", "  =formula"])("neutralizes spreadsheet formulas: %s", value => {
    expect(csvCell(value)).toContain("'");
  });
  it("escapes quotes and separators", () => expect(csvCell('Nome; "teste"')).toBe('"Nome; ""teste"""'));
  it("includes periods, rank offset and zero-safe ratios without exposing documents", () => {
    const seller: AnalyticsSeller = { user_id: "seller", name: "Nome", email: "a@test.com", account_status: "approved", active: true, created_at: "2026-01-01", attempts: 0, sales: 0, volume: 0, fees: 0, acquirer: 0, clients: 0, failed: 0, refunds: 0, refund_amount: 0, chargebacks: 0, chargeback_amount: 0, med: 0, med_amount: 0, risk_events: 0 };
    const csv = topSellersCSV([seller], "2026-10-01", "2026-10-06", 25);
    expect(csv).toContain('"26";"2026-10-01";"2026-10-06"');
    expect(csv).not.toMatch(/NaN|Infinity|Documento/);
  });
});