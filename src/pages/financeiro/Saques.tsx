import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWithdrawals, useInvalidateAll } from "@/hooks/useQueryData";
import { Plus, Wallet, Clock, History, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const WITHDRAW_FEE = 5;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "Concluído", color: "text-emerald-700", bg: "bg-emerald-50" },
  pending: { label: "Pendente", color: "text-orange-700", bg: "bg-orange-50" },
  rejected: { label: "Recusado", color: "text-rose-700", bg: "bg-rose-50" },
};

export default function Saques() {
  const { user } = useAuth();
  const { data: withdrawals = [] } = useWithdrawals();
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
    return withdrawals.filter(w => w.id.toLowerCase().includes(q));
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

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-4 md:p-10 font-sans selection:bg-black selection:text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Saques</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">Gerencie suas retiradas e acompanhe seu saldo</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="bg-slate-900 text-white h-11 px-6 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm">
                <Plus size={18} strokeWidth={3} /> Novo Saque
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">Solicitar Novo Saque</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Valor para retirar</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">R$</span>
                    <Input 
                      type="number" 
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-11 h-14 text-xl font-black rounded-xl border-slate-200 focus:ring-slate-900"
                      placeholder="0,00"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Taxa fixa de {fmt(WITHDRAW_FEE)} por transação.</p>
                </div>
                
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Taxa Administrativa</span>
                    <span className="text-rose-500">-{fmt(WITHDRAW_FEE)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200 font-black">
                    <span className="text-xs uppercase tracking-wider text-slate-400">Valor Líquido</span>
                    <span className="text-2xl text-emerald-600 tabular-nums">
                      {fmt(parseFloat(amount) > WITHDRAW_FEE ? parseFloat(amount) - WITHDRAW_FEE : 0)}
                    </span>
                  </div>
                </div>

                <button type="submit" className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                  Confirmar e Solicitar
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Balance Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-slate-400 mb-3">
                <Wallet size={16} />
                <span className="text-[11px] font-black uppercase tracking-[0.15em]">Saldo Disponível</span>
              </div>
              <h2 className="text-4xl font-black text-slate-900 tabular-nums tracking-tight">{fmt(availableBalance)}</h2>
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg]">
              <Wallet size={160} />
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-slate-400 mb-3">
                <Clock size={16} />
                <span className="text-[11px] font-black uppercase tracking-[0.15em]">Saldo Pendente (Retido)</span>
              </div>
              <h2 className="text-4xl font-black text-slate-900 tabular-nums tracking-tight">{fmt(retainedAmount)}</h2>
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg]">
              <Clock size={160} />
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-[32px] border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                <History size={20} />
              </div>
              <h2 className="font-black text-slate-800 tracking-tight">Histórico de Movimentação</h2>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                placeholder="Buscar pelo ID do saque..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 border-b border-slate-100">
                  <th className="px-8 py-5">ID do Saque</th>
                  <th className="px-8 py-5">Valor Solicitado</th>
                  <th className="px-8 py-5">Taxa</th>
                  <th className="px-8 py-5">Valor Líquido</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Solicitado em</th>
                  <th className="px-8 py-5">Processado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center opacity-20">
                        <History size={48} />
                        <p className="mt-4 text-sm font-black uppercase tracking-widest">Nenhum registro</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((w) => {
                    const status = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <span className="font-mono text-[11px] font-bold text-slate-400 group-hover:text-slate-900 transition-colors">
                            #{w.id.slice(0, 12).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-sm font-black text-slate-700 tabular-nums">
                          {fmt(Number(w.amount))}
                        </td>
                        <td className="px-8 py-6 text-sm font-bold text-rose-500 tabular-nums">
                          -{fmt(Number(w.fee_amount || WITHDRAW_FEE))}
                        </td>
                        <td className="px-8 py-6 text-sm font-black text-emerald-600 tabular-nums">
                          {fmt(Number(w.net_amount))}
                        </td>
                        <td className="px-8 py-6">
                          <span className={cn(
                            "inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                            status.bg, status.color, "border-current/10"
                          )}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-[11px] font-bold text-slate-600">{format(new Date(w.created_at), "dd/MM/yyyy")}</div>
                          <div className="text-[10px] font-medium text-slate-400 mt-0.5">{format(new Date(w.created_at), "HH:mm")}</div>
                        </td>
                        <td className="px-8 py-6">
                          {(w as any).processed_at ? (
                            <>
                              <div className="text-[11px] font-bold text-slate-600">{format(new Date((w as any).processed_at), "dd/MM/yyyy")}</div>
                              <div className="text-[10px] font-medium text-slate-400 mt-0.5">{format(new Date((w as any).processed_at), "HH:mm")}</div>
                            </>
                          ) : (
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">—</span>
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
