import { useState, useMemo, useCallback } from "react";
import {
  Search, Download, CreditCard, Smartphone, FileText, ChevronDown, Eye,
  RotateCcw, Upload, Clock, CheckCircle2, XCircle, AlertTriangle, ShieldAlert,
  Code2, DollarSign, User, Mail, Hash, ArrowUpDown, Filter, X,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/auditLog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  fmtCurrency: (v: number) => string;
  onReload: () => void;
}

const PAGE_SIZE = 80;

const _dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const _dateCache = new Map<string, string>();
const fmtDateCached = (d: string) => {
  let v = _dateCache.get(d);
  if (!v) { v = _dateFmt.format(new Date(d)); _dateCache.set(d, v); }
  return v;
};
const _fullDateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "medium" });

/* ─── Local console primitives (no shared deps) ─────────────────────── */
const Panel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <section className={cn("bg-white border border-slate-200 rounded-md", className)}>{children}</section>
);
const PanelHead = ({ title, count, right }: { title: string; count?: number; right?: React.ReactNode }) => (
  <header className="flex items-center justify-between h-10 px-3 border-b border-slate-200 bg-slate-50">
    <div className="flex items-center gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">{title}</h3>
      {count !== undefined && (
        <span className="px-1.5 h-4 inline-flex items-center text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 rounded tabular-nums">{count.toLocaleString("pt-BR")}</span>
      )}
    </div>
    {right}
  </header>
);

const Stat = ({ label, value, sub, tone = "default", icon: Icon }: {
  label: string; value: string; sub?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  icon?: React.ComponentType<{ className?: string }>;
}) => {
  const tones: Record<string, string> = {
    default: "border-l-slate-300",
    success: "border-l-emerald-500",
    warning: "border-l-amber-500",
    danger: "border-l-red-500",
    info: "border-l-sky-500",
  };
  const tints: Record<string, string> = {
    default: "text-slate-700",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
    info: "text-sky-600",
  };
  return (
    <div className={cn("bg-white border border-slate-200 border-l-2 rounded-md px-3 py-2.5 min-w-0", tones[tone])}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        {Icon && <Icon className={cn("h-3.5 w-3.5", tints[tone])} />}
      </div>
      <div className="text-[17px] font-semibold tabular-nums text-slate-900 leading-tight truncate">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</div>}
    </div>
  );
};

