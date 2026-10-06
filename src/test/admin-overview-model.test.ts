import { describe, expect, it } from "vitest";
import { dateKey, overviewSchema, ratio } from "@/features/admin-finance/overviewModel";

describe("admin overview metrics", () => {
  it("handles zero denominators without NaN", () => {
    expect(ratio(0, 0)).toBe(0);
    expect(ratio(3, 4)).toBe(75);
  });
  it("keeps calendar dates intact including the last day", () => {
    expect(dateKey(new Date(2026, 9, 6, 23, 59))).toBe("2026-10-06");
  });
  it("rejects incomplete server payloads instead of inventing totals", () => {
    expect(overviewSchema.safeParse({ summary: { gross: 0 } }).success).toBe(false);
  });
});