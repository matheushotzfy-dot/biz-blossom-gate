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
  ChevronRight, Star, Shield, Banknote, Globe, Crown,
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

function SortHead({ label, field, sort, onSort, className }: { label: string; field: SortField; sort: { field: SortField; dir: SortDir }; onSort: (f: SortField) => void; className?: string }) {
  const active = sort.field === field;
  return (
    <th onClick={() => onSort(field)} className={cn("text-left py-3.5 px-4 text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider cursor-pointer select-none hover:text-foreground/60 transition-colors group", className)}>
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
      <div className="h-[220px] flex flex-col items-center justify-center gap-2">
        {hidden ? <EyeOff className="h-6 w-6 text-muted-foreground/8" /> : <BarChart3 className="h-6 w-6 text-muted-foreground/8" />}
        <span className="text-[11px] text-muted-foreground/15 font-display">{hidden ? "Valores ocultos" : "Dados insuficientes"}</span>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="rv-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.06} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
        <ReTooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 14, fontSize: 11, padding: "12px 16px", boxShadow: "0 12px 40px rgba(0,0,0,0.15)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
          labelStyle={{ fontSize: 9, color: "hsl(var(--muted-foreground))", marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}
          cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 3" fill="none" opacity={0.12} dot={false} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#rv-gradient)" dot={false} activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
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
      className="group cursor-pointer border-b border-border/[0.04] hover:bg-primary/[0.02] transition-colors duration-150"
    >
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={cn("text-[10px] font-display font-bold", avatarColor(name))}>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[12px] font-display font-semibold text-foreground truncate leading-tight">{name}</p>
            {tx.customer_email && <p className="text-[10px] text-muted-foreground/30 truncate mt-0.5 font-mono">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <span className="text-[11px] text-muted-foreground/40 truncate block max-w-[140px] font-display">{tx.product_id ? (prods[tx.product_id] || "—") : "—"}</span>
      </td>
      <td className="py-4 px-4">
        <div>
          <span className="text-[13px] font-display font-bold text-foreground tabular-nums tracking-tight">{fmt(Number(tx.amount))}</span>
          <p className="text-[9px] text-muted-foreground/20 tabular-nums mt-0.5 font-mono">líq. {fmt(Number(tx.net_amount))}</p>
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
          <span className="text-[11px] text-muted-foreground/35 tabular-nums font-mono">{fmtDate(tx.created_at)}</span>
          <span className="text-[9px] text-muted-foreground/20 tabular-nums font-mono">{fmtTime(tx.created_at)}</span>
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
      className="rounded-2xl bg-card/60 border border-border/10 p-4 cursor-pointer active:scale-[0.985] transition-all hover:border-primary/15"
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
      <DialogContent className="sm:max-w-md border-border/15 bg-card rounded-2xl">
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
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(PERIODS[2]);
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

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="mx-auto w-full max-w-[1400px] pb-16 px-1">

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HERO — REVENUE COMMAND CENTER (DOMINANT)                   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="mb-8 relative">
        {/* Top controls bar — minimal, floating */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-display font-bold uppercase tracking-[0.25em] text-muted-foreground/30">Revenue Command Center</span>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-success/12 bg-success/5 px-2 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              <span className="text-[7px] font-display font-bold uppercase tracking-[0.15em] text-success">Live</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {PERIODS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-display font-bold transition-all active:scale-[0.97]",
                  !isCustom && selectedPeriod.label === opt.label
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground/30 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button className={cn(
                  "h-6 rounded-full border px-2.5 text-[10px] font-display font-bold transition-all active:scale-[0.97]",
                  isCustom ? "border-primary/20 bg-primary/8 text-primary" : "border-transparent text-muted-foreground/30 hover:text-foreground"
                )}>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {isCustom && customRange?.from
                      ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
                      : "Custom"}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto overflow-hidden rounded-xl border border-border/15 bg-card p-0 shadow-xl">
                <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-3 pointer-events-auto" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
              </PopoverContent>
            </Popover>
            <span className="w-px h-4 bg-border/8 mx-1 hidden sm:block" />
            <button onClick={toggleHidden} className={cn("h-6 w-6 rounded-full transition-all active:scale-[0.97]", hidden ? "text-primary" : "text-muted-foreground/20 hover:text-foreground")} title={hidden ? "Mostrar" : "Ocultar"}>
              {hidden ? <EyeOff className="mx-auto h-3.5 w-3.5" /> : <Eye className="mx-auto h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setShowExportDialog(true)} className="h-6 rounded-full px-2.5 text-[10px] font-display font-bold text-muted-foreground/20 transition-all hover:text-foreground active:scale-[0.97] inline-flex items-center gap-1">
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        </div>

        {/* MAIN FOCAL POINT — Net Revenue */}
        <div className="mb-6">
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-muted-foreground/25 mb-2">Receita Líquida do Período</p>
          <div className="flex items-end gap-4 mb-1">
            <span className="text-5xl sm:text-6xl lg:text-7xl font-display font-black tracking-[-0.05em] text-foreground tabular-nums leading-[0.85]">
              {hidden ? "R$ •••••••" : fmt(m.totalNet)}
            </span>
            {!hidden && <DeltaBadge cur={m.totalNet} prev={p.totalNet} />}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[11px] text-muted-foreground/25 font-display">{periodLabel}</span>
            <span className="w-px h-3 bg-border/10" />
            <span className="text-[11px] text-muted-foreground/25 font-display">{m.approved.length} aprovadas</span>
            <span className="w-px h-3 bg-border/10" />
            <span className="text-[11px] text-muted-foreground/25 font-display">bruto {hidden ? HIDE : fmtCompact(m.totalGross)}</span>
            {lastSaleText && (
              <>
                <span className="w-px h-3 bg-border/10" />
                <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/30 font-display">
                  <span className="relative flex h-1 w-1"><span className="absolute h-full w-full animate-ping rounded-full bg-primary opacity-40" /><span className="relative h-1 w-1 rounded-full bg-primary" /></span>
                  última {lastSaleText}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Executive Strip — integrated, not boxed */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 py-5 border-t border-border/6">
          <div>
            <p className="text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/20 mb-1">Aprovação</p>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-2xl font-display font-black tabular-nums tracking-tight", m.conversion >= 80 ? "text-success" : m.conversion >= 50 ? "text-warning" : "text-destructive")}>
                {hidden ? HIDE : `${m.conversion.toFixed(1)}%`}
              </span>
              <span className="text-[10px] text-muted-foreground/20 font-mono">{m.approved.length}/{dateFiltered.length}</span>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/20 mb-1">Ticket Médio</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-display font-black tabular-nums tracking-tight text-foreground">{hidden ? HIDE : fmt(m.avgTicket)}</span>
              {!hidden && <DeltaBadge cur={m.avgTicket} prev={p.avgTicket} />}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/20 mb-1">Método Líder</p>
            <div className="flex items-center gap-2">
              <span className={cn("text-2xl font-display font-black tracking-tight text-foreground")}>{dominantMethod.label}</span>
              <span className="text-[10px] text-muted-foreground/20 font-mono">{hidden ? HIDE : fmtCompact(dominantMethod.value)}</span>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/20 mb-1">Pico de Vendas</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-display font-black tabular-nums tracking-tight text-foreground">{peakHour !== null ? `${String(peakHour).padStart(2, "0")}h` : "—"}</span>
              {peakHour !== null && <span className="text-[10px] text-muted-foreground/20 font-mono">{rawPeakSales} vendas</span>}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* REVENUE TIMELINE — Large, prominent                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
          <h2 className="text-sm font-display font-bold text-foreground/60 uppercase tracking-[0.1em]">Revenue Timeline</h2>
          <div className="flex gap-4 text-[11px] font-display tabular-nums">
            <span className="text-primary font-bold">Líquido {hidden ? HIDE : fmtCompact(m.totalNet)}</span>
            <span className="text-muted-foreground/30">Bruto {hidden ? HIDE : fmtCompact(m.totalGross)}</span>
            <span className="text-destructive/60">Taxas {hidden ? HIDE : `-${fmtCompact(m.totalFees)}`}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border/6 bg-card/30 p-5">
          <RevenueChart data={metrics.chartData} hidden={hidden} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECONDARY ROW — Payment Mix + Health + Heatmap (merged)    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Payment Intelligence — clean list, no heavy cards */}
        <div className="xl:col-span-4">
          <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/20 mb-4">Payment Intelligence</h3>
          <div className="space-y-4">
            {paymentMix.map((pm) => {
              const pct = pm.total > 0 ? (pm.value / pm.total) * 100 : 0;
              const isDominant = pm.label === dominantMethod.label && pm.value > 0;
              return (
                <div key={pm.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(`text-${pm.color}`)}>{pm.icon}</span>
                      <span className="text-[12px] font-display font-bold text-foreground">{pm.label}</span>
                      {isDominant && <Crown className="h-3 w-3 text-warning/60" />}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[14px] font-display font-black tabular-nums text-foreground">{hidden ? HIDE : fmtCompact(pm.value)}</span>
                      <span className="text-[9px] text-muted-foreground/20 font-mono">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted/6">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className={cn("h-full rounded-full", `bg-${pm.color}`)}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-muted-foreground/15 font-mono tabular-nums">{pm.count} transações</span>
                    {!hidden && pm.count > 0 && <span className="text-[9px] text-muted-foreground/15 font-mono">avg {fmt(pm.value / pm.count)}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Health inline — compact, below payment mix */}
          <div className="mt-6 pt-5 border-t border-border/5">
            <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/20 mb-3">Saúde Operacional</h3>
            <div className="space-y-2.5">
              {[
                { label: "Reembolso", value: m.refundRate, threshold: 5 },
                { label: "Chargeback", value: m.chargebackRate, threshold: 1 },
                { label: "Falhas", value: m.failedRate, threshold: 10 },
              ].map(h => {
                const bad = h.value > h.threshold;
                const warn = h.value > h.threshold * 0.7;
                const statusColor = bad ? "destructive" : warn ? "warning" : "success";
                return (
                  <div key={h.label} className="flex items-center gap-3">
                    <span className="text-[11px] font-display font-semibold text-foreground/50 w-20">{h.label}</span>
                    <div className="flex-1 h-1 overflow-hidden rounded-full bg-muted/6">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(h.value * (100 / h.threshold), 100)}%` }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className={cn("h-full rounded-full", `bg-${statusColor}`)}
                      />
                    </div>
                    <span className={cn("text-[11px] font-display font-bold tabular-nums w-12 text-right", `text-${statusColor}`)}>{h.value.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="xl:col-span-4">
          <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/20 mb-4">Top Produtos</h3>
          {metrics.topProducts.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
              <Package className="h-6 w-6 text-muted-foreground/8 mb-2" />
              <p className="text-[11px] text-muted-foreground/15 font-display">Sem produtos neste período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.topProducts.map((prod, index) => {
                const maxRev = metrics.topProducts[0]?.revenue || 1;
                const pct = (prod.revenue / maxRev) * 100;
                return (
                  <div key={prod.id}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-display font-bold text-muted-foreground/20 w-4 shrink-0">{index + 1}</span>
                        <p className="text-[12px] font-display font-semibold text-foreground truncate">{prod.name}</p>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="text-[13px] font-display font-bold text-foreground tabular-nums">{hidden ? HIDE : fmtCompact(prod.revenue)}</span>
                        <span className="text-[9px] text-muted-foreground/15 font-mono">{prod.sales}x</span>
                      </div>
                    </div>
                    <div className="h-0.5 overflow-hidden rounded-full bg-muted/5 ml-6">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-primary/40" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Peak Hours — Heatmap */}
        <div className="xl:col-span-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.15em] text-muted-foreground/20">Atividade Intraday</h3>
            <span className="text-sm font-display font-black text-primary tabular-nums">{peakHour !== null ? `${String(peakHour).padStart(2, "0")}h` : "—"}</span>
          </div>
          <div className="flex h-[180px] items-end gap-[2px]">
            {metrics.hours.map((count, hour) => {
              const intensity = count / maxHour;
              const active = peakHour !== null && hour === peakHour;
              return (
                <div key={hour} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(intensity * 100, 1.5)}%` }}
                    transition={{ duration: 0.4, delay: hour * 0.015, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "w-full rounded-t-sm transition-colors",
                      active ? "bg-primary" : intensity > 0.5 ? "bg-primary/30" : intensity > 0 ? "bg-primary/12 group-hover:bg-primary/25" : "bg-muted/4"
                    )}
                  />
                  <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <div className="rounded-md bg-popover border border-border/10 px-2 py-0.5 text-[9px] font-display font-bold text-foreground shadow-lg whitespace-nowrap">
                      {String(hour).padStart(2, "0")}h · {count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[8px] text-muted-foreground/12 font-mono">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>

          {/* Quick stats inline */}
          <div className="mt-5 pt-4 border-t border-border/5 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/15">Clientes</p>
              <p className="text-lg font-display font-black text-foreground tabular-nums">{hidden ? HIDE : m.uniqueCustomers}</p>
            </div>
            <div>
              <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/15">Pendentes</p>
              <p className={cn("text-lg font-display font-black tabular-nums", m.pending.length > 0 ? "text-warning" : "text-foreground")}>{m.pending.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TRANSACTIONS TABLE                                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between mb-4">
          <h2 className="text-sm font-display font-bold text-foreground/60 uppercase tracking-[0.1em]">Transações</h2>
          <div className="relative w-full xl:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/12" />
            <input
              id="vendas-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, e-mail ou ID…"
              className="h-9 w-full rounded-xl border border-border/6 bg-card/30 pl-9 pr-10 text-[12px] text-foreground placeholder:text-muted-foreground/12 focus:outline-none focus:ring-1 focus:ring-primary/15 transition-all font-display"
            />
            {search ? (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90">
                <X className="h-3.5 w-3.5 text-muted-foreground/20 hover:text-foreground transition-colors" />
              </button>
            ) : (
              <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border/5 bg-muted/5 px-1 py-0.5 text-[8px] text-muted-foreground/10 md:inline font-mono">⌘K</kbd>
            )}
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto mb-3">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-display font-bold transition-all active:scale-[0.97]",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground/20 hover:text-foreground"
                )}
              >
                {tab.label}
                <span className={cn("text-[9px] tabular-nums", active ? "text-primary-foreground/60" : "text-muted-foreground/12")}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/6 bg-card/30">
          <div className="flex items-center justify-between px-6 py-2 border-b border-border/4">
            <p className="text-[10px] text-muted-foreground/12 font-mono">
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
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary/8 border-t-primary" />
                <p className="text-[11px] text-muted-foreground/12 font-display">Carregando transações…</p>
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
                          <td colSpan={7} className="py-20">
                            <div className="flex flex-col items-center justify-center">
                              <ShoppingCart className="h-6 w-6 text-muted-foreground/6 mb-2" />
                              <p className="text-[12px] font-display font-semibold text-muted-foreground/15">Nenhuma venda encontrada</p>
                              <p className="text-[10px] text-muted-foreground/10 font-display mt-0.5">Ajuste filtros ou período</p>
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
                <div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-2 border-primary/8 border-t-primary" />
                <p className="text-[11px] text-muted-foreground/12 font-display">Carregando…</p>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <ShoppingCart className="h-5 w-5 text-muted-foreground/6 mb-2" />
                <p className="text-[11px] font-display font-semibold text-muted-foreground/15">Nenhuma venda</p>
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
      </section>

      {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
      <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} productsRaw={productsRaw} onExport={handleExportCSV} />
    </div>
  );
}
