import { Copy, ExternalLink, Eye } from "lucide-react";

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
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;
        const initial = product.name.charAt(0).toUpperCase();

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className={cn(
              "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/15 bg-card/80",
              "transition-all duration-200",
              "hover:border-border/30 hover:bg-card"
            )}
          >
            {/* ── Thumbnail ── */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary/20">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/40 to-secondary/10">
                  <span className="text-3xl font-black text-muted-foreground/10 select-none">
                    {initial}
                  </span>
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-60" />

              {/* Status */}
              <div className="absolute left-2 top-2 z-10">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Actions */}
              <div
                className="absolute right-2 top-2 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-6 w-6 rounded-md bg-background/70 backdrop-blur-sm border border-border/20 text-foreground/60 shadow-sm hover:bg-background hover:text-foreground"
                  {...handlers}
                />
              </div>

              {/* Hover preview button */}
              <div className="absolute inset-0 z-[5] flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border/20 shadow-sm">
                  <Eye className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.8} />
                </div>
              </div>
            </div>

            {/* ── Content ── */}
            <div className="flex flex-1 flex-col px-3 pt-2.5 pb-3">
              <h3 className="truncate text-[13px] font-semibold leading-tight text-foreground">
                {product.name}
              </h3>
              <span className="mt-0.5 text-[10px] text-muted-foreground/45">
                {deliveryLabel} · {formatCompactDate(product.created_at)}
              </span>

              {/* Footer */}
              <div className="mt-auto flex items-end justify-between pt-3">
                <span className="font-mono text-sm font-bold tabular-nums tracking-tight text-foreground">
                  {formatCurrency(Number(product.price))}
                </span>

                {/* Quick actions */}
                {checkoutLink && (
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handlers.onCopyLink(product)}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/35 transition-all hover:bg-secondary/60 hover:text-foreground",
                        copiedId === product.id && "text-primary bg-primary/10"
                      )}
                      title="Copiar link"
                    >
                      <Copy className="h-3 w-3" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => handlers.onOpenCheckout(product)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/35 transition-all hover:bg-secondary/60 hover:text-foreground"
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
