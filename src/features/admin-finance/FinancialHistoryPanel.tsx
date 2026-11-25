import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, History, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AdminPager from "@/components/admin/AdminPager";
import { PremiumEmpty, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { brl } from "./types";
import { SellerSelect } from "./SellerSelect";
import { fmtDateTime } from "./format";
import { brDay, resolveRange } from "./FinancialMetricsPanel";
import {
  EXPORT_CAP, EXPORT_PAGE, PAGE, actionLabel, auditCsv, parseAuditPage, roleLabel, who,
  type AuditGroup, type AuditPage, type AuditRow,
} from "./auditModel";

async function fetchHistory(seller: string, s: string, e: string, group: AuditGroup, limit: number, offset: number): Promise<AuditPage> {
  const { data, error } = await supabase.rpc("get_financial_action_history", {
    _seller: seller || undefined, _from: s, _to: e, _action: group === "all" ? undefined : group, _limit: limit, _offset: offset,
  });
  if (error) throw error;
  return parseAuditPage(data);
}

const Money = ({ v }: { v: number | null }) => <span className="whitespace-nowrap tabular-nums">{v == null ? "—" : brl(v)}</span>;

function Table({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-[12px] border border-border/60 xl:block">
      <table className="w-full border-collapse text-left">
        <thead><tr className="border-b border-border bg-muted/25 text-[12px] font-medium text-muted-foreground">
          {["Data", "Ação", "Seller", "Responsável", "Justificativa", "Valor", "Saldo antes", "Saldo depois"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/40 align-top last:border-b-0 text-[13px]">
              <td className="whitespace-nowrap px-4 py-3.5 text-[12.5px] text-foreground/80">{fmtDateTime(r.created_at)}</td>
              <td className="px-4 py-3.5 font-semibold text-foreground">{actionLabel(r.action)}</td>
              <td className="max-w-[200px] px-4 py-3.5"><p className="truncate">{r.seller_name || r.seller_email || "—"}</p></td>
              <td className="px-4 py-3.5"><p>{who(r)}</p>{roleLabel(r.actor_role) && roleLabel(r.actor_role) !== who(r) && <p className="text-[12px] text-muted-foreground">{roleLabel(r.actor_role)}</p>}</td>
              <td className="max-w-[280px] px-4 py-3.5 text-[12.5px] text-muted-foreground">{r.reason || "—"}</td>
              <td className="px-4 py-3.5 font-semibold"><Money v={r.amount} /></td>
              <td className="px-4 py-3.5 text-muted-foreground"><Money v={r.balance_before} /></td>
              <td className="px-4 py-3.5 text-muted-foreground"><Money v={r.balance_after} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cards({ rows }: { rows: AuditRow[] }) {
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))] xl:hidden">
      {rows.map((r) => (
        <li key={r.id} className="min-w-0 space-y-2 rounded-[12px] border border-border/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13.5px] font-semibold text-foreground">{actionLabel(r.action)}</p>
            <p className="whitespace-nowrap text-[14px] font-bold"><Money v={r.amount} /></p>
          </div>
          <p className="text-[12px] text-muted-foreground">{fmtDateTime(r.created_at)}</p>
          <p className="truncate text-[13px]">{r.seller_name || r.seller_email || "—"}</p>
          <p className="text-[12.5px] text-muted-foreground">Por {who(r)}{roleLabel(r.actor_role) && roleLabel(r.actor_role) !== who(r) ? ` (${roleLabel(r.actor_role)})` : ""}</p>
          {r.reason && <p className="text-[12.5px] text-foreground/80">{r.reason}</p>}
          <p className="text-[12px] text-muted-foreground">Saldo: <Money v={r.balance_before} /> → <Money v={r.balance_after} /></p>
        </li>
      ))}
    </ul>
  );
}

export function FinancialHistoryPanel({ profiles }: { profiles: Tables<"profiles">[] }) {
  const today = useMemo(() => brDay(new Date()), []);
  const [seller, setSeller] = useState("");
  const [from, setFrom] = useState(() => brDay(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(today);
  const [group, setGroup] = useState<AuditGroup>("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => resolveRange(from, to), [from, to]);
  const q = useQuery({
    queryKey: ["financial-history", seller, range.s, range.e, group, page],
    enabled: !range.error,
    queryFn: () => fetchHistory(seller, range.s, range.e, group, PAGE, (page - 1) * PAGE),
    placeholderData: keepPreviousData,
  });
  const rows = q.data?.rows ?? [];
  const summary = q.data?.summary;
  const total = q.data?.total ?? 0;
  const set = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  const withCount = (label: string, n?: number) => (n === undefined ? label : `${label} · ${n.toLocaleString("pt-BR")}`);
  const pills: { value: AuditGroup; label: string }[] = [
    { value: "all", label: withCount("Tudo", summary?.total) }, { value: "ajuste", label: withCount("Ajustes de saldo", summary?.ajuste) },
    { value: "reembolso", label: withCount("Reembolsos", summary?.reembolso) }, { value: "chargeback", label: withCount("Chargebacks", summary?.chargeback) },
    { value: "disputa", label: withCount("Disputas", summary?.disputa) },
  ];

  const exportCsv = async () => {
    if (range.error || total === 0) { toast.error("Não há ações para exportar."); return; }
    setExporting(true);
    try {
      const count = Math.min(total, EXPORT_CAP);
      const all: AuditRow[] = [];
      for (let p = 0; p * EXPORT_PAGE < count; p++) {
        const res = await fetchHistory(seller, range.s, range.e, group, EXPORT_PAGE, p * EXPORT_PAGE);
        all.push(...res.rows);
        if (res.rows.length === 0) break;
      }
      const url = URL.createObjectURL(new Blob([auditCsv(all.slice(0, count), fmtDateTime)], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url; a.download = `auditoria-financeira-${from}-a-${to}.csv`; a.click();
      URL.revokeObjectURL(url);
      const n = Math.min(all.length, count);
      if (total > EXPORT_CAP) toast.warning(`${n.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} ações exportadas (limite de ${EXPORT_CAP.toLocaleString("pt-BR")}). Estreite o período para o resto.`);
      else toast.success(`${n.toLocaleString("pt-BR")} ${n === 1 ? "ação exportada" : "ações exportadas"}.`);
    } catch (e) {
      toast.error("Não foi possível exportar. Nada foi baixado.", { description: friendlyError(e, "Tente de novo em instantes.") });
    } finally {
      setExporting(false);
    }
  };

  return (
    <PremiumPanel eyebrow="Registro" title="Histórico de ações financeiras" icon={History}
      action={<Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void exportCsv()} disabled={exporting || !!range.error || q.isError}>
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {exporting ? "Exportando…" : "Exportar CSV"}
      </Button>}>
      <div className="mb-4 space-y-3">
        <p className="text-[12.5px] text-muted-foreground">Ajustes de saldo, reembolsos, chargebacks e disputas, com quem fez, quando, o motivo e o saldo antes e depois.</p>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))]">
          <div className="space-y-1"><label htmlFor="fh-seller" className="text-[12.5px] font-medium text-muted-foreground">Seller</label><div id="fh-seller"><SellerSelect profiles={profiles} value={seller} onChange={set(setSeller)} allowAll /></div></div>
          <div className="space-y-1"><label htmlFor="fh-from" className="text-[12.5px] font-medium text-muted-foreground">De</label><Input id="fh-from" type="date" max={to || today} value={from} onChange={(e) => set(setFrom)(e.target.value)} /></div>
          <div className="space-y-1"><label htmlFor="fh-to" className="text-[12.5px] font-medium text-muted-foreground">Até</label><Input id="fh-to" type="date" min={from} max={today} value={to} onChange={(e) => set(setTo)(e.target.value)} /></div>
        </div>
        {range.error && <p role="alert" className="text-[12.5px] font-medium text-destructive">{range.error}</p>}
        <PremiumSegmented<AuditGroup> value={group} onChange={set(setGroup)} options={pills} />
        <p className="text-[12px] text-muted-foreground">As contagens consideram o seller e o período escolhidos. Mais recentes primeiro. Datas no horário de Brasília.</p>
      </div>

      {range.error ? null : q.isError && !q.isFetching ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-[13px]">
          <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> Não foi possível carregar o histórico.</p>
          <p className="text-muted-foreground">{friendlyError(q.error, "Tente de novo em instantes.")}</p>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void q.refetch()}><RefreshCw className="h-3.5 w-3.5" /> Tentar de novo</Button>
        </div>
      ) : q.isPending ? (
        <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…</p>
      ) : rows.length === 0 ? (
        <PremiumEmpty icon={History} title="Nenhuma ação neste filtro" subtitle="Nenhum ajuste, reembolso, chargeback ou disputa registrado nesse período." />
      ) : (
        <div aria-busy={q.isPlaceholderData} className={cn(q.isPlaceholderData && "opacity-60 transition-opacity")}>
          <Table rows={rows} />
          <Cards rows={rows} />
          <AdminPager page={page} pageSize={PAGE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
        </div>
      )}
    </PremiumPanel>
  );
}
