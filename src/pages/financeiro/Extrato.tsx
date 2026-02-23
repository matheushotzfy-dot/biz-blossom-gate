import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, Download, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

export default function Extrato() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    supabase.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setTransactions(data); });
  }, [user?.id]);

  const filtered = transactions.filter((tx) => {
    const matchSearch = !search || tx.customer_name?.toLowerCase().includes(search.toLowerCase()) || tx.id.includes(search);
    const matchStatus = statusFilter === "all" || tx.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const total = filtered.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalFees = filtered.reduce((acc, t) => acc + Number(t.fee_amount), 0);
  const totalNet = filtered.reduce((acc, t) => acc + Number(t.net_amount), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2 text-foreground font-display">
            <FileText className="h-6 w-6 text-primary" /> Extrato
          </h1>
          <p className="text-foreground/40 text-sm mt-1">Histórico completo de transações</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 border-white/[0.06] text-foreground/60 hover:text-foreground hover:bg-white/[0.04]">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider">Total Bruto</p>
          <p className="text-2xl font-extrabold mt-2 text-foreground font-display">R$ {total.toFixed(2)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider">Total Taxas</p>
          <p className="text-2xl font-extrabold mt-2 text-warning font-display">R$ {totalFees.toFixed(2)}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-semibold text-foreground/40 uppercase tracking-wider">Total Líquido</p>
          <p className="text-2xl font-extrabold mt-2 text-primary font-display">R$ {totalNet.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/30" />
          <Input placeholder="Buscar por nome ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-white/[0.03] border-white/[0.06] text-foreground placeholder:text-foreground/30" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-white/[0.03] border-white/[0.06] text-foreground"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04] text-foreground/40">
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">ID</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Cliente</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Valor</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Taxa</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Líquido</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Método</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Status</th>
              <th className="text-left p-4 font-semibold text-xs uppercase tracking-wider">Data</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-foreground/30">Nenhuma transação encontrada</td></tr>
            ) : (
              filtered.map((tx) => (
                <tr key={tx.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-mono text-xs text-foreground/50">{tx.id.slice(0, 8)}</td>
                  <td className="p-4 text-foreground font-medium">{tx.customer_name || "—"}</td>
                  <td className="p-4 font-bold text-foreground">R$ {Number(tx.amount).toFixed(2)}</td>
                  <td className="p-4 text-warning font-semibold">R$ {Number(tx.fee_amount).toFixed(2)}</td>
                  <td className="p-4 text-primary font-semibold">R$ {Number(tx.net_amount).toFixed(2)}</td>
                  <td className="p-4 capitalize text-foreground/70">{tx.payment_method}</td>
                  <td className="p-4"><StatusBadge status={tx.status} /></td>
                  <td className="p-4 text-foreground/40">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
