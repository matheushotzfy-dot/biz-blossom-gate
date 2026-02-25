import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ShoppingCart, DollarSign, TrendingUp, CreditCard, Search, X,
  Phone, Mail, Calendar, Clock, Hash, Package, MapPin, ArrowUpRight,
  RefreshCw, Filter, ChevronDown, Copy, Check,
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

type StatusFilter = "all" | "completed" | "pending" | "failed" | "refunded" | "chargeback";

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
    { label: "Falhas", value: "failed", count: transactions.filter((t) => t.status === "failed").length },
    { label: "Reembolsos", value: "refunded", count: transactions.filter((t) => t.status === "refunded").length },
    { label: "Chargebacks", value: "chargeback", count: transactions.filter((t) => t.status === "chargeback").length },
  ];

  return (
    <PageShell>
      <PageTitle icon={<ShoppingCart className="h-6 w-6" />} title="Minhas Vendas" subtitle="Gerencie todas as suas transações e clientes" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Receita Líquida</span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10"><DollarSign className="h-4 w-4 text-primary" /></div>
          </div>
          <p className="text-xl font-display font-black text-foreground">{fmt(totalSales)}</p>
          <p className="text-[10px] text-primary font-semibold mt-0.5">{approved.length} aprovadas</p>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ticket Médio</span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-info/10"><TrendingUp className="h-4 w-4 text-info" /></div>
          </div>
          <p className="text-xl font-display font-black text-foreground">{fmt(avgTicket)}</p>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Conversão</span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-success/10"><CreditCard className="h-4 w-4 text-success" /></div>
          </div>
          <p className="text-xl font-display font-black text-foreground">{conversion.toFixed(1)}%</p>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Vendas</span>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-warning/10"><ShoppingCart className="h-4 w-4 text-warning" /></div>
          </div>
          <p className="text-xl font-display font-black text-foreground">{transactions.length}</p>
        </Panel>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, WhatsApp ou ID..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold transition-all border ${
                statusFilter === f.value
                  ? "bg-primary/10 text-primary border-primary/25"
                  : "bg-card text-muted-foreground border-border hover:bg-muted/40"
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
        <Panel className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Cliente", "WhatsApp", "Produto", "Valor", "Método", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left p-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-muted-foreground text-sm">Nenhuma venda encontrada</td></tr>
                ) : filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="p-3.5 font-mono text-[11px] text-muted-foreground">{tx.id.slice(0, 8)}</td>
                    <td className="p-3.5">
                      <p className="text-foreground font-semibold text-[13px]">{tx.customer_name || "—"}</p>
                      <p className="text-muted-foreground text-[11px]">{tx.customer_email || ""}</p>
                    </td>
                    <td className="p-3.5">
                      {tx.customer_phone ? (
                        <a
                          href={`https://wa.me/${tx.customer_phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-primary text-[12px] font-semibold hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {tx.customer_phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-[12px]">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-foreground text-[13px] font-medium">{tx.product_id ? (products[tx.product_id] || tx.product_id.slice(0, 8)) : "—"}</td>
                    <td className="p-3.5 font-bold text-foreground">{fmt(Number(tx.net_amount))}</td>
                    <td className="p-3.5 capitalize text-muted-foreground text-[12px]">{tx.payment_method || "—"}</td>
                    <td className="p-3.5"><StatusBadge status={tx.status} /></td>
                    <td className="p-3.5 text-muted-foreground text-[12px]">{fmtDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <Panel><p className="text-center text-muted-foreground text-sm py-6">Nenhuma venda</p></Panel>
        ) : filtered.map((tx) => (
          <Panel key={tx.id} className="cursor-pointer" onClick={() => setSelectedTx(tx)}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-foreground font-semibold text-sm">{tx.customer_name || "Cliente"}</span>
              <StatusBadge status={tx.status} />
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-foreground font-display font-black text-lg">{fmt(Number(tx.net_amount))}</span>
              <span className="text-muted-foreground text-[11px]">{fmtDate(tx.created_at)}</span>
            </div>
            {tx.customer_phone && (
              <div className="flex items-center gap-1 text-primary text-[11px] font-semibold">
                <Phone className="h-3 w-3" /> {tx.customer_phone}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">{tx.product_id ? products[tx.product_id] || "Produto" : "—"} • {tx.payment_method || "—"}</p>
          </Panel>
        ))}
      </div>

      {/* ─── DETAIL MODAL ─── */}
      {selectedTx && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setSelectedTx(null)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-border bg-card rounded-t-2xl">
              <div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Detalhes da Venda</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={selectedTx.status} />
                  <span className="text-2xl font-display font-black text-foreground">{fmt(Number(selectedTx.amount))}</span>
                </div>
              </div>
              <button onClick={() => setSelectedTx(null)} className="h-9 w-9 rounded-xl flex items-center justify-center bg-muted/60 border border-border/80 hover:bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Financial summary */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Resumo Financeiro</p>
                <DetailRow label="Valor bruto" value={fmt(Number(selectedTx.amount))} />
                <DetailRow label="Taxa da plataforma" value={`- ${fmt(Number(selectedTx.fee_amount))}`} className="text-destructive" />
                <div className="border-t border-border pt-2 mt-2">
                  <DetailRow label="Valor líquido (seu)" value={fmt(Number(selectedTx.net_amount))} className="text-primary font-black" bold />
                </div>
              </div>

              {/* Sale info */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Informações da Venda</p>
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
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</p>
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
                      className="inline-flex items-center gap-1.5 text-primary font-semibold text-[13px] hover:underline"
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

              {/* UTMs - from checkout_session_id or podpay metadata */}
              {selectedTx.podpay_event_id && (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rastreamento</p>
                  <DetailRow label="Event ID" value={selectedTx.podpay_event_id} mono />
                  {selectedTx.podpay_payment_id && (
                    <DetailRow label="Payment ID" value={selectedTx.podpay_payment_id} mono />
                  )}
                </div>
              )}

              {/* Actions */}
              {selectedTx.status === "completed" && (
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={() => handleRefund(selectedTx)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
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
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <span className={`text-[13px] text-foreground text-right ${mono ? "font-mono" : ""} ${bold ? "font-black" : "font-semibold"} ${className || ""}`}>
        {value}
      </span>
    </div>
  );
}
