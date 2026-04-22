import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
 ShoppingCart, DollarSign, TrendingUp, CreditCard, Search, X, EyeOff,
 Phone, Mail, Calendar as CalendarIcon, Clock, Hash, Package, ArrowUpRight,
 RefreshCw, Copy, Check, Users, Eye, MessageCircle, ChevronDown,
 Download, FileText, BarChart3, ArrowDownRight, Zap, Filter,
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
import type { DateRange } from "react-day-picker";
import { AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, ComposedChart, Bar, CartesianGrid } from "recharts";
import { KpiRibbon, PageHeader } from "@/components/KpiRibbon";

/* ─────────────────────── Helpers ─────────────────────── */
function PixLogoMark({ className, variant = "teal" }: { className?: string; variant?: "teal" | "white" }) {
 const color = variant === "white" ? "hsl(var(--primary-foreground))" : "hsl(173 58% 47%)";

 return (
  <svg viewBox="538 29 73 73" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet" shapeRendering="geometricPrecision" className={cn("select-none", className)} style={{ color }}>
   <path d="m 596.82737,86.620206 c -3.08045,0 -5.97782,-1.19944 -8.15622,-3.37679 l -11.77678,-11.77713 c -0.82691,-0.82903 -2.26801,-0.82656 -3.09456,0 l -11.81982,11.82017 c -2.17841,2.17734 -5.07577,3.37679 -8.15623,3.37679 h -2.32092 l 14.9158,14.915444 c 4.65807,4.65808 12.21069,4.65808 16.86912,0 l 14.95813,-14.958484 z" fill="currentColor" />
   <path d="m 553.82398,44.565556 c 3.08046,0 5.97782,1.19945 8.15623,3.37679 l 11.81981,11.81982 c 0.82691,0.82691 2.26766,0.82691 3.09457,0 l 11.77677,-11.77678 c 2.17841,-2.17734 5.07577,-3.37678 8.15622,-3.37678 h 2.27859 l -14.91545,-14.91545 c -4.65843,-4.65843 -12.21069,-4.65843 -16.86912,0 l -14.9158,14.91545 z" fill="currentColor" />
   <path d="m 609.05953,47.875036 h -2.23272 c -1.52542,0 -3.04195,0.62759 -4.14374,1.73009 l -11.77678,11.77713 c -2.64724,2.64688 -6.95364,2.64688 -9.60088,0 l -11.81981,-11.82017 c -1.10214,-1.10215 -2.61867,-1.72975 -4.14375,-1.72975 h -2.27577 l 15.00244,15.00244 c 0.82692,0.82726 0.82692,2.26801 0,3.09492 l -15.00244,15.00244 h 2.27577 c 1.52508,0 3.04161,-0.6276 4.14375,-1.72974 l 11.82016,-11.82017 c 2.64689,-2.64689 6.95329,-2.64689 9.60053,0 l 11.77678,11.77712 c 1.10179,1.1025 2.61832,1.7301 4.14374,1.7301 h 2.23272 l -15.04547,-15.04548 c -0.82727,-0.82691 -0.82727,-2.26766 0,-3.09457 z" fill="currentColor" />
  </svg>
 );
}

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

type StatusFilter = "all" | "completed" | "pending" | "failed" | "refunded" | "chargeback" | "medpix";
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
const PAGE_SIZE = 15;

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

