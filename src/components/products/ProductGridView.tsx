import { ArrowUpRight, ExternalLink, Package } from "lucide-react";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCompactDate, formatCurrency, type Product } from "./productPresentation";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {products.map((product) => (
        <article
          key={product.id}
          onClick={() => handlers.onEditProduct(product)}
          className="group cursor-pointer rounded-[24px] border border-border/20 bg-background/60 p-4 transition-all hover:border-info/20 hover:bg-background/75"
        >
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border/25 bg-background/70">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground/20" strokeWidth={1.5} />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/[0.04]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-foreground">{product.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{product.description || "Sem descrição"}</p>
                </div>

                <div onClick={(event) => event.stopPropagation()}>
                  <ProductActionsMenu
                    copied={copiedId === product.id}
                    product={product}
                    triggerClassName="h-8 w-8 rounded-xl border border-border/25 bg-card/70 text-muted-foreground/55"
                    {...handlers}
                  />
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted-foreground/50">
                <span className="rounded-full border border-border/25 bg-card/60 px-2 py-0.5 font-medium text-muted-foreground/70">
                  {DELIVERY_LABELS[product.delivery_type] || product.delivery_type}
                </span>
                <span>Atualizado {formatCompactDate(product.updated_at)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/15 pt-3">
            <div>
              <p className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/35">Preço</p>
              <p className="mt-1 font-numbers text-[16px] text-foreground">{formatCurrency(Number(product.price))}</p>
              <p className="mt-1 text-[10px] font-mono text-muted-foreground/45">
                {product.affiliate_enabled ? `${product.affiliate_commission}% afiliado` : "Programa fechado"}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/35">Status</p>
              <div className="mt-1 flex justify-end">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>
              <p className="mt-1 text-[10px] font-mono text-muted-foreground/45">
                {product.checkout_url ? "Checkout ativo" : "Sem checkout"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
            {product.checkout_url && (
              <button
                type="button"
                onClick={() => handlers.onOpenCheckout(product)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/25 bg-card/70 px-3 text-[12px] font-medium text-muted-foreground/70 transition-all hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                Checkout
              </button>
            )}
            <button
              type="button"
              onClick={() => handlers.onEditProduct(product)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-info px-3 text-[12px] font-medium text-info-foreground transition-all hover:brightness-105"
            >
              Editar
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}