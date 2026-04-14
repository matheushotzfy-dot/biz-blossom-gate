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
  pix: { label: "PIX", icon: <Smartphone className="h-3 w-3" />, color: "text-success", bgClass: "bg-success/8 border-success/15" },
  credit_card: { label: "Cartão", icon: <CreditCard className="h-3 w-3" />, color: "text-info", bgClass: "bg-info/8 border-info/15" },
  boleto: { label: "Boleto", icon: <FileText className="h-3 w-3" />, color: "text-warning", bgClass: "bg-warning/8 border-warning/15" },
 };
  const method = methods[tx.payment_method || ""] || { label: tx.payment_method || "—", icon: null, color: "text-muted-foreground", bgClass: "bg-secondary border-border" };
 const name = tx.customer_name || "Cliente";
 const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted/8", border: "border-border/10" };
  const prodName = tx.product_id ? (prods[tx.product_id] || "Produto sem nome") : "Sem produto";
  const fee = Number(tx.fee_amount);
  const net = Number(tx.net_amount);

 return (
  <tr onClick={onClick} className="group cursor-pointer border-b border-border/70 hover:bg-secondary/30">
  <td className="px-5 py-3.5 align-middle">
  <div className="space-y-0.5">
  <p className="text-[11px] font-heading font-bold text-foreground tabular-nums">{fmtDate(tx.created_at)}</p>
  <p className="text-[10px] font-medium text-muted-foreground/45 tabular-nums">{fmtTime(tx.created_at)}</p>
  </div>
  </td>
  <td className="px-4 py-3.5 align-middle">
  <div className="flex min-w-0 items-center gap-3">
   <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-border bg-secondary text-muted-foreground/55">
    <Package className="h-4 w-4" />
   </div>
   <div className="min-w-0">
    <p className="truncate text-[11px] font-heading font-bold text-foreground">{prodName}</p>
    <span className={cn("mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-heading font-bold", method.color, method.bgClass)}>
     {method.icon}{method.label}
    </span>
   </div>
  </div>
  </td>
  <td className="px-4 py-3.5 align-middle">
  <div className="flex min-w-0 items-center gap-3">
   <Avatar className="h-10 w-10 shrink-0 rounded-[11px] ring-1 ring-border/70 ring-inset">
    <AvatarFallback className={cn("text-[10px] font-black tracking-tight", avatarColor(name))}>{initials(name)}</AvatarFallback>
   </Avatar>
   <div className="min-w-0 space-y-0.5">
    <p className="truncate text-[12px] font-heading font-bold text-foreground">{name}</p>
    {tx.customer_email ? (
     <p className="truncate text-[10px] text-muted-foreground/45">{tx.customer_email}</p>
    ) : (
     <p className="text-[10px] text-muted-foreground/30">Sem email informado</p>
    )}
   </div>
  </div>
  </td>
  <td className="px-4 py-3.5 align-middle">
  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-heading font-black uppercase tracking-[0.12em]", st.fg, st.bg, st.border)}>
  <span className="relative flex h-1.5 w-1.5">
   {tx.status === "pending" && <span className={cn("absolute inset-0 rounded-full animate-ping opacity-40", st.dot)} />}
   <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
  </span>
  {st.label}
  </span>
  </td>
  <td className="px-4 py-3.5 align-middle">
  <div className="space-y-0.5">
   <p className="text-[11px] font-heading font-bold text-foreground/75 tabular-nums">{fee > 0 ? fmt(fee) : "R$ 0,00"}</p>
   <p className="text-[9px] text-muted-foreground/35">{tx.payment_method === "credit_card" ? "taxa processada" : "sem juros adicionais"}</p>
  </div>
  </td>
  <td className="px-4 py-3.5 align-middle">
  <div className="space-y-0.5">
   <p className="text-[13px] font-heading font-black text-foreground tabular-nums tracking-[-0.03em]">{fmt(net)}</p>
   <p className="text-[9px] text-muted-foreground/35 tabular-nums">bruto {fmt(Number(tx.amount))}</p>
  </div>
  </td>
  <td className="px-3 py-3.5 align-middle">
  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
  {tx.customer_phone && (
   <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
    className="flex h-8 w-8 items-center justify-center rounded-[10px] text-success/75 hover:bg-success/8 hover:text-success">
    <MessageCircle className="h-3.5 w-3.5" />
   </a>
  )}
  <DropdownMenu>
  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
  <button className="flex h-8 w-8 items-center justify-center rounded-[10px] hover:bg-secondary">
  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/55" />
  </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/60">
  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[11px] font-heading rounded-lg"><Eye className="h-3.5 w-3.5" /> Ver detalhes</DropdownMenuItem>
  {tx.customer_phone && (
  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_phone!); toast.success("Telefone copiado!"); }} className="gap-2 text-[11px] font-heading rounded-lg"><Copy className="h-3.5 w-3.5" /> Copiar telefone</DropdownMenuItem>
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
  </tr>
 );
}

