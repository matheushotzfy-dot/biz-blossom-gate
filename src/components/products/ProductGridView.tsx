import { Copy, Crosshair, ExternalLink, Palette, Pencil, Check, Trash2, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { DELIVERY_LABELS, formatCurrency, type Product, getCheckoutLink, getEffectiveStatus, getProductRequirements } from "./productPresentation";
import { cn } from "@/lib/utils";

/**
 * Grade de produtos — linguagem "soft round": superfícies sólidas, cantos generosos (20px),
 * pílulas arredondadas, hover apenas de cor (150ms). Sem sombras, sem blur, sem transform.
 */

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; dot: string; chip: string }> = {
  active: { label: "Ativo", dot: "bg-success", chip: "bg-success/10 text-success" },
  inactive: { label: "Inativo", dot: "bg-destructive", chip: "bg-destructive/10 text-destructive" },
  pending_review: { label: "Em revisão", dot: "bg-warning", chip: "bg-warning/10 text-warning" },
  draft: { label: "Rascunho", dot: "bg-muted-foreground/60", chip: "bg-muted/40 text-muted-foreground" },
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

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground/70 transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary";

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  const navigate = useNavigate();

  return (
    <div className="w-full">
      {toolbar && <div className="mb-4">{toolbar}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
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
              className="group flex flex-col rounded-[20px] border border-border/50 bg-card p-4 transition-colors duration-150 hover:border-border sm:p-5"
            >
              {/* Identidade */}
              <div className="flex items-center gap-3.5">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[16px] border border-border/50 bg-background">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-[20px] font-bold leading-none tracking-[-0.03em] text-muted-foreground/50">
                      {initial}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="truncate font-display text-[15.5px] font-bold leading-tight tracking-[-0.02em] text-foreground">
                      {product.name}
                    </h3>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
                        status.chip,
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-[11.5px] text-muted-foreground/60">
                    {deliveryLabel} · Layout {themeLabel}
                    {product.affiliate_enabled ? ` · Afiliados ${product.affiliate_commission}%` : ""}
                  </p>
                </div>

                <p className="shrink-0 self-start text-right font-display text-[22px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">
                  {formatCurrency(Number(product.price))}
                </p>
              </div>

              {/* Aviso de moderação */}
              {(isInactive || isPending) && (
                <p
                  className={cn(
                    "mt-3.5 rounded-[14px] px-3.5 py-2.5 text-[11.5px] font-medium",
                    isInactive ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
                  )}
                >
                  {isInactive ? "Vendas inativadas pela equipe." : "Produto em análise pela equipe."}
                </p>
              )}

              {isDraft ? (
                <>
                  <div className="mt-4 rounded-[16px] bg-muted/25 px-4 py-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/70">
                        Falta terminar
                      </p>
                      <span className="rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/70">
                        {missingCount} {missingCount === 1 ? "item" : "itens"}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {requirements.map((r) => (
                        <li key={r.key} className="flex items-center gap-2.5 text-[12px]">
                          {r.done ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.5} />
                          ) : (
                            <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/35" />
                          )}
                          <span className={cn(r.done ? "text-muted-foreground/50 line-through" : "text-foreground/80")}>
                            {r.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                      className="flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-primary/10 text-[12.5px] font-semibold text-primary transition-colors duration-150 hover:bg-primary/[0.16]"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      Continuar edição
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onDeleteProduct(product); }}
                      className="flex h-9 items-center justify-center gap-2 rounded-full border border-border/50 bg-background px-4 text-[12.5px] font-medium text-muted-foreground transition-colors duration-150 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      Excluir
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Link do checkout — pílula copiável */}
                  {linkPreview ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onCopyLink(product); }}
                      className="mt-4 flex w-full items-center gap-2.5 rounded-full bg-muted/30 py-2.5 pl-4 pr-3 text-left transition-colors duration-150 hover:bg-muted/50"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" strokeWidth={2} />
                      <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground/75">{linkPreview}</span>
                      {isCopied ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[10.5px] font-semibold text-success">
                          <Check className="h-3 w-3" strokeWidth={2.5} /> Copiado
                        </span>
                      ) : (
                        <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" strokeWidth={2} />
                      )}
                    </button>
                  ) : (
                    <p className="mt-4 rounded-full bg-muted/25 px-4 py-2.5 text-[11.5px] text-muted-foreground/55">
                      Checkout ainda não publicado
                    </p>
                  )}

                  {/* Ações */}
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onEditProduct(product); }}
                      className="flex h-9 flex-1 items-center justify-center gap-2 rounded-full bg-primary/10 text-[12.5px] font-semibold text-primary transition-colors duration-150 hover:bg-primary/[0.16]"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      Editar produto
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/vendas/produtos/${product.id}/checkout-builder`, { state: { product } }); }}
                      className={iconBtn}
                      title="Checkout builder"
                      aria-label="Checkout builder"
                    >
                      <Palette className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlers.onOpenPixels(product); }}
                      className={iconBtn}
                      title="Pixels & tracking"
                      aria-label="Pixels & tracking"
                    >
                      <Crosshair className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    {product.checkout_url && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handlers.onOpenCheckout(product); }}
                        className={iconBtn}
                        title="Abrir checkout"
                        aria-label="Abrir checkout"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    )}
                    <div onClick={(e) => e.stopPropagation()}>
                      <ProductActionsMenu
                        copied={isCopied}
                        product={product}
                        triggerClassName={iconBtn}
                        {...handlers}
                      />
                    </div>
                  </div>
                </>
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
