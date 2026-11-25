import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { MAX_REPORTS_PER_PAGE_LOAD, createErrorReporter, errorKey, isNoise, reportClientError } from "@/lib/clientErrorReport";

const make = (send = vi.fn().mockResolvedValue({ error: null }), max?: number) => {
  const report = createErrorReporter({ send, route: () => "/pay/abc", ua: () => "UA/1", max });
  return { report, send };
};
const boom = (msg: string, stack = `Error: ${msg}\n    at f (https://x.com/a.js:10:5)`) => Object.assign(new Error(msg), { stack });

beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: true, error: null }); });

describe("isNoise", () => {
  it("descarta o que o navegador gera sozinho e ninguém consegue consertar", () => {
    for (const m of [
      "ResizeObserver loop completed with undelivered notifications.", "ResizeObserver loop limit exceeded", "Script error.", "Script error",
      "Non-Error promise rejection captured with value: Object Not Found Matching Id:2", "AbortError: The user aborted a request.", "The operation was aborted.",
      "Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "undefined", "null", "[object Object]", "   ",
    ]) expect(isNoise(m), m).toBe(true);
  });

  it("descarta pilha de extensão do navegador", () => {
    expect(isNoise("x is not a function", "Error\n    at chrome-extension://abc/content.js:1:1")).toBe(true);
    expect(isNoise("x is not a function", "Error\n    at moz-extension://abc/content.js:1:1")).toBe(true);
  });

  it("mantém o que é bug nosso, inclusive o de versão velha depois de um deploy", () => {
    expect(isNoise("TypeError: Cannot read properties of undefined (reading 'price')")).toBe(false);
    expect(isNoise("Failed to fetch dynamically imported module: https://x.com/assets/Dashboard-1.js")).toBe(false);
    expect(isNoise("Minified React error #310")).toBe(false);
  });
});

describe("errorKey", () => {
  it("ignora números (linha, coluna, id) para reconhecer o mesmo erro", () => {
    expect(errorKey("Erro 123 no item 9", "E\n    at f (a.js:10:5)")).toBe(errorKey("Erro 456 no item 1", "E\n    at f (a.js:99:12)"));
    expect(errorKey("Erro A")).not.toBe(errorKey("Erro B"));
  });
});

describe("createErrorReporter", () => {
  it("envia mensagem, pilha, origem, página e navegador", () => {
    const { report, send } = make();
    expect(report(boom("Algo quebrou"), "ErrorBoundary: at X")).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ message: "Algo quebrou", context: "ErrorBoundary: at X", route: "/pay/abc", ua: "UA/1" });
    expect(send.mock.calls[0][0].stack).toContain("at f (https://x.com/a.js");
  });

  it("aceita texto e objetos com message; sem pilha manda null", () => {
    const { report, send } = make();
    expect(report("falha solta", "unhandledrejection")).toBe(true);
    expect(report({ message: "veio de um objeto" }, "unhandledrejection")).toBe(true);
    expect(send.mock.calls[0][0]).toMatchObject({ message: "falha solta", stack: null });
    expect(send.mock.calls[1][0]).toMatchObject({ message: "veio de um objeto", stack: null });
    expect(report(undefined, "x")).toBe(false);
    expect(report(42, "x")).toBe(false);
  });

  it("não envia ruído nem o mesmo erro duas vezes na mesma página", () => {
    const { report, send } = make();
    expect(report(new Error("ResizeObserver loop limit exceeded"), "window.onerror")).toBe(false);
    expect(report(boom("Erro 1 no item 5"), "a")).toBe(true);
    expect(report(boom("Erro 2 no item 8"), "a")).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("para no limite por carga de página, para um laço de erros não virar enxurrada", () => {
    const { report, send } = make();
    for (let i = 0; i < 30; i++) report(boom(`Erro único ${"abcdefghijklmnopqrstuvwxyz"[i % 26]}${"zyxwvutsrqponmlkjihgfedcba"[Math.floor(i / 2) % 26]}`), "x");
    expect(send).toHaveBeenCalledTimes(MAX_REPORTS_PER_PAGE_LOAD);
    const small = make(undefined, 2);
    expect([small.report(boom("um"), "x"), small.report(boom("dois"), "x"), small.report(boom("três"), "x")]).toEqual([true, true, false]);
  });

  it("falha ao enviar nunca quebra o app (nem síncrona, nem assíncrona)", async () => {
    const rejecting = make(vi.fn().mockRejectedValue(new Error("rede caiu")));
    expect(() => rejecting.report(boom("primeiro"), "x")).not.toThrow();
    await Promise.resolve();
    const throwing = make(vi.fn(() => { throw new Error("explodiu"); }));
    expect(throwing.report(boom("segundo"), "x")).toBe(false);
  });

  it("corta textos longos antes de enviar", () => {
    const { report, send } = make();
    report(boom("m".repeat(900), `E\n${"s".repeat(5000)}`), "c".repeat(900));
    const sent = send.mock.calls[0][0];
    expect(sent.message.length).toBe(500);
    expect(sent.stack.length).toBe(2000);
    expect(sent.context.length).toBe(300);
  });
});

describe("reportClientError (instância do site)", () => {
  it("chama a função do banco com os argumentos certos e só o caminho da página", () => {
    window.history.pushState({}, "", "/pay/meu-link?token=segredo#x");
    expect(reportClientError(boom("Erro de teste do site"), "ErrorBoundary: at Y")).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe("log_client_error");
    expect(args).toMatchObject({ _message: "Erro de teste do site", _context: "ErrorBoundary: at Y", _route: "/pay/meu-link" });
    expect(JSON.stringify(args)).not.toContain("segredo");
    expect(typeof args._ua).toBe("string");
  });
});
