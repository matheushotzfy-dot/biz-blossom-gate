import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Radar, Search, Snowflake, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { useReason } from "@/components/seller-ui/confirm";
import { brl } from "@/features/admin-finance/types";
import { logAdminAction } from "@/lib/auditLog";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { PremiumEmpty, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { ErrorBlock } from "./BlacklistPanel";
import { PAGE_SIZE, RADAR_HIGH, RADAR_MIN_SALES, RADAR_WATCH, RADAR_WINDOWS, levelLabel, levelReason, levelTone, parseRadarPage, pct, useDebouncedValue, type RadarFilter, type RadarItem, type RadarWindow } from "./antifraudModel";

const TONE = {
  destructive: "border-destructive/25 bg-destructive/10 text-destructive", warning: "border-warning/25 bg-warning/10 text-warning",
  success: "border-success/25 bg-success/10 text-success", muted: "border-border bg-muted/40 text-muted-foreground",
};
const windowLabel = (d: RadarWindow) => (d === 365 ? "1 ano" : `${d} dias`);

export function RadarPanel({ days, onDays }: { days: RadarWindow; onDays: (d: RadarWindow) => void }) {
  const qc = useQueryClient();
  const { ask, dialog: reasonDialog } = useReason();
  const [level, setLevel] = useState<RadarFilter>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [freezing, setFreezing] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-chargeback-radar", days, level, debounced, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_chargeback_radar" as never, { _days: days, _level: level, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseRadarPage(data);
    },
    placeholderData: keepPreviousData,
  });
  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const summary = q.data?.summary;

  const freeze = useMutation({
    mutationFn: async ({ s, reason }: { s: RadarItem; reason: string }) => {
      const { error } = await supabase.rpc("admin_freeze_account", { _user_id: s.user_id, _freeze: true, _reason: reason });
      if (error) throw error;
    },
    onSuccess: (_d, { s, reason }) => {
      toast.success("Saldo congelado. O seller foi avisado.");
      void logAdminAction("freeze_from_radar", "profile", s.user_id, { reason, chargeback_rate: s.cb_rate });
      void qc.invalidateQueries({ queryKey: ["admin-chargeback-radar"] });
    },
    onError: (e) => toast.error("Não foi possível congelar. O saldo não mudou.", { description: friendlyError(e, "Tente de novo em instantes.") }),
    onSettled: () => setFreezing(null),
  });

  const onFreeze = async (s: RadarItem) => {
    const reason = await ask({
      title: `Congelar o saldo de ${s.full_name || s.email || "este seller"}?`, label: "Motivo", minLength: 5, confirmLabel: "Congelar saldo", tone: "warning",
      placeholder: "Ex.: taxa de chargeback acima do limite",
      description: "Saques ficam bloqueados até você descongelar na aba Sellers. O seller recebe este motivo numa notificação, então escreva de forma que ele entenda.",
    });
    if (!reason) return;
    setFreezing(s.user_id);
    await freeze.mutateAsync({ s, reason }).catch(() => undefined);
  };

  const filtersActive = level !== "all" || !!debounced;
  const clear = () => { setLevel("all"); setSearch(""); setPage(1); };
  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} · ${n.toLocaleString("pt-BR")}`);
  const pills = useMemo<{ value: RadarFilter; label: string }[]>(() => [
    { value: "all", label: withCount("Todos", summary?.sellers) },
    { value: "high", label: withCount("Em risco", summary?.high) },
    { value: "watch", label: withCount("Atenção", summary?.watch) },
    { value: "ok", label: withCount("Em dia", summary?.ok) },
    { value: "few", label: withCount("Poucas vendas", summary?.few) },
  ], [summary]);
  const ctx: Ctx = { freezing, busy: freeze.isPending, onFreeze };

  return (
    <PremiumPanel title="Radar de chargeback" icon={Radar}
      action={<PremiumSegmented<`${RadarWindow}`> value={`${days}`} onChange={(v) => { onDays(Number(v) as RadarWindow); setPage(1); }} options={RADAR_WINDOWS.map((d) => ({ value: `${d}` as `${RadarWindow}`, label: windowLabel(d) }))} />}>
      <p className="mb-1 max-w-3xl text-[13px] text-muted-foreground">
        Chargebacks divididos pelas vendas pagas de cada seller nos últimos {windowLabel(days)}, contando o banco inteiro. Acima de {pct(RADAR_HIGH)} é risco; acima de {pct(RADAR_WATCH)}, atenção.
        Quem tem menos de {RADAR_MIN_SALES} vendas fica em "poucas vendas", porque 1 chargeback em 1 venda não diz nada ainda. Reembolso aparece à parte: não entra na taxa.
      </p>
      {summary && summary.sales > 0 && (
        <p className="mb-4 text-[12.5px] text-muted-foreground">
          Plataforma no período: {summary.sales.toLocaleString("pt-BR")} vendas pagas, {summary.chargebacks.toLocaleString("pt-BR")} chargebacks ({brl(summary.chargeback_amount)}).
        </p>
      )}
      <div className="mb-4 mt-3 space-y-3">
        <PremiumSegmented<RadarFilter> value={level} onChange={(v) => { setLevel(v); setPage(1); }} options={pills} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar seller" placeholder="Nome ou e-mail do seller" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>
      </div>

      {q.isError && !q.isFetching ? (
        <ErrorBlock title="Não foi possível carregar o radar." error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculando o radar…</p>
      ) : items.length === 0 ? (
        <div>
          <PremiumEmpty icon={Radar} title={filtersActive ? "Nenhum seller aqui" : "Ainda não há vendas pagas"}
            subtitle={filtersActive ? "Nenhum seller bate com esses filtros." : `Nenhum seller teve venda paga nos últimos ${windowLabel(days)}. O radar começa a preencher com a primeira venda.`} />
          {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
        </div>
      ) : (
        <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <RadarTable rows={items} ctx={ctx} />
          <RadarCards rows={items} ctx={ctx} />
          <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
        </div>
      )}
      {reasonDialog}
    </PremiumPanel>
  );
}

interface Ctx { freezing: string | null; busy: boolean; onFreeze: (s: RadarItem) => void }

const Pill = ({ s }: { s: RadarItem }) => (
  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold", TONE[levelTone(s.level)])}>
    {s.level === "high" && <AlertTriangle className="h-3 w-3" />}{levelLabel(s.level)}
  </span>
);
const Frozen = () => <span className="inline-flex items-center gap-1 rounded-full border border-info/25 bg-info/10 px-2.5 py-0.5 text-[12px] font-semibold text-info"><Snowflake className="h-3 w-3" /> Saldo congelado</span>;
const Seller = ({ s }: { s: RadarItem }) => (
  <>
    <p className="truncate text-[13px] font-semibold text-foreground">{s.full_name || "Sem nome"}</p>
    <p className="truncate text-[12px] text-muted-foreground">{s.email || `Conta ${s.user_id.slice(0, 8)}`}</p>
  </>
);
const FreezeButton = ({ s, ctx }: { s: RadarItem; ctx: Ctx }) => (s.level === "high" && !s.frozen ? (
  <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" disabled={ctx.busy} onClick={() => ctx.onFreeze(s)} aria-label={`Congelar o saldo de ${s.full_name || s.email}`}>
    {ctx.freezing === s.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Snowflake className="h-3.5 w-3.5" />} Congelar saldo
  </Button>
) : null);

function RadarTable({ rows, ctx }: { rows: RadarItem[]; ctx: Ctx }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Seller", "Vendas pagas", "Chargebacks", "Taxa", "Reembolsos", "Situação", ""].map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.user_id} className={cn("border-b border-border/40 align-top last:border-b-0", s.level === "high" && "bg-destructive/[0.04]")}>
              <td className="max-w-[260px] px-4 py-3.5"><Seller s={s} /></td>
              <td className="px-4 py-3.5 text-[13px] tabular-nums">{s.sales.toLocaleString("pt-BR")}</td>
              <td className="px-4 py-3.5 text-[13px] tabular-nums">
                {s.chargebacks.toLocaleString("pt-BR")}
                {s.chargeback_amount > 0 && <span className="block text-[12px] text-muted-foreground">{brl(s.chargeback_amount)}</span>}
              </td>
              <td className="px-4 py-3.5 text-[13px] font-semibold tabular-nums">{s.level === "few" ? <span className="font-normal text-muted-foreground">{pct(s.cb_rate)}</span> : pct(s.cb_rate)}</td>
              <td className="px-4 py-3.5 text-[13px] tabular-nums">{s.refunds.toLocaleString("pt-BR")}<span className="block text-[12px] text-muted-foreground">{pct(s.refund_rate)}</span></td>
              <td className="max-w-[280px] px-4 py-3.5">
                <div className="flex flex-wrap gap-1.5"><Pill s={s} />{s.frozen && <Frozen />}</div>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{levelReason(s)}</p>
              </td>
              <td className="px-4 py-3.5 text-right"><FreezeButton s={s} ctx={ctx} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RadarCards({ rows, ctx }: { rows: RadarItem[]; ctx: Ctx }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((s) => (
        <li key={s.user_id} className={cn("flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4", s.level === "high" && "border-destructive/30 bg-destructive/[0.04]")}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Seller s={s} /></div><div className="flex shrink-0 flex-col items-end gap-1"><Pill s={s} />{s.frozen && <Frozen />}</div></div>
          <p className="text-[12.5px] leading-snug text-muted-foreground">{levelReason(s)}</p>
          <dl className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-[12px]">
            <div><dt className="text-muted-foreground">Vendas pagas</dt><dd className="text-[14px] font-semibold tabular-nums">{s.sales.toLocaleString("pt-BR")}</dd></div>
            <div><dt className="text-muted-foreground">Chargebacks</dt><dd className="text-[14px] font-semibold tabular-nums">{s.chargebacks.toLocaleString("pt-BR")}</dd></div>
            <div><dt className="text-muted-foreground">Reembolsos</dt><dd className="text-[14px] font-semibold tabular-nums">{s.refunds.toLocaleString("pt-BR")}</dd></div>
          </dl>
          {s.level === "high" && !s.frozen && <div className="border-t border-border/40 pt-3"><FreezeButton s={s} ctx={ctx} /></div>}
        </li>
      ))}
    </ul>
  );
}
