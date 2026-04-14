import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
 ArrowUpDown, SortAsc, SortDesc, CircleDot, Minus, Sparkles, Box,
 ChevronRight, Star, Shield, Banknote, Globe, Crown, Gauge, BadgeDollarSign,
 Coins, Timer, LayoutGrid, Radar, Signal, Gem, Bolt,
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
import { AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, ComposedChart, Bar, CartesianGrid } from "recharts";

/* ─────────────────────── Helpers ─────────────────────── */
const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtCompact = (v: number) => {
 if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
 if (v >= 10_000) return `R$ ${(v / 1_000).toFixed(1).replace(".", ",")}K`;
 return fmt(v);
};
const _dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
const _timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const _dateCache = new Map<string, string>();
const _timeCache = new Map<string, string>();
const fmtDate = (d: string) => { let v = _dateCache.get(d); if (!v) { v = _dateFmt.format(new Date(d)); _dateCache.set(d, v); } return v; };
const fmtTime = (d: string) => { let v = _timeCache.get(d); if (!v) { v = _timeFmt.format(new Date(d)); _timeCache.set(d, v); } return v; };

type StatusFilter = "all" | "completed" | "pending" | "failed" | "refunded" | "chargeback";
type SortField = "date" | "amount" | "net" | "customer";
type SortDir = "asc" | "desc";
const HIDE = "•••";

const PERIODS = [
 { label: "Hoje", days: 0 },
 { label: "Ontem", days: 1 },
 { label: "7D", days: 7 },
 { label: "15D", days: 15 },
 { label: "30D", days: 30 },
 { label: "90D", days: 90 },
] as const;
type Period = (typeof PERIODS)[number];
const PAGE_SIZE = 50;

const AVATAR_PALETTE = [
 "bg-primary/12 text-primary",
 "bg-info/12 text-info",
 "bg-warning/12 text-warning",
 "bg-success/12 text-success",
 "bg-accent/80 text-accent-foreground",
];
const avatarColor = (n: string) => {
 let h = 0; for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
 return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
};
const initials = (n: string) => {
 const p = n.trim().split(/\s+/);
 return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0]?.[0] || "?").toUpperCase();
};

