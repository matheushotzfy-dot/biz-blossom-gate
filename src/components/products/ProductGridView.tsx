import {
  Calendar,
  Copy,
  ExternalLink,
  Package,
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

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;
        const initial = product.name.charAt(0).toUpperCase();
        const price = Number(product.price);

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className={cn(
              "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl",
              "border border-border/20 bg-card",
              "shadow-[0_2px_10px_-3px_hsl(var(--foreground)/0.12)]",
              "transition-all duration-300 ease-out",
              "hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_16px_40px_-12px_hsl(var(--primary)/0.14),0_6px_16px_-6px_hsl(var(--foreground)/0.1)]"
            )}
          >
            {/* Hover accent */}
            <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {/* Thumbnail */}
            <div className="relative aspect-[16/9] overflow-hidden bg-secondary/15">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-600 ease-out group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/30 to-primary/[0.04]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/10 bg-card/60 shadow-inner">
                    <span className="font-display text-2xl font-black text-primary/25">{initial}</span>
                  </div>
                </div>
              )}

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-card/60 via-transparent to-transparent" />

              {/* Status pill */}
              <div className="absolute left-3 top-3 z-[2]">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Hover menu trigger */}
              <div className="absolute right-3 top-3 z-[2] scale-90 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-7 w-7 rounded-lg bg-background/75 backdrop-blur-lg border border-border/15 text-foreground/75 shadow-md hover:bg-background hover:text-foreground"
                  {...handlers}
                />
              </div>

              {/* Bottom pills on image */}
              <div className="absolute bottom-3 left-3 z-[2] flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background/65 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/75 backdrop-blur-lg shadow-sm">
                  <Package className="h-2.5 w-2.5 text-muted-foreground/60" strokeWidth={2} />
                  {deliveryLabel}
                </span>
                {checkoutLink && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-success backdrop-blur-lg shadow-sm">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                    </span>
                    Live
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col px-4 pt-3 pb-3.5">
              {/* Title */}
              <h3 className="truncate text-[14px] font-bold tracking-[-0.02em] text-foreground transition-colors duration-200 group-hover:text-primary">
                {product.name}
              </h3>
              <p className="mt-0.5 truncate text-[11px] leading-relaxed text-muted-foreground/50">
                {product.description || "Sem descrição"}
              </p>

              {/* Price + affiliate */}
              <div className="mt-3 flex items-end justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-numbers text-[22px] font-black tabular-nums tracking-[-0.03em] text-success drop-shadow-[0_0_8px_hsl(var(--success)/0.1)]">
                    {formatCurrency(price)}
                  </span>
                  <span className="pb-px text-[8px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/25">BRL</span>
                </div>
                {product.affiliate_enabled && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/5 px-2 py-0.5 text-[9px] font-semibold text-primary/70">
                    <Users className="h-2.5 w-2.5" strokeWidth={2} />
                    {product.affiliate_commission}%
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="my-3 h-px bg-gradient-to-r from-border/15 via-border/8 to-transparent" />

              {/* Quick actions bar */}
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerLabel="Ações"
                  triggerClassName="h-[34px] flex-1 rounded-[10px] border border-border/12 bg-secondary/15 text-[10.5px] text-foreground/60 hover:border-primary/12 hover:bg-primary/[0.04] hover:text-foreground"
                  {...handlers}
                />
                {checkoutLink && (
                  <>
                    <button
                      onClick={() => handlers.onCopyLink(product)}
                      className={cn(
                        "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border transition-all duration-200",
                        copiedId === product.id
                          ? "border-success/15 bg-success/8 text-success shadow-[0_0_12px_hsl(var(--success)/0.08)]"
                          : "border-border/12 bg-secondary/15 text-muted-foreground/40 hover:border-primary/12 hover:bg-primary/[0.04] hover:text-foreground"
                      )}
                      title="Copiar link"
                    >
                      <Copy className="h-3 w-3" strokeWidth={1.8} />
                    </button>
                    <button
                      onClick={() => handlers.onOpenCheckout(product)}
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-border/12 bg-secondary/15 text-muted-foreground/40 transition-all duration-200 hover:border-primary/12 hover:bg-primary/[0.04] hover:text-foreground"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
                    </button>
                  </>
                )}
              </div>

              {/* Footer meta */}
              <div className="mt-2.5 flex items-center justify-between text-[9px] text-muted-foreground/25">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" strokeWidth={1.8} />
                  {formatCompactDate(product.created_at)}
                </span>
                <span className="font-mono uppercase tracking-[0.15em]">#{product.id.slice(0, 6)}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
