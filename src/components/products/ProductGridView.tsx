import { Copy, ExternalLink, MoreHorizontal, Sparkles } from "lucide-react";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCurrency, getCheckoutLink, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

/* Accent color combos for placeholder covers */
const ACCENT_PAIRS = [
  { bg: "from-primary/20 to-primary/5", icon: "text-primary" },
  { bg: "from-info/20 to-info/5", icon: "text-info" },
  { bg: "from-warning/15 to-warning/5", icon: "text-warning" },
  { bg: "from-success/20 to-success/5", icon: "text-success" },
  { bg: "from-destructive/15 to-destructive/5", icon: "text-destructive" },
  { bg: "from-info/20 to-primary/5", icon: "text-info" },
];

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product, i) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const accent = ACCENT_PAIRS[i % ACCENT_PAIRS.length];
        const initial = product.name.charAt(0).toUpperCase();
        const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className={cn(
              "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/40 bg-card",
              "transition-all duration-300 ease-out",
              "hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5",
              "hover:-translate-y-0.5"
            )}
          >
            {/* ── Cover — compact ── */}
            <div className="relative h-32 w-full overflow-hidden bg-secondary/10">
              {product.image_url ? (
                <>
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/60 via-transparent to-transparent" />
                </>
              ) : (
                <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", accent.bg)}>
                  <span className={cn("text-[48px] font-black tracking-tighter opacity-25 select-none", accent.icon)}>
                    {initial}
                  </span>
                </div>
              )}

              {/* Status chip */}
              <div className="absolute left-2.5 top-2.5 z-10">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Actions menu — always visible */}
              <div
                className="absolute right-2.5 top-2.5 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-7 w-7 rounded-lg bg-background/80 backdrop-blur-md border border-border/30 text-foreground/60 shadow-sm hover:bg-background hover:text-foreground transition-all"
                  {...handlers}
                />
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 flex-col p-3.5">
              {/* Title + type */}
              <h3 className="truncate text-[14px] font-semibold leading-tight tracking-tight text-foreground mb-0.5">
                {product.name}
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/50 mb-3">
                <Sparkles className="h-2.5 w-2.5" strokeWidth={1.5} />
                {deliveryLabel}
              </div>

              {/* Price + quick actions */}
              <div className="mt-auto flex items-center justify-between">
                <span className="font-numbers text-lg font-bold tracking-tight text-foreground">
                  {formatCurrency(Number(product.price))}
                </span>

                {/* Quick action buttons — always visible */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {checkoutLink && (
                    <>
                      <button
                        onClick={() => handlers.onCopyLink(product)}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 transition-all hover:bg-primary/10 hover:text-primary",
                          copiedId === product.id && "text-primary bg-primary/10"
                        )}
                        title="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => handlers.onOpenCheckout(product)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 transition-all hover:bg-primary/10 hover:text-primary"
                        title="Abrir checkout"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
