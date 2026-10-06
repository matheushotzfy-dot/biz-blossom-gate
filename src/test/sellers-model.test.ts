import { describe, expect, it } from "vitest";
import { sellerRowSchema, sellersPageSchema, validateSellerNumbers } from "@/features/admin-finance/sellersModel";

describe("seller management validation", () => {
  it("rejects incomplete aggregates rather than inventing healthy totals", () => {
    expect(sellersPageSchema.safeParse({ rows: [], summary: {} }).success).toBe(false);
  });
  it("rejects malformed seller identities", () => {
    expect(sellerRowSchema.safeParse({ user_id: "bad-id", sales: -1 }).success).toBe(false);
  });
  it.each(["-1", "101", "NaN", "Infinity"])("rejects invalid percentage %s", raw => {
    expect(validateSellerNumbers({ percentage: raw }, ["percentage"])).toBe(false);
  });
  it.each(["0", "1.5", "366"])("rejects invalid retention days %s", raw => {
    expect(validateSellerNumbers({ days: raw }, [], ["days"])).toBe(false);
  });
  it("accepts explicit zero fee and inherited empty values", () => {
    expect(validateSellerNumbers({ fee: "0", percentage: "", days: "365" }, ["percentage"], ["days"])).toBe(true);
  });
});