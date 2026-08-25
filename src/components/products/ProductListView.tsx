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
      <div className="hidden md:block p-4 lg:p-5">
        <div className="overflow-hidden rounded-[32px] border border-sidebar-border/70 bg-sidebar-accent/36 shadow-[0_18px_44px_hsl(var(--background)/0.16)]">
          <div className="grid grid-cols-[minmax(0,2.2fr)_260px_230px_180px_64px] gap-6 bg-sidebar/74 px-7 py-5 text-[11px] font-heading text-sidebar-foreground/46 lg:grid-cols-[minmax(0,2.1fr)_270px_240px_190px_64px]">
            <span>Produto</span>
            <span>Publicação</span>
            <span className="text-right">Monetização</span>
            <span className="text-center">Status</span>
            <span />
          </div>

          <div className="divide-y divide-sidebar-border/60">
            {products.map((product) => {
              const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
              const hasCheckout = Boolean(product.checkout_url);
              const statusHelper = STATUS_HELPERS[product.status] || "Sem sinalização";

              return (
                <article
                  key={product.id}
                  onClick={() => handlers.onEditProduct(product)}
                  className="group relative grid cursor-pointer grid-cols-[minmax(0,2.2fr)_260px_230px_180px_64px] items-center gap-6 px-7 py-6 transition-all hover:bg-sidebar-accent/74 lg:grid-cols-[minmax(0,2.1fr)_270px_240px_190px_64px]"
                >
                  <span className="pointer-events-none absolute inset-y-5 left-0 w-[3px] rounded-r-full bg-sidebar-primary opacity-0 shadow-[0_0_20px_hsl(var(--sidebar-primary)/0.34)] transition-opacity group-hover:opacity-100" />

                  <div className="min-w-0 flex items-center gap-5">
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

                    <div className="min-w-0 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="truncate font-display text-[19px] font-black tracking-[-0.04em] text-foreground">{product.name}</p>
                        <span className="seller-pill rounded-full px-3 py-1.5 text-[11px] font-semibold">{deliveryLabel}</span>
                      </div>
                      <p className="truncate text-[14px] leading-7 text-muted-foreground/72">{product.description || "Sem descrição"}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-[12px] font-semibold",
                        hasCheckout
                          ? "border-primary/20 bg-primary/10 text-primary shadow-[0_0_18px_hsl(var(--primary)/0.10)]"
                          : "border-sidebar-border/70 bg-sidebar/80 text-sidebar-foreground/68"
                      )}
                    >
                      {hasCheckout ? <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} /> : <span className="h-2 w-2 rounded-full bg-sidebar-foreground/35" />}
                      {hasCheckout ? "Checkout publicado" : "Sem checkout"}
                    </span>
                    <p className="text-[11px] font-mono text-sidebar-foreground/52">Atualizado {formatCompactDate(product.updated_at)}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-numbers text-[28px] font-black tracking-[-0.06em] text-foreground">{formatCurrency(Number(product.price))}</p>
                    <p className="mt-2 text-[13px] leading-6 text-muted-foreground/64">
                      {product.affiliate_enabled ? `${product.affiliate_commission}% com afiliados` : "Afiliados desativados"}
                    </p>
                  </div>

                  <div className="space-y-2.5 text-center">
                    <div className="flex justify-center">
                      <ProductStatusIndicator status={product.status} tone="soft" />
                    </div>
                    <p className="text-[13px] leading-6 text-muted-foreground/60">{statusHelper}</p>
                  </div>

                  <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                    <div className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <ProductActionsMenu
                        copied={copiedId === product.id}
                        product={product}
                        triggerClassName="h-11 w-11 rounded-[16px] border border-sidebar-border/70 bg-sidebar/84 text-sidebar-foreground/60 transition-all hover:border-sidebar-primary/25 hover:bg-sidebar hover:text-foreground"
                        {...handlers}
                      />
                    </div>
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
                      <p className="text-[11px] font-heading text-sidebar-foreground/42">Monetização</p>
                      <p className="mt-2 font-numbers text-[22px] font-black tracking-[-0.05em] text-foreground">{formatCurrency(Number(product.price))}</p>
                      <p className="mt-1.5 text-[12px] leading-6 text-muted-foreground/66">
                        {product.affiliate_enabled ? `${product.affiliate_commission}% afiliado` : "Sem afiliação"}
                      </p>
                    </div>
                    <div className="bg-sidebar/86 p-4 text-right">
                      <p className="text-[11px] font-heading text-sidebar-foreground/42">Publicação</p>
                      <p className={cn("mt-2 text-[14px] font-semibold", hasCheckout ? "text-foreground" : "text-sidebar-foreground/68")}>
                        {hasCheckout ? "Checkout publicado" : "Sem checkout"}
                      </p>
                      <p className="mt-1.5 text-[11px] font-mono text-sidebar-foreground/52">{formatCompactDate(product.updated_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-sidebar/84 px-4 py-3.5">
                    <p className="text-[11px] font-heading text-sidebar-foreground/42">Status</p>
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
