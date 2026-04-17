import { Copy, ExternalLink, Users } from "lucide-react";

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
          // Split currency symbol from value for typographic hierarchy
          const priceMatch = formattedPrice.match(/^(\D+)\s?(.+)$/);
          const currencySymbol = priceMatch?.[1]?.trim() ?? "";
          const priceValue = priceMatch?.[2] ?? formattedPrice;

          return (
            <li
              key={product.id}
              onClick={() => handlers.onEditProduct(product)}
              className={cn(
                "group relative flex cursor-pointer items-center gap-7 px-7 py-5 transition-colors duration-200",
                "hover:bg-foreground/[0.025]",
                idx !== 0 && "border-t border-border/40",
                idx % 2 === 1 && "bg-foreground/[0.008]"
              )}
            >
              {/* Active accent rail on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-3 left-0 w-[2px] rounded-r-full bg-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              />

              {/* ── ZONE 1: PRODUCT IDENTITY (dominant, breathable) ── */}
              <div className="flex min-w-0 flex-[2] items-center gap-5">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="font-display text-[34px] font-black leading-none text-primary/70">{initial}</span>
                    </div>
                  )}
                  {isActive && (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-success ring-2 ring-card" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-[17.5px] font-extrabold leading-tight tracking-[-0.015em] text-foreground">
                      {product.name}
                    </h3>
                    {product.affiliate_enabled && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-primary">
                        <Users className="h-2.5 w-2.5" strokeWidth={2.5} />
                        {product.affiliate_commission}%
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[12.5px] leading-snug text-muted-foreground/70">
                    {product.description || "Sem descrição"}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10.5px] font-medium text-muted-foreground/40">
                    <span>{formatCompactDate(product.created_at)}</span>
                    <span className="text-muted-foreground/25">·</span>
                    <span className="font-mono uppercase tracking-wider">#{product.id.slice(0, 6)}</span>
                  </div>
                </div>
              </div>

              {/* ── ZONE 2: TYPE + META (subtle) ── */}
              <div className="hidden w-[120px] shrink-0 flex-col gap-1 md:flex">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {deliveryLabel}
                </span>
                {checkoutLink && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-success/70">
                    <span className="h-1 w-1 rounded-full bg-success" />
                    Online
                  </span>
                )}
              </div>

              {/* ── ZONE 3: COMMERCIAL (high impact) ── */}
              <div className="hidden w-[150px] shrink-0 flex-col items-end gap-2 md:flex">
                <div className="flex items-baseline gap-1">
                  {currencySymbol && (
                    <span className="font-numbers text-[12px] font-semibold leading-none text-muted-foreground/55">
                      {currencySymbol}
                    </span>
                  )}
                  <span className="font-numbers text-[26px] font-black leading-none tabular-nums tracking-[-0.02em] text-foreground">
                    {priceValue}
                  </span>
                </div>
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* ── ZONE 4: ACTIONS (minimal) ── */}
              <div
                className="flex shrink-0 items-center gap-0.5"
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
