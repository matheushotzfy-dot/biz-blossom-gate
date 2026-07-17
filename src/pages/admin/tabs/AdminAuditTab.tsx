import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity, Search, Clock, FileText, Shield, Users, UserCog,
  ChevronLeft, ChevronRight, Briefcase, User as UserIcon, Download,
} from "lucide-react";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle } from "./AdminOverviewTab";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";
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

export default function AdminAuditTab({ profiles }: Props) {
  const [source, setSource] = useState<Source>("all");
  const [logs, setLogs] = useState<UnifiedLog[]>([]);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ admin: 0, staff: 0, activity: 0, today: 0 });
  const [rolesByUser, setRolesByUser] = useState<Record<string, string>>({});

  useEffect(() => { setPage(0); }, [source]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Only query the sources actually rendered — previously we always pulled
      // 1500 rows even when filtered to a single source. Skipped sources return
      // an empty result to keep the merge logic below unchanged.
      const wantAdmin = source === "all" || source === "admin";
      const wantStaff = source === "all" || source === "staff";
      const wantActivity = source === "all" || source === "activity";
      const empty = Promise.resolve({ data: [] as any[] });
      const [aRes, sRes, lRes] = await Promise.all([
        wantAdmin ? supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500) : empty,
        wantStaff ? supabase.from("staff_audit_log").select("*").order("created_at", { ascending: false }).limit(500) : empty,
        wantActivity ? supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(500) : empty,
      ]);
      if (cancelled) return;

      const merged: UnifiedLog[] = [];
      if (source === "all" || source === "admin") {
        (aRes.data || []).forEach((r) => merged.push({
          id: `a-${r.id}`, source: "admin", actor_id: r.admin_user_id,
          actor_role: "admin", action: r.action, entity_type: r.entity_type,
          entity_id: r.entity_id, details: (r.details as Record<string, unknown>) || {}, created_at: r.created_at,
        }));
      }
      if (source === "all" || source === "staff") {
        (sRes.data || []).forEach((r) => merged.push({
          id: `s-${r.id}`, source: "staff", actor_id: r.staff_user_id,
          actor_role: "staff", action: r.action, entity_type: r.entity_type,
          entity_id: r.entity_id, details: { before: r.before, after: r.after, ...((r.metadata as Record<string, unknown>) || {}) },
          created_at: r.created_at,
        }));
      }
      if (source === "all" || source === "activity") {
        (lRes.data || []).forEach((r) => merged.push({
          id: `l-${r.id}`, source: "activity", actor_id: r.user_id,
          actor_role: "user", action: r.action, entity_type: r.entity_type,
          entity_id: r.entity_id, details: { old: r.old_data, new: r.new_data },
          created_at: r.created_at,
        }));
      }
      merged.sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at));
      setLogs(merged);

      // Resolve roles for all unique actors
      const ids = Array.from(new Set(merged.map(m => m.actor_id).filter(Boolean)));
      if (ids.length > 0) {
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
        setRolesByUser(top);
      }

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayCount = merged.filter(m => new Date(m.created_at) >= todayStart).length;
      setCounts({
        admin: (aRes.data || []).length,
        staff: (sRes.data || []).length,
        activity: (lRes.data || []).length,
        today: todayCount,
      });

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [source]);

  const getActorName = (uid: string) => {
    if (!uid) return "Sistema";
    const p = profiles.find(p => p.user_id === uid);
    return p?.full_name || p?.email || uid.slice(0, 8);
  };
  const getActorRole = (uid: string, fallback: string) => {
    const r = rolesByUser[uid] || fallback;
    return ROLE_LABEL[r] || "—";
  };

  const filtered = useMemo(() => logs.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.action.toLowerCase().includes(s)
      || l.entity_type.toLowerCase().includes(s)
      || l.entity_id?.toLowerCase().includes(s)
      || getActorName(l.actor_id).toLowerCase().includes(s);
  }), [logs, search, profiles, rolesByUser]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Trilha de auditoria"
        title="Auditoria Unificada"
        subtitle="Trilha imutável de ações admin, staff e atividade dos usuários."
        status={{ tone: "info", label: `${counts.today} eventos hoje`, pulse: counts.today > 0 }}
      />

      <FinanceiroKpiGrid cols={4}>
        <FinanceiroKpi label="Admin Audit" value={String(counts.admin)} sub="Ações privilegiadas" icon={Shield} tone="primary" />
        <FinanceiroKpi label="Staff Log" value={String(counts.staff)} sub="Gerentes / Funcionários" icon={Briefcase} tone="info" />
        <FinanceiroKpi label="Atividade" value={String(counts.activity)} sub="Usuários finais" icon={UserIcon} tone="warning" />
        <FinanceiroKpi label="Hoje" value={String(counts.today)} sub="Eventos nas últimas 24h" icon={Clock} tone="success" />
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
          <input placeholder="Buscar ação, entidade, pessoa..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
        </div>
      </div>

      <AdminPanel>
        <div className="flex items-center justify-between">
          <PanelTitle color="blue" icon={<Activity className="h-4 w-4" />}>Trilha unificada ({filtered.length})</PanelTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const headers = ["data_hora","origem","actor_id","actor","papel","acao","entidade","entity_id","detalhes"];
                const rows = filtered.map(l => [
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
              disabled={loading || filtered.length === 0}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-border text-[11px] font-semibold text-foreground/80 hover:bg-muted/40 disabled:opacity-40 transition-colors"
              aria-label="Exportar CSV"
            ><Download className="h-3.5 w-3.5" /> Exportar CSV</button>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-40 transition-colors"
              aria-label="Página anterior"
            ><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-40 transition-colors"
              aria-label="Próxima página"
            ><ChevronRight className="h-4 w-4" /></button>
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
              {paged.map(log => (
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
              {paged.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground text-xs"><FileText className="h-6 w-6 mx-auto mb-2 opacity-20" />{loading ? "Carregando..." : "Nenhum log"}</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
