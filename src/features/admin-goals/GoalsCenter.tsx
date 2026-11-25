import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Gift, Loader2, Plus, Target, Timer, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { ToneTag } from "@/features/admin-products/parts";
import { uniqueChannelName } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { GoalDetail } from "./GoalDetail";
import { GoalDialog } from "./GoalDialog";
import { LIST_KEY, callRpc, useRefreshGoals } from "./goalsApi";
import { brl, goalTag, heroStatus, matchesFilter, parseGoals, plural, shortDate, statsOf, type GoalFilter } from "./goalsModel";

/** Metas de faturamento com prêmio: criar, acompanhar quem bateu e registrar a entrega do prêmio. Só administrador. */
export default function GoalsCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={Target} title="A gestão das metas é do administrador" subtitle="Peça ao administrador para acompanhar as metas." />;
  return <Center />;
}

function Center() {
  const refresh = useRefreshGoals();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<GoalFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({
    queryKey: [...LIST_KEY],
    queryFn: async () => parseGoals(await callRpc("get_admin_goals")),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  // outra pessoa da equipe mexeu: atualiza, mas espera a rajada passar
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(timer); timer = setTimeout(refresh, 800); };
    const ch = supabase.channel(uniqueChannelName("admin-goals-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_goals" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_goal_achievements" }, bump)
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const visible = useMemo(() => items.filter((g) => matchesFilter(g, filter)), [items, filter]);
  const count = (f: GoalFilter) => items.filter((g) => matchesFilter(g, f)).length;
  const currentId = selected && visible.some((g) => g.id === selected) ? selected : (visible[0]?.id ?? null);
  const stats = statsOf(items);
  const loaded = !!q.data;
  const pending = q.isError ? "Indisponível" : "Carregando…";
  const n = (v: number) => (loaded ? v.toLocaleString("pt-BR") : "—");

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero eyebrow="Sistema" title="Metas de faturamento" status={heroStatus(q.data, q.isError)}
        subtitle="Metas com prêmio para quem faturar um valor dentro de um período: acompanhe quem bateu e registre a entrega do prêmio." />

      <p role="note" className="rounded-[12px] bg-muted/40 px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground">
        Os sellers ainda não têm uma tela para ver as metas. Por enquanto, elas servem para a equipe acompanhar quem bateu cada valor e registrar a entrega do prêmio; avise quem bateu pelas Notificações.
      </p>

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Timer} label="Metas no ar" value={n(stats.live)} sub={loaded ? `de ${plural(q.data?.total ?? 0, "meta criada", "metas criadas")}` : pending} />
        <PremiumMetric icon={Users} label="Bateram a meta" value={n(stats.reachedLive)} sub={loaded ? "nas metas no ar" : pending} />
        <PremiumMetric icon={Gift} label="Prêmios a entregar" value={n(stats.toDeliver)} tone={loaded && stats.toDeliver > 0 ? "warning" : undefined}
          sub={loaded ? (stats.toDeliver > 0 ? "falta entregar" : "nada pendente") : pending} />
        <PremiumMetric icon={CheckCircle2} label="Prêmios entregues" value={n(stats.delivered)} sub={loaded ? "registrados nesta tela" : pending} />
      </PremiumMetricGrid>

      {q.isError && !q.data ? (
        <PremiumPanel><ErrorBlock title="Não foi possível carregar as metas." error={q.error} onRetry={() => void q.refetch()} /></PremiumPanel>
      ) : q.isPending ? (
        <PremiumPanel><p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as metas…</p></PremiumPanel>
      ) : items.length === 0 ? (
        <PremiumPanel>
          <PremiumEmpty icon={Target} title="Nenhuma meta criada" subtitle="A meta nasce oculta; você coloca no ar quando o valor, o período e o prêmio estiverem prontos." />
          <div className="-mt-6 pb-4 text-center"><button type="button" className="vp-cta !h-11 gap-1.5 !px-5" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Criar a primeira meta</button></div>
        </PremiumPanel>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <PremiumPanel title="Metas" icon={Target} action={<button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px]" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" aria-hidden /> Nova meta</button>}>
            <div className="space-y-3">
              <PremiumSegmented<GoalFilter> value={filter} onChange={setFilter} options={[
                { value: "all", label: `Todas · ${count("all")}` }, { value: "live", label: `No ar · ${count("live")}` },
                { value: "scheduled", label: `Agendadas · ${count("scheduled")}` }, { value: "ended", label: `Encerradas · ${count("ended")}` }, { value: "hidden", label: `Ocultas · ${count("hidden")}` },
              ]} />
              {visible.length === 0 ? (
                <p className="rounded-[12px] bg-muted/40 px-4 py-3.5 text-[13.5px] text-muted-foreground">Nenhuma meta neste filtro.</p>
              ) : (
                <ul className="-mx-2 space-y-1" aria-label="Metas">
                  {visible.map((g) => {
                    const t = goalTag(g);
                    const on = g.id === currentId;
                    return (
                      <li key={g.id}>
                        <button type="button" onClick={() => setSelected(g.id)} aria-current={on ? "true" : undefined}
                          style={on ? { boxShadow: "inset 0 0 0 1.5px hsl(var(--primary))" } : undefined}
                          className={cn("flex w-full flex-col gap-1 rounded-[14px] px-3.5 py-3 text-left transition-colors hover:bg-muted/40", on && "bg-primary/5")}>
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[14.5px] font-semibold text-foreground">{g.title}</span>
                            <ToneTag tone={t.tone}>{t.label}</ToneTag>
                          </span>
                          <span className="text-[12.5px] text-muted-foreground">{shortDate(g.starts_at)} a {shortDate(g.ends_at)}</span>
                          <span className="text-[12.5px] tabular-nums text-muted-foreground">{brl(g.target)} · {g.reward_title}</span>
                          <span className="text-[12.5px] text-muted-foreground">
                            {plural(g.reached, "bateu", "bateram")}
                            {g.to_deliver > 0 && <span className="font-semibold text-warning"> · {g.to_deliver.toLocaleString("pt-BR")} a entregar</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {q.data && q.data.total > items.length && <p className="text-[12.5px] text-muted-foreground">Mostrando as {items.length.toLocaleString("pt-BR")} mais recentes de {q.data.total.toLocaleString("pt-BR")}.</p>}
            </div>
          </PremiumPanel>

          {currentId && <GoalDetail key={currentId} id={currentId} onDeleted={() => setSelected(null)} onSaved={(id) => { setSelected(id); refresh(); }} />}
        </div>
      )}

      <GoalDialog goal={null} locked={false} open={createOpen} onClose={() => setCreateOpen(false)} onDone={(id) => { setSelected(id); setFilter("all"); refresh(); }} />
    </div>
  );
}
