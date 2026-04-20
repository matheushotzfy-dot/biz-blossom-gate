import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
 FileText, DollarSign, TrendingUp, CreditCard, Search, X, EyeOff,
 Calendar as CalendarIcon, Clock, Users, Eye, MessageCircle, ChevronDown,
 Download, Smartphone, BarChart3, MoreHorizontal, Receipt, ArrowUpRight,
 Zap, ArrowDownRight, Sparkles, CalendarDays, Check, Copy, RefreshCw,
 ChevronUp, ArrowUpDown, Percent, Banknote, ShoppingCart, Layers,
 Activity, Target, Crown, Shield, AlertTriangle, Package, PieChart, Award,
} from "lucide-react";
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
import { motion } from "framer-motion";
import type { DateRange } from "react-day-picker";
import { AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, ComposedChart, CartesianGrid } from "recharts";

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

/* ─── Animated Number ─── */
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

/* ─── Micro Components ─── */
function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
 if (prev === 0 && cur === 0) return null;
 if (prev === 0) return <span className="text-[9px] font-display font-bold text-success bg-success/8 px-2 py-0.5 rounded-md inline-flex items-center gap-0.5 border border-success/10"><Sparkles className="h-2.5 w-2.5" />novo</span>;
 const pct = ((cur - prev) / prev) * 100;
 const up = pct >= 0;
 return (
 <motion.span
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 className={cn("inline-flex items-center gap-0.5 text-[9px] font-display font-bold tabular-nums px-2 py-0.5 rounded-md border", up ? "text-success bg-success/6 border-success/10" : "text-destructive bg-destructive/6 border-destructive/10")}
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
 const id = `ext-spark-${color}-${data.length}`;
 return (
 <svg width={w} height={h} className="shrink-0 opacity-60" viewBox={`0 0 ${w} ${h}`}>
 <defs>
 <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={`hsl(var(--${color}))`} stopOpacity={0.3} />
 <stop offset="100%" stopColor={`hsl(var(--${color}))`} stopOpacity={0} />
 </linearGradient>
 </defs>
 <polygon points={fillPoints} fill={`url(#${id})`} />
 <polyline points={points} fill="none" stroke={`hsl(var(--${color}))`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 );
}

/* ─── Glow Card ─── */
function GlowCard({ children, className, glowColor = "primary", delay = 0 }: { children: React.ReactNode; className?: string; glowColor?: string; delay?: number }) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
 className={cn("relative group rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden ", className)}
 >
 <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[60px] pointer-events-none", `bg-${glowColor}/12`)} />
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
 <div className="relative z-10">{children}</div>
 </motion.div>
 );
}

/* ─── KPI Tile ─── */
function KpiTile({ label, value, icon: Icon, delta, sparkData, hidden, color = "primary", delay = 0, formatter = fmt }: {
 label: string; value: number; icon: any; delta?: { cur: number; prev: number }; sparkData?: number[]; hidden: boolean; color?: string; delay?: number; formatter?: (v: number) => string;
}) {
 return (
 <GlowCard glowColor={color} delay={delay} className="p-5 shimmer">
 <div className={cn("absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-500", `bg-${color}`)} />
 <div className="flex items-start justify-between mb-3">
 <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg", `bg-${color}/10 border-${color}/12 text-${color} group-hover:bg-${color}/15`)}>
 <Icon className="h-5 w-5" />
 </div>
 {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={color} />}
 </div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/60 mb-1.5">{label}</p>
 <div className="flex items-end gap-2">
 <span className="text-2xl font-heading tabular-nums tracking-tight text-foreground leading-none">
 {hidden ? HIDE : <AnimatedNumber value={value} formatter={formatter} />}
 </span>
 {delta && !hidden && <DeltaBadge cur={delta.cur} prev={delta.prev} />}
 </div>
 </GlowCard>
 );
}

