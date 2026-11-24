import { memo, useEffect, useMemo, useState } from "react";
import { Check, Copy, Crosshair, ExternalLink, Package, Palette, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import {
  DELIVERY_LABELS,
  STATUS_META,
  getCheckoutLink,
  getEffectiveStatus,
  getProductRequirements,
  isCheckoutLive,
  type Product,
} from "./productPresentation";
import { Money } from "@/components/home/Money";
import { Pager } from "@/components/seller-ui/Pager";
import { StatusPill } from "@/components/seller-ui/tx";
import { cn } from "@/lib/utils";

/**
 * Catálogo em cards na identidade do painel: capa, status, preço em destaque,
 * link do checkout e ações sempre visíveis (sem depender de hover, para funcionar no celular).
 */

const PAGE_SIZE = 24;

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
};

const shortenLink = (url: string) => {
  try {
    return getCheckoutLink(url).replace(/^https?:\/\//, "");
  } catch {
    return url;
  }
};

const orb = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

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
  const live = isCheckoutLive(product);
  const linkPreview = live && product.checkout_url ? shortenLink(product.checkout_url) : null;
  const initial = (product.name || "?").charAt(0).toUpperCase();

  return (
    <article className="vp-sheet group flex h-full flex-col overflow-hidden transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-accent">
        {product.image_url ? (
          <img src={product.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <span aria-hidden className="font-heading text-[64px] font-extrabold leading-none tracking-[-0.05em] text-primary/35">{initial}</span>
          </div>
        )}
        <StatusPill label={status.label} tone={status.tone} className="absolute left-3.5 top-3.5 bg-card/95 shadow-sm backdrop-blur-sm" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 title={product.name || "Sem nome"} className="truncate font-heading text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">
          {product.name || "Sem nome"}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-muted-foreground">
          {deliveryLabel}
          {isDraft && missingCount > 0 && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[12px] font-bold text-warning">{missingCount} {missingCount === 1 ? "pendência" : "pendências"}</span>
          )}
          {!isDraft && product.affiliate_enabled && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[12px] font-bold text-accent-foreground">Afiliados {product.affiliate_commission}%</span>
          )}
        </p>

        <Money value={Number(product.price)} className="mt-4 block text-[28px] font-extrabold leading-none tracking-[-0.04em] text-foreground" centsClassName="opacity-65" />

        <div className="mt-4">
          {linkPreview ? (
            <button
              type="button"
              onClick={() => handlers.onCopyLink(product)}
              title="Copiar link do checkout"
              className="flex h-10 w-full items-center gap-2.5 rounded-full bg-muted/70 px-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {copied ? <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} /> : <Copy className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />}
              <span className={cn("truncate text-[13px] font-medium", copied ? "text-primary" : "text-muted-foreground")}>{copied ? "Link copiado" : linkPreview}</span>
            </button>
          ) : (
            <p className="flex h-10 items-center rounded-full border border-dashed border-border px-4 text-[13px] text-muted-foreground">
              {product.checkout_url ? "O link abre quando o produto estiver ativo" : "Checkout ainda não publicado"}
            </p>
          )}
        </div>

        <div className="mt-auto flex items-center gap-1 pt-5">
          <button type="button" onClick={() => handlers.onEditProduct(product)} className="vp-cta h-10 px-4 text-[13.5px]">
            <Pencil className="h-4 w-4" strokeWidth={2.3} />
            Editar
          </button>
          <div className="ml-auto flex items-center">
            <button type="button" onClick={() => navigate(`/vendas/produtos/${product.id}/checkout-builder`, { state: { product } })} className={orb} title="Checkout builder" aria-label="Checkout builder">
              <Palette className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
            <button type="button" onClick={() => handlers.onOpenPixels(product)} className={orb} title="Pixels e rastreamento" aria-label="Pixels e rastreamento">
              <Crosshair className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
            {live && (
              <button type="button" onClick={() => handlers.onOpenCheckout(product)} className={orb} title="Abrir checkout" aria-label="Abrir checkout">
                <ExternalLink className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            )}
            <ProductActionsMenu copied={copied} product={product} triggerClassName={orb} {...handlers} />
          </div>
        </div>
      </div>
    </article>
  );
});

export function ProductGridView({ products, copiedId, ...handlers }: ProductGridViewProps) {
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [products.length]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [products, currentPage],
  );

  return (
    <div className="space-y-5">
      {paged.length === 0 ? (
        <div className="vp-sheet grid place-items-center gap-3 px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground"><Package className="h-6 w-6" /></span>
          <p className="text-[16px] font-bold text-foreground">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {paged.map((product) => (
            <ProductCard key={product.id} product={product} copied={copiedId === product.id} {...handlers} />
          ))}
        </div>
      )}

      {products.length > PAGE_SIZE && (
        <div className="vp-sheet overflow-hidden [&>nav]:border-t-0">
          <Pager page={currentPage} pageSize={PAGE_SIZE} total={products.length} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
