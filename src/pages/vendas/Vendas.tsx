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
  ArrowUpDown, SortAsc, SortDesc, CircleDot, Minus, Sparkles, Box,
  ChevronRight, Star, Shield, Banknote,
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
  completed: { label: "Aprovada", fg: "text-success", dot: "bg-success", bg: "bg-success/8", border: "border-success/12" },
  pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/8", border: "border-warning/12" },
  failed: { label: "Falha", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/8", border: "border-destructive/12" },
  refunded: { label: "Reembolso", fg: "text-info", dot: "bg-info", bg: "bg-info/8", border: "border-info/12" },
  chargeback: { label: "Chargeback", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/8", border: "border-destructive/12" },
};

/* ─────────────────────── Micro Components ─────────────────────── */

function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return <span className="text-[9px] font-display font-bold text-success bg-success/8 px-2 py-0.5 rounded-md inline-flex items-center gap-0.5 border border-success/10"><Sparkles className="h-2.5 w-2.5" />novo</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-display font-bold tabular-nums px-2 py-0.5 rounded-md border", up ? "text-success bg-success/6 border-success/10" : "text-destructive bg-destructive/6 border-destructive/10")}>
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
    <th onClick={() => onSort(field)} className={cn("text-left py-3 px-4 text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider cursor-pointer select-none hover:text-foreground/60 transition-colors group", className)}>
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
      <div className="h-[200px] flex flex-col items-center justify-center gap-2">
        {hidden ? <EyeOff className="h-5 w-5 text-muted-foreground/10" /> : <BarChart3 className="h-5 w-5 text-muted-foreground/10" />}
        <span className="text-[11px] text-muted-foreground/20 font-display">{hidden ? "Valores ocultos" : "Dados insuficientes"}</span>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="rv-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.08} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
        <ReTooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11, padding: "10px 14px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
          labelStyle={{ fontSize: 9, color: "hsl(var(--muted-foreground))", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}
          cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 3" fill="none" opacity={0.15} dot={false} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rv-gradient)" dot={false} activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.2) }}
      onClick={onClick}
      className="group cursor-pointer border-b border-border/[0.05] hover:bg-primary/[0.02] transition-colors duration-150"
    >
      <td className="py-3.5 px-5">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className={cn("text-[9px] font-display font-bold", avatarColor(name))}>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[12px] font-display font-semibold text-foreground truncate leading-tight">{name}</p>
            {tx.customer_email && <p className="text-[10px] text-muted-foreground/30 truncate mt-0.5 font-mono">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <span className="text-[11px] text-muted-foreground/40 truncate block max-w-[140px] font-display">{tx.product_id ? (prods[tx.product_id] || "—") : "—"}</span>
      </td>
      <td className="py-3.5 px-4">
        <div>
          <span className="text-[13px] font-display font-bold text-foreground tabular-nums tracking-tight">{fmt(Number(tx.amount))}</span>
          <p className="text-[9px] text-muted-foreground/25 tabular-nums mt-0.5 font-mono">líq. {fmt(Number(tx.net_amount))}</p>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-display font-semibold", method.color)}>
          {method.icon}{method.label}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-display font-bold tracking-wide border", st.fg, st.bg, st.border)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", st.dot, tx.status === "completed" && "animate-pulse")} />
          {st.label}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <div className="flex flex-col">
          <span className="text-[11px] text-muted-foreground/35 tabular-nums font-mono">{fmtDate(tx.created_at)}</span>
          <span className="text-[9px] text-muted-foreground/20 tabular-nums font-mono">{fmtTime(tx.created_at)}</span>
        </div>
      </td>
      <td className="py-3.5 px-2">
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
            {tx.status === "completed" && (
              <><DropdownMenuSeparator /><DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Entre em contato com o suporte."); }} className="gap-2 text-[11px] text-destructive focus:text-destructive rounded-lg font-display"><RefreshCw className="h-3.5 w-3.5" /> Reembolsar</DropdownMenuItem></>
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.12) }}
      className="rounded-xl bg-card/60 border border-border/15 p-4 cursor-pointer active:scale-[0.985] transition-all hover:border-primary/15"
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
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-display font-bold shrink-0 border", st.fg, st.bg, st.border)}>
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
      <DialogContent className="sm:max-w-md border-border/20 bg-card rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-display font-bold"><Download className="h-4 w-4 text-primary" /> Exportar Vendas</DialogTitle>
          <DialogDescription className="text-muted-foreground/50 text-xs font-display">Configure os filtros de exportação</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider">Status</p>
              <div className="flex gap-2.5 text-[9px]">
                <button onClick={() => setSelectedStatuses(new Set())} className="text-muted-foreground/30 hover:text-foreground transition-colors font-display">Limpar</button>
                <button onClick={() => setSelectedStatuses(new Set(ALL_STATUSES.map(s => s.value)))} className="text-primary font-display font-bold">Todos</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => (
                <button key={s.value} onClick={() => toggleStatus(s.value)} className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-display font-semibold transition-all border", selectedStatuses.has(s.value) ? "border-primary/20 bg-primary/6 text-primary" : "border-border/15 text-muted-foreground/30 hover:border-border/30")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", selectedStatuses.has(s.value) ? s.dot : "bg-muted-foreground/12")} />{s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider mb-2">Método</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_METHODS.map(m => {
                const Icon = m.icon;
                return (
                  <button key={m.value} onClick={() => toggleMethod(m.value)} className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-display font-semibold transition-all border", selectedMethods.has(m.value) ? "border-primary/20 bg-primary/6 text-primary" : "border-border/15 text-muted-foreground/30 hover:border-border/30")}>
                    <Icon className="h-3 w-3" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          {txProducts.length > 0 && (
            <div>
              <p className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider mb-2">Produtos</p>
              <div className="space-y-0.5 max-h-[100px] overflow-y-auto">
                <button onClick={() => toggleProduct("all")} className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-display text-left transition-colors", selectedProducts.has("all") ? "bg-primary/6 text-primary font-semibold" : "text-muted-foreground/40 hover:bg-muted/8")}>
                  {selectedProducts.has("all") ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />} Todos
                </button>
                {txProducts.map(p => (
                  <button key={p.id} onClick={() => toggleProduct(p.id)} className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-display text-left transition-colors", selectedProducts.has(p.id) ? "bg-primary/6 text-primary font-semibold" : "text-muted-foreground/40 hover:bg-muted/8")}>
                    {selectedProducts.has(p.id) ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />} <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-xl bg-primary/4 border border-primary/10 p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-display font-bold text-foreground">{exportFiltered.length} transações</p>
              <p className="text-[9px] text-muted-foreground/30 font-display mt-0.5">serão exportadas</p>
            </div>
            <p className="text-base font-display font-bold text-primary tabular-nums">{fmt(exportFiltered.reduce((a, t) => a + Number(t.net_amount), 0))}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl h-10 text-[11px] font-display font-semibold border-border/20">Cancelar</Button>
          <Button onClick={() => { onExport(exportFiltered); onOpenChange(false); }} disabled={exportFiltered.length === 0} className="flex-1 rounded-xl h-10 gap-1.5 text-[11px] font-display font-bold">
            <Download className="h-3.5 w-3.5" /> Exportar{exportFiltered.length > 0 ? ` (${exportFiltered.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*                              MAIN PAGE                                */
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
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(PERIODS[1]);
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
    { label: "PIX", value: m.pixRev, count: m.pixCount, icon: <Smartphone className="h-3.5 w-3.5" />, total: m.totalNet, color: "success" },
    { label: "Cartão", value: m.cardRev, count: m.cardCount, icon: <CreditCard className="h-3.5 w-3.5" />, total: m.totalNet, color: "info" },
    { label: "Boleto", value: m.boletoRev, count: m.boletoCount, icon: <FileText className="h-3.5 w-3.5" />, total: m.totalNet, color: "warning" },
  ];

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
    <div className="mx-auto w-full max-w-[1360px] pb-12 px-1">
      {/* ─── HEADER ─── */}
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/8 text-primary flex items-center justify-center border border-primary/12">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-black tracking-[-0.03em] text-foreground">Minhas Vendas</h1>
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-success/15 bg-success/6 px-2 py-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-50" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                <span className="text-[8px] font-display font-bold uppercase tracking-widest text-success">Live</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/40 font-display">Analytics e gestão em tempo real</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[10px] font-display font-bold transition-all active:scale-95",
                !isCustom && selectedPeriod.label === opt.label
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/15"
                  : "bg-card/60 text-muted-foreground/40 hover:text-foreground border border-border/15 hover:border-border/30"
              )}
            >
              {opt.label}
            </button>
          ))}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className={cn(
                "h-7 rounded-lg border px-2.5 text-[10px] font-display font-bold transition-all active:scale-95",
                isCustom ? "border-primary/20 bg-primary/8 text-primary" : "border-border/15 bg-card/60 text-muted-foreground/40 hover:text-foreground"
              )}>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {isCustom && customRange?.from
                    ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
                    : "Período"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto overflow-hidden rounded-xl border border-border/20 bg-card p-0 shadow-xl">
              <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-3" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1">
            <button onClick={toggleHidden} className={cn("h-7 w-7 rounded-lg border transition-all active:scale-95", hidden ? "border-primary/20 bg-primary/8 text-primary" : "border-border/15 bg-card/60 text-muted-foreground/30 hover:text-foreground")} title={hidden ? "Mostrar" : "Ocultar"}>
              {hidden ? <EyeOff className="mx-auto h-3.5 w-3.5" /> : <Eye className="mx-auto h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setShowExportDialog(true)} className="h-7 rounded-lg border border-border/15 bg-card/60 px-2.5 text-[10px] font-display font-bold text-muted-foreground/40 transition-all hover:text-foreground active:scale-95 inline-flex items-center gap-1">
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        </div>
      </header>

      {/* ─── KPI STRIP ─── */}
      <section className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Receita Líquida", value: hidden ? "R$ •••••" : fmtCompact(m.totalNet), sub: periodLabel, cur: m.totalNet, prev: p.totalNet, spark: metrics.dailyNetArr, color: "primary", icon: <Banknote className="h-4 w-4" /> },
          { label: "Faturamento", value: hidden ? HIDE : fmt(m.totalGross), sub: "bruto", cur: m.totalGross, prev: p.totalGross, spark: metrics.dailyGrossArr, color: "info", icon: <Wallet className="h-4 w-4" /> },
          { label: "Ticket Médio", value: hidden ? HIDE : fmt(m.avgTicket), sub: `${m.approved.length} vendas`, cur: m.avgTicket, prev: p.avgTicket, spark: metrics.dailyAvgTicketArr, color: "warning", icon: <Receipt className="h-4 w-4" /> },
          { label: "Conversão", value: hidden ? HIDE : `${m.conversion.toFixed(1)}%`, sub: `${m.approved.length}/${dateFiltered.length}`, cur: m.conversion, prev: p.conversion, spark: metrics.dailyApprovalRateArr, color: "success", icon: <Target className="h-4 w-4" /> },
        ].map((kpi) => (
          <div key={kpi.label} className="group rounded-xl border border-border/12 bg-card/50 p-4 hover:border-primary/12 transition-all duration-300 relative overflow-hidden">
            <div className="flex items-start justify-between mb-2.5">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center border", `bg-${kpi.color}/8 text-${kpi.color} border-${kpi.color}/12`)}>
                {kpi.icon}
              </div>
              <Sparkline data={kpi.spark} color={kpi.color} />
            </div>
            <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/35 mb-0.5">{kpi.label}</p>
            <div className="flex items-end gap-2">
              <span className="text-[22px] font-display font-black leading-none tracking-tight text-foreground tabular-nums">{kpi.value}</span>
              {!hidden && <DeltaBadge cur={kpi.cur} prev={kpi.prev} />}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground/30 font-display">{kpi.sub}</p>
          </div>
        ))}
      </section>

      {/* ─── CHART + SIDEBAR ─── */}
      <section className="mb-5 grid grid-cols-1 gap-3 xl:grid-cols-12">
        {/* Chart */}
        <article className="rounded-xl border border-border/12 bg-card/50 p-4 xl:col-span-8">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/25 mb-0.5">Revenue Timeline</p>
              <h2 className="text-base font-display font-black tracking-tight text-foreground">Receita Diária</h2>
            </div>
            <div className="flex gap-1.5">
              {[
                { label: "Líquido", value: hidden ? HIDE : fmtCompact(m.totalNet), color: "text-primary" },
                { label: "Bruto", value: hidden ? HIDE : fmtCompact(m.totalGross), color: "text-foreground" },
                { label: "Taxas", value: hidden ? HIDE : `-${fmtCompact(m.totalFees)}`, color: "text-destructive" },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-muted/6 border border-border/8 px-2.5 py-1.5 text-center min-w-[70px]">
                  <p className="text-[8px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">{s.label}</p>
                  <p className={cn("text-[11px] font-display font-bold mt-0.5 tabular-nums", s.color)}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
          <RevenueChart data={metrics.chartData} hidden={hidden} />
        </article>

        {/* Payment Mix + Health */}
        <div className="xl:col-span-4 space-y-3">
          <article className="rounded-xl border border-border/12 bg-card/50 p-4">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Payment Mix</p>
                <p className="text-sm font-display font-bold text-foreground mt-0.5">Métodos</p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-primary/8 text-primary flex items-center justify-center border border-primary/12">
                <PieChart className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="space-y-2">
              {paymentMix.map((pm) => {
                const pct = pm.total > 0 ? (pm.value / pm.total) * 100 : 0;
                return (
                  <div key={pm.label} className="rounded-lg border border-border/8 bg-muted/4 p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(`text-${pm.color}`)}>{pm.icon}</span>
                        <span className="text-[11px] font-display font-bold text-foreground">{pm.label}</span>
                        <span className="text-[9px] text-muted-foreground/25 font-mono">{pm.count}x</span>
                      </div>
                      <span className="text-[12px] font-display font-bold tabular-nums text-foreground">{hidden ? HIDE : fmtCompact(pm.value)}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted/8">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className={cn("h-full rounded-full", `bg-${pm.color}`)}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground/20 mt-1 tabular-nums font-mono">{pct.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </article>

          {/* Health Indicators */}
          <article className="rounded-xl border border-border/12 bg-card/50 p-4">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Health</p>
                <p className="text-sm font-display font-bold text-foreground mt-0.5">Saúde</p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-success/8 text-success flex items-center justify-center border border-success/12">
                <Activity className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: "Reembolso", value: m.refundRate, threshold: 5 },
                { label: "Chargeback", value: m.chargebackRate, threshold: 1 },
                { label: "Falhas", value: m.failedRate, threshold: 10 },
              ].map(h => {
                const bad = h.value > h.threshold;
                return (
                  <div key={h.label} className="rounded-lg border border-border/8 bg-muted/4 p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-display font-semibold text-foreground/70">{h.label}</span>
                      <span className={cn("text-[11px] font-display font-bold tabular-nums", bad ? "text-destructive" : "text-success")}>{h.value.toFixed(1)}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted/8">
                      <div className={cn("h-full rounded-full transition-all", bad ? "bg-destructive" : "bg-success")} style={{ width: `${Math.min(h.value * (100 / h.threshold), 100)}%` }} />
                    </div>
                    <p className="text-[8px] text-muted-foreground/15 mt-0.5 font-mono">limite: {h.threshold}%</p>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>

      {/* ─── BOTTOM GRID: Top Products + Heatmap + Quick Stats ─── */}
      <section className="mb-5 grid grid-cols-1 gap-3 xl:grid-cols-12">
        {/* Top Products */}
        <article className="rounded-xl border border-border/12 bg-card/50 p-4 xl:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Ranking</p>
              <p className="text-sm font-display font-bold text-foreground mt-0.5">Top Produtos</p>
            </div>
            <span className="text-[10px] font-display font-bold text-muted-foreground/30 bg-muted/6 rounded-md px-2 py-0.5 tabular-nums border border-border/8">{metrics.topProducts.length}</span>
          </div>
          {metrics.topProducts.length === 0 ? (
            <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-border/10 text-center">
              <Package className="mb-2 h-5 w-5 text-muted-foreground/10" />
              <p className="text-[11px] text-muted-foreground/20 font-display">Sem produtos neste período</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {metrics.topProducts.map((prod, index) => {
                const maxRev = metrics.topProducts[0]?.revenue || 1;
                const pct = (prod.revenue / maxRev) * 100;
                return (
                  <div key={prod.id} className="rounded-lg border border-border/8 bg-muted/4 p-3 hover:border-primary/10 transition-all">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary border border-primary/10">
                          <span className="text-[9px] font-display font-bold">#{index + 1}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-display font-bold text-foreground truncate">{prod.name}</p>
                          <p className="text-[9px] text-muted-foreground/25 font-mono">{prod.sales}x</p>
                        </div>
                      </div>
                      <p className="text-[12px] font-display font-bold text-foreground shrink-0 tabular-nums">{hidden ? HIDE : fmtCompact(prod.revenue)}</p>
                    </div>
                    <div className="h-0.5 overflow-hidden rounded-full bg-muted/8">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-primary/40" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        {/* Heatmap */}
        <article className="rounded-xl border border-border/12 bg-card/50 p-4 xl:col-span-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Intraday</p>
              <p className="text-sm font-display font-bold text-foreground mt-0.5">Horários de Pico</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-muted-foreground/20 font-mono uppercase">Pico</p>
              <p className="text-sm font-display font-bold text-primary">{peakHour === null ? "—" : `${String(peakHour).padStart(2, "0")}h`}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border/8 bg-muted/4 p-3">
            <div className="flex h-[140px] items-end gap-[2px]">
              {metrics.hours.map((count, hour) => {
                const intensity = count / maxHour;
                const active = peakHour !== null && hour === peakHour;
                return (
                  <div key={hour} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(intensity * 100, 3)}%` }}
                      transition={{ duration: 0.4, delay: hour * 0.012, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        "w-full rounded-t-sm transition-colors",
                        active ? "bg-primary shadow-sm shadow-primary/20" : intensity > 0 ? "bg-primary/25 group-hover:bg-primary/40" : "bg-muted/6"
                      )}
                    />
                    <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <div className="rounded-md border border-border/15 bg-popover px-2 py-1 text-[9px] font-display font-bold text-foreground shadow-lg whitespace-nowrap">
                        {String(hour).padStart(2, "0")}h · {count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between text-[8px] text-muted-foreground/15 font-mono">
              <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
            </div>
          </div>
        </article>

        {/* Quick Stats */}
        <div className="xl:col-span-3 space-y-2">
          {[
            { label: "Clientes", value: String(m.uniqueCustomers), icon: <Users className="h-3.5 w-3.5" />, color: "primary" },
            { label: "Pendências", value: String(m.pending.length), icon: <Clock className="h-3.5 w-3.5" />, color: "warning" },
            { label: "Taxas Pagas", value: hidden ? HIDE : fmtCompact(m.totalFees), icon: <Receipt className="h-3.5 w-3.5" />, color: "destructive" },
            { label: "Última Venda", value: lastSaleText ? lastSaleText.replace("há ", "").replace(" atrás", "") : "—", icon: <Zap className="h-3.5 w-3.5" />, color: "success" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-border/12 bg-card/50 p-3.5 hover:border-primary/12 transition-all">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", `bg-${stat.color}/8 text-${stat.color} border-${stat.color}/12`)}>
                {stat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/30">{stat.label}</p>
                <p className="text-sm font-display font-bold text-foreground leading-tight truncate tabular-nums">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TRANSACTION LEDGER ─── */}
      <section className="overflow-hidden rounded-xl border border-border/12 bg-card/50">
        <div className="border-b border-border/8 px-5 pt-4 pb-3.5">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/25">Transaction Ledger</p>
              <h2 className="mt-0.5 text-base font-display font-black tracking-tight text-foreground">Transações</h2>
            </div>

            <div className="relative w-full xl:w-72">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/20" />
              <input
                id="vendas-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, e-mail ou ID…"
                className="h-9 w-full rounded-lg border border-border/12 bg-muted/5 pl-9 pr-10 text-[12px] text-foreground placeholder:text-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-display"
              />
              {search ? (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90">
                  <X className="h-3.5 w-3.5 text-muted-foreground/20 hover:text-foreground transition-colors" />
                </button>
              ) : (
                <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border/8 bg-muted/8 px-1 py-0.5 text-[8px] text-muted-foreground/15 md:inline font-mono">⌘K</kbd>
              )}
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {statusTabs.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-display font-bold transition-all active:scale-95",
                    active ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10" : "bg-muted/5 text-muted-foreground/30 hover:text-foreground border border-transparent hover:border-border/15"
                  )}
                >
                  {tab.label}
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-display font-bold tabular-nums", active ? "bg-primary-foreground/12 text-primary-foreground" : "bg-card/60 text-muted-foreground/20")}>{tab.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between bg-muted/[0.02] px-5 py-2 border-b border-border/[0.04]">
          <p className="text-[10px] text-muted-foreground/20 font-mono">
            {sortedFiltered.length === 0 ? "Nenhuma transação" : `${Math.min(visibleCount, sortedFiltered.length)} de ${sortedFiltered.length}`}
          </p>
          {!hidden && sortedFiltered.length > 0 && (
            <p className="text-[11px] font-display font-bold text-primary tabular-nums">Líquido: {fmt(filteredNetTotal)}</p>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          {loading ? (
            <div className="p-16 text-center">
              <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
              <p className="text-[11px] text-muted-foreground/20 font-display">Carregando transações…</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/6">
                      <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} className="pl-5" />
                      <th className="px-4 py-3 text-left text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/30">Produto</th>
                      <SortHead label="Valor" field="amount" sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3 text-left text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/30">Método</th>
                      <th className="px-4 py-3 text-left text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/30">Status</th>
                      <SortHead label="Data" field="date" sort={sort} onSort={handleSort} />
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16">
                          <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="Nenhuma venda encontrada" subtitle="Ajuste filtros ou período." />
                        </td>
                      </tr>
                    ) : visibleItems.map((tx, i) => (
                      <TxRow key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleCount < sortedFiltered.length && (
                <div className="border-t border-border/6 p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="gap-1.5 rounded-lg text-[10px] font-display font-bold text-muted-foreground/30 hover:text-foreground active:scale-95">
                    <ChevronDown className="h-3 w-3" /> Carregar mais ({sortedFiltered.length - visibleCount})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="space-y-2 p-3 md:hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-2 border-primary/15 border-t-primary" />
              <p className="text-[11px] text-muted-foreground/20 font-display">Carregando…</p>
            </div>
          ) : visibleItems.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="Nenhuma venda" subtitle="Ajuste filtros ou período" />
          ) : (
            <>
              {visibleItems.map((tx, i) => (
                <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
              ))}
              {visibleCount < sortedFiltered.length && (
                <Button variant="ghost" size="sm" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="w-full gap-1.5 rounded-lg text-[10px] font-display font-bold text-muted-foreground/30 hover:text-foreground active:scale-95">
                  <ChevronDown className="h-3 w-3" /> Mais {sortedFiltered.length - visibleCount}
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
      <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} productsRaw={productsRaw} onExport={handleExportCSV} />
    </div>
  );
}
