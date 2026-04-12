import { ChevronRight, Package } from "lucide-react";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCurrency, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className="group relative flex cursor-pointer items-start gap-4 overflow-hidden rounded-2xl border border-border/40 bg-card p-4 shadow-[0_1px_3px_hsl(var(--foreground)/0.04)] transition-all duration-200 hover:border-border/70 hover:shadow-[var(--card-shadow)]"
          >
            {/* Active accent bar */}
            {product.status === "active" && (
              <span className="absolute inset-y-0 left-0 w-[3px] bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
            )}

            {/* Thumbnail — bigger, rounder */}
            <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-border/40 bg-secondary/40 ring-1 ring-inset ring-foreground/[0.03]">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-7 w-7 text-muted-foreground/25" strokeWidth={1.4} />
                </div>
              )}
            </div>

            {/* Info — richer hierarchy */}
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">{product.name}</p>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground/70">{deliveryLabel}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ProductStatusIndicator status={product.status} tone="soft" />
                <span className="rounded-md border border-border/40 bg-secondary/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Autoral
                </span>
                <span className="ml-auto font-numbers text-[14px] font-bold tracking-[-0.02em] text-foreground/90">
                  {formatCurrency(Number(product.price))}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
              <ProductActionsMenu
                copied={copiedId === product.id}
                product={product}
                triggerClassName="h-8 w-8 rounded-lg text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
                {...handlers}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
