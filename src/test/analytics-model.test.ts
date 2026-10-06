import { describe, expect, it } from "vitest";
import { analyticsSchema, analyticsSellerSchema, sellerPageCount } from "@/features/admin-finance/analyticsModel";
import { ratio } from "@/features/admin-finance/overviewModel";

describe("analytics invariants", () => {
  it("keeps an empty seller list on one page", () => { expect(sellerPageCount(0)).toBe(1); });
  it("does not hide the final seller page", () => { expect(sellerPageCount(26)).toBe(2); expect(sellerPageCount(50)).toBe(2); });
  it("never divides zero attempts", () => { expect(ratio(0, 0)).toBe(0); expect(ratio(3, 4)).toBe(75); });
  it("rejects incomplete server results instead of rendering zero totals", () => { expect(analyticsSchema.safeParse({ summary: {} }).success).toBe(false); });
  it("rejects invalid seller counts", () => {
    expect(analyticsSellerSchema.safeParse({ user_id: "invalid", sales: -1 }).success).toBe(false);
  });
});