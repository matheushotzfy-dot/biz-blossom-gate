import { MoreHorizontal, Pencil } from "lucide-react";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCurrency, formatCompactDate, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      {toolbar && <div className="mb-4 px-1">{toolbar}</div>}

      <ul className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-[0_1px_0_0_hsl(var(--border)/0.4),0_24px_60px_-30px_hsl(var(--background)/0.8)] backdrop-blur-sm">
        {products.map((product, idx) => {
          const deliveryLabel = (DELIVERY_LABELS[product.delivery_type] || product.delivery_type).toUpperCase();
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
              className={cn(
                "group relative flex cursor-pointer items-center gap-5 px-5 py-5 transition-colors duration-150",
                "hover:bg-foreground/[0.04]",
                idx > 0 && "border-t border-border/30"
              )}
            >
              {/* ─────────── LEFT — Product identity ─────────── */}
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-primary/10 to-transparent">
                      <span className="font-display text-2xl font-black text-primary/80">{initial}</span>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 className="truncate font-display text-[16px] font-bold leading-tight tracking-[-0.01em] text-foreground">
                    {product.name}
                  </h3>
                  <p className="truncate text-[13px] leading-snug text-muted-foreground/65">
                    {product.description || "Sem descrição"}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/45">
                    <span>{deliveryLabel}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/30" />
                    <span>{formatCompactDate(product.created_at)}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/30" />
                    <span className="font-mono normal-case tracking-normal text-muted-foreground/45">{shortId}</span>
                  </div>
                </div>
              </div>

              {/* ─────────── RIGHT — Commercial block ─────────── */}
              <div className="flex shrink-0 items-center gap-5">
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-baseline gap-1">
                    {currencySymbol && (
                      <span className="font-numbers text-[11px] font-semibold uppercase leading-none text-muted-foreground/55">
                        {currencySymbol}
                      </span>
                    )}
                    <span className="font-numbers text-[26px] font-black leading-none tabular-nums tracking-[-0.035em] text-foreground">
                      {priceValue}
                    </span>
                  </div>
                  <ProductStatusIndicator status={product.status} tone="soft" />
                </div>

                <div
                  className="flex shrink-0 items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handlers.onEditProduct(product)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/70 transition-all hover:bg-secondary hover:text-foreground"
                    title="Editar produto"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </button>
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
