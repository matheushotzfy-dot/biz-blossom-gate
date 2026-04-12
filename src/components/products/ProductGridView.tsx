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
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {products.map((product) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const hasCheckout = Boolean(product.checkout_url);

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className="group overflow-hidden rounded-[28px] border border-border/40 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[var(--card-shadow)]"
          >
            <div className="relative aspect-[16/10] overflow-hidden border-b border-border/25 bg-background/80">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-background/85">
                  <Package className="h-8 w-8 text-muted-foreground/20" strokeWidth={1.5} />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/80" />

              <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border/40 bg-background/75 px-2.5 py-1 text-[10px] font-medium text-muted-foreground/70 backdrop-blur-sm">
                  {deliveryLabel}
                </span>
              </div>

              <div className="absolute right-4 top-4" onClick={(event) => event.stopPropagation()}>
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-9 w-9 rounded-xl border border-border/35 bg-background/75 text-muted-foreground/55 backdrop-blur-sm"
                  {...handlers}
                />
              </div>

              <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2">
                <ProductStatusIndicator status={product.status} tone="soft" />
                <span className="rounded-full border border-border/40 bg-background/75 px-2 py-0.5 text-[10px] font-mono text-muted-foreground/60 backdrop-blur-sm">
                  {formatCompactDate(product.updated_at)}
                </span>
              </div>
            </div>

            <div className="p-4">
              <div className="space-y-1.5">
                <h3 className="truncate text-[15px] font-semibold text-foreground">{product.name}</h3>
                <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground/65">{product.description || "Sem descrição"}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-border/35 bg-background/70 p-3">
                  <p className="text-[10px] font-heading uppercase tracking-[0.16em] text-muted-foreground/40">Monetização</p>
                  <p className="mt-1 font-numbers text-[18px] font-semibold text-foreground">{formatCurrency(Number(product.price))}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/45">
                    {product.affiliate_enabled ? `${product.affiliate_commission}% afiliado` : "Sem afiliação"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/35 bg-background/70 p-3 text-right">
                  <p className="text-[10px] font-heading uppercase tracking-[0.16em] text-muted-foreground/40">Checkout</p>
                  <p className={cn("mt-1 text-[13px] font-medium", hasCheckout ? "text-foreground" : "text-muted-foreground/65")}>
                    {hasCheckout ? "Publicado" : "Pendente"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/45">
                    {hasCheckout ? "Pronto para abrir" : "Finalize o checkout"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                {hasCheckout && (
                  <button
                    type="button"
                    onClick={() => handlers.onOpenCheckout(product)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border/35 bg-background/70 px-3 text-[12px] font-medium text-muted-foreground/75 transition-all hover:bg-background hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Checkout
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handlers.onEditProduct(product)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground transition-all hover:bg-primary/90"
                >
                  Editar
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
