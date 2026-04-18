import { ArrowUpRight, Package, TrendingUp, Users } from "lucide-react";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { DELIVERY_LABELS, formatCurrency, formatCompactDate, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string; ring: string }> = {
  active: {
    label: "Ativo",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    ring: "shadow-[0_0_0_3px_hsl(152_76%_60%/0.18)]",
  },
  inactive: {
    label: "Inativo",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    bg: "bg-muted/30 border-border/50",
    ring: "",
  },
  pending_review: {
    label: "Em revisão",
    dot: "bg-amber-400",
    text: "text-amber-300",
    bg: "bg-amber-500/10 border-amber-500/20",
    ring: "shadow-[0_0_0_3px_hsl(45_93%_60%/0.18)]",
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

const gradientFor = (id: string) => {
  const sum = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[sum % GRADIENTS.length];
};

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  return (
    <div className="mx-auto w-full max-w-[1280px]">
      {toolbar && <div className="mb-5">{toolbar}</div>}

      {/* Cards grid — premium squares */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const status = STATUS_META[product.status] || STATUS_META.inactive;
          const initial = product.name.charAt(0).toUpperCase();
          const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
          const isCopied = copiedId === product.id;
          const gradient = gradientFor(product.id);

          return (
            <article
              key={product.id}
              onClick={() => handlers.onEditProduct(product)}
              className={cn(
                "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/70",
                "shadow-[0_1px_0_0_hsl(var(--foreground)/0.04)_inset,0_8px_24px_-12px_hsl(0_0%_0%/0.4)]",
                "transition-all duration-300",
                "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_1px_0_0_hsl(var(--foreground)/0.06)_inset,0_20px_40px_-16px_hsl(var(--primary)/0.25)]",
              )}
            >
              {/* Top accent — appears on hover */}
              <div className="absolute inset-x-0 top-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 transition-all duration-300 group-hover:scale-x-100 group-hover:opacity-100" />

              {/* Thumbnail — square hero */}
              <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border/40">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", gradient)}>
                    <span className="font-display text-[64px] font-black text-foreground/85 drop-shadow-lg">
                      {initial}
                    </span>
                  </div>
                )}
                {/* gradient overlay for status legibility */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/70 via-transparent to-transparent" />

                {/* Status badge — top-left over thumb */}
                <div className={cn(
                  "absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md",
                  status.bg,
                  status.text,
                )}>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className={cn("absolute inset-0 rounded-full", status.dot, status.ring)} />
                  </span>
                  {status.label}
                </div>

                {/* Actions — top-right, visible on hover */}
                <div
                  className="absolute right-2.5 top-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 data-[open=true]:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ProductActionsMenu
                    copied={isCopied}
                    product={product}
                    triggerClassName="h-8 w-8 rounded-lg border border-border/60 bg-background/80 text-foreground/80 backdrop-blur-md hover:bg-background hover:text-foreground data-[state=open]:bg-background"
                    {...handlers}
                  />
                </div>

                {/* Delivery type pill — bottom-left */}
                <div className="absolute bottom-3 left-3">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-background/70 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-foreground/70 backdrop-blur-md">
                    <Package className="h-2.5 w-2.5" strokeWidth={2.5} />
                    {deliveryLabel}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 font-display text-[16px] font-bold leading-snug tracking-[-0.01em] text-foreground">
                      {product.name}
                    </h3>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                      strokeWidth={2.25}
                    />
                  </div>
                  {product.description ? (
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground/70">
                      {product.description}
                    </p>
                  ) : (
                    <p className="mt-1 text-[12.5px] italic text-muted-foreground/35">Sem descrição</p>
                  )}
                </div>

                {/* Stats footer */}
                <div className="mt-auto flex items-end justify-between gap-3 border-t border-border/40 pt-3.5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
                      Preço
                    </p>
                    <p className="mt-0.5 font-numbers text-[20px] font-bold tabular-nums leading-none tracking-tight text-foreground">
                      {formatCurrency(Number(product.price))}
                    </p>
                  </div>
                  <div className="text-right">
                    {product.affiliate_enabled ? (
                      <div className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10.5px] font-semibold text-primary">
                        <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
                        {product.affiliate_commission}% afiliado
                      </div>
                    ) : (
                      <div className="text-[10.5px] font-medium text-muted-foreground/50">
                        Sem afiliação
                      </div>
                    )}
                    <p className="mt-1 text-[10.5px] tabular-nums text-muted-foreground/50">
                      {formatCompactDate(product.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Footer count */}
      <div className="mt-5 flex items-center justify-between px-1 text-[11.5px] text-muted-foreground/70">
        <span>
          <span className="font-mono font-semibold text-foreground/80 tabular-nums">{products.length}</span>{" "}
          {products.length === 1 ? "produto" : "produtos"}
        </span>
      </div>
    </div>
  );
}
