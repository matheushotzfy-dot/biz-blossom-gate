import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  ExternalLink,
  Link2,
  Package,
  Palette,
  Pencil,
  Trash2,
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
 * Catálogo de produtos no mesmo idioma visual da aba de Vendas:
 * painel único, cabeçalho de colunas, linhas densas divididas por 1px,
 * badge de status com ponto, valores tabulares e paginação no rodapé.
 * Hover somente de cor — sem transform, blur ou sombra.
 */

const PAGE_SIZE = 25;

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  active: { label: "Ativo", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dot: "bg-emerald-500" },
  pending_review: { label: "Em revisão", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20", dot: "bg-amber-500" },
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground border-border/60", dot: "bg-muted-foreground/50" },
  inactive: { label: "Inativo", cls: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
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
  "flex h-8 w-8 items-center justify-center rounded-[10px] border border-border/60 bg-card text-muted-foreground/70 transition-colors hover:border-primary/40 hover:text-primary";

type RowProps = ProductMenuHandlers & {
  product: Product;
  copied: boolean;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
};

const ProductRow = memo(function ProductRow({
  product,
  copied,
  expanded,
  onToggleExpand,
  ...handlers
}: RowProps) {
  const navigate = useNavigate();

  const effectiveStatus = getEffectiveStatus(product);
  const status = STATUS_META[effectiveStatus] ?? STATUS_META.inactive;
  const isDraft = effectiveStatus === "draft";
  const requirements = isDraft ? getProductRequirements(product) : [];
  const missingCount = requirements.filter((r) => !r.done).length;
  const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
  const themeLabel = THEME_LABELS[product.checkout_theme || "default"] || "Padrão";
  const linkPreview = product.checkout_url ? shortenLink(product.checkout_url) : null;
  const initial = (product.name || "?").charAt(0).toUpperCase();

  const thumb = (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted/20">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[13px] font-black text-muted-foreground/50">
          {initial}
        </span>
      )}
    </div>
  );

  const statusBadge = (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", status.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
      {status.label}
    </span>
  );

  const actions = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => handlers.onEditProduct(product)}
        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-border/60 bg-card px-3 text-[11.5px] font-semibold text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
        Editar
      </button>
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
  );

  const linkChip = linkPreview ? (
    <button
      type="button"
      onClick={() => handlers.onCopyLink(product)}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-left transition-colors hover:border-primary/30 hover:text-primary"
      title="Copiar link do checkout"
    >
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.5} />
      ) : (
        <Link2 className="h-3 w-3 shrink-0 text-muted-foreground/50" strokeWidth={2} />
      )}
      <span className="truncate font-mono text-[10.5px] text-muted-foreground/75">
        {copied ? "Link copiado" : linkPreview}
      </span>
      {!copied && <Copy className="h-3 w-3 shrink-0 text-muted-foreground/40" strokeWidth={2} />}
    </button>
  ) : (
    <span className="text-[11px] text-muted-foreground/45">Checkout não publicado</span>
  );

  const draftSummary = isDraft ? (
    <button
      type="button"
      onClick={() => onToggleExpand(product.id)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="tabular-nums">{missingCount}</span>
      {missingCount === 1 ? "item pendente" : "itens pendentes"}
      <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} strokeWidth={2.25} />
    </button>
  ) : null;

  return (
    <div className="transition-colors hover:bg-muted/20">
      {/* Mobile */}
      <div className="px-4 py-3.5 md:hidden">
        <div className="flex items-start gap-3">
          {thumb}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-black text-foreground">{product.name || "Sem nome"}</p>
              <p className="shrink-0 text-[13px] font-black tabular-nums text-foreground">
                {formatCurrency(Number(product.price))}
              </p>
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground/70">
              {deliveryLabel} · Layout {themeLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {statusBadge}
              {isDraft ? draftSummary : linkChip}
            </div>
            <div className="mt-2.5">{actions}</div>
          </div>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden items-center gap-4 px-6 py-4 md:flex">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {thumb}
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-black text-foreground">{product.name || "Sem nome"}</p>
            <p className="truncate text-[11px] text-muted-foreground/60">
              {deliveryLabel}
              {product.affiliate_enabled ? ` · Afiliados ${product.affiliate_commission}%` : ""}
            </p>
          </div>
        </div>

        <div className="w-[120px] shrink-0">{statusBadge}</div>

        <div className="w-[240px] min-w-0 shrink-0">{isDraft ? draftSummary : linkChip}</div>

        <div className="w-[120px] shrink-0 text-right text-[13.5px] font-black tabular-nums text-foreground">
          {formatCurrency(Number(product.price))}
        </div>

        <div className="shrink-0">{actions}</div>
      </div>

      {/* Checklist do rascunho */}
      {isDraft && expanded && (
        <div className="border-t border-border/30 bg-muted/10 px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Falta terminar</p>
          <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {requirements.map((r) => (
              <li key={r.key} className="flex items-center gap-2 text-[12px]">
                {r.done ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={2.5} />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/35" />
                )}
                <span className={cn(r.done ? "text-muted-foreground/50 line-through" : "text-foreground/80")}>{r.label}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => handlers.onDeleteProduct(product)}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-border/60 bg-card px-3 text-[11.5px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            Excluir rascunho
          </button>
        </div>
      )}
    </div>
  );
});

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [products.length]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [products, currentPage],
  );

  const toggleExpand = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    [],
  );

  return (
    <div className="overflow-hidden rounded-[24px] border border-border/60 bg-card">
      {toolbar && <div className="border-b border-border/40 px-6 py-4">{toolbar}</div>}

      {/* Cabeçalho de colunas (desktop) */}
      <div className="hidden items-center gap-4 border-b border-border/40 bg-muted/30 px-6 py-4 text-[11px] font-semibold text-muted-foreground/60 md:flex">
        <span className="flex-1">Produto</span>
        <span className="w-[120px] shrink-0">Status</span>
        <span className="w-[240px] shrink-0">Checkout</span>
        <span className="w-[120px] shrink-0 text-right">Preço</span>
        <span className="w-[214px] shrink-0 text-right">Ações</span>
      </div>

      <div className="divide-y divide-border/40">
        {paged.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-border/60 bg-muted/30">
              <Package size={22} strokeWidth={1.5} className="text-muted-foreground/50" />
            </div>
            <p className="text-[13px] font-black text-foreground">Nenhum produto encontrado</p>
          </div>
        ) : (
          paged.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              copied={copiedId === product.id}
              expanded={expandedId === product.id}
              onToggleExpand={toggleExpand}
              {...handlers}
            />
          ))
        )}
      </div>

      {products.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border/40 px-6 py-4 sm:flex-row">
          <div className="text-[11px] font-semibold tabular-nums text-muted-foreground/70">
            Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, products.length)} de {products.length}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
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
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "h-8 min-w-8 rounded-md border px-2.5 text-[11px] font-black tabular-nums transition-colors",
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
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
