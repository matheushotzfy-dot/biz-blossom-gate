import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Search, Clock, FileText, Shield, Users } from "lucide-react";
import { AdminPanel, PanelTitle, AdminKpi } from "./AdminOverviewTab";

interface AuditLog {
  id: string; admin_user_id: string; action: string; entity_type: string;
  entity_id: string | null; details: Record<string, unknown>; created_at: string;
}

export default function AdminAuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => { if (data) setLogs(data as AuditLog[]); });
  }, []);

  const filtered = logs.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.action.toLowerCase().includes(s) || l.entity_type.toLowerCase().includes(s) || l.entity_id?.toLowerCase().includes(s);
  });

  const today = logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString());
  const admins = new Set(logs.map(l => l.admin_user_id)).size;
  const entities = new Set(logs.map(l => l.entity_type)).size;

  const actionColors: Record<string, string> = {
    approve: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    reject: "text-red-400 bg-red-500/10 border-red-500/20",
    block: "text-red-400 bg-red-500/10 border-red-500/20",
    update: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    create: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    delete: "text-red-400 bg-red-500/10 border-red-500/20",
    balance: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };
  const getStyle = (action: string) => {
    const key = Object.keys(actionColors).find(k => action.toLowerCase().includes(k));
    return key ? actionColors[key] : "text-white/40 bg-white/[0.04] border-white/[0.06]";
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpi icon={<Activity className="h-5 w-5" />} label="Total Logs" value={String(logs.length)} sub="Registros" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<Clock className="h-5 w-5" />} label="Hoje" value={String(today.length)} sub="Ações hoje" gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<Users className="h-5 w-5" />} label="Admins" value={String(admins)} sub="Ativos" gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" />
        <AdminKpi icon={<Shield className="h-5 w-5" />} label="Entidades" value={String(entities)} sub="Tipos" gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input placeholder="Buscar ação, entidade..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/[0.12]" />
      </div>

      <AdminPanel>
        <PanelTitle color="blue" icon={<Activity className="h-4 w-4" />}>Trilha de Auditoria ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.04]">
              {["Data/Hora", "Ação", "Entidade", "ID Entidade", "Admin ID", "Detalhes"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.slice(0, 200).map(log => (
                <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 text-[11px] text-white/40 flex items-center gap-1.5"><Clock className="h-3 w-3 text-white/20" />{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${getStyle(log.action)}`}>{log.action}</span></td>
                  <td className="p-3 text-xs text-white/50 font-medium">{log.entity_type}</td>
                  <td className="p-3 font-mono text-[10px] text-white/25">{log.entity_id?.slice(0, 8) || "—"}</td>
                  <td className="p-3 font-mono text-[10px] text-white/20">{log.admin_user_id.slice(0, 8)}</td>
                  <td className="p-3 text-[10px] text-white/25 max-w-[250px] truncate">{Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-white/20 text-xs"><FileText className="h-6 w-6 mx-auto mb-2 opacity-20" />Nenhum log</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
