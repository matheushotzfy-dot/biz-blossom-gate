import { MoreHorizontal } from "lucide-react";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { DELIVERY_LABELS, formatCurrency, formatCompactDate, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: "Active", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  inactive: { label: "Inactive", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
  pending_review: { label: "Pending", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
};

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      {toolbar && <div className="mb-4">{toolbar}</div>}

      {/* Stripe-style table: borderless rows, dense, monospace numerics */}
      <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
        {/* Column header */}
        <div className="grid grid-cols-[minmax(0,1fr)_160px_120px_120px_40px] items-center gap-6 border-b border-border/60 bg-muted/20 px-5 py-2.5 text-[11px] font-medium text-muted-foreground">
          <div>Name</div>
          <div className="text-right">Price</div>
          <div>Status</div>
          <div>Created</div>
          <div />
        </div>

        {/* Rows */}
        <ul className="divide-y divide-border/50">
          {products.map((product) => {
            const status = STATUS_META[product.status] || STATUS_META.inactive;
            const initial = product.name.charAt(0).toUpperCase();
            const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
            const isCopied = copiedId === product.id;
            const shortId = `prod_${product.id.slice(0, 14)}`;

            return (
              <li
                key={product.id}
                onClick={() => handlers.onEditProduct(product)}
                className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_160px_120px_120px_40px] items-center gap-6 px-5 py-3 transition-colors hover:bg-muted/30"
              >
                {/* Name + identity */}
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
                    {product.image_url ? (
                      <img src={product.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                        <span className="text-[13px] font-semibold text-primary/80">{initial}</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium leading-tight text-foreground">
                      {product.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] leading-tight text-muted-foreground">
                      <span className="capitalize">{deliveryLabel}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="font-mono text-[10.5px] tracking-tight">{shortId}</span>
                    </div>
                  </div>
                </div>

                {/* Price — tabular, right-aligned, like Stripe amount column */}
                <div className="text-right">
                  <span className="font-mono text-[13.5px] font-medium tabular-nums text-foreground">
                    {formatCurrency(Number(product.price))}
                  </span>
                </div>

                {/* Status — minimal dot + label, no badge chrome */}
                <div className={cn("flex items-center gap-1.5 text-[12px] font-medium", status.text)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                  {status.label}
                </div>

                {/* Created date */}
                <div className="text-[12px] text-muted-foreground">
                  {formatCompactDate(product.created_at)}
                </div>

                {/* Actions — single icon, appears on hover */}
                <div
                  className="flex justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ProductActionsMenu
                    copied={isCopied}
                    product={product}
                    triggerClassName="h-7 w-7 rounded-md text-muted-foreground/60 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                    {...handlers}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer count — Stripe-style */}
      <div className="mt-3 px-1 text-[11.5px] text-muted-foreground">
        {products.length} {products.length === 1 ? "product" : "products"}
      </div>
    </div>
  );
}
