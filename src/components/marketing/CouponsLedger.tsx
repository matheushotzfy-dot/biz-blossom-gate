import { Copy, Link2, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2, Layers } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { SellerMenuItem, sellerMenuContent } from "@/components/seller-ui/menu";
import { StatusPill } from "@/components/seller-ui/tx";
import { cn, formatCurrency } from "@/lib/utils";
import { STATE_META, couponState, discountLabel, expiryNote, type Coupon } from "./couponMeta";

const COLS = "lg:grid-cols-[minmax(0,1.5fr)_120px_minmax(0,1fr)_minmax(0,0.9fr)_112px_44px]";

export interface CouponsLedgerProps {
  coupons: Coupon[];
  productName: (id: string | null) => string;
  /** Link do checkout do produto (vazio se o produto não tem página pública). */
  productLink: (id: string | null) => string;
  loading: boolean;
  /** Há cupons, mas a busca ou o filtro não achou nenhum. */
  filtering: boolean;
  busyId: string | null;
  onCreate: () => void;
  onEdit: (c: Coupon) => void;
  onDuplicate: (c: Coupon) => void;
  onToggle: (c: Coupon) => void;
  onDelete: (c: Coupon) => void;
  onCopyCode: (c: Coupon) => void;
  onCopyLink: (c: Coupon) => void;
  onClearFilters: () => void;
}

