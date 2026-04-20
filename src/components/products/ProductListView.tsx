import { ExternalLink, Package } from "lucide-react";

import { cn } from "@/lib/utils";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCompactDate, formatCurrency, type Product } from "./productPresentation";

type ProductListViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

const STATUS_HELPERS: Record<string, string> = {
  active: "Pronto para vender",
  inactive: "Fora de circulação",
  pending_review: "Aguardando aprovação",
};

export function ProductListView({ products, copiedId, ...handlers }: ProductListViewProps) {
  return (
    <>
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm">
          <div className="grid grid-cols-[minmax(0,2.5fr)_140px_160px_130px_60px] gap-4 bg-muted/30 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 border-b border-border/40">
            <span>Produto</span>
            <span className="text-center">Preço</span>
            <span className="text-center">Vínculo</span>
            <span className="text-center">Status</span>
            <span />
          </div>

          <div className="divide-y divide-border/30">
            {products.map((product) => {
              const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
              const hasCheckout = Boolean(product.checkout_url);
              const statusHelper = STATUS_HELPERS[product.status] || "Sem sinalização";

              return (
                <article
                  key={product.id}
                  onClick={() => handlers.onEditProduct(product)}
                  className="group relative grid cursor-pointer grid-cols-[minmax(0,2.5fr)_140px_160px_130px_60px] items-center gap-4 px-6 py-4 transition-all hover:bg-muted/10"
                >
                  <span className="absolute left-0 top-1/2 h-8 w-[2px] -translate-y-1/2 rounded-r-full bg-primary opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="min-w-0 flex items-center gap-4">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-muted/40">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground/30" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-heading text-[15px] font-bold text-foreground group-hover:text-primary transition-colors">{product.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground/50 truncate max-w-[200px]">{product.description || "Sem descrição"}</span>
                        <span className="h-1 w-1 rounded-full bg-border/40 shrink-0" />
                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider shrink-0">{deliveryLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="font-heading text-[17px] font-black text-foreground tabular-nums tracking-tight">{formatCurrency(Number(product.price))}</p>
                    {product.affiliate_enabled && (
                      <p className="mt-0.5 text-[9px] font-bold text-primary/60 uppercase tracking-wider">{product.affiliate_commission}% comissão</p>
                    )}
                  </div>

                  <div className="flex justify-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold transition-all",
                        hasCheckout
                          ? "border-primary/20 bg-primary/5 text-primary"
                          : "border-border/40 bg-muted/40 text-muted-foreground/50"
                      )}
                    >
                      {hasCheckout ? <ExternalLink className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-30" />}
                      {hasCheckout ? "Checkout Ativo" : "Sem Checkout"}
                    </span>
                  </div>

                  <div className="flex justify-center">
                    <ProductStatusIndicator status={product.status} tone="soft" />
                  </div>

                  <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                    <ProductActionsMenu
                      copied={copiedId === product.id}
                      product={product}
                      triggerClassName="h-8 w-8 rounded-lg border border-border/40 bg-transparent text-muted-foreground/40 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      {...handlers}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 md:hidden">
        {products.map((product) => {
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const hasCheckout = Boolean(product.checkout_url);
          const statusHelper = STATUS_HELPERS[product.status] || "Sem sinalização";

          return (
            <article
              key={product.id}
              onClick={() => handlers.onEditProduct(product)}
              className="seller-panel cursor-pointer rounded-[30px] p-4"
            >
              <div className="relative z-[1]">
                <div className="flex items-start gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[22px] border border-sidebar-border/70 bg-sidebar shadow-[inset_0_1px_0_hsl(var(--foreground)/0.03)]">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-sidebar-foreground/28" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-sidebar-border/60" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-[19px] font-black tracking-[-0.04em] text-foreground">{product.name}</p>
                        <p className="mt-2 text-[14px] leading-7 text-muted-foreground/72">{product.description || "Sem descrição"}</p>
                      </div>
                      <div onClick={(event) => event.stopPropagation()}>
                        <ProductActionsMenu
                          copied={copiedId === product.id}
                          product={product}
                          triggerClassName="h-11 w-11 rounded-[16px] border border-sidebar-border/70 bg-sidebar/84 text-sidebar-foreground/60"
                          {...handlers}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <span className="seller-pill rounded-full px-3 py-1.5 text-[11px] font-semibold">{deliveryLabel}</span>
                      <ProductStatusIndicator status={product.status} tone="soft" />
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[24px] border border-sidebar-border/60 bg-sidebar-border/40">
                  <div className="grid grid-cols-2 gap-px">
                    <div className="bg-sidebar/86 p-4">
                      <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-sidebar-foreground/42">Monetização</p>
                      <p className="mt-2 font-numbers text-[22px] font-black tracking-[-0.05em] text-foreground">{formatCurrency(Number(product.price))}</p>
                      <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground/66">
                        {product.affiliate_enabled ? `${product.affiliate_commission}% afiliado` : "Sem afiliação"}
                      </p>
                    </div>
                    <div className="bg-sidebar/86 p-4 text-right">
                      <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-sidebar-foreground/42">Publicação</p>
                      <p className={cn("mt-2 text-[14px] font-semibold", hasCheckout ? "text-foreground" : "text-sidebar-foreground/68")}>
                        {hasCheckout ? "Checkout publicado" : "Sem checkout"}
                      </p>
                      <p className="mt-1.5 text-[11px] font-mono text-sidebar-foreground/52">{formatCompactDate(product.updated_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-sidebar/84 px-4 py-3.5">
                    <p className="text-[11px] font-heading uppercase tracking-[0.18em] text-sidebar-foreground/42">Status</p>
                    <p className="text-[13px] font-medium text-muted-foreground/72">{statusHelper}</p>
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
