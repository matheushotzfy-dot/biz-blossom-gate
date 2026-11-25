/**
 * Endereços que vêm do banco (checkout de produto, comprovantes, links de rastreio…) podem ter sido
 * gravados por outra pessoa. `window.open("javascript:…")` e `<a href="javascript:…">` executam código
 * na página de quem clica, então nada que não tenha sido escrito por nós vai direto para um desses lugares.
 */

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/** Devolve a URL se for http(s) absoluta ou caminho do próprio site; caso contrário, null. */
export function safeNavigationUrl(raw: string | null | undefined, base: string = typeof window === "undefined" ? "https://localhost" : window.location.origin): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || hasControlCharacter(value)) return null;
  if (value.startsWith("//") || value.includes("\\")) return null; // protocolo relativo / barra invertida
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Abre em nova aba sem dar à página aberta acesso a esta (noopener) nem ao endereço de origem (noreferrer). */
export function openExternal(raw: string | null | undefined): boolean {
  const url = safeNavigationUrl(raw);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
