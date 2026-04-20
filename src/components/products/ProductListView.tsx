import { ExternalLink, Package } from "lucide-react";

import { cn } from "@/lib/utils";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCompactDate, formatCurrency, type Product } from "./productPresentation";

type ProductListViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

export function ProductListView({ products, copiedId, ...handlers }: ProductListViewProps) {
  return (
    <>
      {/* ── Desktop table ── */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[minmax(0,2.4fr)_120px_140px_120px_120px_60px] items-center gap-4 border-b border-border bg-muted/40 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <span>Produto</span>
            <span className="text-right">Preço</span>
            <span className="text-center">Checkout</span>
            <span className="text-center">Status</span>
            <span className="text-right tabular-nums">Atualizado</span>
            <span />
          </div>

          <div className="divide-y divide-border">
            {products.map((product) => {
              const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
              const hasCheckout = Boolean(product.checkout_url);

              return (
                <article
                  key={product.id}
                  onClick={() => handlers.onEditProduct(product)}
                  className="group relative grid cursor-pointer grid-cols-[minmax(0,2.4fr)_120px_140px_120px_120px_60px] items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/30"
                >
                  <span className="absolute left-0 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-r-full bg-foreground opacity-0 transition-opacity group-hover:opacity-100" />

                  {/* Produto */}
                  <div className="min-w-0 flex items-center gap-3.5">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted ring-1 ring-inset ring-border/50">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/50" strokeWidth={1.6} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-bold text-foreground tracking-tight">{product.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-[10.5px] font-medium text-muted-foreground">
                        <span className="uppercase tracking-wider font-bold text-muted-foreground/80">{deliveryLabel}</span>
                        {product.affiliate_enabled && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-border shrink-0" />
                            <span className="truncate">{product.affiliate_commission}% afiliado</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Preço */}
                  <p className="text-right text-[14px] font-bold text-foreground tabular-nums tracking-tight">
                    {formatCurrency(Number(product.price))}
                  </p>

                  {/* Checkout */}
                  <div className="flex justify-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold",
                        hasCheckout
                          ? "border-success/20 bg-success/10 text-success"
                          : "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", hasCheckout ? "bg-success" : "bg-muted-foreground/50")} />
                      {hasCheckout ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    <ProductStatusIndicator status={product.status} tone="soft" />
                  </div>

                  {/* Atualizado */}
                  <p className="text-right text-[11px] font-medium text-muted-foreground tabular-nums">
                    {formatCompactDate(product.updated_at)}
                  </p>

                  {/* Ações */}
                  <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100" onClick={(event) => event.stopPropagation()}>
                    <ProductActionsMenu
                      copied={copiedId === product.id}
                      product={product}
                      triggerClassName="h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      {...handlers}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div className="space-y-3 md:hidden">
        {products.map((product) => {
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const hasCheckout = Boolean(product.checkout_url);

          return (
            <article
              key={product.id}
              onClick={() => handlers.onEditProduct(product)}
              className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors active:bg-muted/40"
            >
              <div className="flex items-start gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground/50" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-foreground tracking-tight">{product.name}</p>
                      <p className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{deliveryLabel}</p>
                    </div>
                    <div onClick={(event) => event.stopPropagation()}>
                      <ProductActionsMenu
                        copied={copiedId === product.id}
                        product={product}
                        triggerClassName="h-8 w-8 rounded-lg border border-border bg-muted text-muted-foreground"
                        {...handlers}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[16px] font-bold text-foreground tabular-nums tracking-tight">
                      {formatCurrency(Number(product.price))}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <ProductStatusIndicator status={product.status} tone="soft" />
                      {hasCheckout && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-1.5 py-0.5 text-[9.5px] font-bold text-success">
                          <ExternalLink className="h-2.5 w-2.5" />
                          Live
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
