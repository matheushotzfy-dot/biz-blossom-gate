import { Copy, ExternalLink, MoreHorizontal, Palette, Pencil, Settings2, Sparkles, Check } from "lucide-react";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { DELIVERY_LABELS, formatCurrency, type Product, getCheckoutLink } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; dot: string; pillBg: string; text: string }> = {
  active: {
    label: "Ativo",
    dot: "bg-emerald-400",
    pillBg: "bg-background/80 border-border/70",
    text: "text-emerald-300",
  },
  inactive: {
    label: "Inativo",
    dot: "bg-muted-foreground/60",
    pillBg: "bg-background/80 border-border/70",
    text: "text-muted-foreground",
  },
  pending_review: {
    label: "Em revisão",
    dot: "bg-amber-400",
    pillBg: "bg-background/80 border-border/70",
    text: "text-amber-300",
  },
};

const THEME_LABELS: Record<string, string> = {
  default: "Padrão",
  dark: "Cinza Escuro",
  light: "Cinza Suave",
  premium: "Premium",
};

const shortenLink = (url: string) => {
  try {
    const full = getCheckoutLink(url);
    return full.replace(/^https?:\/\//, "");
  } catch {
    return url;
  }
};

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  return (
    <div className="mx-auto w-full max-w-[1340px]">
      {toolbar && <div className="mb-5">{toolbar}</div>}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const status = STATUS_META[product.status] || STATUS_META.inactive;
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const isCopied = copiedId === product.id;
          const themeLabel = THEME_LABELS[product.checkout_theme || "default"] || "Padrão";
          const linkPreview = product.checkout_url ? shortenLink(product.checkout_url) : null;
          const priceFormatted = formatCurrency(Number(product.price));
          const priceNumberOnly = priceFormatted.replace(/^R\$\s?/, "");

          return (
            <article
              key={product.id}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card",
                "transition-colors duration-200 hover:border-border/90",
              )}
            >
              {/* ── Hero ── */}
              <div className="relative aspect-[16/11] w-full overflow-hidden border-b border-border">
                {product.image_url ? (
                  <>
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {/* Bottom gradient for price legibility */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
                  </>
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center bg-muted/40">
                    {/* Mega translucent price */}
                    <span className="font-display text-[88px] font-black leading-none tracking-tighter text-foreground/12 tabular-nums select-none">
                      {priceNumberOnly}
                    </span>
                  </div>
                )}

                {/* Price (green, bold, bottom-left) */}
                <div className="absolute bottom-3 left-4">
                  <span className="font-display text-[22px] font-black leading-none tracking-tight text-success tabular-nums">
                    {priceFormatted}
                  </span>
                </div>

                {/* Status pill - top right */}
                <div className="absolute right-3 top-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold backdrop-blur-md",
                    status.pillBg,
                    status.text,
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                    {status.label}
                  </span>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                  <h3 className="line-clamp-1 font-display text-[15px] font-bold leading-tight tracking-[-0.01em] text-foreground">
                    {product.name}
                  </h3>
                  <p className={cn(
                    "mt-1 line-clamp-1 text-[12px] leading-snug",
                    product.description ? "text-muted-foreground" : "italic text-muted-foreground/50",
                  )}>
                    {product.description || "Sem descrição"}
                  </p>
                </div>

                {/* Link preview pill */}
                {linkPreview && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onCopyLink(product); }}
                    className="group/link flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-left transition-colors hover:border-border/90 hover:bg-muted/50"
                  >
                    <span className="text-[11px] text-muted-foreground/60">🔗</span>
                    <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
                      {linkPreview}
                    </span>
                    {isCopied ? (
                      <Check className="h-3 w-3 shrink-0 text-success" strokeWidth={2.75} />
                    ) : (
                      <Copy className="h-3 w-3 shrink-0 text-muted-foreground/60 transition-colors group-hover/link:text-foreground" strokeWidth={2.25} />
                    )}
                  </button>
                )}

                {/* Checkout Builder pill */}
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.25} />
                    <div className="min-w-0">
                      <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        Checkout builder
                      </p>
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        {themeLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                    className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2.5 py-1 text-[10.5px] font-bold text-success transition-colors hover:bg-success/20"
                  >
                    <Palette className="h-3 w-3" strokeWidth={2.5} />
                    Editar
                  </button>
                </div>

                {/* Action row */}
                <div className="mt-1 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-[11.5px] font-bold text-foreground transition-colors hover:bg-muted/50"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onOpenPixels(product); }}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-[11.5px] font-bold text-foreground transition-colors hover:bg-muted/50"
                  >
                    <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Customizar
                  </button>
                  {product.checkout_url && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onOpenCheckout(product); }}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted/50"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  )}
                  <div onClick={(e) => e.stopPropagation()}>
                    <ProductActionsMenu
                      copied={isCopied}
                      product={product}
                      triggerClassName="h-9 w-9 rounded-lg border border-border bg-card text-foreground hover:bg-muted/50 data-[state=open]:bg-muted"
                      {...handlers}
                    />
                  </div>
                </div>

                {/* Footer meta */}
                <div className="flex items-center justify-between border-t border-border pt-2.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                  <span>{deliveryLabel}</span>
                  {product.affiliate_enabled && (
                    <span className="text-success/80">{product.affiliate_commission}% afiliado</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between px-1 text-[11.5px] text-muted-foreground/70">
        <span>
          <span className="font-mono font-semibold text-foreground tabular-nums">{products.length}</span>{" "}
          {products.length === 1 ? "produto" : "produtos"}
        </span>
      </div>
    </div>
  );
}
