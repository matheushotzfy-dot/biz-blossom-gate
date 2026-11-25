import { friendlyError } from "@/lib/friendlyError";

/**
 * Mensagem de erro de uma edge function chamada por `supabase.functions.invoke`.
 *
 * Quando a função responde 4xx/5xx o supabase-js não devolve `data`: o erro traz só o texto genérico
 * "Edge Function returned a non-2xx status code" e a resposta crua em `error.context`. As nossas funções
 * explicam o problema em `{ error: "..." }`, então é esse texto que a pessoa precisa ver.
 */
export async function functionErrorMessage(
  error: unknown,
  data?: unknown,
  fallback = "Não foi possível concluir a ação.",
): Promise<string> {
  const fromData = (data as { error?: unknown } | null | undefined)?.error;
  if (typeof fromData === "string" && fromData.trim()) return fromData.trim().slice(0, 200);

  const name = (error as { name?: unknown } | null)?.name;
  if (name === "FunctionsFetchError" || name === "FunctionsRelayError") return "Sem conexão com o servidor. Tente de novo.";

  const ctx = (error as { context?: unknown } | null)?.context as { json?: () => Promise<unknown>; clone?: () => { json: () => Promise<unknown> } } | undefined;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = (await (typeof ctx.clone === "function" ? ctx.clone() : ctx).json()) as { error?: unknown } | null;
      if (typeof body?.error === "string" && body.error.trim()) return body.error.trim().slice(0, 200);
    } catch { /* corpo ilegível: cai no texto padrão */ }
  }
  // O texto padrão do supabase-js para 4xx/5xx não diz nada à pessoa.
  if (/non-2xx|edge function/i.test(String((error as { message?: unknown } | null)?.message ?? ""))) return fallback;
  return friendlyError(error, fallback);
}
