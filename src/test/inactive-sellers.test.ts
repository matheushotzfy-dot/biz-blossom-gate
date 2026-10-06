import { describe, it, expect } from "vitest";
import { inactiveSchema, validDays, activityDate, inactiveCSV, emailLink } from "@/features/admin-inactive/model";
const seller = { user_id: "11111111-1111-4111-8111-111111111111", full_name: "=SUM(A1)", email: "a@test.com", created_at: "2026-01-01T00:00:00+00:00", last_login_at: null, last_attempt_at: null, last_paid_created_at: null, last_activity: "2026-01-01T00:00:00+00:00", days_since: 100, attempts: 0, sales: 0, volume: 0, fees: 0, admin_notes: "secret notes", account_status: "approved" };
const payload = { as_of: "2026-10-06T12:00:00+00:00", page: 0, page_size: 25, totals: { count: 1, over30: 1, volume: 0, fees: 0 }, sellers: [seller] };
describe("Inativos validação e exportação", () => {
 it.each(["", "0", "-1", "7.5", "3651", "abc", "Infinity"])("rejects invalid days %s", value => expect(validDays(value)).toBeNull());
 it.each(["1", "7", "3650"])("accepts %s days", value => expect(validDays(value)).toBe(Number(value)));
 it("validates real RPC payload and null dates", () => expect(inactiveSchema.parse(payload).sellers[0].sales).toBe(0));
 it("rejects malformed data instead of reporting zero", () => expect(inactiveSchema.safeParse({ sellers: [] }).success).toBe(false));
 it("rejects non-finite money", () => expect(inactiveSchema.safeParse({ ...payload, sellers: [{ ...seller, volume: Infinity }] }).success).toBe(false));
 it("rejects pages over 25 rows", () => expect(inactiveSchema.safeParse({ ...payload, sellers: Array(26).fill(seller) }).success).toBe(false));
 it("formats Brasilia dates explicitly", () => expect(activityDate("2026-10-06T12:00:00+00:00")).toContain("09:00"));
 it("handles missing dates honestly", () => expect(activityDate(null)).toBe("Não registrado"));
 it("neutralizes formulas and excludes documents and notes", () => { const csv = inactiveCSV(payload, 7); expect(csv).toContain("'\u003dSUM(A1)"); expect(csv).not.toContain("secret notes"); expect(csv).not.toContain("Documento"); expect(csv).toContain("Volume aprovado histórico"); });
 it("validates contact links", () => { expect(emailLink("a@test.com?bcc=evil@test.com")).toBeNull(); expect(emailLink("a@test.com")).toBe("mailto:a%40test.com"); });
});