/* ─── Mobile Card ─── */
function MobileCard({ tx, prods, onClick, i }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; i: number }) {
 const name = tx.customer_name || "Cliente";
 const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted/8", border: "border-border/10" };
  const methods: Record<string, { label: string; color: string; border: string }> = {
  pix: { label: "PIX", color: "text-success", border: "border-success/15 bg-success/8" },
  credit_card: { label: "Cartão", color: "text-info", border: "border-info/15 bg-info/8" },
  boleto: { label: "Boleto", color: "text-warning", border: "border-warning/15 bg-warning/8" },
  };
  const method = methods[tx.payment_method || ""] || { label: tx.payment_method || "—", color: "text-muted-foreground", border: "border-border bg-secondary" };
  const prodName = tx.product_id ? prods[tx.product_id] || "Produto sem nome" : "Sem produto";
  const fee = Number(tx.fee_amount);

 return (
  <div className="cursor-pointer overflow-hidden rounded-[14px] border border-border bg-[hsl(var(--card-elevated))]" onClick={onClick}>
  <div className={cn("h-[3px] w-full", st.dot)} />
  <div className="p-4">
  <div className="flex items-start justify-between gap-3">
   <div className="min-w-0">
    <p className="text-[9px] font-heading font-black uppercase tracking-[0.16em] text-muted-foreground/35">{fmtDate(tx.created_at)} · {fmtTime(tx.created_at)}</p>
    <p className="mt-2 truncate text-[12px] font-heading font-bold text-foreground">{prodName}</p>
   </div>
   <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-heading font-black uppercase tracking-[0.12em]", st.fg, st.bg, st.border)}>
   <span className="relative flex h-1.5 w-1.5">
    {tx.status === "pending" && <span className={cn("absolute inset-0 rounded-full animate-ping opacity-40", st.dot)} />}
    <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
   </span>
   {st.label}
   </span>
  </div>
  <div className="mt-4 flex items-center gap-3">
   <Avatar className="h-10 w-10 shrink-0 rounded-[11px] ring-1 ring-border/70 ring-inset">
    <AvatarFallback className={cn("text-[10px] font-black tracking-tight", avatarColor(name))}>{initials(name)}</AvatarFallback>
   </Avatar>
   <div className="min-w-0">
    <p className="truncate text-[12px] font-heading font-bold text-foreground">{name}</p>
    <p className="truncate text-[10px] text-muted-foreground/45">{tx.customer_email || "Sem email informado"}</p>
   </div>
  </div>
  <div className="mt-4 grid grid-cols-2 gap-2">
   <div className="rounded-[10px] border border-border bg-card px-3 py-2">
    <p className="text-[8px] font-heading font-black uppercase tracking-[0.14em] text-muted-foreground/35">Taxa</p>
    <p className="mt-1 text-[11px] font-heading font-bold text-foreground/75 tabular-nums">{fee > 0 ? fmt(fee) : "R$ 0,00"}</p>
   </div>
   <div className="rounded-[10px] border border-border bg-card px-3 py-2">
    <p className="text-[8px] font-heading font-black uppercase tracking-[0.14em] text-muted-foreground/35">Líquido</p>
    <p className="mt-1 text-[13px] font-heading font-black text-foreground tabular-nums tracking-[-0.03em]">{fmt(Number(tx.net_amount))}</p>
   </div>
  </div>
  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
   <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-heading font-bold", method.color, method.border)}>{method.label}</span>
   {tx.customer_phone && (
    <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex h-8 w-8 items-center justify-center rounded-[10px] text-success hover:bg-success/8">
    <MessageCircle className="h-3.5 w-3.5" />
    </a>
   )}
  </div>
  </div>
  </div>
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

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const visibleItems = useMemo(() => sortedFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [sortedFiltered, currentPage]);

 const statusTabs = useMemo(() => {
 const c: Record<string, number> = { all: dateFiltered.length, completed: 0, pending: 0, failed: 0, refunded: 0, chargeback: 0 };
 for (const t of dateFiltered) { if (t.status in c) c[t.status]++; }
 return [
 { label: "Todas", value: "all" as StatusFilter, count: c.all },
 { label: "Aprovadas", value: "completed" as StatusFilter, count: c.completed },
 { label: "Pendentes", value: "pending" as StatusFilter, count: c.pending },
 { label: "Falhas", value: "failed" as StatusFilter, count: c.failed },
 { label: "Reembolsos", value: "refunded" as StatusFilter, count: c.refunded },
  { label: "Chargebacks", value: "chargeback" as StatusFilter, count: c.chargeback },
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

  const approvalRate = dateFiltered.length > 0 ? (m.approved.length / dateFiltered.length) * 100 : 0;
  const refundedAmount = m.refunded.reduce((acc, tx) => acc + Number(tx.amount), 0);
  const chargebackAmount = m.chargebacks.reduce((acc, tx) => acc + Number(tx.amount), 0);

      /* ═══════════ RENDER ═══════════ */
    return (
      <div className="mx-auto w-full max-w-[1440px] pb-20 space-y-6">

        {/* ═══════ HEADER ═══════ */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-[11px] font-heading font-bold text-primary">
                <span className="relative flex h-2 w-2"><span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-40" /><span className="h-2 w-2 rounded-full bg-primary" /></span>
                {periodLabel}
              </span>
              <h1 className="mt-4 text-[36px] font-heading font-black tracking-[-0.04em] text-foreground leading-none">Minhas Vendas</h1>
              <p className="mt-2 text-[13px] text-muted-foreground/50 max-w-md">{lastSaleText ? `Última venda ${lastSaleText}` : "Visão consolidada de receita, clientes e aprovações."}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button onClick={() => window.location.reload()} className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-border bg-card px-5 text-[12px] font-heading font-bold text-foreground hover:bg-secondary transition-colors">
                <RefreshCw className="h-4 w-4 text-muted-foreground/50" /> Atualizar
              </button>
              <button onClick={() => setShowExportDialog(true)} className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-primary px-5 text-[12px] font-heading font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                <Download className="h-4 w-4" /> Exportar
              </button>
            </div>
          </div>

          {/* ═══════ PERIOD BAR ═══════ */}
          <div className="flex flex-col gap-3 rounded-[16px] border border-border bg-card px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center rounded-[11px] border border-border bg-background p-1">
                {PERIODS.map((opt) => (
                  <button key={opt.label} onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                    className={cn("rounded-[9px] px-4 py-[7px] text-[11px] font-heading font-bold transition-all",
                      !isCustom && selectedPeriod.label === opt.label ? "bg-primary text-primary-foreground" : "text-muted-foreground/45 hover:text-foreground"
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button className={cn("inline-flex h-9 items-center gap-2 rounded-[11px] border px-4 text-[11px] font-heading font-bold transition-all",
                    isCustom ? "border-primary bg-primary/8 text-primary" : "border-border bg-background text-muted-foreground/45 hover:text-foreground"
                  )}>
                    <CalendarDays className="h-4 w-4" />
                    {isCustom && customRange?.from ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy") : "Período custom"}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto overflow-hidden rounded-2xl border border-border bg-popover p-0">
                  <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-3 pointer-events-auto" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex h-9 items-center gap-2 rounded-[11px] border border-primary/15 bg-primary/[0.05] px-4 text-[11px] font-heading font-bold text-primary">
                <Users className="h-4 w-4" /> {m.uniqueCustomers} clientes
              </div>
              <div className="inline-flex h-9 items-center gap-2 rounded-[11px] border border-success/15 bg-success/[0.05] px-4 text-[11px] font-heading font-bold text-success">
                <Target className="h-4 w-4" /> {approvalRate.toFixed(1)}% aprovação
              </div>
              <button onClick={toggleHidden} className={cn("flex h-9 w-9 items-center justify-center rounded-[11px] border transition-all", hidden ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground/45 hover:text-foreground")}>
                {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* ═══════ HERO KPIs ═══════ */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[18px] border border-primary/20 bg-[hsl(var(--card-elevated))]">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-heading font-black uppercase tracking-[0.2em] text-primary/60">Total de vendas</p>
                  <p className="mt-4 text-[52px] font-heading font-black tracking-[-0.05em] text-foreground tabular-nums leading-none">{dateFiltered.length.toLocaleString("pt-BR")}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-primary/20 bg-primary/10 text-primary">
                  <ShoppingCart className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <DeltaBadge cur={dateFiltered.length} prev={previousPeriodFiltered.length} />
                <span className="text-[11px] font-heading text-muted-foreground/40">vs período anterior</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[12px] border border-success/15 bg-success/[0.05] px-4 py-3">
                  <p className="text-[9px] font-heading font-black uppercase tracking-[0.16em] text-success/60">Aprovadas</p>
                  <p className="mt-1.5 text-[20px] font-heading font-black text-success tabular-nums">{m.approved.length}</p>
                </div>
                <div className="rounded-[12px] border border-warning/15 bg-warning/[0.05] px-4 py-3">
                  <p className="text-[9px] font-heading font-black uppercase tracking-[0.16em] text-warning/60">Pendentes</p>
                  <p className="mt-1.5 text-[20px] font-heading font-black text-warning tabular-nums">{m.pending.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[18px] border border-success/20 bg-[hsl(var(--card-elevated))]">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-success via-success/60 to-transparent" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-heading font-black uppercase tracking-[0.2em] text-success/60">Receita líquida</p>
                  <p className="mt-4 text-[52px] font-heading font-black tracking-[-0.05em] text-foreground tabular-nums leading-none">{hidden ? HIDE : fmt(m.totalNet)}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-success/20 bg-success/10 text-success">
                  <Coins className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <DeltaBadge cur={m.totalNet} prev={p.totalNet} />
                <span className="text-[11px] font-heading text-muted-foreground/40">resultado líquido do período</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[12px] border border-border bg-card px-4 py-3">
                  <p className="text-[9px] font-heading font-black uppercase tracking-[0.16em] text-muted-foreground/40">Método líder</p>
                  <p className="mt-1.5 text-[18px] font-heading font-black text-foreground">{dominantMethod.value > 0 ? dominantMethod.label : "—"}</p>
                </div>
                <div className="rounded-[12px] border border-border bg-card px-4 py-3">
                  <p className="text-[9px] font-heading font-black uppercase tracking-[0.16em] text-muted-foreground/40">Taxas totais</p>
                  <p className="mt-1.5 text-[18px] font-heading font-black text-destructive/80 tabular-nums">{hidden ? HIDE : fmt(m.totalFees)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ SECONDARY KPIs ═══════ */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Total reembolsado", value: hidden ? HIDE : fmt(refundedAmount), icon: <RefreshCw className="h-4 w-4" />, iconClass: "border-info/20 bg-info/10 text-info", sub: `${m.refunded.length} reembolso${m.refunded.length !== 1 ? "s" : ""}`, accent: "border-info/10" },
            { label: "Vendas no PIX", value: hidden ? HIDE : fmt(m.pixRev), icon: <Smartphone className="h-4 w-4" />, iconClass: "border-success/20 bg-success/10 text-success", sub: `${m.pixCount} aprovada${m.pixCount !== 1 ? "s" : ""}`, accent: "border-success/10" },
            { label: "Reembolso %", value: `${m.refundRate.toFixed(1)}%`, icon: <Percent className="h-4 w-4" />, iconClass: "border-warning/20 bg-warning/10 text-warning", sub: "meta < 5%", valueClass: m.refundRate > 5 ? "text-destructive" : undefined, accent: "border-warning/10" },
            { label: "Chargeback", value: hidden ? HIDE : fmt(chargebackAmount), icon: <Shield className="h-4 w-4" />, iconClass: "border-destructive/20 bg-destructive/10 text-destructive", sub: `${m.chargebacks.length} ocorrência${m.chargebacks.length !== 1 ? "s" : ""}`, accent: "border-destructive/10" },
          ].map((kpi) => (
            <div key={kpi.label} className={cn("rounded-[16px] border bg-card p-4", kpi.accent)}>
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-[11px] border shrink-0", kpi.iconClass)}>{kpi.icon}</div>
                <p className="text-[10px] font-heading font-black uppercase tracking-[0.14em] text-muted-foreground/45 leading-tight">{kpi.label}</p>
              </div>
              <p className={cn("mt-3 text-[24px] font-heading font-black tracking-[-0.04em] tabular-nums leading-none", kpi.valueClass || "text-foreground")}>{kpi.value}</p>
              <p className="mt-2 text-[10px] text-muted-foreground/40">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* ═══════ TRANSACTIONS TABLE ═══════ */}
        <div className="overflow-hidden rounded-[18px] border border-border bg-card">
          <div className="border-b border-border px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {statusTabs.map((tab) => {
                  const active = statusFilter === tab.value;
                  return (
                    <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                      className={cn("rounded-[10px] px-4 py-[7px] text-[11px] font-heading font-bold whitespace-nowrap transition-all",
                        active ? "bg-primary text-primary-foreground" : "text-muted-foreground/45 hover:bg-secondary hover:text-foreground"
                      )}>
                      {tab.label}
                      {tab.count > 0 && <span className={cn("ml-1.5 tabular-nums", active ? "text-primary-foreground/50" : "text-muted-foreground/25")}>{tab.count}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-[300px]">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/25" />
                  <input id="vendas-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar cliente, email ou ID"
                    className="h-[40px] w-full rounded-[12px] border border-border bg-background pl-10 pr-10 text-[12px] font-heading text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all" />
                  {search ? (
                    <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground/25 hover:text-foreground" /></button>
                  ) : (
                    <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-[6px] border border-border bg-secondary px-2 py-0.5 text-[9px] font-heading font-bold text-muted-foreground/30 md:inline">⌘K</kbd>
                  )}
                </div>
                <div className="inline-flex h-[40px] items-center rounded-[12px] border border-primary/15 bg-primary/[0.05] px-4 text-[11px] font-heading font-bold text-primary tabular-nums">
                  {sortedFiltered.length} registro{sortedFiltered.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            {loading ? (
              <div className="p-20 text-center">
                <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
                <p className="text-[11px] font-heading text-muted-foreground/30">Carregando vendas…</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px]">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <SortHead label="Data" field="date" sort={sort} onSort={handleSort} className="pl-6" />
                        <th className="px-4 py-3.5 text-left text-[10px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/35">Produto</th>
                        <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} />
                        <th className="px-4 py-3.5 text-left text-[10px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/35">Status</th>
                        <th className="px-4 py-3.5 text-left text-[10px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/35">Taxa</th>
                        <SortHead label="Líquido" field="net" sort={sort} onSort={handleSort} />
                        <th className="w-14" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.length === 0 ? (
                        <tr><td colSpan={7} className="py-24">
                          <div className="flex flex-col items-center justify-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] border border-primary/15 bg-primary/[0.06]">
                              <ShoppingCart className="h-5 w-5 text-primary/40" />
                            </div>
                            <p className="text-[13px] font-heading font-bold text-foreground/70">Nenhuma venda encontrada</p>
                            <p className="mt-1.5 text-[11px] text-muted-foreground/40">Ajuste o período ou refine a pesquisa.</p>
                          </div>
                        </td></tr>
                      ) : visibleItems.map((tx, i) => (
                        <TxRow key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleItems.length > 0 && (
                  <div className="flex items-center justify-between border-t border-border px-6 py-4">
                    <span className="text-[11px] font-heading font-bold text-muted-foreground/40 tabular-nums">
                      {sortedFiltered.length} transaç{sortedFiltered.length !== 1 ? "ões" : "ão"} · Página {currentPage} de {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border px-4 text-[11px] font-heading font-bold text-muted-foreground hover:text-foreground hover:border-primary/30 disabled:opacity-30 disabled:pointer-events-none transition-all">
                        <ChevronDown className="h-3.5 w-3.5 rotate-90" /> Anterior
                      </button>
                      <span className="min-w-[100px] text-center text-[12px] font-heading font-black text-primary tabular-nums">
                        {hidden ? HIDE : fmt(filteredNetTotal)}
                      </span>
                      <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border px-4 text-[11px] font-heading font-bold text-muted-foreground hover:text-foreground hover:border-primary/30 disabled:opacity-30 disabled:pointer-events-none transition-all">
                        Próxima <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 p-4 md:hidden">
            {loading ? (
              <div className="p-16 text-center">
                <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <ShoppingCart className="mb-3 h-5 w-5 text-primary/20" />
                <p className="text-[12px] font-heading font-bold text-foreground/65">Nenhuma venda encontrada</p>
              </div>
            ) : (
              <>
                {visibleItems.map((tx, i) => (
                  <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between rounded-[14px] border border-primary/15 bg-card px-5 py-4">
                    <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="text-[11px] font-heading font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all">← Anterior</button>
                    <span className="text-[11px] font-heading font-bold text-primary tabular-nums">{currentPage} / {totalPages}</span>
                    <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="text-[11px] font-heading font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all">Próxima →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ═══════ CHART + TOP PRODUCTS ═══════ */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-8 rounded-[18px] border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <p className="text-[12px] font-heading font-bold text-foreground">Evolução da receita</p>
                <p className="mt-1 text-[10px] text-muted-foreground/35">Curva de receita líquida no período selecionado</p>
              </div>
              <span className="text-[16px] font-heading font-black text-primary tabular-nums tracking-[-0.03em]">{hidden ? HIDE : fmt(m.totalNet)}</span>
            </div>
            <div className="px-3 pb-4 pt-2">
              <RevenueChart data={metrics.chartData} hidden={hidden} />
            </div>
          </div>

          <div className="xl:col-span-4 space-y-4">
            {metrics.topProducts.length > 0 && (
              <div className="rounded-[18px] border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-primary/20 bg-primary/10 text-primary">
                    <Crown className="h-4 w-4" />
                  </div>
                  <p className="text-[12px] font-heading font-bold text-foreground">Top Produtos</p>
                </div>
                <div className="divide-y divide-border/60">
                  {metrics.topProducts.slice(0, 5).map((prod, i) => (
                    <div key={prod.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("flex h-7 w-7 items-center justify-center rounded-[9px] text-[10px] font-heading font-black shrink-0", i === 0 ? "bg-primary/12 text-primary border border-primary/15" : "bg-secondary text-muted-foreground/45")}>{i + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-heading font-bold text-foreground">{prod.name}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground/35">{prod.sales} venda{prod.sales !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <span className={cn("text-[12px] font-heading font-black tabular-nums tracking-[-0.02em]", i === 0 ? "text-primary" : "text-foreground")}>{hidden ? HIDE : fmtCompact(prod.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[18px] border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-success/20 bg-success/10 text-success">
                    <Activity className="h-4 w-4" />
                  </div>
                  <p className="text-[12px] font-heading font-bold text-foreground">Saúde operacional</p>
                </div>
                {peakHour !== null ? <span className="text-[10px] font-heading font-bold text-primary/60">pico {peakHour}h</span> : <span className="text-[10px] text-muted-foreground/35">—</span>}
              </div>
              <div className="divide-y divide-border/60">
                {paymentMix.map((pm) => {
                  const pct = pm.total > 0 ? (pm.value / pm.total) * 100 : 0;
                  const accent = ACCENT_STYLES[pm.color as AccentTone];
                  return (
                    <div key={pm.label} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("flex h-9 w-9 items-center justify-center rounded-[10px] border [&_svg]:h-4 [&_svg]:w-4", accent.iconWrap)}>{pm.icon}</span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-heading font-bold text-foreground">{pm.label}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground/35">{pm.count} venda{pm.count !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="min-w-[120px]">
                        <div className="h-[5px] overflow-hidden rounded-full bg-secondary">
                          <div className={cn("h-full rounded-full transition-all", accent.rail)} style={{ width: `${Math.max(pct, 4)}%` }} />
                        </div>
                        <p className="mt-1.5 text-right text-[11px] font-heading font-black text-foreground tabular-nums">{hidden ? HIDE : fmtCompact(pm.value)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2.5 border-t border-border px-5 py-4">
                {healthItems.map((hi) => {
                  const ok = hi.value <= hi.threshold;
                  return (
                    <div key={hi.label} className={cn("rounded-[11px] border px-3 py-2.5", ok ? "border-success/15 bg-success/[0.04]" : "border-destructive/15 bg-destructive/[0.04]")}>
                      <p className="text-[9px] font-heading font-black uppercase tracking-[0.14em] text-muted-foreground/40">{hi.label}</p>
                      <p className={cn("mt-1.5 text-[14px] font-heading font-black tabular-nums", ok ? "text-success" : "text-destructive")}>{hi.value.toFixed(1)}%</p>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-heading font-black uppercase tracking-[0.16em] text-muted-foreground/40">Volume por hora</p>
                  <p className="text-[10px] text-muted-foreground/30">baseado nas aprovadas</p>
                </div>
                <div className="flex h-[28px] items-end gap-[2px]">
                  {metrics.hours.map((v, i) => (
                    <div key={i} className={cn("min-w-0 flex-1 rounded-[3px] transition-all", peakHour === i ? "bg-primary" : v > 0 ? "bg-primary/20" : "bg-foreground/[0.05]")} style={{ height: `${Math.max((v / maxHour) * 100, 6)}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
        <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} productsRaw={productsRaw} onExport={handleExportCSV} />
      </div>
    );
}
                <Download className="h-3.5 w-3.5" /> Exportar
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-[10px] border border-border bg-background p-[3px]">
                {PERIODS.map((opt) => (
                  <button key={opt.label} onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                    className={cn("rounded-[8px] px-3 py-[5px] text-[10px] font-heading font-bold transition-colors",
                      !isCustom && selectedPeriod.label === opt.label ? "bg-foreground text-background" : "text-muted-foreground/45 hover:text-foreground"
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button className={cn("inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-3 text-[10px] font-heading font-bold",
                    isCustom ? "border-primary bg-primary/8 text-foreground" : "border-border bg-background text-muted-foreground/45 hover:text-foreground"
                  )}>
                    <CalendarDays className="h-3.5 w-3.5" />
                    {isCustom && customRange?.from ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy") : "Período custom"}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto overflow-hidden rounded-2xl border border-border bg-popover p-0">
                  <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-3 pointer-events-auto" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-border bg-background px-3 text-[10px] font-heading font-bold text-muted-foreground/45">
                <Users className="h-3.5 w-3.5 text-primary/70" /> {m.uniqueCustomers} clientes
              </div>
              <div className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-border bg-background px-3 text-[10px] font-heading font-bold text-muted-foreground/45">
                <Target className="h-3.5 w-3.5 text-success/80" /> {approvalRate.toFixed(1)}% aprovação
              </div>
              <button onClick={toggleHidden} className={cn("flex h-8 w-8 items-center justify-center rounded-[10px] border", hidden ? "border-primary bg-primary/8 text-primary" : "border-border bg-background text-muted-foreground/45 hover:text-foreground")}>
                {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-[14px] border border-border bg-[hsl(var(--card-elevated))]">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/40">Vendas encontradas</p>
                  <p className="mt-3 text-[42px] font-heading font-black tracking-[-0.05em] text-foreground tabular-nums leading-none">{dateFiltered.length.toLocaleString("pt-BR")}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-primary/15 bg-primary/10 text-primary">
                  <ShoppingCart className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <DeltaBadge cur={dateFiltered.length} prev={previousPeriodFiltered.length} />
                <span className="text-[10px] font-heading text-muted-foreground/40">comparado ao período anterior</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-[10px] border border-border bg-card px-3 py-2.5">
                  <p className="text-[8px] font-heading font-black uppercase tracking-[0.14em] text-muted-foreground/35">Aprovadas</p>
                  <p className="mt-1 text-[16px] font-heading font-black text-foreground tabular-nums">{m.approved.length}</p>
                </div>
                <div className="rounded-[10px] border border-border bg-card px-3 py-2.5">
                  <p className="text-[8px] font-heading font-black uppercase tracking-[0.14em] text-muted-foreground/35">Pendentes</p>
                  <p className="mt-1 text-[16px] font-heading font-black text-foreground tabular-nums">{m.pending.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-[hsl(var(--card-elevated))]">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/40">Valor líquido</p>
                  <p className="mt-3 text-[42px] font-heading font-black tracking-[-0.05em] text-foreground tabular-nums leading-none">{hidden ? HIDE : fmt(m.totalNet)}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-success/15 bg-success/10 text-success">
                  <Coins className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <DeltaBadge cur={m.totalNet} prev={p.totalNet} />
                <span className="text-[10px] font-heading text-muted-foreground/40">resultado líquido do período</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-[10px] border border-border bg-card px-3 py-2.5">
                  <p className="text-[8px] font-heading font-black uppercase tracking-[0.14em] text-muted-foreground/35">Método líder</p>
                  <p className="mt-1 text-[16px] font-heading font-black text-foreground">{dominantMethod.value > 0 ? dominantMethod.label : "Sem receita"}</p>
                </div>
                <div className="rounded-[10px] border border-border bg-card px-3 py-2.5">
                  <p className="text-[8px] font-heading font-black uppercase tracking-[0.14em] text-muted-foreground/35">Taxas</p>
                  <p className="mt-1 text-[16px] font-heading font-black text-foreground tabular-nums">{hidden ? HIDE : fmt(m.totalFees)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { label: "Total reembolsado", value: hidden ? HIDE : fmt(refundedAmount), icon: <RefreshCw className="h-3.5 w-3.5" />, iconClass: "border-info/15 bg-info/10 text-info", sub: `${m.refunded.length} reembolso${m.refunded.length !== 1 ? "s" : ""}` },
            { label: "Vendas no PIX", value: hidden ? HIDE : fmt(m.pixRev), icon: <Smartphone className="h-3.5 w-3.5" />, iconClass: "border-success/15 bg-success/10 text-success", sub: `${m.pixCount} aprovada${m.pixCount !== 1 ? "s" : ""}` },
            { label: "Reembolso %", value: `${m.refundRate.toFixed(1)}%`, icon: <Percent className="h-3.5 w-3.5" />, iconClass: "border-warning/15 bg-warning/10 text-warning", sub: "meta < 5%", valueClass: m.refundRate > 5 ? "text-destructive" : undefined },
            { label: "Chargeback", value: hidden ? HIDE : fmt(chargebackAmount), icon: <Shield className="h-3.5 w-3.5" />, iconClass: "border-destructive/15 bg-destructive/10 text-destructive", sub: `${m.chargebacks.length} ocorrência${m.chargebacks.length !== 1 ? "s" : ""}` },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-[14px] border border-border bg-card p-3.5">
              <div className="flex items-center gap-2">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-[9px] border shrink-0", kpi.iconClass)}>{kpi.icon}</div>
                <p className="text-[8px] font-heading font-black uppercase tracking-[0.14em] text-muted-foreground/40 leading-tight">{kpi.label}</p>
              </div>
              <p className={cn("mt-2.5 text-[20px] font-heading font-black tracking-[-0.04em] tabular-nums leading-none", kpi.valueClass || "text-foreground")}>{kpi.value}</p>
              <p className="mt-1.5 text-[9px] text-muted-foreground/40">{kpi.sub}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {statusTabs.map((tab) => {
                  const active = statusFilter === tab.value;
                  return (
                    <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                      className={cn("rounded-[10px] px-3 py-[6px] text-[10px] font-heading font-bold whitespace-nowrap",
                        active ? "bg-foreground text-background" : "text-muted-foreground/45 hover:bg-secondary hover:text-foreground"
                      )}>
                      {tab.label}
                      {tab.count > 0 && <span className={cn("ml-1 tabular-nums", active ? "text-background/40" : "text-muted-foreground/25")}>{tab.count}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-[280px]">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
                  <input id="vendas-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar cliente, email ou ID"
                    className="h-[36px] w-full rounded-[11px] border border-border bg-background pl-9 pr-9 text-[11px] font-heading text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20" />
                  {search ? (
                    <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground/25 hover:text-foreground" /></button>
                  ) : (
                    <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-[5px] border border-border bg-secondary px-1.5 py-0.5 text-[8px] font-heading font-bold text-muted-foreground/30 md:inline">⌘K</kbd>
                  )}
                </div>
                <div className="inline-flex h-[36px] items-center rounded-[11px] border border-border bg-background px-3 text-[10px] font-heading font-bold text-muted-foreground/45">
                  {sortedFiltered.length} registro{sortedFiltered.length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block">
            {loading ? (
              <div className="p-16 text-center">
                <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
                <p className="text-[10px] font-heading text-muted-foreground/30">Carregando vendas…</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px]">
                    <thead>
                      <tr className="border-b border-border bg-secondary/35">
                        <SortHead label="Data" field="date" sort={sort} onSort={handleSort} className="pl-5" />
                        <th className="px-4 py-3 text-left text-[9px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/35">Produto</th>
                        <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} />
                        <th className="px-4 py-3 text-left text-[9px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/35">Status</th>
                        <th className="px-4 py-3 text-left text-[9px] font-heading font-black uppercase tracking-[0.18em] text-muted-foreground/35">Taxa</th>
                        <SortHead label="Líquido" field="net" sort={sort} onSort={handleSort} />
                        <th className="w-14" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.length === 0 ? (
                        <tr><td colSpan={7} className="py-20">
                          <div className="flex flex-col items-center justify-center">
                            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[12px] border border-border bg-secondary">
                              <ShoppingCart className="h-4 w-4 text-muted-foreground/20" />
                            </div>
                            <p className="text-[11px] font-heading font-bold text-foreground/70">Nenhuma venda encontrada</p>
                            <p className="mt-1 text-[10px] text-muted-foreground/40">Ajuste o período ou refine a pesquisa.</p>
                          </div>
                        </td></tr>
                      ) : visibleItems.map((tx, i) => (
                        <TxRow key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleItems.length > 0 && (
                  <div className="flex items-center justify-between border-t border-border px-5 py-3">
                    <span className="text-[10px] font-heading font-bold text-muted-foreground/40 tabular-nums">
                      {sortedFiltered.length} transaç{sortedFiltered.length !== 1 ? "ões" : "ão"} · Página {currentPage} de {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[10px] font-heading font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none">
                        <ChevronDown className="h-3 w-3 rotate-90" /> Anterior
                      </button>
                      <span className="px-2 text-[11px] font-heading font-black text-foreground tabular-nums">
                        {hidden ? HIDE : fmt(filteredNetTotal)}
                      </span>
                      <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[10px] font-heading font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none">
                        Próxima <ChevronDown className="h-3 w-3 -rotate-90" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="mb-2 h-4 w-4 text-muted-foreground/15" />
                <p className="text-[11px] font-heading font-bold text-foreground/65">Nenhuma venda encontrada</p>
              </div>
            ) : (
              <>
                {visibleItems.map((tx, i) => (
                  <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between rounded-[12px] border border-border bg-card px-4 py-3">
                    <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="text-[10px] font-heading font-bold text-muted-foreground hover:text-foreground disabled:opacity-30">← Anterior</button>
                    <span className="text-[10px] font-heading font-bold text-muted-foreground/50 tabular-nums">{currentPage} / {totalPages}</span>
                    <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="text-[10px] font-heading font-bold text-muted-foreground hover:text-foreground disabled:opacity-30">Próxima →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ═══════ CHART + TOP PRODUCTS ═══════ */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          <div className="xl:col-span-8 rounded-[14px] border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <p className="text-[10px] font-heading font-bold text-foreground">Evolução da receita</p>
                <p className="mt-0.5 text-[9px] text-muted-foreground/35">Curva de receita líquida no período selecionado</p>
              </div>
              <span className="text-[13px] font-heading font-black text-foreground tabular-nums tracking-[-0.03em]">{hidden ? HIDE : fmt(m.totalNet)}</span>
            </div>
            <div className="px-2 pb-3 pt-1">
              <RevenueChart data={metrics.chartData} hidden={hidden} />
            </div>
          </div>

          <div className="xl:col-span-4 space-y-3">
            {metrics.topProducts.length > 0 && (
              <div className="rounded-[14px] border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Crown className="h-3.5 w-3.5 text-primary/70" />
                  <p className="text-[10px] font-heading font-bold text-foreground">Top Produtos</p>
                </div>
                <div className="divide-y divide-border/60">
                  {metrics.topProducts.slice(0, 5).map((prod, i) => (
                    <div key={prod.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("flex h-6 w-6 items-center justify-center rounded-[8px] text-[9px] font-heading font-black shrink-0", i === 0 ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground/45")}>{i + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-heading font-bold text-foreground">{prod.name}</p>
                          <p className="mt-0.5 text-[9px] text-muted-foreground/35">{prod.sales} venda{prod.sales !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <span className={cn("text-[11px] font-heading font-black tabular-nums tracking-[-0.02em]", i === 0 ? "text-primary" : "text-foreground")}>{hidden ? HIDE : fmtCompact(prod.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[14px] border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-[10px] font-heading font-bold text-foreground">Mix e saúde operacional</p>
                {peakHour !== null ? <span className="text-[9px] text-muted-foreground/35">pico {peakHour}h</span> : <span className="text-[9px] text-muted-foreground/35">sem pico registrado</span>}
              </div>
              <div className="divide-y divide-border/60">
                {paymentMix.map((pm) => {
                  const pct = pm.total > 0 ? (pm.value / pm.total) * 100 : 0;
                  const accent = ACCENT_STYLES[pm.color as AccentTone];
                  return (
                    <div key={pm.label} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={cn("flex h-8 w-8 items-center justify-center rounded-[10px] border [&_svg]:h-4 [&_svg]:w-4", accent.iconWrap)}>{pm.icon}</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-heading font-bold text-foreground">{pm.label}</p>
                          <p className="mt-0.5 text-[9px] text-muted-foreground/35">{pm.count} venda{pm.count !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="min-w-[112px]">
                        <div className="h-[4px] overflow-hidden rounded-full bg-secondary">
                          <div className={cn("h-full rounded-full", accent.rail)} style={{ width: `${Math.max(pct, 4)}%` }} />
                        </div>
                        <p className="mt-1 text-right text-[10px] font-heading font-black text-foreground tabular-nums">{hidden ? HIDE : fmtCompact(pm.value)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-border px-4 py-3">
                {healthItems.map((hi) => {
                  const ok = hi.value <= hi.threshold;
                  return (
                    <div key={hi.label} className="rounded-[10px] border border-border bg-secondary/35 px-2.5 py-2">
                      <p className="text-[8px] font-heading font-black uppercase tracking-[0.14em] text-muted-foreground/35">{hi.label}</p>
                      <p className={cn("mt-1 text-[12px] font-heading font-black tabular-nums", ok ? "text-success" : "text-destructive")}>{hi.value.toFixed(1)}%</p>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[9px] font-heading font-black uppercase tracking-[0.16em] text-muted-foreground/35">Volume por hora</p>
                  <p className="text-[9px] text-muted-foreground/30">baseado nas aprovadas</p>
                </div>
                <div className="flex h-[24px] items-end gap-[2px]">
                  {metrics.hours.map((v, i) => (
                    <div key={i} className={cn("min-w-0 flex-1 rounded-[2px]", peakHour === i ? "bg-primary" : v > 0 ? "bg-foreground/12" : "bg-foreground/[0.05]")} style={{ height: `${Math.max((v / maxHour) * 100, 6)}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
        <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} productsRaw={productsRaw} onExport={handleExportCSV} />
      </div>
    );
}