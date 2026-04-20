import { Copy, ExternalLink, Link2, Palette, Pencil, Settings2, Sparkles, Check, TrendingUp } from "lucide-react";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { DELIVERY_LABELS, formatCurrency, type Product, getCheckoutLink } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; dot: string; ring: string; text: string; glow: string }> = {
  active: {
    label: "Ativo",
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/25",
    text: "text-emerald-300",
    glow: "shadow-[0_0_12px_-2px_hsl(var(--success)/0.45)]",
  },
  inactive: {
    label: "Inativo",
    dot: "bg-muted-foreground/50",
    ring: "ring-border/60",
    text: "text-muted-foreground",
    glow: "",
  },
  pending_review: {
    label: "Em revisão",
    dot: "bg-amber-400",
    ring: "ring-amber-400/25",
    text: "text-amber-300",
    glow: "shadow-[0_0_12px_-2px_hsl(45_95%_55%/0.4)]",
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
    return full.replace(/^https?:\/\//, "").replace(/\/$/, "");
  } catch {
    return url;
  }
};

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  return (
    <div className="mx-auto w-full max-w-[1340px]">
      {toolbar && <div className="mb-5">{toolbar}</div>}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
        {products.map((product) => {
          const status = STATUS_META[product.status] || STATUS_META.inactive;
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const isCopied = copiedId === product.id;
          const themeLabel = THEME_LABELS[product.checkout_theme || "default"] || "Padrão";
          const linkPreview = product.checkout_url ? shortenLink(product.checkout_url) : null;
          const priceFormatted = formatCurrency(Number(product.price));
          const priceNumberOnly = priceFormatted.replace(/^R\$\s?/, "");
          const isActive = product.status === "active";

          return (
            <article
              key={product.id}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card",
                "shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset,0_1px_2px_0_hsl(var(--background)/0.4)]",
                "transition-all duration-300 ease-out",
                "hover:border-border hover:shadow-[0_1px_0_0_hsl(var(--border)/0.6)_inset,0_8px_24px_-12px_hsl(var(--background)/0.8)]",
                "hover:-translate-y-0.5",
              )}
            >
              {/* ── Hero ── */}
              <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border/80 bg-gradient-to-br from-muted/40 via-muted/20 to-background">
                {product.image_url ? (
                  <>
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                    {/* Top vignette for status pill legibility */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background/60 via-background/10 to-transparent" />
                    {/* Bottom gradient for price legibility */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/70 to-transparent" />
                  </>
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center">
                    {/* Subtle dot grid */}
                    <div
                      className="absolute inset-0 opacity-[0.05]"
                      style={{
                        backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
                        backgroundSize: "16px 16px",
                      }}
                    />
                    {/* Mega translucent price */}
                    <span className="relative font-display text-[92px] font-black leading-none tracking-tighter text-foreground/[0.08] tabular-nums select-none">
                      {priceNumberOnly}
                    </span>
                  </div>
                )}

                {/* Price (bottom-left) - with subtle backdrop */}
                <div className="absolute bottom-3.5 left-4 flex items-end gap-1.5">
                  <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/90 mb-1">
                    R$
                  </span>
                  <span className="font-display text-[26px] font-black leading-none tracking-tight text-success tabular-nums drop-shadow-[0_2px_8px_hsl(var(--success)/0.3)]">
                    {priceNumberOnly}
                  </span>
                </div>

                {/* Status pill - top right */}
                <div className="absolute right-3 top-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10.5px] font-bold backdrop-blur-md ring-1",
                    status.ring,
                    status.text,
                  )}>
                    <span className={cn("relative h-1.5 w-1.5 rounded-full", status.dot, status.glow)}>
                      {isActive && (
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                      )}
                    </span>
                    {status.label}
                  </span>
                </div>

                {/* Delivery type pill - top left */}
                <div className="absolute left-3 top-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-md ring-1 ring-border/60">
                    {deliveryLabel}
                  </span>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                  <h3 className="line-clamp-1 font-display text-[16px] font-bold leading-tight tracking-[-0.015em] text-foreground">
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
                    className={cn(
                      "group/link flex items-center gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5 text-left transition-all",
                      isCopied
                        ? "border-success/40 bg-success/5"
                        : "border-border/70 hover:border-border hover:bg-muted/40",
                    )}
                  >
                    <Link2 className="h-3 w-3 shrink-0 text-muted-foreground/60" strokeWidth={2.25} />
                    <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
                      {linkPreview}
                    </span>
                    {isCopied ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-success">
                        <Check className="h-3 w-3 shrink-0" strokeWidth={2.75} />
                        Copiado
                      </span>
                    ) : (
                      <Copy className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-colors group-hover/link:text-foreground" strokeWidth={2.25} />
                    )}
                  </button>
                )}

                {/* Checkout Builder pill */}
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-gradient-to-br from-success/[0.04] via-muted/10 to-transparent px-2.5 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success/10 ring-1 ring-success/20">
                      <Sparkles className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
                        Checkout builder
                      </p>
                      <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-foreground">
                        <span className="h-1 w-1 rounded-full bg-success" />
                        {themeLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                    className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2.5 py-1 text-[10.5px] font-bold text-success transition-all hover:bg-success/20 hover:border-success/40 active:scale-[0.97]"
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
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card text-[11.5px] font-bold text-foreground transition-all hover:border-border hover:bg-muted/40 active:scale-[0.98]"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onOpenPixels(product); }}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card text-[11.5px] font-bold text-foreground transition-all hover:border-border hover:bg-muted/40 active:scale-[0.98]"
                  >
                    <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Customizar
                  </button>
                  {product.checkout_url && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onOpenCheckout(product); }}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-foreground transition-all hover:border-border hover:bg-muted/40 active:scale-[0.95]"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  )}
                  <div onClick={(e) => e.stopPropagation()}>
                    <ProductActionsMenu
                      copied={isCopied}
                      product={product}
                      triggerClassName="h-9 w-9 rounded-lg border border-border/70 bg-card text-foreground hover:border-border hover:bg-muted/40 data-[state=open]:bg-muted/60 transition-all"
                      {...handlers}
                    />
                  </div>
                </div>

                {/* Footer meta */}
                {product.affiliate_enabled && (
                  <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
                      <TrendingUp className="h-3 w-3" strokeWidth={2.5} />
                      Afiliados ativos
                    </span>
                    <span className="rounded-md bg-success/10 px-1.5 py-0.5 text-[10.5px] font-black tabular-nums text-success ring-1 ring-success/20">
                      {product.affiliate_commission}%
                    </span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between px-1 text-[11.5px] text-muted-foreground/70">
        <span>
          Exibindo{" "}
          <span className="font-mono font-semibold text-foreground tabular-nums">{products.length}</span>{" "}
          {products.length === 1 ? "produto" : "produtos"}
        </span>
      </div>
    </div>
  );
}
