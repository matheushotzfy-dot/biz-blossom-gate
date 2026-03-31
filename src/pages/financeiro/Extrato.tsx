import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import { StatusBadge } from "@/components/StatusBadge";
import {
  FileText, DollarSign, TrendingUp, CreditCard, Search, X,
  Calendar as CalendarIcon, Clock, Users, Eye, MessageCircle, ChevronDown,
  Download, Smartphone, BarChart3,
  MoreHorizontal, Receipt, ArrowUpRight, Zap,
} from "lucide-react";
import { PageShell, PageTitle, EmptyState, GlassKpi, Panel, SectionHeader } from "@/components/PageShell";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Formatters ─── */
const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const _dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
const _timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const _dateCache = new Map<string, string>();
const _timeCache = new Map<string, string>();

const fmtDate = (d: string) => {
  let v = _dateCache.get(d);
  if (!v) { v = _dateFmt.format(new Date(d)); _dateCache.set(d, v); }
  return v;
};
const fmtTime = (d: string) => {
  let v = _timeCache.get(d);
  if (!v) { v = _timeFmt.format(new Date(d)); _timeCache.set(d, v); }
  return v;
};

type StatusFilter = "all" | "completed" | "pending" | "failed" | "refunded" | "chargeback";
type DatePreset = "today" | "yesterday" | "7d" | "15d" | "30d" | "custom" | "all";

const PAGE_SIZE = 50;

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: "Hoje", value: "today" },
  { label: "Ontem", value: "yesterday" },
  { label: "7 dias", value: "7d" },
  { label: "15 dias", value: "15d" },
  { label: "30 dias", value: "30d" },
  { label: "Tudo", value: "all" },
];

/* ─── Avatar helpers ─── */
const AVATAR_COLORS = [
  "bg-primary/15 text-primary",
  "bg-info/15 text-info",
  "bg-warning/15 text-warning",
  "bg-success/15 text-success",
  "bg-destructive/15 text-destructive",
];
const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
};

/* ─── Status config ─── */
const STATUS_CONFIG: Record<string, { label: string; dot: string; active: string }> = {
  all:        { label: "Todas",       dot: "bg-primary",     active: "bg-primary/10 text-primary ring-primary/15" },
  completed:  { label: "Aprovadas",   dot: "bg-success",     active: "bg-success/10 text-success ring-success/15" },
  pending:    { label: "Pendentes",   dot: "bg-warning",     active: "bg-warning/10 text-warning ring-warning/15" },
  failed:     { label: "Falhas",      dot: "bg-destructive", active: "bg-destructive/10 text-destructive ring-destructive/15" },
  refunded:   { label: "Reembolsos",  dot: "bg-info",        active: "bg-info/10 text-info ring-info/15" },
  chargeback: { label: "Chargebacks", dot: "bg-destructive", active: "bg-destructive/10 text-destructive ring-destructive/15" },
};

const METHOD_CONFIG: Record<string, { icon: React.ReactNode; label: string; accent: string; bg: string }> = {
  pix:         { icon: <Smartphone className="h-3 w-3" />, label: "PIX",    accent: "text-success", bg: "bg-success/8 ring-success/10" },
  credit_card: { icon: <CreditCard className="h-3 w-3" />, label: "Cartão", accent: "text-info",    bg: "bg-info/8 ring-info/10" },
  boleto:      { icon: <FileText className="h-3 w-3" />,   label: "Boleto", accent: "text-warning", bg: "bg-warning/8 ring-warning/10" },
};

