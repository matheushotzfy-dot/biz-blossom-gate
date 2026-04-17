import { Copy, ExternalLink } from "lucide-react";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCurrency, formatCompactDate, getCheckoutLink, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {toolbar && (
        <div className="border-b border-border px-6 py-3.5">{toolbar}</div>
      )}

      <ul>
        {products.map((product, idx) => {
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;
          const initial = product.name.charAt(0).toUpperCase();
          const price = Number(product.price);
          const isCopied = copiedId === product.id;
          const isActive = product.status === "active";
          const formattedPrice = formatCurrency(price);
          const priceMatch = formattedPrice.match(/^(\D+)\s?(.+)$/);
          const currencySymbol = priceMatch?.[1]?.trim() ?? "";
          const priceValue = priceMatch?.[2] ?? formattedPrice;

          return (
            <li
              key={product.id}
              onClick={() => handlers.onEditProduct(product)}
              className={cn(
                "group relative flex cursor-pointer items-center gap-8 px-8 py-6 transition-colors duration-200",
                "hover:bg-foreground/[0.025]",
                idx !== 0 && "border-t border-border/40"
              )}
            >
              {/* Active accent rail on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-4 left-0 w-[2px] rounded-r-full bg-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              />

              {/* ═══════════════════════════════════════════════════ */}
              {/* LEFT BLOCK — Product Identity (70%, dominant)        */}
              {/* ═══════════════════════════════════════════════════ */}
              <div className="flex min-w-0 flex-[7] items-center gap-6">
                {/* Larger thumbnail */}
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted ring-1 ring-border/60">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 to-primary/5">
                      <span className="font-display text-[40px] font-black leading-none text-primary/70">{initial}</span>
                    </div>
                  )}
                  {isActive && (
                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-success ring-2 ring-card" />
                  )}
                </div>

                {/* Title + description + metadata stack */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <h3 className="truncate font-display text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">
                    {product.name}
                  </h3>
                  <p className="truncate text-[13px] leading-snug text-muted-foreground/60">
                    {product.description || "Sem descrição"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground/40">
                    <span>{deliveryLabel}</span>
                    <span className="text-muted-foreground/20">·</span>
                    <span>{formatCompactDate(product.created_at)}</span>
                    {product.affiliate_enabled && (
                      <>
                        <span className="text-muted-foreground/20">·</span>
                        <span className="text-primary/70">Afiliados {product.affiliate_commission}%</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════ */}
              {/* RIGHT BLOCK — Commercial (30%, high-impact)          */}
              {/* ═══════════════════════════════════════════════════ */}
              <div className="flex flex-[3] shrink-0 items-center justify-end gap-5">
                {/* Price + status (tightly coupled) */}
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-baseline gap-1.5">
                    {currencySymbol && (
                      <span className="font-numbers text-[12px] font-semibold uppercase leading-none tracking-wider text-muted-foreground/45">
                        {currencySymbol}
                      </span>
                    )}
                    <span className="font-numbers text-[34px] font-black leading-none tabular-nums tracking-[-0.04em] text-foreground">
                      {priceValue}
                    </span>
                  </div>
                  <ProductStatusIndicator status={product.status} tone="soft" />
                </div>

                {/* Actions — minimal, hover-revealed */}
                <div
                  className="flex shrink-0 items-center gap-0.5 border-l border-border/40 pl-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {checkoutLink && (
                    <button
                      onClick={() => handlers.onCopyLink(product)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                        isCopied
                          ? "bg-success/15 text-success"
                          : "text-muted-foreground/60 opacity-0 hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                      )}
                      title="Copiar link"
                    >
                      <Copy className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  )}
                  {checkoutLink && (
                    <button
                      onClick={() => handlers.onOpenCheckout(product)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/60 opacity-0 transition-all hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  )}
                  <ProductActionsMenu
                    copied={isCopied}
                    product={product}
                    triggerClassName="h-9 w-9 rounded-lg text-muted-foreground/70 hover:bg-secondary hover:text-foreground"
                    {...handlers}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
