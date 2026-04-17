import {
  Copy,
  ExternalLink,
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
  toolbar?: React.ReactNode;
};

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {toolbar && (
        <div className="border-b border-border px-6 py-3.5">{toolbar}</div>
      )}

      <ul className="divide-y divide-border/60">
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
              className="group relative flex cursor-pointer items-center gap-6 px-6 py-5 transition-colors duration-200 hover:bg-secondary/40"
            >
              {/* ── PRODUTO (dominant) ── */}
              <div className="flex min-w-0 flex-1 items-center gap-5">
                {/* Premium thumbnail */}
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted ring-1 ring-border/40">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                      <span className="font-display text-3xl font-black text-primary/70">{initial}</span>
                    </div>
                  )}
                  {checkoutLink && (
                    <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-success ring-2 ring-card" />
                    </span>
                  )}
                </div>

                {/* Title + metadata stack */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="truncate font-display text-[16px] font-bold leading-tight tracking-tight text-foreground">
                      {product.name}
                    </h3>
                    {product.affiliate_enabled && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                        <Users className="h-2.5 w-2.5" strokeWidth={2.4} />
                        {product.affiliate_commission}%
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[12.5px] leading-snug text-muted-foreground">
                    {product.description || "Sem descrição"}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10.5px] font-medium text-muted-foreground/60">
                    <span>{formatCompactDate(product.created_at)}</span>
                    <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/40" />
                    <span className="font-mono uppercase tracking-wider">#{product.id.slice(0, 6)}</span>
                  </div>
                </div>
              </div>

              {/* ── ENTREGA (subtle badge) ── */}
              <div className="hidden w-[110px] shrink-0 md:block">
                <span className="text-[11px] font-medium text-muted-foreground/80">
                  {deliveryLabel}
                </span>
              </div>

              {/* ── PREÇO (prominent) ── */}
              <div className="hidden w-[120px] shrink-0 flex-col items-end md:flex">
                <span className="font-numbers text-[20px] font-black leading-none tabular-nums tracking-tight text-foreground">
                  {formatCurrency(price)}
                </span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">BRL</span>
              </div>

              {/* ── STATUS (premium badge) ── */}
              <div className="hidden w-[100px] shrink-0 justify-center md:flex">
                <ProductStatusIndicator status={product.status} tone="soft" />
              </div>

              {/* ── AÇÕES (clean) ── */}
              <div
                className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity duration-200 group-hover:opacity-100"
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
