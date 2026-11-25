import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity, Search, Clock, FileText, Shield, Users, UserCog,
  ChevronLeft, ChevronRight, Briefcase, User as UserIcon, Download,
} from "lucide-react";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle } from "./AdminOverviewTab";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";
import AdminPager from "@/components/admin/AdminPager";
import type { Tables } from "@/integrations/supabase/types";

type Source = "all" | "admin" | "staff" | "activity";

interface UnifiedLog {
  id: string;
  source: "admin" | "staff" | "activity";
  actor_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface Props {
  profiles: Tables<"profiles">[];
}

const PAGE_SIZE = 50;
const ROLE_LABEL: Record<string, string> = {
  admin: "ADMIN", manager: "GERENTE", employee: "FUNCIONÁRIO", user: "USUÁRIO", staff: "STAFF",
};

const sanitizeSearch = (v: string) => v.replace(/[%,()*\\]/g, " ").trim();

export default function AdminAuditTab({ profiles }: Props) {
  const [source, setSource] = useState<Source>("all");
  const [logs, setLogs] = useState<UnifiedLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [counts, setCounts] = useState({ admin: 0, staff: 0, activity: 0, today: 0 });
  const [rolesByUser, setRolesByUser] = useState<Record<string, string>>({});

  useEffect(() => { setPage(1); }, [source, search]);

  // KPI counts — independent head:true queries, not tied to the current page/filter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const [adminRes, staffRes, activityRes, adminTodayRes, staffTodayRes, activityTodayRes] = await Promise.all([
        supabase.from("audit_logs").select("id", { count: "estimated", head: true }),
        supabase.from("staff_audit_log").select("id", { count: "estimated", head: true }),
        supabase.from("activity_logs").select("id", { count: "estimated", head: true }),
        supabase.from("audit_logs").select("id", { count: "estimated", head: true }).gte("created_at", todayStart.toISOString()),
        supabase.from("staff_audit_log").select("id", { count: "estimated", head: true }).gte("created_at", todayStart.toISOString()),
        supabase.from("activity_logs").select("id", { count: "estimated", head: true }).gte("created_at", todayStart.toISOString()),
      ]);
      if (cancelled) return;
      setCounts({
        admin: adminRes.count || 0,
        staff: staffRes.count || 0,
        activity: activityRes.count || 0,
        today: (adminTodayRes.count || 0) + (staffTodayRes.count || 0) + (activityTodayRes.count || 0),
      });
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      const q = sanitizeSearch(search);

      if (source !== "all") {
        // True server-side pagination for a single source table.
        const table = source === "admin" ? "audit_logs" : source === "staff" ? "staff_audit_log" : "activity_logs";
        const from = (page - 1) * PAGE_SIZE;
        let query = supabase.from(table).select("*", { count: "estimated" }).order("created_at", { ascending: false }).order("id", { ascending: false });
        if (q) query = query.or(`action.ilike.%${q}%,entity_type.ilike.%${q}%,entity_id.ilike.%${q}%`);
        const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
        if (cancelled) return;
        if (error) {
          setLoadError(error.message || "Erro ao carregar trilha de auditoria");
          setLoading(false);
          return;
        }
        const merged: UnifiedLog[] = (data || []).map((row) => {
          if (table === "audit_logs") {
            const r = row as Tables<"audit_logs">;
            return { id: `a-${r.id}`, source: "admin" as const, actor_id: r.admin_user_id, actor_role: "admin", action: r.action, entity_type: r.entity_type, entity_id: r.entity_id, details: (r.details as Record<string, unknown>) || {}, created_at: r.created_at };
          }
          if (table === "staff_audit_log") {
            const r = row as Tables<"staff_audit_log">;
            return { id: `s-${r.id}`, source: "staff" as const, actor_id: r.staff_user_id, actor_role: "staff", action: r.action, entity_type: r.entity_type, entity_id: r.entity_id, details: { before: r.before, after: r.after, ...((r.metadata as Record<string, unknown>) || {}) }, created_at: r.created_at };
          }
          const r = row as Tables<"activity_logs">;
          return { id: `l-${r.id}`, source: "activity" as const, actor_id: r.user_id, actor_role: "user", action: r.action, entity_type: r.entity_type, entity_id: r.entity_id, details: { old: r.old_data, new: r.new_data }, created_at: r.created_at };
        });
        setLogs(merged);
        setTotalCount(count || 0);
        await resolveRoles(merged);
        setLoading(false);
        return;
      }

      // "all" sources: merge is required across three distinct tables, so we
      // pull a bounded recent window from each, filter/sort in memory, and
      // paginate the merged result client-side with AdminPager.
      const [aRes, sRes, lRes] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("staff_audit_log").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(1000),
      ]);
      if (cancelled) return;

      const firstError = aRes.error || sRes.error || lRes.error;
      if (firstError) {
        setLoadError(firstError.message || "Erro ao carregar trilha de auditoria");
        setLoading(false);
        return;
      }

      const merged: UnifiedLog[] = [];
      (aRes.data || []).forEach((r) => merged.push({
        id: `a-${r.id}`, source: "admin", actor_id: r.admin_user_id,
        actor_role: "admin", action: r.action, entity_type: r.entity_type,
        entity_id: r.entity_id, details: (r.details as Record<string, unknown>) || {}, created_at: r.created_at,
      }));
      (sRes.data || []).forEach((r) => merged.push({
        id: `s-${r.id}`, source: "staff", actor_id: r.staff_user_id,
        actor_role: "staff", action: r.action, entity_type: r.entity_type,
        entity_id: r.entity_id, details: { before: r.before, after: r.after, ...((r.metadata as Record<string, unknown>) || {}) },
        created_at: r.created_at,
      }));
      (lRes.data || []).forEach((r) => merged.push({
        id: `l-${r.id}`, source: "activity", actor_id: r.user_id,
        actor_role: "user", action: r.action, entity_type: r.entity_type,
        entity_id: r.entity_id, details: { old: r.old_data, new: r.new_data },
        created_at: r.created_at,
      }));
      merged.sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at));

      const filtered = q ? merged.filter(l => {
        const s = q.toLowerCase();
        return l.action.toLowerCase().includes(s)
          || l.entity_type.toLowerCase().includes(s)
          || (l.entity_id || "").toLowerCase().includes(s);
      }) : merged;

      setTotalCount(filtered.length);
      const from = (page - 1) * PAGE_SIZE;
      const pageLogs = filtered.slice(from, from + PAGE_SIZE);
      setLogs(pageLogs);
      await resolveRoles(pageLogs);
      setLoading(false);
    })();

    async function resolveRoles(rows: UnifiedLog[]) {
      const ids = Array.from(new Set(rows.map(m => m.actor_id).filter(Boolean)));
      if (ids.length === 0) return;
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
      const map: Record<string, string[]> = {};
      (rolesData || []).forEach((r) => { (map[r.user_id] ||= []).push(r.role); });
      const top: Record<string, string> = {};
      Object.entries(map).forEach(([uid, list]) => {
        top[uid] = list.includes("admin") ? "admin"
          : list.includes("manager") ? "manager"
          : list.includes("employee") ? "employee"
          : "user";
      });
      setRolesByUser(prev => ({ ...prev, ...top }));
    }

    return () => { cancelled = true; };
  }, [source, search, page, reloadTick]);

  const getActorName = (uid: string) => {
    if (!uid) return "Sistema";
    const p = profiles.find(p => p.user_id === uid);
    return p?.full_name || p?.email || uid.slice(0, 8);
  };
  const getActorRole = (uid: string, fallback: string) => {
    const r = rolesByUser[uid] || fallback;
    return ROLE_LABEL[r] || "—";
  };

  const actionColors: Record<string, string> = {
    approve: "text-primary bg-primary/10 border-primary/20",
    reject: "text-destructive bg-destructive/10 border-destructive/20",
    block: "text-destructive bg-destructive/10 border-destructive/20",
    update: "text-info bg-info/10 border-info/20",
    create: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    delete: "text-destructive bg-destructive/10 border-destructive/20",
    balance: "text-warning bg-warning/10 border-warning/20",
    login: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  };
  const getStyle = (action: string) => {
    const key = Object.keys(actionColors).find(k => action.toLowerCase().includes(k));
    return key ? actionColors[key] : "text-muted-foreground bg-muted/30 border-border";
  };

  const sourceBadge: Record<string, string> = {
    admin: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    staff: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    activity: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  const reload = () => setReloadTick(t => t + 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>Erro ao carregar auditoria: {loadError}</span>
          <button onClick={reload} className="h-8 shrink-0 rounded-lg border border-destructive/40 px-3 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors">
            Tentar de novo
          </button>
        </div>
      )}
      <FinanceiroHero
        eyebrow="Trilha de auditoria"
        title="Auditoria Unificada"
        subtitle="Trilha imutável de ações admin, staff e atividade dos usuários."
        status={{ tone: "info", label: `${counts.today} eventos hoje`, pulse: counts.today > 0 }}
      />

      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi label="Admin Audit" value={`≈${counts.admin}`} sub="Ações privilegiadas · total estimado" icon={Shield} tone="primary" />
        <FinanceiroKpi label="Staff Log" value={`≈${counts.staff}`} sub="Equipe · total estimado" icon={Briefcase} tone="info" />
        <FinanceiroKpi label="Atividade" value={`≈${counts.activity}`} sub="Usuários · total estimado" icon={UserIcon} tone="warning" />
        <FinanceiroKpi label="Hoje" value={`≈${counts.today}`} sub="Desde meia-noite · total estimado" icon={Clock} tone="success" />
      </FinanceiroKpiGrid>


      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-muted/30 border border-border rounded-xl p-1">
          {([
            { v: "all", l: "Todos" },
            { v: "admin", l: "Admin" },
            { v: "staff", l: "Staff/Gerente" },
            { v: "activity", l: "Atividade" },
          ] as const).map(o => (
            <button key={o.v} onClick={() => setSource(o.v as Source)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${source === o.v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {o.l}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar ação, entidade, ID..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
        </div>
      </div>

      <AdminPanel>
        <div className="flex items-center justify-between">
          <PanelTitle color="blue" icon={<Activity className="h-4 w-4" />}>Trilha unificada ({totalCount})</PanelTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const headers = ["data_hora","origem","actor_id","actor","papel","acao","entidade","entity_id","detalhes"];
                const rows = logs.map(l => [
                  new Date(l.created_at).toISOString(),
                  l.source,
                  l.actor_id || "",
                  getActorName(l.actor_id),
                  getActorRole(l.actor_id, l.actor_role),
                  l.action,
                  l.entity_type,
                  l.entity_id || "",
                  Object.keys(l.details).length ? JSON.stringify(l.details) : "",
                ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
                const csv = [headers.join(","), ...rows].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`; a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={loading || logs.length === 0}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-border text-[11px] font-semibold text-foreground/80 hover:bg-muted/40 disabled:opacity-40 transition-colors"
              aria-label="Exportar CSV (página atual)"
            ><Download className="h-3.5 w-3.5" /> Exportar CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Data/Hora", "Origem", "Quem", "Papel", "Ação", "Entidade", "ID", "Detalhes"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="p-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />{new Date(log.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${sourceBadge[log.source]}`}>
                      {log.source.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                      <UserCog className="h-3 w-3 text-primary" />
                      {getActorName(log.actor_id)}
                    </span>
                  </td>
                  <td className="p-3 text-[10px] font-bold text-foreground/70">{getActorRole(log.actor_id, log.actor_role)}</td>
                  <td className="p-3"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${getStyle(log.action)}`}>{log.action}</span></td>
                  <td className="p-3 text-xs text-foreground/70 font-medium">{log.entity_type}</td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">{log.entity_id?.slice(0, 8) || "—"}</td>
                  <td className="p-3 text-[10px] text-muted-foreground max-w-[260px] truncate">
                    {Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground text-xs"><FileText className="h-6 w-6 mx-auto mb-2 opacity-20" />{loading ? "Carregando..." : "Nenhum log"}</td></tr>}
            </tbody>
          </table>
        </div>
        <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} loading={loading} />
      </AdminPanel>
    </div>
  );
}
