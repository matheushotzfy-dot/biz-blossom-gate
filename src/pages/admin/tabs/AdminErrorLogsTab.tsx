import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Search, CheckCircle2, Clock, Bug, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPanel, PanelTitle, AdminKpi } from "./AdminOverviewTab";
import type { Tables } from "@/integrations/supabase/types";

interface ErrorLog {
  id: string;
  error_type: string;
  message: string;
  stack_trace: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
}

interface Props {
  profiles: Tables<"profiles">[];
}

export default function AdminErrorLogsTab({ profiles }: Props) {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [search, setSearch] = useState("");
  const [filterResolved, setFilterResolved] = useState<"all" | "open" | "resolved">("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("error_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (data) setErrors(data as ErrorLog[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleResolved = async (id: string, resolved: boolean) => {
    await supabase.from("error_logs").update({ resolved } as any).eq("id", id);
    load();
  };

  const getSellerName = (userId: string | null) => {
    if (!userId) return "Sistema";
    return profiles.find(p => p.user_id === userId)?.full_name || userId.slice(0, 8);
  };

  const filtered = errors.filter(e => {
    if (filterResolved === "open" && e.resolved) return false;
    if (filterResolved === "resolved" && !e.resolved) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return e.message.toLowerCase().includes(s) || e.error_type.toLowerCase().includes(s) || getSellerName(e.user_id).toLowerCase().includes(s);
  });

  const openCount = errors.filter(e => !e.resolved).length;
  const resolvedCount = errors.filter(e => e.resolved).length;
  const todayCount = errors.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString()).length;
  const uniqueUsers = new Set(errors.filter(e => e.user_id).map(e => e.user_id)).size;

  const typeColors: Record<string, string> = {
    payment: "text-red-400 bg-red-500/10 border-red-500/20",
    webhook: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    auth: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    withdrawal: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    general: "text-muted-foreground bg-muted/30 border-border",
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpi icon={<Bug className="h-5 w-5" />} label="Total Erros" value={String(errors.length)} sub="Registros" gradient="from-red-500 to-rose-600" glowColor="rgba(239,68,68,0.15)" />
        <AdminKpi icon={<AlertTriangle className="h-5 w-5" />} label="Não Resolvidos" value={String(openCount)} sub="Pendentes" gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" alert={openCount > 0} />
        <AdminKpi icon={<Clock className="h-5 w-5" />} label="Hoje" value={String(todayCount)} sub="Erros hoje" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<CheckCircle2 className="h-5 w-5" />} label="Contas Afetadas" value={String(uniqueUsers)} sub="Sellers com erro" gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar erro, tipo, seller..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
        </div>
        <div className="flex gap-1 bg-muted/30 border border-border rounded-xl p-1">
          {(["all", "open", "resolved"] as const).map(f => (
            <button key={f} onClick={() => setFilterResolved(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filterResolved === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {f === "all" ? "Todos" : f === "open" ? "Abertos" : "Resolvidos"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <AdminPanel>
        <PanelTitle color="red" icon={<Bug className="h-4 w-4" />}>Log de Erros ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Data/Hora", "Tipo", "Mensagem", "Conta", "Status", "Ações"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(err => (
                <tr key={err.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${!err.resolved ? "bg-destructive/[0.03]" : ""}`}>
                  <td className="p-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {new Date(err.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${typeColors[err.error_type] || typeColors.general}`}>
                      {err.error_type}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-foreground/80 max-w-[300px] truncate">{err.message}</td>
                  <td className="p-3">
                    <span className="text-xs font-medium text-foreground/70">{getSellerName(err.user_id)}</span>
                  </td>
                  <td className="p-3">
                    {err.resolved ? (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">Resolvido</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">Aberto</span>
                    )}
                  </td>
                  <td className="p-3">
                    {err.resolved ? (
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={() => toggleResolved(err.id, false)}>
                        <XCircle className="h-3 w-3" /> Reabrir
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-primary" onClick={() => toggleResolved(err.id, true)}>
                        <CheckCircle2 className="h-3 w-3" /> Resolver
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground text-xs">
                  <Bug className="h-6 w-6 mx-auto mb-2 opacity-20" />
                  {errors.length === 0 ? "Nenhum erro registrado 🎉" : "Nenhum erro encontrado"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
