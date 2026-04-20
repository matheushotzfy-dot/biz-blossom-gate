import { ExternalLink, Package, Sparkles } from "lucide-react";

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
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_hsl(var(--background)/0.04)]">
          <div className="grid grid-cols-[minmax(0,2.6fr)_130px_140px_130px_130px_64px] items-center gap-4 border-b border-border bg-gradient-to-b from-muted/50 to-muted/20 px-6 py-3.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
            <span>Produto</span>
            <span className="text-right">Preço</span>
            <span className="text-center">Checkout</span>
            <span className="text-center">Status</span>
            <span className="text-right tabular-nums">Atualizado</span>
            <span />
          </div>

          <div className="divide-y divide-border/60">
            {products.map((product) => {
              const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
              const hasCheckout = Boolean(product.checkout_url);

              return (
                <article
                  key={product.id}
                  onClick={() => handlers.onEditProduct(product)}
                  className="group relative grid cursor-pointer grid-cols-[minmax(0,2.6fr)_130px_140px_130px_130px_64px] items-center gap-4 px-6 py-4 transition-all duration-200 hover:bg-muted/40"
                >
                  <span className="absolute left-0 top-0 h-full w-[2px] bg-foreground opacity-0 transition-opacity group-hover:opacity-100" />

                  {/* Produto */}
                  <div className="min-w-0 flex items-center gap-3.5">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted ring-1 ring-inset ring-border/40 shadow-[inset_0_1px_0_hsl(var(--background)/0.04)]">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-[18px] w-[18px] text-muted-foreground/40" strokeWidth={1.6} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-foreground tracking-[-0.01em] leading-tight">{product.name}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10.5px] font-semibold text-muted-foreground/85">
                        <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 uppercase tracking-[0.08em] text-[9.5px] text-muted-foreground/90">
                          {deliveryLabel}
                        </span>
                        {product.affiliate_enabled && (
                          <span className="inline-flex items-center gap-1 text-primary/80">
                            <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
                            {product.affiliate_commission}% afiliado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Preço */}
                  <p className="text-right text-[15px] font-black text-foreground tabular-nums tracking-[-0.02em]">
                    {formatCurrency(Number(product.price))}
                  </p>

                  {/* Checkout */}
                  <div className="flex justify-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-tight",
                        hasCheckout
                          ? "border-success/25 bg-success/10 text-success"
                          : "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      <span className={cn(
                        "relative flex h-1.5 w-1.5",
                      )}>
                        {hasCheckout && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-50" />
                        )}
                        <span className={cn("relative h-1.5 w-1.5 rounded-full", hasCheckout ? "bg-success" : "bg-muted-foreground/50")} />
                      </span>
                      {hasCheckout ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    <ProductStatusIndicator status={product.status} tone="soft" />
                  </div>

                  {/* Atualizado */}
                  <p className="text-right text-[11.5px] font-semibold text-muted-foreground tabular-nums">
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
              className="cursor-pointer rounded-2xl border border-border bg-card p-4 transition-colors active:bg-muted/40"
            >
              <div className="flex items-start gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground/50" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-bold text-foreground tracking-[-0.01em]">{product.name}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">{deliveryLabel}</p>
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
                    <p className="text-[17px] font-black text-foreground tabular-nums tracking-[-0.02em]">
                      {formatCurrency(Number(product.price))}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <ProductStatusIndicator status={product.status} tone="soft" />
                      {hasCheckout && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[9.5px] font-bold text-success">
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