const STATUS: Record<string, { label: string; fg: string; dot: string; bg: string; border: string }> = {
 completed: { label: "Aprovada", fg: "text-success", dot: "bg-success", bg: "bg-success/8", border: "border-success/15" },
 pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/8", border: "border-warning/15" },
 failed: { label: "Falha", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/8", border: "border-destructive/15" },
 refunded: { label: "Reembolso", fg: "text-info", dot: "bg-info", bg: "bg-info/8", border: "border-info/15" },
 chargeback: { label: "Chargeback", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/8", border: "border-destructive/15" },
};

type AccentTone = "primary" | "success" | "warning" | "info" | "destructive";

const ACCENT_STYLES: Record<AccentTone, {
 rail: string;
 text: string;
 softText: string;
 iconWrap: string;
 pill: string;
 surface: string;
}> = {
 primary: {
 rail: "bg-primary",
 text: "text-primary",
 softText: "text-primary/80",
 iconWrap: "bg-primary/12 border-primary/15 text-primary",
 pill: "border-primary/15 bg-primary/[0.08] text-primary",
 surface: "border-primary/15 bg-primary/[0.06]",
 },
 success: {
 rail: "bg-success",
 text: "text-success",
 softText: "text-success/80",
 iconWrap: "bg-success/12 border-success/15 text-success",
 pill: "border-success/15 bg-success/[0.08] text-success",
 surface: "border-success/15 bg-success/[0.06]",
 },
 warning: {
 rail: "bg-warning",
 text: "text-warning",
 softText: "text-warning/80",
 iconWrap: "bg-warning/12 border-warning/15 text-warning",
 pill: "border-warning/15 bg-warning/[0.08] text-warning",
 surface: "border-warning/15 bg-warning/[0.06]",
 },
 info: {
 rail: "bg-info",
 text: "text-info",
 softText: "text-info/80",
 iconWrap: "bg-info/12 border-info/15 text-info",
 pill: "border-info/15 bg-info/[0.08] text-info",
 surface: "border-info/15 bg-info/[0.06]",
 },
 destructive: {
 rail: "bg-destructive",
 text: "text-destructive",
 softText: "text-destructive/80",
 iconWrap: "bg-destructive/12 border-destructive/15 text-destructive",
 pill: "border-destructive/15 bg-destructive/[0.08] text-destructive",
 surface: "border-destructive/15 bg-destructive/[0.06]",
 },
};

/* ─────────────────────── Animated Number ─────────────────────── */
function AnimatedNumber({ value, formatter = fmt, duration = 800 }: { value: number; formatter?: (v: number) => string; duration?: number }) {
 const [display, setDisplay] = useState(value);
 const prevRef = useRef(value);
 useEffect(() => {
 const from = prevRef.current;
 const to = value;
 prevRef.current = value;
 if (from === to) return;
 const start = performance.now();
 const tick = (now: number) => {
 const elapsed = now - start;
 const progress = Math.min(elapsed / duration, 1);
 const eased = 1 - Math.pow(1 - progress, 3);
 setDisplay(from + (to - from) * eased);
 if (progress < 1) requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
 }, [value, duration]);
 return <>{formatter(display)}</>;
}

/* ─────────────────────── Micro Components ─────────────────────── */
function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
 if (prev === 0 && cur === 0) return null;
 if (prev === 0) return <span className="text-[9px] font-semibold text-success bg-success/8 px-2 py-0.5 rounded-md inline-flex items-center gap-0.5 border border-success/10"><Sparkles className="h-2.5 w-2.5" />novo</span>;
 const pct = ((cur - prev) / prev) * 100;
 const up = pct >= 0;
 return (
 <motion.span
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 className={cn("inline-flex items-center gap-0.5 text-[9px] font-bold tabular-nums px-2 py-0.5 rounded-md border", up ? "text-success bg-success/6 border-success/10" : "text-destructive bg-destructive/6 border-destructive/10")}
 >
 {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
 {Math.abs(pct).toFixed(1)}%
 </motion.span>
 );
}

function Sparkline({ data, color = "primary" }: { data: number[]; color?: string }) {
 if (data.length < 2) return null;
 const max = Math.max(...data, 1);
 const min = Math.min(...data, 0);
 const range = max - min || 1;
 const w = 80; const h = 28;
 const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
 const fillPoints = `0,${h} ${points} ${w},${h}`;
 const id = `spark-${color}-${data.length}`;
 return (
 <svg width={w} height={h} className="shrink-0 opacity-50" viewBox={`0 0 ${w} ${h}`}>
 <defs>
 <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={`hsl(var(--${color}))`} stopOpacity={0.25} />
 <stop offset="100%" stopColor={`hsl(var(--${color}))`} stopOpacity={0} />
 </linearGradient>
 </defs>
 <polygon points={fillPoints} fill={`url(#${id})`} />
 <polyline points={points} fill="none" stroke={`hsl(var(--${color}))`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 );
}

function SortHead({ label, field, sort, onSort, className }: { label: string; field: SortField; sort: { field: SortField; dir: SortDir }; onSort: (f: SortField) => void; className?: string }) {
 const active = sort.field === field;
 return (
  <th onClick={() => onSort(field)} className={cn("text-left py-3 px-4 text-[9px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/35 cursor-pointer select-none hover:text-foreground transition-colors group", className)}>
 <span className="inline-flex items-center gap-1">
 {label}
 {active
 ? (sort.dir === "desc" ? <ChevronDown className="h-3 w-3 text-primary" /> : <ChevronUp className="h-3 w-3 text-primary" />)
 : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
 </span>
 </th>
 );
}

/* ─── Revenue Chart ─── */
function RevenueChart({ data, hidden }: { data: { label: string; value: number; previous: number }[]; hidden: boolean }) {
  if (data.length < 2 || hidden) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center gap-2">
        {hidden ? <EyeOff className="h-6 w-6 text-muted-foreground/20" /> : <BarChart3 className="h-6 w-6 text-muted-foreground/20" />}
        <span className="text-[11px] text-muted-foreground/40 font-medium">{hidden ? "Valores ocultos" : "Dados insuficientes para visualização"}</span>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 18, right: 16, left: 6, bottom: 4 }}>
        <defs>
          <linearGradient id="rv-gradient-premium" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="40%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.22} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.35 }} tickLine={false} tickMargin={12} interval="preserveStartEnd" />
        <YAxis width={52} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={10} tickFormatter={(v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `R$${v}`} />
        <ReTooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border) / 0.9)", borderRadius: 14, fontSize: 11, padding: "12px 14px" }}
          formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
          labelStyle={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginBottom: 6, fontWeight: 700 }}
          cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 3" fill="none" opacity={0.35} dot={false} />
        <Bar dataKey="value" barSize={18} radius={[6, 6, 0, 0]} fill="hsl(var(--primary) / 0.12)" />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.25} fill="url(#rv-gradient-premium)" dot={false} activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ─── Desktop Row ─── */
function TxRow({ tx, prods, onClick, i }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; i: number }) {
 const methods: Record<string, { label: string; icon: React.ReactNode; color: string; bgClass: string }> = {
 pix: { label: "PIX", icon: <Smartphone className="h-3 w-3" />, color: "text-success", bgClass: "bg-success/8 border-success/12" },
 credit_card: { label: "Cartão", icon: <CreditCard className="h-3 w-3" />, color: "text-info", bgClass: "bg-info/8 border-info/12" },
 boleto: { label: "Boleto", icon: <FileText className="h-3 w-3" />, color: "text-warning", bgClass: "bg-warning/8 border-warning/12" },
 };
 const method = methods[tx.payment_method || ""] || { label: tx.payment_method || "—", icon: null, color: "text-muted-foreground", bgClass: "bg-muted/8 border-border/12" };
 const name = tx.customer_name || "Cliente";
 const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted/8", border: "border-border/10" };
 const prodName = tx.product_id ? (prods[tx.product_id] || "—") : "—";

 return (
 <motion.tr
 initial={{ opacity: 0, x: -6 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ duration: 0.25, delay: Math.min(i * 0.015, 0.25), ease: [0.16, 1, 0.3, 1] }}
 onClick={onClick}
  className="group cursor-pointer border-b border-border transition-all duration-150 hover:bg-primary/[0.02]"
 >
 {/* Cliente */}
 <td className="py-3 px-5">
 <div className="flex items-center gap-3">
 <div className="relative">
  <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/20">
   <AvatarFallback className={cn("text-[10px] font-black tracking-tight", avatarColor(name))}>{initials(name)}</AvatarFallback>
  </Avatar>
  {tx.status === "completed" && <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-card flex items-center justify-center"><div className="h-2 w-2 rounded-full bg-success" /></div>}
 </div>
 <div className="min-w-0 space-y-0.5">
 <p className="text-[12px] font-heading font-bold text-foreground truncate leading-none">{name}</p>
 <div className="flex items-center gap-1.5">
  {tx.customer_email && <p className="text-[10px] text-muted-foreground/50 truncate max-w-[160px]">{tx.customer_email}</p>}
  {tx.customer_phone && (
   <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/30"><Phone className="h-2.5 w-2.5" /></span>
  )}
 </div>
 </div>
 </div>
 </td>
 {/* Produto */}
 <td className="py-3 px-4">
 <div className="flex items-center gap-2 min-w-0">
  <div className="h-6 w-6 rounded-md bg-secondary/80 flex items-center justify-center shrink-0">
   <Package className="h-3 w-3 text-muted-foreground/40" />
  </div>
  <span className="text-[11px] font-heading font-medium text-foreground/80 truncate max-w-[130px]">{prodName}</span>
 </div>
 </td>
 {/* Valor */}
 <td className="py-3 px-4">
 <div className="space-y-0.5">
 <span className="text-[13px] font-heading font-black text-foreground tabular-nums tracking-[-0.02em] leading-none">{fmt(Number(tx.amount))}</span>
 <div className="flex items-center gap-1">
  <span className="text-[9px] text-success/60 font-semibold tabular-nums">líq. {fmt(Number(tx.net_amount))}</span>
  {Number(tx.fee_amount) > 0 && <span className="text-[8px] text-muted-foreground/25 tabular-nums">(-{fmt(Number(tx.fee_amount))})</span>}
 </div>
 </div>
 </td>
 {/* Método */}
 <td className="py-3 px-4">
 <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-heading font-bold border", method.color, method.bgClass)}>
 {method.icon}{method.label}
 </span>
 </td>
 {/* Status */}
 <td className="py-3 px-4">
 <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-heading font-black tracking-wide uppercase border", st.fg, st.bg, st.border)}>
 <span className="relative flex h-1.5 w-1.5">
  {tx.status === "pending" && <span className={cn("absolute inset-0 rounded-full animate-ping opacity-40", st.dot)} />}
  <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
 </span>
 {st.label}
 </span>
 </td>
 {/* Data */}
 <td className="py-3 px-4">
 <div className="flex flex-col items-start">
 <span className="text-[11px] font-heading font-semibold text-foreground/70 tabular-nums">{fmtDate(tx.created_at)}</span>
 <span className="text-[9px] text-muted-foreground/35 tabular-nums font-medium">{fmtTime(tx.created_at)}</span>
 </div>
 </td>
 {/* Actions */}
 <td className="py-3 px-2">
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
 {tx.customer_phone && (
  <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
   className="h-7 w-7 rounded-lg flex items-center justify-center text-success/60 hover:bg-success/8 hover:text-success transition-colors active:scale-95">
   <MessageCircle className="h-3.5 w-3.5" />
  </a>
 )}
 <DropdownMenu>
 <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
 <button className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-secondary/80 transition-all active:scale-95">
 <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/50" />
 </button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[11px] font-heading rounded-lg"><Eye className="h-3.5 w-3.5" /> Ver detalhes</DropdownMenuItem>
 {tx.customer_phone && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_phone!); toast.success("Copiado!"); }} className="gap-2 text-[11px] font-heading rounded-lg"><Copy className="h-3.5 w-3.5" /> Copiar telefone</DropdownMenuItem>
 )}
 {tx.customer_email && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_email!); toast.success("Email copiado!"); }} className="gap-2 text-[11px] font-heading rounded-lg"><Mail className="h-3.5 w-3.5" /> Copiar email</DropdownMenuItem>
 )}
 {tx.status === "completed" && (
 <><DropdownMenuSeparator /><DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Entre em contato com o suporte."); }} className="gap-2 text-[11px] font-heading text-destructive focus:text-destructive rounded-lg"><RefreshCw className="h-3.5 w-3.5" /> Reembolsar</DropdownMenuItem></>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </td>
 </motion.tr>
 );
}

