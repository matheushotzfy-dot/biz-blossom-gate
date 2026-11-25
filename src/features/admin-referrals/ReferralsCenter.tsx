import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Banknote, Clock, Loader2, Plus, Search, Share2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { brl } from "@/features/admin-finance/types";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { CreateDialog } from "./CreateDialog";
import { ReferralSheet } from "./ReferralSheet";
import { ReferralsCards, ReferralsTable } from "./ReferralsList";
import { PAGE_SIZE, PILLS, parseRefPage, type Filter, type RefItem } from "./referralsModel";

/** Indicações dos sellers: quem indicou quem, o que falta qualificar e pagar. Só administrador. */
export default function ReferralsCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={Share2} title="As indicações são do administrador" subtitle="Peça ao administrador para revisar uma indicação." />;
  return <Center />;
}

function Center() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Números do topo: independentes do filtro, da busca e da página, e atualizados junto com o resto.
  const oq = useQuery({
    queryKey: ["admin-referrals", "overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_referrals_page" as never, { _filter: "all", _search: null, _page: 1, _page_size: 1 } as never);
      if (error) throw error;
      return parseRefPage(data).program;
    },
  });

  const q = useQuery({
    queryKey: ["admin-referrals", filter, debounced, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_referrals_page" as never, { _filter: filter, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseRefPage(data);
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const ch = supabase.channel(uniqueChannelName("admin-referrals-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => { void qc.invalidateQueries({ queryKey: ["admin-referrals"] }); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const s = q.data?.summary;
  const prog = oq.data ?? null;
  const seed: RefItem | null = useMemo(() => items.find((i) => i.id === openId) ?? null, [items, openId]);

  const filtersActive = filter !== "all" || !!debounced;
  const clear = () => { setFilter("all"); setSearch(""); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = oq.isError ? "Indisponível" : "Carregando…";

  const heroStatus = !prog ? (oq.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : prog.qualified > 0 ? { tone: "warning" as const, label: `${prog.qualified} ${prog.qualified === 1 ? "recompensa a pagar" : "recompensas a pagar"}`, pulse: true }
      : prog.pending > 0 ? { tone: "info" as const, label: `${prog.pending} ${prog.pending === 1 ? "indicação pendente" : "indicações pendentes"}` }
        : prog.total === 0 ? { tone: "neutral" as const, label: "Nenhuma indicação" }
          : { tone: "success" as const, label: "Tudo em dia" };

  const pills = useMemo(() => PILLS.map((p) => ({ ...p, label: s ? `${p.label} · ${s[p.value].toLocaleString("pt-BR")}` : p.label })), [s]);

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero eyebrow="Conteúdo" title="Indicações" status={heroStatus}
        subtitle="Quem um seller indicou e a recompensa de cada indicação. Qualifique quando o indicado criar conta e registre o pagamento depois de pagar."
        actions={<Button type="button" size="sm" className="gap-1.5" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> Registrar indicação</Button>} />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Share2} label="Indicações" value={n(prog?.total)} sub={prog ? (prog.total === 0 ? "nenhuma ainda" : `de ${prog.referrers.toLocaleString("pt-BR")} ${prog.referrers === 1 ? "seller" : "sellers"}`) : pending} />
        <PremiumMetric icon={Clock} label="Pendentes" value={n(prog?.pending)} tone={prog && prog.pending > 0 ? "info" : undefined} sub={prog ? (prog.pending > 0 ? `${brl(prog.expected)} previstos` : "nenhuma pendente") : pending} />
        <PremiumMetric icon={BadgeCheck} label="A pagar" value={prog ? brl(prog.owed) : "—"} tone={prog && prog.owed > 0 ? "warning" : undefined}
          sub={prog ? (prog.qualified > 0 ? `${prog.qualified.toLocaleString("pt-BR")} ${prog.qualified === 1 ? "qualificada" : "qualificadas"}` : "nada a pagar") : pending} />
        <PremiumMetric icon={Banknote} label="Já pagas" value={prog ? brl(prog.paid_amount) : "—"} tone={prog && prog.paid > 0 ? "success" : undefined}
          sub={prog ? `${prog.paid.toLocaleString("pt-BR")} ${prog.paid === 1 ? "indicação" : "indicações"}` : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Programa de indicação" icon={Share2}>
        <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          O seller ainda não tem uma tela para indicar, e nada qualifica ou paga sozinho: a equipe registra a indicação, qualifica e marca o pagamento feito por fora. Pagar aqui não mexe no saldo do seller.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PremiumSegmented<Filter> value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={pills} />
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar indicações" placeholder="E-mail do indicado ou nome do seller" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>

        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar as indicações." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as indicações…</p>
        ) : items.length === 0 ? (
          <div>
            <PremiumEmpty icon={Share2} title={filtersActive ? "Nada por aqui" : "Nenhuma indicação ainda"}
              subtitle={filtersActive ? "Nada bate com esses filtros." : "Quando um seller avisar que indicou alguém, registre a indicação aqui."} />
            {filtersActive
              ? <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>
              : <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> Registrar indicação</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <ReferralsTable rows={items} onOpen={(r) => setOpenId(r.id)} />
            <ReferralsCards rows={items} onOpen={(r) => setOpenId(r.id)} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <ReferralSheet id={openId} seed={seed} onClose={() => setOpenId(null)} />
      <CreateDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
