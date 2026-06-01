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
  approved: { label: "Concluído", color: "text-green-600", bg: "bg-green-50" },
  pending: { label: "Pendente", color: "text-amber-600", bg: "bg-amber-50" },
  rejected: { label: "Recusado", color: "text-red-600", bg: "bg-red-50" },
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
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header e Saldos */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold text-neutral-900">Saques</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2">
                <Plus size={18} /> Novo Saque
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Solicitar Saque</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-600">Valor do Saque</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-neutral-400">R$</span>
                    <Input 
                      type="number" 
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-10 h-12 text-lg font-bold"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div className="bg-neutral-50 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Taxa administrativa</span>
                    <span className="font-bold text-red-500">-{fmt(WITHDRAW_FEE)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold text-neutral-900">
                    <span>Você receberá</span>
                    <span className="text-green-600">{fmt(netPreview)}</span>
                  </div>
                </div>
                <button type="submit" className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold">
                  Confirmar Solicitação
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cards de Saldo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-2 text-neutral-500 mb-2">
              <Wallet size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Saldo Disponível</span>
            </div>
            <p className="text-3xl font-black text-neutral-900">{fmt(availableBalance)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-2 text-neutral-500 mb-2">
              <Clock size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Aguardando Liberação (Retido)</span>
            </div>
            <p className="text-3xl font-black text-neutral-900">{fmt(retainedAmount)}</p>
          </div>
        </div>

        {/* Tabela de Histórico */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="font-bold text-neutral-800 flex items-center gap-2">
              <History size={18} /> Histórico de Saques
            </h2>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
              <input 
                type="text" 
                placeholder="Buscar por ID..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50 text-[10px] uppercase font-black tracking-widest text-neutral-400 border-b">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Valor Solicitado</th>
                  <th className="px-6 py-4">Taxa</th>
                  <th className="px-6 py-4">Valor Líquido</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Depósito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-neutral-400 text-sm">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((w) => {
                    const status = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                    return (
                      <tr key={w.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-neutral-500">#{w.id.slice(0, 8)}</td>
                        <td className="px-6 py-4 text-sm font-bold">{fmt(Number(w.amount))}</td>
                        <td className="px-6 py-4 text-sm text-red-500">{fmt(Number(w.fee_amount || WITHDRAW_FEE))}</td>
                        <td className="px-6 py-4 text-sm font-bold text-green-600">{fmt(Number(w.net_amount))}</td>
                        <td className="px-6 py-4">
                          <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", status.bg, status.color)}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[11px] text-neutral-500 leading-tight">
                          {format(new Date(w.created_at), "dd/MM/yyyy")}<br />
                          {format(new Date(w.created_at), "HH:mm")}
                        </td>
                        <td className="px-6 py-4 text-[11px] text-neutral-500">
                          {(w as any).processed_at ? format(new Date((w as any).processed_at), "dd/MM/yyyy HH:mm") : "—"}
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