/** Cupons no mesmo formato de livro das vendas: o código é o protagonista de cada linha. */
export function CouponsLedger(p: CouponsLedgerProps) {
  const now = Date.now();

  if (p.loading && p.coupons.length === 0) {
    return <section className="vp-sheet space-y-3 p-5 sm:p-7" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <div key={i} className="vp-skel h-16" />)}</section>;
  }
  if (p.coupons.length === 0) {
    return (
      <section className="vp-sheet">
        <EmptyPanel
          icon={<Layers className="h-7 w-7" strokeWidth={1.8} />}
          title={p.filtering ? "Nenhum cupom encontrado" : "Crie seu primeiro cupom"}
          text={p.filtering ? "Nenhum cupom bate com a busca ou com o filtro escolhido." : "Dê um código de desconto para campanhas, parcerias ou clientes que pediram uma condição melhor. O cliente digita no checkout."}
          action={p.filtering
            ? <button type="button" className="vp-ghost" onClick={p.onClearFilters}>Limpar filtros</button>
            : <button type="button" className="vp-cta" onClick={p.onCreate}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Novo cupom</button>}
        />
      </section>
    );
  }

  return (
    <section className="vp-sheet overflow-hidden" aria-label="Cupons">
      <div role="table" aria-label="Cupons">
        <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground lg:grid lg:items-center lg:gap-4", COLS)}>
          <span role="columnheader">Cupom</span>
          <span role="columnheader">Desconto</span>
          <span role="columnheader">Resgates</span>
          <span role="columnheader">Validade</span>
          <span role="columnheader">Status</span>
          <span role="columnheader" className="sr-only">Ações</span>
        </div>
        <ul>
          {p.coupons.map((c) => {
            const st = couponState(c, now);
            const meta = STATE_META[st];
            const ex = expiryNote(c, now);
            const pct = c.max_uses ? Math.min(100, (c.current_uses / c.max_uses) * 100) : 0;
            const hasLink = !!c.product_id && !!p.productLink(c.product_id);
            return (
              <li key={c.id} role="row" className={cn("relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-t border-border px-5 py-4 first:border-t-0 sm:px-7 lg:gap-4", COLS, p.busyId === c.id && "opacity-60")}>
                {/* Cupom */}
                <span role="cell" className="col-start-1 row-start-1 min-w-0 lg:col-start-1">
                  <button
                    type="button" onClick={() => p.onCopyCode(c)} title="Copiar o código" aria-label={`Copiar o código ${c.code}`}
                    className="vp-pill group/code !h-9 max-w-full gap-2 bg-accent !px-3.5 font-mono !text-[14px] font-bold tracking-[0.05em] text-accent-foreground hover:!bg-accent hover:ring-1 hover:ring-primary/40"
                  >
                    <span className="truncate">{c.code}</span>
                    <Copy className="h-3.5 w-3.5 shrink-0 opacity-60 transition-opacity group-hover/code:opacity-100" aria-hidden />
                  </button>
                  <span className="mt-1.5 block truncate text-[13px] text-muted-foreground">{p.productName(c.product_id)}{c.apply_to_bumps ? " e order bumps" : ""}</span>
                </span>

                {/* Ações (no celular ficam ao lado do código) */}
                <span role="cell" className="col-start-2 row-start-1 justify-self-end lg:col-start-6">
                  <RowMenu c={c} st={st} hasLink={hasLink} {...p} />
                </span>

                {/* Desconto */}
                <span role="cell" className="col-span-2 flex items-baseline justify-between gap-3 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:block">
                  <span className="vp-num text-[22px] font-extrabold leading-none tracking-[-0.04em] text-foreground lg:text-[20px]">{discountLabel(c)}</span>
                  <span className="text-[12.5px] text-muted-foreground lg:mt-1.5 lg:block">{c.discount_type === "percentage" ? "do preço" : "valor fixo"}</span>
                </span>

                {/* Resgates */}
                <span role="cell" className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1">
                  <span className="flex items-baseline justify-between gap-2 lg:block">
                    <span className="text-[14.5px] font-bold tabular-nums text-foreground">
                      {c.current_uses.toLocaleString("pt-BR")}
                      <span className="font-medium text-muted-foreground">{c.max_uses ? ` de ${c.max_uses.toLocaleString("pt-BR")}` : c.current_uses === 1 ? " resgate" : " resgates"}</span>
                    </span>
                    <span className="text-[12.5px] tabular-nums text-muted-foreground lg:mt-1 lg:block">
                      {Number(c.total_discount_amount) > 0 ? `${formatCurrency(Number(c.total_discount_amount))} em descontos` : "Sem descontos ainda"}
                    </span>
                  </span>
                  {c.max_uses ? (
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${Math.round(pct)}% do limite usado`}>
                      <span className={cn("block h-full rounded-full", st === "exhausted" ? "bg-warning" : pct >= 80 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
                    </span>
                  ) : null}
                </span>

                {/* Status (celular) e validade */}
                <span role="cell" className="lg:hidden">
                  <StatusPill label={meta.label} tone={meta.tone} />
                </span>
                <span role="cell" className="min-w-0 justify-self-end text-right lg:col-start-4 lg:row-start-1 lg:justify-self-start lg:text-left">
                  <span className={cn("block text-[14px] font-medium tabular-nums", ex.past ? "text-destructive" : "text-foreground")}>{ex.text}</span>
                  {ex.sub && <span className={cn("block text-[12.5px] lg:mt-0.5", ex.soon ? "font-semibold text-warning" : ex.past ? "text-destructive/80" : "text-muted-foreground")}>{ex.sub}</span>}
                </span>

                {/* Status (computador) */}
                <span role="cell" className="hidden lg:col-start-5 lg:row-start-1 lg:block">
                  <StatusPill label={meta.label} tone={meta.tone} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function RowMenu({ c, st, hasLink, busyId, onEdit, onDuplicate, onToggle, onDelete, onCopyCode, onCopyLink }: { c: Coupon; st: ReturnType<typeof couponState>; hasLink: boolean } & CouponsLedgerProps) {
  const paused = !c.is_active;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="vp-orb h-10 w-10" aria-label={`Ações do cupom ${c.code}`} disabled={busyId === c.id}>
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className={cn(sellerMenuContent, "w-72")}>
        <SellerMenuItem icon={Pencil} label="Editar cupom" onSelect={() => onEdit(c)} />
        <SellerMenuItem icon={Copy} label="Copiar o código" onSelect={() => onCopyCode(c)} />
        {hasLink && <SellerMenuItem icon={Link2} label="Copiar link com desconto" onSelect={() => onCopyLink(c)} />}
        <SellerMenuItem icon={Plus} label="Duplicar" onSelect={() => onDuplicate(c)} />
        {st !== "expired" && st !== "exhausted" && (
          <SellerMenuItem icon={paused ? Play : Pause} label={paused ? "Reativar" : "Pausar"} onSelect={() => onToggle(c)} />
        )}
        <DropdownMenuSeparator className="my-1.5" />
        <SellerMenuItem icon={Trash2} label="Excluir" destructive onSelect={() => onDelete(c)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
