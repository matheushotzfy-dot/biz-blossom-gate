import { Copy, ExternalLink, Link2, Palette, Pencil, Settings2, Sparkles, Check } from "lucide-react";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { DELIVERY_LABELS, formatCurrency, type Product, getCheckoutLink } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  active: {
    label: "Ativo",
    dot: "bg-emerald-400 shadow-[0_0_8px_hsl(152_76%_60%/0.7)]",
    text: "text-emerald-300",
  },
  inactive: {
    label: "Inativo",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
  },
  pending_review: {
    label: "Em revisão",
    dot: "bg-amber-400 shadow-[0_0_8px_hsl(45_93%_60%/0.7)]",
    text: "text-amber-300",
  },
};

// Deterministic gradient per product for thumbnail fallback
const GRADIENTS = [
  "from-violet-500/40 via-fuchsia-500/30 to-rose-500/35",
  "from-sky-500/40 via-cyan-500/30 to-emerald-500/35",
  "from-amber-500/40 via-orange-500/30 to-rose-500/35",
  "from-emerald-500/40 via-teal-500/30 to-cyan-500/35",
  "from-indigo-500/40 via-violet-500/30 to-purple-500/35",
  "from-rose-500/40 via-pink-500/30 to-fuchsia-500/35",
];

const THEME_LABELS: Record<string, string> = {
  default: "Padrão",
  dark: "Cinza Escuro",
  light: "Cinza Suave",
  premium: "Premium",
};

const gradientFor = (id: string) => {
  const sum = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[sum % GRADIENTS.length];
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
    <div className="mx-auto w-full max-w-[1280px]">
      {toolbar && <div className="mb-5">{toolbar}</div>}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const status = STATUS_META[product.status] || STATUS_META.inactive;
          const initial = product.name.charAt(0).toUpperCase();
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const isCopied = copiedId === product.id;
          const gradient = gradientFor(product.id);
          const themeLabel = THEME_LABELS[product.checkout_theme || "default"] || "Padrão";
          const linkPreview = product.checkout_url ? shortenLink(product.checkout_url) : null;

          return (
            <article
              key={product.id}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card",
                "shadow-[0_1px_0_0_hsl(var(--foreground)/0.04)_inset,0_8px_24px_-12px_hsl(0_0%_0%/0.4)]",
                "transition-all duration-300",
                "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_1px_0_0_hsl(var(--foreground)/0.06)_inset,0_20px_44px_-16px_hsl(var(--primary)/0.3)]",
              )}
            >
              {/* ── Hero: image OR mega-price ── */}
              <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border/40">
                {product.image_url ? (
                  <>
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                    {/* Price overlay on image */}
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <span className="font-numbers text-[26px] font-black leading-none tracking-tight text-emerald-400 tabular-nums drop-shadow-[0_2px_8px_hsl(152_76%_30%/0.6)]">
                        {formatCurrency(Number(product.price))}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className={cn("relative flex h-full w-full items-center justify-center bg-gradient-to-br", gradient)}>
                    {/* Mega price - center stage like the reference */}
                    <div className="absolute inset-0 flex items-center justify-center px-6">
                      <span className="font-numbers text-[64px] font-black leading-none tracking-tighter text-foreground/90 tabular-nums drop-shadow-2xl">
                        {formatCurrency(Number(product.price)).replace("R$", "").trim()}
                      </span>
                    </div>
                    <span className="absolute right-4 bottom-3 font-numbers text-[16px] font-bold tabular-nums text-emerald-400 drop-shadow-md">
                      {formatCurrency(Number(product.price))}
                    </span>
                    {/* Initial chip top-left */}
                    <span className="absolute left-3 top-12 font-display text-[12px] font-black uppercase text-foreground/30">
                      {initial}
                    </span>
                  </div>
                )}

                {/* Status pill - top right */}
                <div className="absolute right-3 top-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-[10.5px] font-bold backdrop-blur-md",
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
                  <h3 className="line-clamp-1 font-display text-[15.5px] font-bold leading-tight tracking-[-0.01em] text-foreground">
                    {product.name}
                  </h3>
                  <p className={cn(
                    "mt-1 line-clamp-1 text-[12px] leading-snug",
                    product.description ? "text-muted-foreground/70" : "italic text-muted-foreground/40",
                  )}>
                    {product.description || "Sem descrição"}
                  </p>
                </div>

                {/* Link preview pill */}
                {linkPreview && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onCopyLink(product); }}
                    className="group/link flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-secondary/40 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-secondary/70"
                  >
                    <Link2 className="h-3 w-3 shrink-0 text-primary/70" strokeWidth={2.5} />
                    <span className="flex-1 truncate font-mono text-[10.5px] text-muted-foreground/80">
                      {linkPreview}
                    </span>
                    {isCopied ? (
                      <Check className="h-3 w-3 shrink-0 text-emerald-400" strokeWidth={2.75} />
                    ) : (
                      <Copy className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-colors group-hover/link:text-primary" strokeWidth={2.25} />
                    )}
                  </button>
                )}

                {/* Checkout Builder pill */}
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/30 px-2.5 py-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Sparkles className="h-3 w-3 shrink-0 text-primary/70" strokeWidth={2.5} />
                    <div className="min-w-0">
                      <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                        Checkout builder
                      </p>
                      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-foreground/85">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {themeLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10.5px] font-bold text-primary transition-colors hover:bg-primary/20"
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
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-secondary/50 text-[11.5px] font-bold text-foreground/85 transition-all hover:border-primary/40 hover:bg-secondary hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onOpenPixels(product); }}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-secondary/50 text-[11.5px] font-bold text-foreground/85 transition-all hover:border-primary/40 hover:bg-secondary hover:text-primary"
                  >
                    <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Customizar
                  </button>
                  {product.checkout_url && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onOpenCheckout(product); }}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-secondary/50 text-foreground/70 transition-all hover:border-primary/40 hover:bg-secondary hover:text-primary"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  )}
                  <div onClick={(e) => e.stopPropagation()}>
                    <ProductActionsMenu
                      copied={isCopied}
                      product={product}
                      triggerClassName="h-9 w-9 rounded-lg border border-border/70 bg-secondary/50 text-foreground/70 hover:border-primary/40 hover:bg-secondary hover:text-primary data-[state=open]:bg-secondary"
                      {...handlers}
                    />
                  </div>
                </div>

                {/* Footer meta */}
                <div className="flex items-center justify-between border-t border-border/40 pt-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/50">
                  <span>{deliveryLabel}</span>
                  {product.affiliate_enabled && (
                    <span className="text-primary/70">{product.affiliate_commission}% afiliado</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between px-1 text-[11.5px] text-muted-foreground/70">
        <span>
          <span className="font-mono font-semibold text-foreground/80 tabular-nums">{products.length}</span>{" "}
          {products.length === 1 ? "produto" : "produtos"}
        </span>
      </div>
    </div>
  );
}
