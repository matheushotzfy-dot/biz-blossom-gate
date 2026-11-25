import { supabase } from "@/integrations/supabase/client";
import type { PixelConfig } from "@/lib/pixelTracking";
import { safeCheckoutSlug } from "./slug";
import { resolveThemeMode } from "./theme";
import type { CheckoutBump, CheckoutLoad, CheckoutMethod, CheckoutProduct } from "./types";

type Row = Record<string, unknown>;

const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** O endereço do checkout termina no slug (`/pay/<slug>`, `/checkout/<slug>` ou só o slug). `like` trata "_" como curinga, então conferimos de novo. */
export function checkoutUrlMatches(checkoutUrl: unknown, slug: string): boolean {
  if (typeof checkoutUrl !== "string") return false;
  const url = checkoutUrl.trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  return url === slug || url === `/${slug}` || url.endsWith(`/pay/${slug}`) || url.endsWith(`/checkout/${slug}`);
}

export function normalizeProduct(row: Row): CheckoutProduct {
  const methods: CheckoutMethod[] = [];
  if (row.checkout_pix_enabled) methods.push("pix");
  if (row.checkout_credit_card_enabled) methods.push("credit_card");
  if (row.checkout_boleto_enabled) methods.push("boleto");
  const minutes = Math.round(num(row.checkout_timer_minutes));
  return {
    id: String(row.id),
    name: str(row.name) ?? "Produto",
    description: str(row.description),
    price: num(row.price),
    imageUrl: str(row.image_url),
    sellerName: str(row.display_name),
    buttonColor: str(row.checkout_button_color),
    theme: resolveThemeMode(str(row.checkout_theme)),
    timerEnabled: Boolean(row.checkout_timer_enabled),
    timerMinutes: minutes >= 1 && minutes <= 60 ? minutes : 15,
    bannerDesktopUrl: str(row.checkout_banner_desktop_url),
    bannerMobileUrl: str(row.checkout_banner_mobile_url),
    guaranteeEnabled: Boolean(row.checkout_guarantee_enabled),
    addressRequired: Boolean(row.checkout_address_required),
    emailConfirm: Boolean(row.checkout_email_confirm),
    methods,
  };
}

export async function loadCheckout(rawSlug: string | undefined): Promise<CheckoutLoad> {
  const slug = safeCheckoutSlug(rawSlug);
  if (!slug) return { kind: "closed", linkStatus: null };

  const { data: rows, error } = await supabase
    .from("products_public")
    .select("*")
    .or(`checkout_url.like.%/pay/${slug},checkout_url.like.%/checkout/${slug},checkout_url.eq.${slug},checkout_url.eq./${slug}`)
    .limit(5);
  if (error) throw error;

  const row = (rows ?? []).find((candidate) => checkoutUrlMatches((candidate as Row).checkout_url, slug)) as Row | undefined;
  if (!row || (typeof row.status === "string" && row.status !== "active")) {
    // Só o status vem do servidor (nenhum dado do produto): é o que explica por que o link está fechado.
    const { data: status } = await supabase.rpc("get_product_link_status", { _slug: slug });
    return { kind: "closed", linkStatus: typeof status === "string" ? status : typeof row?.status === "string" ? row.status : null };
  }

  const product = normalizeProduct(row);
  const [pixelsRes, bumpsRes] = await Promise.all([
    supabase.from("product_pixels_public").select("*").eq("product_id", product.id).eq("is_active", true),
    supabase.from("order_bumps").select("id, bump_product_id").eq("product_id", product.id).eq("is_active", true).order("sort_order"),
  ]);

  // Pixel ou oferta extra que falham não podem derrubar a compra: o checkout abre sem eles.
  const pixels: PixelConfig[] = (pixelsRes.data ?? []).map((item) => ({ ...item, events: Array.isArray(item.events) ? item.events : [] }) as unknown as PixelConfig);

  let bumps: CheckoutBump[] = [];
  const bumpRows = bumpsRes.data ?? [];
  if (bumpRows.length > 0) {
    const { data: bumpProducts } = await supabase
      .from("products_public")
      .select("id, name, description, price, image_url")
      .in("id", bumpRows.map((b) => b.bump_product_id))
      .eq("status", "active");
    bumps = bumpRows.flatMap((b) => {
      const item = (bumpProducts ?? []).find((p) => p.id === b.bump_product_id) as Row | undefined;
      if (!item || item.id === product.id || num(item.price) <= 0) return [];
      return [{ id: String(b.id), productId: String(item.id), name: str(item.name) ?? "Oferta", description: str(item.description), price: num(item.price), imageUrl: str(item.image_url) }];
    });
  }

  return { kind: "ready", product, bumps, pixels };
}
