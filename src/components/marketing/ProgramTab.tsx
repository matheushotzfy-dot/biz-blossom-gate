import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Money } from "@/components/home/Money";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { Pager } from "@/components/seller-ui/Pager";
import { StatBand } from "@/components/seller-ui/StatBand";
import { StatusPill } from "@/components/seller-ui/tx";
import { cn } from "@/lib/utils";
import { SALE_STATUS, affiliateCode, isPaidSale, sinceLabel, type AffiliateLink, type AffiliateSale } from "./affiliateMeta";
import { CodeBadge, Thumb } from "./Thumb";

export interface ProgramProductRow {
  id: string; name: string; price: number; status: string; image_url: string | null;
  enabled: boolean; commission: number;
}

const PRODUCT_COLS = "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_90px_90px_130px_130px_44px]";
const LINK_COLS = "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_90px_90px_130px_96px]";
const SALE_COLS = "lg:grid-cols-[130px_minmax(0,1.3fr)_minmax(0,1fr)_130px_130px_120px]";
const PAGE = 8;

export interface ProgramTabProps {
  loading: boolean;
  hidden: boolean;
  products: ProgramProductRow[];
  /** Links de outras pessoas nos seus produtos. */
  links: AffiliateLink[];
  /** Vendas feitas por afiliados nos seus produtos. */
  sales: AffiliateSale[];
  productName: (id: string) => string;
  busyLinkId: string | null;
  onConfigure: (id: string) => void;
  onToggleLink: (l: AffiliateLink) => void;
}

