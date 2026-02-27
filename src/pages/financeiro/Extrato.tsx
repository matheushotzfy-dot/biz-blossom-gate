import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, Download, Filter, CreditCard, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Extrato() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name").eq("user_id", user.id),
    ]).then(([txRes, prodRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (prodRes.data) setProducts(prodRes.data);
    });
  }, [user?.id]);

  const filtered = transactions.filter((tx) => {
    const matchSearch = !search || tx.customer_name?.toLowerCase().includes(search.toLowerCase()) || tx.customer_email?.toLowerCase().includes(search.toLowerCase()) || tx.id.includes(search);
    const matchStatus = statusFilter === "all" || tx.status === statusFilter;
    const matchMethod = methodFilter === "all" || tx.payment_method === methodFilter;
    const matchProduct = productFilter === "all" || tx.product_id === productFilter;
    return matchSearch && matchStatus && matchMethod && matchProduct;
  });

  const total = filtered.reduce((acc, t) => acc + Number(t.net_amount), 0);
  const totalGross = filtered.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalFees = filtered.reduce((acc, t) => acc + Number(t.fee_amount), 0);
  const getProductName = (id: string | null) => products.find(p => p.id === id)?.name || "—";

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={<FileText className="h-6 w-6" />} title="Extrato" subtitle="Histórico completo de transações" />
        <Button variant="outline" size="sm" className="gap-2 rounded-xl hidden md:flex">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Panel>
          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Líquido</p>
          <p className="text-lg md:text-xl font-extrabold mt-1 text-primary truncate">{fmt(total)}</p>
        </Panel>
        <Panel>
          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Bruto</p>
          <p className="text-lg md:text-xl font-extrabold mt-1 text-foreground truncate">{fmt(totalGross)}</p>
        </Panel>
        <Panel>
          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Taxas</p>
          <p className="text-lg md:text-xl font-extrabold mt-1 text-warning truncate">{fmt(totalFees)}</p>
        </Panel>
        <Panel>
          <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Transações</p>
          <p className="text-lg md:text-xl font-extrabold mt-1 text-foreground">{filtered.length}</p>
        </Panel>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar nome, email ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] rounded-xl text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completed">Aprovado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="refunded">Reembolso</SelectItem>
            <SelectItem value="chargeback">Chargeback</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[130px] rounded-xl text-sm">
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="credit_card">Cartão</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
          </SelectContent>
        </Select>
        {products.length > 0 && (
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[160px] rounded-xl text-sm">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Panel className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["ID", "Cliente", "Produto", "Bruto", "Taxa", "Líquido", "Método", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">Nenhuma transação encontrada</td></tr>
                ) : filtered.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground">{tx.id.slice(0, 8)}</td>
                    <td className="p-3.5">
                      <p className="text-foreground font-medium text-[13px]">{tx.customer_name || "—"}</p>
                      {tx.customer_email && <p className="text-[10px] text-muted-foreground">{tx.customer_email}</p>}
                    </td>
                    <td className="p-3.5 text-[12px] text-muted-foreground max-w-[140px] truncate">{getProductName(tx.product_id)}</td>
                    <td className="p-3.5 text-foreground text-[13px]">{fmt(Number(tx.amount))}</td>
                    <td className="p-3.5 text-warning text-[12px]">-{fmt(Number(tx.fee_amount))}</td>
                    <td className="p-3.5 font-bold text-primary text-[13px]">{fmt(Number(tx.net_amount))}</td>
                    <td className="p-3.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground uppercase">
                        {tx.payment_method === "credit_card" ? "Cartão" : tx.payment_method || "—"}
                      </span>
                    </td>
                    <td className="p-3.5"><StatusBadge status={tx.status} /></td>
                    <td className="p-3.5 text-muted-foreground text-[12px]">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</td>
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
            <p className="text-[11px] text-muted-foreground mb-1 truncate">{getProductName(tx.product_id)}</p>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-foreground font-bold text-base">{fmt(Number(tx.net_amount))}</span>
                <span className="text-[10px] text-muted-foreground ml-2">de {fmt(Number(tx.amount))}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                {tx.payment_method === "credit_card" ? "Cartão" : tx.payment_method || "—"}
              </span>
              <span className="text-muted-foreground text-[11px]">•</span>
              <span className="text-muted-foreground text-[11px]">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
