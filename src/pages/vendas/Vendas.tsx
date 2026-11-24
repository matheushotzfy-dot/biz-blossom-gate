import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useState, useMemo, useEffect } from "react";
import { useProducts, useDashboardStats, useTransactionsPage, fetchTransactionsForExport } from "@/hooks/useQueryData";
import { EyeOff, Eye, Download, FileText, CalendarDays, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { SellerRefundDialog } from "@/components/transactions/SellerRefundDialog";
import type { Tables } from "@/integrations/supabase/types";
import { deriveTransactionStatus } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { PageHead } from "@/components/seller-ui/PageHead";
import { StatBand } from "@/components/seller-ui/StatBand";
import { SalesLedger } from "@/components/sales/SalesLedger";
import type { SalesStatusKey } from "@/lib/sales-status-filter";
import { Money } from "@/components/home/Money";
import { PeriodPicker, buildPeriod, periodLabel, type PeriodValue } from "@/components/PeriodPicker";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterTransactions, spreadsheetSafe, type SalesExportFilters } from "@/lib/sales-export";

const SP_TZ = "America/Sao_Paulo";
const spDateTime = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: SP_TZ, day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
}).format(new Date(iso));

/** Rótulos da planilha exportada: mantidos estáveis para não quebrar relatórios já montados. */
const EXPORT_STATUS_LABEL: Record<string, string> = {
  approved: "Aprovada", completed: "Aprovada", paid: "Aprovada",
  pending: "Pendente", processing: "Pendente", expired: "Expirada",
  refunded: "Reembolso", partially_refunded: "Reembolso", chargeback: "Chargeback",
  med: "MED PIX · em análise", med_lost: "MED perdido",
  error: "Erro", failed: "Erro", cancelled: "Cancelada", canceled: "Cancelada",
};

const PAGE_SIZE = 25;

