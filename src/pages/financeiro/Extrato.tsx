import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, Panel, PageTitle, DataTable } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

export default function Extrato() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
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
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={<FileText className="h-6 w-6" />} title="Extrato" subtitle="Histórico completo de transações" />
        <Button variant="outline" size="sm" className="gap-2 rounded-xl">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Panel><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total Bruto</p><p className="text-[22px] font-extrabold mt-2 text-foreground">R$ {total.toFixed(2)}</p></Panel>
        <Panel><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total Taxas</p><p className="text-[22px] font-extrabold mt-2 text-warning">R$ {totalFees.toFixed(2)}</p></Panel>
        <Panel><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total Líquido</p><p className="text-[22px] font-extrabold mt-2 text-primary">R$ {totalNet.toFixed(2)}</p></Panel>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completed">Aprovado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable headers={["ID", "Cliente", "Valor", "Taxa", "Líquido", "Método", "Status", "Data"]}>
        {filtered.length === 0 ? (
          <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhuma transação encontrada</td></tr>
        ) : filtered.map((tx) => (
          <tr key={tx.id} className="border-b border-border hover:bg-muted/30 transition-colors">
            <td className="p-3.5 font-mono text-[11px] text-muted-foreground">{tx.id.slice(0, 8)}</td>
            <td className="p-3.5 text-foreground font-medium text-[13px]">{tx.customer_name || "—"}</td>
            <td className="p-3.5 font-bold text-foreground text-[13px]">R$ {Number(tx.amount).toFixed(2)}</td>
            <td className="p-3.5 font-semibold text-[13px] text-warning">R$ {Number(tx.fee_amount).toFixed(2)}</td>
            <td className="p-3.5 font-semibold text-[13px] text-primary">R$ {Number(tx.net_amount).toFixed(2)}</td>
            <td className="p-3.5 capitalize text-muted-foreground text-[13px]">{tx.payment_method}</td>
            <td className="p-3.5"><StatusBadge status={tx.status} /></td>
            <td className="p-3.5 text-muted-foreground text-[13px]">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</td>
          </tr>
        ))}
      </DataTable>
    </PageShell>
  );
}
