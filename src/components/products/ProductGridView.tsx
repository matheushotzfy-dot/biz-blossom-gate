import { ArrowUpRight, Copy, ExternalLink, MoreHorizontal, Package, Sparkles } from "lucide-react";

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
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product, i) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const isActive = product.status === "active";

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className={cn(
              "group relative flex cursor-pointer flex-col overflow-hidden rounded-[20px] border border-border/30 bg-card transition-all duration-300",
              "shadow-[0_1px_2px_hsl(var(--foreground)/0.03),0_4px_16px_hsl(var(--foreground)/0.04)]",
              "hover:border-border/60 hover:shadow-[0_4px_20px_hsl(var(--foreground)/0.08),0_16px_40px_hsl(var(--foreground)/0.06)]",
              "hover:-translate-y-[2px]"
            )}
          >
            {/* ── Cover / Thumbnail area ── */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary/60">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/80 via-secondary/40 to-accent/30">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/30 bg-card/80 shadow-sm backdrop-blur-sm">
                      <Package className="h-6 w-6 text-muted-foreground/40" strokeWidth={1.5} />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/40">
                      Sem imagem
                    </span>
                  </div>
                </div>
              )}

              {/* Overlay gradient on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              {/* Status floating badge */}
              <div className="absolute left-3 top-3">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Quick action floating */}
              <div
                className="absolute right-3 top-3 opacity-0 transition-all duration-200 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-8 w-8 rounded-xl bg-card/90 backdrop-blur-md border border-border/40 text-muted-foreground shadow-sm hover:bg-card hover:text-foreground hover:shadow-md transition-all"
                  {...handlers}
                />
              </div>
            </div>

            {/* ── Content area ── */}
            <div className="flex flex-1 flex-col gap-3 p-4 pb-5">
              {/* Title + delivery */}
              <div className="space-y-1">
                <h3 className="truncate font-display text-[16px] font-bold tracking-[-0.02em] text-foreground">
                  {product.name}
                </h3>
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60">
                  <Sparkles className="h-3 w-3" strokeWidth={1.8} />
                  {deliveryLabel}
                </p>
              </div>

              {/* Divider */}
              <div className="h-px w-full bg-border/30" />

              {/* Bottom row: price + type */}
              <div className="flex items-end justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/50">Preço</p>
                  <p className="font-numbers text-[20px] font-bold leading-none tracking-[-0.03em] text-foreground">
                    {formatCurrency(Number(product.price))}
                  </p>
                </div>
                <span className="mb-0.5 rounded-lg border border-primary/20 bg-primary/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary">
                  Autoral
                </span>
              </div>
            </div>

            {/* Active glow accent */}
            {isActive && (
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            )}
          </article>
        );
      })}
    </div>
  );
}
