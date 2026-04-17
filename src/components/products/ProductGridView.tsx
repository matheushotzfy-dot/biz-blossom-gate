import {
  Copy,
  ExternalLink,
  Pencil,
  Sparkles,
  Users,
} from "lucide-react";

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
    <div className="space-y-4">
      {toolbar && (
        <div className="rounded-xl border border-border bg-card px-5 py-3">{toolbar}</div>
      )}

      <ul className="space-y-3">
        {products.map((product) => {
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;
          const initial = product.name.charAt(0).toUpperCase();
          const price = Number(product.price);
          const isCopied = copiedId === product.id;
          const isActive = product.status === "active";

          return (
            <li
              key={product.id}
              onClick={() => handlers.onEditProduct(product)}
              className="group relative flex cursor-pointer items-stretch overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-primary/30 hover:bg-card/80"
            >
              {/* Active accent rail */}
              <div
                className={cn(
                  "w-[3px] shrink-0 transition-colors duration-300",
                  isActive ? "bg-success" : "bg-transparent group-hover:bg-primary/40"
                )}
              />

              {/* ── PRODUTO (dominant, with large thumb) ── */}
              <div className="flex min-w-0 flex-1 items-center gap-5 py-4 pl-5 pr-4">
                {/* Hero thumbnail */}
                <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-primary/10 to-transparent">
                      <span className="font-display text-4xl font-black text-primary/80">{initial}</span>
                    </div>
                  )}
                </div>

                {/* Title + description + metadata */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {/* Top row: title + affiliate */}
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-[17px] font-bold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {product.name}
                    </h3>
                    {product.affiliate_enabled && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-primary">
                        <Users className="h-2.5 w-2.5" strokeWidth={2.5} />
                        {product.affiliate_commission}%
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="line-clamp-1 text-[13px] leading-snug text-muted-foreground">
                    {product.description || "Sem descrição"}
                  </p>

                  {/* Metadata row */}
                  <div className="mt-1 flex items-center gap-3 text-[10.5px] font-medium text-muted-foreground/60">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-success" : "bg-muted-foreground/30")} />
                      <span className="uppercase tracking-wider">{deliveryLabel}</span>
                    </span>
                    <span className="h-3 w-px bg-border" />
                    <span>{formatCompactDate(product.created_at)}</span>
                    <span className="h-3 w-px bg-border" />
                    <span className="font-mono uppercase tracking-wider">#{product.id.slice(0, 6)}</span>
                    {checkoutLink && (
                      <>
                        <span className="h-3 w-px bg-border" />
                        <span className="inline-flex items-center gap-1 text-success/80">
                          <Sparkles className="h-2.5 w-2.5" strokeWidth={2.2} />
                          <span className="uppercase tracking-wider">Online</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── PRICE + STATUS sidebar ── */}
              <div className="hidden shrink-0 flex-col items-end justify-center gap-2 border-l border-border/60 px-6 py-4 md:flex">
                <span className="font-numbers text-[22px] font-black leading-none tabular-nums tracking-tight text-foreground">
                  {formatCurrency(price)}
                </span>
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* ── ACTIONS ── */}
              <div
                className="flex shrink-0 items-center gap-0.5 border-l border-border/60 px-3 py-4 opacity-50 transition-opacity duration-200 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                {checkoutLink && (
                  <button
                    onClick={() => handlers.onCopyLink(product)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                      isCopied
                        ? "bg-success/15 text-success"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                    title="Copiar link"
                  >
                    <Copy className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                )}
                {checkoutLink && (
                  <button
                    onClick={() => handlers.onOpenCheckout(product)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    title="Abrir checkout"
                  >
                    <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                )}
                <button
                  onClick={() => handlers.onEditProduct(product)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <ProductActionsMenu
                  copied={isCopied}
                  product={product}
                  triggerClassName="h-9 w-9 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
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
