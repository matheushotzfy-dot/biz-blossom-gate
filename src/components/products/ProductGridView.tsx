import { Copy, ExternalLink, Eye, Package, Calendar, Users } from "lucide-react";

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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              "border border-border/20 bg-card/90 backdrop-blur-sm",
              "shadow-[0_2px_12px_hsl(var(--background)/0.3)]",
              "transition-all duration-300 ease-out",
              "hover:border-border/40 hover:bg-card hover:shadow-[0_8px_30px_hsl(var(--background)/0.5)] hover:-translate-y-0.5"
            )}
          >
            {/* ── Thumbnail ── */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary/20">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/50 to-secondary/15">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/10 bg-card/50 backdrop-blur-sm">
                    <span className="text-2xl font-black text-muted-foreground/20 select-none">
                      {initial}
                    </span>
                  </div>
                </div>
              )}

              {/* Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card/60 to-transparent" />

              {/* Status badge */}
              <div className="absolute left-2.5 top-2.5 z-10">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Delivery type pill */}
              <div className="absolute right-2.5 top-2.5 z-10 opacity-0 transition-all duration-200 group-hover:opacity-100">
                <span className="inline-flex items-center rounded-md bg-background/70 backdrop-blur-sm border border-border/20 px-2 py-0.5 text-[9px] font-semibold text-foreground/70 shadow-sm">
                  {deliveryLabel}
                </span>
              </div>

              {/* Actions menu */}
              <div
                className="absolute right-2.5 bottom-2.5 z-10 opacity-0 transition-all duration-200 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-7 w-7 rounded-lg bg-background/70 backdrop-blur-sm border border-border/20 text-foreground/60 shadow-sm hover:bg-background hover:text-foreground"
                  {...handlers}
                />
              </div>

              {/* Hover preview button */}
              <div className="absolute inset-0 z-[5] flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80 backdrop-blur-md border border-border/25 shadow-lg transition-transform duration-200 group-hover:scale-100 scale-90">
                  <Eye className="h-4 w-4 text-foreground/70" strokeWidth={1.8} />
                </div>
              </div>
            </div>

            {/* ── Content ── */}
            <div className="flex flex-1 flex-col px-3.5 pt-3 pb-2">
              <h3 className="truncate text-[13px] font-bold leading-tight text-foreground tracking-tight">
                {product.name}
              </h3>
              {product.description && (
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground/50 leading-relaxed">
                  {product.description}
                </p>
              )}

              {/* Meta info row */}
              <div className="mt-2 flex items-center gap-2.5 text-[9px] text-muted-foreground/40">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" strokeWidth={2} />
                  {formatCompactDate(product.created_at)}
                </span>
                {hasAffiliate && (
                  <span className="inline-flex items-center gap-1 text-primary/50">
                    <Users className="h-2.5 w-2.5" strokeWidth={2} />
                    {product.affiliate_commission}%
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="my-2 h-px bg-border/10" />

              {/* Footer */}
              <div className="flex items-end justify-between">
                <div>
                  <span className="font-mono text-sm font-black tabular-nums tracking-tight text-foreground">
                    {formatCurrency(Number(product.price))}
                  </span>
                  <span className="ml-1.5 text-[9px] text-muted-foreground/35">BRL</span>
                </div>

                {/* Quick actions */}
                {checkoutLink && (
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handlers.onCopyLink(product)}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150",
                        copiedId === product.id
                          ? "text-primary bg-primary/10 ring-1 ring-primary/20"
                          : "text-muted-foreground/30 hover:bg-secondary/60 hover:text-foreground"
                      )}
                      title="Copiar link"
                    >
                      <Copy className="h-3 w-3" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => handlers.onOpenCheckout(product)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/30 transition-all duration-150 hover:bg-secondary/60 hover:text-foreground"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