export default function Vendas() {
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);
  const [refundTx, setRefundTx] = useState<Tables<"transactions"> | null>(null);
  const { hidden: privacyHidden, toggle: togglePrivacy } = usePrivacyMode();
  const [periodValue, setPeriodValue] = useState<PeriodValue>(() => buildPeriod("today"));
  const range = useMemo<DateRange>(() => ({ from: periodValue.from, to: periodValue.to }), [periodValue]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SalesStatusKey>("all");
  const navigate = useNavigate();
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
  } = useTransactionsPage({ from: rangeStart, to: rangeEnd, page, pageSize: PAGE_SIZE, search: debouncedSearch, status });

  const paged = pageData?.rows ?? [];
  const totalRows = pageData?.total ?? 0;

  const applyPeriod = (v: PeriodValue) => setPeriodValue(v);

  const prodsMap = useMemo(() => {
    const m: Record<string, string> = {};
    products.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [products]);

  useEffect(() => { setPage(1); }, [debouncedSearch, rangeStart, rangeEnd, status]);



  const buildRows = (source: Tables<"transactions">[]) => source.map((t) => ({
 "ID da Transação": t.id,
 "Data": spDateTime(t.created_at),
 "Cliente": spreadsheetSafe(t.customer_name),
 "Email": spreadsheetSafe(t.customer_email),
 "Documento": spreadsheetSafe(t.customer_document),
 "Telefone": spreadsheetSafe(t.customer_phone),
 "Produto": spreadsheetSafe(prodsMap[t.product_id ?? ""] ?? ""),
 "Método": spreadsheetSafe(t.payment_method),
 "Status": spreadsheetSafe(EXPORT_STATUS_LABEL[deriveTransactionStatus(t)] ?? t.status ?? ""),
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
      wb.creator = "Vemprapay";
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

  const rangeLabel = periodLabel(periodValue);
  const mask = (v: string) => (privacyHidden ? "••••" : v);

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Vendas | Vemprapay" description="Histórico completo de transações, filtros avançados e exportação de relatórios." path="/vendas" noindex />

      <PageHead
        title="Todas as vendas"
        subtitle="Acompanhe cada pagamento, filtre por status e exporte quando precisar."
        actions={
          <>
            <PeriodPicker
              value={periodValue}
              onChange={applyPeriod}
              trigger={
                <button className="vp-ghost" aria-label="Selecionar período">
                  <CalendarDays className="h-[18px] w-[18px] text-primary" />
                  <span>{rangeLabel}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              }
            />
            <button onClick={togglePrivacy} className="vp-ghost !px-0 w-11" aria-label={privacyHidden ? "Mostrar valores" : "Ocultar valores"} aria-pressed={privacyHidden}>
              {privacyHidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
            <button disabled={exporting || totalRows === 0} onClick={() => setExportOpen(true)} className="vp-ghost">
              <Download className="h-[18px] w-[18px]" /> Exportar
            </button>
          </>
        }
      />

      <StatBand
        label="Resumo do período"
        cells={[
          { label: "Faturamento líquido", featured: true, loading: !cur, value: privacyHidden ? "R$ ••••" : <Money value={stats.revenue} centsClassName="opacity-70" />, sub: "Depois das taxas" },
          { label: "Vendas pagas", loading: !cur, value: mask(stats.count.toLocaleString("pt-BR")), sub: privacyHidden ? "••••" : `de ${stats.totalCount.toLocaleString("pt-BR")} tentativas` },
          { label: "Ticket médio", loading: !cur, value: privacyHidden ? "R$ ••••" : <Money value={stats.avg} centsClassName="opacity-70" />, sub: "Média por venda paga" },
          { label: "Taxa de aprovação", loading: !cur, value: stats.totalCount === 0 ? "—" : mask(`${stats.conversion.toFixed(1).replace(".", ",")}%`), meter: privacyHidden || stats.totalCount === 0 ? undefined : stats.conversion, sub: privacyHidden ? "••••" : stats.totalCount === 0 ? "Sem tentativas no período" : `Pix aprova ${stats.pixConversion.toFixed(0)}%` },
        ]}
      />

      <SalesLedger
        items={paged}
        products={prodsMap}
        hidden={privacyHidden}
        loading={txLoading}
        error={txError}
        onRetry={() => { void refetchTx(); }}
        onOpen={setDetailTx}
        search={search}
        onSearch={setSearch}
        status={status}
        onStatus={setStatus}
        page={page}
        pageSize={PAGE_SIZE}
        total={totalRows}
        onPage={setPage}
        onCreateLink={() => navigate("/vendas/link-pagamento")}
      />

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl overflow-hidden rounded-[28px] p-0">
          <DialogHeader className="border-b border-border px-6 py-5 text-left sm:px-8">
            <DialogTitle className="text-[20px] font-extrabold tracking-[-0.03em]">Exportar vendas</DialogTitle>
            <p className="text-[14px] text-muted-foreground">Escolha quais vendas do período ({rangeLabel}) entram na planilha.</p>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 sm:px-8">
            <div className="space-y-1.5 sm:col-span-2"><Label>Busca geral</Label><Input value={exportFilters.search} onChange={(e) => setExportFilters((f) => ({ ...f, search: e.target.value }))} placeholder="ID, cliente, e-mail ou documento" className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>Status</Label><Select value={exportFilters.statuses?.[0] ?? "all"} onValueChange={(value) => setExportFilters((f) => ({ ...f, statuses: value === "all" ? [] : value === "paid" ? ["approved", "completed", "paid"] : [value] }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="paid">Pagos</SelectItem><SelectItem value="pending">Pendentes</SelectItem><SelectItem value="expired">Expirados</SelectItem><SelectItem value="refunded">Reembolsados</SelectItem><SelectItem value="chargeback">Chargebacks</SelectItem><SelectItem value="failed">Falhos</SelectItem><SelectItem value="cancelled">Cancelados</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Produto</Label><Select value={exportFilters.productId || "all"} onValueChange={(value) => setExportFilters((f) => ({ ...f, productId: value === "all" ? "" : value }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os produtos</SelectItem>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Nome do cliente</Label><Input value={exportFilters.customerName} onChange={(e) => setExportFilters((f) => ({ ...f, customerName: e.target.value }))} placeholder="Nome ou parte do nome" className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label>E-mail do cliente</Label><Input type="email" value={exportFilters.customerEmail} onChange={(e) => setExportFilters((f) => ({ ...f, customerEmail: e.target.value }))} placeholder="cliente@email.com" className="h-11 rounded-xl" /></div>
            {exporting && <div className="rounded-xl bg-muted px-4 py-3 text-[13px] text-muted-foreground sm:col-span-2" role="status">Carregando {exportProgress.toLocaleString("pt-BR")} vendas…</div>}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/40 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button type="button" className="vp-ghost" onClick={() => setExportOpen(false)} disabled={exporting}>Cancelar</button>
            <button type="button" className="vp-ghost" onClick={exportCSV} disabled={exporting}><FileText className="h-4 w-4" />Baixar CSV</button>
            <button type="button" className="vp-cta" onClick={exportXLSX} disabled={exporting}><Download className="h-4 w-4" />Baixar Excel</button>
          </div>
        </DialogContent>
      </Dialog>

      <SellerRefundDialog tx={refundTx} onClose={() => setRefundTx(null)} onDone={() => setDetailTx(null)} />
      {detailTx && (
        <TransactionDetailPanel tx={detailTx} products={prodsMap} onClose={() => setDetailTx(null)} onRefund={(t) => setRefundTx(t as Tables<"transactions">)} />
      )}
    </div>
  );
}
