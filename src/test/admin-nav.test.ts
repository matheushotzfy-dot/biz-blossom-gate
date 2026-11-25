import { describe, expect, it } from "vitest";
import {
  ALL_TAB_IDS, DATE_PRESETS, EMPLOYEE_ALLOWED_TABS, NAV_SECTIONS, canOpenTab, compactBRL, matchDatePreset,
  presetRange, resolveActiveTab, searchSections, sectionsFor,
} from "@/pages/admin/adminNav";

const today = new Date(2026, 10, 25, 14, 30);
const admin = { isEmployee: false, hasSupportPerm: false };
const staff = { isEmployee: true, hasSupportPerm: false };

describe("navegação do admin", () => {
  it("não repete id de aba", () => {
    const ids = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("staff só abre o que está liberado, e Suporte só com a permissão", () => {
    expect([...EMPLOYEE_ALLOWED_TABS].sort()).toEqual(["god-mode", "products", "sellers", "transactions"]);
    expect(canOpenTab("withdrawals", staff)).toBe(false);
    expect(canOpenTab("support", staff)).toBe(false);
    expect(canOpenTab("support", { isEmployee: true, hasSupportPerm: true })).toBe(true);
    expect(canOpenTab("withdrawals", admin)).toBe(true);
  });

  it("?tab= desconhecido ou proibido cai no Dashboard", () => {
    expect(resolveActiveTab("", admin)).toBe("god-mode");
    expect(resolveActiveTab("nao-existe", admin)).toBe("god-mode");
    expect(resolveActiveTab("withdrawals", staff)).toBe("god-mode");
    expect(resolveActiveTab("withdrawals", admin)).toBe("withdrawals");
    expect(ALL_TAB_IDS.has("god-mode")).toBe(true);
  });

  it("o menu do staff esconde seções vazias", () => {
    const sections = sectionsFor(staff);
    expect(sections.map((s) => s.label)).toEqual(["Operacional", "Financeiro", "Conteúdo"]);
    expect(sections.flatMap((s) => s.items.map((i) => i.id)).sort()).toEqual(["god-mode", "products", "sellers", "transactions"]);
    expect(sectionsFor(admin)).toBe(NAV_SECTIONS);
  });

  it("a busca ignora acento e caixa e também acha pelo nome da seção", () => {
    const ids = (q: string) => searchSections(NAV_SECTIONS, q).flatMap((s) => s.items.map((i) => i.id));
    expect(ids("comissoes")).toEqual(["staff-commissions"]);
    expect(ids("  SAQUES ")).toEqual(["withdrawals"]);
    expect(ids("risco")).toEqual(["risk-compliance", "abuse-metrics", "medpix", "chargeback", "refunds", "premed"]);
    expect(ids("zzz")).toEqual([]);
    expect(searchSections(NAV_SECTIONS, "")).toBe(NAV_SECTIONS);
  });
});

describe("período do admin", () => {
  it("cada atalho cobre dias inteiros", () => {
    const seven = presetRange("7d", today);
    expect(seven.from).toEqual(new Date(2026, 10, 19, 0, 0, 0, 0));
    expect(seven.to.getHours()).toBe(23);
    const y = presetRange("yesterday", today);
    expect(y.from).toEqual(new Date(2026, 10, 24, 0, 0, 0, 0));
    expect(y.to.getDate()).toBe(24);
    expect(presetRange("365d", today).from).toEqual(new Date(2025, 10, 26, 0, 0, 0, 0));
  });

  it("reconhece o atalho pelo intervalo e vira Ontem depois da meia-noite", () => {
    for (const p of DATE_PRESETS) expect(matchDatePreset(presetRange(p.id, today), today)).toBe(p.id);
    const hoje = presetRange("today", today);
    const amanha = new Date(2026, 10, 26, 0, 5);
    expect(matchDatePreset(hoje, amanha)).toBe("yesterday");
    expect(matchDatePreset({ from: new Date(2026, 10, 3), to: new Date(2026, 10, 9) }, today)).toBeNull();
  });
});

describe("compactBRL", () => {
  it("mostra valor cheio até 10 mil e abrevia depois", () => {
    expect(compactBRL(0)).toBe("R$ 0,00");
    expect(compactBRL(1709.5)).toBe("R$ 1.709,50");
    expect(compactBRL(12_450)).toBe("R$ 12,5 mil");
    expect(compactBRL(2_300_000)).toBe("R$ 2,3 mi");
    expect(compactBRL(NaN)).toBe("R$ 0,00");
  });
});
