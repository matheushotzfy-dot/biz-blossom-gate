import { describe, expect, it } from "vitest";
import { SLOW_MS, buildRows, probeHealth, summarize, type StatusInput } from "@/features/status/statusModel";

const ok = (ms = 120) => ({ ok: true, ms });
const base: StatusInput = { api: ok(), auth: ok(), pauses: { payments: false, withdrawals: false }, paymentsLive: true };
const row = (input: StatusInput, id: string) => buildRows(input).find((r) => r.id === id)!;

describe("status dos serviços", () => {
  it("lê a sonda: sem resposta ainda, ok, lento e fora do ar", () => {
    expect(probeHealth(null)).toBe("checking");
    expect(probeHealth(ok(SLOW_MS))).toBe("ok");
    expect(probeHealth(ok(SLOW_MS + 1))).toBe("slow");
    expect(probeHealth({ ok: false, ms: 10 })).toBe("down");
  });

  it("tudo de pé vira 'Tudo funcionando'", () => {
    expect(summarize(buildRows(base))).toEqual({ tone: "ok", title: "Tudo funcionando" });
  });

  it("sem adquirente, pagamentos ficam 'em configuração' e isso não conta como instabilidade", () => {
    const input = { ...base, paymentsLive: false };
    expect(row(input, "payments").health).toBe("setup");
    expect(row(input, "payments").detail).toMatch(/ainda não cobra/);
    expect(summarize(buildRows(input)).tone).toBe("ok");
  });

  it("pausa da equipe aparece em pagamentos e saques e vira aviso", () => {
    const input = { ...base, pauses: { payments: true, withdrawals: true } };
    expect(row(input, "payments").health).toBe("paused");
    expect(row(input, "withdrawals").health).toBe("paused");
    expect(summarize(buildRows(input)).tone).toBe("warn");
  });

  it("servidor fora do ar derruba pagamentos e saques junto, e o topo diz o que caiu", () => {
    const input = { ...base, api: { ok: false, ms: 10_000 }, pauses: null };
    expect(row(input, "payments").health).toBe("down");
    expect(row(input, "withdrawals").health).toBe("down");
    expect(summarize(buildRows(input))).toEqual({ tone: "down", title: "Alguns serviços estão fora do ar" });
  });

  it("só o login fora do ar é dito pelo nome", () => {
    const input = { ...base, auth: { ok: false, ms: 50 } };
    expect(summarize(buildRows(input))).toEqual({ tone: "down", title: "Entrar e criar conta fora do ar" });
  });

  it("enquanto confere, não afirma nada", () => {
    const input = { ...base, api: null, auth: null, pauses: null };
    expect(buildRows(input).every((r) => r.health === "checking")).toBe(true);
    expect(summarize(buildRows(input)).tone).toBe("checking");
  });

  it("mostra a demora só de quem respondeu", () => {
    expect(row({ ...base, api: ok(42) }, "site").ms).toBe(42);
    expect(row({ ...base, api: { ok: false, ms: 9000 } }, "site").ms).toBeUndefined();
  });
});
