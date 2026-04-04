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
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
] as const;
type Period = (typeof PERIODS)[number];
const PAGE_SIZE = 50;

const AVATAR_PALETTE = [
  "bg-primary/15 text-primary",
  "bg-info/15 text-info",
  "bg-warning/15 text-warning",
  "bg-success/15 text-success",
  "bg-accent text-accent-foreground",
];
const avatarColor = (n: string) => {
  let h = 0; for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
};
const initials = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0]?.[0] || "?").toUpperCase();
};

const STATUS: Record<string, { label: string; fg: string; dot: string; bg: string }> = {
  completed: { label: "Aprovada", fg: "text-success", dot: "bg-success", bg: "bg-success/10" },
  pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/10" },
  failed: { label: "Falha", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/10" },
  refunded: { label: "Reembolso", fg: "text-info", dot: "bg-info", bg: "bg-info/10" },
  chargeback: { label: "Chargeback", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/10" },
};

/* ─────────────────────── Micro Components ─────────────────────── */

function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return <span className="text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">novo</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full", up ? "text-success bg-success/10" : "text-destructive bg-destructive/10")}>
      {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* Mini sparkline for KPI cards */
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className={cn("shrink-0", className)} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

function SortHead({ label, field, sort, onSort, className }: { label: string; field: SortField; sort: { field: SortField; dir: SortDir }; onSort: (f: SortField) => void; className?: string }) {
  const active = sort.field === field;
  return (
    <th onClick={() => onSort(field)} className={cn("text-left py-3.5 px-4 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.08em] cursor-pointer select-none hover:text-foreground transition-colors group", className)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (sort.dir === "desc" ? <ChevronDown className="h-3 w-3 text-primary" /> : <ChevronUp className="h-3 w-3 text-primary" />)
          : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
      </span>
    </th>
  );
}

/* ─── Revenue Chart ─── */
function RevenueChart({ data, hidden }: { data: { label: string; value: number; previous: number }[]; hidden: boolean }) {
  if (data.length < 2 || hidden) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center gap-2">
        {hidden ? <EyeOff className="h-5 w-5 text-muted-foreground/15" /> : <BarChart3 className="h-5 w-5 text-muted-foreground/15" />}
        <span className="text-[12px] text-muted-foreground/25">{hidden ? "Valores ocultos" : "Dados insuficientes"}</span>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="rv-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.12} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "'JetBrains Mono', monospace" }}
          axisLine={false} tickLine={false} interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "'JetBrains Mono', monospace" }}
          axisLine={false} tickLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
        />
        <ReTooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12, fontSize: 12, padding: "10px 14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
          formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
          labelStyle={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}
          cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="6 4" fill="none" opacity={0.15} dot={false} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#rv-gradient)" dot={false} activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ─── Desktop Row ─── */
function TxRow({ tx, prods, onClick, i }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; i: number }) {
  const methods: Record<string, { label: string; icon: React.ReactNode }> = {
    pix: { label: "PIX", icon: <Smartphone className="h-3.5 w-3.5" /> },
    credit_card: { label: "Cartão", icon: <CreditCard className="h-3.5 w-3.5" /> },
    boleto: { label: "Boleto", icon: <FileText className="h-3.5 w-3.5" /> },
  };
  const method = methods[tx.payment_method || ""] || { label: tx.payment_method || "—", icon: null };
  const name = tx.customer_name || "Cliente";
  const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted/10" };

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, delay: Math.min(i * 0.01, 0.2) }}
      onClick={onClick}
      className="group cursor-pointer border-b border-border/[0.05] hover:bg-primary/[0.02] transition-colors duration-150"
    >
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className={cn("text-[10px] font-bold tracking-tight", avatarColor(name))}>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate leading-tight">{name}</p>
            {tx.customer_email && <p className="text-[11px] text-muted-foreground/35 truncate mt-0.5">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <span className="text-[12px] text-muted-foreground/50 truncate block max-w-[150px]">{tx.product_id ? (prods[tx.product_id] || "—") : "—"}</span>
      </td>
      <td className="py-3.5 px-4">
        <div>
          <span className="text-[14px] font-semibold text-foreground tabular-nums tracking-tight font-display">{fmt(Number(tx.amount))}</span>
          <p className="text-[10px] text-muted-foreground/25 tabular-nums mt-0.5 font-mono">líq. {fmt(Number(tx.net_amount))}</p>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/45 font-medium">
          {method.icon}{method.label}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide", st.fg, st.bg)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", st.dot, tx.status === "completed" && "animate-pulse")} />
          {st.label}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <div className="flex flex-col">
          <span className="text-[12px] text-muted-foreground/45 tabular-nums font-mono">{fmtDate(tx.created_at)}</span>
          <span className="text-[10px] text-muted-foreground/20 tabular-nums font-mono">{fmtTime(tx.created_at)}</span>
        </div>
      </td>
      <td className="py-3.5 px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/20">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[12px]"><Eye className="h-3.5 w-3.5" /> Ver detalhes</DropdownMenuItem>
            {tx.customer_phone && (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_phone!); toast.success("Copiado!"); }} className="gap-2 text-[12px]"><Copy className="h-3.5 w-3.5" /> Copiar telefone</DropdownMenuItem>
                <DropdownMenuItem asChild><a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="gap-2 text-[12px]"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a></DropdownMenuItem>
              </>
            )}
            {tx.status === "completed" && (
              <><DropdownMenuSeparator /><DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Entre em contato com o suporte."); }} className="gap-2 text-[12px] text-destructive focus:text-destructive"><RefreshCw className="h-3.5 w-3.5" /> Reembolsar</DropdownMenuItem></>
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
  const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground", bg: "bg-muted/10" };
  const methodLabels: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.15) }}
      className="rounded-2xl bg-card border border-border/30 p-4 cursor-pointer active:scale-[0.985] transition-all"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={cn("text-[10px] font-bold", avatarColor(name))}>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{name}</p>
            <p className="text-[11px] text-muted-foreground/35 truncate mt-0.5">{tx.customer_email || methodLabels[tx.payment_method || ""] || ""}</p>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold shrink-0 tracking-wide", st.fg, st.bg)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />{st.label}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[22px] font-bold text-foreground tabular-nums tracking-tight leading-none font-display">{fmt(Number(tx.amount))}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground/30 font-medium">{methodLabels[tx.payment_method || ""] || "—"}</span>
            <span className="text-[10px] text-muted-foreground/15">·</span>
            <span className="text-[10px] text-muted-foreground/30 truncate max-w-[100px]">{tx.product_id ? prods[tx.product_id] || "" : "—"}</span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <span className="text-[11px] text-muted-foreground/35 tabular-nums font-mono">{fmtDate(tx.created_at)}</span>
          {tx.customer_phone && (
            <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="h-7 w-7 rounded-full bg-success/10 flex items-center justify-center text-success hover:bg-success/20 transition-colors">
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
      <DialogContent className="sm:max-w-md border-border/30 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-lg font-display"><Download className="h-5 w-5 text-primary" /> Exportar Vendas</DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">Configure os filtros de exportação</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-3">
          {/* Status */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.1em]">Status</p>
              <div className="flex gap-3 text-[10px]">
                <button onClick={() => setSelectedStatuses(new Set())} className="text-muted-foreground/40 hover:text-foreground transition-colors">Limpar</button>
                <button onClick={() => setSelectedStatuses(new Set(ALL_STATUSES.map(s => s.value)))} className="text-primary font-medium">Todos</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => (
                <button key={s.value} onClick={() => toggleStatus(s.value)} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border", selectedStatuses.has(s.value) ? "border-primary/25 bg-primary/8 text-primary" : "border-border/20 text-muted-foreground/40 hover:border-border/40")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", selectedStatuses.has(s.value) ? s.dot : "bg-muted-foreground/15")} />{s.label}
                </button>
              ))}
            </div>
          </div>
          {/* Method */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.1em] mb-2.5">Método</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_METHODS.map(m => {
                const Icon = m.icon;
                return (
                  <button key={m.value} onClick={() => toggleMethod(m.value)} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border", selectedMethods.has(m.value) ? "border-primary/25 bg-primary/8 text-primary" : "border-border/20 text-muted-foreground/40 hover:border-border/40")}>
                    <Icon className="h-3 w-3" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Products */}
          {txProducts.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.1em] mb-2.5">Produtos</p>
              <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                <button onClick={() => toggleProduct("all")} className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium text-left transition-colors", selectedProducts.has("all") ? "bg-primary/8 text-primary" : "text-muted-foreground/50 hover:bg-muted/10")}>
                  {selectedProducts.has("all") ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />} Todos
                </button>
                {txProducts.map(p => (
                  <button key={p.id} onClick={() => toggleProduct(p.id)} className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium text-left transition-colors", selectedProducts.has(p.id) ? "bg-primary/8 text-primary" : "text-muted-foreground/50 hover:bg-muted/10")}>
                    {selectedProducts.has(p.id) ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />} <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Summary */}
          <div className="rounded-2xl bg-muted/8 border border-border/15 p-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-foreground">{exportFiltered.length} transações</p>
              <p className="text-[10px] text-muted-foreground/35 mt-0.5">serão exportadas</p>
            </div>
            <p className="text-[16px] font-bold text-primary tabular-nums font-display">{fmt(exportFiltered.reduce((a, t) => a + Number(t.net_amount), 0))}</p>
          </div>
        </div>
        <div className="flex gap-2.5 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl h-11 text-[12px] font-medium">Cancelar</Button>
          <Button onClick={() => { onExport(exportFiltered); onOpenChange(false); }} disabled={exportFiltered.length === 0} className="flex-1 rounded-xl h-11 gap-2 text-[12px] font-semibold">
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
      return { dateFiltered: transactions.filter(t => toBrasiliaDate(t.created_at) === yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })), previousPeriodFiltered: transactions.filter(t => toBrasiliaDate(t.created_at) === dayBefore.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })) };
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

    // Top products
    const pMap: Record<string, { revenue: number; sales: number; name: string }> = {};
    for (const t of current.approved) {
      if (t.product_id) {
        if (!pMap[t.product_id]) pMap[t.product_id] = { revenue: 0, sales: 0, name: products[t.product_id] || t.product_id.slice(0, 8) };
        pMap[t.product_id].revenue += Number(t.net_amount);
        pMap[t.product_id].sales += 1;
      }
    }
    const topProducts = Object.entries(pMap).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Chart data
    const dailyMap: Record<string, number> = {};
    const prevDailyMap: Record<string, number> = {};
    for (const t of current.approved) { const day = fmtDate(t.created_at); dailyMap[day] = (dailyMap[day] || 0) + Number(t.net_amount); }
    for (const t of previous.approved) { const day = fmtDate(t.created_at); prevDailyMap[day] = (prevDailyMap[day] || 0) + Number(t.net_amount); }
    const currentDays = Object.entries(dailyMap).map(([label, value]) => ({ label, value })).reverse();
    const prevDays = Object.values(prevDailyMap);
    const chartData = currentDays.map((d, i) => ({ ...d, previous: prevDays[i] || 0 }));

    // Daily sparkline for KPI
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

    // Hourly
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
    { label: "PIX", value: m.pixRev, count: m.pixCount, icon: <Smartphone className="h-4 w-4" />, total: m.totalNet },
    { label: "Cartão", value: m.cardRev, count: m.cardCount, icon: <CreditCard className="h-4 w-4" />, total: m.totalNet },
    { label: "Boleto", value: m.boletoRev, count: m.boletoCount, icon: <FileText className="h-4 w-4" />, total: m.totalNet },
  ];

  const topPaymentMethod = paymentMix.reduce((best, item) => item.value > best.value ? item : best, paymentMix[0]);
  const filteredNetTotal = sortedFiltered.reduce((acc, tx) => acc + Number(tx.net_amount), 0);
  const periodLabel = isCustom
    ? customRange?.from
      ? customRange?.to
        ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}`
        : format(customRange.from, "dd/MM/yyyy")
      : "Personalizado"
    : selectedPeriod.label;

  const commandPills = [
    {
      label: "Clientes únicos",
      value: String(m.uniqueCustomers),
      helper: "no período",
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Pendências",
      value: String(m.pending.length),
      helper: "aguardando ação",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Taxas",
      value: hidden ? HIDE : fmt(m.totalFees),
      helper: "custo total",
      icon: <Receipt className="h-4 w-4" />,
    },
    {
      label: "Pico",
      value: peakHour === null ? "—" : `${String(peakHour).padStart(2, "0")}h`,
      helper: rawPeakSales > 0 ? `${rawPeakSales} vendas` : "sem vendas",
      icon: <Flame className="h-4 w-4" />,
    },
  ];

  const kpis = [
    {
      label: "Faturamento bruto",
      value: hidden ? HIDE : fmt(m.totalGross),
      helper: "antes das taxas",
      signal: "curva de receita",
      deltaCur: m.totalGross,
      deltaPrev: p.totalGross,
      sparkline: metrics.dailyGrossArr,
      icon: <Wallet className="h-4 w-4" />,
      tone: "primary" as const,
      className: "xl:col-span-5",
    },
    {
      label: "Ticket médio",
      value: hidden ? HIDE : fmt(m.avgTicket),
      helper: "valor por pedido",
      signal: "qualidade do ticket",
      deltaCur: m.avgTicket,
      deltaPrev: p.avgTicket,
      sparkline: metrics.dailyAvgTicketArr,
      icon: <Receipt className="h-4 w-4" />,
      tone: "info" as const,
      className: "xl:col-span-2",
    },
    {
      label: "Conversão",
      value: hidden ? HIDE : `${m.conversion.toFixed(1)}%`,
      helper: "aprovadas / total",
      signal: "eficiência diária",
      deltaCur: m.conversion,
      deltaPrev: p.conversion,
      sparkline: metrics.dailyApprovalRateArr,
      icon: <Target className="h-4 w-4" />,
      tone: "warning" as const,
      className: "xl:col-span-2",
    },
    {
      label: "Vendas aprovadas",
      value: hidden ? HIDE : String(m.approved.length),
      helper: `${topPaymentMethod.label} lidera`,
      signal: `${topPaymentMethod.count} pedidos dominantes`,
      deltaCur: m.approved.length,
      deltaPrev: p.approved.length,
      sparkline: metrics.dailyCountArr,
      icon: <CheckSquare className="h-4 w-4" />,
      tone: "success" as const,
      className: "xl:col-span-3",
    },
  ];

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="mx-auto w-full max-w-[1280px] pb-12">
      <section className="relative mb-6 overflow-hidden rounded-[32px] border border-border/30 bg-card/80">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(circle at 0% 0%, hsl(var(--primary) / 0.18), transparent 34%), radial-gradient(circle at 100% 0%, hsl(var(--info) / 0.12), transparent 26%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--card)))",
          }}
        />
        <div className="absolute inset-y-0 left-[64%] hidden w-px bg-border/12 xl:block" />

        <div className="relative grid gap-6 p-6 md:p-8 xl:grid-cols-[1.35fr_0.95fr] xl:gap-8">
          <div>
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm shadow-primary/10">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/45" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Revenue command room
                </p>
                <h1 className="mt-1 text-[28px] font-bold tracking-[-0.04em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Minhas Vendas
                </h1>
                <p className="mt-1 text-[12px] text-muted-foreground/42">Leitura premium de performance, mix e qualidade operacional.</p>
              </div>
              <div className="hidden shrink-0 rounded-full border border-success/20 bg-success/10 px-3 py-1.5 md:inline-flex md:items-center md:gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-45" />
                  <span className="relative h-2 w-2 rounded-full bg-success" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-success">Live</span>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
              <div className="rounded-[28px] border border-border/22 bg-background/20 p-5 backdrop-blur-sm md:p-6">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-muted-foreground/42">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  Receita líquida do período
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <span
                    className="text-[44px] font-bold leading-none tracking-[-0.06em] text-foreground md:text-[64px]"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", fontFeatureSettings: "'tnum'" }}
                  >
                    {hidden ? "R$ •••••" : fmtCompact(m.totalNet)}
                  </span>
                  {!hidden && <div className="pb-2"><DeltaBadge cur={m.totalNet} prev={p.totalNet} /></div>}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground/42">
                  <span className="rounded-full bg-muted/8 px-3 py-1">Período: {periodLabel}</span>
                  {lastSaleText && <span className="rounded-full bg-success/8 px-3 py-1 text-success">Última venda {lastSaleText}</span>}
                </div>
              </div>

              <div className="rounded-[28px] border border-border/18 bg-background/14 p-4 backdrop-blur-sm md:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/38" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      Pulse board
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-foreground">Resumo executivo</p>
                  </div>
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      label: "Aprovadas",
                      value: hidden ? HIDE : String(m.approved.length),
                      helper: `${dateFiltered.length > 0 ? ((m.approved.length / dateFiltered.length) * 100).toFixed(0) : 0}% do fluxo`,
                      accent: "bg-success",
                      text: "text-success",
                    },
                    {
                      label: "Método líder",
                      value: topPaymentMethod.label,
                      helper: hidden ? HIDE : fmt(topPaymentMethod.value),
                      accent: "bg-primary",
                      text: "text-primary",
                    },
                    {
                      label: "Peak hour",
                      value: peakHour === null ? "—" : `${String(peakHour).padStart(2, "0")}h`,
                      helper: rawPeakSales > 0 ? `${rawPeakSales} vendas` : "sem movimento",
                      accent: "bg-warning",
                      text: "text-warning",
                    },
                  ].map((item) => (
                    <div key={item.label} className="grid grid-cols-[3px_1fr_auto] items-center gap-3 rounded-2xl border border-border/12 bg-card/55 px-3 py-3.5">
                      <div className={cn("h-full rounded-full", item.accent)} />
                      <div>
                        <p className="text-[11px] text-muted-foreground/38">{item.label}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground/55">{item.helper}</p>
                      </div>
                      <p className={cn("text-[18px] font-bold tracking-[-0.03em]", item.text)} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {commandPills.map((pill, index) => (
                <motion.div key={pill.label} whileHover={{ y: -3 }} transition={{ duration: 0.2, delay: index * 0.02 }} className="rounded-2xl border border-border/14 bg-background/14 px-4 py-3 backdrop-blur-sm hover:border-primary/24 hover:bg-background/22">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/42">{pill.label}</span>
                    <span className="text-muted-foreground/28">{pill.icon}</span>
                  </div>
                  <p className="text-[20px] font-bold leading-none tracking-[-0.03em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {pill.value}
                  </p>
                  <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/28" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {pill.helper}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-border/18 bg-background/14 p-5 backdrop-blur-sm md:p-6">
            <div className="mb-5 flex flex-wrap gap-2">
              {PERIODS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-[11px] font-semibold transition-all",
                    !isCustom && selectedPeriod.label === opt.label
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/15"
                      : "bg-muted/10 text-muted-foreground/42 hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "h-11 rounded-2xl border px-4 text-left text-[11px] font-medium transition-all",
                    isCustom ? "border-primary/28 bg-primary/8 text-primary" : "border-border/14 bg-card/55 text-muted-foreground/48 hover:text-foreground"
                  )}>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {isCustom && customRange?.from
                        ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
                        : "Selecionar período"}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto overflow-hidden rounded-2xl border border-border/25 bg-card p-0 shadow-lg">
                  <div className="p-3">
                    <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-2" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
                  </div>
                </PopoverContent>
              </Popover>

              <button onClick={toggleHidden} className={cn("h-11 w-11 rounded-2xl border transition-all", hidden ? "border-primary/28 bg-primary/8 text-primary" : "border-border/14 bg-card/55 text-muted-foreground/44 hover:text-foreground")} title={hidden ? "Mostrar" : "Ocultar"}>
                {hidden ? <EyeOff className="mx-auto h-4 w-4" /> : <Eye className="mx-auto h-4 w-4" />}
              </button>

              <button onClick={() => setShowExportDialog(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border/14 bg-card/55 px-4 text-[11px] font-medium text-muted-foreground/48 transition-all hover:text-foreground">
                <Download className="h-3.5 w-3.5" /> Exportar
              </button>
            </div>

            <div className="rounded-[28px] border border-border/14 bg-card/55 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/34" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Status rail
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-foreground">Qualidade do fluxo</p>
                </div>
                <div className="rounded-full bg-muted/10 px-3 py-1 text-[10px] text-muted-foreground/42">{statusFilter === "all" ? "Todas" : STATUS[statusFilter]?.label || statusFilter}</div>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Aprovadas", value: m.approved.length, text: "text-success", bg: "bg-success/10", border: "border-success/15" },
                  { label: "Pendentes", value: m.pending.length, text: "text-warning", bg: "bg-warning/10", border: "border-warning/15" },
                  { label: "Falhas + risco", value: m.failed.length + m.chargebacks.length, text: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/15" },
                ].map((item) => (
                  <div key={item.label} className={cn("flex items-center justify-between rounded-2xl border px-4 py-3", item.bg, item.border)}>
                    <div>
                      <p className="text-[11px] text-muted-foreground/44">{item.label}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/28" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        monitoramento
                      </p>
                    </div>
                    <span className={cn("text-[22px] font-bold tracking-[-0.04em]", item.text)} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {hidden ? HIDE : item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {kpis.map((kpi) => {
          const toneClass = {
            primary: "bg-primary/10 text-primary border-primary/18",
            info: "bg-info/10 text-info border-info/18",
            warning: "bg-warning/10 text-warning border-warning/18",
            success: "bg-success/10 text-success border-success/18",
          }[kpi.tone];

          return (
            <motion.article
              key={kpi.label}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.18 }}
              className={cn("group relative overflow-hidden rounded-[28px] border border-border/24 bg-card/80 p-5 transition-all hover:border-primary/24 hover:shadow-[0_16px_46px_hsl(var(--primary)/0.08)]", kpi.className)}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.07] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/34" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {kpi.label}
                  </p>
                  <p className="mt-2 text-[28px] font-bold leading-none tracking-[-0.04em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {kpi.value}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {kpi.sparkline?.length > 1 && <Sparkline data={kpi.sparkline} className="opacity-80 transition-opacity duration-300 group-hover:opacity-100" />}
                  <div className={cn("rounded-2xl border p-2.5", toneClass)}>{kpi.icon}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-muted-foreground/42">{kpi.helper}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/26" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{kpi.signal}</p>
                </div>
                {!hidden && <DeltaBadge cur={kpi.deltaCur} prev={kpi.deltaPrev} />}
              </div>
            </motion.article>
          );
        })}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article className="rounded-[30px] border border-border/24 bg-card/80 p-5 md:p-6 xl:col-span-8">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/34" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Revenue timeline
              </p>
              <h2 className="mt-2 text-[20px] font-bold tracking-[-0.04em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Receita diária
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground/42">Comparativo entre o período atual e a janela anterior equivalente.</p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { label: "Líquido", value: hidden ? HIDE : fmt(m.totalNet) },
                { label: "Bruto", value: hidden ? HIDE : fmt(m.totalGross) },
                { label: "Taxas", value: hidden ? HIDE : `-${fmt(m.totalFees)}` },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/14 bg-muted/8 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/30" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {item.label}
                  </p>
                  <p className="mt-1 text-[16px] font-bold tracking-[-0.03em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <RevenueChart data={metrics.chartData} hidden={hidden} />
        </article>

        <div className="space-y-4 xl:col-span-4">
          <article className="rounded-[30px] border border-border/24 bg-card/80 p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/34" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Payment mix
                </p>
                <h2 className="mt-2 text-[18px] font-bold tracking-[-0.04em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Métodos de pagamento
                </h2>
              </div>
              <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-primary/80" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  líder
                </p>
                <p className="mt-1 text-[13px] font-semibold text-primary">{topPaymentMethod.label}</p>
              </div>
            </div>

            <div className="space-y-4">
              {paymentMix.map((pm) => {
                const pct = pm.total > 0 ? (pm.value / pm.total) * 100 : 0;
                return (
                  <div key={pm.label} className="rounded-2xl border border-border/12 bg-muted/6 p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-card/80 text-muted-foreground/50">
                          {pm.icon}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{pm.label}</p>
                          <p className="text-[10px] text-muted-foreground/28" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{pm.count} pedidos</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{hidden ? HIDE : fmt(pm.value)}</p>
                        <p className="text-[10px] text-muted-foreground/32">{pct.toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-primary" />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-[30px] border border-border/24 bg-card/80 p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/34" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Health score
                </p>
                <h2 className="mt-2 text-[18px] font-bold tracking-[-0.04em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Saúde operacional
                </h2>
              </div>
              <div className="rounded-2xl bg-muted/8 px-3 py-2 text-[11px] text-muted-foreground/42">
                risco ativo
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: "Reembolso", value: `${m.refundRate.toFixed(1)}%`, threshold: 5, raw: m.refundRate },
                { label: "Chargeback", value: `${m.chargebackRate.toFixed(1)}%`, threshold: 1, raw: m.chargebackRate },
                { label: "Falhas", value: `${m.failedRate.toFixed(1)}%`, threshold: 20, raw: m.failedRate },
              ].map((item) => {
                const isBad = item.raw > item.threshold;
                return (
                  <div key={item.label} className="rounded-2xl border border-border/12 bg-muted/6 p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-semibold text-foreground">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground/30">limite saudável: {item.threshold}%</p>
                      </div>
                      <p className={cn("text-[18px] font-bold tracking-[-0.03em]", isBad ? "text-destructive" : "text-success")} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        {item.value}
                      </p>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/10">
                      <div className={cn("h-full rounded-full", isBad ? "bg-destructive" : "bg-success")} style={{ width: `${Math.min(item.raw * 4, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <article className="rounded-[30px] border border-border/24 bg-card/80 p-5 md:p-6 xl:col-span-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/34" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Product ranking
              </p>
              <h2 className="mt-2 text-[18px] font-bold tracking-[-0.04em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Top produtos
              </h2>
            </div>
            <div className="rounded-2xl bg-muted/8 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/30" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                ativos
              </p>
              <p className="mt-1 text-[13px] font-semibold text-foreground">{metrics.topProducts.length}</p>
            </div>
          </div>

          {metrics.topProducts.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border/20 bg-muted/4 text-center">
              <Package className="mb-3 h-6 w-6 text-muted-foreground/16" />
              <p className="text-[13px] font-medium text-muted-foreground/38">Sem produtos performando neste período</p>
            </div>
          ) : (
            <div className="space-y-2">
              {metrics.topProducts.map((prod, index) => {
                const maxRevenue = metrics.topProducts[0]?.revenue || 1;
                const pct = (prod.revenue / maxRevenue) * 100;
                return (
                  <div key={prod.id} className="rounded-[22px] border border-border/12 bg-muted/6 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <span className="text-[13px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{index + 1}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-foreground">{prod.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/28" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {prod.sales} vendas
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 text-[15px] font-bold tracking-[-0.03em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        {hidden ? HIDE : fmt(prod.revenue)}
                      </p>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.55, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-primary/60" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="rounded-[30px] border border-border/24 bg-card/80 p-5 md:p-6 xl:col-span-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/34" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Intraday pulse
              </p>
              <h2 className="mt-2 text-[18px] font-bold tracking-[-0.04em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Horários de pico
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-muted/8 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/30" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  pico
                </p>
                <p className="mt-1 text-[14px] font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {peakHour === null ? "—" : `${String(peakHour).padStart(2, "0")}h`}
                </p>
              </div>
              <div className="rounded-2xl bg-muted/8 px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/30" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  clientes
                </p>
                <p className="mt-1 text-[14px] font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {m.uniqueCustomers}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/12 bg-muted/6 p-4">
            <div className="flex h-[180px] items-end gap-[3px]">
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
                        active ? "bg-primary" : intensity > 0 ? "bg-primary/35 group-hover:bg-primary/55" : "bg-muted/10"
                      )}
                    />
                    <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="rounded-lg border border-border/18 bg-popover px-2.5 py-1 text-[10px] font-medium text-foreground shadow-md" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {String(hour).padStart(2, "0")}h · {count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between text-[9px] text-muted-foreground/22" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <span>00h</span>
              <span>06h</span>
              <span>12h</span>
              <span>18h</span>
              <span>23h</span>
            </div>
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-[32px] border border-border/24 bg-card/80">
        <div className="border-b border-border/10 px-6 pt-5 pb-4">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/34" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Transaction ledger
              </p>
              <h2 className="mt-2 text-[20px] font-bold tracking-[-0.04em] text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Transações
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground/42">Busca rápida, filtros por status e acesso direto ao detalhe da venda.</p>
            </div>

            <div className="relative w-full xl:w-80">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/22" />
              <input
                id="vendas-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, e-mail ou ID…"
                className="h-11 w-full rounded-2xl border border-border/14 bg-muted/8 pl-10 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground/22 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/24 transition-all"
              />
              {search ? (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground/28 hover:text-foreground transition-colors" />
                </button>
              ) : (
                <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border/10 bg-muted/10 px-1.5 py-0.5 text-[9px] text-muted-foreground/20 md:inline" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  ⌘K
                </kbd>
              )}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusTabs.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-medium transition-all",
                    active ? "bg-primary text-primary-foreground shadow-sm shadow-primary/15" : "bg-muted/8 text-muted-foreground/42 hover:text-foreground"
                  )}
                >
                  {tab.label}
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", active ? "bg-primary-foreground/16 text-primary-foreground" : "bg-card/80 text-muted-foreground/35")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between bg-muted/[0.03] px-6 py-2.5">
          <p className="text-[11px] text-muted-foreground/26" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {sortedFiltered.length === 0 ? "Nenhuma transação" : `${Math.min(visibleCount, sortedFiltered.length)} de ${sortedFiltered.length}`}
          </p>
          {!hidden && sortedFiltered.length > 0 && (
            <p className="text-[11px] font-bold text-primary/60" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Líquido filtrado {fmt(filteredNetTotal)}
            </p>
          )}
        </div>

        <div className="hidden md:block">
          {loading ? (
            <div className="p-20 text-center">
              <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-primary/18 border-t-primary" />
              <p className="text-[12px] text-muted-foreground/26">Carregando transações…</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/8">
                      <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} className="pl-6" />
                      <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40">Produto</th>
                      <SortHead label="Valor" field="amount" sort={sort} onSort={handleSort} />
                      <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40">Método</th>
                      <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40">Status</th>
                      <SortHead label="Data" field="date" sort={sort} onSort={handleSort} />
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20">
                          <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="Nenhuma venda encontrada" subtitle="Ajuste filtros ou período para encontrar resultados." />
                        </td>
                      </tr>
                    ) : visibleItems.map((tx, i) => (
                      <TxRow key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleCount < sortedFiltered.length && (
                <div className="border-t border-border/8 p-4 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="gap-2 rounded-xl text-[11px] font-medium text-muted-foreground/42 hover:text-foreground">
                    <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({sortedFiltered.length - visibleCount} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-2.5 p-4 md:hidden">
          {loading ? (
            <div className="p-14 text-center">
              <div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-2 border-primary/18 border-t-primary" />
              <p className="text-[12px] text-muted-foreground/26">Carregando…</p>
            </div>
          ) : visibleItems.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="Nenhuma venda" subtitle="Ajuste filtros ou período" />
          ) : (
            <>
              {visibleItems.map((tx, i) => (
                <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
              ))}
              {visibleCount < sortedFiltered.length && (
                <Button variant="ghost" size="sm" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="w-full gap-2 rounded-xl text-[11px] font-medium text-muted-foreground/42 hover:text-foreground">
                  <ChevronDown className="h-3.5 w-3.5" /> Mais {sortedFiltered.length - visibleCount}
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
