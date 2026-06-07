import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Search, Clock, FileText, Shield, Users, UserCog, ChevronLeft, ChevronRight } from "lucide-react";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle, AdminKpi } from "./AdminOverviewTab";
import type { Tables } from "@/integrations/supabase/types";

interface AuditLog {
  id: string; admin_user_id: string; action: string; entity_type: string;
  entity_id: string | null; details: Record<string, unknown>; created_at: string;
}

interface Props {
  profiles: Tables<"profiles">[];
}

const PAGE_SIZE = 50;

export default function AdminAuditTab({ profiles }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ today: 0, admins: 0, entities: 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (cancelled) return;
      if (data) setLogs(data as AuditLog[]);
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const [{ count: todayCount }, { data: distinctRows }] = await Promise.all([
        supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
        supabase.from("audit_logs").select("admin_user_id, entity_type").limit(1000).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      const admins = new Set((distinctRows ?? []).map((r) => r.admin_user_id)).size;
      const entities = new Set((distinctRows ?? []).map((r) => r.entity_type)).size;
      setStats({ today: todayCount ?? 0, admins, entities });
    })();
    return () => { cancelled = true; };
  }, []);

  const getAdminName = (adminUserId: string) => {
    const profile = profiles.find(p => p.user_id === adminUserId);
    return profile?.full_name || adminUserId.slice(0, 8);
  };

  const filtered = useMemo(() => logs.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.action.toLowerCase().includes(s) || l.entity_type.toLowerCase().includes(s) || l.entity_id?.toLowerCase().includes(s) || getAdminName(l.admin_user_id).toLowerCase().includes(s);
  }), [logs, search, profiles]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const actionColors: Record<string, string> = {
    approve: "text-primary bg-primary/10 border-primary/20",
    reject: "text-destructive bg-destructive/10 border-destructive/20",
    block: "text-destructive bg-destructive/10 border-destructive/20",
    update: "text-info bg-info/10 border-info/20",
    create: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    delete: "text-destructive bg-destructive/10 border-destructive/20",
    balance: "text-warning bg-warning/10 border-warning/20",
  };
  const getStyle = (action: string) => {
    const key = Object.keys(actionColors).find(k => action.toLowerCase().includes(k));
    return key ? actionColors[key] : "text-muted-foreground bg-muted/30 border-border";
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpi icon={<Activity className="h-5 w-5" />} label="Total Logs" value={String(total)} sub="Registros" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<Clock className="h-5 w-5" />} label="Hoje" value={String(stats.today)} sub="Ações hoje" gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<Users className="h-5 w-5" />} label="Admins" value={String(stats.admins)} sub="Ativos" gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" />
        <AdminKpi icon={<Shield className="h-5 w-5" />} label="Entidades" value={String(stats.entities)} sub="Tipos" gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input placeholder="Buscar nesta página..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
      </div>

      <AdminPanel>
        <div className="flex items-center justify-between">
          <PanelTitle color="blue" icon={<Activity className="h-4 w-4" />}>Trilha de Auditoria ({filtered.length})</PanelTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Data/Hora", "Ação", "Entidade", "ID Entidade", "Funcionário/Admin", "Detalhes"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="p-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />{new Date(log.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${getStyle(log.action)}`}>{log.action}</span></td>
                  <td className="p-3 text-xs text-foreground/70 font-medium">{log.entity_type}</td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">{log.entity_id?.slice(0, 8) || "—"}</td>
                  <td className="p-3">
                    <span className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                      <UserCog className="h-3 w-3 text-primary" />
                      {getAdminName(log.admin_user_id)}
                    </span>
                  </td>
                  <td className="p-3 text-[10px] text-muted-foreground max-w-[250px] truncate">{Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground text-xs"><FileText className="h-6 w-6 mx-auto mb-2 opacity-20" />{loading ? "Carregando..." : "Nenhum log"}</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
