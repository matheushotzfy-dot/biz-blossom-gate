import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
  ShoppingCart, DollarSign, TrendingUp, CreditCard, Search, X, EyeOff,
  Phone, Mail, Calendar as CalendarIcon, Clock, Hash, Package, ArrowUpRight,
  RefreshCw, Copy, Check, Users, Eye, MessageCircle, ChevronDown,
  Download, Smartphone, FileText, BarChart3, ArrowDownRight, Zap, Filter,
  MoreHorizontal, ExternalLink, Receipt, CheckSquare, Square, CalendarDays,
  Wallet, Target, PieChart, Award, Activity, TrendingDown, AlertTriangle,
  Percent, UserCheck, Layers, ArrowUp, ArrowDown, ChevronUp, Radio, Flame,
  ArrowUpDown, SortAsc, SortDesc,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { EmptyState } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, subDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import type { DateRange } from "react-day-picker";
import { AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, Line, ComposedChart, Bar } from "recharts";

/* ─── Formatters ─── */
const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtCompact = (v: number) => {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")}K`;
  return fmt(v);
};

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
type SortField = "date" | "amount" | "net" | "customer";
type SortDir = "asc" | "desc";

const CENSORED = "••••••";

const PERIOD_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
] as const;
type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const PAGE_SIZE = 50;

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

/* ─── Status Dot ─── */
const STATUS_DOT_STYLES: Record<string, { dot: string; glow: string }> = {
  completed: { dot: "bg-success", glow: "shadow-[0_0_8px_hsl(var(--success)/0.6)]" },
  pending: { dot: "bg-warning", glow: "shadow-[0_0_8px_hsl(var(--warning)/0.6)]" },
  failed: { dot: "bg-destructive", glow: "shadow-[0_0_8px_hsl(var(--destructive)/0.6)]" },
  refunded: { dot: "bg-info", glow: "shadow-[0_0_8px_hsl(var(--info)/0.6)]" },
  chargeback: { dot: "bg-destructive", glow: "shadow-[0_0_8px_hsl(var(--destructive)/0.6)]" },
};

function StatusDot({ status }: { status: string }) {
  const s = STATUS_DOT_STYLES[status] || { dot: "bg-muted-foreground", glow: "" };
  return (
    <span className="flex items-center justify-center h-5 w-5">
      <span className={cn("h-2.5 w-2.5 rounded-full animate-pulse", s.dot, s.glow)} />
    </span>
  );
}