/* ─── Revenue Chart ─── */
function RevenueChart({ data, hidden }: { data: { label: string; value: number; previous: number }[]; hidden: boolean }) {
 if (data.length < 2 || hidden) {
 return (
 <div className="h-[260px] flex flex-col items-center justify-center gap-3">
 {hidden ? <EyeOff className="h-8 w-8 text-muted-foreground/6" /> : <BarChart3 className="h-8 w-8 text-muted-foreground/6" />}
 <span className="text-[11px] text-muted-foreground/15 font-display">{hidden ? "Valores ocultos" : "Dados insuficientes"}</span>
 </div>
 );
 }
 return (
 <ResponsiveContainer width="100%" height={260}>
 <ComposedChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
 <defs>
 <linearGradient id="ext-rv-gradient" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
 <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
 <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
 </linearGradient>
 <linearGradient id="ext-rv-stroke" x1="0" y1="0" x2="1" y2="0">
 <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
 <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={1} />
 <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.04} vertical={false} />
 <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
 <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
 <ReTooltip
 contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border)/0.15)", borderRadius: 16, fontSize: 11, padding: "14px 18px", boxShadow: "0 16px 48px rgba(0,0,0,0.2)", fontFamily: "'Plus Jakarta Sans', sans-serif", backdropFilter: "blur(12px)" }}
 formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
 labelStyle={{ fontSize: 9, color: "hsl(var(--muted-foreground))", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}
 cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
 />
 <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 3" fill="none" opacity={0.1} dot={false} />
 <Area type="monotone" dataKey="value" stroke="url(#ext-rv-stroke)" strokeWidth={2.5} fill="url(#ext-rv-gradient)" dot={false} activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
 </ComposedChart>
 </ResponsiveContainer>
 );
}

function SortHead({ label, field, sort, onSort, className }: { label: string; field: SortField; sort: { field: SortField; dir: SortDir }; onSort: (f: SortField) => void; className?: string }) {
 const active = sort.field === field;
 return (
 <th onClick={() => onSort(field)} className={cn("text-left py-3.5 px-4 text-[10px] font-display font-bold text-muted-foreground/60 uppercase tracking-wider cursor-pointer select-none hover:text-foreground/80 transition-colors group", className)}>
 <span className="inline-flex items-center gap-1">
 {label}
 {active
 ? (sort.dir === "desc" ? <ChevronDown className="h-3 w-3 text-primary" /> : <ChevronUp className="h-3 w-3 text-primary" />)
 : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
 </span>
 </th>
 );
}

/* ─── Desktop Row ─── */
function TxRow({ tx, prods, onClick, i }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; i: number }) {
 const methods: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
 pix: { label: "PIX", icon: <Smartphone className="h-3 w-3" />, color: "text-success" },
 credit_card: { label: "Cartão", icon: <CreditCard className="h-3 w-3" />, color: "text-info" },
 boleto: { label: "Boleto", icon: <FileText className="h-3 w-3" />, color: "text-warning" },
 };
 const method = methods[tx.payment_method || ""] || { label: tx.payment_method || "—", icon: null, color: "text-muted-foreground" };
 const name = tx.customer_name || "Cliente";
 const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted/8", border: "border-border/10" };

 return (
 <motion.tr
 initial={{ opacity: 0, x: -8 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.3), ease: [0.16, 1, 0.3, 1] }}
 onClick={onClick}
 className="group cursor-pointer border-b border-border/[0.04] transition-all duration-200"
 >
 <td className="py-4 px-5">
 <div className="flex items-center gap-3">
 <Avatar className="h-9 w-9 shrink-0 ring-2 ring-transparent group-hover:ring-primary/10 transition-all">
 <AvatarFallback className={cn("text-[10px] font-display font-bold", avatarColor(name))}>{initials(name)}</AvatarFallback>
 </Avatar>
 <div className="min-w-0">
 <p className="text-[12px] font-display font-semibold text-foreground truncate leading-tight">{name}</p>
 {tx.customer_email && <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5 font-mono">{tx.customer_email}</p>}
 </div>
 </div>
 </td>
 <td className="py-4 px-4">
 <span className="text-[11px] text-muted-foreground/70 truncate block max-w-[140px] font-display">{tx.product_id ? (prods[tx.product_id] || "—") : "—"}</span>
 </td>
 <td className="py-4 px-4">
 <div>
 <span className="text-[13px] font-display font-bold text-foreground tabular-nums tracking-tight">{fmt(Number(tx.amount))}</span>
 <p className="text-[9px] text-muted-foreground/50 tabular-nums mt-0.5 font-mono">líq. {fmt(Number(tx.net_amount))}</p>
 </div>
 </td>
 <td className="py-4 px-4">
 <span className={cn("inline-flex items-center gap-1 text-[10px] font-display font-semibold", method.color)}>
 {method.icon}{method.label}
 </span>
 </td>
 <td className="py-4 px-4">
 <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-display font-bold tracking-wide border", st.fg, st.bg, st.border)}>
 <span className={cn("h-1.5 w-1.5 rounded-full", st.dot, tx.status === "completed" && "animate-pulse")} />
 {st.label}
 </span>
 </td>
 <td className="py-4 px-4">
 <div className="flex flex-col">
  <span className="text-[11px] text-muted-foreground/65 tabular-nums font-mono">{fmtDate(tx.created_at)}</span>
  <span className="text-[9px] text-muted-foreground/50 tabular-nums font-mono">{fmtTime(tx.created_at)}</span>
 </div>
 </td>
 <td className="py-4 px-2">
 <DropdownMenu>
 <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
 <button className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-muted/20 active:scale-95">
 <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/40" />
 </button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/20">
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[11px] rounded-lg font-display"><Eye className="h-3.5 w-3.5" /> Ver detalhes</DropdownMenuItem>
 {tx.customer_phone && (
 <>
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_phone!); toast.success("Copiado!"); }} className="gap-2 text-[11px] rounded-lg font-display"><Copy className="h-3.5 w-3.5" /> Copiar telefone</DropdownMenuItem>
 <DropdownMenuItem asChild><a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="gap-2 text-[11px] rounded-lg font-display"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a></DropdownMenuItem>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </td>
 </motion.tr>
 );
}

