import { Copy, Crosshair, ExternalLink, Link2, Palette, Pencil, Check, BookOpen, Trash2, FileEdit } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { DELIVERY_LABELS, formatCurrency, type Product, getCheckoutLink, getEffectiveStatus, getProductRequirements } from "./productPresentation";
import { cn } from "@/lib/utils";

/**
 * Grade de produtos no idioma visual do dashboard:
 * superfícies 100% sólidas, bordas de 1px, cantos de 12px, numerais tabulares,
 * ícone "fantasma" ao fundo e hover seco (apenas cor de borda / fundo).
 * Sem sombras, sem blur, sem elevação.
 */

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: "Ativo", dot: "bg-success", text: "text-success" },
  inactive: { label: "Inativo", dot: "bg-destructive", text: "text-destructive" },
  pending_review: { label: "Em revisão", dot: "bg-warning", text: "text-warning" },
  draft: { label: "Rascunho", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
};

const THEME_LABELS: Record<string, string> = {
  default: "Padrão",
  dark: "Cinza Escuro",
  light: "Cinza Suave",
  premium: "Premium",
};

const shortenLink = (url: string) => {
  try {
    return getCheckoutLink(url).replace(/^https?:\/\//, "");
  } catch {
    return url;
  }
};

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  const navigate = useNavigate();

  return (
    <div className="w-full">
      {toolbar && <div className="mb-4">{toolbar}</div>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {products.map((product) => {
          const effectiveStatus = getEffectiveStatus(product);
          const status = STATUS_META[effectiveStatus] || STATUS_META.inactive;
          const isDraft = effectiveStatus === "draft";
          const isInactive = effectiveStatus === "inactive";
          const isPending = effectiveStatus === "pending_review";
          const requirements = isDraft ? getProductRequirements(product) : [];
          const missingCount = requirements.filter((r) => !r.done).length;
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const isCopied = copiedId === product.id;
          const themeLabel = THEME_LABELS[product.checkout_theme || "default"] || "Padrão";
          const linkPreview = product.checkout_url ? shortenLink(product.checkout_url) : null;
          const initial = product.name.charAt(0).toUpperCase();

          return (
            <article
              key={product.id}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-[12px] border border-border/60 bg-card",
                "transition-colors duration-200 hover:border-border",
                isInactive && "border-destructive/25 hover:border-destructive/40",
                isPending && "border-warning/25 hover:border-warning/40",
                isDraft && "border-dashed",
              )}
            >
              {/* Ícone fantasma ao fundo — mesma marca d'água dos KPIs do dashboard */}
              <BookOpen
                aria-hidden
                strokeWidth={1.25}
                className="pointer-events-none absolute -right-4 top-6 h-24 w-24 text-foreground/[0.045]"
              />

              {/* ── Cabeçalho: identidade + preço ── */}
              <div className="relative flex items-start gap-3.5 px-4 pt-4">
                <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[10px] border border-border/70 bg-background">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-[19px] font-bold leading-none tracking-[-0.03em] text-muted-foreground/60">
                      {initial}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate font-display text-[15px] font-bold leading-tight tracking-[-0.02em] text-foreground">
                      {product.name}
                    </h3>
                    <span className={cn("mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium", status.text)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                      {status.label}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-[11.5px] text-muted-foreground/60">
                    {deliveryLabel} · Layout {themeLabel}
                    {product.affiliate_enabled ? ` · Afiliados ${product.affiliate_commission}%` : ""}
                  </p>

                  <p className="mt-2.5 font-display text-[24px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">
                    {formatCurrency(Number(product.price))}
                  </p>
                </div>
              </div>

              {/* ── Aviso de moderação (linha seca, sem animação) ── */}
              {(isInactive || isPending) && (
                <p
                  className={cn(
                    "relative mx-4 mt-3.5 rounded-[8px] border px-3 py-2 text-[11.5px] font-medium",
                    isInactive
                      ? "border-destructive/25 bg-destructive/[0.06] text-destructive"
                      : "border-warning/25 bg-warning/[0.06] text-warning",
                  )}
                >
                  {isInactive ? "Vendas inativadas pela equipe." : "Produto em análise pela equipe."}
                </p>
              )}

              {isDraft ? (
                <div className="relative mt-3.5 flex flex-1 flex-col">
                  {/* Checklist do rascunho */}
                  <div className="border-t border-border/40 px-4 py-3.5">
                    <div className="flex items-center justify-between">
                      <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <FileEdit className="h-3 w-3" strokeWidth={2} /> Falta terminar
                      </p>
                      <span className="text-[11px] font-semibold tabular-nums text-foreground/70">
                        {missingCount} {missingCount === 1 ? "item" : "itens"}
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {requirements.map((r) => (
                        <li key={r.key} className="flex items-center gap-2 text-[11.5px]">
                          {r.done ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.5} />
                          ) : (
                            <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-muted-foreground/40" />
                          )}
                          <span className={cn(r.done ? "text-muted-foreground/50 line-through" : "text-foreground/80")}>
                            {r.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto grid grid-cols-[1fr_auto] gap-px border-t border-border/40 bg-border/40">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                      className="flex h-11 items-center justify-center gap-2 bg-card text-[12px] font-semibold text-foreground transition-colors hover:bg-primary/[0.08] hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      Continuar edição
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onDeleteProduct(product); }}
                      className="flex h-11 items-center justify-center gap-2 bg-card px-4 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-destructive/[0.08] hover:text-destructive"
                      title="Excluir rascunho"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      Excluir
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative mt-3.5 flex flex-1 flex-col">
                  {/* Link do checkout — linha monoespaçada com cópia */}
                  {linkPreview ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onCopyLink(product); }}
                      className="flex items-center gap-2.5 border-t border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" strokeWidth={2} />
                      <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground/70">{linkPreview}</span>
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.5} />
                      ) : (
                        <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" strokeWidth={2} />
                      )}
                    </button>
                  ) : (
                    <p className="border-t border-border/40 px-4 py-3 text-[11.5px] text-muted-foreground/50">
                      Checkout ainda não publicado
                    </p>
                  )}

                  {/* Barra de ações — divisórias de 1px, hover seco */}
                  <div className="mt-auto grid grid-cols-[1fr_auto_auto_auto_auto] gap-px border-t border-border/40 bg-border/40">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                      className="flex h-11 items-center justify-center gap-2 bg-card text-[12px] font-semibold text-foreground transition-colors hover:bg-primary/[0.08] hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      Editar produto
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/vendas/produtos/${product.id}/checkout-builder`, { state: { product } }); }}
                      className="flex h-11 w-11 items-center justify-center bg-card text-muted-foreground/60 transition-colors hover:bg-primary/[0.08] hover:text-primary"
                      title="Checkout builder"
                      aria-label="Checkout builder"
                    >
                      <Palette className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onOpenPixels(product); }}
                      className="flex h-11 w-11 items-center justify-center bg-card text-muted-foreground/60 transition-colors hover:bg-primary/[0.08] hover:text-primary"
                      title="Pixels & tracking"
                      aria-label="Pixels & tracking"
                    >
                      <Crosshair className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    {product.checkout_url ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handlers.onOpenCheckout(product); }}
                        className="flex h-11 w-11 items-center justify-center bg-card text-muted-foreground/60 transition-colors hover:bg-primary/[0.08] hover:text-primary"
                        title="Abrir checkout"
                        aria-label="Abrir checkout"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    ) : (
                      <span className="hidden" />
                    )}
                    <div onClick={(e) => e.stopPropagation()} className="flex bg-card">
                      <ProductActionsMenu
                        copied={isCopied}
                        product={product}
                        triggerClassName="flex h-11 w-11 items-center justify-center rounded-none border-0 bg-transparent text-muted-foreground/60 transition-colors hover:bg-primary/[0.08] hover:text-primary data-[state=open]:bg-primary/[0.08] data-[state=open]:text-primary"
                        {...handlers}
                      />
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <p className="mt-4 px-1 text-[11.5px] text-muted-foreground/55">
        <span className="font-semibold tabular-nums text-foreground/75">{products.length}</span>{" "}
        {products.length === 1 ? "produto listado" : "produtos listados"}
      </p>
    </div>
  );
}
