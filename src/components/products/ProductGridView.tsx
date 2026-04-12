import { ArrowUpRight, ExternalLink, Package } from "lucide-react";

import { cn } from "@/lib/utils";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCompactDate, formatCurrency, type Product } from "./productPresentation";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {products.map((product) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const hasCheckout = Boolean(product.checkout_url);

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className="seller-panel group cursor-pointer rounded-[32px] transition-all duration-300 hover:-translate-y-1 hover:border-sidebar-primary/25 hover:shadow-[0_24px_48px_hsl(var(--background)/0.16)]"
          >
            <div className="relative aspect-[16/11] overflow-hidden border-b border-sidebar-border/60 bg-sidebar/90">
              <span className="pointer-events-none absolute inset-y-5 left-0 z-10 w-[3px] rounded-r-full bg-sidebar-primary shadow-[0_0_18px_hsl(var(--sidebar-primary)/0.34)]" />
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-sidebar/92">
                  <Package className="h-8 w-8 text-sidebar-foreground/25" strokeWidth={1.5} />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-b from-sidebar/10 via-transparent to-sidebar/90" />

              <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
                <span className="seller-pill rounded-full px-3 py-1.5 text-[11px] font-semibold">
                  {deliveryLabel}
                </span>
              </div>

              <div className="absolute right-4 top-4 z-10" onClick={(event) => event.stopPropagation()}>
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-11 w-11 rounded-[16px] border border-sidebar-border/70 bg-sidebar/88 text-sidebar-foreground/65 backdrop-blur-sm transition-all hover:border-sidebar-primary/25 hover:text-sidebar-accent-foreground"
                  {...handlers}
                />
              </div>

              <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-2">
                <ProductStatusIndicator status={product.status} tone="soft" />
                <span className="rounded-full border border-sidebar-border/70 bg-sidebar/88 px-2.5 py-1 text-[11px] font-mono text-sidebar-foreground/60 backdrop-blur-sm">
                  {formatCompactDate(product.updated_at)}
                </span>
              </div>
            </div>

            <div className="relative z-[1] space-y-5 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-[20px] font-black tracking-[-0.05em] text-foreground">{product.name}</h3>
                  <p className="mt-2 text-[14px] leading-7 text-muted-foreground/72">{product.description || "Sem descrição"}</p>
                </div>
                <p className="shrink-0 font-numbers text-[24px] font-black tracking-[-0.05em] text-foreground">{formatCurrency(Number(product.price))}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[24px] border border-sidebar-border/60 bg-sidebar/78 p-4">
                  <p className="text-[11px] font-heading uppercase tracking-[0.16em] text-sidebar-foreground/42">Monetização</p>
                  <p className="mt-2 text-[13px] leading-6 text-muted-foreground/70">
                    {product.affiliate_enabled ? `${product.affiliate_commission}% afiliado` : "Sem afiliação"}
                  </p>
                </div>

                <div className="rounded-[24px] border border-sidebar-border/60 bg-sidebar/78 p-4 text-right">
                  <p className="text-[11px] font-heading uppercase tracking-[0.16em] text-sidebar-foreground/42">Checkout</p>
                  <p className={cn("mt-2 text-[14px] font-semibold", hasCheckout ? "text-foreground" : "text-sidebar-foreground/68")}>
                    {hasCheckout ? "Publicado" : "Pendente"}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground/62">
                    {hasCheckout ? "Pronto para abrir" : "Finalize o checkout"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5" onClick={(event) => event.stopPropagation()}>
                {hasCheckout && (
                  <button
                    type="button"
                    onClick={() => handlers.onOpenCheckout(product)}
                    className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-sidebar-border/70 bg-sidebar/84 px-4 text-[13px] font-semibold text-sidebar-accent-foreground/78 transition-all hover:border-sidebar-primary/25 hover:bg-sidebar hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                    Abrir checkout
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlers.onEditProduct(product)}
                  className="inline-flex h-11 items-center gap-2 rounded-[16px] bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-[0_12px_30px_hsl(var(--primary)/0.14)] transition-all hover:bg-primary/90"
                >
                  Editar
                  <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
