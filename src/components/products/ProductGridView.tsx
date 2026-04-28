import { Copy, Crosshair, ExternalLink, Link2, Palette, Pencil, Settings2, Sparkles, Check, BookOpen, ArrowUpRight, AlertTriangle, Trash2, FileEdit, Info } from "lucide-react";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { DELIVERY_LABELS, formatCurrency, type Product, getCheckoutLink, getEffectiveStatus, getProductRequirements } from "./productPresentation";
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
    dot: "bg-destructive",
    text: "text-destructive",
    surface: "bg-destructive/[0.08] border-destructive/20",
  },
  pending_review: {
    label: "Em revisão",
    dot: "bg-warning",
    text: "text-warning",
    surface: "bg-warning/[0.08] border-warning/20",
  },
  draft: {
    label: "Rascunho",
    dot: "bg-muted-foreground/60",
    text: "text-muted-foreground",
    surface: "bg-muted/40 border-border/60",
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
          const effectiveStatus = getEffectiveStatus(product);
          const status = STATUS_META[effectiveStatus] || STATUS_META.inactive;
          const isDraft = effectiveStatus === "draft";
          const isInactive = effectiveStatus === "inactive";
          const isPending = effectiveStatus === "pending_review";
          const requirements = isDraft ? getProductRequirements(product) : [];
          const missingCount = requirements.filter((r) => !r.done).length;
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
                "group relative flex flex-col overflow-hidden rounded-[24px] border border-border/40 bg-card/60 backdrop-blur-sm",
                "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                "hover:border-primary/30 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] hover:-translate-y-1",
                isInactive && "border-destructive/30",
                isPending && "border-warning/30",
                isDraft && "border-dashed border-border/60",
              )}
            >
              {/* Top Image Section */}
              <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border/10 bg-card-inset">
                {product.image_url ? (
                  <>
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-500 group-hover:opacity-90" />
                    
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Valor</p>
                        <span className="mt-0.5 block font-display text-2xl font-black leading-none tracking-tight text-white tabular-nums">
                          {formatCurrency(Number(product.price))}
                        </span>
                      </div>
                      <span className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">{deliveryLabel}</span>
                    </div>
                  </>
                ) : (
                  <div className={cn("relative flex h-full w-full items-center justify-between px-6 py-4", surface)}>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-lg">
                      <BookOpen className="h-6 w-6 text-primary/60" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1 px-4 text-right">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Valor de Venda</p>
                      <p className="mt-1 font-display text-3xl font-black leading-none tracking-[-0.04em] text-foreground tabular-nums">{formatCurrency(Number(product.price))}</p>
                    </div>
                  </div>
                )}

                {/* Faixa de revisão/inativo — overlay no topo da foto, não desalinha cards */}
                {(isInactive || isPending) && (
                  <div className={cn(
                    "absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-2",
                    isInactive
                      ? "border-destructive/30 bg-destructive/95"
                      : "border-warning/30 bg-warning/95"
                  )}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      <span className={cn(
                        "truncate font-display text-[10.5px] font-bold uppercase tracking-[0.18em]",
                        isInactive ? "text-destructive-foreground" : "text-warning-foreground"
                      )}>
                        {isInactive ? "Inativado pela equipe" : "Em análise pela equipe"}
                      </span>
                    </span>
                  </div>
                )}

                {/* Status Badge — só quando não está em revisão/inativo */}
                {!(isInactive || isPending) && (
                  <div className="absolute right-4 top-4 z-10">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider",
                      status.surface,
                      status.text,
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", status.dot)} />
                      {status.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Content Section */}
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 font-display text-lg font-black tracking-[-0.02em] text-foreground transition-colors group-hover:text-primary">
                          {product.name}
                        </h3>
                        <div className="mt-1.5 flex items-center gap-2">
                           <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/40">{themeLabel}</span>
                           <span className="h-1 w-1 rounded-full bg-border/60" />
                           <span className="text-[10px] font-black uppercase tracking-wider text-primary/60">{deliveryLabel}</span>
                        </div>
                      </div>
                      {product.affiliate_enabled && (
                        <div className="flex flex-col items-end">
                           <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40 mb-1">Afiliados</span>
                           <span className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-1 text-[11px] font-black text-primary">{product.affiliate_commission}%</span>
                        </div>
                      )}
                    </div>
                </div>

                {/* DRAFT mode: pendency checklist + giant delete button */}
                {isDraft ? (
                  <>
                    <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 p-3.5">
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          <FileEdit className="h-3 w-3" /> Falta terminar
                        </p>
                        <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-foreground/70">
                          {missingCount} {missingCount === 1 ? "item" : "itens"}
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {requirements.map((r) => (
                          <li key={r.key} className="flex items-center gap-2 text-[11.5px]">
                            {r.done ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={3} />
                            ) : (
                              <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-muted-foreground/40" />
                            )}
                            <span className={cn(r.done ? "text-muted-foreground/60 line-through" : "text-foreground/85 font-medium")}>
                              {r.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-[12.5px] font-black uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90 hover:-translate-y-px"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.5} />
                        Continuar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handlers.onDeleteProduct(product); }}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/[0.06] px-4 text-[12px] font-black uppercase tracking-wider text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground"
                        title="Excluir rascunho"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                        Excluir
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Quick Info Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-border/20 bg-muted/5 p-3 transition-colors group-hover:bg-muted/10">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">Checkout</p>
                        <div className="mt-1 flex items-center gap-1.5">
                           <Check className={cn("h-3 w-3", product.checkout_url ? "text-success" : "text-muted-foreground/30")} />
                           <p className="text-[12px] font-bold text-foreground/80">{product.checkout_url ? "Publicado" : "Pendente"}</p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/20 bg-muted/5 p-3 transition-colors group-hover:bg-muted/10">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">Layout</p>
                        <div className="mt-1 flex items-center gap-1.5">
                           <Palette className="h-3 w-3 text-primary/60" />
                           <p className="text-[12px] font-bold text-foreground/80">{themeLabel}</p>
                        </div>
                      </div>
                    </div>

                    {/* Checkout Link Copy */}
                    {linkPreview && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handlers.onCopyLink(product); }}
                        className="group/link flex items-center gap-2.5 rounded-xl border border-dashed border-border/40 bg-muted/5 px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.02]"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-transform group-hover/link:scale-110">
                          <Link2 className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                        </div>
                        <span className="flex-1 truncate font-display text-[11px] font-bold text-muted-foreground/70">{linkPreview}</span>
                        {isCopied ? (
                          <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={3} />
                        ) : (
                          <Copy className="h-4 w-4 shrink-0 text-muted-foreground/20 transition-colors group-hover/link:text-primary" strokeWidth={2.25} />
                        )}
                      </button>
                    )}

                    <div className="mt-auto flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/40 bg-card text-[11px] font-black uppercase tracking-wider text-foreground/80 transition-all hover:border-primary/40 hover:text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); window.location.assign(`/vendas/produtos/${product.id}/checkout-builder`); }}
                        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/40 bg-card text-[11px] font-black uppercase tracking-wider text-foreground/80 transition-all hover:border-primary/40 hover:text-primary"
                        title="Abrir checkout builder"
                      >
                        <Palette className="h-3.5 w-3.5" strokeWidth={2.25} />
                        Builder
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handlers.onOpenPixels(product); }}
                        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/40 bg-card text-[11px] font-black uppercase tracking-wider text-foreground/80 transition-all hover:border-primary/40 hover:text-primary"
                        title="Configurar pixels e tracking"
                      >
                        <Crosshair className="h-3.5 w-3.5" strokeWidth={2.25} />
                        Pixels
                      </button>
                      {product.checkout_url && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handlers.onOpenCheckout(product); }}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-card text-foreground/60 transition-all hover:border-primary/40 hover:text-primary"
                          title="Abrir checkout"
                        >
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                      )}
                      <div onClick={(e) => e.stopPropagation()}>
                        <ProductActionsMenu
                          copied={isCopied}
                          product={product}
                          triggerClassName="h-10 w-10 rounded-lg border border-border/40 bg-card text-foreground/60 hover:border-primary/40 hover:text-primary data-[state=open]:bg-accent transition-all"
                          {...handlers}
                        />
                      </div>
                    </div>
                  </>
                )}
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
