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
    <div className="rounded-xl border border-border/60 bg-card">
      {toolbar && <div className="border-b border-border/60 px-5 py-3">{toolbar}</div>}

      <ul className="divide-y divide-border/40">
        {products.map((product) => {
          const deliveryLabel = (DELIVERY_LABELS[product.delivery_type] || product.delivery_type).toUpperCase();
          const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;
          const initial = product.name.charAt(0).toUpperCase();
          const isCopied = copiedId === product.id;
          const formattedPrice = formatCurrency(Number(product.price));
          const priceMatch = formattedPrice.match(/^(\D+)\s?(.+)$/);
          const currencySymbol = priceMatch?.[1]?.trim() ?? "";
          const priceValue = priceMatch?.[2] ?? formattedPrice;
          const shortId = product.id.slice(0, 6).toUpperCase();

          return (
            <li
              key={product.id}
              onClick={() => handlers.onEditProduct(product)}
              className="group flex h-[84px] cursor-pointer items-center gap-4 px-5 transition-colors duration-150 hover:bg-foreground/[0.025]"
            >
              {/* ─────────────── LEFT (70%) — IDENTITY ─────────────── */}
              <div className="flex min-w-0 flex-[7] items-center gap-3">
                {/* Thumbnail 56px */}
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <span className="font-display text-xl font-bold text-primary/70">{initial}</span>
                    </div>
                  )}
                </div>

                {/* Content block */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <h3 className="truncate font-display text-[15px] font-bold leading-tight text-foreground">
                    {product.name}
                  </h3>
                  <p className="mt-0.5 truncate text-[12.5px] leading-snug text-muted-foreground/70">
                    {product.description || "Sem descrição"}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/45">
                    <span>{deliveryLabel}</span>
                    <span className="text-muted-foreground/25">•</span>
                    <span>{formatCompactDate(product.created_at)}</span>
                    <span className="text-muted-foreground/25">•</span>
                    <span className="font-mono normal-case tracking-normal">{shortId}</span>
                  </div>
                </div>
              </div>

              {/* ─────────────── RIGHT (30%) — COMMERCIAL ─────────────── */}
              <div className="flex flex-[3] shrink-0 items-center justify-end gap-4">
                {/* Price + status stack */}
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-baseline gap-1">
                    {currencySymbol && (
                      <span className="font-numbers text-[11px] font-semibold uppercase leading-none text-muted-foreground/50">
                        {currencySymbol}
                      </span>
                    )}
                    <span className="font-numbers text-[22px] font-black leading-none tabular-nums tracking-[-0.03em] text-foreground">
                      {priceValue}
                    </span>
                  </div>
                  <ProductStatusIndicator status={product.status} tone="soft" />
                </div>

                {/* Actions */}
                <div
                  className="flex shrink-0 items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {checkoutLink && (
                    <button
                      onClick={() => handlers.onCopyLink(product)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                        isCopied
                          ? "bg-success/15 text-success"
                          : "text-muted-foreground/60 hover:bg-secondary hover:text-foreground"
                      )}
                      title="Copiar link"
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  )}
                  {checkoutLink && (
                    <button
                      onClick={() => handlers.onOpenCheckout(product)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  )}
                  <ProductActionsMenu
                    copied={isCopied}
                    product={product}
                    triggerClassName="h-8 w-8 rounded-md text-muted-foreground/60 hover:bg-secondary hover:text-foreground"
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
