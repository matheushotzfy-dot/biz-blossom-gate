import { ExternalLink, Sparkles } from "lucide-react";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCurrency, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

/* Accent color combos for placeholder covers */
const ACCENT_PAIRS = [
  { bg: "from-emerald-500/20 to-emerald-900/40", icon: "text-emerald-400", ring: "ring-emerald-500/20" },
  { bg: "from-sky-500/20 to-sky-900/40", icon: "text-sky-400", ring: "ring-sky-500/20" },
  { bg: "from-violet-500/20 to-violet-900/40", icon: "text-violet-400", ring: "ring-violet-500/20" },
  { bg: "from-amber-500/15 to-amber-900/35", icon: "text-amber-400", ring: "ring-amber-500/20" },
  { bg: "from-rose-500/15 to-rose-900/35", icon: "text-rose-400", ring: "ring-rose-500/20" },
  { bg: "from-cyan-500/20 to-cyan-900/40", icon: "text-cyan-400", ring: "ring-cyan-500/20" },
];

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product, i) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const isActive = product.status === "active";
        const accent = ACCENT_PAIRS[i % ACCENT_PAIRS.length];
        const initial = product.name.charAt(0).toUpperCase();

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className={cn(
              "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/10 bg-card/80 backdrop-blur-sm",
              "transition-all duration-300 ease-out",
              "hover:border-border/25 hover:bg-card hover:shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.08)]",
              "hover:-translate-y-0.5"
            )}
          >
            {/* ── Cover ── */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary/20">
              {product.image_url ? (
                <>
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  {/* Bottom fade for text readability */}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card/90 to-transparent" />
                </>
              ) : (
                /* Minimal gradient placeholder */
                <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", accent.bg)}>
                  {/* Subtle grid pattern */}
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
                      backgroundSize: "32px 32px",
                    }}
                  />
                  {/* Large initial */}
                  <span className={cn("relative text-[64px] font-black tracking-tighter opacity-30", accent.icon)}>
                    {initial}
                  </span>
                </div>
              )}

              {/* Status chip */}
              <div className="absolute left-3 top-3 z-10">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Actions menu — hover reveal */}
              <div
                className="absolute right-3 top-3 z-10 opacity-0 transition-all duration-200 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-8 w-8 rounded-lg bg-background/70 backdrop-blur-md border border-border/20 text-foreground/70 shadow-sm hover:bg-background hover:text-foreground transition-all"
                  {...handlers}
                />
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 flex-col gap-3 p-4">
              {/* Title + type */}
              <div className="space-y-1">
                <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
                  {product.name}
                </h3>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/50">
                  <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                  {deliveryLabel}
                </div>
              </div>

              {/* Price row */}
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="font-numbers text-[20px] font-bold tracking-tight text-foreground">
                  {formatCurrency(Number(product.price))}
                </span>
                {product.checkout_url && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                )}
              </div>
            </div>

            {/* Bottom accent on hover */}
            {isActive && (
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </article>
        );
      })}
    </div>
  );
}
