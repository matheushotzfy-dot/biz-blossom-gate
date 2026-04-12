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
        <div className="grid grid-cols-[minmax(0,1.7fr)_220px_180px_150px_48px] gap-4 px-5 py-3 text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground/38">
          <span>Produto</span>
          <span>Publicação</span>
          <span className="text-right">Monetização</span>
          <span className="text-center">Status</span>
          <span />
        </div>

        <div className="border-t border-border/25">
          {products.map((product) => {
            const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
            const hasCheckout = Boolean(product.checkout_url);
            const statusHelper = STATUS_HELPERS[product.status] || "Sem sinalização";

            return (
              <article
                key={product.id}
                onClick={() => handlers.onEditProduct(product)}
                className="group grid cursor-pointer grid-cols-[minmax(0,1.7fr)_220px_180px_150px_48px] items-center gap-4 border-t border-border/25 px-5 py-4 transition-all hover:bg-background/50"
              >
                <div className="min-w-0 flex items-center gap-3.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-border/45 bg-background">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-4.5 w-4.5 text-muted-foreground/25" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/[0.04]" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className="truncate text-[13px] font-semibold text-foreground">{product.name}</p>
                      <span className="rounded-full border border-border/40 bg-background/75 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/65">
                        {deliveryLabel}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[12px] text-muted-foreground/55">{product.description || "Sem descrição"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                      hasCheckout
                        ? "border-success/20 bg-success/10 text-success"
                        : "border-border/40 bg-secondary/50 text-muted-foreground/65"
                    )}
                  >
                    {hasCheckout && <ExternalLink className="h-3 w-3" strokeWidth={1.8} />}
                    {!hasCheckout && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
                    {hasCheckout ? "Checkout publicado" : "Sem checkout"}
                  </span>
                  <p className="text-[11px] font-mono text-muted-foreground/40">{formatCompactDate(product.updated_at)}</p>
                </div>

                <div className="text-right">
                  <p className="font-numbers text-[15px] font-semibold tabular-nums text-foreground">{formatCurrency(Number(product.price))}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/45">
                    {product.affiliate_enabled ? `${product.affiliate_commission}% com afiliados` : "Afiliados desativados"}
                  </p>
                </div>

                <div className="space-y-1.5 text-center">
                  <div className="flex justify-center">
                    <ProductStatusIndicator status={product.status} tone="soft" />
                  </div>
                  <p className="text-[11px] text-muted-foreground/40">{statusHelper}</p>
                </div>

                <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                  <div className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <ProductActionsMenu
                      copied={copiedId === product.id}
                      product={product}
                      triggerClassName="h-9 w-9 rounded-xl border border-border/35 bg-background/75 text-muted-foreground/50 hover:bg-background hover:text-foreground"
                      {...handlers}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {products.map((product) => {
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const hasCheckout = Boolean(product.checkout_url);

          return (
            <article
              key={product.id}
              onClick={() => handlers.onEditProduct(product)}
              className="cursor-pointer rounded-[24px] border border-border/40 bg-background/65 p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-border/45 bg-background">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-4.5 w-4.5 text-muted-foreground/25" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-foreground">{product.name}</p>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground/60">{product.description || "Sem descrição"}</p>
                    </div>
                    <div onClick={(event) => event.stopPropagation()}>
                      <ProductActionsMenu
                        copied={copiedId === product.id}
                        product={product}
                        triggerClassName="h-8 w-8 rounded-xl border border-border/35 bg-background/75 text-muted-foreground/55"
                        {...handlers}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border/40 bg-background/75 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/65">
                      {deliveryLabel}
                    </span>
                    <ProductStatusIndicator status={product.status} tone="soft" />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/25 pt-3">
                <div className="rounded-2xl border border-border/35 bg-card/75 p-3">
                  <p className="text-[10px] font-heading uppercase tracking-[0.16em] text-muted-foreground/40">Monetização</p>
                  <p className="mt-1 font-numbers text-[15px] font-semibold text-foreground">{formatCurrency(Number(product.price))}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/45">
                    {product.affiliate_enabled ? `${product.affiliate_commission}% afiliado` : "Sem afiliação"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/35 bg-card/75 p-3 text-right">
                  <p className="text-[10px] font-heading uppercase tracking-[0.16em] text-muted-foreground/40">Publicação</p>
                  <p className="mt-1 text-[13px] font-medium text-foreground">{hasCheckout ? "Checkout publicado" : "Sem checkout"}</p>
                  <p className="mt-1 text-[11px] font-mono text-muted-foreground/40">{formatCompactDate(product.updated_at)}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
