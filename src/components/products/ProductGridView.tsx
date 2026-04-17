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
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/40">
      {toolbar && (
        <div className="border-b border-border/50 bg-card/60 px-6 py-3.5">{toolbar}</div>
      )}

      <ul className="divide-y divide-border/30">
        {products.map((product) => {
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
              className="group relative flex min-h-[96px] cursor-pointer items-center gap-6 px-6 py-4 transition-colors duration-150 hover:bg-foreground/[0.035]"
            >
              {/* Active indicator bar on hover */}
              <span className="absolute inset-y-3 left-0 w-[2px] rounded-r-full bg-primary opacity-0 transition-opacity group-hover:opacity-100" />

              {/* ─────────── LEFT — IDENTITY (≈72%) ─────────── */}
              <div className="flex min-w-0 flex-[72] items-center gap-4">
                {/* Thumbnail 64x64 */}
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/40">
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

                {/* Identity block */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 className="truncate font-display text-[16px] font-bold leading-tight tracking-[-0.01em] text-foreground">
                    {product.name}
                  </h3>
                  <p className="truncate text-[13px] leading-snug text-muted-foreground/65">
                    {product.description || "Sem descrição"}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/40">
                    <span>{deliveryLabel}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/30" />
                    <span>{formatCompactDate(product.created_at)}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/30" />
                    <span className="font-mono normal-case tracking-normal text-muted-foreground/45">{shortId}</span>
                  </div>
                </div>
              </div>

              {/* ─────────── RIGHT — COMMERCIAL (≈28%) ─────────── */}
              <div className="flex flex-[28] shrink-0 items-center justify-end gap-5">
                {/* Price + status stack */}
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

                {/* Actions — minimal, intentional */}
                <div
                  className="flex shrink-0 items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handlers.onEditProduct(product)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/40 text-muted-foreground/75 transition-all hover:border-border hover:bg-secondary hover:text-foreground"
                    title="Editar produto"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                  <ProductActionsMenu
                    copied={isCopied}
                    product={product}
                    triggerClassName={cn(
                      "h-9 w-9 rounded-lg border border-border/50 bg-background/40 text-muted-foreground/75",
                      "hover:border-border hover:bg-secondary hover:text-foreground"
                    )}
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