export function ProgramTab(p: ProgramTabProps) {
  const [view, setView] = useState<"affiliates" | "sales">("affiliates");
  const [page, setPage] = useState(1);

  const paid = useMemo(() => p.sales.filter(isPaidSale), [p.sales]);
  const stats = useMemo(() => ({
    revenue: paid.reduce((s, x) => s + Number(x.sale_amount), 0),
    commissions: paid.reduce((s, x) => s + Number(x.commission_amount), 0),
    affiliates: new Set(p.links.map((l) => l.affiliate_user_id)).size,
    inProgram: p.products.filter((x) => x.enabled).length,
  }), [paid, p.links, p.products]);

  const byProduct = (id: string) => {
    const l = p.links.filter((x) => x.product_id === id);
    const s = paid.filter((x) => x.product_id === id);
    return { links: l.length, sales: s.length, revenue: s.reduce((a, x) => a + Number(x.sale_amount), 0), commissions: s.reduce((a, x) => a + Number(x.commission_amount), 0) };
  };
  const byLink = (id: string) => {
    const s = paid.filter((x) => x.affiliate_link_id === id);
    return { sales: s.length, earned: s.reduce((a, x) => a + Number(x.commission_amount), 0) };
  };

  const pagedSales = p.sales.slice((page - 1) * PAGE, page * PAGE);
  const money = (v: number, c?: string) => <Money value={v} hidden={p.hidden} className={c} centsClassName="opacity-70" />;

  return (
    <div className="space-y-5 lg:space-y-6">
      <StatBand
        label="Resumo do seu programa de afiliados"
        cells={[
          { label: "Vendas por afiliados", featured: true, loading: p.loading, value: money(stats.revenue), sub: `${paid.length} ${paid.length === 1 ? "venda paga" : "vendas pagas"}` },
          { label: "Comissões pagas", loading: p.loading, value: money(stats.commissions), sub: "Descontadas do seu saldo" },
          { label: "Afiliados", loading: p.loading, value: String(stats.affiliates), sub: `${p.links.length} ${p.links.length === 1 ? "link criado" : "links criados"}` },
          { label: "Produtos no programa", loading: p.loading, value: String(stats.inProgram), sub: `${p.products.length} ${p.products.length === 1 ? "produto" : "produtos"} no total` },
        ]}
      />

      {/* Produtos */}
      <section className="vp-sheet overflow-hidden" aria-label="Produtos e programa de afiliados">
        <div className="border-b border-border px-5 py-4 sm:px-7">
          <h2 className="text-[17px] font-extrabold tracking-[-0.025em] text-foreground">Seus produtos</h2>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">Escolha em quais produtos outras pessoas podem divulgar e quanto ganham por venda.</p>
        </div>
        {p.loading && p.products.length === 0 ? (
          <div className="space-y-3 p-5 sm:p-7">{Array.from({ length: 3 }, (_, i) => <div key={i} className="vp-skel h-16" />)}</div>
        ) : p.products.length === 0 ? (
          <EmptyPanel title="Você ainda não tem produtos" text="Publique um produto para poder abrir o programa de afiliados nele." action={<Link to="/vendas/produtos" className="vp-cta"><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Ir para produtos</Link>} />
        ) : (
          <div role="table" aria-label="Produtos">
            <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground lg:grid lg:items-center lg:gap-4", PRODUCT_COLS)}>
              <span role="columnheader">Produto</span><span role="columnheader">Programa</span><span role="columnheader" className="text-right">Afiliados</span><span role="columnheader" className="text-right">Vendas</span><span role="columnheader" className="text-right">Receita</span><span role="columnheader" className="text-right">Comissões</span><span role="columnheader" className="sr-only">Ações</span>
            </div>
            <ul>
              {p.products.map((pr) => {
                const d = byProduct(pr.id);
                return (
                  <li key={pr.id} role="row" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-t border-border px-5 py-4 first:border-t-0 sm:px-7 lg:gap-4", PRODUCT_COLS)}>
                    <span role="cell" className="col-start-1 flex min-w-0 items-center gap-3.5">
                      <Thumb src={pr.image_url} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] font-bold text-foreground">{pr.name}</span>
                        <span className="block text-[12.5px] text-muted-foreground">{pr.status === "active" ? "Ativo" : pr.status === "pending_review" ? "Em revisão" : "Pausado"}</span>
                      </span>
                    </span>
                    <span role="cell" className="col-start-2 justify-self-end lg:col-start-6 lg:row-start-1 lg:hidden">
                      <button type="button" className="vp-orb h-10 w-10" onClick={() => p.onConfigure(pr.id)} aria-label={`Configurar programa de ${pr.name}`}><Settings2 className="h-[18px] w-[18px]" /></button>
                    </span>
                    <span role="cell" className="col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
                      {pr.enabled ? <StatusPill label={`No programa, ${pr.commission}%`} tone="ok" /> : <StatusPill label="Fora do programa" tone="idle" />}
                    </span>
                    <span role="cell" className="col-span-2 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 text-[13px] lg:col-span-1 lg:contents">
                      <span className="lg:text-right lg:text-[14px]"><span className="block text-[12px] text-muted-foreground lg:hidden">Afiliados</span><span className="font-bold tabular-nums text-foreground">{d.links}</span></span>
                      <span className="lg:text-right lg:text-[14px]"><span className="block text-[12px] text-muted-foreground lg:hidden">Vendas</span><span className="font-bold tabular-nums text-foreground">{d.sales}</span></span>
                      <span className="lg:hidden"><span className="block text-[12px] text-muted-foreground">Comissões</span><span className="font-bold tabular-nums text-foreground">{p.hidden ? "R$ ••••" : money(d.commissions)}</span></span>
                    </span>
                    <span role="cell" className="hidden text-right text-[14px] font-semibold tabular-nums text-foreground lg:block">{money(d.revenue)}</span>
                    <span role="cell" className="hidden text-right text-[14px] font-semibold tabular-nums text-foreground lg:block">{money(d.commissions)}</span>
                    <span role="cell" className="hidden lg:block">
                      <button type="button" className="vp-orb h-10 w-10" onClick={() => p.onConfigure(pr.id)} aria-label={`Configurar programa de ${pr.name}`} title="Configurar programa"><Settings2 className="h-[18px] w-[18px]" /></button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Afiliados e vendas */}
      <section className="vp-sheet overflow-hidden" aria-label="Afiliados e vendas do programa">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <h2 className="text-[17px] font-extrabold tracking-[-0.025em] text-foreground">{view === "affiliates" ? "Quem divulga seus produtos" : "Vendas feitas por afiliados"}</h2>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">{view === "affiliates" ? "Cada afiliado aparece com um código, sem dados pessoais. Pause o link de quem não está ajudando." : "Cada venda traz quanto o afiliado recebeu de comissão."}</p>
          </div>
          <FilterPills<"affiliates" | "sales"> label="Ver afiliados ou vendas" value={view} onChange={(v) => { setView(v); setPage(1); }} options={[{ value: "affiliates", label: "Afiliados", count: p.links.length }, { value: "sales", label: "Vendas", count: p.sales.length }]} />
        </div>

        {view === "affiliates" ? (
          p.links.length === 0 ? (
            <EmptyPanel title="Ninguém divulga seus produtos ainda" text={stats.inProgram === 0 ? "Abra o programa em um produto. Ele passa a aparecer em Explorar produtos para outros vendedores." : "Seu produto já está em Explorar produtos. Quando alguém criar um link, ele aparece aqui."} />
          ) : (
            <div role="table" aria-label="Afiliados">
              <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground lg:grid lg:items-center lg:gap-4", LINK_COLS)}>
                <span role="columnheader">Afiliado</span><span role="columnheader">Produto</span><span role="columnheader" className="text-right">Comissão</span><span role="columnheader" className="text-right">Vendas</span><span role="columnheader" className="text-right">Ganhou</span><span role="columnheader" className="text-right">Link ativo</span>
              </div>
              <ul>
                {p.links.map((l) => {
                  const d = byLink(l.id);
                  return (
                    <li key={l.id} role="row" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t border-border px-5 py-3.5 first:border-t-0 sm:px-7 lg:gap-4", LINK_COLS, p.busyLinkId === l.id && "opacity-60", !l.is_active && "opacity-75")}>
                      <span role="cell" className="flex min-w-0 items-center gap-3.5">
                        <CodeBadge code={affiliateCode(l.affiliate_user_id)} active={l.is_active} />
                        <span className="min-w-0"><span className="block truncate text-[14.5px] font-bold text-foreground">Afiliado {affiliateCode(l.affiliate_user_id)}</span><span className="block text-[12.5px] text-muted-foreground">Desde {sinceLabel(l.created_at)}</span></span>
                      </span>
                      <span role="cell" className="col-start-2 row-start-1 justify-self-end lg:col-start-6 lg:row-start-1"><Switch checked={l.is_active} onCheckedChange={() => p.onToggleLink(l)} disabled={p.busyLinkId === l.id} aria-label={l.is_active ? `Pausar o link do afiliado ${affiliateCode(l.affiliate_user_id)}` : `Reativar o link do afiliado ${affiliateCode(l.affiliate_user_id)}`} /></span>
                      <span role="cell" className="col-span-2 truncate text-[13.5px] font-medium text-foreground lg:col-span-1 lg:col-start-2 lg:row-start-1">{p.productName(l.product_id)}</span>
                      <span role="cell" className="col-span-2 flex items-center justify-between gap-3 text-[13px] text-muted-foreground lg:contents">
                        <span className="lg:text-right lg:text-[14px] lg:font-semibold lg:text-foreground">{Number(l.commission_pct)}% <span className="lg:hidden">de comissão</span></span>
                        <span className="tabular-nums lg:text-right lg:text-[14px] lg:font-semibold lg:text-foreground">{d.sales} {d.sales === 1 ? "venda" : "vendas"}</span>
                        <span className="tabular-nums lg:text-right lg:text-[14px] lg:font-semibold lg:text-foreground">{money(d.earned)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        ) : p.sales.length === 0 ? (
          <EmptyPanel title="Nenhuma venda por afiliado ainda" text="Quando um cliente comprar por um link de afiliado, a venda aparece aqui com a comissão paga." />
        ) : (
          <div role="table" aria-label="Vendas por afiliados">
            <div role="row" className={cn("hidden border-b border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground lg:grid lg:items-center lg:gap-4", SALE_COLS)}>
              <span role="columnheader">Data</span><span role="columnheader">Produto</span><span role="columnheader">Afiliado</span><span role="columnheader" className="text-right">Venda</span><span role="columnheader" className="text-right">Comissão</span><span role="columnheader" className="text-right">Situação</span>
            </div>
            <ul>
              {pagedSales.map((s) => {
                const st = SALE_STATUS[s.status] ?? { label: s.status, tone: "idle" as const };
                return (
                  <li key={s.id} role="row" className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-border px-5 py-3.5 first:border-t-0 sm:px-7 lg:gap-4", SALE_COLS)}>
                    <span role="cell" className="col-start-1 row-start-1 text-[13px] tabular-nums text-muted-foreground lg:col-start-1 lg:text-[13.5px]">{sinceLabel(s.created_at)}</span>
                    <span role="cell" className="col-start-2 row-start-1 justify-self-end lg:col-start-6 lg:justify-self-end"><StatusPill label={st.label} tone={st.tone} /></span>
                    <span role="cell" className="col-span-2 truncate text-[14px] font-bold text-foreground lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:font-medium">{p.productName(s.product_id)}</span>
                    <span role="cell" className="col-span-2 text-[13px] text-muted-foreground lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:text-[13.5px]">Afiliado {affiliateCode(s.affiliate_user_id)}</span>
                    <span role="cell" className="col-span-2 flex items-center justify-between text-[13px] text-muted-foreground lg:contents">
                      <span className="tabular-nums lg:text-right lg:text-[14px] lg:font-semibold lg:text-foreground"><span className="lg:hidden">Venda </span>{money(Number(s.sale_amount))}</span>
                      <span className="tabular-nums lg:text-right lg:text-[14px] lg:font-semibold lg:text-foreground"><span className="lg:hidden">Comissão </span>{money(Number(s.commission_amount))}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <Pager page={page} pageSize={PAGE} total={p.sales.length} onPage={setPage} />
          </div>
        )}
      </section>
    </div>
  );
}