export default function AdminTransactionsTab({ transactions, profiles, products, fmtCurrency, onReload }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [sortField, setSortField] = useState<"date" | "amount">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedTx, setSelectedTx] = useState<Tables<"transactions"> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const profileNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.user_id, p.full_name || "—");
    return m;
  }, [profiles]);
  const productMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) m.set(p.id, p.name);
    return m;
  }, [products]);

  const getSellerName = (userId: string) => profileNameMap.get(userId) || "—";
  const getProductName = (productId: string | null) => (productId && productMap.get(productId)) || "—";

  const methodLabel = (m: string | null) =>
    m === "pix" ? "PIX" : m === "credit_card" ? "Cartão" : m === "boleto" ? "Boleto" : (m || "—");
  const MethodIcon = ({ m }: { m: string | null }) => {
    if (m === "pix") return <Smartphone className="h-3 w-3 text-emerald-600" />;
    if (m === "credit_card") return <CreditCard className="h-3 w-3 text-sky-600" />;
    if (m === "boleto") return <FileText className="h-3 w-3 text-amber-600" />;
    return <span className="h-3 w-3 inline-block" />;
  };

  const sellerOptions = useMemo(() => {
    const s = new Map<string, string>();
    for (const t of transactions) if (!s.has(t.user_id)) s.set(t.user_id, getSellerName(t.user_id));
    return Array.from(s.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [transactions, profileNameMap]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const result = transactions.filter(t => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (methodFilter !== "all" && t.payment_method !== methodFilter) return false;
      if (sellerFilter !== "all" && t.user_id !== sellerFilter) return false;
      if (!search) return true;
      return (
        t.customer_name?.toLowerCase().includes(s) ||
        t.customer_email?.toLowerCase().includes(s) ||
        t.id.includes(s) ||
        getSellerName(t.user_id).toLowerCase().includes(s)
      );
    });
    result.sort((a, b) => {
      if (sortField === "date") return sortAsc ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortAsc ? Number(a.amount) - Number(b.amount) : Number(b.amount) - Number(a.amount);
    });
    return result;
  }, [transactions, search, statusFilter, methodFilter, sellerFilter, sortField, sortAsc]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const loadMore = useCallback(() => setVisibleCount(c => c + PAGE_SIZE), []);

  const kpis = useMemo(() => {
    const todayStr = new Date().toDateString();
    let completed = 0, pending = 0, failed = 0, chargebacks = 0, refunded = 0, todayN = 0, todayV = 0, totalGross = 0, totalFees = 0, totalNet = 0;
    for (const t of transactions) {
      if (t.status === "completed" || t.status === "approved") { completed++; totalGross += Number(t.amount); totalFees += Number(t.fee_amount); totalNet += Number(t.net_amount); }
      else if (t.status === "pending") pending++;
      else if (t.status === "failed" || t.status === "expired") failed++;
      else if (t.status === "chargeback") chargebacks++;
      else if (t.status === "refunded") refunded++;
      if (new Date(t.created_at).toDateString() === todayStr) {
        todayN++;
        if (t.status === "completed" || t.status === "approved") todayV += Number(t.amount);
      }
    }
    const approvalRate = transactions.length ? (completed / transactions.length) * 100 : 0;
    return { completed, pending, failed, chargebacks, refunded, todayN, todayV, totalGross, totalFees, totalNet, approvalRate };
  }, [transactions]);

  const openXRay = (t: Tables<"transactions">) => { setSelectedTx(t); setSheetOpen(true); };

  const openRefund = () => {
    if (!selectedTx) return;
    setRefundType("full");
    setRefundAmount(String(Number(selectedTx.amount)));
    setRefundReason("");
    setRefundOpen(true);
  };

  const handleRefund = async () => {
    if (!selectedTx) return;
    if (!refundReason.trim() || refundReason.trim().length < 5) { toast.error("Justificativa obrigatória (mín. 5 caracteres)"); return; }
    const amount = refundType === "full" ? Number(selectedTx.amount) : Number(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > Number(selectedTx.amount)) { toast.error("Valor inválido"); return; }
    if (selectedTx.status !== "completed" && selectedTx.status !== "approved") { toast.error("Só é possível estornar transações aprovadas"); return; }
    if (!window.confirm(`Confirma estorno de R$ ${amount.toFixed(2)}?`)) return;
    setRefunding(true);
    try {
      const sanitizedReason = refundReason.replace(/[<>]/g, "").trim().slice(0, 500);
      const { data, error } = await supabase.functions.invoke("podpay-refund", {
        body: { transactionId: selectedTx.id, amount, reason: sanitizedReason },
      });
      if (error || !data?.success) { toast.error(data?.error || "Erro ao processar estorno"); return; }
      toast.success(`Estorno de ${fmtCurrency(amount)} processado!`);
      await logAdminAction("refund_transaction", "transaction", selectedTx.id, { amount, type: refundType, reason: sanitizedReason });
      setRefundOpen(false);
      setSheetOpen(false);
      onReload();
    } catch { toast.error("Erro de conexão"); }
    finally { setRefunding(false); }
  };

  const buildTimeline = (t: Tables<"transactions">) => {
    const events: { time: string; label: string; tone: "neutral" | "success" | "warning" | "danger" }[] = [];
    events.push({ time: t.created_at, label: "Transação criada", tone: "neutral" });
    if (t.status === "pending") events.push({ time: t.updated_at || t.created_at, label: "Aguardando pagamento", tone: "warning" });
    if (t.status === "completed" || t.status === "approved") events.push({ time: t.updated_at || t.created_at, label: "Pagamento aprovado", tone: "success" });
    if (t.status === "failed") events.push({ time: t.updated_at || t.created_at, label: "Pagamento recusado", tone: "danger" });
    if (t.status === "expired") events.push({ time: t.updated_at || t.created_at, label: "Transação expirada", tone: "neutral" });
    if (t.status === "refunded") events.push({ time: t.updated_at || t.created_at, label: "Estorno processado", tone: "warning" });
    if (t.status === "chargeback") events.push({ time: t.updated_at || t.created_at, label: "Chargeback recebido", tone: "danger" });
    return events;
  };

  const exportCsv = () => {
    const headers = ["id", "data", "cliente", "email", "vendedor", "produto", "metodo", "bruto", "taxa", "liquido", "status"];
    const rows = filtered.map(t => [
      t.id, t.created_at, t.customer_name || "", t.customer_email || "",
      getSellerName(t.user_id), getProductName(t.product_id),
      methodLabel(t.payment_method), Number(t.amount), Number(t.fee_amount), Number(t.net_amount), t.status,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} transações exportadas`);
  };

  const statusPills: { id: string; label: string; count: number; tone: string }[] = [
    { id: "all", label: "Tudo", count: transactions.length, tone: "slate" },
    { id: "completed", label: "Aprovadas", count: kpis.completed, tone: "emerald" },
    { id: "pending", label: "Pendentes", count: kpis.pending, tone: "amber" },
    { id: "failed", label: "Recusadas", count: kpis.failed, tone: "red" },
    { id: "refunded", label: "Estornadas", count: kpis.refunded, tone: "violet" },
    { id: "chargeback", label: "Chargebacks", count: kpis.chargebacks, tone: "red" },
  ];
  const pillTones: Record<string, { bg: string; text: string; border: string }> = {
    slate: { bg: "bg-slate-900", text: "text-white", border: "border-slate-900" },
    emerald: { bg: "bg-emerald-600", text: "text-white", border: "border-emerald-600" },
    amber: { bg: "bg-amber-500", text: "text-white", border: "border-amber-500" },
    red: { bg: "bg-red-600", text: "text-white", border: "border-red-600" },
    violet: { bg: "bg-violet-600", text: "text-white", border: "border-violet-600" },
  };
  const activeFilters = (statusFilter !== "all" ? 1 : 0) + (methodFilter !== "all" ? 1 : 0) + (sellerFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* ── Page header ─────────────────────────────────── */}
      <header className="flex items-end justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">Operações · Pagamentos</div>
          <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">Transações</h1>
          <p className="text-[12px] text-slate-500 mt-1">Console operacional · aprovações, chargebacks e fluxo de caixa.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2 h-7 rounded border text-[11px] font-medium tabular-nums",
            kpis.chargebacks > 0 ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", kpis.chargebacks > 0 ? "bg-red-500" : "bg-emerald-500")} />
            {kpis.chargebacks > 0 ? `${kpis.chargebacks} chargebacks ativos` : "Operação saudável"}
          </span>
          <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1.5" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </header>

      {/* ── KPI strip ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Stat label="Volume bruto" value={fmtCurrency(kpis.totalGross)} sub={`${kpis.completed} aprovadas`} tone="info" icon={DollarSign} />
        <Stat label="Líquido" value={fmtCurrency(kpis.totalNet)} sub={`Taxas ${fmtCurrency(kpis.totalFees)}`} tone="success" icon={CheckCircle2} />
        <Stat label="Aprovação" value={`${kpis.approvalRate.toFixed(1)}%`} sub={`${transactions.length} total`} tone="default" />
        <Stat label="Hoje" value={fmtCurrency(kpis.todayV)} sub={`${kpis.todayN} transações`} tone="info" />
        <Stat label="Pendentes" value={kpis.pending.toLocaleString("pt-BR")} sub="Aguardando" tone="warning" icon={Clock} />
        <Stat label="Chargebacks" value={kpis.chargebacks.toLocaleString("pt-BR")} sub={`${kpis.refunded} estornos`} tone={kpis.chargebacks > 0 ? "danger" : "default"} icon={ShieldAlert} />
      </div>

      {/* ── Status pills ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {statusPills.map(p => {
          const active = statusFilter === p.id;
          const t = pillTones[p.tone];
          return (
            <button key={p.id} onClick={() => setStatusFilter(p.id)}
              className={cn(
                "inline-flex items-center gap-2 h-7 px-2.5 rounded-md text-[11px] font-medium border transition-colors",
                active
                  ? `${t.bg} ${t.text} ${t.border}`
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
              )}>
              {p.label}
              <span className={cn(
                "tabular-nums text-[10px] px-1 rounded",
                active ? "bg-white/20" : "bg-slate-100 text-slate-500"
              )}>{p.count.toLocaleString("pt-BR")}</span>
            </button>
          );
        })}
      </div>

      {/* ── Toolbar ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-md p-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            placeholder="Buscar por cliente, vendedor, ID, e-mail…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
          />
        </div>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[130px] h-8 text-[11px]"><SelectValue placeholder="Método" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos métodos</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="credit_card">Cartão</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sellerFilter} onValueChange={setSellerFilter}>
          <SelectTrigger className="w-[200px] h-8 text-[11px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos vendedores</SelectItem>
            {sellerOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1.5"
          onClick={() => { if (sortField === "date") setSortField("amount"); else { setSortField("date"); setSortAsc(!sortAsc); } }}>
          <ArrowUpDown className="h-3 w-3" /> Ordenar: {sortField === "date" ? "Data" : "Valor"} {sortAsc ? "↑" : "↓"}
        </Button>
        {activeFilters > 0 && (
          <Button size="sm" variant="ghost" className="h-8 text-[11px] text-slate-500 gap-1"
            onClick={() => { setStatusFilter("all"); setMethodFilter("all"); setSellerFilter("all"); }}>
            <X className="h-3 w-3" /> Limpar ({activeFilters})
          </Button>
        )}
        <div className="ml-auto text-[11px] text-slate-500 tabular-nums px-2">
          Mostrando <span className="font-semibold text-slate-700">{visibleItems.length.toLocaleString("pt-BR")}</span> de <span className="font-semibold text-slate-700">{filtered.length.toLocaleString("pt-BR")}</span>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────── */}
      <Panel>
        <PanelHead title="Ledger de Transações" count={filtered.length} />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                {["ID", "Cliente", "Vendedor", "Produto", "Método", "Bruto", "Taxa", "Líquido", "Status", "Data", ""].map((h, i) => (
                  <th key={h + i} className={cn(
                    "px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500",
                    ["Bruto", "Taxa", "Líquido"].includes(h) ? "text-right" : "text-left"
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map(t => {
                const isCharge = t.status === "chargeback";
                const isRefund = t.status === "refunded";
                return (
                  <tr key={t.id}
                    className={cn(
                      "border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors",
                      isCharge && "bg-red-50/40",
                      isRefund && "bg-amber-50/30",
                    )}
                    onClick={() => openXRay(t)}>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-500 whitespace-nowrap">{t.id.slice(0, 8)}</td>
                    <td className="px-3 py-2 min-w-[160px]">
                      <div className="text-[12px] font-medium text-slate-900 truncate">{t.customer_name || "—"}</div>
                      <div className="text-[10px] text-slate-500 truncate">{t.customer_email}</div>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-700 truncate max-w-[160px]">{getSellerName(t.user_id)}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-600 truncate max-w-[180px]">{getProductName(t.product_id)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700">
                        <MethodIcon m={t.payment_method} />
                        {methodLabel(t.payment_method)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[12px] text-slate-900 font-medium">{fmtCurrency(Number(t.amount))}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[11px] text-slate-500">−{fmtCurrency(Number(t.fee_amount))}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[12px] font-semibold text-emerald-700">{fmtCurrency(Number(t.net_amount))}</td>
                    <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-3 py-2 text-[10px] text-slate-500 whitespace-nowrap">{fmtDateCached(t.created_at)}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); openXRay(t); }}>
                        <Eye className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-16 text-center">
                  <Filter className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-[12px] text-slate-500">Nenhuma transação encontrada</p>
                  <p className="text-[11px] text-slate-400">Ajuste os filtros e tente novamente</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {visibleCount < filtered.length && (
          <div className="border-t border-slate-200 px-3 py-2 bg-slate-50 text-center">
            <Button variant="outline" size="sm" onClick={loadMore} className="h-7 text-[11px] gap-1.5">
              <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({(filtered.length - visibleCount).toLocaleString("pt-BR")} restantes)
            </Button>
          </div>
        )}
      </Panel>

      {/* ── X-Ray Sheet ─────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          {selectedTx && (
            <>
              <SheetHeader className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Transação</div>
                <SheetTitle className="text-[16px] font-semibold text-slate-900 flex items-center gap-2">
                  <span className="font-mono text-[12px] text-slate-600">{selectedTx.id.slice(0, 12)}</span>
                  <StatusBadge status={selectedTx.status} />
                </SheetTitle>
              </SheetHeader>

              <div className="p-5 space-y-5">
                {/* Financial summary */}
                <div className="grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-md overflow-hidden">
                  <div className="bg-white p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bruto</div>
                    <div className="text-[16px] font-semibold tabular-nums text-slate-900 mt-1">{fmtCurrency(Number(selectedTx.amount))}</div>
                  </div>
                  <div className="bg-white p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Taxa</div>
                    <div className="text-[16px] font-semibold tabular-nums text-amber-600 mt-1">−{fmtCurrency(Number(selectedTx.fee_amount))}</div>
                  </div>
                  <div className="bg-white p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Líquido</div>
                    <div className="text-[16px] font-semibold tabular-nums text-emerald-700 mt-1">{fmtCurrency(Number(selectedTx.net_amount))}</div>
                  </div>
                </div>

                {/* Two-column dossier */}
                <Panel>
                  <PanelHead title="Dossiê" />
                  <dl className="grid grid-cols-[110px_1fr] gap-x-3 text-[12px] p-3">
                    <Row icon={<Hash className="h-3 w-3" />} label="ID" value={selectedTx.id} mono />
                    <Row icon={<User className="h-3 w-3" />} label="Cliente" value={selectedTx.customer_name || "—"} />
                    <Row icon={<Mail className="h-3 w-3" />} label="E-mail" value={selectedTx.customer_email || "—"} />
                    <Row icon={<FileText className="h-3 w-3" />} label="Documento" value={selectedTx.customer_document || "—"} />
                    <Row icon={<Smartphone className="h-3 w-3" />} label="Telefone" value={selectedTx.customer_phone || "—"} />
                    <Row icon={<CreditCard className="h-3 w-3" />} label="Método" value={methodLabel(selectedTx.payment_method)} />
                    <Row icon={<User className="h-3 w-3" />} label="Vendedor" value={getSellerName(selectedTx.user_id)} />
                    <Row icon={<FileText className="h-3 w-3" />} label="Produto" value={getProductName(selectedTx.product_id)} />
                    {selectedTx.podpay_payment_id && <Row icon={<Hash className="h-3 w-3" />} label="PodPay" value={selectedTx.podpay_payment_id} mono />}
                    {selectedTx.retained_amount > 0 && (
                      <Row icon={<AlertTriangle className="h-3 w-3" />} label="Retido"
                        value={`${fmtCurrency(selectedTx.retained_amount)} até ${selectedTx.retained_until ? fmtDateCached(selectedTx.retained_until) : "—"}`} />
                    )}
                  </dl>
                </Panel>

                {/* Timeline */}
                <Panel>
                  <PanelHead title="Linha do tempo" />
                  <ol className="p-3 space-y-3">
                    {buildTimeline(selectedTx).map((ev, i) => {
                      const dot = ev.tone === "success" ? "bg-emerald-500" : ev.tone === "danger" ? "bg-red-500" : ev.tone === "warning" ? "bg-amber-500" : "bg-slate-300";
                      return (
                        <li key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className={cn("h-2 w-2 rounded-full mt-1.5", dot)} />
                            {i < buildTimeline(selectedTx).length - 1 && <span className="w-px flex-1 bg-slate-200 mt-1" />}
                          </div>
                          <div className="pb-1">
                            <div className="text-[12px] font-medium text-slate-900">{ev.label}</div>
                            <div className="text-[10px] text-slate-500 tabular-nums">{_fullDateFmt.format(new Date(ev.time))}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Panel>

                {/* Raw */}
                <Accordion type="single" collapsible>
                  <AccordionItem value="raw" className="border border-slate-200 rounded-md px-3 bg-white">
                    <AccordionTrigger className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 hover:no-underline py-2.5">
                      <span className="flex items-center gap-1.5"><Code2 className="h-3.5 w-3.5" /> Raw data</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-[10px] bg-slate-50 border border-slate-200 rounded p-3 overflow-auto max-h-[300px] text-slate-700 font-mono whitespace-pre-wrap">
{JSON.stringify({
  transaction_id: selectedTx.id,
  podpay_payment_id: selectedTx.podpay_payment_id,
  podpay_event_id: selectedTx.podpay_event_id,
  checkout_session_id: selectedTx.checkout_session_id,
  status: selectedTx.status,
  payment_method: selectedTx.payment_method,
  amount: Number(selectedTx.amount),
  fee_amount: Number(selectedTx.fee_amount),
  net_amount: Number(selectedTx.net_amount),
  retained_amount: selectedTx.retained_amount,
  retained_until: selectedTx.retained_until,
  retention_released: selectedTx.retention_released,
  customer: {
    name: selectedTx.customer_name,
    email: selectedTx.customer_email,
    document: selectedTx.customer_document,
    phone: selectedTx.customer_phone,
  },
  product_id: selectedTx.product_id,
  user_id: selectedTx.user_id,
  created_at: selectedTx.created_at,
  updated_at: selectedTx.updated_at,
}, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
                  {(selectedTx.status === "completed" || selectedTx.status === "approved") && (
                    <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-[11px]" onClick={openRefund}>
                      <RotateCcw className="h-3.5 w-3.5" /> Estornar pagamento
                    </Button>
                  )}
                  {selectedTx.status === "chargeback" && (
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px] border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => setDisputeOpen(true)}>
                      <Upload className="h-3.5 w-3.5" /> Upload comprovante (disputa)
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Refund Dialog ─────────────────────────────────── */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 text-[15px]">
              <RotateCcw className="h-4 w-4" /> Estornar pagamento
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] space-y-1">
                <p><span className="text-slate-500">Transação:</span> <span className="font-mono text-slate-700">{selectedTx.id.slice(0, 12)}…</span></p>
                <p><span className="text-slate-500">Valor original:</span> <span className="font-semibold text-slate-900 tabular-nums">{fmtCurrency(Number(selectedTx.amount))}</span></p>
                <p><span className="text-slate-500">Vendedor:</span> <span className="text-slate-700">{getSellerName(selectedTx.user_id)}</span></p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={refundType === "full" ? "default" : "outline"} className="flex-1 h-8 text-[11px]"
                  onClick={() => { setRefundType("full"); setRefundAmount(String(Number(selectedTx.amount))); }}>
                  Estorno total
                </Button>
                <Button size="sm" variant={refundType === "partial" ? "default" : "outline"} className="flex-1 h-8 text-[11px]"
                  onClick={() => setRefundType("partial")}>
                  Estorno parcial
                </Button>
              </div>
              {refundType === "partial" && (
                <div>
                  <label className="text-[11px] font-medium text-slate-600">Valor (R$)</label>
                  <Input type="number" step="0.01" min="0.01" max={Number(selectedTx.amount)} value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value)} className="mt-1 h-8 text-[12px]" placeholder="0,00" />
                </div>
              )}
              <div>
                <label className="text-[11px] font-medium text-slate-600">Justificativa (audit trail)</label>
                <Textarea value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  placeholder="Ex.: Cliente solicitou reembolso por insatisfação…"
                  className="mt-1 text-[12px]" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" className="h-8 text-[11px]" onClick={() => setRefundOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="h-8 text-[11px] gap-1.5" onClick={handleRefund} disabled={refunding}>
              {refunding ? "Processando…" : "Confirmar estorno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dispute Upload ─────────────────────────────────── */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 text-[15px]">
              <Upload className="h-4 w-4" /> Comprovante para disputa
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-600">
                Anexe a evidência (entrega, contrato, log) para contestar o chargeback da transação{" "}
                <span className="font-mono text-slate-700">{selectedTx.id.slice(0, 12)}</span>.
              </p>
              <div className="border-2 border-dashed border-slate-300 rounded-md p-6 text-center bg-slate-50">
                <Upload className="h-7 w-7 text-slate-400 mx-auto mb-2" />
                <p className="text-[11px] text-slate-600">Arraste ou clique para enviar (PDF, JPG, PNG · máx. 10MB)</p>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="mt-3 text-[11px] mx-auto block"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];
                    if (!ALLOWED.includes(file.type)) { toast.error("Use PDF, JPG ou PNG"); return; }
                    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB"); return; }
                    const mimeExt: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
                    const ext = mimeExt[file.type];
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
                    const filePath = `disputes/${selectedTx.id}/${crypto.randomUUID()}.${ext}`;
                    const { error } = await supabase.storage.from("dispute-evidence").upload(filePath, file, { upsert: true, contentType: file.type });
                    if (error) { toast.error("Erro no upload"); return; }
                    toast.success("Comprovante enviado!");
                    await logAdminAction("upload_dispute_evidence", "transaction", selectedTx.id, { file: safeName });
                    setDisputeOpen(false);
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Row helper ─────────────────────────────────────────────── */
function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="flex items-center gap-1.5 text-[11px] text-slate-500 py-1.5 border-b border-slate-100">
        <span className="text-slate-400">{icon}</span> {label}
      </dt>
      <dd className={cn("text-[12px] text-slate-900 py-1.5 border-b border-slate-100 truncate", mono && "font-mono text-[11px]")}>{value}</dd>
    </>
  );
}
