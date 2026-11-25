import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileWarning, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { fmtDateTime } from "@/features/admin-finance/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { PremiumEmpty, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { ErrorBlock } from "./BlacklistPanel";
import { PAGE_SIZE, parseTrailPage, trailMatch, trailTypeLabel, useDebouncedValue, type TrailItem, type TrailType } from "./antifraudModel";

export function TrailPanel() {
  const [type, setType] = useState<TrailType>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ["admin-fraud-trail", debounced, type, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_fraud_trail" as never, { _search: debounced || null, _type: type, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseTrailPage(data);
    },
    placeholderData: keepPreviousData,
  });
  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const summary = q.data?.summary;

  const filtersActive = type !== "all" || !!debounced;
  const clear = () => { setType("all"); setSearch(""); setPage(1); };
  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} · ${n.toLocaleString("pt-BR")}`);
  const pills = useMemo<{ value: TrailType; label: string }[]>(() => [
    { value: "all", label: withCount("Todos", summary?.all) },
    { value: "blacklist", label: withCount("Blacklist", summary?.blacklist) },
    { value: "velocity", label: withCount("Velocidade", summary?.velocity) },
    ...(summary && summary.manual > 0 ? [{ value: "manual" as const, label: withCount("Manuais", summary.manual) }] : []),
  ], [summary]);

  return (
    <PremiumPanel title="Trilha de bloqueios" icon={FileWarning}>
      <p className="mb-4 max-w-3xl text-[13px] text-muted-foreground">
        Cada compra que a blacklist ou uma regra de velocidade barrou ou sinalizou, da mais recente para a mais antiga. O documento aparece mascarado.
      </p>
      <div className="mb-4 space-y-3">
        <PremiumSegmented<TrailType> value={type} onChange={(v) => { setType(v); setPage(1); }} options={pills} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar na trilha" placeholder="E-mail, IP, motivo ou seller" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>
      </div>

      {q.isError && !q.isFetching ? (
        <ErrorBlock title="Não foi possível carregar a trilha." error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isPending ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando a trilha…</p>
      ) : items.length === 0 ? (
        <div>
          <PremiumEmpty icon={FileWarning} title={filtersActive ? "Nada por aqui" : "Nenhum bloqueio registrado"}
            subtitle={filtersActive ? "Nenhum registro bate com esses filtros." : "Quando a cobrança estiver ativa, cada compra barrada pela blacklist ou por uma regra aparece aqui."} />
          {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
        </div>
      ) : (
        <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <TrailTable rows={items} />
          <TrailCards rows={items} />
          <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
        </div>
      )}
    </PremiumPanel>
  );
}

const Outcome = ({ t }: { t: TrailItem }) => (
  <span className={cn("inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-semibold", t.outcome === "blocked" ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-warning/25 bg-warning/10 text-warning")}>
    {t.outcome === "blocked" ? "Barrada" : "Só registrada"}
  </span>
);
const Buyer = ({ t }: { t: TrailItem }) => (
  <>
    <p className="truncate text-[13px] font-semibold text-foreground">{t.customer_email || "E-mail não informado"}</p>
    <p className="truncate font-mono text-[12px] text-muted-foreground">{[t.customer_document, t.customer_ip].filter(Boolean).join(" · ") || "Sem documento nem IP"}</p>
  </>
);
const Why = ({ t }: { t: TrailItem }) => (
  <>
    <p className="text-[13px] leading-snug text-foreground/85">{t.block_reason}</p>
    <p className="mt-0.5 [overflow-wrap:anywhere] text-[12px] text-muted-foreground">{trailTypeLabel(t.block_type)} · {trailMatch(t)}</p>
  </>
);
const Where = ({ t }: { t: TrailItem }) => <p className="text-[12px] text-muted-foreground">{[t.seller_name ? `Seller: ${t.seller_name}` : "", t.product_name ? `Produto: ${t.product_name}` : ""].filter(Boolean).join(" · ") || "Seller não identificado"}</p>;

function TrailTable({ rows }: { rows: TrailItem[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Quando", "Comprador", "O que barrou", "Resultado", "Seller e produto"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-border/40 align-top last:border-b-0">
              <td className="whitespace-nowrap px-4 py-3.5 text-[12.5px] text-muted-foreground">{fmtDateTime(t.created_at)}</td>
              <td className="max-w-[260px] px-4 py-3.5"><Buyer t={t} /></td>
              <td className="max-w-[340px] px-4 py-3.5"><Why t={t} /></td>
              <td className="px-4 py-3.5"><Outcome t={t} /></td>
              <td className="max-w-[240px] px-4 py-3.5"><Where t={t} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrailCards({ rows }: { rows: TrailItem[] }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((t) => (
        <li key={t.id} className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border/60 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Buyer t={t} /></div><Outcome t={t} /></div>
          <Why t={t} />
          <div className="flex flex-col gap-1 border-t border-border/40 pt-3"><Where t={t} /><p className="text-[12px] text-muted-foreground">{fmtDateTime(t.created_at)}</p></div>
        </li>
      ))}
    </ul>
  );
}