/* ─── Mobile Card ─── */
function MobileCard({ tx, prods, onClick, i }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; i: number }) {
 const name = tx.customer_name || "Cliente";
 const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted/8", border: "border-border/10" };
 const methodLabels: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto" };

 return (
 <motion.div
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.15), ease: [0.16, 1, 0.3, 1] }}
 className="rounded-2xl bg-card/50 backdrop-blur-lg border border-border/10 p-4 cursor-pointer active:scale-[0.985] transition-all hover:border-primary/15 hover:shadow-lg hover:shadow-primary/5"
 onClick={onClick}
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-2.5 min-w-0">
 <Avatar className="h-9 w-9 shrink-0">
 <AvatarFallback className={cn("text-[9px] font-display font-bold", avatarColor(name))}>{initials(name)}</AvatarFallback>
 </Avatar>
 <div className="min-w-0">
 <p className="text-[12px] font-display font-bold text-foreground truncate leading-tight">{name}</p>
 <p className="text-[10px] text-muted-foreground/30 truncate mt-0.5 font-display">{tx.customer_email || methodLabels[tx.payment_method || ""] || ""}</p>
 </div>
 </div>
 <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-display font-bold shrink-0 border", st.fg, st.bg, st.border)}>
 <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />{st.label}
 </span>
 </div>
 <div className="flex items-end justify-between">
 <div>
 <p className="text-xl font-display font-black text-foreground tabular-nums tracking-tight leading-none">{fmt(Number(tx.amount))}</p>
 <div className="flex items-center gap-2 mt-1.5">
 <span className="text-[10px] text-muted-foreground/30 font-display font-semibold">{methodLabels[tx.payment_method || ""] || "—"}</span>
 <span className="text-[10px] text-muted-foreground/10">·</span>
 <span className="text-[10px] text-muted-foreground/30 truncate max-w-[100px] font-display">{tx.product_id ? prods[tx.product_id] || "" : "—"}</span>
 </div>
 </div>
 <div className="text-right flex flex-col items-end gap-1.5">
 <span className="text-[10px] text-muted-foreground/30 tabular-nums font-mono">{fmtDate(tx.created_at)}</span>
 {tx.customer_phone && (
 <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="h-7 w-7 rounded-lg bg-success/8 flex items-center justify-center text-success hover:bg-success/15 transition-colors active:scale-95 border border-success/10">
 <MessageCircle className="h-3 w-3" />
 </a>
 )}
 </div>
 </div>
 </motion.div>
 );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN PAGE */