const STATUS: Record<string, { label: string; fg: string; dot: string; bg: string; border: string; glow?: string }> = {
 completed: { label: "Aprovada", fg: "text-success", dot: "bg-success", bg: "bg-success/[0.07]", border: "border-success/20", glow: "shadow-[0_0_8px_hsl(var(--success)/0.15)]" },
 pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/[0.07]", border: "border-warning/20", glow: "shadow-[0_0_8px_hsl(var(--warning)/0.15)]" },
 failed: { label: "Falha", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/[0.07]", border: "border-destructive/20" },
 expired: { label: "Expirada", fg: "text-muted-foreground/60", dot: "bg-muted-foreground/40", bg: "bg-muted/[0.06]", border: "border-border/30" },
 refunded: { label: "Reembolso", fg: "text-info", dot: "bg-info", bg: "bg-info/[0.07]", border: "border-info/20" },
 chargeback: { label: "Chargeback", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/[0.07]", border: "border-destructive/20" },
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
  <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-bold tabular-nums px-2 py-0.5 rounded-md border", up ? "text-success bg-success/6 border-success/10" : "text-destructive bg-destructive/6 border-destructive/10")}>
 {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
 {Math.abs(pct).toFixed(1)}%
  </span>
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
      <div className="h-[320px] flex flex-col items-center justify-center gap-2">
        {hidden ? <EyeOff className="h-6 w-6 text-muted-foreground/20" /> : <BarChart3 className="h-6 w-6 text-muted-foreground/20" />}
        <span className="text-[11px] text-muted-foreground/40 font-medium">{hidden ? "Valores ocultos" : "Dados insuficientes para visualização"}</span>
      </div>
    );
  }
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 24, right: 18, left: 6, bottom: 4 }}>
        <defs>
          <linearGradient id="rv-gradient-premium" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.32} />
            <stop offset="55%" stopColor="hsl(var(--success))" stopOpacity={0.08} />
            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="rv-bar-premium" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.18} />
            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 5" stroke="hsl(var(--border))" strokeOpacity={0.28} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.4 }} tickLine={false} tickMargin={12} interval="preserveStartEnd" />
        <YAxis width={56} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={10} tickFormatter={(v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `R$${v}`} />
        <ReTooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11, padding: "10px 12px", boxShadow: "0 8px 24px hsl(var(--background) / 0.4)" }}
          formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
          labelStyle={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginBottom: 6, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}
          cursor={{ stroke: "hsl(var(--success))", strokeWidth: 1, strokeDasharray: "3 4", strokeOpacity: 0.6 }}
        />
        <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1.25} strokeDasharray="3 4" fill="none" opacity={0.4} dot={false} />
        <Bar dataKey="value" barSize={14} radius={[3, 3, 0, 0]} fill="url(#rv-bar-premium)" />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--success))" strokeWidth={2.25} fill="url(#rv-gradient-premium)" dot={false} activeDot={{ r: 5, stroke: "hsl(var(--success))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ─── Desktop Row ─── */
function TxRow({ tx, prods, onClick, i }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; i: number }) {
 const methods: Record<string, { label: string; icon: any; color: string; bg: string; border: string; iconBg: string }> = {
  pix: { label: "Pix", icon: PixLogoMark, color: "text-success", bg: "bg-success/[0.06]", border: "border-success/20", iconBg: "bg-success/10" },
  credit_card: { label: "Cartão", icon: CreditCard, color: "text-info", bg: "bg-info/[0.06]", border: "border-info/20", iconBg: "bg-info/10" },
  card: { label: "Cartão", icon: CreditCard, color: "text-info", bg: "bg-info/[0.06]", border: "border-info/20", iconBg: "bg-info/10" },
  boleto: { label: "Boleto", icon: FileText, color: "text-warning", bg: "bg-warning/[0.06]", border: "border-warning/20", iconBg: "bg-warning/10" },
 };
 const method = methods[tx.payment_method || ""] || { label: tx.payment_method || "—", icon: DollarSign, color: "text-muted-foreground", bg: "bg-secondary", border: "border-border", iconBg: "bg-muted/10" };
 const MethodIcon = method.icon;
 const name = tx.customer_name || "Cliente";
 const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground/60", dot: "bg-muted-foreground/40", bg: "bg-muted/[0.06]", border: "border-border/30" };
 const prodName = tx.product_id ? (prods[tx.product_id] || "Produto sem nome") : "Sem produto";
 const fee = Number(tx.fee_amount);
 const net = Number(tx.net_amount);
 const gross = Number(tx.amount);

 return (
  <tr onClick={onClick} className="group cursor-pointer transition-all duration-200 hover:bg-primary/[0.02] border-b border-border/[0.06] last:border-b-0">
   {/* Left accent rail */}
   <td className="w-[3px] p-0 relative">
    <div className={cn(
      "absolute inset-y-1 left-0 w-[3px] rounded-r-full transition-all duration-300",
      tx.status === "completed" ? "bg-success/30 group-hover:bg-success" : tx.status === "pending" ? "bg-warning/30 group-hover:bg-warning" : tx.status === "failed" ? "bg-destructive/30 group-hover:bg-destructive" : "bg-transparent group-hover:bg-primary/40"
    )} />
   </td>
   {/* Customer */}
   <td className="pl-5 pr-3 py-[18px] align-middle">
    <div className="flex items-center gap-3.5">
     <div className="relative">
      <Avatar className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-border/10 shadow-sm">
       <AvatarFallback className={cn("text-[11px] font-black tracking-tight rounded-xl", avatarColor(name))}>{initials(name)}</AvatarFallback>
      </Avatar>
      {tx.status === "completed" && (
       <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-success ring-[2.5px] ring-card">
        <Check className="h-1.5 w-1.5 text-success-foreground" strokeWidth={3} />
       </span>
      )}
      {tx.status === "pending" && (
       <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-warning ring-[2.5px] ring-card">
        <Clock className="h-1.5 w-1.5 text-warning-foreground" strokeWidth={3} />
       </span>
      )}
     </div>
     <div className="min-w-0">
      <p className="truncate text-[13px] font-heading font-bold text-foreground leading-tight tracking-[-0.01em]">{name}</p>
      <div className="flex items-center gap-1.5 mt-1">
       {tx.customer_email && <p className="truncate text-[10px] text-muted-foreground/40 max-w-[150px]">{tx.customer_email}</p>}
       {tx.customer_phone && (
        <>
         <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/15 shrink-0" />
         <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5 text-[10px] text-success/50 hover:text-success transition-colors">
          <MessageCircle className="h-2.5 w-2.5" />
         </a>
        </>
       )}
      </div>
     </div>
    </div>
   </td>
   {/* Product + Date */}
   <td className="px-3 py-[18px] align-middle">
    <div className="min-w-0">
     <p className="truncate text-[11.5px] font-heading font-semibold text-foreground/75 max-w-[180px]">{prodName}</p>
     <p className="text-[10px] text-muted-foreground/30 mt-1 tabular-nums">{fmtDate(tx.created_at)} · {fmtTime(tx.created_at)}</p>
    </div>
   </td>
   {/* Status */}
   <td className="px-3 py-[18px] align-middle">
    <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-[5px] text-[10px] font-heading font-bold border", st.fg, st.bg, st.border)}>
     <span className="relative flex h-[5px] w-[5px]">
      {tx.status === "pending" && <span className={cn("absolute inset-0 rounded-full animate-ping opacity-40", st.dot)} />}
      <span className={cn("h-[5px] w-[5px] rounded-full", st.dot)} />
     </span>
     {st.label}
    </span>
   </td>
   {/* Method */}
   <td className="px-3 py-[18px] align-middle">
    <div className="flex items-center gap-2">
     <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg border", method.iconBg, method.border)}><MethodIcon className={cn("h-3 w-3", method.color)} /></span>
     <span className={cn("text-[10.5px] font-heading font-semibold", method.color)}>{method.label}</span>
    </div>
   </td>
   {/* Gross */}
   <td className="px-3 py-[18px] align-middle text-right">
    <p className="text-[12.5px] font-heading font-bold text-foreground/80 tabular-nums tracking-[-0.01em]">{fmt(gross)}</p>
    {fee > 0 && <p className="text-[9px] text-destructive/35 tabular-nums mt-0.5">−{fmt(fee)}</p>}
   </td>
   {/* Net */}
   <td className="px-4 py-[18px] align-middle text-right">
    <p className={cn("text-[15px] font-heading font-black tabular-nums tracking-[-0.03em]",
     tx.status === "completed" ? "text-success" : tx.status === "pending" ? "text-warning/80" : "text-foreground/50"
    )}>{fmt(net)}</p>
   </td>
   {/* Actions */}
   <td className="pr-4 py-[18px] align-middle">
    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
     <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
       <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary/80 transition-colors"><MoreHorizontal className="h-4 w-4 text-muted-foreground/40" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/40 bg-popover/95 backdrop-blur-xl p-1">
       <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2.5 text-[11px] font-heading font-semibold rounded-lg py-2"><Eye className="h-3.5 w-3.5 text-primary" /> Ver detalhes</DropdownMenuItem>
       {tx.customer_phone && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_phone!); toast.success("Telefone copiado!"); }} className="gap-2.5 text-[11px] font-heading font-semibold rounded-lg py-2"><Phone className="h-3.5 w-3.5 text-success" /> Copiar telefone</DropdownMenuItem>}
       {tx.customer_email && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_email!); toast.success("Email copiado!"); }} className="gap-2.5 text-[11px] font-heading font-semibold rounded-lg py-2"><Mail className="h-3.5 w-3.5 text-info" /> Copiar email</DropdownMenuItem>}
       {tx.status === "completed" && <><DropdownMenuSeparator className="my-1" /><DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Entre em contato com o suporte."); }} className="gap-2.5 text-[11px] font-heading font-semibold text-destructive focus:text-destructive rounded-lg py-2"><RefreshCw className="h-3.5 w-3.5" /> Reembolsar</DropdownMenuItem></>}
      </DropdownMenuContent>
     </DropdownMenu>
    </div>
   </td>
  </tr>
 );
}

