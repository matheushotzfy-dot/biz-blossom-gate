import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ShoppingCart, DollarSign, TrendingUp, CreditCard, Search, X,
  Phone, Mail, Calendar, Clock, Hash, Package, ArrowUpRight,
  RefreshCw, Copy, Check, Users, Eye,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

const fmtFull = (d: string) => `${fmtDate(d)} às ${fmtTime(d)}`;

type StatusFilter = "all" | "completed" | "pending" | "refunded" | "chargeback";

export default function Vendas() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [products, setProducts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTx, setSelectedTx] = useState<Tables<"transactions"> | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name").eq("user_id", user.id),
    ]).then(([txRes, prodRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (prodRes.data) {
        const map: Record<string, string> = {};
        prodRes.data.forEach((p) => { map[p.id] = p.name; });
        setProducts(map);
      }
    });
  }, [user?.id]);

  const approved = transactions.filter((t) => t.status === "completed");
  const totalSales = approved.reduce((a, t) => a + Number(t.net_amount), 0);
  const avgTicket = approved.length > 0 ? totalSales / approved.length : 0;
  const conversion = transactions.length > 0 ? (approved.length / transactions.length) * 100 : 0;

  const filtered = transactions.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.customer_name?.toLowerCase().includes(q) ||
      t.customer_email?.toLowerCase().includes(q) ||
      t.customer_phone?.includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleRefund = async (tx: Tables<"transactions">) => {
    if (tx.status !== "completed") {
      toast.error("Só é possível reembolsar vendas aprovadas.");
      return;
    }
    const { error } = await supabase
      .from("transactions")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", tx.id);

    if (error) {
      toast.error("Erro ao emitir reembolso.");
    } else {
      toast.success("Reembolso emitido com sucesso!");
      setTransactions((prev) => prev.map((t) => (t.id === tx.id ? { ...t, status: "refunded" } : t)));
      setSelectedTx((prev) => (prev?.id === tx.id ? { ...prev, status: "refunded" } : prev));
    }
  };

  const statusFilters: { label: string; value: StatusFilter; count: number }[] = [
    { label: "Todas", value: "all", count: transactions.length },
    { label: "Aprovadas", value: "completed", count: approved.length },
    { label: "Pendentes", value: "pending", count: transactions.filter((t) => t.status === "pending").length },
    { label: "Reembolsos", value: "refunded", count: transactions.filter((t) => t.status === "refunded").length },
    { label: "Chargebacks", value: "chargeback", count: transactions.filter((t) => t.status === "chargeback").length },
  ];

  return (
    <PageShell>
      <PageTitle icon={<ShoppingCart className="h-6 w-6" />} title="Minhas Vendas" subtitle="Gerencie todas as suas transações e clientes" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Receita Líquida", value: fmt(totalSales), sub: `${approved.length} aprovadas`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
          { label: "Ticket Médio", value: fmt(avgTicket), sub: "por venda aprovada", icon: TrendingUp, color: "text-info", bg: "bg-info/10", border: "border-info/20" },
          { label: "Conversão", value: `${conversion.toFixed(1)}%`, sub: "aprovadas/total", icon: CreditCard, color: "text-success", bg: "bg-success/10", border: "border-success/20" },
          { label: "Total Vendas", value: String(transactions.length), sub: "transações", icon: Users, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
        ].map((kpi) => (
          <Panel key={kpi.label} className={`relative overflow-hidden border-2 ${kpi.border}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider">{kpi.label}</span>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-2xl font-display font-black text-foreground">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>
          </Panel>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, WhatsApp ou ID..."
            className="w-full h-11 pl-11 pr-4 rounded-xl bg-card border-2 border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground/40 hover:text-foreground" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[11px] font-bold transition-all border-2 ${
                statusFilter === f.value
                  ? "bg-primary/10 text-primary border-primary/25 shadow-sm shadow-primary/10"
                  : "bg-card text-muted-foreground border-border hover:bg-muted/40 hover:border-primary/15"
              }`}
            >
              {f.label}
              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                statusFilter === f.value ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Panel className="p-0 overflow-hidden border-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted/30">
                  {["Cliente", "WhatsApp", "Produto", "Valor Líquido", "Método", "Status", "Data", ""].map((h) => (
                    <th key={h} className="text-left p-4 text-[11px] font-bold text-foreground/70 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                          <ShoppingCart className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Nenhuma venda encontrada</p>
                        <p className="text-muted-foreground/60 text-xs">Tente ajustar os filtros</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary font-bold text-xs">{(tx.customer_name || "?")[0].toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-foreground font-semibold text-[13px]">{tx.customer_name || "—"}</p>
                          <p className="text-muted-foreground text-[11px]">{tx.customer_email || ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {tx.customer_phone ? (
                        <a
                          href={`https://wa.me/${tx.customer_phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-primary text-[12px] font-semibold hover:underline bg-primary/8 border border-primary/20 px-2.5 py-1.5 rounded-lg"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {tx.customer_phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground/40 text-[12px]">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-foreground text-[13px] font-medium">{tx.product_id ? (products[tx.product_id] || tx.product_id.slice(0, 8)) : "—"}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-foreground text-[14px]">{fmt(Number(tx.net_amount))}</span>
                    </td>
                    <td className="p-4">
                      <span className="capitalize text-foreground/80 text-[12px] bg-muted/50 border border-border px-2 py-1 rounded-lg font-medium">{tx.payment_method || "—"}</span>
                    </td>
                    <td className="p-4"><StatusBadge status={tx.status} /></td>
                    <td className="p-4 text-foreground/70 text-[12px] font-medium">{fmtDate(tx.created_at)}</td>
                    <td className="p-4">
                      <Eye className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <ShoppingCart className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma venda</p>
          </div>
        ) : filtered.map((tx) => (
          <Panel key={tx.id} className="cursor-pointer active:scale-[0.99] transition-transform border-2" onClick={() => setSelectedTx(tx)}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-sm">{(tx.customer_name || "?")[0].toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-foreground font-semibold text-[13px]">{tx.customer_name || "Cliente"}</p>
                  <p className="text-muted-foreground text-[11px]">{tx.customer_email || ""}</p>
                </div>
              </div>
              <StatusBadge status={tx.status} />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-foreground font-display font-black text-xl">{fmt(Number(tx.net_amount))}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-foreground/70 text-[10px] bg-muted/50 border border-border px-2 py-0.5 rounded-md font-medium">{tx.payment_method || "—"}</span>
                  <span className="text-muted-foreground text-[10px]">{tx.product_id ? products[tx.product_id] || "Produto" : "—"}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-foreground/70 text-[11px] font-medium">{fmtDate(tx.created_at)}</p>
                {tx.customer_phone && (
                  <a
                    href={`https://wa.me/${tx.customer_phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-primary text-[10px] font-semibold mt-0.5 bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded"
                  >
                    <Phone className="h-2.5 w-2.5" /> WhatsApp
                  </a>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {/* ─── DETAIL MODAL ─── */}
      {selectedTx && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setSelectedTx(null)}>
          <div className="absolute inset-0 bg-background/60 backdrop-blur-md" />
          <div 
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border-2 border-border bg-card shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b-2 border-border bg-card rounded-t-2xl">
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Detalhes da Venda</p>
                <div className="flex items-center gap-3">
                  <StatusBadge status={selectedTx.status} />
                  <span className="text-2xl font-display font-black text-foreground">{fmt(Number(selectedTx.amount))}</span>
                </div>
              </div>
              <button onClick={() => setSelectedTx(null)} className="h-9 w-9 rounded-xl flex items-center justify-center bg-muted/60 border-2 border-border hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Financial summary */}
              <div className="rounded-xl border-2 border-primary/15 bg-primary/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">Resumo Financeiro</p>
                <div className="space-y-2">
                  <DetailRow label="Valor bruto" value={fmt(Number(selectedTx.amount))} />
                  <DetailRow label="Taxa da plataforma" value={`- ${fmt(Number(selectedTx.fee_amount))}`} className="text-destructive" />
                  <div className="border-t border-border pt-2.5 mt-2.5">
                    <DetailRow label="Valor líquido (seu)" value={fmt(Number(selectedTx.net_amount))} className="text-primary font-black text-base" bold />
                  </div>
                </div>
              </div>

              {/* Sale info */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">Informações da Venda</p>
                <DetailRow label="ID da venda" value={
                  <button onClick={() => handleCopyId(selectedTx.id)} className="inline-flex items-center gap-1.5 font-mono text-[12px] text-foreground hover:text-primary transition-colors">
                    {selectedTx.id.slice(0, 16)}...
                    {copiedId ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  </button>
                } />
                <DetailRow icon={<Package className="h-3.5 w-3.5" />} label="Produto" value={selectedTx.product_id ? (products[selectedTx.product_id] || selectedTx.product_id.slice(0, 12)) : "—"} />
                <DetailRow icon={<CreditCard className="h-3.5 w-3.5" />} label="Método" value={selectedTx.payment_method || "—"} />
                <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Pedido criado" value={fmtFull(selectedTx.created_at)} />
                <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Última atualização" value={fmtFull(selectedTx.updated_at)} />
                {selectedTx.checkout_session_id && (
                  <DetailRow icon={<Hash className="h-3.5 w-3.5" />} label="Session ID" value={selectedTx.checkout_session_id.slice(0, 20)} mono />
                )}
              </div>

              {/* Customer */}
              <div className="rounded-xl border-2 border-border bg-muted/10 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70 mb-3">Dados do Cliente</p>
                <div className="space-y-2.5">
                  <DetailRow label="Nome" value={selectedTx.customer_name || "—"} />
                  {selectedTx.customer_email && (
                    <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={
                      <a href={`mailto:${selectedTx.customer_email}`} className="text-primary hover:underline text-[13px]">{selectedTx.customer_email}</a>
                    } />
                  )}
                  {selectedTx.customer_phone && (
                    <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="WhatsApp" value={
                      <a
                        href={`https://wa.me/${selectedTx.customer_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary font-semibold text-[13px] hover:underline bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-lg"
                      >
                        {selectedTx.customer_phone}
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    } />
                  )}
                  {selectedTx.customer_document && (
                    <DetailRow label="CPF/CNPJ" value={selectedTx.customer_document} mono />
                  )}
                </div>
              </div>

              {/* Tracking */}
              {selectedTx.podpay_event_id && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">Rastreamento</p>
                  <DetailRow label="Event ID" value={selectedTx.podpay_event_id} mono />
                  {selectedTx.podpay_payment_id && (
                    <DetailRow label="Payment ID" value={selectedTx.podpay_payment_id} mono />
                  )}
                </div>
              )}

              {/* Actions */}
              {selectedTx.status === "completed" && (
                <div className="pt-3 border-t-2 border-border">
                  <button
                    onClick={() => handleRefund(selectedTx)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/15"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Emitir Reembolso
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

/* ─── Detail row helper ─── */
function DetailRow({
  icon,
  label,
  value,
  mono,
  bold,
  className,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[12px] font-semibold">{label}</span>
      </div>
      <span className={`text-[13px] text-foreground text-right ${mono ? "font-mono" : ""} ${bold ? "font-black" : "font-semibold"} ${className || ""}`}>
        {value}
      </span>
    </div>
  );
}
