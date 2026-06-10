import { useState, useMemo, useCallback } from "react";
import {
 Search, Download, Filter, ArrowUpDown, CreditCard, Smartphone, FileText,
 ChevronDown, Eye, RotateCcw, Upload, Clock, CheckCircle2, XCircle,
 AlertTriangle, ShieldAlert, Code2, DollarSign, User, Mail, Hash,
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
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle } from "./AdminOverviewTab";
import { FinanceiroHero, FinanceiroKpi, FinanceiroKpiGrid } from "@/components/financeiro/FinanceiroHero";
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

export default function AdminTransactionsTab({ transactions, profiles, products, fmtCurrency, onReload }: Props) {
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [methodFilter, setMethodFilter] = useState("all");
 const [sellerFilter, setSellerFilter] = useState("all");
 const [sortField, setSortField] = useState<"date" | "amount">("date");
 const [sortAsc, setSortAsc] = useState(false);
 const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

 // X-Ray Sheet
 const [selectedTx, setSelectedTx] = useState<Tables<"transactions"> | null>(null);
 const [sheetOpen, setSheetOpen] = useState(false);

 // Refund Dialog
 const [refundOpen, setRefundOpen] = useState(false);
 const [refundType, setRefundType] = useState<"full" | "partial">("full");
 const [refundAmount, setRefundAmount] = useState("");
 const [refundReason, setRefundReason] = useState("");
 const [refunding, setRefunding] = useState(false);

 // Dispute upload
 const [disputeOpen, setDisputeOpen] = useState(false);

 // Pre-index profiles and products
 const profileMap = useMemo(() => {
 const m = new Map<string, Tables<"profiles">>();
 for (const p of profiles) m.set(p.user_id, p);
 return m;
 }, [profiles]);

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

 const methodIcon = (m: string | null) => {
 if (m === "pix") return <Smartphone className="h-3 w-3 text-primary" />;
 if (m === "credit_card") return <CreditCard className="h-3 w-3 text-info" />;
 if (m === "boleto") return <FileText className="h-3 w-3 text-warning" />;
 return null;
 };

 const methodLabel = (m: string | null) => {
 if (m === "pix") return "PIX";
 if (m === "credit_card") return "Cartão";
 if (m === "boleto") return "Boleto";
 return m || "—";
 };

 // Unique sellers for filter
 const sellerOptions = useMemo(() => {
 const s = new Map<string, string>();
 for (const t of transactions) {
 if (!s.has(t.user_id)) s.set(t.user_id, getSellerName(t.user_id));
 }
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

 // KPIs
 const kpis = useMemo(() => {
 const todayStr = new Date().toDateString();
 let completed = 0, pending = 0, failed = 0, chargebacks = 0, refunded = 0, todayN = 0, todayV = 0, totalGross = 0, totalFees = 0;
 for (const t of transactions) {
 if (t.status === "completed" || t.status === "approved") { completed++; totalGross += Number(t.amount); totalFees += Number(t.fee_amount); }
 else if (t.status === "pending") pending++;
 else if (t.status === "failed" || t.status === "expired") failed++;
 else if (t.status === "chargeback") chargebacks++;
 else if (t.status === "refunded") refunded++;
 if (new Date(t.created_at).toDateString() === todayStr) {
 todayN++;
 if (t.status === "completed" || t.status === "approved") todayV += Number(t.amount);
 }
 }
 return { completed, pending, failed, chargebacks, refunded, todayN, todayV, totalGross, totalFees };
 }, [transactions]);

 // Open X-Ray
 const openXRay = (t: Tables<"transactions">) => {
 setSelectedTx(t);
 setSheetOpen(true);
 };

 // Refund logic
 const openRefund = () => {
 if (!selectedTx) return;
 setRefundType("full");
 setRefundAmount(String(Number(selectedTx.amount)));
 setRefundReason("");
 setRefundOpen(true);
 };

 const handleRefund = async () => {
 if (!selectedTx) return;
 if (!refundReason.trim()) { toast.error("Justificativa obrigatória"); return; }
 if (refundReason.trim().length < 5) { toast.error("Justificativa muito curta (mín. 5 caracteres)"); return; }
 const amount = refundType === "full" ? Number(selectedTx.amount) : Number(refundAmount);
 if (isNaN(amount) || amount <= 0 || amount > Number(selectedTx.amount)) { toast.error("Valor inválido"); return; }

 // Only allow refund on completed transactions
 if (selectedTx.status !== "completed" && selectedTx.status !== "approved") {
 toast.error("Só é possível estornar transações aprovadas");
 return;
 }

 // Confirmation dialog for safety
 if (!window.confirm(`Confirma estorno de R$ ${amount.toFixed(2)}?`)) return;

 setRefunding(true);
 try {
 const sanitizedReason = refundReason.replace(/[<>]/g, "").trim().slice(0, 500);
 const { data, error } = await supabase.functions.invoke("podpay-refund", {
 body: { transactionId: selectedTx.id, amount, reason: sanitizedReason },
 });
 if (error || !data?.success) {
 toast.error(data?.error || "Erro ao processar estorno");
 return;
 }
 toast.success(`Estorno de ${fmtCurrency(amount)} processado!`);
 await logAdminAction("refund_transaction", "transaction", selectedTx.id, {
 amount, type: refundType, reason: sanitizedReason,
 });
 setRefundOpen(false);
 setSheetOpen(false);
 onReload();
 } catch {
 toast.error("Erro de conexão");
 } finally {
 setRefunding(false);
 }
 };

 // Timeline events
 const buildTimeline = (t: Tables<"transactions">) => {
 const events: { time: string; label: string; icon: React.ReactNode; color: string }[] = [];
 events.push({ time: t.created_at, label: "Transação criada", icon: <Clock className="h-3 w-3" />, color: "text-muted-foreground" });
 if (t.status === "pending") {
 events.push({ time: t.updated_at || t.created_at, label: "Aguardando pagamento", icon: <Clock className="h-3 w-3" />, color: "text-warning" });
 }
 if (t.status === "completed" || t.status === "approved") {
 events.push({ time: t.updated_at || t.created_at, label: "Pagamento aprovado", icon: <CheckCircle2 className="h-3 w-3" />, color: "text-primary" });
 }
 if (t.status === "failed") {
 events.push({ time: t.updated_at || t.created_at, label: "Pagamento recusado", icon: <XCircle className="h-3 w-3" />, color: "text-destructive" });
 }
 if (t.status === "expired") {
 events.push({ time: t.updated_at || t.created_at, label: "Transação expirada", icon: <XCircle className="h-3 w-3" />, color: "text-muted-foreground" });
 }
 if (t.status === "refunded") {
 events.push({ time: t.updated_at || t.created_at, label: "Estorno processado", icon: <RotateCcw className="h-3 w-3" />, color: "text-warning" });
 }
 if (t.status === "chargeback") {
 events.push({ time: t.updated_at || t.created_at, label: "Chargeback recebido", icon: <ShieldAlert className="h-3 w-3" />, color: "text-destructive" });
 }
 return events;
 };

 const statusColor = (s: string) => {
 if (s === "completed" || s === "approved") return "text-primary";
 if (s === "pending") return "text-warning";
 if (s === "failed" || s === "expired") return "text-destructive";
 if (s === "chargeback") return "text-destructive";
 if (s === "refunded") return "text-warning";
 return "text-muted-foreground";
 };

 return (
 <div className="space-y-5 animate-fade-in">
 {/* Hero */}
 <FinanceiroHero
   eyebrow="Operações · Transações"
   title="Radar de Transações"
   subtitle="Monitore aprovações, chargebacks e volume em tempo real."
   status={{ tone: kpis.chargebacks > 0 ? "destructive" : "success", label: kpis.chargebacks > 0 ? `${kpis.chargebacks} chargebacks` : "Operação saudável", pulse: kpis.chargebacks > 0 }}
 />

 {/* KPIs */}
 <FinanceiroKpiGrid cols={5}>
   <FinanceiroKpi icon={CreditCard} label="Total Transações" value={String(transactions.length)} sub="Todas" tone="neutral" />
   <FinanceiroKpi icon={CheckCircle2} label="Aprovadas" value={String(kpis.completed)} sub={`${((kpis.completed / Math.max(transactions.length, 1)) * 100).toFixed(1)}% taxa`} tone="success" />
   <FinanceiroKpi icon={Clock} label="Pendentes" value={String(kpis.pending)} sub="Aguardando" tone="warning" />
   <FinanceiroKpi icon={ShieldAlert} label="Chargebacks" value={String(kpis.chargebacks)} sub={`${kpis.refunded} estornos`} tone="destructive" />
   <FinanceiroKpi icon={DollarSign} label="Volume Hoje" value={fmtCurrency(kpis.todayV)} sub={`${kpis.todayN} transações`} tone="primary" />
 </FinanceiroKpiGrid>

 {/* Filters */}
 <div className="flex flex-wrap items-center gap-3">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <input placeholder="Buscar por cliente, vendedor, ID, e-mail..." value={search} onChange={e => setSearch(e.target.value)}
 className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
 </div>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-[150px] h-10 text-xs rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos status</SelectItem>
 <SelectItem value="completed">Aprovada</SelectItem>
 <SelectItem value="pending">Pendente</SelectItem>
 <SelectItem value="failed">Recusada</SelectItem>
 <SelectItem value="expired">Expirada</SelectItem>
 <SelectItem value="refunded">Estornada</SelectItem>
 <SelectItem value="chargeback">Chargeback</SelectItem>
 </SelectContent>
 </Select>
 <Select value={methodFilter} onValueChange={setMethodFilter}>
 <SelectTrigger className="w-[130px] h-10 text-xs rounded-xl"><SelectValue placeholder="Método" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos métodos</SelectItem>
 <SelectItem value="pix">PIX</SelectItem>
 <SelectItem value="credit_card">Cartão</SelectItem>
 <SelectItem value="boleto">Boleto</SelectItem>
 </SelectContent>
 </Select>
 <Select value={sellerFilter} onValueChange={setSellerFilter}>
 <SelectTrigger className="w-[180px] h-10 text-xs rounded-xl"><SelectValue placeholder="Seller" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos sellers</SelectItem>
 {sellerOptions.map(([id, name]) => (
 <SelectItem key={id} value={id}>{name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
  <Button size="sm" variant="ghost" className="h-10 text-[11px] text-muted-foreground hover:text-foreground gap-1.5"
  onClick={() => {
    if (sortField === "date") setSortField("amount");
    else { setSortField("date"); setSortAsc(!sortAsc); }
  }}>
  <ArrowUpDown className="h-3.5 w-3.5" /> {sortField === "date" ? "Data" : "Valor"}
  </Button>
 </div>

 {/* Table */}
 <AdminPanel>
 <PanelTitle color="blue" icon={<CreditCard className="h-4 w-4" />}>Radar de Transações ({filtered.length})</PanelTitle>
 <div className="overflow-x-auto mt-4">
 <table className="w-full text-sm">
 <thead><tr className="border-b border-border">
 {["ID", "Cliente", "Vendedor", "Produto", "Método", "Bruto", "Taxa", "Líquido", "Status", "Data", ""].map(h => (
 <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
 ))}
 </tr></thead>
 <tbody>
 {visibleItems.map(t => {
 const isChargeback = t.status === "chargeback";
 const isRefunded = t.status === "refunded";
 return (
 <tr key={t.id} className={cn(
 "border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer",
 isChargeback && "bg-destructive/[0.04] ring-1 ring-destructive/20",
 isRefunded && "bg-warning/[0.04]",
 )} onClick={() => openXRay(t)}>
 <td className="p-3 font-mono text-[10px] text-muted-foreground">{t.id.slice(0, 8)}</td>
 <td className="p-3">
 <div>
 <p className="text-xs font-medium text-foreground">{t.customer_name || "—"}</p>
 <p className="text-[10px] text-muted-foreground">{t.customer_email}</p>
 </div>
 </td>
 <td className="p-3 text-xs text-muted-foreground">{getSellerName(t.user_id)}</td>
 <td className="p-3 text-xs text-muted-foreground max-w-[120px] truncate">{getProductName(t.product_id)}</td>
 <td className="p-3">
 <div className="flex items-center gap-1.5">
 {methodIcon(t.payment_method)}
 <span className="text-[10px] text-muted-foreground uppercase">{methodLabel(t.payment_method)}</span>
 </div>
 </td>
 <td className="p-3 text-xs font-bold text-foreground">{fmtCurrency(Number(t.amount))}</td>
 <td className="p-3 text-xs text-warning">{fmtCurrency(Number(t.fee_amount))}</td>
 <td className="p-3 text-xs text-primary font-bold">{fmtCurrency(Number(t.net_amount))}</td>
 <td className="p-3"><StatusBadge status={t.status} /></td>
 <td className="p-3 text-[10px] text-muted-foreground">{fmtDateCached(t.created_at)}</td>
 <td className="p-3">
 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openXRay(t); }}>
 <Eye className="h-3.5 w-3.5 text-muted-foreground" />
 </Button>
 </td>
 </tr>
 );
 })}
 {filtered.length === 0 && (
 <tr><td colSpan={11} className="p-10 text-center text-muted-foreground text-xs">Nenhuma transação encontrada</td></tr>
 )}
 </tbody>
 </table>
 {visibleCount < filtered.length && (
 <div className="p-4 text-center">
 <Button variant="ghost" size="sm" onClick={loadMore} className="gap-2 text-xs text-muted-foreground hover:text-foreground">
 <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
 </Button>
 </div>
 )}
 </div>
 </AdminPanel>

 {/* ═══ X-RAY SHEET ═══ */}
 <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
 <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
 {selectedTx && (
 <>
 <SheetHeader>
 <SheetTitle className="flex items-center gap-2 text-lg">
 <Eye className="h-5 w-5 text-primary" />
 Raio-X da Transação
 </SheetTitle>
 </SheetHeader>

 <div className="mt-6 space-y-6">
 {/* Status banner */}
 <div className={cn(
 "rounded-xl border p-4 flex items-center justify-between",
 selectedTx.status === "chargeback" ? "border-destructive/30 bg-destructive/[0.06]" :
 selectedTx.status === "completed" ? "border-primary/30 bg-primary/[0.06]" :
 "border-border bg-muted/30"
 )}>
 <div>
 <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Status</p>
 <p className={cn("text-lg font-black uppercase", statusColor(selectedTx.status))}>{selectedTx.status}</p>
 </div>
 <StatusBadge status={selectedTx.status} />
 </div>

 {/* Financial details */}
 <div className="grid grid-cols-3 gap-3">
 <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
 <p className="text-[10px] text-muted-foreground font-semibold uppercase">Bruto</p>
 <p className="text-sm font-black text-foreground">{fmtCurrency(Number(selectedTx.amount))}</p>
 </div>
 <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
 <p className="text-[10px] text-muted-foreground font-semibold uppercase">Taxa</p>
 <p className="text-sm font-black text-warning">{fmtCurrency(Number(selectedTx.fee_amount))}</p>
 </div>
 <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
 <p className="text-[10px] text-muted-foreground font-semibold uppercase">Líquido</p>
 <p className="text-sm font-black text-primary">{fmtCurrency(Number(selectedTx.net_amount))}</p>
 </div>
 </div>

 {/* Info grid */}
 <div className="space-y-2">
 <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="ID" value={selectedTx.id} mono />
 <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Cliente" value={selectedTx.customer_name || "—"} />
 <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={selectedTx.customer_email || "—"} />
 <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label="Documento" value={selectedTx.customer_document || "—"} />
 <InfoRow icon={<Smartphone className="h-3.5 w-3.5" />} label="Telefone" value={selectedTx.customer_phone || "—"} />
 <InfoRow icon={<CreditCard className="h-3.5 w-3.5" />} label="Método" value={methodLabel(selectedTx.payment_method)} />
 <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Vendedor" value={getSellerName(selectedTx.user_id)} />
 <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label="Produto" value={getProductName(selectedTx.product_id)} />
 {selectedTx.podpay_payment_id && (
 <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="PodPay ID" value={selectedTx.podpay_payment_id} mono />
 )}
 {selectedTx.retained_amount > 0 && (
 <InfoRow icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Retido" value={`${fmtCurrency(selectedTx.retained_amount)} até ${selectedTx.retained_until ? fmtDateCached(selectedTx.retained_until) : "—"}`} />
 )}
 </div>

 {/* Timeline */}
 <div>
 <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
 <Clock className="h-3.5 w-3.5 text-primary" /> Linha do Tempo
 </h4>
 <div className="space-y-0 ml-2 border-l-2 border-border pl-4">
 {buildTimeline(selectedTx).map((ev, i) => (
 <div key={i} className="pb-3 relative">
 <div className={cn("absolute -left-[21px] top-0.5 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center", ev.color === "text-primary" ? "bg-primary" : ev.color === "text-destructive" ? "bg-destructive" : ev.color === "text-warning" ? "bg-warning" : "bg-muted-foreground")} />
 <p className="text-xs font-medium text-foreground">{ev.label}</p>
 <p className="text-[10px] text-muted-foreground">{_fullDateFmt.format(new Date(ev.time))}</p>
 </div>
 ))}
 </div>
 </div>

 {/* Raw Data Accordion */}
 <Accordion type="single" collapsible>
 <AccordionItem value="raw-data" className="border border-border rounded-xl px-3">
 <AccordionTrigger className="text-xs font-bold gap-2 hover:no-underline">
 <span className="flex items-center gap-1.5"><Code2 className="h-3.5 w-3.5 text-muted-foreground" /> Ver Raw Data (Logs)</span>
 </AccordionTrigger>
 <AccordionContent>
 <pre className="text-[10px] bg-muted/50 border border-border rounded-lg p-3 overflow-auto max-h-[300px] text-muted-foreground font-mono whitespace-pre-wrap">
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

 {/* Action Buttons */}
 <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
 {(selectedTx.status === "completed" || selectedTx.status === "approved") && (
 <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={openRefund}>
 <RotateCcw className="h-3.5 w-3.5" /> Estornar Pagamento
 </Button>
 )}
 {selectedTx.status === "chargeback" && (
 <Button variant="outline" size="sm" className="gap-1.5 text-xs border-warning/30 text-warning hover:bg-warning/10" onClick={() => setDisputeOpen(true)}>
 <Upload className="h-3.5 w-3.5" /> Upload Comprovante (Disputa)
 </Button>
 )}
 </div>
 </div>
 </>
 )}
 </SheetContent>
 </Sheet>

 {/* ═══ REFUND DIALOG ═══ */}
 <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-destructive">
 <RotateCcw className="h-5 w-5" /> Estornar Pagamento
 </DialogTitle>
 </DialogHeader>
 {selectedTx && (
 <div className="space-y-4">
 <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1">
 <p><span className="text-muted-foreground">Transação:</span> <span className="font-mono">{selectedTx.id.slice(0, 12)}...</span></p>
 <p><span className="text-muted-foreground">Valor original:</span> <span className="font-bold">{fmtCurrency(Number(selectedTx.amount))}</span></p>
 <p><span className="text-muted-foreground">Vendedor:</span> {getSellerName(selectedTx.user_id)}</p>
 </div>

 <div className="flex gap-2">
 <Button size="sm" variant={refundType === "full" ? "default" : "outline"} className="flex-1 text-xs" onClick={() => { setRefundType("full"); setRefundAmount(String(Number(selectedTx.amount))); }}>
 Estorno Total
 </Button>
 <Button size="sm" variant={refundType === "partial" ? "default" : "outline"} className="flex-1 text-xs" onClick={() => setRefundType("partial")}>
 Estorno Parcial
 </Button>
 </div>

 {refundType === "partial" && (
 <div>
 <label className="text-xs font-medium text-muted-foreground">Valor do estorno (R$)</label>
 <Input type="number" step="0.01" min="0.01" max={Number(selectedTx.amount)}
 value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
 className="mt-1" placeholder="0.00" />
 </div>
 )}

 <div>
 <label className="text-xs font-medium text-muted-foreground">Justificativa (obrigatório para Audit Trail)</label>
 <Textarea value={refundReason} onChange={e => setRefundReason(e.target.value)}
 placeholder="Ex: Cliente solicitou reembolso por insatisfação..." className="mt-1 text-xs" rows={3} />
 </div>
 </div>
 )}
 <DialogFooter>
 <Button variant="ghost" size="sm" onClick={() => setRefundOpen(false)}>Cancelar</Button>
 <Button variant="destructive" size="sm" onClick={handleRefund} disabled={refunding} className="gap-1.5">
 {refunding ? "Processando..." : "Confirmar Estorno"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* ═══ DISPUTE UPLOAD DIALOG ═══ */}
 <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-warning">
 <Upload className="h-5 w-5" /> Upload de Comprovante para Disputa
 </DialogTitle>
 </DialogHeader>
 {selectedTx && (
 <div className="space-y-4">
 <p className="text-xs text-muted-foreground">
 Envie o comprovante de entrega ou evidência para contestar o chargeback da transação <span className="font-mono">{selectedTx.id.slice(0, 12)}</span>.
 </p>
 <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
 <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
 <p className="text-xs text-muted-foreground">Arraste ou clique para enviar</p>
 <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="mt-2 text-xs"
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

/* ── Helper component ── */
function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
 return (
 <div className="flex items-center gap-2 text-xs py-1.5 border-b border-border/30">
 <span className="text-muted-foreground">{icon}</span>
 <span className="text-muted-foreground w-20 shrink-0 font-medium">{label}</span>
 <span className={cn("text-foreground truncate", mono && "font-mono text-[11px]")}>{value}</span>
 </div>
 );
}
