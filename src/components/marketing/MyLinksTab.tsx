import { useMemo, useState } from "react";
import { Copy, Link2, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Money } from "@/components/home/Money";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { Pager } from "@/components/seller-ui/Pager";
import { StatBand } from "@/components/seller-ui/StatBand";
import { StatusPill } from "@/components/seller-ui/tx";
import { cn } from "@/lib/utils";
import { SALE_STATUS, affiliateUrl, isPaidSale, shortUrl, sinceLabel, type AffiliateLink, type AffiliateSale } from "./affiliateMeta";
import { Thumb } from "./Thumb";

const COLS = "lg:grid-cols-[130px_minmax(0,1.4fr)_90px_130px_130px_120px]";
const PAGE = 8;

export interface LinkProduct { name: string; image_url: string | null; checkout_url: string | null }

export interface MyLinksTabProps {
  loading: boolean;
  hidden: boolean;
  links: AffiliateLink[];
  sales: AffiliateSale[];
  product: (id: string) => LinkProduct | undefined;
  /** O produto ainda aceita afiliados (está na vitrine). */
  inProgram: (id: string) => boolean;
  busyLinkId: string | null;
  onToggle: (l: AffiliateLink) => void;
  onCopy: (url: string) => void;
  onExplore: () => void;
}

