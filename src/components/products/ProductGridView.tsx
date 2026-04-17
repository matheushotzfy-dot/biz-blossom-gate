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

      <div className="rounded-2xl border border-border/80 bg-[hsl(var(--card))] p-4 shadow-[0_1px_2px_0_hsl(0_0%_0%/0.06),0_12px_32px_-18px_hsl(0_0%_0%/0.4)] ring-1 ring-foreground/[0.04]">
        <ul className="flex flex-col overflow-hidden rounded-xl bg-[hsl(var(--card-elevated))]">
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
                "group relative flex min-h-[96px] cursor-pointer items-center gap-8 px-6 py-5 transition-colors duration-200 ease-out",
                "hover:bg-foreground/[0.04]",
                idx > 0 && "before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-border/40"
              )}
            >
              {/* LEFT — product identity (dominant, ~70%) */}
              <div className="flex min-w-0 flex-[1_1_auto] items-center gap-5">
                <div className="relative h-16 w-16 shrink-0 self-center overflow-hidden rounded-2xl bg-[hsl(var(--card-elevated))] ring-1 ring-border/80 shadow-[0_2px_8px_-2px_hsl(0_0%_0%/0.22),inset_0_0_0_1px_hsl(0_0%_100%/0.03)]">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 to-primary/[0.06]">
                      <span className="font-display text-2xl font-black tracking-tight text-primary">{initial}</span>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-col">
                  <div className="truncate font-display text-[18px] font-bold leading-tight tracking-[-0.02em] text-foreground">
                    {product.name}
                  </div>
                  <div className="mt-1 truncate text-[13px] leading-snug text-muted-foreground/70">
                    {product.description || "Sem descrição"}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/40">
                    <span>{deliveryLabel}</span>
                    <span>•</span>
                    <span>{formatCompactDate(product.created_at)}</span>
                    <span>•</span>
                    <span className="font-mono normal-case tracking-normal">#{shortId}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT — commercial block (compact, anchored) */}
              <div className="flex shrink-0 items-center gap-5 border-l border-border/40 pl-6">
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-baseline gap-1">
                    {currencySymbol && (
                      <span className="font-numbers text-[12px] font-medium leading-none text-muted-foreground/55">
                        {currencySymbol}
                      </span>
                    )}
                    <span className="font-numbers text-[22px] font-bold leading-none tabular-nums tracking-[-0.02em] text-foreground">
                      {priceValue}
                    </span>
                  </div>
                  <ProductStatusIndicator status={product.status} tone="soft" />
                </div>

                <div
                  className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handlers.onEditProduct(product)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
                    title="Editar produto"
                    aria-label="Editar produto"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
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
    </div>
  );
}
