import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ShoppingCart, DollarSign, TrendingUp, CreditCard, Search, X,
  Phone, Mail, Calendar, Clock, Hash, Package, ArrowUpRight,
  RefreshCw, Copy, Check, Users, Eye, MessageCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

const fmtFull = (d: string) => `${fmtDate(d)} às ${fmtTime(d)}`;

type StatusFilter = "all" | "completed" | "pending" | "failed" | "refunded" | "chargeback";

/* ─── KPI Card ─── */
function VendasKpi({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string;
}) {
  return (
    <div className="panel-enterprise p-5 group">
      <div className="flex items-center justify-between mb-3">
        <span className="kicker">{label}</span>
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border border-border/30", bg)}>
          <Icon className={cn("h-[18px] w-[18px]", color)} />
        </div>
      </div>
      <p className="text-[22px] md:text-2xl font-display font-black text-foreground leading-none">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/60 mt-1.5 font-medium">{sub}</p>}
    </div>
  );
}

/* ─── Transaction Row (Desktop) ─── */
function TxRow({ tx, products, onClick, index }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void; index: number;
}) {
  return (
    <tr
      onClick={onClick}
      className="border-b border-border/20 hover:bg-primary/[0.03] transition-all cursor-pointer group animate-fade-in"
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-xs">{(tx.customer_name || "?")[0].toUpperCase()}</span>
          </div>
          <div>
            <p className="text-foreground font-semibold text-[13px]">{tx.customer_name || "—"}</p>
            <p className="text-muted-foreground/50 text-[11px]">{tx.customer_email || ""}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        {tx.customer_phone ? (
          <a
            href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-all border border-primary/10"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">{tx.customer_phone}</span>
            <span className="xl:hidden">WhatsApp</span>
          </a>
        ) : (
          <span className="text-muted-foreground/30 text-[12px]">—</span>
        )}
      </td>
      <td className="p-4">
        <span className="text-foreground/80 text-[13px] font-medium">{tx.product_id ? (products[tx.product_id] || tx.product_id.slice(0, 8)) : "—"}</span>
      </td>
      <td className="p-4">
        <span className="font-display font-black text-foreground text-[15px]">{fmt(Number(tx.net_amount))}</span>
      </td>
      <td className="p-4">
        <span className="text-muted-foreground text-[11px] bg-muted/30 border border-border/40 px-2.5 py-1 rounded-lg font-semibold uppercase tracking-wider">
          {tx.payment_method === "credit_card" ? "Cartão" : tx.payment_method || "—"}
        </span>
      </td>
      <td className="p-4"><StatusBadge status={tx.status} /></td>
      <td className="p-4 text-muted-foreground/50 text-[12px] font-medium">{fmtDate(tx.created_at)}</td>
      <td className="p-4">
        <div className="h-8 w-8 rounded-lg bg-muted/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:bg-primary/5">
          <Eye className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
        </div>
      </td>
    </tr>
  );
}

