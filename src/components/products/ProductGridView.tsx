import {
  Calendar,
  Crosshair,
  ExternalLink,
  Package,
  Palette,
  Users,
} from "lucide-react";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCurrency, formatCompactDate, getCheckoutLink, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

const quickActionClassName =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/18 bg-secondary/24 px-3 text-[11.5px] font-semibold text-foreground/72 transition-all duration-200 hover:border-primary/18 hover:bg-primary/6 hover:text-foreground";

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;
        const initial = product.name.charAt(0).toUpperCase();
        const hasAffiliate = product.affiliate_enabled;
        const price = Number(product.price);
        const secondaryActionLabel = checkoutLink ? "Checkout" : "Builder";

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className={cn(
              "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[26px] border border-border/20 bg-card/95",
              "shadow-[0_18px_40px_-30px_hsl(var(--foreground)/0.55),inset_0_1px_0_hsl(var(--foreground)/0.04)]",
              "transition-all duration-300",
              "hover:-translate-y-1 hover:border-primary/18 hover:shadow-[0_32px_80px_-42px_hsl(var(--foreground)/0.58),0_14px_36px_-28px_hsl(var(--primary)/0.18)]"
            )}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/5 to-transparent opacity-80" />

            <div className="relative aspect-[16/9] overflow-hidden border-b border-border/12 bg-secondary/30">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/60 via-secondary/25 to-primary/6">
                  <div
                    className="absolute inset-0 opacity-[0.035]"
                    style={{
                      backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
                      backgroundSize: "22px 22px",
                    }}
                  />
                  <div className="relative flex h-18 w-18 items-center justify-center rounded-[20px] border border-border/16 bg-card/85 shadow-[0_16px_40px_-24px_hsl(var(--foreground)/0.45)]">
                    <span className="font-display text-[30px] font-black tracking-[-0.06em] text-primary/65">{initial}</span>
                  </div>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-background/75 via-background/10 to-transparent" />

              <div className="absolute left-3 top-3">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/18 bg-background/72 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/72 backdrop-blur-xl">
                  <Package className="h-2.5 w-2.5" strokeWidth={2.2} />
                  {deliveryLabel}
                </span>
                {checkoutLink ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/15 bg-success/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-success backdrop-blur-xl">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Checkout no ar
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-1 flex-col p-4">
              <div className="min-h-[74px]">
                <h3 className="truncate font-display text-[16px] font-black tracking-[-0.03em] text-foreground transition-colors duration-200 group-hover:text-primary/90">
                  {product.name}
                </h3>
                <p className="mt-1 max-h-10 overflow-hidden text-[12px] leading-5 text-muted-foreground/62">
                  {product.description || "Sem descrição adicionada"}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-[1.35fr_1fr] gap-2.5">
                <div className="rounded-2xl border border-border/18 bg-secondary/28 p-3">
                  <p className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/44">Valor</p>
                  <div className="mt-1.5 flex items-end gap-1.5">
                    <span className="font-numbers text-[26px] font-black tracking-[-0.05em] text-success">
                      {formatCurrency(price)}
                    </span>
                    <span className="pb-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/28">BRL</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground/50">
                    {hasAffiliate ? `${product.affiliate_commission}% para afiliados` : "Venda direta"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/18 bg-secondary/18 p-3">
                  <p className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/44">Publicação</p>
                  <p className={cn("mt-1.5 text-[13px] font-semibold", checkoutLink ? "text-foreground" : "text-muted-foreground")}>
                    {checkoutLink ? "Publicado" : "Em preparo"}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground/50">
                    {hasAffiliate ? "Afiliados ativos" : "Sem afiliação"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {hasAffiliate ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/6 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                    <Users className="h-2.5 w-2.5" strokeWidth={2} />
                    Afiliados
                  </span>
                ) : null}
                <span className="inline-flex items-center rounded-full border border-border/16 bg-secondary/16 px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground/46">
                  ID #{product.id.slice(0, 6)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handlers.onOpenPixels(product)}
                  className={quickActionClassName}
                >
                  <Crosshair className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Pixels
                </button>

                <button
                  type="button"
                  onClick={() =>
                    checkoutLink
                      ? handlers.onOpenCheckout(product)
                      : window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`)
                  }
                  className={quickActionClassName}
                >
                  {checkoutLink ? <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} /> : <Palette className="h-3.5 w-3.5" strokeWidth={1.8} />}
                  {secondaryActionLabel}
                </button>

                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerLabel="Ações"
                  triggerClassName="h-10 w-full rounded-xl border border-border/18 bg-secondary/24 text-foreground/72 hover:border-primary/18 hover:bg-primary/6 hover:text-foreground"
                  {...handlers}
                />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/12 pt-3 text-[10px] text-muted-foreground/34">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" strokeWidth={2} />
                  {formatCompactDate(product.created_at)}
                </span>
                <span className="font-heading uppercase tracking-[0.18em]">{deliveryLabel}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
