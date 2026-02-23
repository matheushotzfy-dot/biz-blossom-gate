import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
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
        <Button variant="outline" size="sm" className="gap-2 rounded-xl hidden md:flex">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Panel>
          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Bruto</p>
          <p className="text-base md:text-[22px] font-extrabold mt-1 md:mt-2 text-foreground truncate">R$ {total.toFixed(2)}</p>
        </Panel>
        <Panel>
          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Taxas</p>
          <p className="text-base md:text-[22px] font-extrabold mt-1 md:mt-2 text-warning truncate">R$ {totalFees.toFixed(2)}</p>
        </Panel>
        <Panel>
          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Líquido</p>
          <p className="text-base md:text-[22px] font-extrabold mt-1 md:mt-2 text-primary truncate">R$ {totalNet.toFixed(2)}</p>
        </Panel>
      </div>

      <div className="flex gap-2 md:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] md:w-[160px] rounded-xl text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completed">Aprovado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Cliente", "Valor", "Taxa", "Líquido", "Método", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-3.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
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
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <Panel><p className="text-center text-muted-foreground text-sm py-4">Nenhuma transação encontrada</p></Panel>
        ) : filtered.map((tx) => (
          <Panel key={tx.id}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-foreground font-semibold text-sm">{tx.customer_name || "Cliente"}</span>
              <StatusBadge status={tx.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground font-bold text-base">R$ {Number(tx.amount).toFixed(2)}</span>
              <span className="text-primary font-semibold text-sm">Líq. R$ {Number(tx.net_amount).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-muted-foreground text-[11px] capitalize">{tx.payment_method || "—"}</span>
              <span className="text-muted-foreground text-[11px]">•</span>
              <span className="text-muted-foreground text-[11px]">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
