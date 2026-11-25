import { describe, expect, it } from "vitest";
import { buildStatement, fmtDateTime, isHighValue, isNewSeller, parseAmount, sortQueue, summarizeWithdrawals, validateAdjustment, validateAutoLimit, waitingLabel, withdrawalFlags } from "@/features/admin-withdrawals/withdrawalsModel";

const NOW = new Date("2026-11-25T12:00:00Z").getTime();
const w = (over: Record<string, unknown>) => ({ id: "w1", status: "pending", user_id: "u1", amount: 100, fee_amount: 5, net_amount: 95, processed_at: null, created_at: "2026-11-24T10:00:00Z", ...over }) as never;

describe("risco da fila de saques", () => {
  it("seller com menos de 30 dias ou sem perfil carregado é tratado como novo", () => {
    expect(isNewSeller("2026-11-01T00:00:00Z", NOW)).toBe(true);
    expect(isNewSeller("2026-10-01T00:00:00Z", NOW)).toBe(false);
    expect(isNewSeller(undefined, NOW)).toBe(true);
    expect(isNewSeller("lixo", NOW)).toBe(true);
  });
  it("valor alto começa em R$ 50 mil", () => {
    expect(isHighValue(49_999.99)).toBe(false);
    expect(isHighValue(50_000)).toBe(true);
    expect(withdrawalFlags(60_000, "2026-01-01T00:00:00Z", NOW)).toEqual(["Valor alto"]);
    expect(withdrawalFlags(60_000, undefined, NOW)).toEqual(["Perfil não carregado", "Valor alto"]);
  });
});

describe("summarizeWithdrawals", () => {
  it("separa pendentes, pagos e recusados; taxa só dos pagos; conta os pendentes com flag", () => {
    const rows = [w({}), w({ id: "w2", amount: 60_000, user_id: "u2" }), w({ id: "w3", status: "approved", amount: 200, fee_amount: 10 }), w({ id: "w4", status: "rejected", amount: 300, fee_amount: 15 })];
    const t = summarizeWithdrawals(rows, (u) => (u === "u1" ? "2026-01-01T00:00:00Z" : "2026-01-01T00:00:00Z"), NOW);
    expect(t).toEqual({ pendingCount: 2, pendingAmount: 60_100, paidCount: 1, paidAmount: 200, rejectedCount: 1, fees: 10, flagged: 1 });
  });
});

describe("buildStatement", () => {
  it("visão da plataforma: saque aprovado e crédito saem; taxa e débito entram; mais novo primeiro", () => {
    const rows = buildStatement(
      [w({ id: "a", status: "approved", processed_at: "2026-11-23T10:00:00Z" }), w({ id: "b", status: "rejected" }), w({ id: "c" })],
      [{ id: "x", user_id: "u1", amount: 50, type: "credit", reason: "Compensação", admin_user_id: "adm", created_at: "2026-11-24T10:00:00Z" }, { id: "y", user_id: "u1", amount: 20, type: "debit", reason: "Correção", admin_user_id: "adm", created_at: "2026-11-22T10:00:00Z" }],
      () => "Marina",
    );
    expect(rows.map((r) => [r.label, r.amount, r.inflow])).toEqual([
      ["Ajuste de crédito", 50, false], ["Saque aprovado", 95, false], ["Taxa de saque", 5, true], ["Ajuste de débito", 20, true],
    ]);
  });
  it("respeita o limite de lançamentos", () => {
    const many = Array.from({ length: 150 }, (_, i) => w({ id: `p${i}`, status: "approved", processed_at: new Date(NOW - i * 1000).toISOString() }));
    expect(buildStatement(many, [], () => "x", 100)).toHaveLength(100);
  });
});

describe("valores digitados", () => {
  it("entende formato brasileiro e ponto decimal; recusa o resto", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("R$ 150,5")).toBe(150.5);
    expect(parseAmount("1234.56")).toBe(1234.56);
    expect(parseAmount("100")).toBe(100);
    for (const bad of ["", "abc", "1,234,56", "-5", "12.345", "1e3", "10,999"]) expect(parseAmount(bad)).toBeNull();
  });
  it("ajuste: valida seller, valor e motivo, nessa ordem", () => {
    expect(validateAdjustment({ userId: "", amount: "10", reason: "motivo ok" })).toMatch(/seller/);
    expect(validateAdjustment({ userId: "u", amount: "", reason: "motivo ok" })).toMatch(/valor em reais/);
    expect(validateAdjustment({ userId: "u", amount: "0", reason: "motivo ok" })).toMatch(/maior que zero/);
    expect(validateAdjustment({ userId: "u", amount: "1.000.000,01", reason: "motivo ok" })).toMatch(/máximo/);
    expect(validateAdjustment({ userId: "u", amount: "10", reason: "abc" })).toMatch(/motivo/);
    expect(validateAdjustment({ userId: "u", amount: "1.000.000,00", reason: "motivo ok" })).toBeNull();
  });
  it("limite da auto-aprovação precisa ser positivo e dentro do teto", () => {
    expect(validateAutoLimit("0")).toMatch(/maior que zero/);
    expect(validateAutoLimit("abc")).toMatch(/maior que zero/);
    expect(validateAutoLimit("2.000.000,00")).toMatch(/máximo/);
    expect(validateAutoLimit("500,00")).toBeNull();
  });
});

describe("datas e fila", () => {
  it("mostra a data no fuso de Brasília", () => {
    expect(fmtDateTime("2026-11-25T01:30:00Z")).toBe("24/11/2026 às 22:30");
    expect(fmtDateTime(null)).toBe("—");
    expect(fmtDateTime("lixo")).toBe("—");
  });
  it("tempo de espera", () => {
    const base = new Date("2026-11-25T12:00:00Z").getTime();
    expect(waitingLabel("2026-11-25T11:59:40Z", base)).toBe("agora");
    expect(waitingLabel("2026-11-25T11:25:00Z", base)).toBe("há 35 min");
    expect(waitingLabel("2026-11-25T07:00:00Z", base)).toBe("há 5 h");
    expect(waitingLabel("2026-11-24T10:00:00Z", base)).toBe("há 1 dia");
    expect(waitingLabel("2026-11-20T10:00:00Z", base)).toBe("há 5 dias");
  });
  it("pendentes: mais antigo primeiro; histórico: mais novo primeiro", () => {
    const rows = [{ created_at: "2026-11-02T00:00:00Z", id: "b" }, { created_at: "2026-11-01T00:00:00Z", id: "a" }, { created_at: "2026-11-03T00:00:00Z", id: "c" }];
    expect(sortQueue(rows, true).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(sortQueue(rows, false).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
});
