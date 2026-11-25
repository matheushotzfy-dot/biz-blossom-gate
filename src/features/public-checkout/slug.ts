/**
 * O slug vem da URL e entra num filtro do PostgREST. Só aceitamos o mesmo formato que o servidor aceita
 * (get_product_link_status): letras, números, "_" e "-". Um slug com outro caractere NÃO é "limpo" para
 * casar com outro produto: é rejeitado.
 */
const SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function safeCheckoutSlug(raw: string | undefined | null): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return SLUG_RE.test(value) ? value : null;
}
