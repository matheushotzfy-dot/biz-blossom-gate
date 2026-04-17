import {
  ArrowUpRight,
  Calendar,
  Copy,
  ExternalLink,
  Package,
  Pencil,
  Users,
} from "lucide-react";

import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { ProductStatusIndicator } from "./ProductStatusIndicator";
import { DELIVERY_LABELS, formatCurrency, formatCompactDate, getCheckoutLink, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header ribbon */}
      <div className="grid grid-cols-[1fr_120px_140px_120px_80px] items-center gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
        <span>Produto</span>
        <span className="text-center">Entrega</span>
        <span className="text-right">Preço</span>
        <span className="text-center">Status</span>
        <span className="text-right">Ações</span>
      </div>

      <ul className="divide-y divide-border">
        {products.map((product) => {
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const checkoutLink = product.checkout_url ? getCheckoutLink(product.checkout_url) : null;
          const initial = product.name.charAt(0).toUpperCase();
          const price = Number(product.price);
          const isCopied = copiedId === product.id;

          return (
            <li
              key={product.id}
              onClick={() => handlers.onEditProduct(product)}
              className="group relative grid cursor-pointer grid-cols-[1fr_120px_140px_120px_80px] items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
            >
              {/* Product identity */}
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                      <span className="font-display text-xl font-black text-primary/70">{initial}</span>
                    </div>
                  )}
                  {checkoutLink && (
                    <span className="absolute -right-1 -top-1 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                      <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-card bg-success" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[14px] font-bold leading-tight text-foreground">
                      {product.name}
                    </h3>
                    {product.affiliate_enabled && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                        <Users className="h-2.5 w-2.5" strokeWidth={2.2} />
                        {product.affiliate_commission}%
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{product.description || "Sem descrição"}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/70">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" strokeWidth={1.8} />
                      {formatCompactDate(product.created_at)}
                    </span>
                    <span className="font-mono uppercase tracking-widest">#{product.id.slice(0, 6)}</span>
                  </div>
                </div>
              </div>

              {/* Delivery */}
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
                  <Package className="h-3 w-3" strokeWidth={2} />
                  {deliveryLabel}
                </span>
              </div>

              {/* Price */}
              <div className="flex flex-col items-end">
                <span className="font-numbers text-[17px] font-black tabular-nums tracking-tight text-foreground">
                  {formatCurrency(price)}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">BRL</span>
              </div>

              {/* Status */}
              <div className="flex justify-center">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* Actions */}
              <div
                className="flex items-center justify-end gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {checkoutLink && (
                  <>
                    <button
                      onClick={() => handlers.onCopyLink(product)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                        isCopied
                          ? "border-success/40 bg-success/15 text-success"
                          : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground"
                      )}
                      title="Copiar link"
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                    <button
                      onClick={() => handlers.onOpenCheckout(product)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => handlers.onEditProduct(product)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
                <ProductActionsMenu
                  copied={isCopied}
                  product={product}
                  triggerClassName="h-8 w-8 rounded-lg border border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground"
                  {...handlers}
                />
              </div>

              {/* Hover indicator */}
              <ArrowUpRight
                className="pointer-events-none absolute right-2 top-2 h-3 w-3 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/30"
                strokeWidth={2}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
