import { Package } from "lucide-react";

import { cn } from "@/lib/utils";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, type Product } from "./productPresentation";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className="group flex cursor-pointer items-start gap-4 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:bg-accent/40"
          >
            {/* Thumbnail */}
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-secondary/50">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground/30" strokeWidth={1.5} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-foreground">{product.name}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{deliveryLabel}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <ProductStatusIndicator status={product.status} tone="soft" />
                <span className="rounded-md border border-border/50 bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Autoral
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <ProductActionsMenu
                copied={copiedId === product.id}
                product={product}
                triggerClassName="h-8 w-8 rounded-lg text-muted-foreground/50 hover:bg-secondary hover:text-foreground"
                {...handlers}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
