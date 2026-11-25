import { supabase } from "@/integrations/supabase/client";
import { readJson, removeKey, writeJson } from "./storage";

/**
 * Atribuição de afiliado no checkout.
 *
 * O link do afiliado é `<checkout>?aff=<slug>`. O navegador só guarda o slug e avisa o servidor do clique;
 * quem decide se o link vale, e qual `transactions.affiliate_link_id` gravar, é o servidor ao criar a cobrança
 * (`resolve_affiliate_link`, só service_role). Slug inválido, pausado ou de outro produto simplesmente não paga comissão.
 */
const SLUG_RE = /^[A-Za-z0-9_-]{3,64}$/;
/** Última visita vence (como nas outras plataformas) e vale por 30 dias neste navegador. */
export const AFFILIATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredAffiliate { slug: string; savedAt: number }

const memoryKey = (productId: string) => `vp-aff:${productId}`;
const clickKey = (productId: string, slug: string) => `vp-aff-click:${productId}:${slug}`;

export function parseAffiliateSlug(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = (params.get("aff") || params.get("ref") || "").trim();
  return SLUG_RE.test(raw) ? raw : null;
}

export function rememberAffiliate(productId: string, slug: string, now = Date.now()): void {
  writeJson("local", memoryKey(productId), { slug, savedAt: now } satisfies StoredAffiliate);
}

export function recallAffiliate(productId: string, now = Date.now()): string | null {
  const stored = readJson<StoredAffiliate>("local", memoryKey(productId));
  if (!stored || typeof stored.slug !== "string" || typeof stored.savedAt !== "number") return null;
  if (!SLUG_RE.test(stored.slug) || now - stored.savedAt > AFFILIATE_TTL_MS || stored.savedAt > now + 60_000) {
    removeKey("local", memoryKey(productId));
    return null;
  }
  return stored.slug;
}

/** Conta o clique uma vez por visita (aba): recarregar a página não infla o número do afiliado. */
export async function registerAffiliateClick(productId: string, slug: string): Promise<boolean> {
  if (readJson<boolean>("session", clickKey(productId, slug))) return false;
  writeJson("session", clickKey(productId, slug), true);
  try {
    const { data, error } = await supabase.rpc("register_affiliate_click", { _product_id: productId, _slug: slug });
    return !error && data === true;
  } catch {
    return false;
  }
}

/**
 * Resolve qual slug acompanha este pedido: o do link aberto agora, senão o lembrado de uma visita anterior.
 * Quando o link tem `?aff=`, ele passa a ser o lembrado (último clique vence) e o clique é contado.
 */
export function resolveAffiliateForVisit(productId: string, search: string): string | null {
  const fromUrl = parseAffiliateSlug(search);
  if (fromUrl) {
    rememberAffiliate(productId, fromUrl);
    void registerAffiliateClick(productId, fromUrl);
    return fromUrl;
  }
  return recallAffiliate(productId);
}
