import { Copy, ExternalLink, Link2, Palette, Pencil, Settings2, Sparkles, Check, BookOpen, ArrowUpRight } from "lucide-react";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { DELIVERY_LABELS, formatCurrency, type Product, getCheckoutLink } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; dot: string; text: string; surface: string }> = {
  active: {
    label: "Ativo",
    dot: "bg-success",
    text: "text-success",
    surface: "bg-success/[0.08] border-success/20",
  },
  inactive: {
    label: "Inativo",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    surface: "bg-muted/40 border-border/60",
  },
  pending_review: {
    label: "Em revisão",
    dot: "bg-warning",
    text: "text-warning",
    surface: "bg-warning/[0.08] border-warning/20",
  },
};

const THUMB_SURFACES = [
  "bg-card-inset border-border/60",
  "bg-secondary border-border/60",
  "bg-accent border-border/60",
];

const THEME_LABELS: Record<string, string> = {
  default: "Padrão",
  dark: "Cinza Escuro",
  light: "Cinza Suave",
  premium: "Premium",
};

const surfaceFor = (id: string) => {
  const sum = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return THUMB_SURFACES[sum % THUMB_SURFACES.length];
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
          const surface = surfaceFor(product.id);
          const themeLabel = THEME_LABELS[product.checkout_theme || "default"] || "Padrão";
          const linkPreview = product.checkout_url ? shortenLink(product.checkout_url) : null;

          return (
            <article
              key={product.id}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card",
                "transition-all duration-300",
                "hover:border-primary/40",
              )}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border/40 bg-card-inset">
                {product.image_url ? (
                  <>
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between border-t border-border/30 bg-background/88 px-4 py-3 backdrop-blur-sm">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">Preço</p>
                        <span className="mt-1 block font-numbers text-[24px] font-black leading-none tracking-tight text-foreground tabular-nums">
                          {formatCurrency(Number(product.price))}
                        </span>
                      </div>
                      <span className="rounded-md border border-border/60 bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground/70">{deliveryLabel}</span>
                    </div>
                  </>
                ) : (
                  <div className={cn("relative flex h-full w-full items-center justify-between px-4 py-4", surface)}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-card">
                      <BookOpen className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <div className="min-w-0 flex-1 px-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Preço</p>
                      <p className="mt-2 font-numbers text-[28px] font-black leading-none tracking-[-0.05em] text-foreground tabular-nums">{formatCurrency(Number(product.price))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">SKU</p>
                      <p className="mt-2 font-mono text-[11px] font-semibold text-foreground/70">{initial}{product.id.slice(0, 4).toUpperCase()}</p>
                    </div>
                  </div>
                )}

                <div className="absolute right-3 top-3">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold",
                    status.surface,
                    status.text,
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                    {status.label}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 font-display text-[15.5px] font-bold leading-tight tracking-[-0.01em] text-foreground">
                          {product.name}
                        </h3>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50">{themeLabel} · {deliveryLabel}</p>
                      </div>
                      {product.affiliate_enabled && (
                        <span className="rounded-md border border-primary/20 bg-primary/[0.08] px-2 py-1 text-[10px] font-bold text-primary">{product.affiliate_commission}%</span>
                      )}
                    </div>
                    <p className={cn(
                      "mt-2 line-clamp-2 text-[12px] leading-snug",
                      product.description ? "text-muted-foreground/70" : "italic text-muted-foreground/40",
                    )}>
                      {product.description || "Sem descrição"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Checkout</p>
                    <p className="mt-1 text-[12px] font-semibold text-foreground">{product.checkout_url ? "Publicado" : "Pendente"}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Detalhe</p>
                    <p className="mt-1 text-[12px] font-semibold text-foreground">{themeLabel}</p>
                  </div>
                </div>

                {linkPreview && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onCopyLink(product); }}
                    className="group/link flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-secondary/30 px-2.5 py-2 text-left transition-colors hover:border-primary/40"
                  >
                    <Link2 className="h-3 w-3 shrink-0 text-primary/70" strokeWidth={2.5} />
                    <span className="flex-1 truncate font-mono text-[10.5px] text-muted-foreground/80">{linkPreview}</span>
                    {isCopied ? <Check className="h-3 w-3 shrink-0 text-success" strokeWidth={2.75} /> : <Copy className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-colors group-hover/link:text-primary" strokeWidth={2.25} />}
                  </button>
                )}

                <div className="mt-1 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card text-[11.5px] font-bold text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onOpenPixels(product); }}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card text-[11.5px] font-bold text-foreground/85 transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Customizar
                  </button>
                  {product.checkout_url && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onOpenCheckout(product); }}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
                      title="Abrir checkout"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  )}
                  <div onClick={(e) => e.stopPropagation()}>
                    <ProductActionsMenu
                      copied={isCopied}
                      product={product}
                      triggerClassName="h-9 w-9 rounded-lg border border-border/70 bg-card text-foreground/70 hover:border-primary/40 hover:text-primary data-[state=open]:bg-accent"
                      {...handlers}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/50">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onOpenMembers(product); }}
                    className="inline-flex items-center gap-1.5 text-foreground/70 hover:text-primary"
                  >
                    <BookOpen className="h-3 w-3" /> Área de membros
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                    className="inline-flex items-center gap-1.5 text-foreground/70 hover:text-primary"
                  >
                    Builder <ArrowUpRight className="h-3 w-3" />
                  </button>
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
