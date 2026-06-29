import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw } from "lucide-react";

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

export default function AdminAbuseMetricsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_auth_abuse_stats", { _hours: hours });
    if (!error && data) setStats(data as unknown as Stats);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [hours]);

  const peak = stats?.hourly.reduce((m, h) => Math.max(m, h.count), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
            Métricas de Abuso & Auth
          </h2>
          <p className="text-sm text-muted-foreground">
            Tentativas suspeitas em endpoints públicos e logins — identificadores e IPs estão hash-eados (SHA-256).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[1, 6, 24, 72, 168].map((h) => (
            <Button key={h} size="sm" variant={hours === h ? "default" : "outline"} onClick={() => setHours(h)}>
              {h}h
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat label={`Eventos (${hours}h)`} value={stats?.total ?? 0} />
        <Stat label="Tipos distintos" value={Object.keys(stats?.by_type ?? {}).length} />
        <Stat label="Endpoints atingidos" value={Object.keys(stats?.by_endpoint ?? {}).length} />
        <Stat label="Pico horário" value={peak} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Por tipo de evento</h3>
          <Table rows={Object.entries(stats?.by_type ?? {}).sort((a, b) => b[1] - a[1])} />
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Por endpoint</h3>
          <Table rows={Object.entries(stats?.by_endpoint ?? {}).sort((a, b) => b[1] - a[1])} />
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Top IPs (hash)</h3>
          <Table rows={(stats?.top_ips ?? []).map((r) => [r.ip_hash, r.count])} />
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Top identificadores (hash)</h3>
          <Table rows={(stats?.top_identifiers ?? []).map((r) => [r.identifier_hash, r.count])} />
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-3xl font-mono mt-1">{value}</div>
    </Card>
  );
}

function Table({ rows }: { rows: Array<[string, number]> }) {
  if (!rows.length) return <div className="text-sm text-muted-foreground">Sem dados na janela.</div>;
  return (
    <div className="space-y-1">
      {rows.slice(0, 10).map(([k, v]) => (
        <div key={k} className="flex justify-between text-sm border-b border-border/40 py-1">
          <span className="font-mono truncate max-w-[70%]" title={k}>{k}</span>
          <span className="font-mono tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}
