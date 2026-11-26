import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ToneTag } from "@/features/admin-disputes/parts";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { methodLabel } from "@/features/admin-disputes/disputesModel";
import { txStatusMeta } from "@/components/seller-ui/txMeta";
import { deriveTransactionStatus } from "@/lib/utils";
import { PremiumEmpty, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { dayTime, money, parseTxPage } from "./staffPanelModel";

const TONE = { ok: "success", wait: "warning", alert: "destructive", idle: "neutral", info: "info" } as const;

/** Vendas dos sellers da carteira, só depois do vínculo de cada um. O servidor exige a permissão "Ver as vendas". */
export default function TransactionsSection({ range }: { range: { from: Date; to: Date } }) {
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setSearch(text.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [text]);
  useEffect(() => { setPage(1); }, [range.from, range.to]);

  const q = useQuery({
    queryKey: ["staff-tx", range.from.toISOString(), range.to.toISOString(), page, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_staff_portfolio_transactions", { _from: range.from.toISOString(), _to: range.to.toISOString(), _page: page, _search: search });
      if (error) throw error;
      return parseTxPage(data);
    },
    placeholderData: keepPreviousData,
  });
  const rows = q.data?.rows ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader title="Vendas" subtitle="Todas as tentativas de venda dos sellers da sua carteira no período, pagas ou não. Venda de antes do vínculo não aparece." />
      <PremiumPanel title={q.data ? `${q.data.total.toLocaleString("pt-BR")} ${q.data.total === 1 ? "venda no período" : "vendas no período"}` : "Vendas da carteira"} icon={CreditCard}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar vendas" placeholder="Seller, comprador ou ID da venda" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {text && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => setText("")}><X className="h-3.5 w-3.5" /> Limpar busca</Button>}
        </div>
        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar as vendas." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as vendas…</p>
        ) : rows.length === 0 ? (
          <PremiumEmpty icon={CreditCard} title={search ? "Nenhuma venda com essa busca" : "Nenhuma venda no período"} subtitle={search ? "Confira o nome ou o ID." : "Troque o período no topo para ver outros dias."} />
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <ul className="m-0 grid grid-cols-[minmax(0,1fr)] gap-2 p-0" style={{ listStyle: "none" }} aria-label="Vendas da carteira">
              <li aria-hidden className="hidden px-4 pb-1 text-[12px] font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-4">
                <span>Data</span><span>Seller</span><span>Comprador</span><span>Meio</span><span>Situação</span><span className="text-right">Valor</span>
              </li>
              {rows.map((t) => {
                const st = txStatusMeta(deriveTransactionStatus({ status: t.status, payment_method: t.method, created_at: t.createdAt }));
                return (
                  <li key={t.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 rounded-[12px] px-4 py-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-center"
                    style={{ border: "1px solid hsl(var(--border) / .7)" }}>
                    <span className="text-[13px] text-muted-foreground lg:order-none">{dayTime(t.createdAt)}</span>
                    <span className="justify-self-end text-[14px] font-semibold tabular-nums text-foreground lg:order-last lg:text-right">{money(t.amount)}</span>
                    <span className="min-w-0 truncate text-[14px] font-medium text-foreground">{t.seller}</span>
                    <span className="min-w-0 truncate text-[13px] text-muted-foreground lg:text-[14px] lg:text-foreground">{t.customer ?? "Comprador sem nome"}</span>
                    <span className="text-[13px] text-muted-foreground">{methodLabel(t.method)}</span>
                    <span><ToneTag tone={TONE[st.tone]}>{st.label}</ToneTag></span>
                  </li>
                );
              })}
            </ul>
            <AdminPager page={page} pageSize={q.data?.pageSize ?? 25} totalCount={q.data?.total ?? 0} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>
    </div>
  );
}