/* ─── Transaction Row (Desktop) ─── */
function TxRow({ tx, products, onClick, index }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void; index: number;
}) {
  const method = METHOD_CONFIG[tx.payment_method || ""] || { icon: null, label: tx.payment_method || "—", accent: "text-muted-foreground", bg: "bg-muted/10 ring-border/10" };
  const customerName = tx.customer_name || "Cliente";
  const avatarColor = getAvatarColor(customerName);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
      onClick={onClick}
      className="border-b border-border/20 hover:bg-muted/8 transition-all duration-300 cursor-pointer group"
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border/15">
            <AvatarFallback className={cn("text-[10px] font-display font-black", avatarColor)}>
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground font-display font-bold text-[12px] leading-tight truncate">{customerName}</p>
            {tx.customer_email && <p className="text-muted-foreground/40 text-[10px] mt-0.5 truncate font-medium">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      <td className="p-4">
        <span className="text-muted-foreground/60 text-[11px] font-display font-semibold max-w-[130px] truncate block">
          {tx.product_id ? (products[tx.product_id] || tx.product_id.slice(0, 8)) : "—"}
        </span>
      </td>
      <td className="p-4">
        <span className="font-display font-black text-foreground text-[14px] tabular-nums tracking-[-0.02em]">{fmt(Number(tx.net_amount))}</span>
      </td>
      <td className="p-4">
        <span className={cn("inline-flex items-center gap-1.5 text-[9px] font-display font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-lg ring-1", method.bg, method.accent)}>
          {method.icon}
          {method.label}
        </span>
      </td>
      <td className="p-4"><StatusBadge status={tx.status} /></td>
      <td className="p-4">
        <div>
          <p className="text-foreground/50 text-[11px] font-display font-semibold tabular-nums">{fmtDate(tx.created_at)}</p>
          <p className="text-muted-foreground/30 text-[9px] font-display tabular-nums">{fmtTime(tx.created_at)}</p>
        </div>
      </td>
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-muted/20">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/40" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[11px] font-display font-semibold rounded-lg">
              <Eye className="h-3.5 w-3.5" /> Ver Detalhes
            </DropdownMenuItem>
            {tx.customer_phone && (
              <DropdownMenuItem asChild>
                <a
                  href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="gap-2 text-[11px] font-display font-semibold rounded-lg"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </motion.tr>
  );
}

/* ─── Transaction Card (Mobile) ─── */
function TxCard({ tx, products, onClick, index }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void; index: number;
}) {
  const methodLabels: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto" };
  const customerName = tx.customer_name || "Cliente";
  const avatarColor = getAvatarColor(customerName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/40 p-4 cursor-pointer",
        "hover:border-border/60 hover:shadow-[0_6px_20px_hsl(var(--foreground)/0.06)]",
        "active:scale-[0.985] transition-all duration-300 overflow-hidden"
      )}
      onClick={onClick}
    >
      {/* Accent bar */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px] rounded-full",
        tx.status === "completed" ? "bg-success" : tx.status === "pending" ? "bg-warning" : tx.status === "failed" ? "bg-destructive" : "bg-info"
      )} />

      <div className="flex items-start justify-between gap-3 mb-3 pl-1.5">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/15">
            <AvatarFallback className={cn("text-[10px] font-display font-black", avatarColor)}>
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground font-display font-bold text-[12px] leading-tight truncate">{customerName}</p>
            <p className="text-muted-foreground/40 text-[10px] mt-0.5 truncate font-medium">{tx.customer_email || ""}</p>
          </div>
        </div>
        <StatusBadge status={tx.status} />
      </div>

      <div className="flex items-end justify-between pl-1.5">
        <div>
          <p className="text-foreground font-display font-black text-xl leading-none tabular-nums tracking-[-0.03em]">
            {fmt(Number(tx.net_amount))}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-display font-bold text-muted-foreground/40 bg-muted/15 px-2 py-0.5 rounded-md ring-1 ring-border/10 uppercase tracking-[0.1em]">
              {methodLabels[tx.payment_method || ""] || tx.payment_method || "—"}
            </span>
            <span className="text-muted-foreground/30 text-[10px] font-display font-semibold truncate max-w-[100px]">
              {tx.product_id ? products[tx.product_id] || "Produto" : "—"}
            </span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <p className="text-muted-foreground/30 text-[10px] font-display tabular-nums">{fmtDate(tx.created_at)}</p>
          {tx.customer_phone && (
            <a
              href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 rounded-xl bg-success/8 ring-1 ring-success/10 flex items-center justify-center text-success hover:bg-success/15 transition-all duration-300"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════ MAIN ═══════════════════════════════════ */

export default function Extrato() {
  const { user } = useAuth();
  const { data: transactions = [], isLoading: loading } = useTransactions();
  const { data: productsRaw = [] } = useProducts();
  const products = useMemo(() => {
    const map: Record<string, string> = {};
    productsRaw.forEach((p: any) => { map[p.id] = p.name; });
    return map;
  }, [productsRaw]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTx, setSelectedTx] = useState<Tables<"transactions"> | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, statusFilter, datePreset]);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (datePreset === "all") return null;
    if (datePreset === "custom" && customFrom && customTo) return { from: startOfDay(customFrom), to: endOfDay(customTo) };
    if (datePreset === "custom") return null;
    const days: Record<string, number> = { today: 0, yesterday: 1, "7d": 7, "15d": 15, "30d": 30 };
    const d = days[datePreset] ?? 30;
    if (datePreset === "yesterday") return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    return { from: startOfDay(subDays(now, d)), to: endOfDay(now) };
  }, [datePreset, customFrom, customTo]);

  const dateFiltered = useMemo(() => {
    if (!dateRange) return transactions;
    return transactions.filter(t => {
      const d = new Date(t.created_at);
      return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
    });
  }, [transactions, dateRange]);

  const approved = useMemo(() => dateFiltered.filter((t) => t.status === "completed"), [dateFiltered]);
  const totalNet = useMemo(() => approved.reduce((a, t) => a + Number(t.net_amount), 0), [approved]);
  const totalGross = useMemo(() => approved.reduce((a, t) => a + Number(t.amount), 0), [approved]);
  const avgTicket = useMemo(() => approved.length > 0 ? totalNet / approved.length : 0, [approved, totalNet]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dateFiltered.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!search) return true;
      return (
        t.customer_name?.toLowerCase().includes(q) ||
        t.customer_email?.toLowerCase().includes(q) ||
        t.customer_phone?.includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [dateFiltered, search, statusFilter]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const statusFilters = useMemo(() => {
    const counts: Record<string, number> = { all: dateFiltered.length, completed: 0, pending: 0, failed: 0, refunded: 0, chargeback: 0 };
    for (const t of dateFiltered) {
      if (t.status in counts) counts[t.status]++;
    }
    return [
      { value: "all" as StatusFilter, count: counts.all },
      { value: "completed" as StatusFilter, count: counts.completed },
      { value: "pending" as StatusFilter, count: counts.pending },
      { value: "failed" as StatusFilter, count: counts.failed },
      { value: "refunded" as StatusFilter, count: counts.refunded },
      { value: "chargeback" as StatusFilter, count: counts.chargeback },
    ];
  }, [dateFiltered]);

  const loadMore = useCallback(() => setVisibleCount((c) => c + PAGE_SIZE), []);

  const sanitizeCsvCell = useCallback((val: unknown): string => {
    const str = String(val ?? "");
    if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
    return str;
  }, []);

  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) { toast.error("Nenhuma transação para exportar."); return; }
    const headers = ["ID", "Cliente", "Email", "Telefone", "Produto", "Valor Bruto", "Taxa", "Líquido", "Método", "Status", "Data"];
    const rows = filtered.map(t => [
      t.id, t.customer_name || "", t.customer_email || "", t.customer_phone || "",
      t.product_id ? products[t.product_id] || "" : "", Number(t.amount), Number(t.fee_amount), Number(t.net_amount),
      t.payment_method || "", t.status, t.created_at,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${sanitizeCsvCell(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `extrato-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação concluída!");
  }, [filtered, products, sanitizeCsvCell]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("extrato-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <PageShell>
      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageTitle icon={<Receipt className="h-6 w-6" />} title="Extrato" subtitle="Histórico completo de transações" />
        <button
          onClick={handleExportCSV}
          className={cn(
            "h-9 px-4 rounded-xl text-[11px] font-display font-bold flex items-center gap-2",
            "bg-card/50 backdrop-blur-xl border border-border/30 text-muted-foreground/60",
            "hover:text-foreground hover:border-border/50 hover:shadow-[0_4px_12px_hsl(var(--foreground)/0.04)]",
            "active:scale-[0.985] transition-all duration-300"
          )}
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassKpi label="Receita Líquida" value={fmt(totalNet)} sub={`${approved.length} aprovadas`} icon={DollarSign} tone="primary" delay={0} />
        <GlassKpi label="Faturamento Bruto" value={fmt(totalGross)} sub="antes das taxas" icon={BarChart3} tone="info" delay={1} />
        <GlassKpi label="Ticket Médio" value={fmt(avgTicket)} sub="por venda aprovada" icon={TrendingUp} tone="warning" delay={2} />
        <GlassKpi label="Total Transações" value={String(dateFiltered.length)} sub={`${approved.length} completadas`} icon={Users} tone="success" delay={3} />
      </div>

      {/* ─── Filters Panel ─── */}
      <Panel className="p-0 overflow-visible">
        <div className="p-4 space-y-3.5">
          {/* Date presets + Search */}
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Date pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="inline-flex items-center rounded-xl bg-muted/10 p-0.5 ring-1 ring-border/15">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setDatePreset(p.value)}
                    className={cn(
                      "relative px-3 py-1.5 rounded-[10px] text-[10px] font-display font-bold transition-all duration-300",
                      datePreset === p.value
                        ? "text-foreground"
                        : "text-muted-foreground/40 hover:text-muted-foreground/70"
                    )}
                  >
                    {datePreset === p.value && (
                      <motion.div
                        layoutId="date-pill-bg"
                        className="absolute inset-0 rounded-[10px] bg-card shadow-sm ring-1 ring-border/20"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-[1]">{p.label}</span>
                  </button>
                ))}
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "h-8 px-3 rounded-xl text-[10px] font-display font-bold transition-all duration-300 border inline-flex items-center gap-1.5",
                    datePreset === "custom"
                      ? "bg-primary/8 text-primary border-primary/15 ring-1 ring-primary/10"
                      : "bg-transparent text-muted-foreground/40 border-border/15 hover:text-muted-foreground/70 hover:border-border/30"
                  )}>
                    <CalendarIcon className="h-3 w-3" />
                    {datePreset === "custom" && customFrom && customTo
                      ? `${format(customFrom, "dd/MM", { locale: ptBR })} - ${format(customTo, "dd/MM", { locale: ptBR })}`
                      : "Personalizado"
                    }
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-border/20 shadow-xl" align="start">
                  <div className="p-3.5 border-b border-border/10">
                    <p className="text-[11px] font-display font-black text-foreground">Selecionar período</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-0 sm:gap-2">
                    <div>
                      <p className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em] px-3 pt-2">De:</p>
                      <Calendar mode="single" selected={customFrom} onSelect={(d) => { setCustomFrom(d); setDatePreset("custom"); }} locale={ptBR} className="p-3 pointer-events-auto" />
                    </div>
                    <div>
                      <p className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em] px-3 pt-2">Até:</p>
                      <Calendar mode="single" selected={customTo} onSelect={(d) => { setCustomTo(d); setDatePreset("custom"); }} locale={ptBR} disabled={(date) => customFrom ? date < customFrom : false} className="p-3 pointer-events-auto" />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/20" />
              <input
                id="extrato-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, e-mail, WhatsApp ou ID..."
                className={cn(
                  "w-full h-9 pl-10 pr-16 rounded-xl bg-muted/5 border border-border/15",
                  "text-[12px] font-display text-foreground placeholder:text-muted-foreground/25",
                  "focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/15",
                  "transition-all duration-300"
                )}
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {search ? (
                  <button onClick={() => setSearch("")} className="p-0.5 hover:bg-muted/15 rounded-md transition-colors">
                    <X className="h-3 w-3 text-muted-foreground/30 hover:text-foreground transition-colors" />
                  </button>
                ) : (
                  <kbd className="hidden md:inline-flex items-center gap-0.5 text-[8px] font-display font-bold text-muted-foreground/20 bg-muted/8 border border-border/10 px-1.5 py-0.5 rounded-md">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>
          </div>

          {/* Status Pills with animated indicator */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
            {statusFilters.map((f) => {
              const isActive = statusFilter === f.value;
              const config = STATUS_CONFIG[f.value];
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "relative shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-display font-bold transition-all duration-300",
                    isActive
                      ? config.active + " ring-1"
                      : "text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/5"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="status-dot"
                      className={cn("h-1.5 w-1.5 rounded-full", config.dot)}
                      transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  {config.label}
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-md font-display font-bold min-w-[20px] text-center tabular-nums",
                    isActive ? "bg-foreground/5" : "bg-muted/10 text-muted-foreground/20"
                  )}>{f.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results summary */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/10">
          <p className="text-[10px] font-display font-bold text-muted-foreground/30">
            {filtered.length === 0
              ? "Nenhuma transação encontrada"
              : `Mostrando ${Math.min(visibleCount, filtered.length)} de ${filtered.length} transações`}
          </p>
          {filtered.length > 0 && (
            <p className="text-[10px] font-display font-bold text-primary/60 tabular-nums">
              {fmt(filtered.reduce((a, t) => a + Number(t.net_amount), 0))} no período
            </p>
          )}
        </div>
      </Panel>

      {/* ─── Desktop Table ─── */}
      <div className="hidden md:block">
        <Panel className="p-0 overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <div className="h-8 w-8 border-2 border-primary/15 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[11px] font-display font-bold text-muted-foreground/30">Carregando transações...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/15">
                      {["Cliente", "Produto", "Líquido", "Método", "Status", "Data", ""].map((h) => (
                        <th key={h} className="text-left p-4 text-[9px] font-display font-bold text-muted-foreground/25 uppercase tracking-[0.18em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.length === 0 ? (
                      <tr><td colSpan={7}>
                        <EmptyState icon={<FileText className="h-7 w-7" />} title="Nenhuma transação encontrada" subtitle="Tente ajustar os filtros ou período" />
                      </td></tr>
                    ) : visibleItems.map((tx, i) => (
                      <TxRow key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleCount < filtered.length && (
                <div className="p-3 border-t border-border/10 text-center">
                  <button
                    onClick={loadMore}
                    className="inline-flex items-center gap-2 h-8 px-4 rounded-xl text-[10px] font-display font-bold text-muted-foreground/30 hover:text-foreground hover:bg-muted/8 transition-all duration-300"
                  >
                    <ChevronDown className="h-3 w-3" /> Carregar mais ({filtered.length - visibleCount} restantes)
                  </button>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      {/* ─── Mobile Cards ─── */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <Panel className="py-16 text-center">
            <div className="h-8 w-8 border-2 border-primary/15 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[11px] font-display font-bold text-muted-foreground/30">Carregando...</p>
          </Panel>
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={<FileText className="h-7 w-7" />} title="Nenhuma transação" subtitle="Tente ajustar os filtros" />
        ) : (
          <>
            {visibleItems.map((tx, i) => (
              <TxCard key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
            ))}
            {visibleCount < filtered.length && (
              <button
                onClick={loadMore}
                className="w-full h-10 rounded-2xl border border-dashed border-border/15 flex items-center justify-center gap-2 text-[10px] font-display font-bold text-muted-foreground/20 hover:text-muted-foreground/50 hover:border-border/30 transition-all duration-300"
              >
                <ChevronDown className="h-3 w-3" /> Carregar mais ({filtered.length - visibleCount} restantes)
              </button>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedTx && (
        <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} />
      )}
    </PageShell>
  );
}
