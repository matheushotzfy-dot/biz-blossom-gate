import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

export default function Extrato() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    supabase.from("transactions").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setTransactions(data); });
  }, [user]);

  const filtered = transactions.filter((tx) => {
    const matchSearch = !search || tx.customer_name?.toLowerCase().includes(search.toLowerCase()) || tx.id.includes(search);
    const matchStatus = statusFilter === "all" || tx.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const total = filtered.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalFees = filtered.reduce((acc, t) => acc + Number(t.fee_amount), 0);
  const totalNet = filtered.reduce((acc, t) => acc + Number(t.net_amount), 0);

  return (
    <div className="space-y-6 dark">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Extrato
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Histórico completo de transações</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Bruto</p>
          <p className="text-xl font-bold mt-1">R$ {total.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Taxas</p>
          <p className="text-xl font-bold mt-1 text-warning">R$ {totalFees.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Total Líquido</p>
          <p className="text-xl font-bold mt-1 text-success">R$ {totalNet.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-4 font-medium">ID</th>
              <th className="text-left p-4 font-medium">Cliente</th>
              <th className="text-left p-4 font-medium">Valor</th>
              <th className="text-left p-4 font-medium">Taxa</th>
              <th className="text-left p-4 font-medium">Líquido</th>
              <th className="text-left p-4 font-medium">Método</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhuma transação encontrada</td></tr>
            ) : (
              filtered.map((tx) => (
                <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-mono text-xs">{tx.id.slice(0, 8)}</td>
                  <td className="p-4">{tx.customer_name || "—"}</td>
                  <td className="p-4 font-semibold">R$ {Number(tx.amount).toFixed(2)}</td>
                  <td className="p-4 text-warning">R$ {Number(tx.fee_amount).toFixed(2)}</td>
                  <td className="p-4 text-success">R$ {Number(tx.net_amount).toFixed(2)}</td>
                  <td className="p-4 capitalize">{tx.payment_method}</td>
                  <td className="p-4"><StatusBadge status={tx.status} /></td>
                  <td className="p-4 text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
