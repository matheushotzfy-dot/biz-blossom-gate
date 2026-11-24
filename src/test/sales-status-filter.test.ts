import { describe, expect, it } from "vitest";
import { deriveTransactionStatus } from "@/lib/utils";
import { salesStatusClause } from "@/lib/sales-status-filter";

const NOW = new Date("2026-11-24T18:00:00.000Z");

describe("salesStatusClause", () => {
  it("não restringe nada em 'all'", () => {
    expect(salesStatusClause("all", NOW)).toEqual({});
  });

  it("pagas usa os mesmos status que isApprovedTransaction", () => {
    expect(salesStatusClause("paid", NOW).statusIn).toEqual(["approved", "completed", "paid"]);
  });

  it("pendentes exige menos de 24h e Pix dentro do prazo", () => {
    const c = salesStatusClause("pending", NOW);
    expect(c.statusIn).toContain("pending");
    expect(c.createdAfter).toBe("2026-11-23T18:00:00.000Z");
    expect(c.or).toBe("pix_expires_at.is.null,pix_expires_at.gt.2026-11-24T18:00:00.000Z");
  });

  it("expiradas cobre status expired, pendentes com 24h ou Pix vencido", () => {
    const c = salesStatusClause("expired", NOW);
    expect(c.or).toContain("status.eq.expired");
    expect(c.or).toContain("created_at.lte.2026-11-23T18:00:00.000Z");
    expect(c.or).toContain("pix_expires_at.lt.2026-11-24T18:00:00.000Z");
  });

  it("os status brutos de pendentes e expiradas batem com deriveTransactionStatus", () => {
    vi_fakeNow(NOW, () => {
      const fresh = { status: "pending", payment_method: "pix", created_at: "2026-11-24T17:00:00.000Z", pix_expires_at: "2026-11-24T19:00:00.000Z" };
      const lateByAge = { status: "pending", payment_method: "pix", created_at: "2026-11-23T10:00:00.000Z", pix_expires_at: null };
      const lateByPix = { status: "pending", payment_method: "pix", created_at: "2026-11-24T17:00:00.000Z", pix_expires_at: "2026-11-24T17:30:00.000Z" };
      expect(deriveTransactionStatus(fresh)).toBe("pending");
      expect(deriveTransactionStatus(lateByAge)).toBe("expired");
      expect(deriveTransactionStatus(lateByPix)).toBe("expired");
    });
  });

  it("contestadas agrupa chargeback e MED", () => {
    const s = salesStatusClause("disputed", NOW).statusIn ?? [];
    expect(s).toEqual(expect.arrayContaining(["chargeback", "med", "dispute"]));
  });
});

function vi_fakeNow(now: Date, fn: () => void) {
  const real = Date.now;
  Date.now = () => now.getTime();
  try { fn(); } finally { Date.now = real; }
}
