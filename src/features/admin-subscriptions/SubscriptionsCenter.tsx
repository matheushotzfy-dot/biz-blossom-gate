import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Layers, Loader2, Repeat, Search, TrendingUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { brl } from "@/features/admin-finance/types";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { PlansCards, PlansTable, SubscriptionsCards, SubscriptionsTable } from "./SubscriptionsList";
import { PlanSheet, SubscriptionSheet } from "./SubscriptionSheet";
import { PAGE_SIZE, PLAN_PILLS, SUB_PILLS, parsePlansPage, parseSubsPage, type PlanFilter, type PlanItem, type SubFilter, type SubItem, type View } from "./subscriptionsModel";

const VIEWS: { value: View; label: string }[] = [{ value: "subscriptions", label: "Assinaturas" }, { value: "plans", label: "Planos" }];

/** Assinaturas e planos recorrentes de todos os sellers: quem assina, o que está atrasado e a ação de pausar plano ou cancelar assinatura. Só administrador. */
export default function SubscriptionsCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={Repeat} title="As assinaturas são do administrador" subtitle="Peça ao administrador para revisar um plano ou uma assinatura." />;
  return <Center />;
}

function Center() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>("subscriptions");
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [subId, setSubId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  const bySub = view === "subscriptions";

  // Números do topo: independentes da aba, da busca e da página, e atualizados junto com o resto.
  const oq = useQuery({
    queryKey: ["admin-subscriptions", "overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_subscriptions_page" as never, { _filter: "all", _search: null, _page: 1, _page_size: 1 } as never);
      if (error) throw error;
      return parseSubsPage(data).program;
    },
  });

  const sq = useQuery({
    queryKey: ["admin-subscriptions", subFilter, debounced, page],
    enabled: bySub,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_subscriptions_page" as never, { _filter: subFilter, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseSubsPage(data);
    },
    placeholderData: keepPreviousData,
  });

  const pq = useQuery({
    queryKey: ["admin-subscription-plans", planFilter, debounced, page],
    enabled: !bySub,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_subscription_plans_page" as never, { _filter: planFilter, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parsePlansPage(data);
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      void qc.invalidateQueries({ queryKey: ["admin-subscription-plans"] });
    };
    const ch = supabase.channel(uniqueChannelName("admin-subscriptions-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscription_plans" }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const q = bySub ? sq : pq;
  const sItems = sq.data?.items ?? [];
  const pItems = pq.data?.items ?? [];
  const count = bySub ? sItems.length : pItems.length;
  const total = (bySub ? sq.data?.total : pq.data?.total) ?? 0;
  const prog = oq.data ?? null;
  const ss = sq.data?.summary;
  const ps = pq.data?.summary;
  const subSeed: SubItem | null = useMemo(() => sItems.find((i) => i.id === subId) ?? null, [sItems, subId]);
  const planSeed: PlanItem | null = useMemo(() => pItems.find((i) => i.id === planId) ?? null, [pItems, planId]);

  const filter = bySub ? subFilter : planFilter;
  const filtersActive = filter !== "all" || !!debounced;
  const clear = () => { setSubFilter("all"); setPlanFilter("all"); setSearch(""); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = oq.isError ? "Indisponível" : "Carregando…";

  const heroStatus = !prog ? (oq.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : prog.late > 0 ? { tone: "warning" as const, label: `${prog.late} ${prog.late === 1 ? "assinatura atrasada" : "assinaturas atrasadas"}`, pulse: true }
      : prog.plans_held > 0 ? { tone: "warning" as const, label: `${prog.plans_held} ${prog.plans_held === 1 ? "plano pausado pela equipe" : "planos pausados pela equipe"}` }
        : { tone: "success" as const, label: `${prog.active} ${prog.active === 1 ? "assinatura ativa" : "assinaturas ativas"}` };

  const subPills = useMemo(() => SUB_PILLS.map((p) => ({ ...p, label: ss ? `${p.label} · ${ss[p.value].toLocaleString("pt-BR")}` : p.label })), [ss]);
  const planPills = useMemo(() => PLAN_PILLS.map((p) => ({ ...p, label: ps ? `${p.label} · ${ps[p.value].toLocaleString("pt-BR")}` : p.label })), [ps]);

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero eyebrow="Conteúdo" title="Assinaturas" subtitle="Planos recorrentes dos sellers e quem assina. Veja o que está atrasado, pause um plano com problema ou cancele uma assinatura." status={heroStatus} />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={CheckCircle2} label="Assinaturas ativas" value={n(prog?.active)} tone="success" sub={prog ? (prog.trial > 0 ? `${prog.trial.toLocaleString("pt-BR")} em teste` : `${prog.subs.toLocaleString("pt-BR")} no total`) : pending} />
        <PremiumMetric icon={AlertTriangle} label="Atrasadas" value={n(prog?.late)} tone={prog && prog.late > 0 ? "warning" : undefined} sub={prog ? (prog.late > 0 ? "aguardando pagamento" : "nenhuma atrasada") : pending} />
        <PremiumMetric icon={TrendingUp} label="Receita mensal" value={prog ? brl(prog.monthly) : "—"} sub={prog ? "estimativa pelo preço" : pending} />
        <PremiumMetric icon={Layers} label="Planos no ar" value={n(prog?.plans_live)} sub={prog ? (prog.plans === 0 ? "nenhum plano criado" : `de ${prog.plans.toLocaleString("pt-BR")}${prog.plans_held > 0 ? ` · ${prog.plans_held.toLocaleString("pt-BR")} pausados` : ""}`) : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Receita recorrente" icon={Repeat}>
        <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          A cobrança automática de cada ciclo ainda não existe: ela depende da adquirente de cartão e do Pix recorrente. Hoje esta tela mostra o que os sellers cadastraram e o que foi pago.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PremiumSegmented<View> value={view} onChange={(v) => { setView(v); setPage(1); setSubId(null); setPlanId(null); }} options={VIEWS} />
          {bySub
            ? <PremiumSegmented<SubFilter> value={subFilter} onChange={(v) => { setSubFilter(v); setPage(1); }} options={subPills} />
            : <PremiumSegmented<PlanFilter> value={planFilter} onChange={(v) => { setPlanFilter(v); setPage(1); }} options={planPills} />}
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label={bySub ? "Buscar assinaturas" : "Buscar planos"} placeholder={bySub ? "Assinante, plano ou seller" : "Plano, produto ou seller"} value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>

        {q.isError && !q.isFetching ? (
          <ErrorBlock title={bySub ? "Não foi possível carregar as assinaturas." : "Não foi possível carregar os planos."} error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {bySub ? "Carregando as assinaturas…" : "Carregando os planos…"}</p>
        ) : count === 0 ? (
          <div>
            <PremiumEmpty icon={bySub ? Repeat : Layers} title={filtersActive ? "Nada por aqui" : bySub ? "Nenhuma assinatura ainda" : "Nenhum plano criado"}
              subtitle={filtersActive ? "Nada bate com esses filtros." : bySub ? "Quando alguém assinar um plano de um seller, a assinatura aparece aqui." : "Quando um seller criar um plano de assinatura, ele aparece aqui."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            {bySub ? (
              <>
                <SubscriptionsTable rows={sItems} onOpen={(s) => setSubId(s.id)} />
                <SubscriptionsCards rows={sItems} onOpen={(s) => setSubId(s.id)} />
              </>
            ) : (
              <>
                <PlansTable rows={pItems} onOpen={(p) => setPlanId(p.id)} />
                <PlansCards rows={pItems} onOpen={(p) => setPlanId(p.id)} />
              </>
            )}
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <SubscriptionSheet id={subId} seed={subSeed} onClose={() => setSubId(null)} />
      <PlanSheet id={planId} seed={planSeed} onClose={() => setPlanId(null)} />
    </div>
  );
}
