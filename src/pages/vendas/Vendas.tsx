import { useState, useMemo, useEffect } from "react";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
  Search, EyeOff, Eye, Check, Download, FileText,
  CreditCard, ShoppingCart, Zap, History, BarChart3, TrendingUp, Wallet,
  CalendarIcon, ChevronLeft, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { PixLogoMark } from "@/components/icons/PixLogoMark";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { calculateTransactionConversions, cn, isApprovedTransaction } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { StatCard } from "@/components/StatCard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";

const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20", dot: "bg-amber-500" },
  failed: { label: "Falha", cls: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
  expired: { label: "Expirada", cls: "bg-muted text-muted-foreground border-border/60", dot: "bg-muted-foreground/50" },
  refunded: { label: "Reembolso", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20", dot: "bg-blue-500" },
  chargeback: { label: "Chargeback", cls: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
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
  const { data: transactions = [], isLoading: txLoading, isError: txError, refetch: refetchTx } = useTransactions();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState("");
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);
  const [privacyHidden, setPrivacyHidden] = useState(() => localStorage.getItem("privacy_mode") === "true");
  const [preset, setPreset] = useState<PresetId>("30d");
  const [range, setRange] = useState<DateRange | undefined>(() => buildPreset("30d"));
  const [tempRange, setTempRange] = useState<DateRange | undefined>(range);
  const [dateOpen, setDateOpen] = useState(false);
  const [page, setPage] = useState(1);

  const togglePrivacy = () => {
    setPrivacyHidden(prev => {
      const next = !prev;
      localStorage.setItem("privacy_mode", String(next));
      return next;
    });
  };

  const selectPreset = (id: PresetId) => {
    setPreset(id);
    if (id === "custom") {
      setTempRange(range);
      return;
    }
    const r = buildPreset(id);
    setRange(r);
    setTempRange(r);
    setDateOpen(false);
  };

  const applyCustom = () => {
    if (tempRange?.from && tempRange?.to) {
      setRange(tempRange);
      setPreset("custom");
      setDateOpen(false);
    }
  };

  const prodsMap = useMemo(() => {
    const m: Record<string, string> = {};
    products.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [products]);

  const filteredByDate = useMemo(() => {
    if (!range?.from || !range?.to) return transactions;
    const fromMs = range.from.getTime();
    const toMs = range.to.getTime();
    return transactions.filter((t) => {
      const ts = new Date(t.created_at).getTime();
      return ts >= fromMs && ts <= toMs;
    });
  }, [transactions, range]);

  const filtered = useMemo(() => {
    if (!search) return filteredByDate;
    const q = search.toLowerCase();
    return filteredByDate.filter((t) =>
      t.customer_name?.toLowerCase().includes(q) ||
      t.customer_email?.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  }, [filteredByDate, search]);

  useEffect(() => { setPage(1); }, [search, range]);

  const buildRows = () => filtered.map((t) => ({
    "ID da Transação": t.id,
    "Data": spDateTime(t.created_at),
    "Cliente": t.customer_name ?? "",
    "Email": t.customer_email ?? "",
    "Documento": t.customer_document ?? "",
    "Telefone": t.customer_phone ?? "",
    "Produto": prodsMap[t.product_id ?? ""] ?? "",
    "Método": t.payment_method ?? "",
    "Status": STATUS_MAP[t.status ?? ""]?.label ?? t.status ?? "",
    "Valor Bruto (R$)": Number(t.amount),
    "Taxa (R$)": Number(t.fee_amount ?? 0),
    "Valor Líquido (R$)": Number(t.net_amount ?? 0),
  }));

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

  const exportCSV = () => {
    if (!filtered.length) return toast.error("Nenhuma transação para exportar");
    const rows = buildRows();
    const headers = Object.keys(rows[0]);
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "\uFEFF" + [
      headers.join(";"),
      ...rows.map((r) => headers.map((h) => esc(r[h as keyof typeof r])).join(";")),
    ].join("\n");
    download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), fileName("csv"));
    void logExport("csv", rows.length);
    toast.success(`${rows.length} transações exportadas (CSV)`);
  };

  const exportXLSX = async () => {
    if (!filtered.length) return toast.error("Nenhuma transação para exportar");
    const rows = buildRows();
    const headers = Object.keys(rows[0]);
    const wb = new ExcelJS.Workbook();
    wb.creator = "Hotzfy";
    wb.created = new Date();
    const ws = wb.addWorksheet("Vendas");
    ws.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.min(40, Math.max(h.length + 2, ...rows.map((r) => String(r[h as keyof typeof r] ?? "").length + 2))),
    }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName("xlsx"));
    void logExport("xlsx", rows.length);
    toast.success(`${rows.length} transações exportadas (Excel)`);
  };


  const stats = useMemo(() => {
    const approved = filteredByDate.filter(t => isApprovedTransaction(t.status));
    const revenue = approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const gross = approved.reduce((acc, t) => acc + Number(t.amount), 0);
    const conversions = calculateTransactionConversions(transactions);
    return {
      count: approved.length,
      revenue,
      gross,
      avg: approved.length > 0 ? revenue / approved.length : 0,
      pixConversion: conversions.pix.rate,
      pixApproved: conversions.pix.approved,
      pixTotal: conversions.pix.total,
    };
  }, [filteredByDate, transactions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const CENSORED = "••••••";

  const rangeLabel = useMemo(() => {
    const p = PRESETS.find(p => p.id === preset);
    if (preset !== "custom" && p) return p.label;
    if (range?.from && range?.to) {
      return `${format(range.from, "dd MMM", { locale: ptBR })} — ${format(range.to, "dd MMM", { locale: ptBR })}`;
    }
    return "Selecionar período";
  }, [preset, range]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Seo title="Vendas | Hotzfy" description="Histórico completo de transações, filtros avançados e exportação de relatórios." path="/vendas" noindex />
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight">Minhas Vendas</h1>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-primary" />
            Gestão completa de transações e recebíveis
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Period selector — institutional, segmented */}
          <div className="inline-flex items-stretch h-10 rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-stretch divide-x divide-border">
              {PRESETS.filter(p => p.id !== "custom").map((p) => {
                const isActive = preset === p.id;
                const short =
                  p.id === "today" ? "Hoje" :
                  p.id === "7d" ? "7D" :
                  p.id === "15d" ? "15D" :
                  "30D";
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPreset(p.id)}
                    className={cn(
                      "relative px-3.5 flex items-center justify-center text-[11px] font-black uppercase tracking-[0.14em] tabular-nums transition-colors duration-200 min-w-[54px]",
                      isActive
                        ? "text-primary bg-primary/[0.08]"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40"
                    )}
                  >
                    {isActive && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />}
                    {short}
                  </button>
                );
              })}

              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "relative px-3.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition-colors duration-200",
                      preset === "custom"
                        ? "text-primary bg-primary/[0.08]"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40"
                    )}
                  >
                    {preset === "custom" && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />}
                    <CalendarIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    <span className="tabular-nums">
                      {preset === "custom" && range?.from
                        ? format(range.from, "dd/MM") + (range.to ? " – " + format(range.to, "dd/MM") : "")
                        : "Personalizado"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-[320px] p-0 overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground/80">
                      {tempRange?.from
                        ? format(tempRange.from, "dd MMM", { locale: ptBR }) +
                          (tempRange.to ? " — " + format(tempRange.to, "dd MMM", { locale: ptBR }) : " — fim?")
                        : "Selecione o intervalo"}
                    </span>
                    {tempRange?.from && tempRange?.to && (
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary tabular-nums px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                        {differenceInDays(tempRange.to, tempRange.from) + 1}d
                      </span>
                    )}
                  </div>
                  <Calendar
                    mode="range"
                    selected={tempRange}
                    onSelect={(r) => { setTempRange(r); setPreset("custom"); }}
                    numberOfMonths={1}
                    locale={ptBR}
                    defaultMonth={tempRange?.from ?? new Date()}
                    className="pointer-events-auto p-2"
                  />
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-t border-border">
                    <button onClick={() => setDateOpen(false)} className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/60 hover:text-foreground transition-colors">Cancelar</button>
                    <button onClick={applyCustom} disabled={!tempRange?.from || !tempRange?.to} className="px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-[0.14em] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Aplicar</button>
                  </div>
                </PopoverContent>

              </Popover>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={togglePrivacy}
            className="h-10 px-3 sm:px-4 rounded-xl border-border/60 hover:bg-muted/50 font-bold text-xs uppercase tracking-wider gap-2"
          >
            {privacyHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">Privacidade</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={!filtered.length} className="h-10 px-4 sm:px-6 rounded-xl font-black text-xs uppercase tracking-widest gap-2">
                <Download className="h-4 w-4" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                Exportar dados da tabela
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportXLSX} className="gap-3 py-2.5 cursor-pointer">
                <div className="h-8 w-8 rounded-md bg-success/10 border border-success/20 flex items-center justify-center text-success font-black text-[10px]">
                  XLSX
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">Excel (.xlsx)</div>
                  <div className="text-[10px] text-muted-foreground">Planilha formatada</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCSV} className="gap-3 py-2.5 cursor-pointer">
                <div className="h-8 w-8 rounded-md bg-info/10 border border-info/20 flex items-center justify-center text-info font-black text-[10px]">
                  CSV
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">CSV (.csv)</div>
                  <div className="text-[10px] text-muted-foreground">Compatível com qualquer ferramenta</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "linha" : "linhas"} • Período atual
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Faturamento Líquido" value={privacyHidden ? CENSORED : fmt(stats.revenue)} icon={Wallet} color="success" description="Total após taxas" />
        <StatCard title="Vendas Aprovadas" value={stats.count} icon={Check} color="primary" description="Pedidos concluídos" />
        <StatCard title="Ticket Médio" value={privacyHidden ? CENSORED : fmt(stats.avg)} icon={BarChart3} color="info" description="Média por venda" />
        <StatCard title="Conversão Pix" value={`${stats.pixConversion.toFixed(0)}%`} icon={Zap} color="info" description={`${stats.pixApproved} de ${stats.pixTotal} pagos`} />
      </div>

      {/* Table Section */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <ShoppingCart size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none">Transações</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                {filtered.length} Registros · {rangeLabel}
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
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                <FileText size={20} className="text-destructive" />
              </div>
              <div>
                <p className="text-[13px] font-black text-foreground">Erro ao carregar vendas</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Verifique sua conexão e tente novamente.</p>
              </div>
              <button onClick={() => refetchTx()} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-wider">
                Tentar novamente
              </button>
            </div>
          ) : paged.length === 0 ? (
            <div className="px-6 py-14 text-center flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center">
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
              const status = STATUS_MAP[t.status] || STATUS_MAP.pending;
              const method = METHODS_MAP[t.payment_method || ""] || { label: t.payment_method, icon: FileText };
              const MethodIcon = method.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setDetailTx(t)}
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-muted/30 transition-colors"
                >
                  <Avatar className="h-10 w-10 rounded-xl border border-border/40 shrink-0">
                    <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black uppercase">
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
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border", status.cls)}>
                        <span className={cn("h-1 w-1 rounded-full", status.dot)} />
                        {status.label}
                      </span>
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
              <tr className="bg-muted/30 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 border-b border-border/40">
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
                      <p className="mt-4 text-[11px] font-black uppercase tracking-widest">Nenhuma transação encontrada</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((t) => {
                  const status = STATUS_MAP[t.status] || STATUS_MAP.pending;
                  const method = METHODS_MAP[t.payment_method || ""] || { label: t.payment_method, icon: FileText };
                  const MethodIcon = method.icon;
                  return (
                    <tr key={t.id} onClick={() => setDetailTx(t)} className="hover:bg-muted/20 transition-colors group cursor-pointer">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-xl border border-border/40 shrink-0">
                            <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black uppercase">
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
                          <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", status.cls)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                            {status.label}
                          </span>
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
                          {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="text-[10px] font-medium text-muted-foreground/50 mt-1 uppercase">
                          {format(new Date(t.created_at), "HH:mm'h'", { locale: ptBR })}
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
        {filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70 tabular-nums">
              Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
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
              {Array.from({ length: totalPages }).slice(0, 7).map((_, idx) => {
                let pageNum = idx + 1;
                if (totalPages > 7) {
                  if (currentPage > 4) pageNum = currentPage - 3 + idx;
                  if (pageNum > totalPages) pageNum = totalPages - (6 - idx);
                }
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
              })}
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

      {detailTx && (
        <TransactionDetailPanel tx={detailTx} products={prodsMap} onClose={() => setDetailTx(null)} />
      )}
    </div>
  );
}
