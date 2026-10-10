import { useState, useMemo, useEffect } from "react";
import { useProducts, useDashboardStats, useTransactionsPage, fetchTransactionsForExport } from "@/hooks/useQueryData";
import {
  Search, EyeOff, Eye, Check, Download, FileText,
  CreditCard, ShoppingCart, Zap, History, BarChart3, TrendingUp, Wallet,
  CalendarIcon, ChevronLeft, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { SellerRefundDialog } from "@/components/transactions/SellerRefundDialog";
import { PixLogoMark } from "@/components/icons/PixLogoMark";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { cn, deriveTransactionStatus, formatCurrency } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { HDShell, HDHeader, HDStat, HDStatGrid } from "@/components/hd/HDPage";
import { PeriodPicker, buildPeriod, periodLabel, type PeriodValue, type PeriodPresetId } from "@/components/PeriodPicker";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterTransactions, spreadsheetSafe, type SalesExportFilters } from "@/lib/sales-export";

const fmt = formatCurrency;

const SP_TZ = "America/Sao_Paulo";
const spDateTime = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: SP_TZ, day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
}).format(new Date(iso));
const spDate = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: SP_TZ, day: "2-digit", month: "2-digit", year: "numeric",
}).format(new Date(iso));
const spShort = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: SP_TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(iso));
const spHour = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: SP_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(iso)) + "h";

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  approved: { label: "Aprovada", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dot: "bg-emerald-500" },
  completed: { label: "Aprovada", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dot: "bg-emerald-500" },
  paid: { label: "Aprovada", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dot: "bg-emerald-500" },
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20", dot: "bg-amber-500" },
  processing: { label: "Pendente", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20", dot: "bg-amber-500" },
  expired: { label: "Expirada", cls: "bg-muted text-muted-foreground border-border/60", dot: "bg-muted-foreground/50" },
  refunded: { label: "Reembolso", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20", dot: "bg-blue-500" },
  partially_refunded: { label: "Reembolso", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20", dot: "bg-blue-500" },
  chargeback: { label: "Chargeback", cls: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
  med: { label: "MED PIX · em análise", cls: "bg-orange-500/10 text-orange-500 border-orange-500/20", dot: "bg-orange-500" },
  med_lost: { label: "MED perdido", cls: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
  error: { label: "Erro", cls: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
  failed: { label: "Erro", cls: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
  cancelled: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border/60", dot: "bg-muted-foreground/50" },
  canceled: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border/60", dot: "bg-muted-foreground/50" },
};

const METHODS_MAP: Record<string, { label: string; icon: LucideIcon }> = {
  pix: { label: "Pix", icon: Zap },
  credit_card: { label: "Cartão", icon: CreditCard },
  card: { label: "Cartão", icon: CreditCard },
  boleto: { label: "Boleto", icon: FileText },
};

const PAGE_SIZE = 25;

type PresetId = "today" | "7d" | "15d" | "30d" | "custom";

const buildPreset = (id: PresetId): DateRange => {
  const now = new Date();
  switch (id) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "7d": return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "15d": return { from: startOfDay(subDays(now, 14)), to: endOfDay(now) };
    case "30d": return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    default: return { from: startOfDay(now), to: endOfDay(now) };
  }
};

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "15d", label: "Últimos 15 dias" },
  { id: "30d", label: "Últimos 30 dias" },
  { id: "custom", label: "Personalizado" },
];


export default function Vendas() {
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);
  const [refundTx, setRefundTx] = useState<Tables<"transactions"> | null>(null);
  const [privacyHidden, setPrivacyHidden] = useState(() => localStorage.getItem("privacy_mode") === "true");
  const [periodValue, setPeriodValue] = useState<PeriodValue>(() => buildPeriod("today"));
  const range = useMemo<DateRange>(() => ({ from: periodValue.from, to: periodValue.to }), [periodValue]);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFilters, setExportFilters] = useState<SalesExportFilters>({ search: "", statuses: [], productId: "", customerName: "", customerEmail: "" });

  // Debounce da busca: cada tecla dispara uma query no servidor.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  // Janela do período — mesma fonte usada pelos agregados do servidor.
  const rangeStart = periodValue.from;
  const rangeEnd = periodValue.to;
  const bucket = useMemo<"hour" | "day" | "month">(() => {
    const span = differenceInDays(rangeEnd, rangeStart) + 1;
    return span <= 1 ? "hour" : span > 60 ? "month" : "day";
  }, [rangeStart, rangeEnd]);

  // Agregados idênticos aos do Dashboard (mesma RPC, mesma janela) — sem cálculo no cliente.
  const { data: dashStats } = useDashboardStats(rangeStart, rangeEnd, bucket);
  const cur = dashStats?.current;

  const {
    data: pageData,
    isLoading: txLoading,
    isError: txError,
    refetch: refetchTx,
  } = useTransactionsPage({ from: rangeStart, to: rangeEnd, page, pageSize: PAGE_SIZE, search: debouncedSearch });

  const paged = pageData?.rows ?? [];
  const totalRows = pageData?.total ?? 0;

  const togglePrivacy = () => {
    setPrivacyHidden(prev => {
      const next = !prev;
      localStorage.setItem("privacy_mode", String(next));
      return next;
    });
  };

  const applyPeriod = (v: PeriodValue) => setPeriodValue(v);

  const prodsMap = useMemo(() => {
    const m: Record<string, string> = {};
    products.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [products]);

  useEffect(() => { setPage(1); }, [debouncedSearch, rangeStart, rangeEnd]);



  const buildRows = (source: Tables<"transactions">[]) => source.map((t) => ({
 "ID da Transação": t.id,
 "Data": spDateTime(t.created_at),
 "Cliente": spreadsheetSafe(t.customer_name),
 "Email": spreadsheetSafe(t.customer_email),
 "Documento": spreadsheetSafe(t.customer_document),
 "Telefone": spreadsheetSafe(t.customer_phone),
 "Produto": spreadsheetSafe(prodsMap[t.product_id ?? ""] ?? ""),
 "Método": spreadsheetSafe(t.payment_method),
 "Status": spreadsheetSafe(STATUS_MAP[deriveTransactionStatus(t)]?.label ?? t.status ?? ""),
 "Valor Bruto (R$)": Number(t.amount),
 "Taxa (R$)": Number(t.fee_amount ?? 0),
 "Valor Líquido (R$)": Number(t.net_amount ?? 0),
  }));

  /** Exportação sempre lê o período completo no servidor (não apenas a página atual). */
  const loadExportRows = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada. Entre novamente.");
      return null;
    }
    setExportProgress(0);
    const rows = await fetchTransactionsForExport(user.id, rangeStart, rangeEnd, setExportProgress);
    const filteredRows = filterTransactions(rows, exportFilters);
    if (!filteredRows.length) {
      toast.error("Nenhuma transação para exportar");
      return null;
    }
    return buildRows(filteredRows);
  };


  const fileName = (ext: string) => {
    const tag = range?.from && range?.to
      ? `${format(range.from, "yyyy-MM-dd")}_a_${format(range.to, "yyyy-MM-dd")}`
      : new Date().toISOString().slice(0, 10);
    return `vendas_${tag}.${ext}`;
  };

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const logExport = async (format: "csv" | "xlsx", count: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("activity_logs").insert([{
        user_id: user.id,
        action: "export_sales",
        entity_type: "transactions",
        new_data: {
          format,
          count,
          range_from: range?.from?.toISOString() ?? null,
          range_to: range?.to?.toISOString() ?? null,
          search: search || null,
          privacy_mode: privacyHidden,
        },
      }]);
    } catch (err) {
      console.error("[Vendas] export audit log failed:", err);
    }
  };

  const exportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = await loadExportRows();
      if (!rows) return;
      const headers = Object.keys(rows[0]);
      const esc = (v: unknown) => {
        const s = String(spreadsheetSafe(v));
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = "\uFEFF" + [
        headers.join(";"),
        ...rows.map((r) => headers.map((h) => esc(r[h as keyof typeof r])).join(";")),
      ].join("\n");
      download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), fileName("csv"));
      void logExport("csv", rows.length);
      toast.success(`${rows.length} transações exportadas (CSV)`);
      setExportOpen(false);
    } catch (err) {
      console.error("[Vendas] export CSV failed:", err);
      toast.error("Falha ao exportar CSV");
    } finally {
      setExporting(false);
    }
  };

  const exportXLSX = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = await loadExportRows();
      if (!rows) return;
      const headers = Object.keys(rows[0]);
      const wb = new ExcelJS.Workbook();
      wb.creator = "Venxpay";
      wb.created = new Date();
      const ws = wb.addWorksheet("Vendas");
      ws.columns = headers.map((h) => ({
        header: h,
        key: h,
        width: Math.min(40, Math.max(h.length + 2, ...rows.map((r) => String(r[h as keyof typeof r] ?? "").length + 2))),
      }));
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(r));
      ["Valor Bruto (R$)", "Taxa (R$)", "Valor Líquido (R$)"].forEach((key) => {
        const column = ws.getColumn(key);
        column.numFmt = 'R$ #,##0.00';
      });
      const buf = await wb.xlsx.writeBuffer();
      download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName("xlsx"));
      void logExport("xlsx", rows.length);
      toast.success(`${rows.length} transações exportadas (Excel)`);
      setExportOpen(false);
    } catch (err) {
      console.error("[Vendas] export XLSX failed:", err);
      toast.error("Falha ao exportar Excel");
    } finally {
      setExporting(false);
    }
  };


  // Agregados vindos da RPC — mesma fórmula do Dashboard e do painel admin.
  const stats = useMemo(() => {
    const totalCount = Number(cur?.total_count ?? 0);
    const approvedCount = Number(cur?.approved_count ?? 0);
    const netRevenue = Number(cur?.net_revenue ?? 0);
    const grossRevenue = Number(cur?.revenue ?? 0);
    const pixTotal = Number(cur?.pix_total ?? 0);
    const pixApproved = Number(cur?.pix_approved ?? 0);
    return {
      count: approvedCount,
      totalCount,
      revenue: netRevenue,
      gross: grossRevenue,
      avg: approvedCount > 0 ? netRevenue / approvedCount : 0,
      conversion: totalCount > 0 ? (approvedCount / totalCount) * 100 : 0,
      pixConversion: pixTotal > 0 ? (pixApproved / pixTotal) * 100 : 0,
      pixApproved,
      pixTotal,
    };
  }, [cur]);

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const CENSORED = "••••••";

  const rangeLabel = periodLabel(periodValue);


  return (
    <HDShell>
      <Seo title="Vendas | Venxpay" description="Histórico completo de transações, filtros avançados e exportação de relatórios." path="/vendas" noindex />

      {/* Premium Hero */}
      <HDHeader
        eyebrow="Minhas vendas"
        title="Vendas & Recebíveis"
        subtitle={`${totalRows.toLocaleString("pt-BR")} transações · ${rangeLabel} — histórico completo, filtros avançados e exportação.`}
        actions={
          <div className="flex items-center gap-2">
            {/* Seletor de período — popover no desktop, bottom sheet no mobile */}
            <PeriodPicker
              value={periodValue}
              onChange={applyPeriod}
              trigger={
                <button
                  className="group inline-flex h-10 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-left transition-colors hover:border-primary/40 md:flex-none"
                  aria-label="Selecionar período"
                >
                  <CalendarIcon className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
                  <span className="min-w-0 leading-none">
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">Período</span>
                    <span className="mt-1 block truncate text-[12px] font-bold tabular-nums text-foreground">{rangeLabel}</span>
                  </span>
                  <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              }
            />

            <Button
              variant="outline"
              size="sm"
              onClick={togglePrivacy}
              className="h-10 px-3 rounded-xl border-border/60 hover:bg-muted/50 font-medium text-xs gap-2"
            >
              {privacyHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button disabled={exporting || totalRows === 0} onClick={() => setExportOpen(true)} className="h-10 px-4 rounded-xl font-semibold text-xs gap-2">
              <Download className="h-4 w-4" /> Exportar
            </Button>
          </div>
        }
      />

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <DialogTitle>Exportar vendas</DialogTitle>
            <p className="text-xs text-muted-foreground">Escolha exatamente quais vendas deseja incluir no período atual.</p>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Busca geral</Label><Input value={exportFilters.search} onChange={(e) => setExportFilters((f) => ({ ...f, search: e.target.value }))} placeholder="ID, cliente, e-mail ou documento" /></div>
            <div className="space-y-1.5"><Label>Status</Label><Select value={exportFilters.statuses?.[0] ?? "all"} onValueChange={(value) => setExportFilters((f) => ({ ...f, statuses: value === "all" ? [] : value === "paid" ? ["approved", "completed", "paid"] : [value] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="paid">Pagos</SelectItem><SelectItem value="pending">Pendentes</SelectItem><SelectItem value="expired">Expirados</SelectItem><SelectItem value="refunded">Reembolsados</SelectItem><SelectItem value="chargeback">Chargebacks</SelectItem><SelectItem value="failed">Falhos</SelectItem><SelectItem value="cancelled">Cancelados</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Produto</Label><Select value={exportFilters.productId || "all"} onValueChange={(value) => setExportFilters((f) => ({ ...f, productId: value === "all" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os produtos</SelectItem>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Nome do cliente</Label><Input value={exportFilters.customerName} onChange={(e) => setExportFilters((f) => ({ ...f, customerName: e.target.value }))} placeholder="Nome ou parte do nome" /></div>
            <div className="space-y-1.5"><Label>E-mail do cliente</Label><Input type="email" value={exportFilters.customerEmail} onChange={(e) => setExportFilters((f) => ({ ...f, customerEmail: e.target.value }))} placeholder="cliente@email.com" /></div>
            {exporting && <div className="sm:col-span-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">Carregando {exportProgress.toLocaleString("pt-BR")} vendas…</div>}
          </div>
          <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exporting}>Cancelar</Button>
            <Button variant="outline" onClick={exportCSV} disabled={exporting}><FileText className="mr-2 h-4 w-4" />CSV</Button>
            <Button onClick={exportXLSX} disabled={exporting}><Download className="mr-2 h-4 w-4" />Excel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Premium KPI Grid */}
      <HDStatGrid>
        <HDStat label="Faturamento Líquido" value={privacyHidden ? CENSORED : fmt(stats.revenue)} sub="Total após taxas" icon={Wallet} tone="success" />
        <HDStat label="Vendas Aprovadas" value={privacyHidden ? CENSORED : String(stats.count)} sub={privacyHidden ? "•••" : "Pedidos concluídos"} icon={Check} tone="primary" />
        <HDStat label="Ticket Médio" value={privacyHidden ? CENSORED : fmt(stats.avg)} sub="Média por venda" icon={BarChart3} tone="neutral" />
        <HDStat label="Conversão" value={privacyHidden ? CENSORED : `${stats.conversion.toFixed(1)}%`} sub={privacyHidden ? "•••" : `${stats.count.toLocaleString("pt-BR")} de ${stats.totalCount.toLocaleString("pt-BR")} · Pix ${stats.pixConversion.toFixed(0)}%`} icon={Zap} tone="info" />
      </HDStatGrid>



      {/* Table Section */}
      <div className="bg-card rounded-[24px] border border-border/60  overflow-hidden">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <ShoppingCart size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none">Transações</h2>
              <p className="text-[11px] font-medium text-muted-foreground mt-1">
                {totalRows.toLocaleString("pt-BR")} Registros · {rangeLabel}
              </p>
            </div>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
            <input
              type="text"
              placeholder="Buscar cliente, e-mail ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-11 pr-4 bg-muted/30 border border-border/60 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* Mobile cards (< md) */}
        <div className="md:hidden divide-y divide-border/40">
          {txLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3.5 flex items-center gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-xl bg-muted/60 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between gap-2">
                    <div className="h-3 w-32 rounded bg-muted/60" />
                    <div className="h-3 w-16 rounded bg-muted/60" />
                  </div>
                  <div className="h-2.5 w-40 rounded bg-muted/40" />
                  <div className="flex gap-1.5">
                    <div className="h-4 w-14 rounded-full bg-muted/40" />
                    <div className="h-4 w-12 rounded-full bg-muted/40" />
                  </div>
                </div>
              </div>
            ))
          ) : txError ? (
            <div className="px-6 py-14 text-center flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-[12px] bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                <FileText size={20} className="text-destructive" />
              </div>
              <div>
                <p className="text-[13px] font-black text-foreground">Erro ao carregar vendas</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Verifique sua conexão e tente novamente.</p>
              </div>
              <button onClick={() => refetchTx()} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold ">
                Tentar novamente
              </button>
            </div>
          ) : paged.length === 0 ? (
            <div className="px-6 py-14 text-center flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-[12px] bg-muted/40 border border-border/60 flex items-center justify-center">
                <ShoppingCart size={22} strokeWidth={1.5} className="text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-[13px] font-black text-foreground">Nenhuma transação no período</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  {search ? "Tente outro termo de busca." : "Ajuste o filtro de período ou aguarde novas vendas."}
                </p>
              </div>
            </div>
          ) : (
            paged.map((t) => {
              const status = STATUS_MAP[deriveTransactionStatus(t)] || STATUS_MAP.pending;
              const method = METHODS_MAP[t.payment_method || ""] || { label: t.payment_method, icon: FileText };
              const MethodIcon = method.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setDetailTx(t)}
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-muted/30 transition-colors"
                >
                  <Avatar className="h-10 w-10 rounded-xl border border-border/40 shrink-0">
                    <AvatarFallback className="bg-primary/5 text-primary text-[11px] font-semibold ">
                      {(t.customer_name || "C").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-black text-foreground truncate">{t.customer_name || "Cliente"}</p>
                      <p className="text-[13px] font-black text-foreground tabular-nums shrink-0">
                        {privacyHidden ? CENSORED : fmt(Number(t.amount))}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-[11px] font-medium text-muted-foreground/70 truncate">
                        {prodsMap[t.product_id || ""] || "Sem produto"}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground/60 tabular-nums shrink-0">
                        {spShort(t.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", status.cls)}>
                        <span className={cn("h-1 w-1 rounded-full", status.dot)} />
                        {status.label}
                      </span>
                      {(t as { is_simulated?: boolean }).is_simulated && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-border bg-muted text-muted-foreground">
                          Simulação
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-muted/40 border border-border/60 text-muted-foreground/80">
                        {t.payment_method === "pix" ? <PixLogoMark className="h-2.5 w-2.5" /> : <MethodIcon className="h-2.5 w-2.5" />}
                        {method.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>


        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/30 text-[11px] font-semibold text-muted-foreground/60 border-b border-border/40">
                <th className="px-8 py-5">Cliente / Produto</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-center">Pagamento</th>
                <th className="px-8 py-5 text-right">Valor</th>
                <th className="px-8 py-5 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <ShoppingCart size={48} strokeWidth={1} />
                      <p className="mt-4 text-[11px] font-semibold ">Nenhuma transação encontrada</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((t) => {
                  const status = STATUS_MAP[deriveTransactionStatus(t)] || STATUS_MAP.pending;
                  const method = METHODS_MAP[t.payment_method || ""] || { label: t.payment_method, icon: FileText };
                  const MethodIcon = method.icon;
                  return (
                    <tr key={t.id} onClick={() => setDetailTx(t)} className="hover:bg-muted/20 transition-colors group cursor-pointer">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-xl border border-border/40 shrink-0">
                            <AvatarFallback className="bg-primary/5 text-primary text-[11px] font-semibold ">
                              {(t.customer_name || "C").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-foreground truncate">{t.customer_name || "Cliente"}</p>
                            <p className="text-[11px] font-bold text-muted-foreground/60 truncate">
                              {prodsMap[t.product_id || ""] || "Sem produto"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center">
                          <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border", status.cls)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                            {status.label}
                          </span>
                          {(t as { is_simulated?: boolean }).is_simulated && (
                            <span className="ml-1.5 inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold border border-border bg-muted text-muted-foreground" title="Venda de teste: não entra no saldo nem nos totais">
                              Simulação
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center">
                          {t.payment_method === "pix" ? (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[hsl(173_58%_47%/0.08)] border border-[hsl(173_58%_47%/0.25)] text-[10px] font-bold text-[hsl(173_58%_47%)]">
                              <PixLogoMark className="h-3.5 w-3.5" />
                              Pix
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-muted/40 border border-border/60 text-[10px] font-bold text-muted-foreground/80">
                              <MethodIcon className="h-3.5 w-3.5" />
                              {method.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <p className="text-sm font-black text-foreground tabular-nums tracking-tight">
                          {privacyHidden ? CENSORED : fmt(Number(t.amount))}
                        </p>
                        <p className="text-[10px] font-bold text-emerald-500 tabular-nums">
                          {privacyHidden ? CENSORED : `Líq: ${fmt(Number(t.net_amount))}`}
                        </p>
                      </td>
                      <td className="px-8 py-5 text-right leading-tight">
                        <div className="text-[11px] font-bold text-foreground">
                          {spDate(t.created_at)}
                        </div>
                        <div className="text-[11px] font-medium text-muted-foreground/50 mt-1 ">
                          {spHour(t.created_at)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>


        {/* Pagination */}
        {totalRows > 0 && (
          <div className="px-6 py-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] font-semibold text-muted-foreground/70 tabular-nums">
              Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalRows)} de {totalRows.toLocaleString("pt-BR")}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 rounded-md border-border/60"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {(() => {
                const start = Math.max(1, Math.min(currentPage - 3, totalPages - 6));
                return Array.from({ length: 7 }).map((_, idx) => {
                  const pageNum = start + idx;
                  if (pageNum > totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
   "h-8 min-w-8 px-2.5 rounded-md text-[11px] font-black tabular-nums transition-colors border",
                        pageNum === currentPage
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground/70 border-border/60 hover:bg-muted/50"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                });
              })()}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0 rounded-md border-border/60"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <SellerRefundDialog tx={refundTx} onClose={() => setRefundTx(null)} onDone={() => setDetailTx(null)} />
      {detailTx && (
        <TransactionDetailPanel tx={detailTx} products={prodsMap} onClose={() => setDetailTx(null)} onRefund={(t) => setRefundTx(t as Tables<"transactions">)} />
      )}
    </HDShell>
  );
}
