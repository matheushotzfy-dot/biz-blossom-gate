import { Pencil } from "lucide-react";
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
      {toolbar && <div className="mb-5 px-1">{toolbar}</div>}

      <div className="rounded-2xl border border-border bg-[hsl(var(--card-elevated))] p-2 shadow-[0_1px_2px_0_hsl(0_0%_0%/0.04),0_8px_24px_-16px_hsl(0_0%_0%/0.3)] ring-1 ring-foreground/[0.03]">
        <ul className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-[hsl(var(--card-inset))]">
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
                "group relative flex cursor-pointer items-stretch gap-8 px-7 py-6 transition-colors duration-200 ease-out",
                "hover:bg-foreground/[0.04]",
                idx > 0 && "before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-border/40"
              )}
            >
              {/* ═══════════ LEFT — Product identity (dominant) ═══════════ */}
              <div className="flex min-w-0 flex-[1_1_0%] items-center gap-7">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[hsl(var(--card-elevated))] ring-1 ring-border shadow-[0_1px_2px_0_hsl(0_0%_0%/0.06),0_4px_12px_-4px_hsl(0_0%_0%/0.12)]">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 to-primary/[0.06]">
                      <span className="font-display text-2xl font-black tracking-tight text-primary">{initial}</span>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <h3 className="truncate font-display text-[19px] font-extrabold leading-[1.15] tracking-[-0.025em] text-foreground">
                    {product.name}
                  </h3>
                  <p className="mt-1.5 truncate text-[13px] font-normal leading-snug text-muted-foreground/70">
                    {product.description || "Sem descrição"}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/40">
                    <span>{deliveryLabel}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/25" />
                    <span>{formatCompactDate(product.created_at)}</span>
                    <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/25" />
                    <span className="font-mono normal-case tracking-normal">{shortId}</span>
                  </div>
                </div>
              </div>

              {/* ═══════════ RIGHT — Commercial block (compact) ═══════════ */}
              {/* ═══════════ RIGHT — Commercial block + minimal actions ═══════════ */}
              <div className="flex shrink-0 items-center gap-5">
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-baseline gap-1">
                    {currencySymbol && (
                      <span className="font-numbers text-[11px] font-semibold uppercase leading-none text-muted-foreground/45">
                        {currencySymbol}
                      </span>
                    )}
                    <span className="font-numbers text-[26px] font-black leading-none tabular-nums tracking-[-0.04em] text-foreground">
                      {priceValue}
                    </span>
                  </div>
                  <ProductStatusIndicator status={product.status} tone="soft" />
                </div>

                <div
                  className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handlers.onEditProduct(product)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
                    title="Editar produto"
                    aria-label="Editar produto"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <ProductActionsMenu
                    copied={isCopied}
                    product={product}
                    triggerClassName="h-8 w-8 rounded-lg text-muted-foreground/60 hover:bg-secondary hover:text-foreground"
                    {...handlers}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      </div>
    </div>
  );
}