/* ─── Mobile Card ─── */
function MobileCard({ tx, prods, onClick, i }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; i: number }) {
 const name = tx.customer_name || "Cliente";
 const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted/8", border: "border-border/10" };
 const methodLabels: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto" };
 const methodColors: Record<string, string> = { pix: "text-success", credit_card: "text-info", boleto: "text-warning" };
 const prodName = tx.product_id ? prods[tx.product_id] || "" : "—";

 return (
 <motion.div
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.25, delay: Math.min(i * 0.015, 0.12), ease: [0.16, 1, 0.3, 1] }}
 className="cursor-pointer rounded-[14px] border border-border bg-card overflow-hidden transition-all duration-150 hover:border-foreground/15 active:scale-[0.995]"
 onClick={onClick}
 >
 {/* Accent rail top */}
 <div className={cn("h-[2px] w-full", st.dot)} />
 <div className="p-4">
 {/* Top row: Avatar + Name + Status */}
 <div className="flex items-start justify-between mb-3.5">
 <div className="flex items-center gap-2.5 min-w-0">
  <div className="relative">
   <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/20">
    <AvatarFallback className={cn("text-[9px] font-black", avatarColor(name))}>{initials(name)}</AvatarFallback>
   </Avatar>
   {tx.status === "completed" && <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-card flex items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-success" /></div>}
  </div>
  <div className="min-w-0 space-y-0.5">
   <p className="text-[12px] font-heading font-bold text-foreground truncate leading-none">{name}</p>
   <p className="text-[10px] text-muted-foreground/50 truncate">{tx.customer_email || ""}</p>
  </div>
 </div>
 <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-heading font-black uppercase shrink-0 border tracking-wider", st.fg, st.bg, st.border)}>
 <span className="relative flex h-1.5 w-1.5">
  {tx.status === "pending" && <span className={cn("absolute inset-0 rounded-full animate-ping opacity-40", st.dot)} />}
  <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
 </span>
 {st.label}
 </span>
 </div>
 {/* Middle: Amount prominent */}
 <div className="mb-3">
 <p className="text-xl font-heading font-black text-foreground tabular-nums tracking-[-0.03em] leading-none">{fmt(Number(tx.amount))}</p>
 <p className="text-[10px] text-success/60 font-semibold tabular-nums mt-1">líq. {fmt(Number(tx.net_amount))}</p>
 </div>
 {/* Bottom row: meta */}
 <div className="flex items-center justify-between pt-3 border-t border-border/30">
 <div className="flex items-center gap-2">
  <span className={cn("text-[10px] font-heading font-bold", methodColors[tx.payment_method || ""] || "text-muted-foreground")}>{methodLabels[tx.payment_method || ""] || "—"}</span>
  <span className="text-muted-foreground/15">·</span>
  <span className="text-[10px] text-muted-foreground/40 truncate max-w-[90px]">{prodName}</span>
  <span className="text-muted-foreground/15">·</span>
  <span className="text-[10px] text-muted-foreground/40 tabular-nums">{fmtDate(tx.created_at)}</span>
 </div>
 {tx.customer_phone && (
  <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="h-7 w-7 rounded-lg bg-success/8 flex items-center justify-center text-success hover:bg-success/12 transition-colors active:scale-95 border border-success/10">
  <MessageCircle className="h-3 w-3" />
  </a>
 )}
 </div>
 </div>
 </motion.div>
 );
}

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
 transactions: Tables<"transactions">[]; products: Record<string, string>; productsRaw: any[];
 onExport: (txList: Tables<"transactions">[]) => void;
}) {
 const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(ALL_STATUSES.map(s => s.value)));
 const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set(ALL_METHODS.map(m => m.value)));
 const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set(["all"]));
 const toggleStatus = (v: string) => setSelectedStatuses(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
 const toggleMethod = (v: string) => setSelectedMethods(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
 const toggleProduct = (id: string) => {
 if (id === "all") { setSelectedProducts(new Set(["all"])); return; }
 setSelectedProducts(prev => { const n = new Set(prev); n.delete("all"); n.has(id) ? n.delete(id) : n.add(id); if (n.size === 0) n.add("all"); return n; });
 };
 const exportFiltered = useMemo(() => transactions.filter(t => {
 if (!selectedStatuses.has(t.status)) return false;
 if (t.payment_method && !selectedMethods.has(t.payment_method)) return false;
 if (!selectedProducts.has("all") && t.product_id && !selectedProducts.has(t.product_id)) return false;
 return true;
 }), [transactions, selectedStatuses, selectedMethods, selectedProducts]);
 const txProducts = useMemo(() => {
 const ids = new Set(transactions.map(t => t.product_id).filter(Boolean) as string[]);
 return Array.from(ids).map(id => ({ id, name: products[id] || id.slice(0, 8) }));
 }, [transactions, products]);

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-md border-border/30 bg-card rounded-2xl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-base font-bold"><Download className="h-4 w-4 text-primary" /> Exportar Vendas</DialogTitle>
 <DialogDescription className="text-muted-foreground/60 text-xs">Configure os filtros de exportação</DialogDescription>
 </DialogHeader>
 <div className="space-y-4 py-2">
 <div>
 <div className="flex items-center justify-between mb-2">
 <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Status</p>
 <div className="flex gap-2.5 text-[9px]">
 <button onClick={() => setSelectedStatuses(new Set())} className="text-muted-foreground/40 hover:text-foreground transition-colors">Limpar</button>
 <button onClick={() => setSelectedStatuses(new Set(ALL_STATUSES.map(s => s.value)))} className="text-primary font-bold">Todos</button>
 </div>
 </div>
 <div className="flex flex-wrap gap-1.5">
 {ALL_STATUSES.map(s => (
 <button key={s.value} onClick={() => toggleStatus(s.value)} className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border", selectedStatuses.has(s.value) ? "border-primary/20 bg-primary/6 text-primary" : "border-border/20 text-muted-foreground/40 hover:border-border/40")}>
 <span className={cn("h-1.5 w-1.5 rounded-full", selectedStatuses.has(s.value) ? s.dot : "bg-muted-foreground/15")} />{s.label}
 </button>
 ))}
 </div>
 </div>
 <div>
 <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2">Método</p>
 <div className="flex flex-wrap gap-1.5">
 {ALL_METHODS.map(m => {
 const Icon = m.icon;
 return (
 <button key={m.value} onClick={() => toggleMethod(m.value)} className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border", selectedMethods.has(m.value) ? "border-primary/20 bg-primary/6 text-primary" : "border-border/20 text-muted-foreground/40 hover:border-border/40")}>
 <Icon className="h-3 w-3" /> {m.label}
 </button>
 );
 })}
 </div>
 </div>
 {txProducts.length > 0 && (
 <div>
 <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-2">Produtos</p>
 <div className="space-y-0.5 max-h-[100px] overflow-y-auto">
 <button onClick={() => toggleProduct("all")} className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-left transition-colors", selectedProducts.has("all") ? "bg-primary/6 text-primary font-semibold" : "text-muted-foreground/40 hover:bg-muted/6")}>
 {selectedProducts.has("all") ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />} Todos
 </button>
 {txProducts.map(p => (
 <button key={p.id} onClick={() => toggleProduct(p.id)} className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-left transition-colors", selectedProducts.has(p.id) ? "bg-primary/6 text-primary font-semibold" : "text-muted-foreground/40 hover:bg-muted/6")}>
 {selectedProducts.has(p.id) ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />} <span className="truncate">{p.name}</span>
 </button>
 ))}
 </div>
 </div>
 )}
 <div className="rounded-xl bg-primary/4 border border-primary/12 p-3.5 flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-foreground">{exportFiltered.length} transações</p>
 <p className="text-[9px] text-muted-foreground/40 mt-0.5">serão exportadas</p>
 </div>
 <p className="text-base font-bold text-primary tabular-nums">{fmt(exportFiltered.reduce((a, t) => a + Number(t.net_amount), 0))}</p>
 </div>
 </div>
 <div className="flex gap-2 pt-1">
 <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl h-10 text-[11px] font-semibold border-border/30">Cancelar</Button>
 <Button onClick={() => { onExport(exportFiltered); onOpenChange(false); }} disabled={exportFiltered.length === 0} className="flex-1 rounded-xl h-10 gap-1.5 text-[11px] font-bold">
 <Download className="h-3.5 w-3.5" /> Exportar{exportFiltered.length > 0 ? ` (${exportFiltered.length})` : ""}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN PAGE */
/* ═══════════════════════════════════════════════════════════════════════ */

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
 const [selectedPeriod, setSelectedPeriod] = useState<Period>(PERIODS[0]);
 const [customRange, setCustomRange] = useState<DateRange | undefined>();
 const [isCustom, setIsCustom] = useState(false);
 const [datePickerOpen, setDatePickerOpen] = useState(false);
 const [showExportDialog, setShowExportDialog] = useState(false);
 const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "date", dir: "desc" });
 const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; } });

 const toggleHidden = useCallback(() => {
 setHidden(p => { const n = !p; try { localStorage.setItem("privacy_mode", String(n)); } catch {} return n; });
 }, []);
 const handleSort = useCallback((f: SortField) => {
 setSort(p => p.field === f ? { field: f, dir: p.dir === "desc" ? "asc" : "desc" } : { field: f, dir: "desc" });
 }, []);

 useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, statusFilter, selectedPeriod, isCustom, customRange]);

 const brasiliaToday = useCallback(() => {
 const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
 const parts = f.formatToParts(new Date());
 return new Date(Number(parts.find(p => p.type === "year")!.value), Number(parts.find(p => p.type === "month")!.value) - 1, Number(parts.find(p => p.type === "day")!.value));
 }, []);

 const toBrasiliaDate = useCallback((dateStr: string) => {
 let cached = _dateCache.get(dateStr);
 if (!cached) { cached = new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }); _dateCache.set(dateStr, cached); }
 return cached;
 }, []);

 const { dateFiltered, previousPeriodFiltered } = useMemo(() => {
 const today = brasiliaToday();
 const filterByRange = (txs: Tables<"transactions">[], start: Date, end: Date) => txs.filter(t => { const d = new Date(t.created_at); return d >= start && d <= end; });
 if (isCustom && customRange?.from) {
 const start = new Date(customRange.from); start.setHours(0, 0, 0, 0);
 const end = customRange.to ? new Date(customRange.to) : new Date(customRange.from); end.setHours(23, 59, 59, 999);
 const rangeDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
 const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1); prevEnd.setHours(23, 59, 59, 999);
 const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - rangeDays + 1); prevStart.setHours(0, 0, 0, 0);
 return { dateFiltered: filterByRange(transactions, start, end), previousPeriodFiltered: filterByRange(transactions, prevStart, prevEnd) };
 }
 if (selectedPeriod.days === 0) {
 const todayStr = today.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
 const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
 return { dateFiltered: transactions.filter(t => toBrasiliaDate(t.created_at) === todayStr), previousPeriodFiltered: transactions.filter(t => toBrasiliaDate(t.created_at) === yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })) };
 }
 if (selectedPeriod.days === 1) {
 const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
 const dayBefore = new Date(today); dayBefore.setDate(dayBefore.getDate() - 2);
 const yStr = yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
 const dbStr = dayBefore.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
 return { dateFiltered: transactions.filter(t => toBrasiliaDate(t.created_at) === yStr), previousPeriodFiltered: transactions.filter(t => toBrasiliaDate(t.created_at) === dbStr) };
 }
 const start = new Date(today); start.setDate(start.getDate() - selectedPeriod.days); start.setHours(0, 0, 0, 0);
 const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - selectedPeriod.days);
 return { dateFiltered: transactions.filter(t => new Date(t.created_at) >= start), previousPeriodFiltered: transactions.filter(t => { const d = new Date(t.created_at); return d >= prevStart && d < start; }) };
 }, [transactions, selectedPeriod, isCustom, customRange, brasiliaToday, toBrasiliaDate]);

 /* ─── Metrics ─── */
 const metrics = useMemo(() => {
 const calc = (txs: Tables<"transactions">[]) => {
 const approved = txs.filter(t => t.status === "completed");
 const pending = txs.filter(t => t.status === "pending");
 const refunded = txs.filter(t => t.status === "refunded");
 const chargebacks = txs.filter(t => t.status === "chargeback");
 const failed = txs.filter(t => t.status === "failed");
 const totalNet = approved.reduce((a, t) => a + Number(t.net_amount), 0);
 const totalGross = approved.reduce((a, t) => a + Number(t.amount), 0);
 const totalFees = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
 const avgTicket = approved.length > 0 ? totalGross / approved.length : 0;
 const conversion = txs.length > 0 ? (approved.length / txs.length) * 100 : 0;
 const pixRev = approved.filter(t => t.payment_method === "pix").reduce((a, t) => a + Number(t.net_amount), 0);
 const cardRev = approved.filter(t => t.payment_method === "credit_card").reduce((a, t) => a + Number(t.net_amount), 0);
 const boletoRev = approved.filter(t => t.payment_method === "boleto").reduce((a, t) => a + Number(t.net_amount), 0);
 const pixCount = approved.filter(t => t.payment_method === "pix").length;
 const cardCount = approved.filter(t => t.payment_method === "credit_card").length;
 const boletoCount = approved.filter(t => t.payment_method === "boleto").length;
 const uniqueCustomers = new Set(approved.map(t => t.customer_email).filter(Boolean)).size;
 const refundRate = approved.length > 0 ? (refunded.length / (approved.length + refunded.length)) * 100 : 0;
 const chargebackRate = approved.length > 0 ? (chargebacks.length / (approved.length + chargebacks.length)) * 100 : 0;
 const failedRate = txs.length > 0 ? (failed.length / txs.length) * 100 : 0;
 return { approved, pending, refunded, chargebacks, failed, totalNet, totalGross, totalFees, avgTicket, conversion, pixRev, cardRev, boletoRev, pixCount, cardCount, boletoCount, uniqueCustomers, refundRate, chargebackRate, failedRate };
 };
 const current = calc(dateFiltered);
 const previous = calc(previousPeriodFiltered);

 const pMap: Record<string, { revenue: number; sales: number; name: string }> = {};
 for (const t of current.approved) {
 if (t.product_id) {
 if (!pMap[t.product_id]) pMap[t.product_id] = { revenue: 0, sales: 0, name: products[t.product_id] || t.product_id.slice(0, 8) };
 pMap[t.product_id].revenue += Number(t.net_amount);
 pMap[t.product_id].sales += 1;
 }
 }
 const topProducts = Object.entries(pMap).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

 const dailyMap: Record<string, number> = {};
 const prevDailyMap: Record<string, number> = {};
 for (const t of current.approved) { const day = fmtDate(t.created_at); dailyMap[day] = (dailyMap[day] || 0) + Number(t.net_amount); }
 for (const t of previous.approved) { const day = fmtDate(t.created_at); prevDailyMap[day] = (prevDailyMap[day] || 0) + Number(t.net_amount); }
 const currentDays = Object.entries(dailyMap).map(([label, value]) => ({ label, value })).reverse();
 const prevDays = Object.values(prevDailyMap);
 const chartData = currentDays.map((d, i) => ({ ...d, previous: prevDays[i] || 0 }));

 const dailyNetArr = Object.values(dailyMap).reverse();
 const dailyGrossArr: number[] = [];
 const dailyCountArr: number[] = [];
 const dailyAvgTicketArr: number[] = [];
 const dailyApprovalRateArr: number[] = [];
 const dailyCountMap: Record<string, number> = {};
 const dailyGrossMap: Record<string, number> = {};
 const dailyAttemptMap: Record<string, number> = {};
 for (const t of dateFiltered) {
 const day = fmtDate(t.created_at);
 dailyAttemptMap[day] = (dailyAttemptMap[day] || 0) + 1;
 if (t.status === "completed") {
 dailyCountMap[day] = (dailyCountMap[day] || 0) + 1;
 dailyGrossMap[day] = (dailyGrossMap[day] || 0) + Number(t.amount);
 }
 }
 const sparklineDays = Array.from(new Set([...Object.keys(dailyAttemptMap), ...Object.keys(dailyMap)])).reverse();
 sparklineDays.forEach(day => {
 const approvedCount = dailyCountMap[day] || 0;
 const gross = dailyGrossMap[day] || 0;
 const attempts = dailyAttemptMap[day] || 0;
 dailyCountArr.push(approvedCount);
 dailyGrossArr.push(gross);
 dailyAvgTicketArr.push(approvedCount > 0 ? gross / approvedCount : 0);
 dailyApprovalRateArr.push(attempts > 0 ? (approvedCount / attempts) * 100 : 0);
 });

 const hours = Array(24).fill(0);
 current.approved.forEach(t => { hours[new Date(t.created_at).getHours()]++; });

 const lastSaleAt = current.approved.length > 0 ? current.approved[0].created_at : null;
 return { current, previous, topProducts, chartData, hours, lastSaleAt, dailyNetArr, dailyGrossArr, dailyCountArr, dailyAvgTicketArr, dailyApprovalRateArr };
 }, [dateFiltered, previousPeriodFiltered, products]);

 const filtered = useMemo(() => {
 const q = search.toLowerCase();
 return dateFiltered.filter(t => {
 if (statusFilter !== "all" && t.status !== statusFilter) return false;
 if (!search) return true;
 return t.customer_name?.toLowerCase().includes(q) || t.customer_email?.toLowerCase().includes(q) || t.customer_phone?.includes(q) || t.id.toLowerCase().includes(q);
 });
 }, [dateFiltered, search, statusFilter]);

 const sortedFiltered = useMemo(() => {
 const s = [...filtered];
 const d = sort.dir === "asc" ? 1 : -1;
 switch (sort.field) {
 case "date": s.sort((a, b) => d * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())); break;
 case "amount": s.sort((a, b) => d * (Number(a.amount) - Number(b.amount))); break;
 case "net": s.sort((a, b) => d * (Number(a.net_amount) - Number(b.net_amount))); break;
 case "customer": s.sort((a, b) => d * ((a.customer_name || "").localeCompare(b.customer_name || ""))); break;
 }
 return s;
 }, [filtered, sort]);

 const visibleItems = useMemo(() => sortedFiltered.slice(0, visibleCount), [sortedFiltered, visibleCount]);

 const statusTabs = useMemo(() => {
 const c: Record<string, number> = { all: dateFiltered.length, completed: 0, pending: 0, failed: 0, refunded: 0, chargeback: 0 };
 for (const t of dateFiltered) { if (t.status in c) c[t.status]++; }
 return [
 { label: "Todas", value: "all" as StatusFilter, count: c.all },
 { label: "Aprovadas", value: "completed" as StatusFilter, count: c.completed },
 { label: "Pendentes", value: "pending" as StatusFilter, count: c.pending },
 { label: "Falhas", value: "failed" as StatusFilter, count: c.failed },
 { label: "Reembolsos", value: "refunded" as StatusFilter, count: c.refunded },
 ];
 }, [dateFiltered]);

 const sanitize = useCallback((val: unknown): string => {
 const str = String(val ?? "");
 return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
 }, []);

 const handleExportCSV = useCallback((txList: Tables<"transactions">[]) => {
 if (txList.length === 0) { toast.error("Nenhuma transação para exportar."); return; }
 const headers = ["ID", "Cliente", "Email", "Telefone", "CPF/CNPJ", "Produto", "Valor Bruto", "Taxa", "Líquido", "Método", "Status", "Data"];
 const rows = txList.map(t => [t.id, t.customer_name || "", t.customer_email || "", t.customer_phone || "", t.customer_document || "", t.product_id ? products[t.product_id] || "" : "", Number(t.amount), Number(t.fee_amount), Number(t.net_amount), t.payment_method || "", t.status, t.created_at]);
 const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${sanitize(c).replace(/"/g, '""')}"`).join(","))].join("\n");
 const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a"); a.href = url; a.download = `vendas-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
 URL.revokeObjectURL(url);
 toast.success(`${txList.length} transações exportadas!`);
 }, [products, sanitize]);

 useEffect(() => {
 const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); document.getElementById("vendas-search")?.focus(); } };
 window.addEventListener("keydown", handler);
 return () => window.removeEventListener("keydown", handler);
 }, []);

 const m = metrics.current;
 const p = metrics.previous;
 const lastSaleText = metrics.lastSaleAt ? formatDistanceToNow(new Date(metrics.lastSaleAt), { locale: ptBR, addSuffix: true }) : null;
 const rawPeakSales = Math.max(...metrics.hours, 0);
 const maxHour = Math.max(rawPeakSales, 1);
 const peakHour = rawPeakSales > 0 ? metrics.hours.findIndex((value) => value === rawPeakSales) : null;

 const paymentMix = [
 { label: "PIX", value: m.pixRev, count: m.pixCount, icon: <Smartphone className="h-4 w-4" />, total: m.totalNet, color: "success" },
 { label: "Cartão", value: m.cardRev, count: m.cardCount, icon: <CreditCard className="h-4 w-4" />, total: m.totalNet, color: "info" },
 { label: "Boleto", value: m.boletoRev, count: m.boletoCount, icon: <FileText className="h-4 w-4" />, total: m.totalNet, color: "warning" },
 ];
 const dominantMethod = paymentMix.reduce((a, b) => a.value > b.value ? a : b, paymentMix[0]);

 const filteredNetTotal = sortedFiltered.reduce((acc, tx) => acc + Number(tx.net_amount), 0);
 const periodLabel = isCustom
 ? customRange?.from
 ? customRange?.to
 ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}`
 : format(customRange.from, "dd/MM/yyyy")
 : "Personalizado"
 : selectedPeriod.label;

 const healthItems = [
 { label: "Reembolso", value: m.refundRate, threshold: 5, icon: RefreshCw },
 { label: "Chargeback", value: m.chargebackRate, threshold: 1, icon: Shield },
 { label: "Falhas", value: m.failedRate, threshold: 10, icon: AlertTriangle },
 ];

    /* ═══════════ RENDER ═══════════ */
    return (
      <div className="mx-auto w-full max-w-[1440px] pb-20">

        {/* ═══════ HEADER ═══════ */}
        <div className="mb-6">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <h1 className="text-xl font-heading font-black text-foreground tracking-[-0.04em] leading-none">Minhas Vendas</h1>
              <div className="flex items-center gap-2 mt-1.5">
                {lastSaleText && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-heading text-muted-foreground/50">
                    <span className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 rounded-full bg-success animate-ping opacity-40" /><span className="h-1.5 w-1.5 rounded-full bg-success" /></span>
                    Última venda {lastSaleText}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-[10px] border border-border bg-card p-[3px]">
                {PERIODS.map((opt) => (
                  <button key={opt.label} onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                    className={cn("rounded-[8px] px-3 py-[5px] text-[10px] font-heading font-bold transition-all active:scale-[0.97]",
                      !isCustom && selectedPeriod.label === opt.label ? "bg-foreground text-background shadow-sm" : "text-muted-foreground/50 hover:text-foreground"
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button className={cn("h-[30px] rounded-[10px] border px-3 text-[10px] font-heading font-bold transition-colors active:scale-[0.97]",
                    isCustom ? "border-primary bg-primary/8 text-foreground" : "border-border bg-card text-muted-foreground/50 hover:text-foreground"
                  )}>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" />
                      {isCustom && customRange?.from
                        ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
                        : "Custom"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto overflow-hidden rounded-2xl border border-border bg-popover p-0">
                  <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-3 pointer-events-auto" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
                </PopoverContent>
              </Popover>
              <button onClick={toggleHidden} className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-[10px] border transition-colors active:scale-[0.97]", hidden ? "border-primary bg-primary/8 text-primary" : "border-border bg-card text-muted-foreground/50 hover:text-foreground")}>
                {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => setShowExportDialog(true)} className="inline-flex h-[30px] items-center gap-1.5 rounded-[10px] bg-foreground px-4 text-[10px] font-heading font-bold text-background hover:bg-foreground/90 active:scale-[0.97] transition-colors">
                <Download className="h-3 w-3" /> Exportar
              </button>
            </div>
          </div>

          {/* ═══════ HERO KPI ROW ═══════ */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
            {/* Main KPI */}
            <div className="col-span-2 lg:col-span-2 relative rounded-[14px] border border-border bg-card overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-heading font-black text-muted-foreground/50 uppercase tracking-[0.16em]">Receita líquida</span>
                  <DeltaBadge cur={m.totalNet} prev={p.totalNet} />
                </div>
                <span className="text-[32px] font-heading font-black text-foreground tabular-nums tracking-[-0.04em] leading-none block">{hidden ? HIDE : fmt(m.totalNet)}</span>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-[10px] font-heading text-muted-foreground/40 tabular-nums">Bruto: <span className="font-bold text-foreground/60">{hidden ? HIDE : fmtCompact(m.totalGross)}</span></span>
                  <span className="text-[10px] font-heading text-muted-foreground/40 tabular-nums">Taxas: <span className="font-bold text-destructive/60">{hidden ? HIDE : fmtCompact(m.totalFees)}</span></span>
                </div>
              </div>
            </div>

            {/* Vendas */}
            <div className="relative rounded-[14px] border border-border bg-card overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-info" />
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[8px] font-heading font-black text-muted-foreground/50 uppercase tracking-[0.16em]">Vendas</span>
                  <DeltaBadge cur={dateFiltered.length} prev={previousPeriodFiltered.length} />
                </div>
                <span className="text-[24px] font-heading font-black text-foreground tabular-nums tracking-[-0.04em] leading-none block">{hidden ? HIDE : dateFiltered.length}</span>
                <p className="mt-2 text-[9px] font-heading text-muted-foreground/35">{m.approved.length} aprovada{m.approved.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Ticket Médio */}
            <div className="relative rounded-[14px] border border-border bg-card overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-success" />
              <div className="p-4">
                <span className="text-[8px] font-heading font-black text-muted-foreground/50 uppercase tracking-[0.16em]">Ticket médio</span>
                <p className="mt-3 text-[24px] font-heading font-black text-foreground tabular-nums tracking-[-0.04em] leading-none">{hidden ? HIDE : fmt(m.avgTicket)}</p>
                <p className="mt-2 text-[9px] font-heading text-muted-foreground/35">por transação</p>
              </div>
            </div>

            {/* Conversão */}
            <div className="relative rounded-[14px] border border-border bg-card overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-warning" />
              <div className="p-4">
                <span className="text-[8px] font-heading font-black text-muted-foreground/50 uppercase tracking-[0.16em]">Conversão</span>
                <p className="mt-3 text-[24px] font-heading font-black tabular-nums tracking-[-0.04em] leading-none" style={{ color: m.conversion >= 50 ? 'hsl(var(--success))' : m.conversion >= 20 ? 'hsl(var(--foreground))' : 'hsl(var(--destructive))' }}>{m.conversion.toFixed(1)}%</p>
                <p className="mt-2 text-[9px] font-heading text-muted-foreground/35">taxa de aprovação</p>
              </div>
            </div>

            {/* Reembolso */}
            <div className="relative rounded-[14px] border border-border bg-card overflow-hidden">
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", m.refundRate > 5 ? "bg-destructive" : "bg-muted-foreground/20")} />
              <div className="p-4">
                <span className="text-[8px] font-heading font-black text-muted-foreground/50 uppercase tracking-[0.16em]">Reembolso</span>
                <p className={cn("mt-3 text-[24px] font-heading font-black tabular-nums tracking-[-0.04em] leading-none", m.refundRate > 5 ? "text-destructive" : "text-foreground")}>{m.refundRate.toFixed(1)}%</p>
                <p className="mt-2 text-[9px] font-heading text-muted-foreground/35">{hidden ? HIDE : fmt(m.refunded.reduce((a: number, t: Tables<"transactions">) => a + Number(t.amount), 0))}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ TRANSACTIONS TABLE ═══════ */}
        <div className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="flex flex-col gap-3 px-5 py-3 border-b border-border lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {statusTabs.map((tab) => {
                const active = statusFilter === tab.value;
                return (
                  <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                    className={cn("rounded-[8px] px-3 py-[5px] text-[10px] font-heading font-bold transition-all whitespace-nowrap active:scale-[0.97]",
                      active ? "bg-foreground text-background" : "text-muted-foreground/40 hover:text-foreground hover:bg-secondary/60"
                    )}>
                    {tab.label}
                    {tab.count > 0 && <span className={cn("ml-1.5 tabular-nums", active ? "text-background/40" : "text-muted-foreground/20")}>{tab.count}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full lg:w-56">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/30" />
                <input id="vendas-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar cliente, email ou ID…"
                  className="h-[34px] w-full rounded-[10px] border border-border bg-background pl-9 pr-9 text-[11px] font-heading text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all" />
                {search ? (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground/25 hover:text-foreground" /></button>
                ) : (
                  <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-[5px] border border-border/60 bg-secondary/40 px-1.5 py-0.5 text-[8px] font-heading font-bold text-muted-foreground/30 md:inline">⌘K</kbd>
                )}
              </div>
              {sortedFiltered.length > 0 && (
                <span className="shrink-0 hidden text-[10px] font-heading font-bold text-muted-foreground/35 tabular-nums lg:inline">{sortedFiltered.length} resultado{sortedFiltered.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>

          <div className="hidden md:block">
            {loading ? (
              <div className="p-16 text-center">
                <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
                <p className="text-[10px] font-heading text-muted-foreground/35">Carregando transações…</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-card">
                        <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} className="pl-5" />
                        <th className="px-4 py-3 text-left text-[9px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/35">Produto</th>
                        <SortHead label="Valor" field="amount" sort={sort} onSort={handleSort} />
                        <th className="px-4 py-3 text-left text-[9px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/35">Método</th>
                        <th className="px-4 py-3 text-left text-[9px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/35">Status</th>
                        <SortHead label="Data" field="date" sort={sort} onSort={handleSort} />
                        <th className="w-14" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.length === 0 ? (
                        <tr><td colSpan={7} className="py-20">
                          <div className="flex flex-col items-center justify-center">
                            <div className="h-12 w-12 rounded-[12px] bg-secondary/50 flex items-center justify-center mb-3">
                              <ShoppingCart className="h-5 w-5 text-muted-foreground/15" />
                            </div>
                            <p className="text-[11px] font-heading font-bold text-muted-foreground/35">Nenhuma venda encontrada</p>
                            <p className="text-[10px] font-heading text-muted-foreground/20 mt-1">Ajuste os filtros ou o período</p>
                          </div>
                        </td></tr>
                      ) : visibleItems.map((tx, i) => (
                        <TxRow key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleItems.length > 0 && (
                  <div className="flex items-center justify-between border-t border-border px-5 py-2.5 bg-card">
                    <span className="text-[10px] font-heading font-bold text-muted-foreground/40 tabular-nums">
                      {sortedFiltered.length} transaç{sortedFiltered.length !== 1 ? "ões" : "ão"}
                      {visibleCount < sortedFiltered.length && <span className="text-muted-foreground/25"> · mostrando {visibleItems.length}</span>}
                    </span>
                    <div className="flex items-center gap-4">
                      {!hidden && (
                        <span className="text-[12px] font-heading font-black text-foreground tabular-nums tracking-[-0.02em]">
                          Total: <span className="text-primary">{fmt(filteredNetTotal)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {visibleCount < sortedFiltered.length && (
                  <div className="border-t border-border/60 p-2.5 text-center">
                    <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="text-[10px] font-heading font-bold text-primary/70 hover:text-primary transition-colors inline-flex items-center gap-1 active:scale-[0.97]">
                      <ChevronDown className="h-3.5 w-3.5" /> Carregar mais {Math.min(PAGE_SIZE, sortedFiltered.length - visibleCount)}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-2 md:hidden p-3 pt-2">
            {loading ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
                <p className="text-[10px] font-heading text-muted-foreground/35">Carregando…</p>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="h-5 w-5 text-muted-foreground/10 mb-2" />
                <p className="text-[11px] font-heading font-bold text-muted-foreground/25">Nenhuma venda</p>
              </div>
            ) : (
              <>
                {visibleItems.map((tx, i) => (
                  <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                ))}
                {visibleCount < sortedFiltered.length && (
                  <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="w-full py-3 text-[10px] font-heading font-bold text-muted-foreground/25 hover:text-foreground transition-colors inline-flex items-center justify-center gap-1">
                    <ChevronDown className="h-3.5 w-3.5" /> Mais {sortedFiltered.length - visibleCount}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ═══════ CHART + SIDE PANELS ═══════ */}
        <section className="mt-4 grid grid-cols-1 gap-2.5 xl:grid-cols-12">
          <div className="xl:col-span-8 flex min-h-[340px] flex-col overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-[8px] bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] font-heading text-foreground font-bold leading-none">Faturamento</p>
                  <p className="text-[9px] font-heading text-muted-foreground/35 mt-0.5">{periodLabel}</p>
                </div>
              </div>
              <span className="text-[14px] font-heading text-foreground tabular-nums font-black tracking-[-0.03em]">{hidden ? HIDE : fmt(m.totalNet)}</span>
            </div>
            <div className="flex-1 min-h-0 px-2 pb-3 pt-1">
              <RevenueChart data={metrics.chartData} hidden={hidden} />
            </div>
          </div>

          <div className="xl:col-span-4 flex flex-col gap-2.5">
            {/* Métodos */}
            <div className="rounded-[14px] border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground/40" />
                <p className="text-[11px] font-heading text-foreground font-bold">Métodos de Pagamento</p>
              </div>
              <div className="divide-y divide-border/60">
                {paymentMix.map((pm) => {
                  const pct = pm.total > 0 ? (pm.value / pm.total) * 100 : 0;
                  const accent = ACCENT_STYLES[pm.color as AccentTone];
                  return (
                    <div key={pm.label} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={cn("flex h-7 w-7 items-center justify-center rounded-[8px] shrink-0 border [&_svg]:h-3.5 [&_svg]:w-3.5", accent.iconWrap)}>{pm.icon}</span>
                        <div className="min-w-0">
                          <span className="text-[11px] font-heading font-bold text-foreground">{pm.label}</span>
                          <div className="mt-1.5 h-[3px] w-20 overflow-hidden rounded-full bg-border/40">
                            <div className={cn("h-full rounded-full transition-all", accent.rail)} style={{ width: `${Math.max(pct, 3)}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="block text-[12px] font-heading font-black tabular-nums text-foreground tracking-[-0.02em]">{hidden ? HIDE : fmtCompact(pm.value)}</span>
                        <span className="text-[9px] font-heading text-muted-foreground/35 tabular-nums font-bold">{pct.toFixed(0)}% · {pm.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Saúde */}
            <div className="rounded-[14px] border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                <Activity className="h-3.5 w-3.5 text-muted-foreground/40" />
                <p className="text-[11px] font-heading text-foreground font-bold">Saúde Operacional</p>
              </div>
              <div className="divide-y divide-border/60">
                {healthItems.map((hi) => {
                  const ok = hi.value <= hi.threshold;
                  return (
                    <div key={hi.label} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-[6px] w-[6px] rounded-full", ok ? "bg-success" : "bg-destructive")} />
                        <span className="text-[11px] font-heading font-semibold text-foreground">{hi.label}</span>
                      </div>
                      <span className={cn("text-[12px] font-heading font-black tabular-nums tracking-[-0.02em]", ok ? "text-success" : "text-destructive")}>{hi.value.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border px-4 py-3">
                <div className="flex gap-[2px] items-end h-[28px]">
                  {metrics.hours.map((v, i) => (
                    <div key={i} className={cn("flex-1 rounded-[2px] min-w-0 transition-colors", peakHour === i ? "bg-primary" : v > 0 ? "bg-foreground/10" : "bg-foreground/[0.03]")} style={{ height: `${Math.max((v / maxHour) * 100, 4)}%` }} title={`${i}h: ${v}`} />
                  ))}
                </div>
                {peakHour !== null && <p className="text-[9px] font-heading text-muted-foreground/35 mt-2 font-bold">Pico às {peakHour}h · {rawPeakSales} vendas</p>}
              </div>
            </div>

            {/* Top Produtos */}
            {metrics.topProducts.length > 0 && (
              <div className="rounded-[14px] border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                  <Package className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <p className="text-[11px] font-heading text-foreground font-bold">Top Produtos</p>
                </div>
                <div className="divide-y divide-border/60">
                  {metrics.topProducts.slice(0, 5).map((prod, i) => (
                    <div key={prod.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={cn("flex h-6 w-6 items-center justify-center rounded-[6px] text-[10px] font-heading font-black shrink-0", i === 0 ? "bg-primary/12 text-primary" : "bg-secondary/80 text-muted-foreground/40")}>{i + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-heading font-bold text-foreground leading-none">{prod.name}</p>
                          <p className="text-[9px] font-heading text-muted-foreground/30 mt-0.5">{prod.sales} venda{prod.sales !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <span className={cn("text-[12px] font-heading font-black tabular-nums tracking-[-0.02em] shrink-0", i === 0 ? "text-primary" : "text-foreground")}>{hidden ? HIDE : fmtCompact(prod.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
        <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} productsRaw={productsRaw} onExport={handleExportCSV} />
      </div>
    );
}