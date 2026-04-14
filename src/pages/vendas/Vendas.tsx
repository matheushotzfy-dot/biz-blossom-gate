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
     <div className="mx-auto w-full max-w-[1440px] pb-20">

    {/* ════════ HEADER ════════ */}
    <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
     <div>
      <div className="flex items-center gap-3 mb-2">
       <div className="h-10 w-10 rounded-[14px] bg-primary/10 border border-primary/15 flex items-center justify-center">
        <ShoppingCart className="h-[18px] w-[18px] text-primary" />
       </div>
       <div>
        <h1 className="text-[24px] font-heading font-black tracking-[-0.04em] text-foreground leading-none">Minhas Vendas</h1>
        <p className="text-[11px] text-muted-foreground/50 mt-1 font-medium">
         {periodLabel} · <span className="tabular-nums font-numbers">{sortedFiltered.length}</span> transações
         {lastSaleText && <span className="text-muted-foreground/30"> · última {lastSaleText}</span>}
        </p>
       </div>
      </div>
     </div>
     <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-[14px] border border-border/30 bg-card p-1 gap-0.5">
       {PERIODS.map((opt) => (
        <button
         key={opt.label}
         onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
         className={cn(
          "rounded-[10px] px-3.5 py-[7px] text-[11px] font-bold transition-all duration-200",
          !isCustom && selectedPeriod.label === opt.label
           ? "bg-primary text-primary-foreground shadow-sm"
           : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/8"
         )}
        >
         {opt.label}
        </button>
       ))}
      </div>
      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
       <PopoverTrigger asChild>
        <button className={cn("h-[34px] rounded-[12px] border px-3.5 text-[11px] font-bold transition-all inline-flex items-center gap-1.5",
         isCustom ? "border-primary/30 bg-primary/8 text-primary" : "border-border/30 bg-card text-muted-foreground/50 hover:text-foreground hover:border-border/50"
        )}>
         <CalendarDays className="h-3.5 w-3.5" />
         {isCustom && customRange?.from
          ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
          : "Período"}
        </button>
       </PopoverTrigger>
       <PopoverContent align="end" className="w-auto overflow-hidden rounded-2xl border border-border/30 bg-popover p-0 shadow-xl">
        <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="pointer-events-auto p-3" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
       </PopoverContent>
      </Popover>
      <button onClick={toggleHidden} className={cn("flex h-[34px] w-[34px] items-center justify-center rounded-[12px] border transition-all", hidden ? "border-primary/30 bg-primary/8 text-primary" : "border-border/30 bg-card text-muted-foreground/40 hover:text-foreground hover:border-border/50")}>
       {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button onClick={() => setShowExportDialog(true)} className="h-[34px] rounded-[12px] border border-border/30 bg-card px-4 text-[11px] font-bold text-muted-foreground/50 hover:text-foreground hover:border-border/50 transition-all inline-flex items-center gap-1.5">
       <Download className="h-3.5 w-3.5" /> Exportar
      </button>
     </div>
    </div>

    {/* ════════ 4 KPI METRICS ════════ */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
     {([
      { label: "Receita Líquida", value: m.totalNet, formatter: fmt, prev: p.totalNet, icon: DollarSign, accent: "primary" as AccentTone, sparkData: metrics.dailyNetArr },
      { label: "Vendas Aprovadas", value: m.approved.length, formatter: (v: number) => String(Math.round(v)), prev: p.approved.length, icon: ShoppingCart, accent: "success" as AccentTone, sparkData: metrics.dailyCountArr },
      { label: "Ticket Médio", value: m.avgTicket, formatter: fmt, prev: p.avgTicket, icon: Receipt, accent: "info" as AccentTone, sparkData: metrics.dailyAvgTicketArr },
      { label: "Conversão", value: m.conversion, formatter: (v: number) => `${v.toFixed(1)}%`, prev: p.conversion, icon: Target, accent: "warning" as AccentTone, sparkData: metrics.dailyApprovalRateArr },
     ] as const).map((item) => {
      const style = ACCENT_STYLES[item.accent];
      return (
      <div key={item.label} className="relative rounded-[20px] border border-border/30 bg-card overflow-hidden transition-colors hover:border-border/50 group">
       {/* Accent rail top */}
       <div className={cn("absolute top-0 left-0 right-0 h-[3px]", style.rail, "opacity-60")} />
       <div className="p-5 lg:p-6 pt-6 lg:pt-7">
        <div className="flex items-start justify-between mb-4">
         <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.16em]">{item.label}</p>
         <div className={cn("h-9 w-9 rounded-[12px] flex items-center justify-center border", style.iconWrap)}>
          <item.icon className="h-4 w-4" />
         </div>
        </div>
        <div className="flex items-end justify-between">
         <div>
          <p className="text-[26px] lg:text-[30px] font-heading font-black tracking-[-0.04em] tabular-nums leading-none text-foreground">
           {hidden ? HIDE : <AnimatedNumber value={item.value} formatter={item.formatter} />}
          </p>
          <div className="mt-3">
           <DeltaBadge cur={item.value} prev={item.prev} />
          </div>
         </div>
         <Sparkline data={item.sparkData} color={item.accent} />
        </div>
       </div>
      </div>
      );
     })}
    </div>

    {/* ════════ REVENUE CHART + HEALTH ════════ */}
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
     {/* Chart - spans 3 cols */}
     <div className="lg:col-span-3 rounded-[20px] border border-border/30 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-border/15">
       <div>
        <h2 className="text-[14px] font-heading font-bold text-foreground tracking-[-0.02em]">Receita no Período</h2>
        <p className="text-[10px] text-muted-foreground/40 mt-1 font-medium">{periodLabel} · comparativo</p>
       </div>
       <div className="flex items-center gap-5 text-[10px] font-medium text-muted-foreground/40">
        <span className="inline-flex items-center gap-2"><span className="h-[3px] w-5 rounded-full bg-primary" />Atual</span>
        <span className="inline-flex items-center gap-2"><span className="h-[3px] w-5 rounded-full bg-muted-foreground/20 border-t border-dashed border-muted-foreground/30" />Anterior</span>
       </div>
      </div>
      <div className="px-4 py-5">
       <RevenueChart data={metrics.chartData} hidden={hidden} />
      </div>
     </div>

     {/* Health sidebar */}
     <div className="rounded-[20px] border border-border/30 bg-card p-6 flex flex-col">
      <h3 className="text-[12px] font-heading font-bold text-foreground tracking-[-0.01em] mb-1">Saúde</h3>
      <p className="text-[9px] text-muted-foreground/40 mb-5">Indicadores de risco</p>
      <div className="space-y-5 flex-1">
       {healthItems.map((hi) => {
        const ok = hi.value <= hi.threshold;
        return (
         <div key={hi.label}>
          <div className="flex items-center justify-between mb-2">
           <div className="flex items-center gap-2">
            <hi.icon className={cn("h-3.5 w-3.5", ok ? "text-success" : "text-destructive")} />
            <span className="text-[11px] font-semibold text-foreground">{hi.label}</span>
           </div>
           <span className={cn("text-[13px] font-black tabular-nums font-numbers", ok ? "text-success" : "text-destructive")}>{hi.value.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/10 overflow-hidden">
           <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(hi.value * (100 / (hi.threshold * 3)), 100)}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={cn("h-full rounded-full", ok ? "bg-success" : "bg-destructive")}
           />
          </div>
          <p className="text-[8px] text-muted-foreground/30 mt-1 font-medium">limite: {hi.threshold}%</p>
         </div>
        );
       })}
      </div>
      {/* Peak hour */}
      <div className="mt-auto pt-5 border-t border-border/15">
       <div className="flex items-center gap-2 mb-3">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-bold text-foreground">Horário de Pico</span>
       </div>
       <div className="flex gap-[2px] items-end h-[36px]">
        {metrics.hours.map((v, i) => (
         <div
          key={i}
          className={cn(
           "flex-1 rounded-[2px] transition-colors min-w-0",
           peakHour === i ? "bg-primary" : v > 0 ? "bg-muted-foreground/12" : "bg-muted/6"
          )}
          style={{ height: `${Math.max((v / maxHour) * 100, 4)}%` }}
          title={`${i}h: ${v} vendas`}
         />
        ))}
       </div>
       {peakHour !== null && (
        <p className="text-[9px] text-muted-foreground/40 mt-2 font-medium">Pico às <span className="text-foreground font-bold">{peakHour}h</span> · {rawPeakSales} vendas</p>
       )}
      </div>
     </div>
    </div>

    {/* ════════ SUPPORTING BLOCKS ════════ */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
     {/* Payment Mix */}
     <div className="rounded-[20px] border border-border/30 bg-card p-6">
      <div className="flex items-center justify-between mb-6">
       <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-[10px] bg-primary/8 border border-primary/12 flex items-center justify-center">
         <PieChart className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-[13px] font-heading font-bold text-foreground tracking-[-0.01em]">Meios de Pagamento</h3>
       </div>
       {dominantMethod.value > 0 && (
        <span className="text-[9px] font-black text-primary bg-primary/8 px-2.5 py-1 rounded-lg border border-primary/10">{dominantMethod.label} lidera</span>
       )}
      </div>
      <div className="space-y-5">
       {paymentMix.map((pm) => {
        const pct = pm.total > 0 ? (pm.value / pm.total) * 100 : 0;
        const accent = ACCENT_STYLES[pm.color as AccentTone];
        return (
         <div key={pm.label}>
          <div className="flex items-center justify-between mb-2.5">
           <div className="flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-[10px] flex items-center justify-center border", accent.iconWrap)}>
             {pm.icon}
            </div>
            <div>
             <span className="text-[12px] font-bold text-foreground block leading-tight">{pm.label}</span>
             <span className="text-[10px] text-muted-foreground/40 font-medium">{pm.count} {pm.count === 1 ? "venda" : "vendas"}</span>
            </div>
           </div>
           <div className="text-right">
            <span className="text-[14px] font-black text-foreground tabular-nums font-numbers block leading-tight">{hidden ? HIDE : fmtCompact(pm.value)}</span>
            <span className={cn("text-[10px] font-bold tabular-nums font-numbers", accent.text)}>{pct.toFixed(1)}%</span>
           </div>
          </div>
          <div className="h-[6px] rounded-full bg-muted/8 overflow-hidden">
           <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={cn("h-full rounded-full", accent.rail)}
           />
          </div>
         </div>
        );
       })}
      </div>
     </div>

     {/* Top Products */}
     <div className="rounded-[20px] border border-border/30 bg-card p-6">
      <div className="flex items-center justify-between mb-6">
       <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-[10px] bg-warning/8 border border-warning/12 flex items-center justify-center">
         <Crown className="h-4 w-4 text-warning" />
        </div>
        <h3 className="text-[13px] font-heading font-bold text-foreground tracking-[-0.01em]">Top Produtos</h3>
       </div>
       {metrics.topProducts.length > 0 && (
        <span className="text-[10px] text-muted-foreground/30 tabular-nums font-bold">{metrics.topProducts.length} produtos</span>
       )}
      </div>
      {metrics.topProducts.length === 0 ? (
       <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="h-14 w-14 rounded-[18px] bg-muted/6 border border-border/15 flex items-center justify-center mb-4">
         <Package className="h-6 w-6 text-muted-foreground/15" />
        </div>
        <p className="text-[12px] font-bold text-muted-foreground/35">Sem vendas neste período</p>
        <p className="text-[10px] text-muted-foreground/20 mt-1">Selecione outro intervalo de datas</p>
       </div>
      ) : (
       <div className="space-y-2.5">
        {metrics.topProducts.map((prod, index) => {
         const maxRev = metrics.topProducts[0]?.revenue || 1;
         const pct = (prod.revenue / maxRev) * 100;
         const isFirst = index === 0;
         return (
          <div key={prod.id} className={cn("flex items-center gap-3 rounded-[14px] p-3.5 transition-colors", isFirst ? "bg-primary/[0.05] border border-primary/12" : "border border-transparent hover:bg-muted/4 hover:border-border/20")}>
           <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[11px] font-black", isFirst ? "bg-primary/12 text-primary border border-primary/15" : "bg-muted/8 text-muted-foreground/40 border border-border/10")}>{index + 1}</span>
           <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between mb-2">
             <p className={cn("text-[12px] font-bold truncate mr-3", isFirst ? "text-foreground" : "text-foreground/80")}>{prod.name}</p>
             <div className="flex items-baseline gap-2 shrink-0">
              <span className={cn("text-[14px] font-black tabular-nums font-numbers", isFirst ? "text-primary" : "text-foreground")}>{hidden ? HIDE : fmtCompact(prod.revenue)}</span>
              <span className="text-[9px] text-muted-foreground/30 tabular-nums font-bold">{prod.sales}x</span>
             </div>
            </div>
            <div className="h-[4px] rounded-full bg-muted/8 overflow-hidden">
             <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, delay: 0.1 + index * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className={cn("h-full rounded-full", isFirst ? "bg-primary" : "bg-muted-foreground/10")}
             />
            </div>
           </div>
          </div>
         );
        })}
       </div>
      )}
     </div>
    </div>

    {/* ════════ TRANSACTIONS TABLE ════════ */}
    <div className="rounded-[20px] border border-border/30 bg-card overflow-hidden">
     {/* Toolbar */}
     <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-6 py-4 border-b border-border/15">
      <div className="flex gap-1 overflow-x-auto">
       {statusTabs.map((tab) => {
        const active = statusFilter === tab.value;
        return (
         <button
          key={tab.value}
          onClick={() => setStatusFilter(tab.value)}
          className={cn(
           "inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[11px] font-bold transition-all border",
           active
            ? "bg-primary/8 text-primary border-primary/15"
            : "text-muted-foreground/40 hover:text-foreground border-transparent hover:bg-muted/6"
          )}
         >
          {tab.label}
          <span className={cn("text-[10px] tabular-nums font-black", active ? "text-primary/50" : "text-muted-foreground/20")}>{tab.count}</span>
         </button>
        );
       })}
      </div>
      <div className="relative w-full lg:w-80">
       <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
       <input
        id="vendas-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar nome, e-mail ou ID…"
        className="h-10 w-full rounded-[12px] border border-border/25 bg-background pl-10 pr-12 text-[12px] font-medium text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/12 focus:border-primary/20 transition-all"
       />
       {search ? (
        <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2">
         <X className="h-3.5 w-3.5 text-muted-foreground/25 hover:text-foreground transition-colors" />
        </button>
       ) : (
        <kbd className="absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-border/20 bg-muted/6 px-1.5 py-0.5 text-[8px] font-bold text-muted-foreground/25 md:inline">⌘K</kbd>
       )}
      </div>
     </div>

     {/* Summary strip */}
     <div className="flex items-center justify-between px-6 py-2.5 border-b border-border/10 bg-muted/[0.015]">
      <p className="text-[10px] text-muted-foreground/35 font-medium">
       {sortedFiltered.length === 0 ? "Nenhuma transação" : `Mostrando ${Math.min(visibleCount, sortedFiltered.length)} de ${sortedFiltered.length}`}
      </p>
      {!hidden && sortedFiltered.length > 0 && (
       <p className="text-[11px] font-black text-foreground tabular-nums font-numbers tracking-tight">Total líquido: {fmt(filteredNetTotal)}</p>
      )}
     </div>

     {/* Desktop Table */}
     <div className="hidden md:block">
      {loading ? (
       <div className="p-24 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary/10 border-t-primary" />
        <p className="text-[11px] text-muted-foreground/40 font-medium">Carregando transações…</p>
       </div>
      ) : (
       <>
        <div className="overflow-x-auto">
         <table className="w-full">
          <thead>
           <tr className="border-b border-border/12 bg-muted/[0.02]">
            <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} className="pl-6" />
            <th className="px-4 py-3.5 text-left text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground/35">Produto</th>
            <SortHead label="Valor" field="amount" sort={sort} onSort={handleSort} />
            <th className="px-4 py-3.5 text-left text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground/35">Método</th>
            <th className="px-4 py-3.5 text-left text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground/35">Status</th>
            <SortHead label="Data" field="date" sort={sort} onSort={handleSort} />
            <th className="w-10" />
           </tr>
          </thead>
          <tbody>
           {visibleItems.length === 0 ? (
            <tr>
             <td colSpan={7} className="py-28">
              <div className="flex flex-col items-center justify-center">
               <div className="h-16 w-16 rounded-[20px] bg-muted/5 border border-border/12 flex items-center justify-center mb-5">
                <ShoppingCart className="h-7 w-7 text-muted-foreground/12" />
               </div>
               <p className="text-[14px] font-bold text-muted-foreground/35">Nenhuma venda encontrada</p>
               <p className="text-[11px] text-muted-foreground/20 mt-2">Ajuste os filtros ou selecione outro período</p>
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
         <div className="border-t border-border/12 p-4 text-center">
          <Button variant="ghost" size="sm" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="gap-2 rounded-[12px] text-[11px] font-bold text-muted-foreground/50 hover:text-foreground">
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
       <div className="p-16 text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary/10 border-t-primary" />
        <p className="text-[11px] text-muted-foreground/40">Carregando…</p>
       </div>
      ) : visibleItems.length === 0 ? (
       <div className="flex flex-col items-center justify-center py-20">
        <ShoppingCart className="h-5 w-5 text-muted-foreground/12 mb-3" />
        <p className="text-[11px] text-muted-foreground/35 font-bold">Nenhuma venda</p>
       </div>
      ) : (
       <>
        {visibleItems.map((tx, i) => (
         <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
        ))}
        {visibleCount < sortedFiltered.length && (
         <Button variant="ghost" size="sm" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="w-full gap-1.5 rounded-[12px] text-[10px] font-bold text-muted-foreground/50 hover:text-foreground">
          <ChevronDown className="h-3 w-3" /> Mais {sortedFiltered.length - visibleCount}
         </Button>
        )}
       </>
      )}
     </div>
    </div>

    {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
    <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} productsRaw={productsRaw} onExport={handleExportCSV} />
   </div>
   );
}
