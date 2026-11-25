import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, Flag, Loader2, Plus, Timer, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { ToneTag } from "@/features/admin-products/parts";
import { uniqueChannelName } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { RaceDetail } from "./RaceDetail";
import { RaceDialog } from "./RaceDialog";
import { LIST_KEY, callRpc, useRefreshRace } from "./raceApi";
import { brl0, heroStatus, parseRaces, phaseLine, plural, raceTag, shortDate } from "./raceModel";

/** Corridas de faturamento: criar, colocar no ar, ranking, prêmios e quem leva cada um. Só administrador. */
export default function RaceCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={Flag} title="A gestão das corridas é do administrador" subtitle="Peça ao administrador para acompanhar as corridas." />;
  return <Center />;
}

function Center() {
  const refresh = useRefreshRace();
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const q = useQuery({
    queryKey: [...LIST_KEY],
    queryFn: async () => parseRaces(await callRpc("get_admin_races")),
    placeholderData: keepPreviousData,
  });

  // outra pessoa da equipe mexeu, ou uma venda mudou o ranking: atualiza, mas espera a rajada passar
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(timer); timer = setTimeout(refresh, 800); };
    const ch = supabase.channel(uniqueChannelName("admin-race-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_races" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_race_prizes" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "revenue_race_overrides" }, bump)
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const live = items.find((r) => r.is_live) ?? null;
  const currentId = selected && items.some((r) => r.id === selected) ? selected : (live?.id ?? items[0]?.id ?? null);
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";
  const loaded = !!q.data;
  const tag = live ? raceTag(live) : null;

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero eyebrow="Conteúdo" title="Corridas" status={heroStatus(q.data, q.isError)}
        subtitle="A disputa de faturamento que os sellers veem em Premiações: período, prêmios, ranking e quem leva cada prêmio." />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Timer} label="Corrida no ar" value={loaded ? (tag ? tag.label : "Nenhuma") : "—"} tone={tag?.tone === "warning" ? "warning" : tag?.tone === "success" ? "success" : undefined}
          sub={loaded ? (live ? `${live.title}, ${phaseLine(live).toLowerCase()}` : "os sellers não veem corrida") : pending} />
        <PremiumMetric icon={Users} label="Participantes reais" value={n(live?.participants)} sub={loaded ? (live ? "com venda paga no período" : "—") : pending} />
        <PremiumMetric icon={Banknote} label="Faturamento no período" value={live ? brl0(live.revenue_cents) : "—"} sub={loaded ? (live ? plural(live.sales, "venda paga", "vendas pagas") : "—") : pending} />
        <PremiumMetric icon={AlertTriangle} label="Participantes sem conta" value={n(live?.fictional)} tone={live && live.fictional > 0 ? "warning" : undefined}
          sub={loaded ? (live ? (live.fictional > 0 ? "aparecem como pessoas reais" : "nenhum no ranking") : "—") : pending} />
      </PremiumMetricGrid>

      {q.isError && !q.data ? (
        <PremiumPanel><ErrorBlock title="Não foi possível carregar as corridas." error={q.error} onRetry={() => void q.refetch()} /></PremiumPanel>
      ) : q.isPending ? (
        <PremiumPanel><p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as corridas…</p></PremiumPanel>
      ) : items.length === 0 ? (
        <PremiumPanel>
          <PremiumEmpty icon={Flag} title="Nenhuma corrida criada" subtitle="A corrida nasce oculta; você coloca no ar quando o ranking e os prêmios estiverem prontos." />
          <div className="-mt-6 pb-4 text-center"><button type="button" className="vp-cta !h-11 gap-1.5 !px-5" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Criar a primeira corrida</button></div>
        </PremiumPanel>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <PremiumPanel title="Corridas" icon={Flag} action={<button type="button" className="vp-ghost !h-9 gap-1.5 !px-3 !text-[13px]" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" aria-hidden /> Nova corrida</button>}>
            <ul className="-m-2 space-y-1" aria-label="Corridas">
              {items.map((r) => {
                const t = raceTag(r);
                const on = r.id === currentId;
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSelected(r.id)} aria-current={on ? "true" : undefined}
                      style={on ? { boxShadow: "inset 0 0 0 1.5px hsl(var(--primary))" } : undefined}
                      className={cn("flex w-full flex-col gap-1 rounded-[14px] px-3.5 py-3 text-left transition-colors hover:bg-muted/40", on && "bg-primary/5")}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[14.5px] font-semibold text-foreground">{r.title}</span>
                        <ToneTag tone={t.tone}>{t.label}</ToneTag>
                      </span>
                      <span className="text-[12.5px] text-muted-foreground">{shortDate(r.starts_at)} a {shortDate(r.ends_at)}</span>
                      <span className="text-[12.5px] text-muted-foreground">
                        {plural(r.prizes, "prêmio", "prêmios")} · {plural(r.participants, "participante", "participantes")}
                        {r.fictional > 0 && <span className="font-semibold text-warning"> · {plural(r.fictional, "sem conta", "sem conta")}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PremiumPanel>

          {currentId && <RaceDetail key={currentId} id={currentId} onDeleted={() => setSelected(null)} onSaved={(id) => { setSelected(id); refresh(); }} />}
        </div>
      )}

      <RaceDialog race={null} open={createOpen} onClose={() => setCreateOpen(false)} onDone={(id) => { setSelected(id); refresh(); }} />
    </div>
  );
}
