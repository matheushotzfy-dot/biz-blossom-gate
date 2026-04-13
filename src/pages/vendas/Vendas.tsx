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
 <th onClick={() => onSort(field)} className={cn("text-left py-3.5 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors group", className)}>
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
 <div className="h-[280px] flex flex-col items-center justify-center gap-3">
 {hidden ? <EyeOff className="h-8 w-8 text-muted-foreground/15" /> : <BarChart3 className="h-8 w-8 text-muted-foreground/15" />}
 <span className="text-[11px] text-muted-foreground/40">{hidden ? "Valores ocultos" : "Dados insuficientes para visualização"}</span>
 </div>
 );
 }
 return (
 <ResponsiveContainer width="100%" height={280}>
 <ComposedChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
 <defs>
 <linearGradient id="rv-gradient-premium" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
 <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.06} />
 <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.06} vertical={false} />
 <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
 <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
 <ReTooltip
 contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border)/0.3)", borderRadius: 12, fontSize: 11, padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
 formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
 labelStyle={{ fontSize: 9, color: "hsl(var(--muted-foreground))", marginBottom: 6 }}
 cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
 />
 <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 3" fill="none" opacity={0.15} dot={false} />
 <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rv-gradient-premium)" dot={false} activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
 </ComposedChart>
 </ResponsiveContainer>
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
 className="group cursor-pointer border-b border-border/15 transition-colors duration-150 hover:bg-muted/4"
 >
 <td className="py-3.5 px-5">
 <div className="flex items-center gap-3">
 <Avatar className="h-8 w-8 shrink-0">
  <AvatarFallback className={cn("text-[10px] font-bold", avatarColor(name))}>{initials(name)}</AvatarFallback>
 </Avatar>
 <div className="min-w-0">
 <p className="text-[12px] font-semibold text-foreground truncate leading-tight">{name}</p>
 {tx.customer_email && <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{tx.customer_email}</p>}
 </div>
 </div>
 </td>
 <td className="py-3.5 px-4">
 <span className="text-[11px] text-muted-foreground truncate block max-w-[140px]">{tx.product_id ? (prods[tx.product_id] || "—") : "—"}</span>
 </td>
 <td className="py-3.5 px-4">
 <div>
 <span className="text-[13px] font-bold text-foreground tabular-nums tracking-tight">{fmt(Number(tx.amount))}</span>
 <p className="text-[9px] text-muted-foreground/50 tabular-nums mt-0.5">líq. {fmt(Number(tx.net_amount))}</p>
 </div>
 </td>
 <td className="py-3.5 px-4">
 <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold", method.color)}>
 {method.icon}{method.label}
 </span>
 </td>
 <td className="py-3.5 px-4">
 <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wide border", st.fg, st.bg, st.border)}>
 <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
 {st.label}
 </span>
 </td>
 <td className="py-3.5 px-4">
 <div className="flex flex-col">
 <span className="text-[11px] text-muted-foreground tabular-nums">{fmtDate(tx.created_at)}</span>
 <span className="text-[9px] text-muted-foreground/40 tabular-nums">{fmtTime(tx.created_at)}</span>
 </div>
 </td>
 <td className="py-3.5 px-2">
 <DropdownMenu>
 <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
 <button className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-muted/15 active:scale-95">
 <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
 </button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/30">
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[11px] rounded-lg"><Eye className="h-3.5 w-3.5" /> Ver detalhes</DropdownMenuItem>
 {tx.customer_phone && (
 <>
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_phone!); toast.success("Copiado!"); }} className="gap-2 text-[11px] rounded-lg"><Copy className="h-3.5 w-3.5" /> Copiar telefone</DropdownMenuItem>
 <DropdownMenuItem asChild><a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="gap-2 text-[11px] rounded-lg"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a></DropdownMenuItem>
 </>
 )}
 {tx.status === "completed" && (
 <><DropdownMenuSeparator /><DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Entre em contato com o suporte."); }} className="gap-2 text-[11px] text-destructive focus:text-destructive rounded-lg"><RefreshCw className="h-3.5 w-3.5" /> Reembolsar</DropdownMenuItem></>
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
 className="cursor-pointer rounded-xl border border-border/30 bg-card p-4 transition-colors duration-150 hover:border-border/50 active:scale-[0.99]"
 onClick={onClick}
 >
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-2.5 min-w-0">
 <Avatar className="h-8 w-8 shrink-0">
 <AvatarFallback className={cn("text-[9px] font-bold", avatarColor(name))}>{initials(name)}</AvatarFallback>
 </Avatar>
 <div className="min-w-0">
 <p className="text-[12px] font-bold text-foreground truncate leading-tight">{name}</p>
 <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{tx.customer_email || methodLabels[tx.payment_method || ""] || ""}</p>
 </div>
 </div>
 <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-bold shrink-0 border", st.fg, st.bg, st.border)}>
 <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />{st.label}
 </span>
 </div>
 <div className="flex items-end justify-between">
 <div>
 <p className="text-lg font-black text-foreground tabular-nums tracking-tight leading-none">{fmt(Number(tx.amount))}</p>
 <div className="flex items-center gap-2 mt-1.5">
 <span className="text-[10px] text-muted-foreground font-medium">{methodLabels[tx.payment_method || ""] || "—"}</span>
 <span className="text-[10px] text-muted-foreground/25">·</span>
 <span className="text-[10px] text-muted-foreground/60 truncate max-w-[100px]">{tx.product_id ? prods[tx.product_id] || "" : "—"}</span>
 </div>
 </div>
 <div className="text-right flex flex-col items-end gap-1.5">
 <span className="text-[10px] text-muted-foreground/60 tabular-nums">{fmtDate(tx.created_at)}</span>
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
  <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
   {/* Background — matching Dashboard */}
   <div className="pointer-events-none fixed inset-0 -z-10">
   <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-secondary/20" />
   <div className="absolute inset-0 ambient-grid opacity-[0.12] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.5),transparent_88%)]" />
   </div>

 {/* ════════ HERO ════════ */}
 <motion.section
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.4 }}
 className="relative mb-10 overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-sm sm:p-8 lg:p-10"
 >
 <div className="pointer-events-none absolute inset-0 ambient-grid opacity-[0.08]" />
 <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-secondary/35 to-transparent" />
 <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/70 to-transparent" />
 <div className="relative z-10">
 {/* Header row */}
 <div className="mb-8 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
 <div className="flex flex-wrap items-center gap-2.5">
  <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }} className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-2 shadow-sm">
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
  <DollarSign className="h-4.5 w-4.5" />
  </div>
  <span className="text-[11px] font-heading uppercase tracking-[0.18em] text-foreground/80">Minhas Vendas</span>
  </motion.div>
  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/75 px-3 py-2">
  <span className="h-2 w-2 rounded-full bg-success" />
  <span className="text-[10px] font-heading uppercase tracking-[0.18em] text-muted-foreground">Em tempo real</span>
  </div>
 </div>

 <div className="flex flex-wrap items-center gap-2">
  <div className="inline-flex items-center rounded-full border border-border/60 bg-background/75 p-1 shadow-sm">
  {PERIODS.map((opt) => (
  <button
  key={opt.label}
  onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
  className={cn(
  "rounded-full px-3.5 py-1.5 text-[10px] font-heading transition-colors active:scale-[0.97]",
  !isCustom && selectedPeriod.label === opt.label
  ? "bg-card text-foreground shadow-sm"
  : "text-muted-foreground hover:text-foreground hover:bg-accent/35"
  )}
  >
  {opt.label}
  </button>
  ))}
  </div>

  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
  <PopoverTrigger asChild>
  <button className={cn("h-9 rounded-full border px-3.5 text-[10px] font-heading transition-colors active:scale-[0.97]",
  isCustom ? "border-primary/30 bg-primary/10 text-foreground" : "border-border/60 bg-background/75 text-muted-foreground hover:border-border hover:text-foreground"
  )}>
  <span className="inline-flex items-center gap-1.5">
  <CalendarDays className="h-3 w-3" />
  {isCustom && customRange?.from
  ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
  : "Custom"}
  </span>
  </button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-auto overflow-hidden rounded-2xl border border-border/60 bg-popover p-0 shadow-lg">
  <Calendar
  mode="range"
  selected={customRange}
  onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }}
  numberOfMonths={1}
  locale={ptBR}
  disabled={(date) => date > new Date()}
  className="pointer-events-auto p-3"
  classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }}
  />
  </PopoverContent>
  </Popover>

  <button onClick={toggleHidden} className={cn("flex h-9 w-9 items-center justify-center rounded-full border transition-colors active:scale-[0.97]", hidden ? "border-primary/30 bg-primary/10 text-primary" : "border-border/60 bg-background/75 text-muted-foreground hover:border-border hover:text-foreground")} title={hidden ? "Mostrar" : "Ocultar"}>
  {hidden ? <EyeOff className="mx-auto h-3.5 w-3.5" /> : <Eye className="mx-auto h-3.5 w-3.5" />}
  </button>
  <button onClick={() => setShowExportDialog(true)} className="h-9 rounded-full border border-border/60 bg-background/75 px-3.5 text-[10px] font-heading text-muted-foreground hover:text-foreground hover:border-border transition-colors active:scale-[0.97] inline-flex items-center gap-1.5">
  <Download className="h-3 w-3" /> Exportar
  </button>
 </div>
 </div>

 {/* Main revenue display */}
 <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mb-8">
 <p className="mb-4 text-[11px] font-heading uppercase tracking-[0.18em] text-muted-foreground">
  {isCustom && customRange?.from
  ? `Receita ${customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")}`
  : `Receita líquida — ${periodLabel}`}
 </p>
 <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
  <div>
  <span className="block text-5xl font-heading font-black leading-[0.9] tracking-[-0.05em] text-foreground sm:text-6xl lg:text-[88px]">
  {hidden ? "R$ •••••••" : <AnimatedNumber value={m.totalNet} />}
  </span>
  <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
  Visão consolidada das vendas, conversão e saldo do período selecionado.
  </p>
  </div>
  <div className="flex flex-wrap items-center gap-2.5">
  {[
  { icon: Check, label: `${m.approved.length} aprovadas`, color: "text-success", border: "border-success/15", bg: "bg-success/5" },
  { icon: Clock, label: `${m.pending.length} pendentes`, color: "text-warning", border: "border-warning/15", bg: "bg-warning/5" },
  { icon: Target, label: `${m.conversion.toFixed(1)}% conversão`, color: "text-info", border: "border-info/15", bg: "bg-info/5" },
  { icon: Receipt, label: `ticket ${hidden ? HIDE : fmt(m.avgTicket)}`, color: "text-primary", border: "border-primary/15", bg: "bg-primary/5" },
  { icon: DollarSign, label: `bruto ${hidden ? HIDE : fmtCompact(m.totalGross)}`, color: "text-warning", border: "border-warning/15", bg: "bg-warning/5" },
  ].map((chip, i) => (
  <span key={i} className={`inline-flex items-center gap-2 rounded-full border ${chip.border} ${chip.bg} px-3.5 py-2 text-[11px] font-semibold text-foreground/80`}>
  <chip.icon className={`h-3.5 w-3.5 ${chip.color}`} />
  {chip.label}
  </span>
  ))}
  {lastSaleText && (
  <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3.5 py-2 text-[11px] font-semibold text-primary">
  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
  última venda {lastSaleText}
  </span>
  )}
  </div>
 </div>
 </motion.div>

 {/* KPI strip — matching Dashboard */}
 <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
  {([
  { label: "FATURAMENTO BRUTO", numValue: m.totalGross, formatter: fmt, icon: Banknote, accentBorder: "border-t-primary", iconBg: "bg-primary/10", iconText: "text-primary" },
  { label: "VENDAS APROVADAS", numValue: m.approved.length, formatter: (v: number) => String(Math.round(v)), icon: ShoppingCart, accentBorder: "border-t-success", iconBg: "bg-success/10", iconText: "text-success" },
  { label: "TAXA CONVERSÃO", numValue: m.conversion, formatter: (v: number) => `${v.toFixed(1)}%`, icon: Target, accentBorder: "border-t-info", iconBg: "bg-info/10", iconText: "text-info" },
  { label: "CLIENTES ÚNICOS", numValue: m.uniqueCustomers, formatter: (v: number) => String(Math.round(v)), icon: Users, accentBorder: "border-t-primary", iconBg: "bg-primary/10", iconText: "text-primary" },
  ] as const).map((item, idx) => (
  <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 + idx * 0.07 }}
  className={cn("group relative overflow-hidden rounded-3xl border border-border/60 border-t-2 bg-background/80 p-5 shadow-sm transition-colors", item.accentBorder)}>
  <div className="relative z-10 flex items-start justify-between">
  <div className="flex-1">
  <p className="mb-3 text-[9px] font-heading font-bold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
  <p className="text-[26px] font-heading font-black leading-none tracking-[-0.03em] text-foreground tabular-nums">{hidden ? HIDE : <AnimatedNumber value={item.numValue} formatter={item.formatter} />}</p>
  </div>
  <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", item.iconBg, item.iconText)}>
  <item.icon className="h-5 w-5" />
  </div>
  </div>
  </motion.div>
  ))}
 </div>
 </div>
 </motion.section>

 {/* ════════ REVENUE TIMELINE ════════ */}
 <motion.section
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.4, delay: 0.1 }}
 className="mb-6"
 >
 <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
  <div className="flex items-center gap-3">
  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
  <Activity className="h-4.5 w-4.5" />
  </div>
  <div>
  <h2 className="text-[11px] font-heading uppercase tracking-[0.18em] text-foreground/80">Evolução de Receita</h2>
  <p className="mt-0.5 text-[10px] text-muted-foreground/50">Comparativo com o período anterior</p>
  </div>
  </div>
   <div className="flex flex-wrap gap-4 text-[11px] tabular-nums">
   <span className="inline-flex items-center gap-2">
   <span className="h-2.5 w-2.5 rounded-full bg-primary" />
   Líquido <span className="font-bold text-primary">{hidden ? HIDE : fmtCompact(m.totalNet)}</span>
   </span>
   <span className="inline-flex items-center gap-2 text-muted-foreground/60">
   <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/30" />
   Anterior
   </span>
  </div>
 </div>

 <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm md:p-6 relative overflow-hidden min-h-[280px]">
  <div className="absolute inset-0 ambient-grid opacity-[0.05] pointer-events-none" />
  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/70 to-transparent" />
  <RevenueChart data={metrics.chartData} hidden={hidden} />
 </div>
 </motion.section>

  {/* ════════ INTELLIGENCE PANELS ════════ */}
  <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
   {/* Payment Mix */}
   <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
   className="rounded-2xl border border-border/50 bg-card p-5">
   <div className="mb-5 flex items-center justify-between">
   <div className="flex items-center gap-2.5">
   <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
   <PieChart className="h-4 w-4" />
   </div>
   <div>
   <h3 className="text-[12px] font-heading font-bold text-foreground">Meios de Pagamento</h3>
   <p className="text-[9px] text-muted-foreground/50 mt-0.5">Distribuição por método</p>
   </div>
   </div>
   {dominantMethod.value > 0 && (
   <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold border", ACCENT_STYLES[dominantMethod.color as AccentTone].pill)}>
   <Crown className="h-2.5 w-2.5" /> {dominantMethod.label}
   </span>
   )}
   </div>

   <div className="space-y-3.5">
   {paymentMix.map((pm, idx) => {
   const pct = pm.total > 0 ? (pm.value / pm.total) * 100 : 0;
   const accent = ACCENT_STYLES[pm.color as AccentTone];
   return (
   <motion.div key={pm.label} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.18 + idx * 0.05 }}
   className="rounded-xl border border-border/30 bg-background/60 p-3.5 transition-colors hover:border-border/50">
   <div className="flex items-center justify-between mb-2.5">
   <div className="flex items-center gap-2.5">
   <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", accent.iconWrap)}>
   {pm.icon}
   </div>
   <div>
   <span className="text-[12px] font-bold text-foreground">{pm.label}</span>
   <p className="text-[9px] text-muted-foreground/40 mt-0.5">{pm.count} {pm.count === 1 ? "transação" : "transações"}</p>
   </div>
   </div>
   <div className="text-right">
   <span className="block text-[14px] font-black text-foreground tabular-nums">{hidden ? HIDE : fmtCompact(pm.value)}</span>
   <span className={cn("text-[10px] font-bold tabular-nums", accent.text)}>{pct.toFixed(1)}%</span>
   </div>
   </div>
   <div className="h-1.5 overflow-hidden rounded-full bg-muted/10">
   <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: 0.22 + idx * 0.06, ease: [0.16, 1, 0.3, 1] }} className={cn("h-full rounded-full", accent.rail)} />
   </div>
   </motion.div>
   );
   })}
   </div>

   {/* Health */}
   <div className="mt-5 border-t border-border/20 pt-4">
   <div className="mb-3 flex items-center gap-2">
   <Shield className="h-3.5 w-3.5 text-muted-foreground/40" />
   <h4 className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground/50">Saúde Operacional</h4>
   </div>
   <div className="space-y-2.5">
   {healthItems.map((h) => {
   const tone: AccentTone = h.value > h.threshold ? "destructive" : h.value > h.threshold * 0.7 ? "warning" : "success";
   const accent = ACCENT_STYLES[tone];
   const Icon = h.icon;
   return (
   <div key={h.label} className="flex items-center gap-3">
   <Icon className={cn("h-3.5 w-3.5 shrink-0", accent.text)} />
   <span className="w-20 shrink-0 text-[11px] font-medium text-foreground/60">{h.label}</span>
   <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/8">
   <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(h.value * (100 / h.threshold), 100)}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className={cn("h-full rounded-full", accent.rail)} />
   </div>
   <span className={cn("w-12 text-right text-[11px] font-bold tabular-nums", accent.text)}>{h.value.toFixed(1)}%</span>
   </div>
   );
   })}
   </div>
   </div>
   </motion.div>

   {/* Top Products */}
   <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16 }}
   className="rounded-2xl border border-border/50 bg-card p-5">
   <div className="mb-5 flex items-center justify-between">
   <div className="flex items-center gap-2.5">
   <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
   <Award className="h-4 w-4" />
   </div>
   <div>
   <h3 className="text-[12px] font-heading font-bold text-foreground">Top Produtos</h3>
   <p className="text-[9px] text-muted-foreground/50 mt-0.5">Ranking por receita</p>
   </div>
   </div>
   {metrics.topProducts.length > 0 && (
   <span className="text-[9px] text-muted-foreground/40 tabular-nums">{metrics.topProducts.length} {metrics.topProducts.length === 1 ? "produto" : "produtos"}</span>
   )}
   </div>

   {metrics.topProducts.length === 0 ? (
   <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
   <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/20 bg-muted/5">
   <Package className="h-6 w-6 text-muted-foreground/20" />
   </div>
   <p className="text-[12px] font-bold text-muted-foreground/50">Sem produtos neste período</p>
   <p className="mt-1 text-[10px] text-muted-foreground/30">As vendas aparecerão aqui</p>
   </div>
   ) : (
   <div className="space-y-2">
   {metrics.topProducts.map((prod, index) => {
   const maxRev = metrics.topProducts[0]?.revenue || 1;
   const pct = (prod.revenue / maxRev) * 100;
   const isFirst = index === 0;
   return (
   <motion.div key={prod.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
   className={cn("rounded-xl border p-3.5 transition-colors hover:border-border/50", isFirst ? "border-warning/20 bg-warning/[0.03]" : "border-border/30 bg-background/60")}>
   <div className="flex items-center justify-between mb-2">
   <div className="flex min-w-0 items-center gap-2.5">
   <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black", isFirst ? "bg-warning/12 text-warning" : "bg-muted/10 text-muted-foreground/50")}>
   {index + 1}
   </div>
   <p className="truncate text-[12px] font-bold text-foreground">{prod.name}</p>
   </div>
   <div className="flex shrink-0 items-baseline gap-2">
   <span className={cn("text-[14px] font-black tabular-nums", isFirst ? "text-warning" : "text-foreground")}>{hidden ? HIDE : fmtCompact(prod.revenue)}</span>
   <span className="text-[9px] text-muted-foreground/40 tabular-nums">{prod.sales}x</span>
   </div>
   </div>
   <div className="h-1 overflow-hidden rounded-full bg-muted/8">
   <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: 0.25 + index * 0.04, ease: [0.16, 1, 0.3, 1] }} className={cn("h-full rounded-full", isFirst ? "bg-warning" : "bg-primary/25")} />
   </div>
   </motion.div>
   );
   })}
   </div>
   )}
   </motion.div>

   {/* Peak Hours */}
   <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
   className="rounded-2xl border border-border/50 bg-card p-5">
   <div className="mb-5 flex items-center justify-between">
   <div className="flex items-center gap-2.5">
   <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/10 text-info">
   <Clock className="h-4 w-4" />
   </div>
   <div>
   <h3 className="text-[12px] font-heading font-bold text-foreground">Horário de Pico</h3>
   <p className="text-[9px] text-muted-foreground/50 mt-0.5">Distribuição por hora</p>
   </div>
   </div>
   {peakHour !== null && (
   <div className="flex items-center gap-2 rounded-full border border-info/15 bg-info/5 px-3 py-1.5">
   <Flame className="h-3 w-3 text-info" />
   <span className="text-[12px] font-black text-info tabular-nums">{String(peakHour).padStart(2, "0")}h</span>
   <span className="text-[9px] text-muted-foreground/50">{metrics.hours[peakHour]}x</span>
   </div>
   )}
   </div>

   <div className="rounded-xl border border-border/30 bg-background/60 p-4">
   <div className="flex h-[120px] items-end gap-[3px]">
   {metrics.hours.map((count, hour) => {
   const intensity = count / maxHour;
   const active = peakHour !== null && hour === peakHour;
   return (
   <div key={hour} className="group/bar relative flex h-full flex-1 flex-col items-center justify-end">
   <motion.div
   initial={{ height: 0 }}
   animate={{ height: `${Math.max(intensity * 100, 2)}%` }}
   transition={{ duration: 0.4, delay: 0.12 + hour * 0.012, ease: [0.16, 1, 0.3, 1] }}
   className={cn(
   "w-full rounded-t transition-colors",
   active ? "bg-info rounded-t-sm" : intensity > 0.5 ? "bg-info/30" : intensity > 0 ? "bg-info/10 group-hover/bar:bg-info/18" : "bg-muted/5"
   )}
   />
   <div className="pointer-events-none absolute -top-7 left-1/2 z-30 -translate-x-1/2 scale-90 opacity-0 transition-all duration-150 group-hover/bar:scale-100 group-hover/bar:opacity-100 hidden md:block">
   <div className="whitespace-nowrap rounded-lg border border-border/30 bg-popover px-2 py-0.5 text-[10px] font-bold text-foreground shadow-lg">
   <span className="text-info">{String(hour).padStart(2, "0")}h</span>
   <span className="mx-1 text-muted-foreground/30">·</span>
   <span>{count}</span>
   </div>
   </div>
   </div>
   );
   })}
   </div>
   <div className="mt-2 flex justify-between text-[8px] text-muted-foreground/25 px-0.5">
   <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
   </div>
   </div>

   <div className="mt-4 grid grid-cols-2 gap-3">
   <div className="rounded-xl border border-border/30 bg-background/60 p-3.5">
   <div className="mb-1.5 flex items-center gap-1.5">
   <Users className="h-3 w-3 text-info/60" />
   <p className="text-[9px] font-heading font-bold uppercase tracking-wider text-muted-foreground/50">Clientes Únicos</p>
   </div>
   <p className="text-xl font-black text-foreground tabular-nums">{hidden ? HIDE : m.uniqueCustomers}</p>
   </div>
   <div className="rounded-xl border border-border/30 bg-background/60 p-3.5">
   <div className="mb-1.5 flex items-center gap-1.5">
   <Clock className="h-3 w-3 text-warning/60" />
   <p className="text-[9px] font-heading font-bold uppercase tracking-wider text-muted-foreground/50">Pendentes</p>
   </div>
   <p className={cn("text-xl font-black tabular-nums", m.pending.length > 0 ? "text-warning" : "text-foreground")}>{m.pending.length}</p>
   </div>
   </div>
   </motion.div>
  </section>

 {/* ════════ TRANSACTIONS TABLE ════════ */}
  <motion.section
   initial={{ opacity: 0, y: 12 }}
   animate={{ opacity: 1, y: 0 }}
   transition={{ duration: 0.4, delay: 0.25 }}
  >
   <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between mb-4">
   <div className="flex items-center gap-3">
   <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
   <Layers className="h-4 w-4" />
   </div>
   <div>
   <h2 className="text-[12px] font-heading font-bold text-foreground">Transações</h2>
   <p className="text-[9px] text-muted-foreground/50 mt-0.5">Histórico completo de vendas</p>
   </div>
   </div>
   <div className="relative w-full xl:w-80">
   <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
   <input
   id="vendas-search"
   value={search}
   onChange={(e) => setSearch(e.target.value)}
   placeholder="Buscar nome, e-mail ou ID…"
   className="h-10 w-full rounded-xl border border-border/50 bg-background/75 pl-10 pr-12 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/20 transition-all"
   />
   {search ? (
   <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90">
   <X className="h-3.5 w-3.5 text-muted-foreground/30 hover:text-foreground transition-colors" />
   </button>
   ) : (
   <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border/30 bg-muted/10 px-1.5 py-0.5 text-[8px] text-muted-foreground/40 md:inline">⌘K</kbd>
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
   "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[10px] font-heading font-bold transition-all duration-200 active:scale-[0.97] border",
   active
   ? "bg-card text-foreground border-border/50 shadow-sm"
   : "text-muted-foreground hover:text-foreground border-transparent hover:border-border/30 hover:bg-accent/25"
   )}
   >
   {tab.label}
   <span className={cn("text-[9px] tabular-nums px-1.5 py-0.5 rounded-md", active ? "bg-primary/10 text-primary" : "bg-muted/10 text-muted-foreground/50")}>{tab.count}</span>
   </button>
   );
   })}
   </div>

   <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
   <div className="flex items-center justify-between px-5 py-3 border-b border-border/20">
   <p className="text-[10px] text-muted-foreground/50">
   {sortedFiltered.length === 0 ? "Nenhuma transação" : `${Math.min(visibleCount, sortedFiltered.length)} de ${sortedFiltered.length}`}
   </p>
   {!hidden && sortedFiltered.length > 0 && (
   <p className="text-[11px] font-bold text-primary tabular-nums">{fmt(filteredNetTotal)}</p>
   )}
   </div>

   {/* Desktop Table */}
   <div className="hidden md:block">
  {loading ? (
  <div className="p-20 text-center">
  <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-primary/10 border-t-primary" />
  <p className="text-[11px] text-muted-foreground mt-2">Carregando transações…</p>
  </div>
  ) : (
  <>
  <div className="overflow-x-auto">
  <table className="w-full">
  <thead>
  <tr className="border-b border-border/20 bg-muted/5">
  <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} className="pl-6" />
  <th className="px-4 py-3.5 text-left text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">Produto</th>
  <SortHead label="Valor" field="amount" sort={sort} onSort={handleSort} />
  <th className="px-4 py-3.5 text-left text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">Método</th>
  <th className="px-4 py-3.5 text-left text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">Status</th>
  <SortHead label="Data" field="date" sort={sort} onSort={handleSort} />
  <th className="w-8" />
  </tr>
  </thead>
  <tbody>
  {visibleItems.length === 0 ? (
  <tr>
  <td colSpan={7} className="py-20">
  <div className="flex flex-col items-center justify-center">
  <div className="h-14 w-14 rounded-2xl bg-muted/10 border border-border/20 flex items-center justify-center mb-3">
  <ShoppingCart className="h-6 w-6 text-muted-foreground/20" />
  </div>
  <p className="text-[13px] font-display font-bold text-muted-foreground/50">Nenhuma venda encontrada</p>
  <p className="text-[10px] text-muted-foreground/40 mt-1">Ajuste os filtros ou selecione outro período</p>
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
  <div className="border-t border-border/20 p-4 text-center">
  <Button variant="ghost" size="sm" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="gap-1.5 rounded-full text-[11px] font-heading font-bold text-muted-foreground hover:text-foreground active:scale-[0.97]">
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
  <p className="text-[11px] text-muted-foreground mt-2">Carregando…</p>
  </div>
  ) : visibleItems.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-16">
  <div className="h-14 w-14 rounded-2xl bg-muted/10 border border-border/20 flex items-center justify-center mb-3">
  <ShoppingCart className="h-6 w-6 text-muted-foreground/20" />
  </div>
  <p className="text-[12px] font-display font-bold text-muted-foreground/50">Nenhuma venda</p>
  </div>
  ) : (
  <>
  {visibleItems.map((tx, i) => (
  <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
  ))}
  {visibleCount < sortedFiltered.length && (
  <Button variant="ghost" size="sm" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="w-full gap-1.5 rounded-full text-[10px] font-heading font-bold text-muted-foreground hover:text-foreground active:scale-[0.97]">
  <ChevronDown className="h-3 w-3" /> Mais {sortedFiltered.length - visibleCount}
  </Button>
  )}
  </>
  )}
  </div>
  </div>
 </motion.section>

 {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
 <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} productsRaw={productsRaw} onExport={handleExportCSV} />
 </div>
 );
}