/* ─── Sparkline (pure SVG) ─── */
function Sparkline({ data, color = "hsl(var(--primary))", className }: { data: number[]; color?: string; className?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 24;
  const w = 60;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("overflow-visible", className)} style={{ width: w, height: h }}>
      <defs>
        <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, "")})`}
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Hourly Heatmap ─── */
function HourlyHeatmap({ transactions }: { transactions: Tables<"transactions">[] }) {
  const hourData = useMemo(() => {
    const hours = Array(24).fill(0);
    transactions.filter(t => t.status === "completed").forEach(t => {
      const h = new Date(t.created_at).getHours();
      hours[h]++;
    });
    const max = Math.max(...hours, 1);
    return hours.map((count, hour) => ({ hour, count, intensity: count / max }));
  }, [transactions]);

  return (
    <div className="space-y-2">
      <div className="flex gap-[3px]">
        {hourData.map(({ hour, count, intensity }) => (
          <div key={hour} className="flex-1 group relative">
            <div
              className="h-6 rounded-[3px] transition-all duration-300 cursor-default"
              style={{
                backgroundColor: intensity > 0
                  ? `hsl(var(--primary) / ${0.1 + intensity * 0.7})`
                  : "hsl(var(--muted) / 0.15)",
              }}
            />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div className="bg-popover border border-border rounded-lg px-2 py-1 text-[10px] font-semibold text-foreground whitespace-nowrap shadow-lg">
                {hour}h: {count} vendas
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[8px] text-muted-foreground/40 font-bold tracking-wider">
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
    </div>
  );
}

/* ─── Revenue Bar (inline mini chart) ─── */
function RevenueBar({ label, value, total, color, count, icon }: { label: string; value: number; total: number; color: string; count: number; icon: React.ReactNode }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/10 transition-colors -mx-2">
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", color.replace("bg-", "bg-") + "/10")}>
        <span className={cn("h-3.5 w-3.5", color.replace("bg-", "text-"))}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-foreground">{label}</span>
          <span className="text-[11px] font-bold text-foreground tabular-nums">{fmt(value)}</span>
        </div>
        <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className={cn("h-full rounded-full", color)}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] text-muted-foreground/50 tabular-nums">{count} transações</span>
          <span className="text-[9px] text-muted-foreground/50 tabular-nums font-bold">{pct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Top Product Row ─── */
function TopProductRow({ rank, name, revenue, sales, maxRevenue }: { rank: number; name: string; revenue: number; sales: number; maxRevenue: number }) {
  const pct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
  const medalColors = ["text-warning", "text-muted-foreground/60", "text-[#cd7f32]"];
  const medalEmoji = ["🥇", "🥈", "🥉"];
  return (
    <div className="flex items-center gap-3 py-2.5 group hover:bg-muted/5 -mx-2 px-2 rounded-lg transition-colors">
      <span className="text-[14px] w-6 text-center shrink-0">
        {rank <= 3 ? medalEmoji[rank - 1] : <span className="text-[12px] font-bold text-muted-foreground/30 tabular-nums">{rank}</span>}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-foreground truncate">{name}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: rank * 0.1 }}
              className="h-full rounded-full bg-primary/60"
            />
          </div>
          <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">{sales} vendas</span>
        </div>
      </div>
      <span className="text-[12px] font-bold text-foreground tabular-nums">{fmt(revenue)}</span>
    </div>
  );
}

/* ─── Delta Badge ─── */
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="text-[9px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-md">NOVO</span>;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct >= 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md",
      isUp ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
    )}>
      {isUp ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/* ─── Live Pulse ─── */
function LivePulse({ lastSaleAt }: { lastSaleAt: string | null }) {
  if (!lastSaleAt) return null;
  const timeAgo = formatDistanceToNow(new Date(lastSaleAt), { locale: ptBR, addSuffix: true });
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
      </span>
      <span className="text-[10px] font-semibold text-success">Última venda {timeAgo}</span>
    </div>
  );
}

/* ─── Sortable Column Header ─── */
function SortableHeader({ label, field, currentSort, onSort }: {
  label: string; field: SortField; currentSort: { field: SortField; dir: SortDir };
  onSort: (f: SortField) => void;
}) {
  const isActive = currentSort.field === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="text-left px-5 py-4 text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] cursor-pointer select-none hover:text-muted-foreground transition-colors group"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          currentSort.dir === "desc"
            ? <SortDesc className="h-3 w-3 text-primary" />
            : <SortAsc className="h-3 w-3 text-primary" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
        )}
      </span>
    </th>
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

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tx.customer_phone) {
      navigator.clipboard.writeText(tx.customer_phone);
      toast.success("WhatsApp copiado!");
    }
  };

  const statusAccent: Record<string, { border: string; bg: string }> = {
    completed: { border: "border-l-success", bg: "hover:bg-success/[0.04]" },
    pending: { border: "border-l-warning", bg: "hover:bg-warning/[0.04]" },
    failed: { border: "border-l-destructive", bg: "hover:bg-destructive/[0.04]" },
    refunded: { border: "border-l-info", bg: "hover:bg-info/[0.04]" },
    chargeback: { border: "border-l-destructive", bg: "hover:bg-destructive/[0.04]" },
  };
  const accent = statusAccent[tx.status] || { border: "border-l-muted-foreground", bg: "hover:bg-muted/10" };

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
      onClick={onClick}
      className={cn(
        "border-b border-border/20 dark:border-foreground/[0.03] transition-all cursor-pointer group border-l-[3px]",
        accent.border,
        accent.bg
      )}
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/20">
            <AvatarFallback className={cn("text-[11px] font-bold", avatarColor)}>
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground font-semibold text-[13px] leading-tight truncate">{customerName}</p>
            {tx.customer_email && <p className="text-muted-foreground/60 text-[11px] mt-0.5 truncate">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      <td className="p-4">
        <span className="text-muted-foreground text-[12px] font-medium max-w-[130px] truncate block">{tx.product_id ? (products[tx.product_id] || tx.product_id.slice(0, 8)) : "—"}</span>
      </td>
      <td className="p-4">
        <div>
          <span className="font-display font-black text-foreground text-[15px] block tracking-[-0.02em] tabular-nums">
            {fmt(Number(tx.amount))}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground/50 font-medium">líq: {fmt(Number(tx.net_amount))}</span>
            {Number(tx.fee_amount) > 0 && (
              <span className="text-[10px] text-destructive/50 font-medium">-{fmt(Number(tx.fee_amount))}</span>
            )}
          </div>
        </div>
      </td>
      <td className="p-4">
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg", method.color)}>
          {method.icon}
          {method.label}
        </span>
      </td>
      <td className="p-4">
        <StatusDot status={tx.status} />
      </td>
      <td className="p-4">
        <div>
          <p className="text-foreground/70 text-[12px] font-medium tabular-nums">{fmtDate(tx.created_at)}</p>
          <p className="text-muted-foreground/40 text-[10px] tabular-nums">{fmtTime(tx.created_at)}</p>
        </div>
      </td>
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[12px]">
              <Eye className="h-3.5 w-3.5" /> Ver Detalhes
            </DropdownMenuItem>
            {tx.customer_phone && (
              <>
                <DropdownMenuItem onClick={handleCopyPhone} className="gap-2 text-[12px]">
                  <Copy className="h-3.5 w-3.5" /> Copiar WhatsApp
                </DropdownMenuItem>
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
              </>
            )}
            {tx.status === "completed" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Para solicitar reembolso, entre em contato com o suporte."); }} className="gap-2 text-[12px] text-destructive focus:text-destructive">
                  <RefreshCw className="h-3.5 w-3.5" /> Reembolsar
                </DropdownMenuItem>
              </>
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

  const statusBorderMobile: Record<string, string> = {
    completed: "border-l-success",
    pending: "border-l-warning",
    failed: "border-l-destructive",
    refunded: "border-l-info",
    chargeback: "border-l-destructive",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      className={cn(
        "rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4 cursor-pointer active:scale-[0.99] transition-all border-l-[3px]",
        statusBorderMobile[tx.status] || "border-l-muted-foreground"
      )}
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
        <StatusDot status={tx.status} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-foreground font-display font-bold text-xl leading-none">
            {fmt(Number(tx.amount))}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">líq: {fmt(Number(tx.net_amount))}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-muted-foreground text-[10px] bg-muted/50 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
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

/* ─── Status pill config ─── */
const STATUS_PILL_STYLES: Record<string, { active: string; dot: string }> = {
  all: { active: "bg-primary/10 text-primary", dot: "bg-primary" },
  completed: { active: "bg-success/10 text-success", dot: "bg-success" },
  pending: { active: "bg-warning/10 text-warning", dot: "bg-warning" },
  failed: { active: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  refunded: { active: "bg-info/10 text-info", dot: "bg-info" },
  chargeback: { active: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

/* ─── Export Dialog ─── */
const ALL_STATUSES = [
  { value: "completed", label: "Aprovadas", dot: "bg-success" },
  { value: "pending", label: "Pendentes", dot: "bg-warning" },
  { value: "failed", label: "Falhas", dot: "bg-destructive" },
  { value: "expired", label: "Expiradas", dot: "bg-muted-foreground" },
  { value: "refunded", label: "Reembolsos", dot: "bg-info" },
  { value: "chargeback", label: "Chargebacks", dot: "bg-destructive" },
];
const ALL_METHODS = [
  { value: "pix", label: "PIX", icon: Smartphone },
  { value: "credit_card", label: "Cartão", icon: CreditCard },
  { value: "boleto", label: "Boleto", icon: FileText },
];

function ExportDialog({ open, onOpenChange, transactions, products, productsRaw, onExport }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  transactions: Tables<"transactions">[];
  products: Record<string, string>;
  productsRaw: any[];
  onExport: (txList: Tables<"transactions">[]) => void;
}) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(ALL_STATUSES.map(s => s.value)));
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set(ALL_METHODS.map(m => m.value)));
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set(["all"]));

  const toggleStatus = (v: string) => {
    setSelectedStatuses(prev => { const next = new Set(prev); next.has(v) ? next.delete(v) : next.add(v); return next; });
  };
  const toggleMethod = (v: string) => {
    setSelectedMethods(prev => { const next = new Set(prev); next.has(v) ? next.delete(v) : next.add(v); return next; });
  };
  const toggleProduct = (id: string) => {
    if (id === "all") { setSelectedProducts(new Set(["all"])); return; }
    setSelectedProducts(prev => {
      const next = new Set(prev); next.delete("all"); next.has(id) ? next.delete(id) : next.add(id);
      if (next.size === 0) next.add("all"); return next;
    });
  };

  const selectAllStatuses = () => setSelectedStatuses(new Set(ALL_STATUSES.map(s => s.value)));
  const clearAllStatuses = () => setSelectedStatuses(new Set());
  const selectAllMethods = () => setSelectedMethods(new Set(ALL_METHODS.map(m => m.value)));
  const clearAllMethods = () => setSelectedMethods(new Set());

  const exportFiltered = useMemo(() => {
    return transactions.filter(t => {
      if (!selectedStatuses.has(t.status)) return false;
      if (t.payment_method && !selectedMethods.has(t.payment_method)) return false;
      if (!selectedProducts.has("all") && t.product_id && !selectedProducts.has(t.product_id)) return false;
      return true;
    });
  }, [transactions, selectedStatuses, selectedMethods, selectedProducts]);

  const handleExport = () => { onExport(exportFiltered); onOpenChange(false); };

  const txProducts = useMemo(() => {
    const ids = new Set(transactions.map(t => t.product_id).filter(Boolean) as string[]);
    return Array.from(ids).map(id => ({ id, name: products[id] || id.slice(0, 8) }));
  }, [transactions, products]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/40 dark:border-foreground/[0.06] bg-card/95 dark:bg-card/90 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" /> Exportar Vendas
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">
            Escolha os filtros para a exportação CSV
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
              <div className="flex items-center gap-2">
                <button onClick={clearAllStatuses} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline font-medium">Limpar</button>
                <span className="text-muted-foreground/30">|</span>
                <button onClick={selectAllStatuses} className="text-[10px] text-primary hover:underline font-medium">Todos</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => {
                const active = selectedStatuses.has(s.value);
                return (
                  <button key={s.value} onClick={() => toggleStatus(s.value)} className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                    active ? "border-primary/30 bg-primary/10 text-primary" : "border-border/30 dark:border-foreground/[0.06] text-muted-foreground hover:border-border/50"
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", active ? s.dot : "bg-muted-foreground/30")} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Método de Pagamento</p>
              <div className="flex items-center gap-2">
                <button onClick={clearAllMethods} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline font-medium">Limpar</button>
                <span className="text-muted-foreground/30">|</span>
                <button onClick={selectAllMethods} className="text-[10px] text-primary hover:underline font-medium">Todos</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_METHODS.map(m => {
                const active = selectedMethods.has(m.value);
                const Icon = m.icon;
                return (
                  <button key={m.value} onClick={() => toggleMethod(m.value)} className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                    active ? "border-primary/30 bg-primary/10 text-primary" : "border-border/30 dark:border-foreground/[0.06] text-muted-foreground hover:border-border/50"
                  )}>
                    <Icon className="h-3 w-3" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          {txProducts.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Produtos</p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                <button onClick={() => toggleProduct("all")} className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left",
                  selectedProducts.has("all") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30"
                )}>
                  {selectedProducts.has("all") ? <CheckSquare className="h-3.5 w-3.5 shrink-0" /> : <Square className="h-3.5 w-3.5 shrink-0" />}
                  Todos os produtos
                </button>
                {txProducts.map(p => {
                  const active = selectedProducts.has(p.id);
                  return (
                    <button key={p.id} onClick={() => toggleProduct(p.id)} className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30"
                    )}>
                      {active ? <CheckSquare className="h-3.5 w-3.5 shrink-0" /> : <Square className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="rounded-lg bg-muted/20 dark:bg-foreground/[0.03] border border-border/30 dark:border-foreground/[0.05] p-3 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-foreground">{exportFiltered.length} transações</p>
              <p className="text-[10px] text-muted-foreground">serão exportadas</p>
            </div>
            <p className="text-[14px] font-bold text-primary font-display">
              {fmt(exportFiltered.reduce((a, t) => a + Number(t.net_amount), 0))}
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-lg h-10 text-[12px] font-medium">Cancelar</Button>
          <Button onClick={handleExport} disabled={exportFiltered.length === 0} className="flex-1 rounded-lg h-10 gap-2 text-[12px] font-medium">
            <Download className="h-3.5 w-3.5" /> Exportar {exportFiltered.length > 0 ? `(${exportFiltered.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Revenue Chart with comparison ─── */
function RevenueChart({ data, hidden }: { data: { label: string; value: number; previous: number }[]; hidden: boolean }) {
  if (data.length < 2 || hidden) {
    return (
      <div className="h-[160px] flex items-center justify-center text-[11px] text-muted-foreground/40">
        {hidden ? "Valores ocultos" : "Dados insuficientes"}
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis hide domain={["auto", "auto"]} />
        <ReTooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11, padding: "8px 12px" }}
          formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
          labelStyle={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}
        />
        <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" fill="none" opacity={0.3} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#chartGrad)" />
      </ComposedChart>
    </ResponsiveContainer>
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
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[2]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "date", dir: "desc" });
  const [privacyHidden, setPrivacyHidden] = useState(() => {
    try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; }
  });
  const togglePrivacy = useCallback(() => {
    setPrivacyHidden(prev => {
      const next = !prev;
      try { localStorage.setItem("privacy_mode", String(next)); } catch {}
      return next;
    });
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === "desc" ? "asc" : "desc" } : { field, dir: "desc" });
  }, []);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, statusFilter, selectedPeriod, isCustom, customRange]);

  const brasiliaToday = useCallback(() => {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = f.formatToParts(new Date());
    const y = parts.find(p => p.type === "year")!.value;
    const m = parts.find(p => p.type === "month")!.value;
    const d = parts.find(p => p.type === "day")!.value;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }, []);

  const toBrasiliaDate = useCallback((dateStr: string) => {
    let cached = _dateCache.get(dateStr);
    if (!cached) {
      cached = new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      _dateCache.set(dateStr, cached);
    }
    return cached;
  }, []);

  /* ─── Date filtering ─── */
  const { dateFiltered, previousPeriodFiltered } = useMemo(() => {
    const today = brasiliaToday();

    const filterByRange = (txs: Tables<"transactions">[], start: Date, end: Date) =>
      txs.filter(t => { const d = new Date(t.created_at); return d >= start && d <= end; });

    if (isCustom && customRange?.from) {
      const start = new Date(customRange.from);
      start.setHours(0, 0, 0, 0);
      const end = customRange.to ? new Date(customRange.to) : new Date(customRange.from);
      end.setHours(23, 59, 59, 999);
      const rangeDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
      const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1); prevEnd.setHours(23, 59, 59, 999);
      const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - rangeDays + 1); prevStart.setHours(0, 0, 0, 0);
      return { dateFiltered: filterByRange(transactions, start, end), previousPeriodFiltered: filterByRange(transactions, prevStart, prevEnd) };
    }

    if (selectedPeriod.days === 0) {
      const todayStr = today.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return {
        dateFiltered: transactions.filter(t => toBrasiliaDate(t.created_at) === todayStr),
        previousPeriodFiltered: transactions.filter(t => toBrasiliaDate(t.created_at) === yesterdayStr),
      };
    }

    if (selectedPeriod.days === 1) {
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const dayBefore = new Date(today); dayBefore.setDate(dayBefore.getDate() - 2);
      const yesterdayStr = yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const dayBeforeStr = dayBefore.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return {
        dateFiltered: transactions.filter(t => toBrasiliaDate(t.created_at) === yesterdayStr),
        previousPeriodFiltered: transactions.filter(t => toBrasiliaDate(t.created_at) === dayBeforeStr),
      };
    }

    const start = new Date(today); start.setDate(start.getDate() - selectedPeriod.days); start.setHours(0, 0, 0, 0);
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - selectedPeriod.days);
    return {
      dateFiltered: transactions.filter(t => new Date(t.created_at) >= start),
      previousPeriodFiltered: transactions.filter(t => { const d = new Date(t.created_at); return d >= prevStart && d < start; }),
    };
  }, [transactions, selectedPeriod, isCustom, customRange, brasiliaToday, toBrasiliaDate]);

  /* ─── Current period metrics ─── */
  const metrics = useMemo(() => {
    const calc = (txs: Tables<"transactions">[]) => {
      const _approved = txs.filter(t => t.status === "completed");
      const _pending = txs.filter(t => t.status === "pending");
      const _refunded = txs.filter(t => t.status === "refunded");
      const _chargebacks = txs.filter(t => t.status === "chargeback");
      const _failed = txs.filter(t => t.status === "failed");
      const _totalNet = _approved.reduce((a, t) => a + Number(t.net_amount), 0);
      const _totalGross = _approved.reduce((a, t) => a + Number(t.amount), 0);
      const _totalFees = _approved.reduce((a, t) => a + Number(t.fee_amount), 0);
      const _avgTicket = _approved.length > 0 ? _totalNet / _approved.length : 0;
      const _conversion = txs.length > 0 ? (_approved.length / txs.length) * 100 : 0;
      const _pixApproved = _approved.filter(t => t.payment_method === "pix");
      const _cardApproved = _approved.filter(t => t.payment_method === "credit_card");
      const _boletoApproved = _approved.filter(t => t.payment_method === "boleto");
      const _pixRevenue = _pixApproved.reduce((a, t) => a + Number(t.net_amount), 0);
      const _cardRevenue = _cardApproved.reduce((a, t) => a + Number(t.net_amount), 0);
      const _boletoRevenue = _boletoApproved.reduce((a, t) => a + Number(t.net_amount), 0);
      const uniqueEmails = new Set(_approved.map(t => t.customer_email).filter(Boolean));
      const refundRate = _approved.length > 0 ? (_refunded.length / (_approved.length + _refunded.length)) * 100 : 0;
      const chargebackRate = _approved.length > 0 ? (_chargebacks.length / (_approved.length + _chargebacks.length)) * 100 : 0;
      const failedRate = txs.length > 0 ? (_failed.length / txs.length) * 100 : 0;

      return {
        approved: _approved, pending: _pending, refunded: _refunded, chargebacks: _chargebacks, failed: _failed,
        totalNet: _totalNet, totalGross: _totalGross, totalFees: _totalFees, avgTicket: _avgTicket, conversion: _conversion,
        pixRevenue: _pixRevenue, cardRevenue: _cardRevenue, boletoRevenue: _boletoRevenue,
        pixCount: _pixApproved.length, cardCount: _cardApproved.length, boletoCount: _boletoApproved.length,
        uniqueCustomers: uniqueEmails.size, refundRate, chargebackRate, failedRate,
      };
    };

    const current = calc(dateFiltered);
    const previous = calc(previousPeriodFiltered);

    // Top products
    const productRevMap: Record<string, { revenue: number; sales: number; name: string }> = {};
    for (const t of current.approved) {
      if (t.product_id) {
        if (!productRevMap[t.product_id]) {
          productRevMap[t.product_id] = { revenue: 0, sales: 0, name: products[t.product_id] || t.product_id.slice(0, 8) };
        }
        productRevMap[t.product_id].revenue += Number(t.net_amount);
        productRevMap[t.product_id].sales += 1;
      }
    }
    const topProducts = Object.entries(productRevMap)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Daily chart data with comparison
    const dailyMap: Record<string, number> = {};
    const prevDailyMap: Record<string, number> = {};
    for (const t of current.approved) {
      const day = fmtDate(t.created_at);
      dailyMap[day] = (dailyMap[day] || 0) + Number(t.net_amount);
    }
    for (const t of previous.approved) {
      const day = fmtDate(t.created_at);
      prevDailyMap[day] = (prevDailyMap[day] || 0) + Number(t.net_amount);
    }
    const currentDays = Object.entries(dailyMap).map(([label, value]) => ({ label, value })).reverse();
    const prevDays = Object.values(prevDailyMap);
    const chartData = currentDays.map((d, i) => ({
      ...d,
      previous: prevDays[i] || 0,
    }));

    // Sparkline data per KPI (daily values for current period)
    const dailyNetArr = currentDays.map(d => d.value);
    const dailyGrossArr: number[] = [];
    const dailyTicketArr: number[] = [];
    const dailyConvArr: number[] = [];
    const dailyByDay: Record<string, Tables<"transactions">[]> = {};
    for (const t of dateFiltered) {
      const day = fmtDate(t.created_at);
      if (!dailyByDay[day]) dailyByDay[day] = [];
      dailyByDay[day].push(t);
    }
    const dayKeys = Object.keys(dailyByDay).reverse();
    for (const day of dayKeys) {
      const dayTxs = dailyByDay[day];
      const dayApproved = dayTxs.filter(t => t.status === "completed");
      dailyGrossArr.push(dayApproved.reduce((a, t) => a + Number(t.amount), 0));
      dailyTicketArr.push(dayApproved.length > 0 ? dayApproved.reduce((a, t) => a + Number(t.net_amount), 0) / dayApproved.length : 0);
      dailyConvArr.push(dayTxs.length > 0 ? (dayApproved.length / dayTxs.length) * 100 : 0);
    }

    // Last sale
    const lastSaleAt = current.approved.length > 0 ? current.approved[0].created_at : null;

    return { current, previous, topProducts, chartData, sparklines: { net: dailyNetArr, gross: dailyGrossArr, ticket: dailyTicketArr, conversion: dailyConvArr }, lastSaleAt };
  }, [dateFiltered, previousPeriodFiltered, products]);

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

  const sortedFiltered = useMemo(() => {
    const sorted = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.field) {
      case "date": sorted.sort((a, b) => dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())); break;
      case "amount": sorted.sort((a, b) => dir * (Number(a.amount) - Number(b.amount))); break;
      case "net": sorted.sort((a, b) => dir * (Number(a.net_amount) - Number(b.net_amount))); break;
      case "customer": sorted.sort((a, b) => dir * ((a.customer_name || "").localeCompare(b.customer_name || ""))); break;
    }
    return sorted;
  }, [filtered, sort]);

  const visibleItems = useMemo(() => sortedFiltered.slice(0, visibleCount), [sortedFiltered, visibleCount]);

  const handleRefund = async (_tx: Tables<"transactions">) => {
    toast.info("Para solicitar reembolso, entre em contato com o suporte.");
  };

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

  const handleExportCSV = useCallback((txList: Tables<"transactions">[]) => {
    if (txList.length === 0) { toast.error("Nenhuma transação para exportar."); return; }
    const headers = ["ID", "Cliente", "Email", "Telefone", "CPF/CNPJ", "Produto", "Valor Bruto", "Taxa", "Líquido", "Método", "Status", "Data"];
    const rows = txList.map(t => [
      t.id, t.customer_name || "", t.customer_email || "", t.customer_phone || "",
      t.customer_document || "",
      t.product_id ? products[t.product_id] || "" : "", Number(t.amount), Number(t.fee_amount), Number(t.net_amount),
      t.payment_method || "", t.status, t.created_at,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${sanitizeCsvCell(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vendas-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${txList.length} transações exportadas!`);
  }, [products, sanitizeCsvCell]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("vendas-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const m = metrics.current;
  const p = metrics.previous;

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-5 md:space-y-6 relative animate-fade-in">
      {/* ─── HERO SECTION ─── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm backdrop-blur-xl p-4 md:p-8 animate-fade-in">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 -top-16 h-48 md:h-72 w-48 md:w-72 rounded-full bg-primary/15 blur-[60px] md:blur-[90px]" />
          <div className="absolute -right-10 bottom-0 h-40 md:h-56 w-40 md:w-56 rounded-full bg-info/10 blur-[70px] md:blur-[110px]" />
        </div>

        <div className="relative z-10 space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-display font-black text-foreground tracking-tight">Minhas Vendas</h1>
                <LivePulse lastSaleAt={metrics.lastSaleAt} />
              </div>
              <p className="text-muted-foreground text-[12px]">{dateFiltered.length} transações no período</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button className="inline-flex h-9 md:h-10 items-center gap-1.5 md:gap-2 rounded-xl border border-border/80 bg-card px-3 md:px-3.5 text-xs md:text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary/25">
                    <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    {isCustom && customRange?.from
                      ? customRange.to
                        ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${format(customRange.to, "dd/MM", { locale: ptBR })}`
                        : format(customRange.from, "dd/MM/yyyy", { locale: ptBR })
                      : selectedPeriod.label}
                    <ChevronDown className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0 rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden">
                  <div className="p-2 space-y-0.5 min-w-[150px]">
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em] px-2.5 py-1.5">Período</p>
                    {PERIOD_PRESETS.map((option) => (
                      <button
                        key={option.label}
                        onClick={() => { setSelectedPeriod(option); setIsCustom(false); setCustomRange(undefined); setDatePickerOpen(false); }}
                        className={cn(
                          "w-full text-left rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all",
                          !isCustom && selectedPeriod.label === option.label ? "bg-primary/10 text-primary font-bold" : "text-foreground/70 hover:bg-muted/40"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                    <div className="my-1.5 border-t border-border/20" />
                    <button
                      onClick={() => setIsCustom(true)}
                      className={cn(
                        "w-full text-left rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all flex items-center gap-2",
                        isCustom ? "bg-primary/10 text-primary font-bold" : "text-foreground/70 hover:bg-muted/40"
                      )}
                    >
                      <CalendarDays className="h-3.5 w-3.5" /> Personalizado
                    </button>
                    {isCustom && (
                      <div className="border-t border-border/20 mt-1.5 pt-1">
                        <Calendar
                          mode="range" selected={customRange}
                          onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }}
                          numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()}
                          className="p-3 pointer-events-auto"
                          classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }}
                        />
                        {customRange?.from && (
                          <div className="px-3 pb-2 pt-1 border-t border-border/20 mt-1">
                            <p className="text-[11px] text-muted-foreground font-medium text-center">
                              {format(customRange.from, "dd MMM yyyy", { locale: ptBR })}
                              {customRange.to && ` — ${format(customRange.to, "dd MMM yyyy", { locale: ptBR })}`}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <button
                onClick={togglePrivacy}
                className="inline-flex h-9 md:h-10 items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/25"
                title={privacyHidden ? "Mostrar valores" : "Ocultar valores"}
              >
                {privacyHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
              </button>

              <Button variant="ghost" size="sm" onClick={() => setShowExportDialog(true)} className="gap-2 rounded-xl h-9 md:h-10 font-medium text-[12px] text-muted-foreground hover:text-foreground border border-border/80 bg-card shadow-sm hover:border-primary/25">
                <Download className="h-3.5 w-3.5" /> <span className="hidden md:inline">Exportar</span>
              </Button>
            </div>
          </div>

          {/* Hero metrics — 6 KPI cards with sparklines */}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6 md:gap-3">
            <MiniHeroCard icon={<DollarSign className="h-4 w-4" />} label="Receita Líquida" value={privacyHidden ? CENSORED : fmt(m.totalNet)} tone="primary" idx={0} delta={!privacyHidden ? <DeltaBadge current={m.totalNet} previous={p.totalNet} /> : undefined} sparkData={metrics.sparklines.net} sparkColor="hsl(var(--primary))" />
            <MiniHeroCard icon={<BarChart3 className="h-4 w-4" />} label="Faturamento Bruto" value={privacyHidden ? CENSORED : fmt(m.totalGross)} tone="info" idx={1} delta={!privacyHidden ? <DeltaBadge current={m.totalGross} previous={p.totalGross} /> : undefined} sparkData={metrics.sparklines.gross} sparkColor="hsl(var(--info))" />
            <MiniHeroCard icon={<TrendingUp className="h-4 w-4" />} label="Ticket Médio" value={privacyHidden ? CENSORED : fmt(m.avgTicket)} tone="warning" idx={2} delta={!privacyHidden ? <DeltaBadge current={m.avgTicket} previous={p.avgTicket} /> : undefined} sparkData={metrics.sparklines.ticket} sparkColor="hsl(var(--warning))" />
            <MiniHeroCard icon={<Target className="h-4 w-4" />} label="Conversão" value={privacyHidden ? CENSORED : `${m.conversion.toFixed(1)}%`} tone="success" idx={3} delta={!privacyHidden ? <DeltaBadge current={m.conversion} previous={p.conversion} /> : undefined} sparkData={metrics.sparklines.conversion} sparkColor="hsl(var(--success))" />
            <MiniHeroCard icon={<UserCheck className="h-4 w-4" />} label="Clientes Únicos" value={privacyHidden ? CENSORED : String(m.uniqueCustomers)} tone="info" idx={4} delta={!privacyHidden ? <DeltaBadge current={m.uniqueCustomers} previous={p.uniqueCustomers} /> : undefined} />
            <MiniHeroCard icon={<ShoppingCart className="h-4 w-4" />} label="Vendas Aprovadas" value={privacyHidden ? CENSORED : String(m.approved.length)} tone="success" idx={5} delta={!privacyHidden ? <DeltaBadge current={m.approved.length} previous={p.approved.length} /> : undefined} />
          </div>
        </div>
      </section>

      {/* ─── INSIGHTS ROW ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Revenue Chart with comparison */}
        <div className="lg:col-span-5 rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground">Receita Diária</p>
                <p className="text-[10px] text-muted-foreground/60">Atual vs. período anterior</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full bg-primary" />
                <span className="text-[9px] text-muted-foreground/60">Atual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-[1px] w-4 border-t border-dashed border-muted-foreground/40" />
                <span className="text-[9px] text-muted-foreground/60">Anterior</span>
              </div>
            </div>
          </div>
          <RevenueChart data={metrics.chartData} hidden={privacyHidden} />
        </div>

        {/* Revenue by Payment Method */}
        <div className="lg:col-span-3 rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-info/10 flex items-center justify-center">
              <PieChart className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-foreground">Por Método</p>
              <p className="text-[10px] text-muted-foreground/60">Distribuição</p>
            </div>
          </div>
          <div className="space-y-1">
            <RevenueBar label="PIX" value={privacyHidden ? 0 : m.pixRevenue} total={m.totalNet} color="bg-success" count={m.pixCount} icon={<Smartphone className="h-3.5 w-3.5" />} />
            <RevenueBar label="Cartão" value={privacyHidden ? 0 : m.cardRevenue} total={m.totalNet} color="bg-info" count={m.cardCount} icon={<CreditCard className="h-3.5 w-3.5" />} />
            <RevenueBar label="Boleto" value={privacyHidden ? 0 : m.boletoRevenue} total={m.totalNet} color="bg-warning" count={m.boletoCount} icon={<FileText className="h-3.5 w-3.5" />} />
          </div>
          <div className="pt-2 border-t border-border/20 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-bold">Total Taxas</span>
            <span className="text-[12px] font-bold text-destructive/70 tabular-nums">{privacyHidden ? CENSORED : `-${fmt(m.totalFees)}`}</span>
          </div>
        </div>

        {/* Top Products + Health + Heatmap */}
        <div className="lg:col-span-4 space-y-3">
          {/* Top Products */}
          <div className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-warning/10 flex items-center justify-center">
                <Award className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground">Top Produtos</p>
                <p className="text-[10px] text-muted-foreground/60">Ranking por receita</p>
              </div>
            </div>
            {metrics.topProducts.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/50 py-4 text-center">Sem dados no período</p>
            ) : (
              <div className="divide-y divide-border/10">
                {metrics.topProducts.map((prod, i) => (
                  <TopProductRow key={prod.id} rank={i + 1} name={prod.name} revenue={privacyHidden ? 0 : prod.revenue} sales={prod.sales} maxRevenue={metrics.topProducts[0]?.revenue || 1} />
                ))}
              </div>
            )}
          </div>

          {/* Hourly Heatmap */}
          <div className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Flame className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground">Horários de Pico</p>
                <p className="text-[10px] text-muted-foreground/60">Vendas por hora do dia</p>
              </div>
            </div>
            <HourlyHeatmap transactions={dateFiltered} />
          </div>
        </div>
      </section>

      {/* ─── Health Indicators ─── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <HealthPill icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Reembolso" value={`${m.refundRate.toFixed(1)}%`} count={m.refunded.length} tone={m.refundRate > 5 ? "destructive" : m.refundRate > 2 ? "warning" : "success"} />
        <HealthPill icon={<ArrowDownRight className="h-3.5 w-3.5" />} label="Chargeback" value={`${m.chargebackRate.toFixed(1)}%`} count={m.chargebacks.length} tone={m.chargebackRate > 1 ? "destructive" : "success"} />
        <HealthPill icon={<X className="h-3.5 w-3.5" />} label="Falhas" value={`${m.failedRate.toFixed(1)}%`} count={m.failed.length} tone={m.failedRate > 20 ? "destructive" : m.failedRate > 10 ? "warning" : "success"} />
        <HealthPill icon={<Clock className="h-3.5 w-3.5" />} label="Pendentes" value={String(m.pending.length)} count={m.pending.length} tone={m.pending.length > 10 ? "warning" : "success"} />
      </section>

      {/* ─── FILTERS ─── */}
      <section className="space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <input
              id="vendas-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, e-mail, WhatsApp ou ID..."
              className="w-full h-10 pl-10 pr-16 rounded-xl bg-card/50 backdrop-blur-xl border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {search ? (
                <button onClick={() => setSearch("")} className="p-1">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              ) : (
                <kbd className="hidden md:inline-flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {statusFilters.map((f) => {
            const isActive = statusFilter === f.value;
            const style = STATUS_PILL_STYLES[f.value];
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-semibold transition-all duration-200 border",
                  isActive ? cn(style.active, "border-current/15 shadow-sm") : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/20"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full transition-all", isActive ? cn(style.dot, "shadow-[0_0_6px_currentColor] animate-pulse") : "bg-muted-foreground/20")} />
                {f.label}
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-bold min-w-[20px] text-center tabular-nums", isActive ? "bg-foreground/10" : "text-muted-foreground/40")}>{f.count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Results summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] text-muted-foreground/70">
          {sortedFiltered.length === 0 ? "Nenhuma transação encontrada" : `Mostrando ${Math.min(visibleCount, sortedFiltered.length)} de ${sortedFiltered.length} transações`}
        </p>
        {sortedFiltered.length > 0 && (
          <p className="text-[12px] text-primary font-medium">{fmt(sortedFiltered.reduce((a, t) => a + Number(t.net_amount), 0))} no período</p>
        )}
      </div>

      {/* ─── Desktop table ─── */}
      <div className="hidden md:block rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl overflow-hidden shadow-sm">
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
                  <tr className="border-b border-border/30 bg-muted/10">
                    <SortableHeader label="Cliente" field="customer" currentSort={sort} onSort={handleSort} />
                    <th className="text-left px-5 py-4 text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Produto</th>
                    <SortableHeader label="Valor" field="amount" currentSort={sort} onSort={handleSort} />
                    <th className="text-left px-5 py-4 text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Método</th>
                    <th className="text-left px-5 py-4 text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Status</th>
                    <SortableHeader label="Data" field="date" currentSort={sort} onSort={handleSort} />
                    <th className="text-left px-5 py-4 text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]" />
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr><td colSpan={7}>
                      <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Nenhuma venda encontrada" subtitle="Tente ajustar os filtros ou período" />
                    </td></tr>
                  ) : visibleItems.map((tx, i) => (
                    <TxRow key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
            {visibleCount < sortedFiltered.length && (
              <div className="p-3 text-center border-t border-border/30">
                <Button variant="ghost" size="sm" onClick={loadMore} className="gap-2 text-xs text-muted-foreground hover:text-foreground font-medium">
                  <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({sortedFiltered.length - visibleCount} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Mobile cards ─── */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="p-12 text-center">
            <div className="h-7 w-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">Carregando...</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Nenhuma venda" subtitle="Tente ajustar os filtros" />
        ) : (
          <>
            {visibleItems.map((tx, i) => (
              <TxCard key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
            ))}
            {visibleCount < sortedFiltered.length && (
              <Button variant="ghost" size="sm" onClick={loadMore} className="w-full gap-2 text-xs text-muted-foreground font-medium">
                <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({sortedFiltered.length - visibleCount} restantes)
              </Button>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedTx && (
        <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={handleRefund} />
      )}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        transactions={dateFiltered}
        products={products}
        productsRaw={productsRaw}
        onExport={handleExportCSV}
      />
    </div>
  );
}

/* ─── Shared Components ─── */

function MiniHeroCard({ icon, label, value, tone, idx, delta, sparkData, sparkColor }: {
  icon: React.ReactNode; label: string; value: string;
  tone: "primary" | "info" | "success" | "warning"; idx: number;
  delta?: React.ReactNode;
  sparkData?: number[];
  sparkColor?: string;
}) {
  const toneMap: Record<string, { accent: string; iconBg: string; iconText: string; ring: string }> = {
    primary: { accent: "bg-primary", iconBg: "bg-primary/10", iconText: "text-primary", ring: "ring-primary/20" },
    info: { accent: "bg-info", iconBg: "bg-info/10", iconText: "text-info", ring: "ring-info/20" },
    success: { accent: "bg-success", iconBg: "bg-success/10", iconText: "text-success", ring: "ring-success/20" },
    warning: { accent: "bg-warning", iconBg: "bg-warning/10", iconText: "text-warning", ring: "ring-warning/20" },
  };
  const t = toneMap[tone] || toneMap.primary;

  return (
    <div className="group relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/40 overflow-hidden hover:border-border/60 hover:shadow-[0_6px_20px_hsl(var(--foreground)/0.06)] transition-all duration-300 p-3.5 md:p-4 animate-fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", t.accent)} />
      {/* Sparkline background */}
      {sparkData && sparkData.length >= 2 && (
        <div className="absolute bottom-0 right-0 opacity-40 pointer-events-none">
          <Sparkline data={sparkData} color={sparkColor} className="w-[80px] h-[30px]" />
        </div>
      )}
      <div className="pl-1.5 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] leading-tight">{label}</span>
          <div className={cn("h-7 w-7 md:h-8 md:w-8 rounded-lg md:rounded-xl flex items-center justify-center ring-1", t.iconBg, t.ring)}>
            <span className={t.iconText}>{icon}</span>
          </div>
        </div>
        <p className="font-display font-black text-foreground text-[18px] md:text-xl tracking-[-0.03em] tabular-nums leading-none">{value}</p>
        {delta && <div className="mt-1.5">{delta}</div>}
      </div>
    </div>
  );
}

function HealthPill({ icon, label, value, count, tone }: {
  icon: React.ReactNode; label: string; value: string; count: number;
  tone: "success" | "warning" | "destructive";
}) {
  const styles: Record<string, { bg: string; text: string; ring: string; indicator: string }> = {
    success: { bg: "bg-success/10", text: "text-success", ring: "ring-success/20", indicator: "bg-success" },
    warning: { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/20", indicator: "bg-warning" },
    destructive: { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/20", indicator: "bg-destructive" },
  };
  const s = styles[tone];

  return (
    <div className="rounded-xl border border-border/60 bg-card/90 backdrop-blur-xl px-3.5 py-3 flex items-center gap-2.5 transition-all hover:border-border/80">
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center ring-1 shrink-0", s.bg, s.text, s.ring)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">{label}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[14px] font-display font-black text-foreground tabular-nums">{value}</span>
          <span className="text-[9px] text-muted-foreground/50">({count})</span>
        </div>
      </div>
      <span className={cn("h-2 w-2 rounded-full shrink-0", s.indicator, count > 0 && tone !== "success" ? "animate-pulse" : "")} />
    </div>
  );
}
