import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  kind: string;
  severity: string;
  message: string;
  metadata: unknown;
  created_at: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/10 text-warning",
  info: "border-info/40 bg-info/10 text-info",
};

export function AdminAlertsBanner({ isAdmin = false }: { isAdmin?: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = async () => {
    const { data, error: queryError } = await supabase
      .from("admin_alerts")
      .select("id, kind, severity, message, metadata, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    setError(Boolean(queryError));
    if (!queryError) setAlerts((data as Alert[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-alerts-banner")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_alerts" }, () => load())
      .subscribe();
    const t = setInterval(load, 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, []);

  const resolve = async (id: string) => {
    setResolving(id);
    const { error: updateError } = await supabase.from("admin_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    if (!updateError) setAlerts((a) => a.filter((x) => x.id !== id));
    else setError(true);
    setResolving(null);
  };

  if (loading) return null;
  if (error) return <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"><span>Não foi possível carregar ou atualizar os alertas.</span><button onClick={() => void load()} className="inline-flex items-center gap-1 font-semibold"><RefreshCw className="h-3.5 w-3.5" />Tentar novamente</button></div>;
  if (alerts.length === 0) return null;

  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity !== "critical");

  return (
    <div className="space-y-2">
      {[...critical, ...warnings].map((a) => (
        <div
          key={a.id}
          className={cn(
            "flex items-start gap-3 rounded-2xl border px-4 py-3",
            SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.warning,
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-80">
                {a.severity} · {a.kind}
              </span>
              <span className="text-[10px] opacity-60">
                {new Date(a.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              </span>
            </div>
            <p className="text-[13px] font-semibold mt-0.5 text-foreground">{a.message}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => resolve(a.id)}
              className="shrink-0 h-7 px-2 inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card hover:bg-accent text-[11px] font-semibold text-foreground transition-colors"
              title="Marcar como resolvido"
            >
              {resolving === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Resolver
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
