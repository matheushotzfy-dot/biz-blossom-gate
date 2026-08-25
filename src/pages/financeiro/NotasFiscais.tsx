import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  FileText, CheckCircle2, Clock, AlertCircle, Search,
  Settings, Zap, ShieldCheck, FileCheck, Building2, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/StatCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type DeliveryStatus = "pending" | "delivered" | "exhausted";

const STATUS_MAP: Record<DeliveryStatus, { label: string; cls: string; dot: string; Icon: typeof CheckCircle2 }> = {
  delivered: { label: "Emitida",   cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dot: "bg-emerald-500", Icon: CheckCircle2 },
  pending:   { label: "Aguardando", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20",       dot: "bg-amber-500",   Icon: Clock },
  exhausted: { label: "Falhou",    cls: "bg-red-500/10 text-red-500 border-red-500/20",             dot: "bg-red-500",     Icon: AlertCircle },
};

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface InvoiceRow {
  id: string;
  number: string;
  customer: string;
  amount: number;
  date: string;
  status: DeliveryStatus;
  error: string | null;
}

export default function NotasFiscais() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: integration } = useQuery({
    queryKey: ["notazz-integration", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_integrations")
        .select("id, is_active, api_key")
        .eq("user_id", user!.id)
        .eq("app_name", "notazz")
        .maybeSingle();
      return data;
    },
  });

  const { data: rawDeliveries = [], refetch, isFetching } = useQuery({
    queryKey: ["notazz-deliveries", user?.id],
    enabled: !!user?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_deliveries")
        .select("id, status, event, error, created_at, delivered_at, transaction_id, transactions(amount, customer_name, customer_email)")
        .eq("user_id", user!.id)
        .eq("app_name", "notazz")
        .order("created_at", { ascending: false })
        .limit(200);
      type DeliveryRow = {
        id: string; status: string; event: string | null; error: string | null;
        created_at: string; delivered_at: string | null; transaction_id: string | null;
        transactions: { amount: number | null; customer_name: string | null; customer_email: string | null } | null;
      };
      return (data ?? []) as unknown as DeliveryRow[];
    },
  });

  const invoices = useMemo<InvoiceRow[]>(() => {
    const rows = rawDeliveries.map((d, i) => {
      const tx = d.transactions;
      return {
        id: d.id,
        number: `NF-${String(rawDeliveries.length - i).padStart(6, "0")}`,
        customer: tx?.customer_name || tx?.customer_email || "Cliente",
        amount: Number(tx?.amount || 0),
        date: d.delivered_at || d.created_at,
        status: (d.status as DeliveryStatus) ?? "pending",
        error: d.error ?? null,
      };
    });
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => r.customer.toLowerCase().includes(q) || r.number.toLowerCase().includes(q));
  }, [rawDeliveries, search]);

  const stats = useMemo(() => {
    const emitidas = invoices.filter(i => i.status === "delivered");
    const pendentes = invoices.filter(i => i.status === "pending");
    const falhas = invoices.filter(i => i.status === "exhausted");
    return {
      total: invoices.length,
      emitidas: emitidas.length,
      pendentes: pendentes.length,
      falhas: falhas.length,
      volume: emitidas.reduce((s, i) => s + i.amount, 0),
    };
  }, [invoices]);

  const integrationConnected = Boolean(integration?.is_active);

  const retryFailed = async () => {
    const failed = invoices.filter(i => i.status === "exhausted");
    if (!failed.length) { toast.info("Nenhuma nota falhada para reprocessar."); return; }
    const { error } = await supabase
      .from("app_deliveries")
      .update({ status: "pending", attempt: 0, next_retry_at: new Date().toISOString(), error: null })
      .in("id", failed.map(f => f.id));
    if (error) toast.error("Falha ao reprocessar"); else { toast.success(`${failed.length} notas reenfileiradas`); refetch(); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight ">Notas Fiscais</h1>
          <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-primary" />
            Emissão automática de NF-e via Notazz
          </p>
        </div>
        <div className="flex gap-2">
          {stats.falhas > 0 && (
            <Button onClick={retryFailed} variant="outline" className="h-11 px-4 rounded-xl font-semibold text-xs gap-2">
              <RefreshCw className="h-4 w-4" /> Reprocessar Falhas ({stats.falhas})
            </Button>
          )}
          <Button onClick={() => navigate("/integracoes?tab=apps")} className="h-11 px-6 rounded-xl font-semibold text-xs gap-2">
            <Building2 className="h-4 w-4" /> {integrationConnected ? "Configurar Notazz" : "Conectar Notazz"}
          </Button>
        </div>
      </div>

      {!integrationConnected && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-[12px] p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black text-foreground">Notazz não está conectado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Para emitir notas automaticamente em cada venda aprovada, conecte sua API key da Notazz em <button onClick={() => navigate("/integracoes?tab=apps")} className="underline font-bold">Integrações → Apps</button>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Emitidas" value={stats.emitidas} icon={ShieldCheck} color="success" description="NF-e autorizadas" />
        <StatCard title="Aguardando"     value={stats.pendentes} icon={Clock}        color="warning" description="Na fila"           />
        <StatCard title="Volume Fiscal"  value={fmt(stats.volume)} icon={Zap}        color="primary" description="Soma das emitidas" />
        <StatCard title="Conexão"        value={integrationConnected ? "Ativo" : "Off"} icon={CheckCircle2} color={integrationConnected ? "info" : "warning"} description={integrationConnected ? "Notazz conectado" : "Configure"} />
      </div>

      <div className="bg-card rounded-[24px] border border-border/60  overflow-hidden">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <FileCheck size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-semibold text-foreground tracking-tight leading-none ">Histórico Fiscal</h2>
              <p className="text-[11px] font-medium text-muted-foreground mt-1">
                {invoices.length} Notas registradas {isFetching && "• atualizando..."}
              </p>
            </div>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
            <input
              type="text"
              placeholder="Número ou Cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-11 pr-4 bg-muted/30 border border-border/60 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="bg-muted/30 text-[11px] font-semibold text-muted-foreground/60 border-b border-border/40">
                <th className="px-8 py-5">Nº / Cliente</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Valor</th>
                <th className="px-8 py-5 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <FileText size={48} strokeWidth={1} />
                      <p className="mt-4 text-[11px] font-semibold ">
                        {integrationConnected ? "Nenhuma nota emitida ainda" : "Conecte a Notazz para começar"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const st = STATUS_MAP[inv.status];
                  return (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors group" title={inv.error || undefined}>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-xl border border-border/40 shrink-0">
                            <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">
                              {inv.number.split('-')[1].slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[11px] font-mono font-bold text-primary">{inv.number}</p>
                            <p className="text-sm font-black text-foreground truncate">{inv.customer}</p>
                            {inv.error && <p className="text-[10px] text-red-500 truncate max-w-xs">{inv.error}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center">
                          <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border", st.cls)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                            {st.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <p className="text-sm font-black text-foreground tabular-nums tracking-tight">{fmt(inv.amount)}</p>
                      </td>
                      <td className="px-8 py-5 text-right leading-tight">
                        <div className="text-[11px] font-bold text-foreground">
                          {format(new Date(inv.date), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="text-[11px] font-medium text-muted-foreground/50 mt-1 ">
                          {format(new Date(inv.date), "HH:mm'h'", { locale: ptBR })}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
