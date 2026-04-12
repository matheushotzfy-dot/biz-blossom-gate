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
        <div className="grid grid-cols-[minmax(0,1.8fr)_240px_220px_170px_52px] gap-5 px-6 py-4 text-[10px] font-heading uppercase tracking-[0.22em] text-muted-foreground/36 lg:px-7">
          <span>Produto</span>
          <span>Publicação</span>
          <span className="text-right">Monetização</span>
          <span className="text-center">Status</span>
          <span />
        </div>

        <div className="border-t border-border/20">
          {products.map((product) => {
            const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
            const hasCheckout = Boolean(product.checkout_url);
            const statusHelper = STATUS_HELPERS[product.status] || "Sem sinalização";

            return (
              <article
                key={product.id}
                onClick={() => handlers.onEditProduct(product)}
                className="group grid cursor-pointer grid-cols-[minmax(0,1.8fr)_240px_220px_170px_52px] items-center gap-5 border-t border-border/20 px-6 py-5 transition-all hover:bg-background/55 lg:px-7"
              >
                <div className="min-w-0 flex items-center gap-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[20px] border border-border/40 bg-background shadow-[0_10px_24px_hsl(var(--background)/0.14)]">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground/25" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 rounded-[20px] ring-1 ring-inset ring-foreground/[0.04]" />
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <p className="truncate text-[15px] font-semibold text-foreground">{product.name}</p>
                      <span className="rounded-full border border-border/35 bg-background/78 px-2.5 py-1 text-[10px] font-medium text-muted-foreground/66">
                        {deliveryLabel}
                      </span>
                    </div>
                    <p className="truncate text-[13px] leading-6 text-muted-foreground/56">{product.description || "Sem descrição"}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium",
                      hasCheckout
                        ? "border-primary/20 bg-primary/10 text-primary shadow-[0_0_16px_hsl(var(--primary)/0.05)]"
                        : "border-border/35 bg-secondary/55 text-muted-foreground/66"
                    )}
                  >
                    {hasCheckout ? <ExternalLink className="h-3 w-3" strokeWidth={1.8} /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
                    {hasCheckout ? "Checkout publicado" : "Sem checkout"}
                  </span>
                  <p className="text-[11px] font-mono text-muted-foreground/40">Atualizado {formatCompactDate(product.updated_at)}</p>
                </div>

                <div className="text-right">
                  <p className="font-numbers text-[18px] font-semibold tracking-[-0.04em] tabular-nums text-foreground">{formatCurrency(Number(product.price))}</p>
                  <p className="mt-1.5 text-[12px] text-muted-foreground/46">
                    {product.affiliate_enabled ? `${product.affiliate_commission}% com afiliados` : "Afiliados desativados"}
                  </p>
                </div>

                <div className="space-y-2 text-center">
                  <div className="flex justify-center">
                    <ProductStatusIndicator status={product.status} tone="soft" />
                  </div>
                  <p className="text-[12px] text-muted-foreground/42">{statusHelper}</p>
                </div>

                <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                  <div className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <ProductActionsMenu
                      copied={copiedId === product.id}
                      product={product}
                      triggerClassName="h-10 w-10 rounded-2xl border border-border/35 bg-background/78 text-muted-foreground/50 hover:border-primary/20 hover:bg-background hover:text-foreground"
                      {...handlers}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 p-4 md:hidden">
        {products.map((product) => {
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const hasCheckout = Boolean(product.checkout_url);

          return (
            <article
              key={product.id}
              onClick={() => handlers.onEditProduct(product)}
              className="cursor-pointer rounded-[28px] border border-border/35 bg-background/72 p-4 shadow-[0_18px_40px_hsl(var(--background)/0.18)]"
            >
              <div className="flex items-start gap-3.5">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[20px] border border-border/40 bg-background">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground/25" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-foreground">{product.name}</p>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-muted-foreground/60">{product.description || "Sem descrição"}</p>
                    </div>
                    <div onClick={(event) => event.stopPropagation()}>
                      <ProductActionsMenu
                        copied={copiedId === product.id}
                        product={product}
                        triggerClassName="h-9 w-9 rounded-2xl border border-border/35 bg-background/78 text-muted-foreground/55"
                        {...handlers}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <span className="rounded-full border border-border/35 bg-background/78 px-2.5 py-1 text-[10px] font-medium text-muted-foreground/66">
                      {deliveryLabel}
                    </span>
                    <ProductStatusIndicator status={product.status} tone="soft" />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/20 pt-4">
                <div className="rounded-[22px] border border-border/35 bg-card/76 p-3.5">
                  <p className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/40">Monetização</p>
                  <p className="mt-2 font-numbers text-[18px] font-semibold tracking-[-0.04em] text-foreground">{formatCurrency(Number(product.price))}</p>
                  <p className="mt-1.5 text-[12px] text-muted-foreground/45">
                    {product.affiliate_enabled ? `${product.affiliate_commission}% afiliado` : "Sem afiliação"}
                  </p>
                </div>
                <div className="rounded-[22px] border border-border/35 bg-card/76 p-3.5 text-right">
                  <p className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/40">Publicação</p>
                  <p className="mt-2 text-[14px] font-medium text-foreground">{hasCheckout ? "Checkout publicado" : "Sem checkout"}</p>
                  <p className="mt-1.5 text-[11px] font-mono text-muted-foreground/40">{formatCompactDate(product.updated_at)}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
