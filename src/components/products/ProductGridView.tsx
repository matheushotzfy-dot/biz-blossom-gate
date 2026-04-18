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

      <div className="rounded-2xl border border-border/70 bg-[hsl(var(--card))] p-3 shadow-[0_1px_2px_0_hsl(0_0%_0%/0.06),0_20px_48px_-24px_hsl(0_0%_0%/0.5)] ring-1 ring-foreground/[0.04]">
        <ul className="flex flex-col overflow-hidden rounded-xl">
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
                "group relative flex min-h-[128px] cursor-pointer items-center gap-10 px-7 py-8 transition-all duration-200 ease-out",
                idx % 2 === 1 && "bg-foreground/[0.012]",
                "hover:bg-foreground/[0.04] hover:shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.05)]",
                idx > 0 && "before:absolute before:inset-x-7 before:top-0 before:h-px before:bg-border/20"
              )}
            >
              {/* LEFT — product identity (dominant, breathable) */}
              <div className="flex min-w-0 flex-[1_1_65%] items-center gap-6">
                <div className="relative h-[72px] w-[72px] shrink-0 self-center overflow-hidden rounded-2xl bg-[hsl(var(--card-elevated))] ring-1 ring-border/70 shadow-[0_4px_14px_-4px_hsl(0_0%_0%/0.35),inset_0_0_0_1px_hsl(0_0%_100%/0.04)] transition-transform duration-200 group-hover:scale-[1.02]">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 to-primary/[0.06]">
                      <span className="font-display text-[28px] font-black tracking-tight text-primary">{initial}</span>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-col">
                  <div className="truncate font-display text-[20px] font-bold leading-[1.15] tracking-[-0.025em] text-foreground">
                    {product.name}
                  </div>
                  <div className="mt-1 truncate text-[12px] font-normal leading-snug text-muted-foreground/40">
                    {product.description || "Sem descrição"}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground/35">
                    <span>{deliveryLabel}</span>
                    <span className="text-muted-foreground/25">•</span>
                    <span>{formatCompactDate(product.created_at)}</span>
                    <span className="text-muted-foreground/25">•</span>
                    <span className="font-mono normal-case tracking-normal">#{shortId}</span>
                  </div>
                </div>
              </div>

              {/* RIGHT — commercial block (anchored, lighter weight) */}
              <div className="flex shrink-0 items-center gap-4 border-l border-border/30 pl-8">
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-baseline gap-1">
                    {currencySymbol && (
                      <span className="font-numbers text-[11px] font-medium leading-none text-muted-foreground/40">
                        {currencySymbol}
                      </span>
                    )}
                    <span className="font-numbers text-[32px] font-black leading-none tabular-nums tracking-[-0.04em] text-foreground">
                      {priceValue}
                    </span>
                  </div>
                  <ProductStatusIndicator status={product.status} tone="soft" />
                </div>

                <div
                  className="flex items-center gap-0.5 self-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handlers.onEditProduct(product)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                    title="Editar produto"
                    aria-label="Editar produto"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                  <ProductActionsMenu
                    copied={isCopied}
                    product={product}
                    triggerClassName="h-8 w-8 rounded-lg text-muted-foreground/40 hover:bg-foreground/[0.06] hover:text-foreground"
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
