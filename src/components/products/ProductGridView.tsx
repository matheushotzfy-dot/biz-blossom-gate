import { ArrowUpRight, TrendingUp } from "lucide-react";
import { ProductActionsMenu, type ProductMenuHandlers } from "./ProductActionsMenu";
import { DELIVERY_LABELS, formatCurrency, formatCompactDate, type Product } from "./productPresentation";
import { cn } from "@/lib/utils";

type ProductGridViewProps = ProductMenuHandlers & {
  copiedId: string | null;
  products: Product[];
  toolbar?: React.ReactNode;
};

const STATUS_META: Record<string, { label: string; dot: string; text: string; ring: string }> = {
  active: {
    label: "Ativo",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    ring: "shadow-[0_0_0_3px_hsl(152_76%_60%/0.12)]",
  },
  inactive: {
    label: "Inativo",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    ring: "",
  },
  pending_review: {
    label: "Em revisão",
    dot: "bg-amber-400",
    text: "text-amber-300",
    ring: "shadow-[0_0_0_3px_hsl(45_93%_60%/0.12)]",
  },
};

// Deterministic gradient per product for thumbnail fallback
const GRADIENTS = [
  "from-violet-500/30 via-fuchsia-500/20 to-rose-500/25",
  "from-sky-500/30 via-cyan-500/20 to-emerald-500/25",
  "from-amber-500/30 via-orange-500/20 to-rose-500/25",
  "from-emerald-500/30 via-teal-500/20 to-cyan-500/25",
  "from-indigo-500/30 via-violet-500/20 to-purple-500/25",
  "from-rose-500/30 via-pink-500/20 to-fuchsia-500/25",
];

const gradientFor = (id: string) => {
  const sum = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[sum % GRADIENTS.length];
};

export function ProductGridView({ products, copiedId, toolbar, ...handlers }: ProductGridViewProps) {
  return (
    <div className="mx-auto w-full max-w-[1240px]">
      {toolbar && <div className="mb-5">{toolbar}</div>}

      {/* Premium panel — subtle ambient glow + crisp border */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/60 shadow-[0_1px_0_0_hsl(var(--foreground)/0.04)_inset,0_24px_60px_-32px_hsl(0_0%_0%/0.6)]">
        {/* Top accent line — premium signature */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        {/* Header row */}
        <div className="grid grid-cols-[minmax(0,1fr)_180px_140px_140px_44px] items-center gap-6 border-b border-border/50 bg-muted/[0.04] px-6 py-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          <div>Produto</div>
          <div className="text-right">Preço</div>
          <div>Status</div>
          <div>Criado</div>
          <div />
        </div>

        {/* Rows */}
        <ul>
          {products.map((product, idx) => {
            const status = STATUS_META[product.status] || STATUS_META.inactive;
            const initial = product.name.charAt(0).toUpperCase();
            const deliveryLabel = DELIVERY_LABELS[product.delivery_type] || product.delivery_type;
            const isCopied = copiedId === product.id;
            const shortId = `prod_${product.id.slice(0, 12)}`;
            const gradient = gradientFor(product.id);
            const isLast = idx === products.length - 1;

            return (
              <li
                key={product.id}
                onClick={() => handlers.onEditProduct(product)}
                className={cn(
                  "group relative grid cursor-pointer grid-cols-[minmax(0,1fr)_180px_140px_140px_44px] items-center gap-6 px-6 py-4 transition-all duration-200",
                  !isLast && "border-b border-border/40",
                  "hover:bg-foreground/[0.025]"
                )}
              >
                {/* Left accent bar on hover — Linear-style */}
                <span className="pointer-events-none absolute inset-y-2 left-0 w-[2px] origin-center scale-y-0 rounded-r-full bg-gradient-to-b from-primary/60 via-primary to-primary/60 opacity-0 transition-all duration-200 group-hover:scale-y-100 group-hover:opacity-100" />

                {/* Name + identity */}
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-border/70 shadow-[0_2px_8px_-2px_hsl(0_0%_0%/0.4),inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition-transform duration-200 group-hover:scale-[1.04]">
                    {product.image_url ? (
                      <img src={product.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", gradient)}>
                        <span className="font-display text-[15px] font-black text-foreground/90 drop-shadow-sm">{initial}</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-[14px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
                        {product.name}
                      </span>
                      <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-all duration-200 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.5} />
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground/70">
                      <span className="capitalize font-medium">{deliveryLabel}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="font-mono text-[10px] tracking-tight text-muted-foreground/55">{shortId}</span>
                    </div>
                  </div>
                </div>

                {/* Price — strong, tabular, with subtle commission hint */}
                <div className="text-right">
                  <div className="font-numbers text-[15px] font-bold tabular-nums tracking-tight text-foreground">
                    {formatCurrency(Number(product.price))}
                  </div>
                  {product.affiliate_enabled && (
                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-medium text-primary/70">
                      <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
                      {product.affiliate_commission}% afiliado
                    </div>
                  )}
                </div>

                {/* Status — refined badge with glow ring */}
                <div className="flex items-center">
                  <div className={cn("inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 text-[11px] font-medium", status.text)}>
                    <span className={cn("relative flex h-1.5 w-1.5")}>
                      <span className={cn("absolute inset-0 rounded-full", status.dot, status.ring)} />
                    </span>
                    {status.label}
                  </div>
                </div>

                {/* Created date */}
                <div className="text-[11.5px] font-medium text-muted-foreground/75 tabular-nums">
                  {formatCompactDate(product.created_at)}
                </div>

                {/* Actions */}
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <ProductActionsMenu
                    copied={isCopied}
                    product={product}
                    triggerClassName="h-8 w-8 rounded-lg text-muted-foreground/50 opacity-0 transition-all hover:bg-foreground/[0.06] hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-foreground/[0.06] data-[state=open]:text-foreground"
                    {...handlers}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-muted-foreground/70">
        <span>
          <span className="font-mono font-semibold text-foreground/80 tabular-nums">{products.length}</span>{" "}
          {products.length === 1 ? "produto" : "produtos"}
        </span>
      </div>
    </div>
  );
}
