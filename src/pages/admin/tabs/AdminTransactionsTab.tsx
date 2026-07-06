import { useState, useMemo, useCallback } from "react";
import {
  Search, Download, CreditCard, Smartphone, FileText, ChevronDown, Eye,
  RotateCcw, Upload, Clock, CheckCircle2, AlertTriangle, ShieldAlert,
  Code2, DollarSign, User, Mail, Hash, ArrowUpDown, Filter, X, Copy,
  MapPin, Tag, Globe, Key, Beaker, Timer, ShieldCheck,
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
import { cn, deriveTransactionStatus } from "@/lib/utils";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented, PremiumEmpty, premiumTable } from "./AdminPremium";

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

const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copiado"); };

type StatusKey = "all" | "completed" | "pending" | "failed" | "refunded" | "chargeback";

export default function AdminTransactionsTab({ transactions, profiles, products, fmtCurrency, onReload }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
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
  const getProductName = (productId: string | null) => (productId && productMap.get(productId)) || "Transação Interna";

  const methodLabel = (m: string | null) =>
    m === "pix" ? "PIX" : m === "credit_card" ? "Cartão" : m === "boleto" ? "Boleto" : (m || "—");
  const MethodIcon = ({ m }: { m: string | null }) => {
    if (m === "pix") return <Smartphone className="h-3 w-3 text-emerald-500" />;
    if (m === "credit_card") return <CreditCard className="h-3 w-3 text-sky-500" />;
    if (m === "boleto") return <FileText className="h-3 w-3 text-amber-500" />;
    return <span className="h-3 w-3 inline-block" />;
  };

  const sellerOptions = useMemo(() => {
    const s = new Map<string, string>();
    for (const t of transactions) if (!s.has(t.user_id)) s.set(t.user_id, getSellerName(t.user_id));
    return Array.from(s.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, profileNameMap]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const result = transactions.filter(t => {
      if (statusFilter !== "all") {
        if (statusFilter === "completed" && !(t.status === "completed" || t.status === "approved")) return false;
        if (statusFilter !== "completed" && t.status !== statusFilter) return false;
      }
      if (methodFilter !== "all" && t.payment_method !== methodFilter) return false;
      if (sellerFilter !== "all" && t.user_id !== sellerFilter) return false;
      if (!search) return true;
      return (
        t.customer_name?.toLowerCase().includes(s) ||
        t.customer_email?.toLowerCase().includes(s) ||
        t.customer_document?.toLowerCase().includes(s) ||
        t.id.includes(s) ||
        (t.external_id || "").toLowerCase().includes(s) ||
        getSellerName(t.user_id).toLowerCase().includes(s)
      );
    });
    result.sort((a, b) => {
      if (sortField === "date") return sortAsc ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortAsc ? Number(a.amount) - Number(b.amount) : Number(b.amount) - Number(a.amount);
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, search, statusFilter, methodFilter, sellerFilter, sortField, sortAsc]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const loadMore = useCallback(() => setVisibleCount(c => c + PAGE_SIZE), []);

  const kpis = useMemo(() => {
    const todayStr = new Date().toDateString();
    let completed = 0, pending = 0, failed = 0, chargebacks = 0, refunded = 0, todayN = 0, todayV = 0;
    let totalGross = 0, totalFees = 0, totalNet = 0, retained = 0, simulated = 0, discountTotal = 0;
    for (const t of transactions) {
      if (t.status === "completed" || t.status === "approved") { completed++; totalGross += Number(t.amount); totalFees += Number(t.fee_amount); totalNet += Number(t.net_amount); }
      else if (t.status === "pending") pending++;
      else if (t.status === "failed" || t.status === "expired") failed++;
      else if (t.status === "chargeback") chargebacks++;
      else if (t.status === "refunded") refunded++;
      if (t.is_simulated) simulated++;
      if (t.retained_amount && Number(t.retained_amount) > 0 && !t.retention_released) retained += Number(t.retained_amount);
      if (t.discount_amount) discountTotal += Number(t.discount_amount);
      if (new Date(t.created_at).toDateString() === todayStr) {
        todayN++;
        if (t.status === "completed" || t.status === "approved") todayV += Number(t.amount);
      }
    }
    const approvalRate = transactions.length ? (completed / transactions.length) * 100 : 0;
    const cbRate = (completed + chargebacks) ? (chargebacks / (completed + chargebacks)) * 100 : 0;
    return { completed, pending, failed, chargebacks, refunded, todayN, todayV, totalGross, totalFees, totalNet, approvalRate, cbRate, retained, simulated, discountTotal };
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
    if (t.payment_method === "pix" && t.pix_expires_at) events.push({ time: t.pix_expires_at, label: "Expiração PIX agendada", tone: "neutral" });
    if (t.status === "pending") events.push({ time: t.updated_at || t.created_at, label: "Aguardando pagamento", tone: "warning" });
    if (t.status === "completed" || t.status === "approved") events.push({ time: t.updated_at || t.created_at, label: "Pagamento aprovado", tone: "success" });
    if (t.status === "failed") events.push({ time: t.updated_at || t.created_at, label: "Pagamento recusado", tone: "danger" });
    if (t.status === "expired") events.push({ time: t.updated_at || t.created_at, label: "Transação expirada", tone: "neutral" });
    if (t.status === "refunded") events.push({ time: t.updated_at || t.created_at, label: "Estorno processado", tone: "warning" });
    if (t.status === "chargeback") events.push({ time: t.updated_at || t.created_at, label: "Chargeback recebido", tone: "danger" });
    if (t.retained_amount && Number(t.retained_amount) > 0) {
      events.push({ time: t.updated_at || t.created_at, label: `Retenção ${t.retention_released ? "liberada" : "ativa"} · ${fmtCurrency(Number(t.retained_amount))}`, tone: t.retention_released ? "success" : "warning" });
    }
    return events;
  };

  const exportCsv = () => {
    const headers = ["id", "external_id", "data", "cliente", "email", "documento", "vendedor", "produto", "metodo", "bruto", "desconto", "taxa", "liquido", "status", "simulada", "source"];
    const rows = filtered.map(t => [
      t.id, t.external_id || "", t.created_at, t.customer_name || "", t.customer_email || "", t.customer_document || "",
      getSellerName(t.user_id), getProductName(t.product_id),
      methodLabel(t.payment_method), Number(t.amount), Number(t.discount_amount || 0), Number(t.fee_amount), Number(t.net_amount), t.status,
      t.is_simulated ? "sim" : "nao", t.source || "",
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

  const statusPills: { value: StatusKey; label: string }[] = [
    { value: "all", label: `Tudo · ${transactions.length}` },
    { value: "completed", label: `Aprovadas · ${kpis.completed}` },
    { value: "pending", label: `Pendentes · ${kpis.pending}` },
    { value: "failed", label: `Recusadas · ${kpis.failed}` },
    { value: "refunded", label: `Estornadas · ${kpis.refunded}` },
    { value: "chargeback", label: `Chargebacks · ${kpis.chargebacks}` },
  ];
  const activeFilters = (statusFilter !== "all" ? 1 : 0) + (methodFilter !== "all" ? 1 : 0) + (sellerFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Hero */}
      <FinanceiroHero
        eyebrow="Operações · Pagamentos"
        title="Transações"
        subtitle="Console operacional — aprovações, chargebacks, retenções e compliance em tempo real."
        status={{
          tone: kpis.cbRate >= 1 ? "destructive" : kpis.chargebacks > 0 ? "warning" : "success",
          label: kpis.cbRate >= 1 ? `CB ${kpis.cbRate.toFixed(2)}% (acima do limite)` : kpis.chargebacks > 0 ? `${kpis.chargebacks} chargebacks` : "Operação saudável",
          pulse: kpis.cbRate >= 1,
        }}
        actions={
          <Button size="sm" variant="outline" className="h-9 text-[11px] gap-1.5 rounded-lg" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        }
      />

      {/* KPIs */}
      <PremiumMetricGrid cols={6}>
        <PremiumMetric icon={DollarSign} label="Volume bruto" value={fmtCurrency(kpis.totalGross)} sub={`${kpis.completed} aprovadas`} tone="info" />
        <PremiumMetric icon={CheckCircle2} label="Líquido" value={fmtCurrency(kpis.totalNet)} sub={`Taxas ${fmtCurrency(kpis.totalFees)}`} tone="success" />
        <PremiumMetric icon={ArrowUpDown} label="Aprovação" value={`${kpis.approvalRate.toFixed(1)}%`} sub={`${transactions.length} total`} tone="primary" />
        <PremiumMetric icon={CreditCard} label="Hoje" value={fmtCurrency(kpis.todayV)} sub={`${kpis.todayN} transações`} tone="info" />
        <PremiumMetric icon={Clock} label="Pendentes" value={kpis.pending.toLocaleString("pt-BR")} sub={`Retido ${fmtCurrency(kpis.retained)}`} tone="warning" />
        <PremiumMetric icon={ShieldAlert} label="Chargeback" value={`${kpis.cbRate.toFixed(2)}%`} sub={`${kpis.chargebacks} CB · ${kpis.refunded} estornos`} tone={kpis.cbRate >= 1 ? "destructive" : "neutral"} />
      </PremiumMetricGrid>

      {/* Compliance strip */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-info/20 bg-info/10 px-2.5 py-1 font-bold uppercase tracking-wider text-info">
          <ShieldCheck className="h-3 w-3" /> Compliance · BACEN/PCI
        </span>
        {kpis.simulated > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 font-bold uppercase tracking-wider text-warning">
            <Beaker className="h-3 w-3" /> {kpis.simulated} simuladas
          </span>
        )}
        {kpis.retained > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 font-bold uppercase tracking-wider text-amber-500">
            <Timer className="h-3 w-3" /> Retido {fmtCurrency(kpis.retained)}
          </span>
        )}
        {kpis.discountTotal > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 font-bold uppercase tracking-wider text-muted-foreground">
            <Tag className="h-3 w-3" /> Cupons {fmtCurrency(kpis.discountTotal)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-2.5 py-1 font-bold uppercase tracking-wider text-muted-foreground">
          Retenção D+30 · LGPD ativa
        </span>
      </div>

      <PremiumPanel
        eyebrow="Ledger"
        title={`Transações · ${filtered.length}`}
        icon={DollarSign}
        action={
          <PremiumSegmented<StatusKey>
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusPills}
          />
        }
      >
        {/* Toolbar */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Buscar cliente, CPF, e-mail, ID, external_id…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
            />
          </div>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-10 w-[140px] rounded-xl text-xs"><SelectValue placeholder="Método" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos métodos</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="credit_card">Cartão</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="h-10 w-[210px] rounded-xl text-xs"><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos vendedores</SelectItem>
              {sellerOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-10 text-xs gap-1.5 rounded-xl"
            onClick={() => { if (sortField === "date") setSortField("amount"); else { setSortField("date"); setSortAsc(!sortAsc); } }}>
            <ArrowUpDown className="h-3 w-3" /> {sortField === "date" ? "Data" : "Valor"} {sortAsc ? "↑" : "↓"}
          </Button>
          {activeFilters > 0 && (
            <Button size="sm" variant="ghost" className="h-10 text-xs gap-1"
              onClick={() => { setStatusFilter("all"); setMethodFilter("all"); setSellerFilter("all"); }}>
              <X className="h-3 w-3" /> Limpar ({activeFilters})
            </Button>
          )}
          <div className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            Mostrando <span className="font-bold text-foreground">{visibleItems.length.toLocaleString("pt-BR")}</span> de <span className="font-bold text-foreground">{filtered.length.toLocaleString("pt-BR")}</span>
          </div>
        </div>

        {/* Table */}
        <div className={premiumTable.wrapper}>
          <table className={premiumTable.table}>
            <thead><tr className={premiumTable.headRow}>
              {["ID", "Cliente", "Vendedor", "Produto", "Método", "Bruto", "Taxa", "Líquido", "Status", "Data", ""].map((h, i) => (
                <th key={h + i} className={cn(premiumTable.th, ["Bruto", "Taxa", "Líquido"].includes(h) && "text-right")}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {visibleItems.map(t => {
                const isCharge = t.status === "chargeback";
                const isRefund = t.status === "refunded";
                const isSim = t.is_simulated;
                return (
                  <tr key={t.id}
                    className={cn(
                      premiumTable.row, "cursor-pointer",
                      isCharge && "bg-destructive/[0.04]",
                      isRefund && "bg-warning/[0.04]",
                      isSim && "bg-info/[0.03]",
                    )}
                    onClick={() => openXRay(t)}>
                    <td className={cn(premiumTable.td, "font-mono text-[10px] text-muted-foreground whitespace-nowrap")}>
                      <div className="flex items-center gap-1">
                        {t.id.slice(0, 8)}
                        {isSim && <Beaker className="h-2.5 w-2.5 text-info" />}
                      </div>
                      {t.external_id && <div className="text-[9px] text-muted-foreground/70 truncate max-w-[100px]">ext: {t.external_id}</div>}
                    </td>
                    <td className={cn(premiumTable.td, "min-w-[160px]")}>
                      <div className="text-xs font-bold text-foreground truncate">{t.customer_name || "—"}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{t.customer_email}</div>
                    </td>
                    <td className={cn(premiumTable.td, "text-xs text-foreground/80 truncate max-w-[160px]")}>{getSellerName(t.user_id)}</td>
                    <td className={cn(premiumTable.td, "text-xs text-muted-foreground truncate max-w-[180px]")}>{getProductName(t.product_id)}</td>
                    <td className={premiumTable.td}>
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/80">
                        <MethodIcon m={t.payment_method} />
                        {methodLabel(t.payment_method)}
                      </span>
                    </td>
                    <td className={cn(premiumTable.td, "text-right tabular-nums text-xs font-semibold text-foreground")}>{fmtCurrency(Number(t.amount))}</td>
                    <td className={cn(premiumTable.td, "text-right tabular-nums text-[11px] text-warning")}>−{fmtCurrency(Number(t.fee_amount))}</td>
                    <td className={cn(premiumTable.td, "text-right tabular-nums text-xs font-bold text-emerald-500")}>{fmtCurrency(Number(t.net_amount))}</td>
                    <td className={premiumTable.td}><StatusBadge status={deriveTransactionStatus(t)} /></td>
                    <td className={cn(premiumTable.td, "text-[10px] text-muted-foreground whitespace-nowrap")}>{fmtDateCached(t.created_at)}</td>
                    <td className={premiumTable.td}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openXRay(t); }}>
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <PremiumEmpty icon={Filter} title="Nenhuma transação encontrada" subtitle="Ajuste os filtros e tente novamente" />
          )}
        </div>
        {visibleCount < filtered.length && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" onClick={loadMore} className="h-8 text-[11px] gap-1.5 rounded-xl">
              <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({(filtered.length - visibleCount).toLocaleString("pt-BR")} restantes)
            </Button>
          </div>
        )}
      </PremiumPanel>

      {/* ── X-Ray Sheet ─────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0 bg-background">
          {selectedTx && (
            <>
              <SheetHeader className="px-5 py-4 border-b border-border bg-muted/30">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Transação</div>
                <SheetTitle className="text-[15px] font-bold text-foreground flex items-center gap-2 flex-wrap">
                  <button onClick={() => copy(selectedTx.id)} className="inline-flex items-center gap-1 font-mono text-xs text-foreground/80 hover:text-foreground">
                    {selectedTx.id.slice(0, 12)}… <Copy className="h-3 w-3" />
                  </button>
                  <StatusBadge status={deriveTransactionStatus(selectedTx)} />
                  {selectedTx.is_simulated && (
                    <span className="inline-flex items-center gap-1 rounded border border-info/20 bg-info/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-info">
                      <Beaker className="h-2.5 w-2.5" /> Simulada
                    </span>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="p-5 space-y-5">
                {/* Financial summary */}
                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
                  <div className="bg-card p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Bruto</div>
                    <div className="mt-1 text-base font-extrabold tabular-nums text-foreground">{fmtCurrency(Number(selectedTx.amount))}</div>
                    {Number(selectedTx.discount_amount || 0) > 0 && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">−{fmtCurrency(Number(selectedTx.discount_amount))} cupom</div>
                    )}
                  </div>
                  <div className="bg-card p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Taxa</div>
                    <div className="mt-1 text-base font-extrabold tabular-nums text-warning">−{fmtCurrency(Number(selectedTx.fee_amount))}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {Number(selectedTx.amount) > 0 ? ((Number(selectedTx.fee_amount) / Number(selectedTx.amount)) * 100).toFixed(2) : "0"}%
                    </div>
                  </div>
                  <div className="bg-card p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Líquido</div>
                    <div className="mt-1 text-base font-extrabold tabular-nums text-emerald-500">{fmtCurrency(Number(selectedTx.net_amount))}</div>
                  </div>
                </div>

                {/* Retention alert */}
                {Number(selectedTx.retained_amount || 0) > 0 && (
                  <div className={cn(
                    "flex items-start gap-2 rounded-xl border p-3 text-xs",
                    selectedTx.retention_released ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" : "border-amber-500/20 bg-amber-500/10 text-amber-500"
                  )}>
                    <Timer className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="font-bold">{selectedTx.retention_released ? "Retenção liberada" : "Retenção ativa"}</p>
                      <p className="text-foreground/70">
                        {fmtCurrency(Number(selectedTx.retained_amount))}
                        {selectedTx.retained_until && ` · até ${fmtDateCached(selectedTx.retained_until)}`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Dossier — Cliente */}
                <PremiumPanel eyebrow="KYC" title="Cliente" icon={User}>
                  <dl className="grid grid-cols-[120px_1fr] gap-x-3 text-xs">
                    <Row icon={<User className="h-3 w-3" />} label="Nome" value={selectedTx.customer_name || "—"} />
                    <Row icon={<Mail className="h-3 w-3" />} label="E-mail" value={selectedTx.customer_email || "—"} />
                    <Row icon={<FileText className="h-3 w-3" />} label="CPF/CNPJ" value={selectedTx.customer_document || "—"} mono />
                    <Row icon={<Smartphone className="h-3 w-3" />} label="Telefone" value={selectedTx.customer_phone || "—"} />
                    <Row icon={<MapPin className="h-3 w-3" />} label="Endereço" value={selectedTx.customer_address || "—"} />
                  </dl>
                </PremiumPanel>

                {/* Dossier — Pagamento */}
                <PremiumPanel eyebrow="Pagamento" title="Detalhes da operação" icon={CreditCard}>
                  <dl className="grid grid-cols-[120px_1fr] gap-x-3 text-xs">
                    <Row icon={<Hash className="h-3 w-3" />} label="ID" value={selectedTx.id} mono />
                    {selectedTx.external_id && <Row icon={<Hash className="h-3 w-3" />} label="External ID" value={selectedTx.external_id} mono />}
                    <Row icon={<CreditCard className="h-3 w-3" />} label="Método" value={methodLabel(selectedTx.payment_method)} />
                    <Row icon={<User className="h-3 w-3" />} label="Vendedor" value={getSellerName(selectedTx.user_id)} />
                    <Row icon={<FileText className="h-3 w-3" />} label="Produto" value={getProductName(selectedTx.product_id)} />
                    <Row icon={<Globe className="h-3 w-3" />} label="Origem" value={selectedTx.source || "checkout"} />
                    {selectedTx.api_key_id && <Row icon={<Key className="h-3 w-3" />} label="API Key" value={selectedTx.api_key_id} mono />}
                    {selectedTx.coupon_id && <Row icon={<Tag className="h-3 w-3" />} label="Cupom" value={`${selectedTx.coupon_id.slice(0, 8)} · −${fmtCurrency(Number(selectedTx.discount_amount || 0))}`} mono />}
                    {selectedTx.podpay_payment_id && <Row icon={<Hash className="h-3 w-3" />} label="PodPay" value={selectedTx.podpay_payment_id} mono />}
                    {selectedTx.podpay_event_id && <Row icon={<Hash className="h-3 w-3" />} label="Evento" value={selectedTx.podpay_event_id} mono />}
                    {selectedTx.checkout_session_id && <Row icon={<Hash className="h-3 w-3" />} label="Checkout" value={selectedTx.checkout_session_id} mono />}
                    {selectedTx.pix_expires_at && (
                      <Row icon={<Timer className="h-3 w-3" />} label="PIX expira" value={fmtDateCached(selectedTx.pix_expires_at)} />
                    )}
                  </dl>
                </PremiumPanel>

                {/* Timeline */}
                <PremiumPanel eyebrow="Auditoria" title="Linha do tempo" icon={Clock}>
                  <ol className="space-y-3">
                    {buildTimeline(selectedTx).map((ev, i, arr) => {
                      const dot = ev.tone === "success" ? "bg-emerald-500" : ev.tone === "danger" ? "bg-destructive" : ev.tone === "warning" ? "bg-warning" : "bg-muted-foreground/40";
                      return (
                        <li key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className={cn("mt-1.5 h-2 w-2 rounded-full", dot)} />
                            {i < arr.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                          </div>
                          <div className="pb-1">
                            <div className="text-xs font-bold text-foreground">{ev.label}</div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">{_fullDateFmt.format(new Date(ev.time))}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </PremiumPanel>

                {/* Raw */}
                <Accordion type="single" collapsible>
                  <AccordionItem value="raw" className="rounded-xl border border-border bg-card px-3">
                    <AccordionTrigger className="py-2.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground hover:no-underline">
                      <span className="flex items-center gap-1.5"><Code2 className="h-3.5 w-3.5" /> Raw data + metadata</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/30 p-3 font-mono text-[10px] text-foreground/80">
{JSON.stringify({
  transaction_id: selectedTx.id,
  external_id: selectedTx.external_id,
  podpay_payment_id: selectedTx.podpay_payment_id,
  podpay_event_id: selectedTx.podpay_event_id,
  checkout_session_id: selectedTx.checkout_session_id,
  api_key_id: selectedTx.api_key_id,
  source: selectedTx.source,
  status: selectedTx.status,
  is_simulated: selectedTx.is_simulated,
  payment_method: selectedTx.payment_method,
  amount: Number(selectedTx.amount),
  discount_amount: Number(selectedTx.discount_amount || 0),
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
    address: selectedTx.customer_address,
  },
  product_id: selectedTx.product_id,
  user_id: selectedTx.user_id,
  coupon_id: selectedTx.coupon_id,
  pix_expires_at: selectedTx.pix_expires_at,
  metadata: selectedTx.metadata,
  created_at: selectedTx.created_at,
  updated_at: selectedTx.updated_at,
}, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                  {(selectedTx.status === "completed" || selectedTx.status === "approved") && (
                    <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-[11px] rounded-xl" onClick={openRefund}>
                      <RotateCcw className="h-3.5 w-3.5" /> Estornar pagamento
                    </Button>
                  )}
                  {selectedTx.status === "chargeback" && (
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px] rounded-xl border-amber-500/40 text-amber-500 hover:bg-amber-500/10" onClick={() => setDisputeOpen(true)}>
                      <Upload className="h-3.5 w-3.5" /> Upload comprovante (disputa)
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px] rounded-xl ml-auto" onClick={() => copy(selectedTx.id)}>
                    <Copy className="h-3.5 w-3.5" /> Copiar ID
                  </Button>
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
            <DialogTitle className="flex items-center gap-2 text-destructive text-sm">
              <RotateCcw className="h-4 w-4" /> Estornar pagamento
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-[11px] space-y-1">
                <p><span className="text-muted-foreground">Transação:</span> <span className="font-mono text-foreground/80">{selectedTx.id.slice(0, 12)}…</span></p>
                <p><span className="text-muted-foreground">Valor original:</span> <span className="font-bold text-foreground tabular-nums">{fmtCurrency(Number(selectedTx.amount))}</span></p>
                <p><span className="text-muted-foreground">Vendedor:</span> <span className="text-foreground/80">{getSellerName(selectedTx.user_id)}</span></p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={refundType === "full" ? "default" : "outline"} className="flex-1 h-8 text-[11px] rounded-xl"
                  onClick={() => { setRefundType("full"); setRefundAmount(String(Number(selectedTx.amount))); }}>
                  Estorno total
                </Button>
                <Button size="sm" variant={refundType === "partial" ? "default" : "outline"} className="flex-1 h-8 text-[11px] rounded-xl"
                  onClick={() => setRefundType("partial")}>
                  Estorno parcial
                </Button>
              </div>
              {refundType === "partial" && (
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Valor (R$)</label>
                  <Input type="number" step="0.01" min="0.01" max={Number(selectedTx.amount)} value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value)} className="mt-1 h-8 text-xs" placeholder="0,00" />
                </div>
              )}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Justificativa (audit trail)</label>
                <Textarea value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  placeholder="Ex.: Cliente solicitou reembolso por insatisfação…"
                  className="mt-1 text-xs" rows={3} />
                <p className="mt-1 text-[10px] text-muted-foreground">Mín. 5 caracteres · registrado permanentemente.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" className="h-8 text-[11px]" onClick={() => setRefundOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="h-8 text-[11px] gap-1.5 rounded-xl" onClick={handleRefund} disabled={refunding}>
              {refunding ? "Processando…" : "Confirmar estorno"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dispute Upload ─────────────────────────────────── */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500 text-sm">
              <Upload className="h-4 w-4" /> Comprovante para disputa
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Anexe a evidência (entrega, contrato, log) para contestar o chargeback da transação{" "}
                <span className="font-mono text-foreground/80">{selectedTx.id.slice(0, 12)}</span>.
              </p>
              <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center">
                <Upload className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">Arraste ou clique para enviar (PDF, JPG, PNG · máx. 10MB)</p>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="mx-auto mt-3 block text-[11px]"
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
      <dt className="flex items-center gap-1.5 border-b border-border/40 py-1.5 text-[11px] text-muted-foreground">
        <span className="text-muted-foreground/60">{icon}</span> {label}
      </dt>
      <dd className={cn("truncate border-b border-border/40 py-1.5 text-xs text-foreground", mono && "font-mono text-[11px]")}>{value}</dd>
    </>
  );
}