/* ═══════════════════════════════════════════════════════════════════════ */

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
 const [selectedPeriod, setSelectedPeriod] = useState<Period>(PERIODS[0]);
 const [customRange, setCustomRange] = useState<DateRange | undefined>();
 const [isCustom, setIsCustom] = useState(false);
 const [datePickerOpen, setDatePickerOpen] = useState(false);
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
 const totalNet = approved.reduce((a, t) => a + Number(t.net_amount), 0);
 const totalGross = approved.reduce((a, t) => a + Number(t.amount), 0);
 const totalFees = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
 const avgTicket = approved.length > 0 ? totalGross / approved.length : 0;
 const uniqueCustomers = new Set(approved.map(t => t.customer_email).filter(Boolean)).size;
 return { approved, totalNet, totalGross, totalFees, avgTicket, uniqueCustomers };
 };
 const current = calc(dateFiltered);
 const previous = calc(previousPeriodFiltered);

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
 const dailyGrossMap: Record<string, number> = {};
 const dailyCountMap: Record<string, number> = {};
 for (const t of current.approved) {
 const day = fmtDate(t.created_at);
 dailyCountMap[day] = (dailyCountMap[day] || 0) + 1;
 dailyGrossMap[day] = (dailyGrossMap[day] || 0) + Number(t.amount);
 }
 Object.keys(dailyMap).reverse().forEach(day => {
 dailyCountArr.push(dailyCountMap[day] || 0);
 dailyGrossArr.push(dailyGrossMap[day] || 0);
 });

 return { current, previous, chartData, dailyNetArr, dailyGrossArr, dailyCountArr };
 }, [dateFiltered, previousPeriodFiltered]);

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

 const handleExportCSV = useCallback(() => {
 if (sortedFiltered.length === 0) { toast.error("Nenhuma transação para exportar."); return; }
 const headers = ["ID", "Cliente", "Email", "Telefone", "CPF/CNPJ", "Produto", "Valor Bruto", "Taxa", "Líquido", "Método", "Status", "Data"];
 const rows = sortedFiltered.map(t => [t.id, t.customer_name || "", t.customer_email || "", t.customer_phone || "", t.customer_document || "", t.product_id ? products[t.product_id] || "" : "", Number(t.amount), Number(t.fee_amount), Number(t.net_amount), t.payment_method || "", t.status, t.created_at]);
 const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${sanitize(c).replace(/"/g, '""')}"`).join(","))].join("\n");
 const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a"); a.href = url; a.download = `extrato-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
 URL.revokeObjectURL(url);
 toast.success(`${sortedFiltered.length} transações exportadas!`);
 }, [sortedFiltered, products, sanitize]);

 useEffect(() => {
 const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); document.getElementById("extrato-search")?.focus(); } };
 window.addEventListener("keydown", handler);
 return () => window.removeEventListener("keydown", handler);
 }, []);

 const m = metrics.current;
 const p = metrics.previous;
 const filteredNetTotal = sortedFiltered.reduce((acc, tx) => acc + Number(tx.net_amount), 0);
 const periodLabel = isCustom
 ? customRange?.from
 ? customRange?.to
 ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}`
 : format(customRange.from, "dd/MM/yyyy")
 : "Personalizado"
 : selectedPeriod.label;

 /* ═══════════ RENDER ═══════════ */
 return (
 <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">

 {/* ═══════════════════════════════════════════ */}
 {/* HERO — EXTRATO */}
 {/* ═══════════════════════════════════════════ */}
 <motion.section
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.4 }}
 className="relative mb-10 rounded-2xl border border-border/50 bg-card/95 p-6 sm:p-8 lg:p-10"
 >

 <div className="relative z-10">
 {/* Top controls bar */}
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-14">
 <div className="flex items-center gap-3">
 <motion.div
 initial={{ width: 0, opacity: 0 }}
 animate={{ width: "auto", opacity: 1 }}
 transition={{ duration: 0.6, delay: 0.2 }}
 className="inline-flex items-center gap-2.5"
 >
 <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
 <Receipt className="h-4.5 w-4.5 text-primary" />
 </div>
 <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80 block leading-tight">Extrato</span>
 </motion.div>
 <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 shadow-[0_0_16px_rgba(34,197,94,0.12)] backdrop-blur-sm">
 <span className="relative flex h-2 w-2">
 <span className="absolute h-full w-full rounded-full bg-success pulse-ring" />
 <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />
 <span className="relative h-2 w-2 rounded-full bg-success shadow-[0_0_12px_rgba(34,197,94,0.8)]" />
 </span>
 <span className="text-[8px] font-heading uppercase tracking-[0.25em] text-success">Tempo Real</span>
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-1.5">
 <div className="inline-flex items-center rounded-full border border-border/60 bg-card shadow-sm p-0.5">
 {PERIODS.map((opt) => (
 <button
 key={opt.label}
 onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
 className={cn(
 "rounded-full px-3.5 py-1.5 text-[10px] font-heading transition-all duration-400 active:scale-[0.97]",
 !isCustom && selectedPeriod.label === opt.label
 ? "bg-primary text-primary-foreground shadow-[0_2px_16px_rgba(16,185,129,0.3)]"
 : "text-muted-foreground/35 hover:text-foreground/70"
 )}
 >
 {opt.label}
 </button>
 ))}
 </div>
 <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
 <PopoverTrigger asChild>
 <button className={cn(
 "h-8 rounded-full border px-3.5 text-[10px] font-heading transition-all active:scale-[0.97]",
 isCustom ? "border-primary/20 bg-primary/8 text-primary shadow-[0_0_10px_rgba(16,185,129,0.15)]" : "border-border/10 text-muted-foreground/30 hover:text-foreground hover:border-border/20"
 )}>
 <span className="inline-flex items-center gap-1.5">
 <CalendarDays className="h-3 w-3" />
 {isCustom && customRange?.from
 ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
 : "Custom"}
 </span>
 </button>
 </PopoverTrigger>
 <PopoverContent align="end" className="w-auto overflow-hidden rounded-2xl border border-border/15 bg-card/95 backdrop-blur-xl p-0 shadow-2xl">
 <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-3 pointer-events-auto" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
 </PopoverContent>
 </Popover>
 <span className="w-px h-5 bg-border/8 mx-1 hidden sm:block" />
 <button onClick={toggleHidden} className={cn("h-8 w-8 rounded-full transition-all active:scale-[0.97] border border-transparent hover:border-border/10", hidden ? "text-primary bg-primary/8" : "text-muted-foreground/25 hover:text-foreground")} title={hidden ? "Mostrar" : "Ocultar"}>
 {hidden ? <EyeOff className="mx-auto h-3.5 w-3.5" /> : <Eye className="mx-auto h-3.5 w-3.5" />}
 </button>
 <button onClick={handleExportCSV} className="h-8 rounded-full px-3.5 text-[10px] font-heading text-muted-foreground/25 transition-all hover:text-foreground border border-transparent hover:border-border/10 active:scale-[0.97] inline-flex items-center gap-1.5">
 <Download className="h-3 w-3" /> Exportar
 </button>
 </div>
 </div>

 {/* MAIN FOCAL POINT — Net Revenue */}
 <motion.div
 initial={{ opacity: 0, y: 24 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
 className="mb-10"
 >
 <div className="flex items-center gap-3 mb-5">
 <div className="h-px flex-1 max-w-[48px] bg-gradient-to-r from-primary/40 to-transparent" />
 <p className="text-[10px] font-heading uppercase tracking-[0.3em] text-gradient-premium">Saldo do Período</p>
 <div className="h-px flex-1 max-w-[48px] bg-gradient-to-l from-primary/40 to-transparent" />
 </div>
 <div className="flex items-end gap-5 mb-3">
 <motion.span
 className="text-5xl sm:text-7xl lg:text-[100px] font-heading tabular-nums text-foreground leading-[0.82] [text-shadow:0_0_120px_hsl(var(--primary)/0.3),0_0_60px_hsl(var(--primary)/0.1),0_4px_24px_hsl(var(--background)/0.5)]"
 initial={{ scale: 0.95 }}
 animate={{ scale: 1 }}
 transition={{ duration: 0.5, delay: 0.3 }}
 >
 {hidden ? "R$ •••••••" : <AnimatedNumber value={m.totalNet} />}
 </motion.span>
 {!hidden && <DeltaBadge cur={m.totalNet} prev={p.totalNet} />}
 </div>
 <div className="flex flex-wrap items-center gap-2.5 mt-6">
 {[
 { icon: CalendarDays, text: periodLabel },
 { icon: Check, text: `${m.approved.length} aprovadas`, iconColor: "text-success" },
 { icon: DollarSign, text: `bruto ${hidden ? HIDE : fmtCompact(m.totalGross)}` },
 { icon: Percent, text: `taxas ${hidden ? HIDE : fmtCompact(m.totalFees)}`, iconColor: "text-destructive/60" },
 ].map((chip, i) => (
 <motion.span
 key={i}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.4 + i * 0.08 }}
 className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display border border-border/60 bg-card shadow-sm rounded-full px-3.5 py-1.5"
 >
 <chip.icon className={cn("h-3 w-3", chip.iconColor)} /> {chip.text}
 </motion.span>
 ))}
 </div>
 </motion.div>

 {/* Executive Strip */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
 {[
 { label: "Receita Líquida", value: hidden ? HIDE : fmt(m.totalNet), color: "primary", icon: DollarSign },
 { label: "Faturamento Bruto", value: hidden ? HIDE : fmt(m.totalGross), color: "info", icon: Banknote },
 { label: "Ticket Médio", value: hidden ? HIDE : fmt(m.avgTicket), color: "warning", icon: Receipt },
 { label: "Clientes Únicos", value: hidden ? HIDE : String(m.uniqueCustomers), color: "success", icon: Users },
 ].map((item, idx) => (
 <motion.div
 key={item.label}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay: 0.35 + idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
 className="group relative rounded-2xl border border-border/60 bg-card shadow-sm p-5 overflow-hidden"
 >
 <div className={cn("absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[50px] pointer-events-none", `bg-${item.color}/10`)} />
 <div className="relative z-10 flex items-start justify-between">
 <div>
 <p className="text-[9px] font-heading uppercase tracking-[0.22em] text-muted-foreground/30 mb-2.5">{item.label}</p>
 <p className={cn("text-2xl font-heading tabular-nums tracking-tight leading-none text-foreground")}>{item.value}</p>
 </div>
 <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110", `bg-${item.color}/8 border-${item.color}/10 text-${item.color}/50`)}>
 <item.icon className="h-5 w-5" />
 </div>
 </div>
 </motion.div>
 ))}
 </div>
 </div>
 </motion.section>

 {/* ═══════════════════════════════════════════ */}
 {/* KPI TILES */}
 {/* ═══════════════════════════════════════════ */}
 <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-10">
 <KpiTile label="Faturamento Bruto" value={m.totalGross} icon={Banknote} delta={{ cur: m.totalGross, prev: p.totalGross }} sparkData={metrics.dailyGrossArr} hidden={hidden} color="primary" delay={0} />
 <KpiTile label="Vendas Aprovadas" value={m.approved.length} icon={ShoppingCart} delta={{ cur: m.approved.length, prev: p.approved.length }} sparkData={metrics.dailyCountArr} hidden={hidden} color="success" delay={0.05} formatter={(v) => Math.round(v).toString()} />
 <KpiTile label="Clientes Únicos" value={m.uniqueCustomers} icon={Users} hidden={hidden} color="info" delay={0.1} formatter={(v) => Math.round(v).toString()} />
 <KpiTile label="Total em Taxas" value={m.totalFees} icon={Percent} hidden={hidden} color="destructive" delay={0.15} />
 </section>

 {/* ═══════════════════════════════════════════ */}
 {/* REVENUE CHART */}
 {/* ═══════════════════════════════════════════ */}
 <motion.section
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay: 0.2 }}
 className="mb-10"
 >
 <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/12 flex items-center justify-center">
 <Activity className="h-4.5 w-4.5 text-primary" />
 </div>
 <div>
 <h2 className="text-sm font-heading text-foreground/80 uppercase tracking-[0.12em]">Evolução de Receita</h2>
 <p className="text-[9px] text-muted-foreground/25 font-display mt-0.5">Comparativo com período anterior</p>
 </div>
 </div>
 <div className="flex gap-5 text-[11px] font-display tabular-nums">
 <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]" /> Líquido <span className="font-bold text-primary">{hidden ? HIDE : fmtCompact(m.totalNet)}</span></span>
 <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/15 border border-dashed border-muted-foreground/25" /> Anterior</span>
 </div>
 </div>
 <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 relative overflow-hidden ">

 <div className="relative z-10">
 <RevenueChart data={metrics.chartData} hidden={hidden} />
 </div>
 </div>
 </motion.section>

 {/* ═══════════════════════════════════════════ */}
 {/* TRANSACTIONS TABLE */}
 {/* ═══════════════════════════════════════════ */}
 <motion.section
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay: 0.3 }}
 >
 <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between mb-5">
 <div className="flex items-center gap-3">
 <div className="h-8 w-8 rounded-xl bg-card/50 border border-border/10 flex items-center justify-center">
 <Layers className="h-4 w-4 text-muted-foreground/40" />
 </div>
 <h2 className="text-sm font-heading text-foreground/80 uppercase tracking-[0.1em]">Transações</h2>
 </div>
 <div className="relative w-full xl:w-80">
 <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/15" />
 <input
 id="extrato-search"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Buscar nome, e-mail ou ID…"
 className="h-10 w-full rounded-xl border border-border/8 bg-card/30 backdrop-blur-lg pl-10 pr-12 text-[12px] text-foreground placeholder:text-muted-foreground/15 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-display"
 />
 {search ? (
 <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90">
 <X className="h-3.5 w-3.5 text-muted-foreground/20 hover:text-foreground transition-colors" />
 </button>
 ) : (
 <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border/8 bg-muted/8 px-1.5 py-0.5 text-[8px] text-muted-foreground/15 md:inline font-mono">⌘K</kbd>
 )}
 </div>
 </div>

 {/* Status filter pills */}
 <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
 {statusTabs.map((tab) => {
 const active = statusFilter === tab.value;
 return (
 <button
 key={tab.value}
 onClick={() => setStatusFilter(tab.value)}
 className={cn(
 "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[10px] font-display font-bold transition-all duration-300 active:scale-[0.97] border",
 active
 ? "bg-primary text-primary-foreground border-primary/20 shadow-[0_2px_12px_rgba(16,185,129,0.2)]"
 : "text-muted-foreground/25 hover:text-foreground/60 border-transparent hover:border-border/10 hover:bg-card/30"
 )}
 >
 {tab.label}
 <span className={cn("text-[9px] tabular-nums px-1.5 py-0.5 rounded-full", active ? "bg-primary-foreground/20 text-primary-foreground/80" : "bg-muted/8 text-muted-foreground/15")}>{tab.count}</span>
 </button>
 );
 })}
 </div>

 <div className="overflow-hidden rounded-2xl border border-border/8 bg-card/30 backdrop-blur-xl shadow-[0_2px_24px_hsl(var(--background)/0.2)]">
 <div className="flex items-center justify-between px-6 py-3 border-b border-border/4 bg-card/20">
 <p className="text-[10px] text-muted-foreground/15 font-mono">
 {sortedFiltered.length === 0 ? "Nenhuma transação" : `${Math.min(visibleCount, sortedFiltered.length)} de ${sortedFiltered.length}`}
 </p>
 {!hidden && sortedFiltered.length > 0 && (
 <p className="text-[11px] font-display font-bold text-primary tabular-nums">{fmt(filteredNetTotal)}</p>
 )}
 </div>

 {/* Desktop Table */}
 <div className="hidden md:block">
 {loading ? (
 <div className="p-20 text-center">
 <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-primary/10 border-t-primary" />
 <p className="text-[11px] text-muted-foreground/15 font-display mt-2">Carregando transações…</p>
 </div>
 ) : (
 <>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-border/4">
 <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} className="pl-6" />
 <th className="px-4 py-3.5 text-left text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/20">Produto</th>
 <SortHead label="Valor" field="amount" sort={sort} onSort={handleSort} />
 <th className="px-4 py-3.5 text-left text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/20">Método</th>
 <th className="px-4 py-3.5 text-left text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/20">Status</th>
 <SortHead label="Data" field="date" sort={sort} onSort={handleSort} />
 <th className="w-8" />
 </tr>
 </thead>
 <tbody>
 {visibleItems.length === 0 ? (
 <tr>
 <td colSpan={7} className="py-24">
 <div className="flex flex-col items-center justify-center">
 <div className="h-16 w-16 rounded-2xl bg-muted/4 border border-border/6 flex items-center justify-center mb-4">
 <Receipt className="h-7 w-7 text-muted-foreground/8" />
 </div>
 <p className="text-[13px] font-display font-bold text-muted-foreground/15">Nenhuma transação encontrada</p>
 <p className="text-[10px] text-muted-foreground/10 font-display mt-1">Ajuste os filtros ou selecione outro período</p>
 </div>
 </td>
 </tr>
 ) : visibleItems.map((tx, i) => (
 <TxRow key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
 ))}
 </tbody>
 </table>
 </div>
 {visibleCount < sortedFiltered.length && (
 <div className="border-t border-border/4 p-4 text-center">
 <Button variant="ghost" size="sm" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="gap-1.5 rounded-full text-[11px] font-display font-bold text-muted-foreground/20 hover:text-foreground active:scale-[0.97]">
 <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({sortedFiltered.length - visibleCount})
 </Button>
 </div>
 )}
 </>
 )}
 </div>

 {/* Mobile Cards */}
 <div className="space-y-2 p-3 md:hidden">
 {loading ? (
 <div className="p-14 text-center">
 <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-primary/10 border-t-primary" />
 <p className="text-[11px] text-muted-foreground/12 font-display mt-2">Carregando…</p>
 </div>
 ) : visibleItems.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20">
 <div className="h-14 w-14 rounded-2xl bg-muted/4 border border-border/6 flex items-center justify-center mb-3">
 <Receipt className="h-6 w-6 text-muted-foreground/8" />
 </div>
 <p className="text-[12px] font-display font-bold text-muted-foreground/15">Nenhuma transação</p>
 </div>
 ) : (
 <>
 {visibleItems.map((tx, i) => (
 <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
 ))}
 {visibleCount < sortedFiltered.length && (
 <Button variant="ghost" size="sm" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="w-full gap-1.5 rounded-full text-[10px] font-display font-bold text-muted-foreground/20 hover:text-foreground active:scale-[0.97]">
 <ChevronDown className="h-3 w-3" /> Mais {sortedFiltered.length - visibleCount}
 </Button>
 )}
 </>
 )}
 </div>
 </div>
 </motion.section>

 {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
 </div>
 );
}
