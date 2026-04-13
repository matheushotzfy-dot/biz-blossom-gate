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
              "border border-border/15 bg-card",
              "shadow-[0_2px_12px_-4px_hsl(var(--foreground)/0.15)]",
              "transition-all duration-300",
              "hover:-translate-y-0.5 hover:border-border/30 hover:shadow-[0_12px_32px_-8px_hsl(var(--foreground)/0.2)]"
            )}
          >
            {/* Thumbnail */}
            <div className="relative aspect-[16/9] overflow-hidden bg-secondary/20">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/40 to-secondary/15">
                  <span className="font-display text-3xl font-black text-muted-foreground/20">{initial}</span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />

              {/* Status */}
              <div className="absolute left-2.5 top-2.5">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Menu */}
              <div className="absolute right-2.5 top-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-7 w-7 rounded-lg bg-background/70 backdrop-blur-md border border-border/20 text-foreground/80 shadow-lg hover:bg-background"
                  {...handlers}
                />
              </div>

              {/* Bottom tags on image */}
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-background/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground/80 backdrop-blur-md">
                  <Package className="h-2.5 w-2.5" strokeWidth={2} />
                  {deliveryLabel}
                </span>
                {checkoutLink && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-[9px] font-bold uppercase text-success backdrop-blur-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Live
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col p-3.5">
              {/* Title */}
              <h3 className="truncate text-[14px] font-bold tracking-tight text-foreground">
                {product.name}
              </h3>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground/55">
                {product.description || "Sem descrição"}
              </p>

              {/* Price row */}
              <div className="mt-3 flex items-end justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="font-numbers text-[20px] font-black tabular-nums tracking-tight text-success">
                    {formatCurrency(price)}
                  </span>
                  <span className="text-[8px] font-semibold uppercase tracking-widest text-muted-foreground/30">BRL</span>
                </div>
                {product.affiliate_enabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary/70">
                    <Users className="h-3 w-3" strokeWidth={1.8} />
                    {product.affiliate_commission}%
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="my-2.5 h-px bg-border/12" />

              {/* Quick actions */}
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerLabel="Ações"
                  triggerClassName="h-8 flex-1 rounded-lg border border-border/15 bg-secondary/20 text-[10.5px] text-foreground/65 hover:border-primary/15 hover:bg-primary/5 hover:text-foreground"
                  {...handlers}
                />
                {checkoutLink && (
                  <>
                    <button
                      onClick={() => handlers.onCopyLink(product)}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-150",
                        copiedId === product.id
                          ? "border-success/20 bg-success/8 text-success"
                          : "border-border/15 bg-secondary/20 text-muted-foreground/50 hover:border-primary/15 hover:text-foreground"
                      )}
                      title="Copiar link"
                    >
                      <Copy className="h-3 w-3" strokeWidth={1.8} />
                    </button>
                    <button
                      onClick={() => handlers.onOpenCheckout(product)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/15 bg-secondary/20 text-muted-foreground/50 transition-all duration-150 hover:border-primary/15 hover:text-foreground"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
                    </button>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground/30">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" strokeWidth={1.8} />
                  {formatCompactDate(product.created_at)}
                </span>
                <span className="font-mono uppercase tracking-widest">#{product.id.slice(0, 6)}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
