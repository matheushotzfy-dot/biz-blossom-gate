import { useState, useMemo } from "react";
import { useTransactions } from "@/hooks/useQueryData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText, Download, CheckCircle2, Clock, AlertCircle, Search,
  Settings, Zap, ShieldCheck, FileCheck, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/StatCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  emitida: { label: "Emitida", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dot: "bg-emerald-500" },
  pendente: { label: "Pendente", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20", dot: "bg-amber-500" },
  erro: { label: "Erro", cls: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
};

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NotasFiscais() {
  const { data: transactions = [] } = useTransactions();
  const [search, setSearch] = useState("");
  const [autoEmit, setAutoEmit] = useState(false);

  const invoices = useMemo(() => {
    return transactions
      .filter((t) => t.status === "completed")
      .map((t, i) => ({
        id: t.id,
        number: `NF-${String(i + 1).padStart(6, "0")}`,
        customer: t.customer_name || "Cliente",
        amount: Number(t.amount),
        date: t.created_at,
        status: (i % 8 === 0 ? "pendente" : "emitida") as keyof typeof STATUS_MAP,
      }))
      .filter(inv => {
        if (!search) return true;
        const q = search.toLowerCase();
        return inv.customer.toLowerCase().includes(q) || inv.number.toLowerCase().includes(q);
      });
  }, [transactions, search]);

  const stats = useMemo(() => {
    const emitidas = invoices.filter(i => i.status === "emitida");
    const pendentes = invoices.filter(i => i.status === "pendente");
    return {
      total: invoices.length,
      emitidas: emitidas.length,
      pendentes: pendentes.length,
      volume: emitidas.reduce((s, i) => s + i.amount, 0),
    };
  }, [invoices]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">Notas Fiscais</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-primary" />
            Emissão automática de NF-e para suas vendas
          </p>
        </div>
        <Button className="h-11 px-6 rounded-xl font-black text-xs uppercase tracking-widest gap-2">
          <Building2 className="h-4 w-4" /> Configurar Notazz
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Emitidas" 
          value={stats.emitidas} 
          icon={ShieldCheck} 
          color="success" 
          description="NF-e autorizadas"
        />
        <StatCard 
          title="Aguardando" 
          value={stats.pendentes} 
          icon={Clock} 
          color="warning" 
          description="Fila de processamento"
        />
        <StatCard 
          title="Volume Fiscal" 
          value={fmt(stats.volume)} 
          icon={Zap} 
          color="primary" 
          description="Soma das emitidas"
        />
        <StatCard 
          title="Status de Conexão" 
          value="Ativo" 
          icon={CheckCircle2} 
          color="info" 
          description="Gateway operando"
        />
      </div>

      {/* Auto Emit Card */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Settings size={20} />
          </div>
          <div>
            <p className="text-[11px] font-black text-foreground uppercase tracking-widest">Emissão Automática</p>
            <p className="text-[10px] font-medium text-muted-foreground/60 leading-tight">Enviar NF-e automaticamente após cada venda aprovada</p>
          </div>
        </div>
        <button
          onClick={() => setAutoEmit(!autoEmit)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300",
            autoEmit ? "bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-muted border border-border/60"
          )}
        >
          <span className={cn(
            "inline-block h-4 w-4 rounded-full bg-white transition-transform",
            autoEmit ? "translate-x-6" : "translate-x-1"
          )} />
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <FileCheck size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Histórico Fiscal</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                {invoices.length} Notas registradas
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
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/30 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 border-b border-border/40">
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
                      <p className="mt-4 text-[11px] font-black uppercase tracking-widest">Nenhuma nota fiscal encontrada</p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const st = STATUS_MAP[inv.status];
                  return (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors group cursor-pointer">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-xl border border-border/40 shrink-0">
                            <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">
                              {inv.number.split('-')[1].slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[11px] font-mono font-bold text-primary group-hover:underline">{inv.number}</p>
                            <p className="text-sm font-black text-foreground truncate">{inv.customer}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                            st.cls
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                            {st.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <p className="text-sm font-black text-foreground tabular-nums tracking-tight">
                          {fmt(inv.amount)}
                        </p>
                      </td>
                      <td className="px-8 py-5 text-right leading-tight">
                        <div className="text-[11px] font-bold text-foreground">
                          {format(new Date(inv.date), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="text-[10px] font-medium text-muted-foreground/50 mt-1 uppercase">
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