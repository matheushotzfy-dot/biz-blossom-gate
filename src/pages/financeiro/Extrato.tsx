import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import { StatusBadge } from "@/components/StatusBadge";
import {
  FileText, DollarSign, TrendingUp, CreditCard, Search, X,
  Phone, Mail, Calendar as CalendarIcon, Clock, Hash, Package,
  Copy, Check, Users, Eye, MessageCircle, ChevronDown,
  Download, Smartphone, BarChart3, ArrowDownRight, Zap,
  MoreHorizontal, Receipt,
} from "lucide-react";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
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
const fmtFull = (d: string) => `${fmtDate(d)} às ${fmtTime(d)}`;

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

/* ─── KPI Card ─── */
function ExtratoKpi({ label, value, sub, icon: Icon, iconBg, iconColor }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>;
  iconBg: string; iconColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", iconBg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </div>
      <p className="text-2xl font-display font-black text-foreground leading-none tracking-tight">{value}</p>
      {sub && <p className="text-[12px] text-muted-foreground mt-1.5">{sub}</p>}
    </motion.div>
  );
}

/* ─── Transaction Row (Desktop) ─── */
function TxRow({ tx, products, onClick, index }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void; index: number;
}) {
  const methodConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pix: { icon: <Smartphone className="h-3 w-3" />, label: "PIX", color: "text-success bg-success/10" },
    credit_card: { icon: <CreditCard className="h-3 w-3" />, label: "Cartão", color: "text-info bg-info/10" },
    boleto: { icon: <FileText className="h-3 w-3" />, label: "Boleto", color: "text-warning bg-warning/10" },
  };
  const method = methodConfig[tx.payment_method || ""] || { icon: null, label: tx.payment_method || "—", color: "text-muted-foreground bg-muted" };
  const customerName = tx.customer_name || "Cliente";
  const avatarColor = getAvatarColor(customerName);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
      onClick={onClick}
      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group"
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className={cn("text-[11px] font-bold", avatarColor)}>
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground font-medium text-[13px] leading-tight truncate">{customerName}</p>
            {tx.customer_email && <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      <td className="p-4">
        <span className="text-muted-foreground text-[12px] font-medium max-w-[130px] truncate block">{tx.product_id ? (products[tx.product_id] || tx.product_id.slice(0, 8)) : "—"}</span>
      </td>
      <td className="p-4">
        <span className="font-display font-bold text-foreground text-[15px]">{fmt(Number(tx.net_amount))}</span>
      </td>
      <td className="p-4">
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md", method.color)}>
          {method.icon}
          {method.label}
        </span>
      </td>
      <td className="p-4"><StatusBadge status={tx.status} /></td>
      <td className="p-4">
        <div>
          <p className="text-foreground/70 text-[12px] font-medium">{fmtDate(tx.created_at)}</p>
          <p className="text-muted-foreground text-[10px]">{fmtTime(tx.created_at)}</p>
        </div>
      </td>
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[12px]">
              <Eye className="h-3.5 w-3.5" /> Ver Detalhes
            </DropdownMenuItem>
            {tx.customer_phone && (
              <DropdownMenuItem asChild>
                <a
                  href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="gap-2 text-[12px]"
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      className="rounded-xl border border-border bg-card p-4 cursor-pointer active:scale-[0.99] transition-transform"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={cn("text-xs font-bold", avatarColor)}>
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground font-semibold text-[13px] leading-tight truncate">{customerName}</p>
            <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{tx.customer_email || ""}</p>
          </div>
        </div>
        <StatusBadge status={tx.status} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-foreground font-display font-bold text-xl leading-none">
            {fmt(Number(tx.net_amount))}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-muted-foreground text-[10px] bg-muted px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
              {methodLabels[tx.payment_method || ""] || tx.payment_method || "—"}
            </span>
            <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">
              {tx.product_id ? products[tx.product_id] || "Produto" : "—"}
            </span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <p className="text-muted-foreground text-[11px]">{fmtDate(tx.created_at)}</p>
          {tx.customer_phone && (
            <a
              href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center text-success hover:bg-success/15 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Detail Modal ─── */
function TxDetailModal({ tx, products, onClose }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClose: () => void;
}) {
  const [copiedId, setCopiedId] = useState(false);
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    toast.success("ID copiado!");
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-border bg-card rounded-t-xl">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Detalhes da Transação</p>
              <div className="flex items-center gap-3">
                <StatusBadge status={tx.status} />
                <span className="text-2xl font-display font-black text-foreground">{fmt(Number(tx.amount))}</span>
              </div>
            </div>
            <button onClick={onClose} className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumo Financeiro</p>
              <div className="space-y-2.5">
                <DetailRow label="Valor bruto" value={fmt(Number(tx.amount))} icon={<DollarSign className="h-3 w-3" />} />
                <DetailRow label="Taxa da plataforma" value={`- ${fmt(Number(tx.fee_amount))}`} className="text-destructive" icon={<ArrowDownRight className="h-3 w-3" />} />
                <div className="border-t border-border pt-2.5 mt-2.5">
                  <DetailRow label="Valor líquido (seu)" value={fmt(Number(tx.net_amount))} className="text-primary" bold icon={<Zap className="h-3 w-3" />} />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Informações</p>
              <div className="rounded-lg border border-border p-4 space-y-2.5">
                <DetailRow label="ID" value={
                  <button onClick={() => handleCopyId(tx.id)} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-foreground/80 hover:text-primary transition-colors bg-muted px-2 py-1 rounded">
                    {tx.id.slice(0, 16)}...
                    {copiedId ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </button>
                } icon={<Hash className="h-3 w-3" />} />
                <DetailRow label="Método" value={tx.payment_method === "credit_card" ? "Cartão de crédito" : tx.payment_method === "pix" ? "PIX" : tx.payment_method || "—"} icon={<CreditCard className="h-3 w-3" />} />
                <DetailRow label="Data" value={fmtFull(tx.created_at)} icon={<CalendarIcon className="h-3 w-3" />} />
                {tx.product_id && <DetailRow label="Produto" value={products[tx.product_id] || tx.product_id.slice(0, 12)} icon={<Package className="h-3 w-3" />} />}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</p>
              <div className="rounded-lg border border-border p-4 space-y-2.5">
                <DetailRow label="Nome" value={tx.customer_name || "—"} icon={<Users className="h-3 w-3" />} />
                <DetailRow label="Email" value={tx.customer_email || "—"} icon={<Mail className="h-3 w-3" />} />
                <DetailRow label="Telefone" value={tx.customer_phone || "—"} icon={<Phone className="h-3 w-3" />} />
                {tx.customer_document && <DetailRow label="CPF/CNPJ" value={tx.customer_document} icon={<Hash className="h-3 w-3" />} />}
              </div>
            </div>

            {tx.customer_phone && (
              <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full gap-2 rounded-lg h-10 border-success/30 text-success hover:bg-success/5 font-semibold text-[12px]">
                  <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                </Button>
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function DetailRow({ label, value, icon, className = "", bold = false }: { label: string; value: React.ReactNode; icon?: React.ReactNode; className?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2 text-muted-foreground text-[12px]">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`text-[13px] ${bold ? "font-bold text-base" : "font-medium"} ${className || "text-foreground"}`}>{value}</span>
    </div>
  );
}

/* ─── Date Control ─── */
function DateSegmentedControl({ datePreset, setDatePreset, customFrom, setCustomFrom, customTo, setCustomTo }: {
  datePreset: DatePreset; setDatePreset: (v: DatePreset) => void;
  customFrom: Date | undefined; setCustomFrom: (v: Date | undefined) => void;
  customTo: Date | undefined; setCustomTo: (v: Date | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="inline-flex items-center rounded-lg bg-muted/50 border border-border p-1">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setDatePreset(p.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
              datePreset === p.value
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(
            "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border inline-flex items-center gap-1.5",
            datePreset === "custom"
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          )}>
            <CalendarIcon className="h-3 w-3" />
            {datePreset === "custom" && customFrom && customTo
              ? `${format(customFrom, "dd/MM", { locale: ptBR })} - ${format(customTo, "dd/MM", { locale: ptBR })}`
              : "Personalizado"
            }
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-bold text-foreground mb-1">Selecionar período</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-0 sm:gap-2">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground px-3 pt-2">De:</p>
              <Calendar mode="single" selected={customFrom} onSelect={(d) => { setCustomFrom(d); setDatePreset("custom"); }} locale={ptBR} className="p-3 pointer-events-auto" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground px-3 pt-2">Até:</p>
              <Calendar mode="single" selected={customTo} onSelect={(d) => { setCustomTo(d); setDatePreset("custom"); }} locale={ptBR} disabled={(date) => customFrom ? date < customFrom : false} className="p-3 pointer-events-auto" />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ─── Status pill config ─── */
const STATUS_PILL_STYLES: Record<string, { active: string; dot: string }> = {
  all: { active: "bg-primary/10 text-primary border-primary/25", dot: "bg-primary" },
  completed: { active: "bg-success/10 text-success border-success/25", dot: "bg-success" },
  pending: { active: "bg-warning/10 text-warning border-warning/25", dot: "bg-warning" },
  failed: { active: "bg-destructive/10 text-destructive border-destructive/25", dot: "bg-destructive" },
  refunded: { active: "bg-info/10 text-info border-info/25", dot: "bg-info" },
  chargeback: { active: "bg-destructive/10 text-destructive border-destructive/25", dot: "bg-destructive" },
};

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
      { label: "Todas", value: "all" as StatusFilter, count: counts.all },
      { label: "Aprovadas", value: "completed" as StatusFilter, count: counts.completed },
      { label: "Pendentes", value: "pending" as StatusFilter, count: counts.pending },
      { label: "Falhas", value: "failed" as StatusFilter, count: counts.failed },
      { label: "Reembolsos", value: "refunded" as StatusFilter, count: counts.refunded },
      { label: "Chargebacks", value: "chargeback" as StatusFilter, count: counts.chargeback },
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageTitle icon={<Receipt className="h-6 w-6" />} title="Extrato" subtitle="Histórico completo de transações" />
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 rounded-lg h-9 font-semibold text-[12px]">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ExtratoKpi label="Receita Líquida" value={fmt(totalNet)} sub={`${approved.length} aprovadas`} icon={DollarSign} iconBg="bg-primary/10" iconColor="text-primary" />
        <ExtratoKpi label="Faturamento Bruto" value={fmt(totalGross)} sub="antes das taxas" icon={BarChart3} iconBg="bg-info/10" iconColor="text-info" />
        <ExtratoKpi label="Ticket Médio" value={fmt(avgTicket)} sub="por venda aprovada" icon={TrendingUp} iconBg="bg-warning/10" iconColor="text-warning" />
        <ExtratoKpi label="Total Transações" value={String(dateFiltered.length)} sub={`${approved.length} completadas`} icon={Users} iconBg="bg-accent" iconColor="text-accent-foreground" />
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <DateSegmentedControl
            datePreset={datePreset} setDatePreset={setDatePreset}
            customFrom={customFrom} setCustomFrom={setCustomFrom}
            customTo={customTo} setCustomTo={setCustomTo}
          />
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="extrato-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, e-mail, WhatsApp ou ID..."
              className="w-full h-9 pl-10 pr-16 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {search ? (
                <button onClick={() => setSearch("")} className="p-1">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              ) : (
                <kbd className="hidden md:inline-flex items-center gap-0.5 text-[9px] font-semibold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {statusFilters.map((f) => {
            const isActive = statusFilter === f.value;
            const style = STATUS_PILL_STYLES[f.value];
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                  isActive
                    ? style.active
                    : "bg-card text-muted-foreground border-border hover:border-border hover:text-foreground"
                )}
              >
                {isActive && <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />}
                {f.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-bold min-w-[20px] text-center",
                  isActive ? "bg-foreground/10" : "bg-muted text-muted-foreground"
                )}>{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] text-muted-foreground">
          {filtered.length === 0
            ? "Nenhuma transação encontrada"
            : `Mostrando ${Math.min(visibleCount, filtered.length)} de ${filtered.length} transações`}
        </p>
        {filtered.length > 0 && (
          <p className="text-[12px] text-primary font-semibold">{fmt(filtered.reduce((a, t) => a + Number(t.net_amount), 0))} no período</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="h-7 w-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">Carregando transações...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Cliente", "Produto", "Líquido", "Método", "Status", "Data", ""].map((h) => (
                      <th key={h} className="text-left p-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
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
              <div className="p-3 border-t border-border text-center">
                <Button variant="ghost" size="sm" onClick={loadMore} className="gap-2 text-xs text-muted-foreground hover:text-foreground font-semibold">
                  <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="h-7 w-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">Carregando...</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={<FileText className="h-7 w-7" />} title="Nenhuma transação" subtitle="Tente ajustar os filtros" />
        ) : (
          <>
            {visibleItems.map((tx, i) => (
              <TxCard key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
            ))}
            {visibleCount < filtered.length && (
              <Button variant="ghost" size="sm" onClick={loadMore} className="w-full gap-2 text-xs text-muted-foreground font-semibold">
                <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedTx && (
        <TxDetailModal tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} />
      )}
    </PageShell>
  );
}
