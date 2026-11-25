import { describe, expect, it } from "vitest";
import {
  MAX_PERIOD_DAYS, buildPeriod, formatBrDate, matchPreset, maskBrDate, parseBrDate, periodLabel, periodSummary, presetRange, rangeProblem, spanDays,
} from "@/components/period/periodMeta";

const today = new Date(2026, 10, 24); // 24/11/2026
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const iso = (x: Date) => formatBrDate(x);

describe("atalhos de período", () => {
  it("calculam os intervalos a partir de hoje", () => {
    const r = (id: Parameters<typeof presetRange>[0]) => { const x = presetRange(id, today); return `${iso(x.from)}-${iso(x.to)}`; };
    expect(r("today")).toBe("24/11/2026-24/11/2026");
    expect(r("yesterday")).toBe("23/11/2026-23/11/2026");
    expect(r("7d")).toBe("18/11/2026-24/11/2026");
    expect(r("15d")).toBe("10/11/2026-24/11/2026");
    expect(r("30d")).toBe("26/10/2026-24/11/2026");
    expect(r("90d")).toBe("27/08/2026-24/11/2026");
    expect(r("month")).toBe("01/11/2026-24/11/2026");
    expect(r("last_month")).toBe("01/10/2026-31/10/2026");
  });
  it("o mês passado atravessa a virada do ano", () => {
    const x = presetRange("last_month", d(2027, 1, 10));
    expect(`${iso(x.from)}-${iso(x.to)}`).toBe("01/12/2026-31/12/2026");
  });
  it("o fim do intervalo é o fim do dia", () => {
    const x = presetRange("today", today);
    expect(x.to.getHours()).toBe(23);
    expect(x.from.getHours()).toBe(0);
  });
  it("reconhece quando o intervalo escolhido é um atalho", () => {
    expect(matchPreset(d(2026, 11, 18), d(2026, 11, 24), today)).toBe("7d");
    expect(matchPreset(d(2026, 10, 1), d(2026, 10, 31), today)).toBe("last_month");
    expect(matchPreset(d(2026, 11, 1), d(2026, 11, 20), today)).toBeNull();
  });
});

describe("limites do intervalo", () => {
  it("conta os dois extremos", () => {
    expect(spanDays(d(2026, 11, 24), d(2026, 11, 24))).toBe(1);
    expect(spanDays(d(2026, 11, 18), d(2026, 11, 24))).toBe(7);
    expect(spanDays(d(2026, 11, 24), d(2026, 11, 18))).toBe(7);
  });
  it("recusa futuro, antes de 2020 e mais de um ano", () => {
    expect(rangeProblem(d(2026, 11, 20), d(2026, 11, 25), today)).toBe("future");
    expect(rangeProblem(d(2019, 12, 31), d(2020, 1, 5), today)).toBe("too_old");
    const lo = d(2025, 11, 24); // 366 dias contando os dois extremos
    expect(spanDays(lo, today)).toBe(366);
    expect(rangeProblem(lo, today, today)).toBeNull();
    expect(rangeProblem(d(2025, 11, 23), today, today)).toBe("too_long");
    expect(MAX_PERIOD_DAYS).toBe(366);
  });
  it("aceita as pontas em qualquer ordem", () => {
    expect(rangeProblem(today, d(2026, 11, 1), today)).toBeNull();
  });
});

describe("texto do botão", () => {
  it("atalho mostra o nome; intervalo mostra as datas", () => {
    expect(periodLabel(buildPeriod("30d", today), today)).toBe("30 dias");
    expect(periodLabel({ presetId: null, from: d(2026, 11, 10), to: d(2026, 11, 20) }, today)).toBe("10 nov a 20 nov");
    expect(periodLabel({ presetId: null, from: d(2026, 11, 10), to: d(2026, 11, 10) }, today)).toBe("10 nov");
  });
  it("mostra o ano quando o intervalo não é deste ano", () => {
    expect(periodLabel({ presetId: null, from: d(2025, 12, 20), to: d(2026, 1, 5) }, today)).toBe("20 dez 2025 a 05 jan 2026");
  });
  it("sem valor, convida a escolher", () => {
    expect(periodLabel(undefined, today)).toBe("Escolher período");
  });
  it("resumo do rodapé guia o próximo passo", () => {
    expect(periodSummary(null, null)).toMatch(/data inicial/);
    expect(periodSummary(d(2026, 11, 1), null)).toMatch(/data final/);
    expect(periodSummary(d(2026, 11, 1), d(2026, 11, 7))).toBe("01 nov 2026 a 07 nov 2026 · 7 dias");
    expect(periodSummary(d(2026, 11, 1), d(2026, 11, 1))).toMatch(/1 dia$/);
  });
});

describe("data digitada", () => {
  it("coloca as barras enquanto digita", () => {
    expect(maskBrDate("2")).toBe("2");
    expect(maskBrDate("241")).toBe("24/1");
    expect(maskBrDate("24112026")).toBe("24/11/2026");
    expect(maskBrDate("24/11/2026999")).toBe("24/11/2026");
    expect(maskBrDate("ab24")).toBe("24");
  });
  it("lê datas reais e recusa as que não existem", () => {
    expect(iso(parseBrDate("24/11/2026")!)).toBe("24/11/2026");
    expect(iso(parseBrDate("24112026")!)).toBe("24/11/2026");
    expect(iso(parseBrDate("1/2/26")!)).toBe("01/02/2026");
    expect(parseBrDate("31/02/2026")).toBeNull();
    expect(parseBrDate("29/02/2026")).toBeNull();
    expect(iso(parseBrDate("29/02/2028")!)).toBe("29/02/2028");
    expect(parseBrDate("")).toBeNull();
    expect(parseBrDate("abc")).toBeNull();
    expect(parseBrDate("24/13/2026")).toBeNull();
  });
});
