import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useState, useMemo, useEffect } from "react";
import { useProducts, useDashboardStats, useTransactionsPage, fetchTransactionsForExport } from "@/hooks/useQueryData";
import { EyeOff, Eye, Download, CalendarDays, ChevronDown } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { SellerRefundDialog } from "@/components/transactions/SellerRefundDialog";
import type { Tables } from "@/integrations/supabase/types";
import { deriveTransactionStatus } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { PageHead } from "@/components/seller-ui/PageHead";
import { StatBand } from "@/components/seller-ui/StatBand";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { SalesLedger } from "@/components/sales/SalesLedger";
import type { SalesStatusKey } from "@/lib/sales-status-filter";
import { Money } from "@/components/home/Money";
import { PeriodPicker } from "@/components/PeriodPicker";
import { buildPeriod, periodLabel, yearPeriod, type PeriodValue } from "@/components/period/periodMeta";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { SalesExportDialog } from "@/components/transactions/SalesExportDialog";
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
  // A busca global (Ctrl-K) chega aqui com `?search=`: já abre filtrado e olhando o último ano, não só o dia de hoje.
  // Só lê a URL na entrada: mudar a query remonta a página (ver DashboardLayout).
  const [params] = useSearchParams();
  const [initialSearch] = useState(() => (params.get("search") ?? "").trim().slice(0, 120));
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);
  const [refundTx, setRefundTx] = useState<Tables<"transactions"> | null>(null);
  const { hidden: privacyHidden, toggle: togglePrivacy } = usePrivacyMode();
  const [periodValue, setPeriodValue] = useState<PeriodValue>(() => (initialSearch ? yearPeriod() : buildPeriod("today")));
  const range = useMemo<DateRange>(() => ({ from: periodValue.from, to: periodValue.to }), [periodValue]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SalesStatusKey>("all");
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
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
  const { data: dashStats, isError: statsError, refetch: refetchStats } = useDashboardStats(rangeStart, rangeEnd, bucket);
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
      setExportError("Sua sessão expirou. Entre de novo para exportar.");
      return null;
    }
    setExportError(null);
    setExportProgress(0);
    const rows = await fetchTransactionsForExport(user.id, rangeStart, rangeEnd, setExportProgress);
    const filteredRows = filterTransactions(rows, exportFilters);
    if (!filteredRows.length) {
      setExportError("Nenhuma venda com esses filtros no período. Tire algum filtro ou escolha outro período.");
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
      setExportError("Não deu para gerar o CSV agora. Tente de novo.");
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
      setExportError("Não deu para gerar o Excel agora. Tente de novo.");
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

      <SectionTabs section="sales" />
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

      {statsError && !cur ? (
        <div role="alert" className="vp-sheet flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-7">
          <p className="text-[14.5px] font-semibold text-foreground">Não foi possível carregar o resumo do período. A lista de vendas abaixo continua valendo.</p>
          <button type="button" onClick={() => void refetchStats()} className="vp-ghost h-10 px-4 text-[13.5px]">Tentar de novo</button>
        </div>
      ) : (
        <StatBand
          label="Resumo do período"
          cells={[
            { label: "Faturamento líquido", featured: true, loading: !cur, value: privacyHidden ? "R$ ••••" : <Money value={stats.revenue} centsClassName="opacity-70" />, sub: "Depois das taxas" },
            { label: "Vendas pagas", loading: !cur, value: mask(stats.count.toLocaleString("pt-BR")), sub: privacyHidden ? "••••" : `de ${stats.totalCount.toLocaleString("pt-BR")} tentativas` },
            { label: "Ticket médio", loading: !cur, value: privacyHidden ? "R$ ••••" : <Money value={stats.avg} centsClassName="opacity-70" />, sub: "Média por venda paga" },
            { label: "Taxa de aprovação", loading: !cur, value: stats.totalCount === 0 ? "—" : mask(`${stats.conversion.toFixed(1).replace(".", ",")}%`), meter: privacyHidden || stats.totalCount === 0 ? undefined : stats.conversion, sub: privacyHidden ? "••••" : stats.totalCount === 0 ? "Sem tentativas no período" : `Pix aprova ${stats.pixConversion.toFixed(0)}%` },
          ]}
        />
      )}

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

      <SalesExportDialog
        open={exportOpen} onOpenChange={(o) => { setExportOpen(o); if (o) setExportError(null); }}
        rangeLabel={rangeLabel} products={products}
        filters={exportFilters} onFilters={(f) => { setExportFilters(f); setExportError(null); }}
        exporting={exporting} progress={exportProgress} error={exportError}
        onCsv={() => { void exportCSV(); }} onXlsx={() => { void exportXLSX(); }}
      />

      <SellerRefundDialog tx={refundTx} onClose={() => setRefundTx(null)} onDone={() => setDetailTx(null)} />
      <TransactionDetailPanel tx={detailTx} products={prodsMap} onClose={() => setDetailTx(null)} onRefund={(t) => setRefundTx(t as Tables<"transactions">)} />
    </div>
  );
}
