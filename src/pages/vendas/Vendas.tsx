import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
  ShoppingCart, DollarSign, TrendingUp, CreditCard, Search, X,
  Phone, Mail, Calendar as CalendarIcon, Clock, Hash, Package, ArrowUpRight,
  RefreshCw, Copy, Check, Users, Eye, MessageCircle, ChevronDown,
  Download, Smartphone, FileText, BarChart3, ArrowDownRight, Zap, Filter,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ─── Formatters (cached) ─── */
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

/* ─── Premium KPI Card ─── */
function VendasKpi({ label, value, sub, icon: Icon, gradient, glowColor, trend, trendUp }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>;
  gradient: string; glowColor: string; trend?: string; trendUp?: boolean;
}) {
  return (
    <div className="group relative panel-enterprise overflow-hidden p-5">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 120%, ${glowColor}, transparent)` }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="kicker">{label}</span>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg", gradient)}>
            <Icon className="h-[18px] w-[18px] text-white" />
          </div>
        </div>
        <p className="text-[26px] md:text-[28px] font-display font-black text-foreground leading-none tracking-tight">{value}</p>
        <div className="flex items-center gap-2 mt-2">
          {trend && (
            <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md", trendUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
              {trendUp ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
              {trend}
            </span>
          )}
          {sub && <p className="text-[11px] text-muted-foreground/50 font-medium">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Transaction Row (Desktop) ─── */
function TxRow({ tx, products, onClick }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void;
}) {
  const methodConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pix: { icon: <Smartphone className="h-3 w-3" />, label: "PIX", color: "text-success bg-success/8 border-success/15" },
    credit_card: { icon: <CreditCard className="h-3 w-3" />, label: "Cartão", color: "text-info bg-info/8 border-info/15" },
    boleto: { icon: <FileText className="h-3 w-3" />, label: "Boleto", color: "text-warning bg-warning/8 border-warning/15" },
  };
  const method = methodConfig[tx.payment_method || ""] || { icon: null, label: tx.payment_method || "—", color: "text-muted-foreground bg-muted/30 border-border/30" };

  return (
    <tr onClick={onClick} className="border-b border-border/15 hover:bg-primary/[0.03] transition-all cursor-pointer group">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-primary font-bold text-sm">{(tx.customer_name || "?")[0].toUpperCase()}</span>
          </div>
          <div>
            <p className="text-foreground font-semibold text-[13px] leading-tight">{tx.customer_name || "—"}</p>
            <p className="text-muted-foreground/40 text-[11px] mt-0.5">{tx.customer_email || ""}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        {tx.customer_phone ? (
          <a
            href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-success bg-success/8 hover:bg-success/15 px-2.5 py-1.5 rounded-lg transition-all border border-success/15"
          >
            <MessageCircle className="h-3 w-3" />
            <span className="hidden xl:inline">{tx.customer_phone}</span>
            <span className="xl:hidden">WhatsApp</span>
          </a>
        ) : (
          <span className="text-muted-foreground/20 text-[11px]">—</span>
        )}
      </td>
      <td className="p-4">
        <span className="text-foreground/70 text-[12px] font-medium max-w-[140px] truncate block">{tx.product_id ? (products[tx.product_id] || tx.product_id.slice(0, 8)) : "—"}</span>
      </td>
      <td className="p-4">
        <div>
          <span className="font-display font-black text-foreground text-[15px] block">{fmt(Number(tx.net_amount))}</span>
          {Number(tx.fee_amount) > 0 && (
            <span className="text-[10px] text-muted-foreground/35 font-medium">taxa: {fmt(Number(tx.fee_amount))}</span>
          )}
        </div>
      </td>
      <td className="p-4">
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border", method.color)}>
          {method.icon}
          {method.label}
        </span>
      </td>
      <td className="p-4"><StatusBadge status={tx.status} /></td>
      <td className="p-4">
        <div>
          <p className="text-foreground/50 text-[12px] font-medium">{fmtDate(tx.created_at)}</p>
          <p className="text-muted-foreground/30 text-[10px]">{fmtTime(tx.created_at)}</p>
        </div>
      </td>
      <td className="p-4">
        <div className="h-8 w-8 rounded-lg bg-muted/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:bg-primary/8 group-hover:border group-hover:border-primary/15">
          <Eye className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
        </div>
      </td>
    </tr>
  );
}

/* ─── Transaction Card (Mobile) ─── */
function TxCard({ tx, products, onClick }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void;
}) {
  const methodLabels: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto" };
  return (
    <div className="panel-enterprise cursor-pointer active:scale-[0.98] transition-all p-4" onClick={onClick}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-primary font-bold text-sm">{(tx.customer_name || "?")[0].toUpperCase()}</span>
          </div>
          <div>
            <p className="text-foreground font-bold text-[14px] leading-tight">{tx.customer_name || "Cliente"}</p>
            <p className="text-muted-foreground/40 text-[11px] mt-0.5">{tx.customer_email || ""}</p>
          </div>
        </div>
        <StatusBadge status={tx.status} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-foreground font-display font-black text-[22px] leading-none">{fmt(Number(tx.net_amount))}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-muted-foreground/50 text-[10px] bg-muted/40 border border-border/30 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">{methodLabels[tx.payment_method || ""] || tx.payment_method || "—"}</span>
            <span className="text-muted-foreground/30 text-[10px] font-medium">{tx.product_id ? products[tx.product_id] || "Produto" : "—"}</span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <p className="text-muted-foreground/40 text-[11px] font-medium">{fmtDate(tx.created_at)}</p>
          {tx.customer_phone && (
            <a
              href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="h-9 w-9 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success hover:bg-success/20 transition-colors shadow-sm"
            >
              <MessageCircle className="h-4 w-4" />
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
    toast.success("ID copiado!");
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border/60 bg-card shadow-2xl animate-scale-in">
        {/* Top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-info rounded-t-2xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] to-transparent rounded-2xl pointer-events-none" />

        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-border/40 bg-card/95 backdrop-blur-xl rounded-t-2xl">
          <div>
            <p className="kicker mb-1.5">Detalhes da Venda</p>
            <div className="flex items-center gap-3">
              <StatusBadge status={tx.status} />
              <span className="text-[28px] font-display font-black text-foreground">{fmt(Number(tx.amount))}</span>
            </div>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-xl flex items-center justify-center bg-muted/40 border border-border/60 hover:bg-muted/80 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="relative p-6 space-y-6">
          {/* Financial Summary */}
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-primary/[0.04] to-transparent p-5">
            <p className="kicker mb-4">Resumo Financeiro</p>
            <div className="space-y-3">
              <DetailRow label="Valor bruto" value={fmt(Number(tx.amount))} icon={<DollarSign className="h-3 w-3" />} />
              <DetailRow label="Taxa da plataforma" value={`- ${fmt(Number(tx.fee_amount))}`} className="text-destructive" icon={<ArrowDownRight className="h-3 w-3" />} />
              <div className="border-t border-border/30 pt-3 mt-3">
                <DetailRow label="Valor líquido (seu)" value={fmt(Number(tx.net_amount))} className="text-primary" bold icon={<Zap className="h-3 w-3" />} />
              </div>
            </div>
          </div>

          {/* Sale Info */}
          <div className="space-y-3">
            <p className="kicker">Informações da Venda</p>
            <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-3">
              <DetailRow label="ID da venda" value={
                <button onClick={() => handleCopyId(tx.id)} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-foreground/80 hover:text-primary transition-colors bg-muted/30 px-2 py-1 rounded-md border border-border/30">
                  {tx.id.slice(0, 16)}...
                  {copiedId ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground/40" />}
                </button>
              } icon={<Hash className="h-3 w-3" />} />
              <DetailRow label="Método" value={tx.payment_method === "credit_card" ? "Cartão de crédito" : tx.payment_method === "pix" ? "PIX" : tx.payment_method || "—"} icon={<CreditCard className="h-3 w-3" />} />
              <DetailRow label="Data" value={fmtFull(tx.created_at)} icon={<CalendarIcon className="h-3 w-3" />} />
              {tx.product_id && (
                <DetailRow label="Produto" value={products[tx.product_id] || tx.product_id.slice(0, 12)} icon={<Package className="h-3 w-3" />} />
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-3">
            <p className="kicker">Cliente</p>
            <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-3">
              <DetailRow label="Nome" value={tx.customer_name || "—"} icon={<Users className="h-3 w-3" />} />
              <DetailRow label="Email" value={tx.customer_email || "—"} icon={<Mail className="h-3 w-3" />} />
              <DetailRow label="Telefone" value={tx.customer_phone || "—"} icon={<Phone className="h-3 w-3" />} />
              {tx.customer_document && (
                <DetailRow label="CPF/CNPJ" value={tx.customer_document} icon={<Hash className="h-3 w-3" />} />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {tx.customer_phone && (
              <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button variant="outline" className="w-full gap-2 rounded-xl h-11 border-success/20 text-success hover:bg-success/5 font-bold text-[13px]">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </a>
            )}
            {tx.status === "completed" && (
              <Button variant="outline" className="flex-1 gap-2 rounded-xl h-11 border-destructive/20 text-destructive hover:bg-destructive/5 font-bold text-[13px]" onClick={() => onRefund(tx)}>
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
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2 text-muted-foreground/50 text-[12px]">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`text-[13px] ${bold ? "font-black text-base" : "font-semibold"} ${className || "text-foreground"}`}>{value}</span>
    </div>
  );
}

/* ─── Date Range Picker ─── */
function DateRangePicker({ datePreset, setDatePreset, customFrom, setCustomFrom, customTo, setCustomTo }: {
  datePreset: DatePreset; setDatePreset: (v: DatePreset) => void;
  customFrom: Date | undefined; setCustomFrom: (v: Date | undefined) => void;
  customTo: Date | undefined; setCustomTo: (v: Date | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DATE_PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => setDatePreset(p.value)}
          className={cn(
            "px-3 py-2 rounded-lg text-[11px] font-bold transition-all border",
            datePreset === p.value
              ? "bg-primary/10 text-primary border-primary/25 shadow-md shadow-primary/5"
              : "bg-card/60 text-muted-foreground/60 border-border/30 hover:border-border/50 hover:text-foreground"
          )}
        >
          {p.label}
        </button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(
            "px-3 py-2 rounded-lg text-[11px] font-bold transition-all border inline-flex items-center gap-1.5",
            datePreset === "custom"
              ? "bg-primary/10 text-primary border-primary/25 shadow-md shadow-primary/5"
              : "bg-card/60 text-muted-foreground/60 border-border/30 hover:border-border/50 hover:text-foreground"
          )}>
            <CalendarIcon className="h-3 w-3" />
            {datePreset === "custom" && customFrom && customTo
              ? `${format(customFrom, "dd/MM", { locale: ptBR })} - ${format(customTo, "dd/MM", { locale: ptBR })}`
              : "Personalizado"
            }
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b border-border/40">
            <p className="text-xs font-bold text-foreground mb-1">Selecionar período</p>
            <p className="text-[10px] text-muted-foreground/60">Escolha a data de início e fim</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-0 sm:gap-2">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground px-3 pt-2">De:</p>
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={(d) => { setCustomFrom(d); setDatePreset("custom"); }}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground px-3 pt-2">Até:</p>
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={(d) => { setCustomTo(d); setDatePreset("custom"); }}
                locale={ptBR}
                disabled={(date) => customFrom ? date < customFrom : false}
                className={cn("p-3 pointer-events-auto")}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ═══════════════════════════════════ MAIN ═══════════════════════════════════ */

export default function Vendas() {
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

  // Date range computation
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

  // Date-filtered transactions
  const dateFiltered = useMemo(() => {
    if (!dateRange) return transactions;
    return transactions.filter(t => {
      const d = new Date(t.created_at);
      return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
    });
  }, [transactions, dateRange]);

  const approved = useMemo(() => dateFiltered.filter((t) => t.status === "completed"), [dateFiltered]);
  const totalSales = useMemo(() => approved.reduce((a, t) => a + Number(t.net_amount), 0), [approved]);
  const avgTicket = useMemo(() => approved.length > 0 ? totalSales / approved.length : 0, [approved, totalSales]);
  const conversion = useMemo(() => dateFiltered.length > 0 ? (approved.length / dateFiltered.length) * 100 : 0, [approved, dateFiltered]);
  const totalGross = useMemo(() => approved.reduce((a, t) => a + Number(t.amount), 0), [approved]);

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

  const handleRefund = async (_tx: Tables<"transactions">) => {
    toast.info("Para solicitar reembolso, entre em contato com o suporte.");
  };

  const statusFilters = useMemo(() => {
    const counts: Record<string, number> = { all: dateFiltered.length, completed: 0, pending: 0, failed: 0, refunded: 0, chargeback: 0 };
    for (const t of dateFiltered) {
      if (t.status in counts) counts[t.status]++;
    }
    return [
      { label: "Todas", value: "all" as StatusFilter, count: counts.all, color: "" },
      { label: "Aprovadas", value: "completed" as StatusFilter, count: counts.completed, color: "text-success" },
      { label: "Pendentes", value: "pending" as StatusFilter, count: counts.pending, color: "text-warning" },
      { label: "Falhas", value: "failed" as StatusFilter, count: counts.failed, color: "text-destructive" },
      { label: "Reembolsos", value: "refunded" as StatusFilter, count: counts.refunded, color: "text-info" },
      { label: "Chargebacks", value: "chargeback" as StatusFilter, count: counts.chargeback, color: "text-destructive" },
    ];
  }, [dateFiltered]);

  const loadMore = useCallback(() => setVisibleCount((c) => c + PAGE_SIZE), []);

  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) { toast.error("Nenhuma transação para exportar."); return; }
    const headers = ["ID", "Cliente", "Email", "Telefone", "Produto", "Valor Bruto", "Taxa", "Líquido", "Método", "Status", "Data"];
    const rows = filtered.map(t => [
      t.id, t.customer_name || "", t.customer_email || "", t.customer_phone || "",
      t.product_id ? products[t.product_id] || "" : "", Number(t.amount), Number(t.fee_amount), Number(t.net_amount),
      t.payment_method || "", t.status, t.created_at,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vendas-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação concluída!");
  }, [filtered, products]);

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageTitle icon={<ShoppingCart className="h-6 w-6" />} title="Minhas Vendas" subtitle="Gerencie transações, clientes e receita" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 rounded-xl h-10 border-border/60 text-muted-foreground hover:text-foreground font-bold text-[12px]">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="panel-enterprise p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <span className="text-[12px] font-bold text-foreground">Período</span>
        </div>
        <DateRangePicker
          datePreset={datePreset} setDatePreset={setDatePreset}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <VendasKpi label="Receita Líquida" value={fmt(totalSales)} sub={`${approved.length} aprovadas`} icon={DollarSign} gradient="from-primary to-primary/80" glowColor="hsl(152 55% 40% / 0.12)" trend={approved.length > 0 ? `${conversion.toFixed(0)}% conv.` : undefined} trendUp={conversion > 50} />
        <VendasKpi label="Faturamento Bruto" value={fmt(totalGross)} sub="antes das taxas" icon={BarChart3} gradient="from-info to-info/80" glowColor="hsl(210 70% 50% / 0.12)" />
        <VendasKpi label="Ticket Médio" value={fmt(avgTicket)} sub="por venda aprovada" icon={TrendingUp} gradient="from-warning to-warning/80" glowColor="hsl(38 92% 50% / 0.12)" />
        <VendasKpi label="Total Transações" value={String(dateFiltered.length)} sub={`${statusFilters.find(f => f.value === "pending")?.count || 0} pendentes`} icon={Users} gradient="from-accent-foreground to-accent-foreground/80" glowColor="hsl(152 52% 24% / 0.12)" />
      </div>

      {/* Filters Bar */}
      <div className="panel-enterprise p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, WhatsApp ou ID..."
            className="w-full h-12 pl-12 pr-10 rounded-xl bg-background/60 backdrop-blur-sm border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/25 transition-all text-[16px] md:text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground/30 hover:text-foreground transition-colors" />
            </button>
          )}
        </div>

        {/* Status filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all border",
                statusFilter === f.value
                  ? "bg-primary/10 text-primary border-primary/25 shadow-lg shadow-primary/8"
                  : "bg-card/40 text-muted-foreground/60 border-border/30 hover:border-border/50 hover:bg-card/70 hover:text-foreground"
              )}
            >
              {f.label}
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-md font-black min-w-[24px] text-center",
                statusFilter === f.value ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground/40"
              )}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] text-muted-foreground/50 font-medium">
          {filtered.length === 0
            ? "Nenhuma transação encontrada"
            : `Mostrando ${Math.min(visibleCount, filtered.length)} de ${filtered.length} transações`}
        </p>
        {filtered.length > 0 && (
          <p className="text-[12px] text-primary font-bold">{fmt(filtered.reduce((a, t) => a + Number(t.net_amount), 0))} no período</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block panel-enterprise p-0 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="h-8 w-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground/50 font-medium">Carregando transações...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-gradient-to-r from-muted/20 via-transparent to-muted/20">
                    {["Cliente", "WhatsApp", "Produto", "Líquido", "Método", "Status", "Data", ""].map((h) => (
                      <th key={h} className="text-left p-4 text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.18em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr><td colSpan={8}>
                      <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Nenhuma venda encontrada" subtitle="Tente ajustar os filtros ou período" />
                    </td></tr>
                  ) : visibleItems.map((tx) => (
                    <TxRow key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} />
                  ))}
                </tbody>
              </table>
            </div>
            {visibleCount < filtered.length && (
              <div className="p-4 border-t border-border/15 text-center bg-muted/5">
                <Button variant="ghost" size="sm" onClick={loadMore} className="gap-2 text-xs text-muted-foreground hover:text-foreground font-bold">
                  <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="panel-enterprise p-12 text-center">
            <div className="h-8 w-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground/50 font-medium">Carregando...</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Nenhuma venda" subtitle="Tente ajustar os filtros" />
        ) : (
          <>
            {visibleItems.map((tx) => (
              <TxCard key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} />
            ))}
            {visibleCount < filtered.length && (
              <Button variant="ghost" size="sm" onClick={loadMore} className="w-full gap-2 text-xs text-muted-foreground font-bold">
                <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedTx && (
        <TxDetailModal tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={handleRefund} />
      )}
    </PageShell>
  );
}
