import { Copy, ExternalLink, Eye, Package, Calendar, Users, Crosshair, Sparkles } from "lucide-react";

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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, idx) => {
        const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
        const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;
        const initial = product.name.charAt(0).toUpperCase();
        const hasAffiliate = product.affiliate_enabled;
        const price = Number(product.price);

        return (
          <article
            key={product.id}
            onClick={() => handlers.onEditProduct(product)}
            className={cn(
              "group relative flex cursor-pointer flex-col overflow-hidden rounded-[20px]",
              "border border-border/10",
              "bg-gradient-to-b from-[hsl(var(--card))] to-[hsl(var(--card)/0.85)]",
              "shadow-[0_4px_24px_-4px_hsl(var(--background)/0.5),inset_0_1px_0_hsl(var(--foreground)/0.04)]",
              "transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "hover:border-primary/20 hover:shadow-[0_20px_60px_-12px_hsl(var(--primary)/0.12),0_8px_24px_-8px_hsl(var(--background)/0.6),inset_0_1px_0_hsl(var(--primary)/0.06)] hover:-translate-y-1.5"
            )}
          >
            {/* ── Top accent line ── */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20" />

            {/* ── Thumbnail ── */}
            <div className="relative aspect-[16/9] w-full overflow-hidden">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.06] group-hover:brightness-110"
                />
              ) : (
                <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/6 via-secondary/25 to-accent/10 overflow-hidden">
                  {/* Decorative pattern */}
                  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-[18px] border border-border/10 bg-gradient-to-br from-card to-card/60 shadow-[0_8px_32px_-4px_hsl(var(--background)/0.6),inset_0_1px_0_hsl(var(--foreground)/0.05)]">
                    <span className="font-display text-2xl font-black bg-gradient-to-b from-primary/40 to-primary/15 bg-clip-text text-transparent select-none">
                      {initial}
                    </span>
                  </div>
                </div>
              )}

              {/* Cinematic gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--card))] via-[hsl(var(--card)/0.15)] to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--background)/0.3)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Status badge */}
              <div className="absolute left-3 top-3 z-10">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Actions menu */}
              <div
                className="absolute right-3 top-3 z-10 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <ProductActionsMenu
                  copied={copiedId === product.id}
                  product={product}
                  triggerClassName="h-8 w-8 rounded-xl bg-background/70 backdrop-blur-xl border border-border/30 text-foreground/80 shadow-xl hover:bg-background hover:text-foreground hover:border-primary/20"
                  {...handlers}
                />
              </div>

              {/* Hover preview */}
              <div className="absolute inset-0 z-[5] flex items-center justify-center opacity-0 transition-all duration-400 group-hover:opacity-100">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/80 backdrop-blur-xl border border-border/30 shadow-2xl transition-all duration-400 scale-50 group-hover:scale-100">
                  <Eye className="h-4.5 w-4.5 text-foreground/80" strokeWidth={1.6} />
                </div>
              </div>

              {/* Checkout published indicator (bottom-left of image) */}
              {checkoutLink && (
                <div className="absolute left-3 bottom-3 z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/15 bg-success/10 backdrop-blur-md px-2 py-1 text-[9px] font-bold text-success shadow-[0_0_16px_hsl(var(--success)/0.1)]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-success animate-ping opacity-50" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                    </span>
                    LIVE
                  </span>
                </div>
              )}
            </div>

            {/* ── Body ── */}
            <div className="relative flex flex-1 flex-col px-4 pt-3.5 pb-4">
              {/* Title */}
              <h3 className="truncate font-display text-[15px] font-extrabold leading-snug tracking-tight text-foreground group-hover:text-primary/90 transition-colors duration-300">
                {product.name}
              </h3>

              {/* Description */}
              {product.description ? (
                <p className="mt-0.5 truncate text-[11px] leading-relaxed text-muted-foreground/55">
                  {product.description}
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] italic text-muted-foreground/25">Sem descrição adicionada</p>
              )}

              {/* Tags */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-lg border border-border/12 bg-secondary/30 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
                  <Package className="h-2.5 w-2.5" strokeWidth={2.2} />
                  {deliveryLabel}
                </span>
                {hasAffiliate && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-primary/12 bg-primary/5 px-2.5 py-1 text-[9px] font-bold text-primary/60">
                    <Users className="h-2.5 w-2.5" strokeWidth={2.2} />
                    {product.affiliate_commission}% afiliado
                  </span>
                )}
              </div>

              {/* Elegant divider */}
              <div className="my-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-border/20 via-border/8 to-transparent" />
                <Sparkles className="h-2.5 w-2.5 text-primary/15" strokeWidth={2} />
                <div className="h-px flex-1 bg-gradient-to-l from-border/20 via-border/8 to-transparent" />
              </div>

              {/* Price + Actions row */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-numbers text-xl font-black tabular-nums tracking-tight text-success drop-shadow-[0_0_12px_hsl(var(--success)/0.15)]">
                    {formatCurrency(price)}
                  </span>
                  {price > 0 && (
                    <span className="ml-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/25">BRL</span>
                  )}
                </div>

                {/* Quick action icons */}
                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handlers.onOpenPixels(product)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/25 transition-all duration-200 hover:bg-primary/8 hover:text-primary/70 hover:shadow-[0_0_12px_hsl(var(--primary)/0.08)]"
                    title="Pixels & Tracking"
                  >
                    <Crosshair className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                  {checkoutLink && (
                    <>
                      <button
                        onClick={() => handlers.onCopyLink(product)}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200",
                          copiedId === product.id
                            ? "text-success bg-success/10 ring-1 ring-success/25 shadow-[0_0_12px_hsl(var(--success)/0.1)]"
                            : "text-muted-foreground/25 hover:bg-primary/8 hover:text-primary/70"
                        )}
                        title="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => handlers.onOpenCheckout(product)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/25 transition-all duration-200 hover:bg-primary/8 hover:text-primary/70"
                        title="Abrir checkout"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Footer meta */}
              <div className="mt-2.5 flex items-center justify-between text-[9px] text-muted-foreground/25">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" strokeWidth={2} />
                  {formatCompactDate(product.created_at)}
                </span>
                <span className="font-mono uppercase tracking-widest">
                  ID #{product.id.slice(0, 6)}
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