export function MyLinksTab(p: MyLinksTabProps) {
  const [page, setPage] = useState(1);
  const paid = useMemo(() => p.sales.filter(isPaidSale), [p.sales]);
  const earned = paid.reduce((s, x) => s + Number(x.commission_amount), 0);
  const refunded = p.sales.filter((s) => s.status === "refunded").length;
  const activeLinks = p.links.filter((l) => l.is_active).length;
  const avg = paid.length > 0 ? earned / paid.length : 0;
  const money = (v: number, c?: string) => <Money value={v} hidden={p.hidden} className={c} centsClassName="opacity-70" />;
  const pagedSales = p.sales.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="space-y-5 lg:space-y-6">
      <StatBand
        label="Resumo das suas afiliações"
        cells={[
          { label: "Comissões recebidas", featured: true, loading: p.loading, value: money(earned), sub: earned > 0 ? "Já creditadas no seu saldo" : "Nenhuma comissão ainda" },
          { label: "Vendas indicadas", loading: p.loading, value: String(paid.length), sub: refunded > 0 ? `${refunded} ${refunded === 1 ? "reembolsada" : "reembolsadas"}` : "Pagas e confirmadas" },
          { label: "Links ativos", loading: p.loading, value: String(activeLinks), sub: `${p.links.length} ${p.links.length === 1 ? "link criado" : "links criados"}` },
          { label: "Comissão por venda", loading: p.loading, value: money(avg), sub: paid.length > 0 ? "Média das vendas pagas" : "Aparece com a primeira venda" },
        ]}
      />

      {p.loading && p.links.length === 0 ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <li key={i} className="vp-skel h-[220px] !rounded-[22px]" />)}</ul>
      ) : p.links.length === 0 ? (
        <section className="vp-sheet">
          <EmptyPanel
            icon={<Link2 className="h-7 w-7" strokeWidth={1.8} />}
            title="Escolha um produto para divulgar"
            text="Você ganha uma comissão a cada venda feita pelo seu link. Veja os produtos que aceitam afiliados e gere o seu em um clique."
            action={<button type="button" className="vp-cta" onClick={p.onExplore}><Search className="h-[18px] w-[18px]" strokeWidth={2.4} />Explorar produtos</button>}
          />
        </section>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 xl:grid-cols-3" aria-label="Seus links de afiliado">
          {p.links.map((l) => {
            const pr = p.product(l.product_id);
            const url = affiliateUrl(pr?.checkout_url, l.slug);
            const mine = paid.filter((s) => s.affiliate_link_id === l.id);
            const open = p.inProgram(l.product_id);
            const gain = mine.reduce((a, x) => a + Number(x.commission_amount), 0);
            return (
              <li key={l.id} className={cn("vp-sheet flex flex-col p-5 sm:p-6", !l.is_active && "opacity-80", p.busyLinkId === l.id && "opacity-60")}>
                <div className="flex items-start gap-3.5">
                  <Thumb src={pr?.image_url} className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-[16px] font-extrabold leading-snug tracking-[-0.02em] text-foreground">{pr?.name ?? "Produto indisponível"}</h3>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">Comissão de {Number(l.commission_pct)}% desde {sinceLabel(l.created_at)}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-[16px] border border-border bg-background py-1.5 pl-4 pr-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-muted-foreground" title={url || undefined}>{url ? shortUrl(url) : "Este produto não tem página de pagamento"}</span>
                  <button type="button" className="vp-pill !h-9 shrink-0 bg-accent !px-3.5 !text-[13px] text-accent-foreground hover:!bg-accent disabled:opacity-50" disabled={!url} onClick={() => p.onCopy(url)} aria-label={`Copiar o link de ${pr?.name ?? "afiliado"}`}>
                    <Copy className="h-3.5 w-3.5" />Copiar
                  </button>
                </div>

                <dl className="mt-4 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
                  <div><dt className="text-[12.5px] text-muted-foreground">Vendas</dt><dd className="mt-0.5 text-[18px] font-extrabold tabular-nums tracking-[-0.03em] text-foreground">{mine.length}</dd></div>
                  <div><dt className="text-[12.5px] text-muted-foreground">Você ganhou</dt><dd className="mt-0.5 text-[18px] font-extrabold tracking-[-0.03em] text-foreground">{money(gain)}</dd></div>
                </dl>

                <div className="mt-auto pt-5">
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                    {open ? <StatusPill label={l.is_active ? "Link ativo" : l.paused_by_owner ? "Pausado pelo produtor" : "Link pausado"} tone={l.is_active ? "ok" : "idle"} /> : <StatusPill label="Programa encerrado" tone="idle" />}
                    <Switch checked={l.is_active && open} onCheckedChange={() => p.onToggle(l)} disabled={p.busyLinkId === l.id || !open || (!l.is_active && l.paused_by_owner)} aria-label={!open ? "Este produto não aceita mais afiliados" : !l.is_active && l.paused_by_owner ? "O produtor pausou este link e só ele pode reativar" : l.is_active ? "Pausar este link" : "Reativar este link"} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {p.sales.length > 0 && (
        <section className="vp-sheet overflow-hidden" aria-label="Histórico de comissões">
          <div className="border-b border-border px-5 py-4 sm:px-7">
            <h2 className="text-[17px] font-extrabold tracking-[-0.025em] text-foreground">Histórico de comissões</h2>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">Cada venda feita pelos seus links e o que você recebeu por ela.</p>
          </div>
          <div role="table" aria-label="Comissões">
            <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground lg:grid lg:items-center lg:gap-4", COLS)}>
              <span role="columnheader">Data</span><span role="columnheader">Produto</span><span role="columnheader" className="text-right">Comissão</span><span role="columnheader" className="text-right">Venda</span><span role="columnheader" className="text-right">Você recebeu</span><span role="columnheader" className="text-right">Situação</span>
            </div>
            <ul>
              {pagedSales.map((s) => {
                const st = SALE_STATUS[s.status] ?? { label: s.status, tone: "idle" as const };
                const pr = p.product(s.product_id);
                return (
                  <li key={s.id} role="row" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-border px-5 py-3.5 first:border-t-0 sm:px-7 lg:gap-4", COLS)}>
                    <span role="cell" className="col-start-1 row-start-1 text-[13px] tabular-nums text-muted-foreground lg:text-[13.5px]">{sinceLabel(s.created_at)}</span>
                    <span role="cell" className="col-start-2 row-start-1 justify-self-end lg:col-start-6"><StatusPill label={st.label} tone={st.tone} /></span>
                    <span role="cell" className="col-span-2 truncate text-[14px] font-bold text-foreground lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:font-medium">{pr?.name ?? "Produto indisponível"}</span>
                    <span role="cell" className="col-span-2 flex items-center justify-between text-[13px] text-muted-foreground lg:contents">
                      <span className="lg:text-right lg:text-[14px] lg:font-semibold lg:text-foreground">{Number(s.commission_pct)}%</span>
                      <span className="tabular-nums lg:text-right lg:text-[14px] lg:font-semibold lg:text-foreground">{money(Number(s.sale_amount))}</span>
                      <span className="tabular-nums lg:text-right lg:text-[14px] lg:font-semibold lg:text-foreground">{money(Number(s.commission_amount))}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <Pager page={page} pageSize={PAGE} total={p.sales.length} onPage={setPage} />
          </div>
        </section>
      )}
    </div>
  );
}
