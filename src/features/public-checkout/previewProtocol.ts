import { normalizeProduct, toCheckoutBump } from "./loadCheckout";
import type { CheckoutBump, CheckoutProduct } from "./types";

/**
 * Conversa entre o construtor de checkout e a prévia (`/checkout-preview`, num iframe da mesma origem).
 * O construtor manda o produto no MESMO formato da linha de `products_public` e as ofertas como linhas de produto;
 * a prévia passa tudo pelas mesmas funções do checkout de verdade (`normalizeProduct`, `toCheckoutBump`),
 * então o que aparece é o que o comprador vê, inclusive os limites (timer 1–60, cor só hex, formas só as liberadas).
 */
export const PREVIEW_PATH = "/checkout-preview";
export const PREVIEW_UPDATE = "vp-ck-preview:update";
export const PREVIEW_READY = "vp-ck-preview:ready";

export type PreviewProductRow = {
  id: string;
  name: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  display_name: string | null;
  checkout_button_color: string | null;
  checkout_theme: string | null;
  checkout_timer_enabled: boolean;
  checkout_timer_minutes: number | null;
  checkout_banner_desktop_url: string | null;
  checkout_banner_mobile_url: string | null;
  checkout_guarantee_enabled: boolean;
  checkout_address_required: boolean;
  checkout_email_confirm: boolean;
  checkout_pix_enabled: boolean;
  checkout_credit_card_enabled: boolean;
  checkout_boleto_enabled: boolean;
};

export type PreviewBumpRow = { bumpId: string; id: string; name: string | null; description: string | null; price: number; image_url: string | null };

export interface PreviewUpdate {
  type: typeof PREVIEW_UPDATE;
  product: PreviewProductRow;
  bumps: PreviewBumpRow[];
}

export interface PreviewData {
  product: CheckoutProduct;
  bumps: CheckoutBump[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Lê a mensagem do construtor. Qualquer coisa fora do formato é ignorada (null). */
export function readPreviewUpdate(data: unknown): PreviewData | null {
  if (!isObject(data) || data.type !== PREVIEW_UPDATE || !isObject(data.product) || typeof data.product.id !== "string") return null;
  const product = normalizeProduct(data.product);
  const rows = Array.isArray(data.bumps) ? data.bumps.slice(0, 5) : [];
  const bumps = rows.flatMap((row) => {
    if (!isObject(row) || typeof row.bumpId !== "string") return [];
    const bump = toCheckoutBump(row.bumpId, row, product.id);
    return bump ? [bump] : [];
  });
  return { product, bumps };
}

/** Só aceita mensagem da própria página que abriu a prévia, na mesma origem. */
export function isTrustedPreviewMessage(event: Pick<MessageEvent, "origin" | "source">, own: { origin: string; parent: unknown }): boolean {
  return event.origin === own.origin && event.source === own.parent && own.parent !== null;
}
