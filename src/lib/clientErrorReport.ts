import { supabase } from "@/integrations/supabase/client";

/**
 * Envio de erros do navegador para o painel do admin (função `log_client_error`).
 *
 * O servidor já limpa dados sensíveis, junta repetições e limita o volume; aqui o navegador só evita
 * mandar lixo (ruído conhecido) e mandar demais (um erro dentro de um laço de renderização não pode virar enxurrada).
 */

/** Erros diferentes que uma mesma carga de página pode enviar. Passou disso, o resto é descartado. */
export const MAX_REPORTS_PER_PAGE_LOAD = 8;

/** Mensagens que o navegador gera sozinho e que ninguém consegue consertar no nosso código. */
const NOISE_MESSAGE: RegExp[] = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /^Non-Error promise rejection captured/i,
  /AbortError/i,
  /The (user aborted a request|operation was aborted)/i,
  // queda de conexão do próprio usuário (não confundir com "Failed to fetch dynamically imported module", que é bug de versão)
  /^(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?)$/i,
  // rejeição sem nenhuma informação para investigar
  /^(undefined|null|\[object Object\])$/,
];

/** Pilha que vem de extensão do navegador do usuário (tradutor, bloqueador…). */
const EXTENSION_STACK = /(?:chrome|moz|safari-web|safari)-extension:\/\//i;

export function isNoise(message: string, stack?: string | null): boolean {
  const m = message.trim();
  if (!m) return true;
  if (NOISE_MESSAGE.some((re) => re.test(m))) return true;
  return !!stack && EXTENSION_STACK.test(stack);
}

/** Identifica "o mesmo erro" dentro de uma página: mensagem e primeira linha da pilha, sem números. */
export function errorKey(message: string, stack?: string | null): string {
  const firstFrame = (stack ?? "").split("\n").slice(0, 2).join("|");
  return `${message}|${firstFrame}`.replace(/\d+/g, "#");
}

export interface ErrorReport { message: string; stack: string | null; context: string; route: string; ua: string }

export interface ReporterOptions {
  send: (report: ErrorReport) => PromiseLike<unknown> | unknown;
  route: () => string;
  ua: () => string;
  max?: number;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message;
  return "";
}

/** Cria o enviador: filtra ruído, não repete o mesmo erro e para no limite. Devolve `true` quando mandou. */
export function createErrorReporter({ send, route, ua, max = MAX_REPORTS_PER_PAGE_LOAD }: ReporterOptions) {
  const seen = new Set<string>();
  return function report(error: unknown, context: string): boolean {
    try {
      const message = readMessage(error).trim().slice(0, 500);
      const stack = error instanceof Error && error.stack ? error.stack.slice(0, 2000) : null;
      if (isNoise(message, stack)) return false;
      const key = errorKey(message, stack);
      if (seen.has(key) || seen.size >= max) return false;
      seen.add(key);
      // falha ao registrar nunca pode quebrar o app (nem virar outro erro para registrar)
      Promise.resolve(send({ message, stack, context: context.slice(0, 300), route: route(), ua: ua() })).catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  };
}

export const reportClientError = createErrorReporter({
  send: (r) => supabase.rpc("log_client_error" as never, { _message: r.message, _stack: r.stack, _context: r.context, _route: r.route, _ua: r.ua } as never),
  // só o caminho: a query pode ter token, e o servidor também descarta o que vem depois de ? e #
  route: () => (typeof window === "undefined" ? "" : window.location.pathname),
  ua: () => (typeof navigator === "undefined" ? "" : navigator.userAgent),
});
