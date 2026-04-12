import { Package, Sparkles } from "lucide-react";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCurrency, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

/* Unique gradient combos so every card feels like a photo, not a grey box */
const COVER_GRADIENTS = [
  "from-primary/25 via-primary/10 to-accent/20",
  "from-info/25 via-info/10 to-primary/15",
  "from-chart-2/25 via-chart-2/10 to-info/15",
  "from-warning/20 via-warning/8 to-primary/12",
  "from-accent/25 via-primary/10 to-info/15",
  "from-chart-4/20 via-chart-4/8 to-primary/12",
];

/* Decorative mesh dots pattern */
function MeshPattern() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="mesh" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mesh)" className="text-foreground" />
    </svg>
  );
}

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product, i) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const isActive = product.status === "active";
        const gradient = COVER_GRADIENTS[i % COVER_GRADIENTS.length];

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className={cn(
              "group relative flex cursor-pointer flex-col overflow-hidden rounded-[20px] border border-border/25 bg-card transition-all duration-300",
              "shadow-[0_1px_2px_hsl(var(--foreground)/0.02),0_4px_16px_hsl(var(--foreground)/0.03)]",
              "hover:border-primary/25 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.08),0_2px_8px_hsl(var(--foreground)/0.05)]",
              "hover:-translate-y-1"
            )}
          >
            {/* ── Cover ── */}
            <div className="relative aspect-[2/1] w-full overflow-hidden">
              {product.image_url ? (
                <>
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                  />
                  {/* Cinematic vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-40" />
                </>
              ) : (
                /* Rich gradient cover instead of boring grey */
                <div className={cn("relative flex h-full w-full items-end justify-start bg-gradient-to-br p-5", gradient)}>
                  <MeshPattern />
                  {/* Floating decorative blobs */}
                  <div className="absolute right-6 top-6 h-16 w-16 rounded-full bg-primary/10 blur-2xl" />
                  <div className="absolute bottom-4 left-1/2 h-12 w-24 rounded-full bg-foreground/[0.03] blur-xl" />
                  {/* Product initial as hero element */}
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-foreground/[0.06] bg-card/70 shadow-lg backdrop-blur-md">
                      <span className="font-display text-[18px] font-black text-foreground/70">
                        {product.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/30">
                        Produto
                      </span>
                      <span className="text-[11px] font-semibold text-foreground/50">
                        {deliveryLabel}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Status pill — always visible */}
              <div className="absolute left-3 top-3 z-10">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Actions — appear on hover */}
              <div
                className="absolute right-3 top-3 z-10 translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-8 w-8 rounded-xl bg-card/80 backdrop-blur-lg border border-border/30 text-foreground/60 shadow-lg hover:bg-card hover:text-foreground transition-all"
                  {...handlers}
                />
              </div>
            </div>

            {/* ── Content ── */}
            <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
              <h3 className="truncate font-display text-[16px] font-bold tracking-[-0.02em] text-foreground">
                {product.name}
              </h3>

              {product.image_url && (
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/55">
                  <Sparkles className="h-3 w-3 text-primary/50" strokeWidth={1.8} />
                  {deliveryLabel}
                </p>
              )}

              {/* Price bar */}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-border/20 bg-secondary/30 px-3.5 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
                  Preço
                </span>
                <span className="font-numbers text-[18px] font-bold leading-none tracking-[-0.02em] text-foreground">
                  {formatCurrency(Number(product.price))}
                </span>
              </div>
            </div>

            {/* Bottom accent line */}
            {isActive && (
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </article>
        );
      })}
    </div>
  );
}
