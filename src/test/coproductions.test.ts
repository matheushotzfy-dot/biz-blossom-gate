import { describe, expect, it } from "vitest";
import { cleanEmail, coState, directionOf, holdsProduct, isValidEmail, parseSplit, partnerShare, yourPct, type CoProduction } from "@/components/marketing/coproMeta";

const cp = (o: Partial<CoProduction>): CoProduction => ({
  id: "1", product_id: "p", owner_user_id: "owner", co_producer_user_id: null, co_producer_email: "a@b.com",
  split_percentage: 30, status: "pending", accepted_at: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", ...o,
});

describe("regras de coprodução", () => {
  it("valida a porcentagem do parceiro (inteiro de 1 a 99)", () => {
    expect(parseSplit("1")).toBe(1);
    expect(parseSplit("99")).toBe(99);
    expect(parseSplit("50")).toBe(50);
    expect(parseSplit("0")).toBeNull();
    expect(parseSplit("100")).toBeNull();
    expect(parseSplit("")).toBeNull();
    expect(parseSplit("5,5")).toBeNull();
  });

  it("divide o líquido com centavos", () => {
    expect(partnerShare(100, 30)).toBe(30);
    expect(partnerShare(297, 40)).toBe(118.8);
    expect(partnerShare(47.9, 25)).toBe(11.98);
  });

  it("mostra a parte de quem olha", () => {
    expect(yourPct(cp({ split_percentage: 30 }), "sent")).toBe(70);
    expect(yourPct(cp({ split_percentage: 30 }), "received")).toBe(30);
  });

  it("só chama de ativa a parceria aceita com a conta vinculada", () => {
    expect(coState(cp({ status: "accepted", co_producer_user_id: "u" }))).toBe("active");
    expect(coState(cp({ status: "accepted", co_producer_user_id: null }))).toBe("unlinked");
    expect(coState(cp({ status: "pending" }))).toBe("pending");
    expect(coState(cp({ status: "rejected" }))).toBe("rejected");
  });

  it("convite pendente ou aceito ocupa o produto; recusado não", () => {
    expect(holdsProduct(cp({ status: "pending" }))).toBe(true);
    expect(holdsProduct(cp({ status: "accepted" }))).toBe(true);
    expect(holdsProduct(cp({ status: "rejected" }))).toBe(false);
  });

  it("identifica quem convidou e quem recebeu", () => {
    expect(directionOf(cp({}), "owner")).toBe("sent");
    expect(directionOf(cp({}), "other")).toBe("received");
  });

  it("valida e-mail", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail(" a@b.co ")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("ab.com")).toBe(false);
    expect(cleanEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
});
