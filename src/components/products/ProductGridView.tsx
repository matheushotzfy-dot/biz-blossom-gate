import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  ExternalLink,
  Package,
  Palette,
  Pencil,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import {
  DELIVERY_LABELS,
  formatCurrency,
  getCheckoutLink,
  getEffectiveStatus,
  getProductRequirements,
  type Product,
} from "./productPresentation";
import { cn } from "@/lib/utils";

/**
 * Catálogo em grid de cards — estética VENXPAY:
 * cartões de altura uniforme, capa 16/9, pill de status com dot,
 * preço em destaque, linha mono do checkout com copiar, rodapé de ações.
 * Hover leve (borda + translate), sem blur pesado nem sombra cinza.
 */

const PAGE_SIZE = 24;

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  active: { label: "Ativo", cls: "bg-emerald-500/12 text-emerald-500", dot: "bg-emerald-500" },
  pending_review: { label: "Em revisão", cls: "bg-amber-500/12 text-amber-500", dot: "bg-amber-500" },
  draft: { label: "Rascunho", cls: "bg-muted/70 text-muted-foreground", dot: "bg-muted-foreground/60" },
  inactive: { label: "Inativo", cls: "bg-zinc-500/12 text-zinc-400", dot: "bg-zinc-400" },
};

const shortenLink = (url: string) => {
  try {
    return getCheckoutLink(url).replace(/^https?:\/\//, "");
  } catch {
    return url;
  }
};

const iconBtn =
  "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground";

type CardProps = ProductMenuHandlers & {
  product: Product;
  copied: boolean;
};

const ProductCard = memo(function ProductCard({ product, copied, ...handlers }: CardProps) {
  const navigate = useNavigate();

  const effectiveStatus = getEffectiveStatus(product);
  const status = STATUS_META[effectiveStatus] ?? STATUS_META.inactive;
  const isDraft = effectiveStatus === "draft";
  const missingCount = isDraft ? getProductRequirements(product).filter((r) => !r.done).length : 0;
  const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
  const linkPreview = product.checkout_url ? shortenLink(product.checkout_url) : null;
  const initial = (product.name || "?").charAt(0).toUpperCase();

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[24px] border border-border/60 bg-card",
        "transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/25",
      )}
    >
      {/* Capa */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/25">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-transparent">
            <span className="text-[34px] font-black leading-none text-primary/45">{initial}</span>
          </div>
        )}
        <span
          className={cn(
            "absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm",
            status.cls,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col px-4 pb-3.5 pt-3.5">
        <p title={product.name || "Sem nome"} className="truncate text-[14px] font-black leading-tight text-foreground">
          {product.name || "Sem nome"}
        </p>
        <p className="mt-1 truncate text-[12px] text-muted-foreground/60">
          {deliveryLabel}
          {isDraft && missingCount > 0
            ? ` · ${missingCount} ${missingCount === 1 ? "pendência" : "pendências"}`
            : product.affiliate_enabled
              ? ` · Afiliados ${product.affiliate_commission}%`
              : ""}
        </p>

        <p className="mt-3 text-[20px] font-black leading-none tabular-nums text-foreground">
          {formatCurrency(Number(product.price))}
        </p>

        <div className="mt-3">
          {linkPreview ? (
            <button
              type="button"
              onClick={() => handlers.onCopyLink(product)}
              title="Copiar link do checkout"
              className="flex w-full items-center gap-1.5 rounded-full bg-muted/35 px-3 py-1.5 text-left transition-colors hover:bg-muted/60"
            >
              {copied ? (
                <Check className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.5} />
              ) : (
                <Copy className="h-3 w-3 shrink-0 text-muted-foreground/50" strokeWidth={2} />
              )}
              <span className="truncate font-mono text-[10.5px] text-muted-foreground/75">
                {copied ? "Link copiado" : linkPreview}
              </span>
            </button>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted/25 px-3 py-1.5 text-[11px] text-muted-foreground/45">
              Checkout não publicado
            </span>
          )}
        </div>

        {/* Rodapé */}
        <div className="mt-auto flex items-center gap-1 pt-3.5">
          <button
            type="button"
            onClick={() => handlers.onEditProduct(product)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[11.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
            Editar
          </button>
          <div className="ml-auto flex items-center">
            <button
              type="button"
              onClick={() => navigate(`/vendas/produtos/${product.id}/checkout-builder`, { state: { product } })}
              className={iconBtn}
              title="Checkout builder"
              aria-label="Checkout builder"
            >
              <Palette className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => handlers.onOpenPixels(product)}
              className={iconBtn}
              title="Pixels & tracking"
              aria-label="Pixels & tracking"
            >
              <Crosshair className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            {product.checkout_url && (
              <button
                type="button"
                onClick={() => handlers.onOpenCheckout(product)}
                className={iconBtn}
                title="Abrir checkout"
                aria-label="Abrir checkout"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
            <ProductActionsMenu copied={copied} product={product} triggerClassName={iconBtn} {...handlers} />
          </div>
        </div>
      </div>
    </article>
  );
});

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [products.length]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [products, currentPage],
  );

  const goTo = useCallback((p: number) => setPage(p), []);

  return (
    <div className="space-y-5">
      {toolbar && (
        <div className="rounded-[24px] border border-border/60 bg-card px-5 py-4">{toolbar}</div>
      )}

      {paged.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-border/60 bg-card px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/40">
            <Package size={22} strokeWidth={1.5} className="text-muted-foreground/50" />
          </div>
          <p className="text-[13px] font-black text-foreground">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {paged.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              copied={copiedId === product.id}
              {...handlers}
            />
          ))}
        </div>
      )}

      {products.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-[24px] border border-border/60 bg-card px-5 py-3.5 sm:flex-row">
          <div className="text-[11px] font-semibold tabular-nums text-muted-foreground/70">
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, products.length)} de {products.length}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goTo(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => {
                let pageNum = idx + 1;
                if (totalPages > 7) {
                  if (currentPage > 4) pageNum = currentPage - 3 + idx;
                  if (pageNum > totalPages) pageNum = totalPages - (6 - idx);
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => goTo(pageNum)}
                    className={cn(
                      "h-8 min-w-8 rounded-full border px-2.5 text-[11px] font-black tabular-nums transition-colors",
                      pageNum === currentPage
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-card text-foreground/70 hover:bg-muted/50",
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => goTo(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { ChevronDown };
