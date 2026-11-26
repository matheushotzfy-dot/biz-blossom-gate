/** Regras e mensagens de order bump, iguais no editor de produto e no construtor de checkout. O banco confere tudo de novo (`guard_order_bump`). */
export const MAX_ORDER_BUMPS = 5;

/** Traduz a recusa do banco ao adicionar uma oferta. */
export function orderBumpError(error: { message?: string; code?: string } | null | undefined): string {
  const message = String(error?.message ?? "");
  if (error?.code === "23505" || /duplicate key/i.test(message)) return "Esse produto já está nas ofertas.";
  if (message.includes("order_bump_limit")) return `Cada produto pode ter até ${MAX_ORDER_BUMPS} order bumps.`;
  if (message.includes("order_bump_not_owner")) return "Só dá para oferecer produtos da sua conta.";
  if (message.includes("order_bump_self")) return "O produto não pode ser oferta dele mesmo.";
  if (message.includes("order_bump_product_not_found")) return "Esse produto não existe mais. Atualize a página.";
  return "Não foi possível adicionar o order bump. Tente de novo.";
}

/** Endereço público com a versão do envio: o arquivo é regravado no mesmo caminho e sem isso o navegador mostra o antigo. */
export const withVersion = (url: string, now = Date.now()): string => `${url.split("?")[0]}?v=${now}`;
