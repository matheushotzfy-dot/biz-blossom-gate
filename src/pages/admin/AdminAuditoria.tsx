import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Shield, Search, FileText, Clock, User, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export default function AdminAuditoria() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => {
        if (!data) { navigate("/admin-matheus"); return; }
        loadLogs();
      });
  }, [user]);

  const loadLogs = async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setLogs(data as AuditLog[]);
    setLoading(false);
  };

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.action.toLowerCase().includes(s) || l.entity_type.toLowerCase().includes(s) || (l.entity_id?.toLowerCase().includes(s));
  });

  const actionColor: Record<string, string> = {
    approve: "text-emerald-400 bg-emerald-500/10",
    reject: "text-red-400 bg-red-500/10",
    block: "text-red-400 bg-red-500/10",
    update: "text-blue-400 bg-blue-500/10",
    create: "text-violet-400 bg-violet-500/10",
    delete: "text-red-400 bg-red-500/10",
  };

  const getActionStyle = (action: string) => {
    const key = Object.keys(actionColor).find(k => action.toLowerCase().includes(k));
    return key ? actionColor[key] : "text-foreground/70 bg-foreground/5";
  };

  if (loading) return (
    <div className="min-h-screen bg-[hsl(220,25%,4%)] flex items-center justify-center">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[hsl(220,25%,4%)] text-foreground">
      <header className="h-16 border-b border-border/30 flex items-center justify-between px-6 bg-[hsl(220,25%,5%)]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">Auditoria</h1>
            <p className="text-[10px] text-foreground/50">Trilha de auditoria completa</p>
          </div>
        </div>
        <a href="/admin-matheus/dashboard" className="text-xs text-foreground/60 hover:text-foreground transition-colors">
          ← Voltar ao Dashboard
        </a>
      </header>

      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[hsl(220,25%,7%)] rounded-2xl border border-border/30 p-5">
            <p className="text-[10px] uppercase tracking-wider text-foreground/50 font-medium">Total de Logs</p>
            <p className="text-xl font-bold text-foreground mt-1">{logs.length}</p>
          </div>
          <div className="bg-[hsl(220,25%,7%)] rounded-2xl border border-border/30 p-5">
            <p className="text-[10px] uppercase tracking-wider text-foreground/50 font-medium">Hoje</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length}
            </p>
          </div>
          <div className="bg-[hsl(220,25%,7%)] rounded-2xl border border-border/30 p-5">
            <p className="text-[10px] uppercase tracking-wider text-foreground/50 font-medium">Admins Ativos</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {new Set(logs.map(l => l.admin_user_id)).size}
            </p>
          </div>
          <div className="bg-[hsl(220,25%,7%)] rounded-2xl border border-border/30 p-5">
            <p className="text-[10px] uppercase tracking-wider text-foreground/50 font-medium">Entidades</p>
            <p className="text-xl font-bold text-foreground mt-1">
              {new Set(logs.map(l => l.entity_type)).size}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input
            placeholder="Buscar por ação, entidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[hsl(220,25%,7%)] border-border/30 text-foreground"
          />
        </div>

        {/* Logs Table */}
        <div className="bg-[hsl(220,25%,7%)] rounded-2xl border border-border/30">
          <div className="p-5 border-b border-border/30 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Histórico de Ações</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 text-foreground/50 text-xs">
                  <th className="text-left p-4 font-medium">Data</th>
                  <th className="text-left p-4 font-medium">Ação</th>
                  <th className="text-left p-4 font-medium">Entidade</th>
                  <th className="text-left p-4 font-medium">ID</th>
                  <th className="text-left p-4 font-medium">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-foreground/40 text-xs">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      Nenhum log de auditoria encontrado
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => (
                    <tr key={log.id} className="border-b border-border/20 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-xs text-foreground/60">
                          <Clock className="h-3 w-3" />
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${getActionStyle(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-foreground/70 font-medium">{log.entity_type}</td>
                      <td className="p-4 font-mono text-xs text-foreground/50">{log.entity_id?.slice(0, 8) || "—"}</td>
                      <td className="p-4 text-xs text-foreground/50 max-w-[200px] truncate">
                        {Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
