import { Copy, ExternalLink, Eye, Package, Calendar, Users, Crosshair, TrendingUp } from "lucide-react";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCurrency, formatCompactDate, getCheckoutLink, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;
        const initial = product.name.charAt(0).toUpperCase();
        const hasAffiliate = product.affiliate_enabled;

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className={cn(
              "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl",
              "border border-border/15 bg-gradient-to-b from-card/95 to-card/80 backdrop-blur-sm",
              "shadow-[0_2px_16px_hsl(var(--background)/0.25),inset_0_1px_0_hsl(var(--foreground)/0.03)]",
              "transition-all duration-300 ease-out",
              "hover:border-primary/15 hover:shadow-[0_12px_40px_hsl(var(--primary)/0.08),0_4px_16px_hsl(var(--background)/0.4)] hover:-translate-y-1"
            )}
          >
            {/* ── Thumbnail ── */}
            <div className="relative aspect-[16/9] w-full overflow-hidden">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/8 via-secondary/30 to-secondary/10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/10 bg-card/60 backdrop-blur-md shadow-inner">
                    <span className="font-display text-2xl font-black text-primary/25 select-none">
                      {initial}
                    </span>
                  </div>
                </div>
              )}

              {/* Bottom gradient fade */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />

              {/* Status badge */}
              <div className="absolute left-2.5 top-2.5 z-10">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Actions menu (top right on hover) */}
              <div
                className="absolute right-2.5 top-2.5 z-10 opacity-0 transition-all duration-200 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-7 w-7 rounded-lg bg-background/80 backdrop-blur-md border border-border/25 text-foreground/70 shadow-lg hover:bg-background hover:text-foreground"
                  {...handlers}
                />
              </div>

              {/* Hover overlay with preview icon */}
              <div className="absolute inset-0 z-[5] flex items-center justify-center bg-background/10 opacity-0 transition-all duration-300 group-hover:opacity-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/85 backdrop-blur-lg border border-border/30 shadow-xl transition-transform duration-300 scale-75 group-hover:scale-100">
                  <Eye className="h-4 w-4 text-foreground/80" strokeWidth={1.8} />
                </div>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 flex-col px-4 pt-3 pb-3.5">
              {/* Title & description */}
              <h3 className="truncate font-display text-sm font-bold leading-tight tracking-tight text-foreground">
                {product.name}
              </h3>
              {product.description ? (
                <p className="mt-0.5 truncate text-[10px] leading-relaxed text-muted-foreground/50">
                  {product.description}
                </p>
              ) : (
                <p className="mt-0.5 text-[10px] italic text-muted-foreground/30">Sem descrição</p>
              )}

              {/* Tags row */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md border border-border/15 bg-secondary/40 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground/60">
                  <Package className="h-2.5 w-2.5" strokeWidth={2} />
                  {deliveryLabel}
                </span>
                {hasAffiliate && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/10 bg-primary/5 px-2 py-0.5 text-[9px] font-semibold text-primary/60">
                    <Users className="h-2.5 w-2.5" strokeWidth={2} />
                    {product.affiliate_commission}%
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="my-2.5 h-px bg-gradient-to-r from-transparent via-border/15 to-transparent" />

              {/* Price row */}
              <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="font-numbers text-lg font-black tabular-nums tracking-tight text-success">
                    {formatCurrency(Number(product.price))}
                  </span>
                </div>

                {/* Quick action icons */}
                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handlers.onOpenPixels(product)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/25 transition-all duration-150 hover:bg-secondary/60 hover:text-foreground"
                    title="Pixels & Tracking"
                  >
                    <Crosshair className="h-3 w-3" strokeWidth={2} />
                  </button>
                  {checkoutLink && (
                    <>
                      <button
                        onClick={() => handlers.onCopyLink(product)}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150",
                          copiedId === product.id
                            ? "text-success bg-success/10 ring-1 ring-success/20"
                            : "text-muted-foreground/25 hover:bg-secondary/60 hover:text-foreground"
                        )}
                        title="Copiar link"
                      >
                        <Copy className="h-3 w-3" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => handlers.onOpenCheckout(product)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/25 transition-all duration-150 hover:bg-secondary/60 hover:text-foreground"
                        title="Abrir checkout"
                      >
                        <ExternalLink className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Date footer */}
              <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground/30">
                <Calendar className="h-2.5 w-2.5" strokeWidth={2} />
                Criado em {formatCompactDate(product.created_at)}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