/* ─── Transaction Card (Mobile) ─── */
function TxCard({ tx, products, onClick, index }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void; index: number;
}) {
  return (
    <div
      className="panel-enterprise-subtle cursor-pointer active:scale-[0.98] transition-transform p-4 animate-fade-in"
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-sm">{(tx.customer_name || "?")[0].toUpperCase()}</span>
          </div>
          <div>
            <p className="text-foreground font-semibold text-[13px]">{tx.customer_name || "Cliente"}</p>
            <p className="text-muted-foreground/50 text-[11px]">{tx.customer_email || ""}</p>
          </div>
        </div>
        <StatusBadge status={tx.status} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-foreground font-display font-black text-xl">{fmt(Number(tx.net_amount))}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground/60 text-[10px] bg-muted/30 border border-border/30 px-2 py-0.5 rounded-md font-semibold uppercase">{tx.payment_method === "credit_card" ? "Cartão" : tx.payment_method || "—"}</span>
            <span className="text-muted-foreground/40 text-[10px]">{tx.product_id ? products[tx.product_id] || "Produto" : "—"}</span>
          </div>
        </div>
        <div className="text-right flex items-center gap-2">
          <p className="text-muted-foreground/50 text-[11px]">{fmtDate(tx.created_at)}</p>
          {tx.customer_phone && (
            <a
              href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Modal ─── */
function TxDetailModal({ tx, products, onClose, onRefund }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClose: () => void; onRefund: (tx: Tables<"transactions">) => void;
}) {
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl animate-scale-in">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent rounded-2xl pointer-events-none" />
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-border/40 bg-card/90 backdrop-blur-xl rounded-t-2xl">
          <div>
            <p className="kicker mb-1">Detalhes da Venda</p>
            <div className="flex items-center gap-3">
              <StatusBadge status={tx.status} />
              <span className="text-2xl font-display font-black text-foreground">{fmt(Number(tx.amount))}</span>
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-xl flex items-center justify-center bg-muted/40 border border-border/60 hover:bg-muted/60 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="relative p-5 space-y-5">
          {/* Financial summary */}
          <div className="rounded-xl border border-border/40 bg-gradient-to-br from-muted/20 to-muted/5 p-4">
            <p className="kicker mb-3">Resumo Financeiro</p>
            <div className="space-y-2">
              <DetailRow label="Valor bruto" value={fmt(Number(tx.amount))} />
              <DetailRow label="Taxa da plataforma" value={`- ${fmt(Number(tx.fee_amount))}`} className="text-destructive" />
              <div className="border-t border-border/30 pt-2.5 mt-2.5">
                <DetailRow label="Valor líquido (seu)" value={fmt(Number(tx.net_amount))} className="text-primary font-black text-base" bold />
              </div>
            </div>
          </div>

          {/* Sale info */}
          <div className="space-y-2.5">
            <p className="kicker">Informações da Venda</p>
            <DetailRow label="ID da venda" value={
              <button onClick={() => handleCopyId(tx.id)} className="inline-flex items-center gap-1.5 font-mono text-[12px] text-foreground hover:text-primary transition-colors">
                {tx.id.slice(0, 16)}...
                {copiedId ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
              </button>
            } />
            <DetailRow label="Método" value={tx.payment_method === "credit_card" ? "Cartão de crédito" : tx.payment_method || "—"} />
            <DetailRow label="Data" value={fmtFull(tx.created_at)} />
            {tx.product_id && (
              <DetailRow label="Produto" value={products[tx.product_id] || tx.product_id.slice(0, 12)} />
            )}
          </div>

          {/* Customer */}
          <div className="space-y-2.5">
            <p className="kicker">Cliente</p>
            <DetailRow label="Nome" value={tx.customer_name || "—"} icon={<Users className="h-3 w-3" />} />
            <DetailRow label="Email" value={tx.customer_email || "—"} icon={<Mail className="h-3 w-3" />} />
            <DetailRow label="Telefone" value={tx.customer_phone || "—"} icon={<Phone className="h-3 w-3" />} />
            {tx.customer_document && (
              <DetailRow label="CPF/CNPJ" value={tx.customer_document} icon={<Hash className="h-3 w-3" />} />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {tx.customer_phone && (
              <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button variant="outline" className="w-full gap-2 rounded-xl h-10 border-primary/20 text-primary hover:bg-primary/5">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </a>
            )}
            {tx.status === "completed" && (
              <Button variant="outline" className="flex-1 gap-2 rounded-xl h-10 border-destructive/20 text-destructive hover:bg-destructive/5" onClick={() => onRefund(tx)}>
                <RefreshCw className="h-4 w-4" /> Reembolsar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon, className = "", bold = false }: { label: string; value: React.ReactNode; icon?: React.ReactNode; className?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2 text-muted-foreground/60 text-[12px]">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`text-[13px] ${bold ? "font-black" : "font-semibold"} ${className || "text-foreground"}`}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════ MAIN ═══════════════════════════════════ */

export default function Vendas() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [products, setProducts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTx, setSelectedTx] = useState<Tables<"transactions"> | null>(null);

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

  const handleRefund = async (_tx: Tables<"transactions">) => {
    toast.info("Para solicitar reembolso, entre em contato com o suporte.");
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <VendasKpi label="Receita Líquida" value={fmt(totalSales)} sub={`${approved.length} aprovadas`} icon={DollarSign} color="text-primary" bg="bg-primary/10" />
        <VendasKpi label="Ticket Médio" value={fmt(avgTicket)} sub="por venda" icon={TrendingUp} color="text-info" bg="bg-info/10" />
        <VendasKpi label="Conversão" value={`${conversion.toFixed(1)}%`} sub="aprovadas/total" icon={CreditCard} color="text-success" bg="bg-success/10" />
        <VendasKpi label="Total Vendas" value={String(transactions.length)} sub="transações" icon={Users} color="text-warning" bg="bg-warning/10" />
      </div>

      {/* Filters */}
      <div className="panel-enterprise p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail, WhatsApp ou ID..."
              className="w-full h-11 pl-11 pr-4 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground/40 hover:text-foreground" />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all border backdrop-blur-sm",
                  statusFilter === f.value
                    ? "bg-primary/10 text-primary border-primary/25 shadow-md shadow-primary/10"
                    : "bg-card/60 text-muted-foreground border-border/40 hover:bg-card/80 hover:border-primary/15"
                )}
              >
                {f.label}
                <span className={cn(
                  "rounded-lg px-2 py-0.5 text-[10px] font-bold",
                  statusFilter === f.value ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground/60"
                )}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="panel-enterprise p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-gradient-to-r from-muted/20 via-transparent to-muted/20">
                  {["Cliente", "Contato", "Produto", "Valor Líquido", "Método", "Status", "Data", ""].map((h) => (
                    <th key={h} className="text-left p-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Nenhuma venda encontrada" subtitle="Tente ajustar os filtros" />
                    </td>
                  </tr>
                ) : filtered.map((tx, i) => (
                  <TxRow key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Nenhuma venda" />
        ) : filtered.map((tx, i) => (
          <TxCard key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
        ))}
      </div>

      {/* Detail Modal */}
      {selectedTx && (
        <TxDetailModal tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={handleRefund} />
      )}
    </PageShell>
  );
}
