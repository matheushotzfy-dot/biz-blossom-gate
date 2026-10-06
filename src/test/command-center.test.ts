import { describe, expect, it } from "vitest";
import { commandCenterSchema, validateCommandSearch } from "@/features/admin-finance/commandCenterModel";

describe("command center safeguards", () => {
  it("rejects unavailable and malformed data instead of showing healthy zeroes", () => {
    expect(commandCenterSchema.safeParse(null).success).toBe(false);
    expect(commandCenterSchema.safeParse({ error_count: -1 }).success).toBe(false);
  });
  it("accepts a trimmed query and UUID", () => {
    expect(validateCommandSearch("  Maria  ")).toBe("Maria");
    expect(validateCommandSearch("30587fc1-3801-4222-9b40-d5f2c73379ec")).toHaveLength(36);
  });
  it("rejects too short and excessive searches", () => {
    expect(() => validateCommandSearch("  a ")).toThrow();
    expect(() => validateCommandSearch("a".repeat(121))).toThrow();
  });
  it("does not interpolate punctuation into REST expressions", () => {
    expect(validateCommandSearch("a%,(b)_c")).toBe("a%,(b)_c");
  });
});