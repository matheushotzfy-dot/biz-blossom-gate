import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useWithdrawals, usePixKeys, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Plus, Wallet, Clock, History, Search, X, ArrowDownToLine, Info,
  CheckCircle2, AlertCircle, XCircle, ChevronRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const WITHDRAW_FEE = 5;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "Concluído", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
  pending: { label: "Pendente", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
  rejected: { label: "Recusado", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
};

export default function Saques() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { data: withdrawals = [], refetch } = useWithdrawals();
  const { data: pixKeys = [] } = usePixKeys();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [retainedAmount, setRetainedAmount] = useState<number>(0);
  const [search, setSearch] = useState("");
  const invalidateAll = useInvalidateAll();

  useEffect(() => {
    const fetchBalance = async () => {
      const { data } = await supabase.rpc("get_ledger_balance", { _user_id: user?.id });
      if (data !== null) setAvailableBalance(Number(data));
      
      const { data: tx } = await supabase
        .from("transactions")
        .select("retained_amount")
        .eq("user_id", user?.id)
        .eq("status", "approved")
        .eq("retention_released", false);
      if (tx) setRetainedAmount(tx.reduce((acc, t) => acc + Number(t.retained_amount || 0), 0));
    };
    fetchBalance();
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (!search) return withdrawals;
    const q = search.toLowerCase();
    return withdrawals.filter(w => w.id.toLowerCase().includes(q) || fmt(Number(w.amount)).includes(q));
  }, [withdrawals, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!user || isNaN(numAmount) || numAmount <= WITHDRAW_FEE) { toast.error("Valor inválido"); return; }
    if (numAmount > availableBalance) { toast.error("Saldo insuficiente"); return; }
    const { error } = await supabase.from("withdrawals").insert({ user_id: user.id, amount: numAmount });
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitação enviada!"); setOpen(false); setAmount(""); invalidateAll(["withdrawals"]);
  };

  const netPreview = parseFloat(amount) > WITHDRAW_FEE ? parseFloat(amount) - WITHDRAW_FEE : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header e Saldos */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-black text-foreground tracking-tight">Saques</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="bg-primary text-primary-foreground h-11 px-6 rounded-xl font-black text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-sm">
                <Plus size={18} strokeWidth={3} /> Novo Saque
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">Solicitar Saque</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Valor do Saque</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">R$</span>
                    <Input 
                      type="number" 
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-11 h-14 text-xl font-black tabular-nums bg-background border-border"
                      placeholder="0,00"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium">Taxa fixa de {fmt(WITHDRAW_FEE)} por transação.</p>
                </div>
                <div className="bg-muted p-5 rounded-2xl border border-border space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-muted-foreground">Taxa Administrativa</span>
                    <span className="text-destructive">-{fmt(WITHDRAW_FEE)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-4 items-center">
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Você receberá</span>
                    <span className="text-2xl font-black text-green-600 dark:text-green-400 tabular-nums">{fmt(netPreview)}</span>
                  </div>
                </div>
                <button type="submit" className="w-full bg-primary text-primary-foreground h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/10">
                  Confirmar Solicitação
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cards de Saldo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card p-8 rounded-[24px] border border-border shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <Wallet size={16} />
                <span className="text-[11px] font-black uppercase tracking-[0.15em]">Saldo Disponível</span>
              </div>
              <p className="text-4xl font-black text-foreground tabular-nums tracking-tighter">{fmt(availableBalance)}</p>
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
              <Wallet size={160} />
            </div>
          </div>
          <div className="bg-card p-8 rounded-[24px] border border-border shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <Clock size={16} />
                <span className="text-[11px] font-black uppercase tracking-[0.15em]">Aguardando Liberação</span>
              </div>
              <p className="text-4xl font-black text-foreground tabular-nums tracking-tighter">{fmt(retainedAmount)}</p>
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
              <Clock size={160} />
            </div>
          </div>
        </div>

        {/* Tabela de Histórico */}
        <div className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-muted rounded-xl flex items-center justify-center text-muted-foreground">
                <History size={20} />
              </div>
              <h2 className="font-black text-foreground tracking-tight">Histórico de Saques</h2>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por ID ou valor..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 pl-11 pr-4 bg-muted border border-border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/50 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground border-b border-border">
                  <th className="px-8 py-5">Identificador</th>
                  <th className="px-8 py-5">Solicitado</th>
                  <th className="px-8 py-5">Taxa</th>
                  <th className="px-8 py-5">Líquido</th>
                  <th className="px-8 py-5 text-center">Status</th>
                  <th className="px-8 py-5 text-center">Data/Hora</th>
                  <th className="px-8 py-5 text-center">Processado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center opacity-20">
                        <History size={48} />
                        <p className="mt-4 text-[11px] font-black uppercase tracking-widest text-foreground">Sem registros encontrados</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((w) => {
                    const status = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={w.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-8 py-6">
                          <span className="font-mono text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                            #{w.id.slice(0, 12).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-sm font-black tabular-nums text-foreground">
                          {fmt(Number(w.amount))}
                        </td>
                        <td className="px-8 py-6 text-sm font-bold text-destructive tabular-nums">
                          -{fmt(Number(w.fee_amount || WITHDRAW_FEE))}
                        </td>
                        <td className="px-8 py-6 text-sm font-black text-green-600 dark:text-green-400 tabular-nums">
                          {fmt(Number(w.net_amount))}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center">
                            <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", status.bg, status.color, "border-current/10")}>
                              {status.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center leading-tight">
                          <div className="text-[11px] font-bold text-foreground">{format(new Date(w.created_at), "dd/MM/yyyy")}</div>
                          <div className="text-[10px] font-medium text-muted-foreground mt-0.5">{format(new Date(w.created_at), "HH:mm")}</div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          {(w as any).processed_at ? (
                            <div className="leading-tight">
                              <div className="text-[11px] font-bold text-foreground">{format(new Date((w as any).processed_at), "dd/MM/yyyy")}</div>
                              <div className="text-[10px] font-medium text-muted-foreground mt-0.5">{format(new Date((w as any).processed_at), "HH:mm")}</div>
                            </div>
                          ) : (
                            <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">—</span>
                          )}
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
    </div>
  );
}
