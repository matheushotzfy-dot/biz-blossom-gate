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
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;
        const initial = product.name.charAt(0).toUpperCase();
        const price = Number(product.price);

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors duration-150 hover:border-primary/40"
          >
            {/* Thumbnail */}
            <div className="relative aspect-[16/9] overflow-hidden bg-muted">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <span className="font-display text-3xl font-black text-muted-foreground">{initial}</span>
                </div>
              )}

              {/* Status */}
              <div className="absolute left-2.5 top-2.5">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Menu on hover */}
              <div className="absolute right-2.5 top-2.5 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-7 w-7 rounded-md bg-card border border-border text-foreground"
                  {...handlers}
                />
              </div>

              {/* Tags */}
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded bg-card px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground border border-border">
                  <Package className="h-2.5 w-2.5" strokeWidth={2} />
                  {deliveryLabel}
                </span>
                {checkoutLink && (
                  <span className="inline-flex items-center gap-1 rounded bg-success/20 px-2 py-0.5 text-[9px] font-bold uppercase text-success border border-success/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Live
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col p-4">
              <h3 className="truncate text-sm font-bold text-foreground">{product.name}</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">{product.description || "Sem descrição"}</p>

              <div className="mt-4 flex items-end justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="font-numbers text-xl font-black tabular-nums text-success">{formatCurrency(price)}</span>
                  <span className="text-[8px] font-semibold uppercase tracking-widest text-muted-foreground">BRL</span>
                </div>
                {product.affiliate_enabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                    <Users className="h-3 w-3" strokeWidth={1.8} />
                    {product.affiliate_commission}%
                  </span>
                )}
              </div>

              <div className="my-3 h-px bg-border" />

              {/* Actions */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerLabel="Ações"
                  triggerClassName="h-8 flex-1 rounded-md border border-border bg-secondary text-[10.5px] text-foreground hover:bg-accent"
                  {...handlers}
                />
                {checkoutLink && (
                  <>
                    <button
                      onClick={() => handlers.onCopyLink(product)}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                        copiedId === product.id
                          ? "border-success bg-success/20 text-success"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                      title="Copiar link"
                    >
                      <Copy className="h-3 w-3" strokeWidth={1.8} />
                    </button>
                    <button
                      onClick={() => handlers.onOpenCheckout(product)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
                    </button>
                  </>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-[9px] text-muted-foreground">
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
