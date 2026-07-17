import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, RefreshCw, Activity, Network, Fingerprint, Ban } from "lucide-react";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import {
  PremiumPanel, PremiumMetric, PremiumMetricGrid, PremiumSegmented, PremiumEmpty, premiumTable,
} from "./AdminPremium";
import { cn } from "@/lib/utils";

type Stats = {
  total: number;
  by_type: Record<string, number>;
  by_endpoint: Record<string, number>;
  top_ips: Array<{ ip_hash: string; count: number }>;
  top_identifiers: Array<{ identifier_hash: string; count: number }>;
  hourly: Array<{ bucket: string; count: number }>;
  window_hours: number;
  generated_at: string;
};

type ActiveBlock = {
  id: string;
  ip_hash: string;
  endpoint: string;
  reason: string;
  blocked_until: string;
  created_at: string;
};

type WindowH = "1" | "6" | "24" | "72" | "168";
const WINDOW_OPTS: { value: WindowH; label: string }[] = [
  { value: "1", label: "1h" }, { value: "6", label: "6h" },
  { value: "24", label: "24h" }, { value: "72", label: "72h" }, { value: "168", label: "7d" },
];

export default function AdminAbuseMetricsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [blocks, setBlocks] = useState<ActiveBlock[]>([]);
  const [win, setWin] = useState<WindowH>("24");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [statsRes, blocksRes] = await Promise.all([
      supabase.rpc("get_auth_abuse_stats", { _hours: Number(win) }),
      supabase
        .from("abuse_blocks")
        .select("id, ip_hash, endpoint, reason, blocked_until, created_at")
        .gt("blocked_until", new Date().toISOString())
        .order("blocked_until", { ascending: false })
        .limit(50),
    ]);
    if (!statsRes.error && statsRes.data) setStats(statsRes.data as unknown as Stats);
    if (!blocksRes.error && blocksRes.data) setBlocks(blocksRes.data as ActiveBlock[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [win]);

  const activeBlocksCount = blocks.length;
  const typesCount = Object.keys(stats?.by_type ?? {}).length;
  const endpointsCount = Object.keys(stats?.by_endpoint ?? {}).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Segurança · Auth"
        title="Métricas de Abuso"
        subtitle="Tentativas suspeitas em endpoints públicos · IPs e identificadores hash-eados (SHA-256)"
        status={{ tone: activeBlocksCount > 0 ? "warning" : "success", label: activeBlocksCount > 0 ? `${activeBlocksCount} IPs bloqueados` : "Sem bloqueios ativos", pulse: activeBlocksCount > 0 }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PremiumSegmented<WindowH> value={win} onChange={setWin} options={WINDOW_OPTS} />
        <button
          onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-foreground/80 transition-colors hover:bg-muted/40 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Activity} label={`Eventos (${win}h)`} value={String(stats?.total ?? 0)} sub="tentativas registradas" tone="primary" />
        <PremiumMetric icon={Fingerprint} label="Tipos distintos" value={String(typesCount)} sub="categorias de evento" tone="info" />
        <PremiumMetric icon={Network} label="Endpoints atingidos" value={String(endpointsCount)} sub="rotas com abuso" tone="warning" />
        <PremiumMetric icon={Ban} label="Bloqueios ativos" value={String(activeBlocksCount)} sub="IPs em quarentena" tone={activeBlocksCount > 0 ? "destructive" : "neutral"} />
      </PremiumMetricGrid>

      <PremiumPanel icon={ShieldAlert} eyebrow="Quarentena" title={`Bloqueios ativos (${activeBlocksCount})`}>
        {activeBlocksCount === 0 ? (
          <PremiumEmpty icon={ShieldAlert} title="Nenhum IP bloqueado" subtitle="Todos os endpoints estão respondendo normalmente" />
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  <th className={premiumTable.th}>IP (hash)</th>
                  <th className={premiumTable.th}>Endpoint</th>
                  <th className={premiumTable.th}>Motivo</th>
                  <th className={cn(premiumTable.th, "text-right")}>Expira em</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => {
                  const expiresMin = Math.max(0, Math.round((new Date(b.blocked_until).getTime() - Date.now()) / 60000));
                  return (
                    <tr key={b.id} className={premiumTable.row}>
                      <td className={cn(premiumTable.td, "font-mono text-[11px] text-foreground/80")} title={b.ip_hash}>{b.ip_hash.slice(0, 14)}…</td>
                      <td className={cn(premiumTable.td, "text-[11px] font-bold text-foreground")}>{b.endpoint}</td>
                      <td className={cn(premiumTable.td, "text-[11px] font-bold text-warning")}>{b.reason}</td>
                      <td className={cn(premiumTable.td, "text-right text-[11px] font-black tabular-nums text-foreground")}>{expiresMin} min</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumPanel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PremiumPanel icon={Activity} eyebrow="Distribuição" title="Por tipo de evento">
          <BreakdownTable rows={Object.entries(stats?.by_type ?? {}).sort((a, b) => b[1] - a[1])} />
        </PremiumPanel>
        <PremiumPanel icon={Network} eyebrow="Distribuição" title="Por endpoint">
          <BreakdownTable rows={Object.entries(stats?.by_endpoint ?? {}).sort((a, b) => b[1] - a[1])} />
        </PremiumPanel>
        <PremiumPanel icon={Fingerprint} eyebrow="Ranking" title="Top IPs (hash)">
          <BreakdownTable rows={(stats?.top_ips ?? []).map((r) => [r.ip_hash, r.count])} mono />
        </PremiumPanel>
        <PremiumPanel icon={Fingerprint} eyebrow="Ranking" title="Top identificadores (hash)">
          <BreakdownTable rows={(stats?.top_identifiers ?? []).map((r) => [r.identifier_hash, r.count])} mono />
        </PremiumPanel>
      </div>
    </div>
  );
}

function BreakdownTable({ rows, mono }: { rows: Array<[string, number]>; mono?: boolean }) {
  if (!rows.length) {
    return <p className="py-6 text-center text-[11px] font-bold text-muted-foreground/70">Sem dados na janela.</p>;
  }
  const max = Math.max(...rows.map((r) => r[1]));
  return (
    <div className="space-y-1.5">
      {rows.slice(0, 10).map(([k, v]) => (
        <div key={k} className="group relative flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 transition-colors hover:border-primary/25">
          <div className="pointer-events-none absolute inset-y-0 left-0 rounded-l-lg bg-primary/10" style={{ width: `${(v / max) * 100}%` }} />
          <span className={cn("relative truncate text-[11px] font-bold text-foreground", mono && "font-mono")} title={k}>{k}</span>
          <span className="relative shrink-0 text-[11px] font-black tabular-nums text-primary">{v}</span>
        </div>
      ))}
    </div>
  );
}