/* ─── Mobile Card ─── */
function MobileCard({ tx, prods, onClick, i }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; i: number }) {
 const name = tx.customer_name || "Cliente";
 const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground/60", dot: "bg-muted-foreground/40", bg: "bg-muted/[0.06]", border: "border-border/30" };
 const methods: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  pix: { label: "PIX", icon: PixLogoMark, color: "text-success", bg: "bg-success/[0.06]", border: "border-success/20" },
  credit_card: { label: "Cartão", icon: CreditCard, color: "text-info", bg: "bg-info/[0.06]", border: "border-info/20" },
  card: { label: "Cartão", icon: CreditCard, color: "text-info", bg: "bg-info/[0.06]", border: "border-info/20" },
  boleto: { label: "Boleto", icon: FileText, color: "text-warning", bg: "bg-warning/[0.06]", border: "border-warning/20" },
 };
 const method = methods[tx.payment_method || ""] || { label: tx.payment_method || "—", icon: DollarSign, color: "text-muted-foreground", bg: "bg-secondary", border: "border-border" };
 const MethodIcon = method.icon;
 const prodName = tx.product_id ? prods[tx.product_id] || "Produto sem nome" : "Sem produto";
 const net = Number(tx.net_amount);
 const fee = Number(tx.fee_amount);
 const gross = Number(tx.amount);

 const statusAccentBar = tx.status === "completed" ? "from-success via-success/40" : tx.status === "pending" ? "from-warning via-warning/40" : tx.status === "failed" ? "from-destructive via-destructive/40" : "from-muted-foreground/20 via-transparent";

 return (
  <div className="group cursor-pointer overflow-hidden rounded-2xl border border-border/15 bg-card active:scale-[0.98] transition-all duration-200" onClick={onClick}>
   {/* Top accent line */}
   <div className={cn("h-[2px] bg-gradient-to-r to-transparent", statusAccentBar)} />
   
   <div className="p-4 space-y-3">
    {/* Row 1: Avatar + Name + Net amount */}
    <div className="flex items-start justify-between gap-3">
     <div className="flex items-center gap-3 min-w-0 flex-1">
      <div className="relative shrink-0">
       <Avatar className="h-11 w-11 rounded-xl ring-1 ring-border/10 shadow-sm">
        <AvatarFallback className={cn("text-[11px] font-black tracking-tight rounded-xl", avatarColor(name))}>{initials(name)}</AvatarFallback>
       </Avatar>
       {tx.status === "completed" && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-success ring-[2.5px] ring-card">
         <Check className="h-1.5 w-1.5 text-success-foreground" strokeWidth={3} />
        </span>
       )}
      </div>
      <div className="min-w-0">
       <p className="truncate text-[14px] font-heading font-bold text-foreground tracking-[-0.01em]">{name}</p>
       <p className="truncate text-[10.5px] text-muted-foreground/35 mt-0.5">{tx.customer_email || "—"}</p>
      </div>
     </div>
     <div className="text-right shrink-0">
      <p className={cn("text-[18px] font-heading font-black tabular-nums tracking-[-0.03em] leading-tight",
       tx.status === "completed" ? "text-success" : tx.status === "pending" ? "text-warning" : "text-foreground/60"
      )}>{fmt(net)}</p>
      {fee > 0 && (
       <div className="flex items-center justify-end gap-1 mt-0.5">
        <span className="text-[9px] text-muted-foreground/25 tabular-nums line-through">{fmt(gross)}</span>
       </div>
      )}
     </div>
    </div>
    
    {/* Row 2: Product + Date + Badges */}
    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border/[0.08]">
     <div className="min-w-0 flex-1">
      <p className="text-[11px] font-heading font-semibold text-foreground/60 truncate">{prodName}</p>
      <p className="text-[9.5px] text-muted-foreground/25 tabular-nums mt-0.5">{fmtDate(tx.created_at)} · {fmtTime(tx.created_at)}</p>
     </div>
     <div className="flex items-center gap-1.5 shrink-0">
      <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-[4px] text-[9px] font-heading font-bold", st.fg, st.bg, st.border)}>
       <span className="relative flex h-[4px] w-[4px]">
        {tx.status === "pending" && <span className={cn("absolute inset-0 rounded-full animate-ping opacity-40", st.dot)} />}
        <span className={cn("h-[4px] w-[4px] rounded-full", st.dot)} />
       </span>
       {st.label}
      </span>
      <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-[4px] text-[9px] font-heading font-bold", method.color, method.bg, method.border)}>
       <MethodIcon className="h-2.5 w-2.5" />{method.label}
      </span>
     </div>
    </div>
   </div>
  </div>
 );
}
const ALL_STATUSES = [
 { value: "completed", label: "Aprovadas", dot: "bg-success" },
 { value: "pending", label: "Pendentes", dot: "bg-warning" },
 { value: "failed", label: "Falhas", dot: "bg-destructive" },
 { value: "expired", label: "Expiradas", dot: "bg-muted-foreground" },
 { value: "refunded", label: "Reembolsos", dot: "bg-info" },
 { value: "chargeback", label: "Chargebacks", dot: "bg-destructive" },
];
const ALL_METHODS = [
 { value: "pix", label: "PIX", icon: PixLogoMark },
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
 if (t.payment_method && !(selectedMethods.has(t.payment_method) || (t.payment_method === "card" && selectedMethods.has("credit_card")))) return false;
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
 const [currentPage, setCurrentPage] = useState(1);
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

 useEffect(() => { setCurrentPage(1); }, [search, statusFilter, selectedPeriod, isCustom, customRange]);

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
 const cardRev = approved.filter(t => t.payment_method === "credit_card" || t.payment_method === "card").reduce((a, t) => a + Number(t.net_amount), 0);
 const boletoRev = approved.filter(t => t.payment_method === "boleto").reduce((a, t) => a + Number(t.net_amount), 0);
 const pixCount = approved.filter(t => t.payment_method === "pix").length;
 const cardCount = approved.filter(t => t.payment_method === "credit_card" || t.payment_method === "card").length;
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
 if (statusFilter === "medpix") {
   if (t.payment_method !== "pix") return false;
   if (t.status !== "refunded" && t.status !== "chargeback") return false;
 } else if (statusFilter !== "all" && t.status !== statusFilter) return false;
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

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const visibleItems = useMemo(() => sortedFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [sortedFiltered, currentPage]);

 const statusTabs = useMemo(() => {
 const c: Record<string, number> = { all: dateFiltered.length, completed: 0, pending: 0, failed: 0, refunded: 0, chargeback: 0, medpix: 0 };
 for (const t of dateFiltered) {
   if (t.status in c) c[t.status]++;
   if (t.payment_method === "pix" && (t.status === "refunded" || t.status === "chargeback")) c.medpix++;
 }
 return [
 { label: "Todas", value: "all" as StatusFilter, count: c.all },
 { label: "Aprovadas", value: "completed" as StatusFilter, count: c.completed },
 { label: "Pendentes", value: "pending" as StatusFilter, count: c.pending },
 { label: "Reembolsadas", value: "refunded" as StatusFilter, count: c.refunded },
 { label: "Chargebacks", value: "chargeback" as StatusFilter, count: c.chargeback },
 { label: "MedPix", value: "medpix" as StatusFilter, count: c.medpix },
 { label: "Falhas", value: "failed" as StatusFilter, count: c.failed },
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
 { label: "PIX", value: m.pixRev, count: m.pixCount, icon: <PixLogoMark className="h-4 w-4" />, total: m.totalNet, color: "success" },
 { label: "Cartão", value: m.cardRev, count: m.cardCount, icon: <CreditCard className="h-4 w-4" />, total: m.totalNet, color: "info" },
 { label: "Boleto", value: m.boletoRev, count: m.boletoCount, icon: <FileText className="h-4 w-4" />, total: m.totalNet, color: "warning" },
 ];
 const dominantMethod = paymentMix.reduce((a, b) => a.value > b.value ? a : b, paymentMix[0]);
  const mixRows = paymentMix.map((item) => ({
    ...item,
    share: m.totalNet > 0 ? (item.value / m.totalNet) * 100 : 0,
  }));

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

  const approvalRate = dateFiltered.length > 0 ? (m.approved.length / dateFiltered.length) * 100 : 0;
  const refundedAmount = m.refunded.reduce((acc, tx) => acc + Number(tx.amount), 0);
  const chargebackAmount = m.chargebacks.reduce((acc, tx) => acc + Number(tx.amount), 0);
  const heroStats = [
    {
      label: "Aprovação",
      value: `${approvalRate.toFixed(1)}%`,
      meta: `${m.approved.length} aprovadas`,
      tone: approvalRate >= 60 ? "success" : "warning",
    },
    {
      label: "Ticket médio",
      value: hidden ? HIDE : fmtCompact(m.avgTicket),
      meta: "por venda aprovada",
      tone: "neutral",
    },
    {
      label: "Pico de hora",
      value: peakHour !== null ? `${peakHour.toString().padStart(2, "0")}h` : "—",
      meta: `${rawPeakSales} venda${rawPeakSales === 1 ? "" : "s"}`,
      tone: "info",
    },
    {
      label: "Clientes únicos",
      value: hidden ? HIDE : m.uniqueCustomers.toString(),
      meta: "base convertida",
      tone: "primary",
    },
  ] as const;

      /* ═══════════ RENDER ═══════════ */
      return (
        <div className="mx-auto w-full max-w-[1440px] space-y-5 pb-20">
          <PageHeader
            eyebrow={
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
                  {lastSaleText ? `Última venda ${lastSaleText}` : "Sem vendas recentes"}
                </span>
                <span className="hidden h-1 w-1 rounded-full bg-border sm:inline-block" />
                <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50 sm:inline-block">
                  domínio {dominantMethod.label}
                </span>
              </>
            }
            title="Minhas Vendas"
            subtitle="Leitura operacional de receita, performance e transações com visual mais executivo e alta densidade informacional."
            actions={
              <>
                <button onClick={() => window.location.reload()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 text-[12px] font-semibold text-muted-foreground hover:border-border hover:text-foreground">
                  <RefreshCw className="h-3.5 w-3.5" /> Atualizar
                </button>
                <button onClick={toggleHidden} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold", hidden ? "border-foreground/20 bg-foreground/[0.04] text-foreground" : "border-border/60 bg-card text-muted-foreground hover:text-foreground") }>
                  {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {hidden ? "Oculto" : "Visível"}
                </button>
                <button onClick={() => setShowExportDialog(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[12px] font-bold text-primary-foreground hover:bg-primary/90">
                  <Download className="h-3.5 w-3.5" /> Exportar
                </button>
              </>
            }
          />

          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="border-b border-border/50 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-border/60 bg-card-inset/60 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
                      {periodLabel}
                    </span>
                    <span className="rounded-md border border-success/20 bg-success/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-success">
                      Receita líquida
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground/60">
                      {metrics.chartData.length} {metrics.chartData.length === 1 ? "dia" : "dias"} analisados
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
                    <p className="text-[42px] font-heading font-black leading-none tracking-[-0.05em] text-foreground sm:text-[56px]">
                      <span className="text-success">{hidden ? HIDE : fmt(m.totalNet)}</span>
                    </p>
                    <div className="pb-1">
                      <DeltaBadge cur={m.totalNet} prev={p.totalNet} />
                    </div>
                  </div>

                  <p className="mt-3 max-w-[74ch] text-[12px] font-medium leading-relaxed text-muted-foreground/72">
                    {hidden ? "Visão protegida ativada para valores sensíveis." : `Bruto ${fmtCompact(m.totalGross)} com ${fmtCompact(m.totalFees)} em taxas. ${m.uniqueCustomers} clientes únicos, ${approvalRate.toFixed(1)}% de aprovação e ${dominantMethod.label.toLowerCase()} liderando a captura.`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:max-w-[440px] xl:justify-end">
                  <div className="inline-flex flex-wrap items-center rounded-lg border border-border/60 bg-card-inset/50 p-1">
                    {PERIODS.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors",
                          !isCustom && selectedPeriod.label === opt.label ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <button className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-bold", isCustom ? "border-foreground/25 bg-foreground/[0.04] text-foreground" : "border-border/60 bg-card text-muted-foreground hover:text-foreground") }>
                        <CalendarDays className="h-3.5 w-3.5" />
                        {isCustom && customRange?.from ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy") : "Personalizado"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-auto overflow-hidden rounded-xl border border-border bg-popover p-0">
                      <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="pointer-events-auto p-3" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_360px]">
              <div className="border-b border-border/50 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:border-border/50">
                <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/50 xl:grid-cols-4">
                  {heroStats.map((item) => (
                    <div key={item.label} className="bg-card px-4 py-3.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">{item.label}</p>
                      <p className={cn(
                        "mt-2 text-[21px] font-heading font-black tabular-nums",
                        item.tone === "success" ? "text-success" : item.tone === "warning" ? "text-warning" : item.tone === "info" ? "text-info" : item.tone === "primary" ? "text-primary" : "text-foreground",
                      )}>{item.value}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/60">{item.meta}</p>
                    </div>
                  ))}
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-heading font-bold text-foreground">Evolução da receita</p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground/65">Comparativo do período atual com a janela imediatamente anterior.</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10.5px] font-semibold text-muted-foreground/70">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success" />Atual</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-3 border-t border-dashed border-muted-foreground/60" />Anterior</span>
                    <span className="tabular-nums">Total filtrado {hidden ? HIDE : fmtCompact(filteredNetTotal)}</span>
                  </div>
                </div>
                <RevenueChart data={metrics.chartData} hidden={hidden} />
              </div>

              <aside className="flex flex-col">
                <div className="border-b border-border/50 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-heading font-bold text-foreground">Leitura operacional</p>
                      <p className="mt-1 text-[10.5px] font-medium text-muted-foreground/62">Resumo limpo da conversão, mix e risco.</p>
                    </div>
                    <span className="text-[10.5px] font-semibold text-muted-foreground/68 tabular-nums">{filtered.length} transações</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {mixRows.map((item) => (
                      <div key={item.label} className="rounded-xl border border-border/60 bg-card-inset/35 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">{item.label}</p>
                            <p className="mt-1 text-[17px] font-heading font-black tabular-nums text-foreground">{hidden ? HIDE : fmtCompact(item.value)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-semibold text-muted-foreground/60">{item.count} vendas</p>
                            <p className="mt-1 text-[11px] font-bold tabular-nums text-foreground">{item.share.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-muted/50">
                          <div className={cn(
                            "h-full rounded-full",
                            item.color === "success" ? "bg-success" : item.color === "info" ? "bg-info" : "bg-warning",
                          )} style={{ width: `${Math.min(item.share, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-heading font-bold text-foreground">Saúde operacional</p>
                      <p className="mt-1 text-[10.5px] font-medium text-muted-foreground/62">Indicadores compactos para risco e estabilidade.</p>
                    </div>
                    <span className="rounded-md border border-border/60 bg-card-inset/70 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/65">
                      {dominantMethod.label}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {healthItems.map((item) => {
                      const critical = item.value >= item.threshold;
                      return (
                        <div key={item.label} className="rounded-xl border border-border/60 bg-card-inset/35 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">{item.label}</p>
                            <div className="text-right">
                              <p className={cn("text-[16px] font-heading font-black tabular-nums", critical ? "text-destructive" : "text-foreground")}>{item.value.toFixed(2)}%</p>
                              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">limite {item.threshold}%</p>
                            </div>
                          </div>
                          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-muted/50">
                            <div className={cn("h-full rounded-full", critical ? "bg-destructive" : "bg-success")} style={{ width: `${Math.min(item.value * 8, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <KpiRibbon
            cols={8}
            items={[
              {
                label: "Vendas aprovadas",
                value: hidden ? HIDE : m.approved.length.toString(),
                sub: `${dateFiltered.length} tentativas · ${approvalRate.toFixed(1)}% aprovação`,
                tone: "neutral",
                progress: approvalRate,
              },
              {
                label: "Receita líquida",
                value: hidden ? HIDE : fmtCompact(m.totalNet),
                sub: hidden ? "valores ocultos" : `Bruto ${fmtCompact(m.totalGross)} · Taxas ${fmtCompact(m.totalFees)}`,
                tone: "success",
                delta: { cur: m.totalNet, prev: p.totalNet },
              },
              {
                label: "Ticket médio",
                value: hidden ? HIDE : fmtCompact(m.avgTicket),
                sub: `${m.uniqueCustomers} ${m.uniqueCustomers === 1 ? "cliente único" : "clientes únicos"}`,
                tone: "neutral",
                footer: periodLabel,
              },
              {
                label: "Receita em PIX",
                value: hidden ? HIDE : fmtCompact(m.pixRev),
                sub: `${m.pixCount} ${m.pixCount === 1 ? "venda aprovada" : "vendas aprovadas"}`,
                tone: "success",
                progress: m.totalNet > 0 ? (m.pixRev / m.totalNet) * 100 : 0,
                tag: "PIX",
              },
              {
                label: "Receita em cartão",
                value: hidden ? HIDE : fmtCompact(m.cardRev),
                sub: `${m.cardCount} ${m.cardCount === 1 ? "venda aprovada" : "vendas aprovadas"}`,
                tone: "info",
                progress: m.totalNet > 0 ? (m.cardRev / m.totalNet) * 100 : 0,
                tag: "Cartão",
              },
              {
                label: "Reembolsado",
                value: hidden ? HIDE : fmtCompact(refundedAmount),
                sub: `${m.refunded.length} reembolsos · ${m.refundRate.toFixed(2)}%`,
                tone: m.refundRate > 5 ? "destructive" : "info",
                footer: periodLabel,
              },
              {
                label: "Chargebacks",
                value: hidden ? HIDE : fmtCompact(chargebackAmount),
                sub: `${m.chargebacks.length} disputas · ${m.chargebackRate.toFixed(2)}%`,
                tone: m.chargebacks.length > 0 ? "destructive" : "muted",
                footer: periodLabel,
              },
              {
                label: "MedPix",
                value: dateFiltered.filter(t => t.payment_method === "pix" && (t.status === "refunded" || t.status === "chargeback")).length.toString(),
                sub: "PIX contestados ou reembolsados",
                tone: "warning",
                footer: periodLabel,
              },
            ]}
          />

         {/* ═══════ TRANSACTIONS — DOMINANT WORKSPACE ═══════ */}
         <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_0_hsl(var(--border)/0.4)]">
           {/* Top contextual ribbon — turns the table into a workspace, not a list */}
           <div className="flex items-center justify-between gap-4 border-b border-border/50 px-5 py-3 bg-gradient-to-r from-card to-card-inset/30">
             <div className="flex items-center gap-3">
               <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/[0.04] border border-border/60">
                 <Receipt className="h-4 w-4 text-foreground" />
               </div>
               <div>
                 <p className="text-[13.5px] font-heading font-bold text-foreground leading-tight">Transações</p>
                 <p className="text-[10.5px] text-muted-foreground mt-0.5">{sortedFiltered.length} resultado{sortedFiltered.length !== 1 ? "s" : ""} · ordene clicando nas colunas</p>
               </div>
             </div>
             <div className="flex items-center gap-5">
               <div className="text-right hidden sm:block">
                 <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground/60">Total filtrado</p>
                 <p className="text-[14px] font-heading font-black text-success tabular-nums leading-none mt-0.5">{hidden ? HIDE : fmt(filteredNetTotal)}</p>
               </div>
             </div>
           </div>


           {/* Status tabs */}
           <div className="border-b border-border/50 px-5">
             <div className="flex items-center gap-0 overflow-x-auto no-scrollbar">
               {statusTabs.map((tab) => {
                 const active = statusFilter === tab.value;
                 const dotColors: Record<string, string> = {
                   completed: "bg-success", pending: "bg-warning", failed: "bg-destructive",
                   refunded: "bg-info", chargeback: "bg-destructive", medpix: "bg-primary",
                 };
                 return (
                   <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                     className={cn("relative px-4 py-3 text-[12px] font-bold whitespace-nowrap transition-colors",
                       active ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground"
                     )}>
                     <span className="flex items-center gap-1.5">
                       {dotColors[tab.value] && <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[tab.value])} />}
                       {tab.label}
                       <span className={cn("ml-1 tabular-nums text-[10.5px]", active ? "text-foreground/70" : "text-muted-foreground/40")}>{tab.count}</span>
                     </span>
                     {active && <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-foreground" />}
                   </button>
                 );
               })}
             </div>
           </div>

           {/* Search + filters */}
           <div className="flex flex-col gap-2.5 border-b border-border/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between bg-card-inset/30">
             <div className="relative w-full sm:w-[320px]">
               <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
               <input id="vendas-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, email, telefone ou ID…"
                 className="h-8 w-full rounded-lg border border-border/60 bg-background pl-9 pr-9 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/40 transition-colors" />
               {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>}
             </div>
             <div className="flex items-center gap-3">
               <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{sortedFiltered.length} resultado{sortedFiltered.length !== 1 ? "s" : ""}</span>
             </div>
           </div>

           {/* Desktop table */}
           <div className="hidden md:block">
             {loading ? (
               <div className="p-20 text-center">
                 <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
                 <p className="text-[11px] text-muted-foreground">Carregando…</p>
               </div>
             ) : (
               <>
                 <div className="overflow-x-auto">
                   <table className="w-full min-w-[900px]">
                     <thead>
                       <tr className="border-b border-border/40 bg-card-inset/20">
                         <th className="w-[3px]" />
                         <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} className="pl-5" />
                         <SortHead label="Produto / Data" field="date" sort={sort} onSort={handleSort} />
                         <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">Status</th>
                         <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">Método</th>
                         <SortHead label="Bruto / Taxa" field="amount" sort={sort} onSort={handleSort} className="text-right" />
                         <SortHead label="Líquido" field="net" sort={sort} onSort={handleSort} className="text-right" />
                         <th className="w-14" />
                       </tr>
                     </thead>
                     <tbody>
                        {visibleItems.length === 0 ? (
                          <tr><td colSpan={8} className="py-10">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/30 border border-border/40">
                                <ShoppingCart className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                              <p className="text-[12.5px] font-bold text-foreground">Nenhuma venda encontrada</p>
                              <p className="text-[10.5px] text-muted-foreground/70">Ajuste o período ou refine a pesquisa.</p>
                            </div>
                          </td></tr>
                        ) : visibleItems.map((tx, i) => (
                          <TxRow key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                        ))}
                     </tbody>
                   </table>
                 </div>
                 {visibleItems.length > 0 && (
                   <div className="flex items-center justify-between border-t border-border/40 px-5 py-3 bg-card-inset/20">
                     <span className="text-[11.5px] font-semibold text-muted-foreground tabular-nums">
                       {sortedFiltered.length} transaç{sortedFiltered.length !== 1 ? "ões" : "ão"} · página {currentPage} de {totalPages}
                     </span>
                     <div className="flex items-center gap-1.5">
                       <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border/60 bg-card px-3 text-[11.5px] font-bold text-foreground hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                         <ChevronDown className="h-3 w-3 rotate-90" /> Anterior
                       </button>
                       <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border/60 bg-card px-3 text-[11.5px] font-bold text-foreground hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                         Próxima <ChevronDown className="h-3 w-3 -rotate-90" />
                       </button>
                     </div>
                   </div>
                 )}
               </>
             )}
           </div>

           {/* Mobile cards */}
           <div className="space-y-2.5 p-3 md:hidden">
             {loading ? (
               <div className="p-12 text-center">
                 <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
               </div>
             ) : visibleItems.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-12">
                 <ShoppingCart className="mb-2 h-5 w-5 text-muted-foreground/30" />
                 <p className="text-[12px] font-bold text-foreground">Nenhuma venda encontrada</p>
               </div>
             ) : (
               <>
                 {visibleItems.map((tx, i) => (
                   <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                 ))}
                 {totalPages > 1 && (
                   <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                     <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="text-[11.5px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-25 transition-colors">← Anterior</button>
                     <span className="text-[11.5px] font-bold text-foreground tabular-nums">{currentPage} / {totalPages}</span>
                     <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="text-[11.5px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-25 transition-colors">Próxima →</button>
                   </div>
                 )}
               </>
             )}
           </div>
         </div>

          {/* ═══════ NET RESULT — single line footer, no card duplication ═══════ */}
          <div className="flex items-center justify-between gap-4 px-2 pt-1">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-success" />
              <span className="uppercase tracking-[0.14em] text-[10px] font-bold text-muted-foreground/60">Saldo líquido após reembolsos & chargebacks</span>
            </div>
            <span className="text-[15px] font-heading font-black text-success tabular-nums tracking-[-0.02em]">
              {hidden ? HIDE : fmt(m.totalNet - refundedAmount - chargebackAmount)}
            </span>
          </div>

         {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
         <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} productsRaw={productsRaw} onExport={handleExportCSV} />
       </div>
     );
}
