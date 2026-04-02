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
  ArrowUpDown, SortAsc, SortDesc, CircleDot, Minus,
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
  "bg-destructive/12 text-destructive",
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
  completed: { label: "Aprovada", fg: "text-success", dot: "bg-success", bg: "bg-success/8" },
  pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/8" },
  failed: { label: "Falha", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/8" },
  refunded: { label: "Reembolso", fg: "text-info", dot: "bg-info", bg: "bg-info/8" },
  chargeback: { label: "Chargeback", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/8" },
};

/* ─────────────────────── Micro Components ─────────────────────── */

function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return <span className="text-[10px] font-medium text-success bg-success/8 px-1.5 py-0.5 rounded-md">novo</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md", up ? "text-success bg-success/8" : "text-destructive bg-destructive/8")}>
      {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function SortHead({ label, field, sort, onSort, className }: { label: string; field: SortField; sort: { field: SortField; dir: SortDir }; onSort: (f: SortField) => void; className?: string }) {
  const active = sort.field === field;
  return (
    <th onClick={() => onSort(field)} className={cn("text-left py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors group", className)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (sort.dir === "desc" ? <ChevronDown className="h-3 w-3 text-primary" /> : <ChevronUp className="h-3 w-3 text-primary" />)
          : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
      </span>
    </th>
  );
}

/* ─── Chart ─── */
function Chart({ data, hidden }: { data: { label: string; value: number; previous: number }[]; hidden: boolean }) {
  if (data.length < 2 || hidden) return <div className="h-[180px] flex items-center justify-center text-[12px] text-muted-foreground/30">{hidden ? "Valores ocultos" : "Dados insuficientes"}</div>;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="rv-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.15} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
        <ReTooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, padding: "8px 12px", boxShadow: "var(--card-shadow)" }}
          formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Período atual" : "Período anterior"]}
          labelStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 4, fontFamily: "JetBrains Mono" }}
          cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" fill="none" opacity={0.2} dot={false} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rv-grad)" dot={false} activeDot={{ r: 4, stroke: "hsl(var(--primary))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ─── Desktop Row ─── */
function Row({ tx, prods, onClick, i }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; i: number }) {
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
      transition={{ duration: 0.2, delay: Math.min(i * 0.012, 0.25) }}
      onClick={onClick}
      className="border-b border-border/[0.06] cursor-pointer hover:bg-muted/[0.03] group transition-colors"
    >
      {/* Customer */}
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border/20">
            <AvatarFallback className={cn("text-[10px] font-bold", avatarColor(name))}>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
            {tx.customer_email && <p className="text-[11px] text-muted-foreground/40 truncate">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      {/* Product */}
      <td className="py-3 pr-4">
        <span className="text-[12px] text-muted-foreground/60 truncate block max-w-[140px]">{tx.product_id ? (prods[tx.product_id] || "—") : "—"}</span>
      </td>
      {/* Amount */}
      <td className="py-3 pr-4">
        <div>
          <span className="text-[14px] font-semibold text-foreground tabular-nums tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(Number(tx.amount))}</span>
          <div className="text-[10px] text-muted-foreground/30 tabular-nums mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>liq {fmt(Number(tx.net_amount))}</div>
        </div>
      </td>
      {/* Method */}
      <td className="py-3 pr-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/50 font-medium">
          {method.icon}{method.label}
        </span>
      </td>
      {/* Status */}
      <td className="py-3 pr-4">
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium", st.fg, st.bg)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
          {st.label}
        </span>
      </td>
      {/* Date */}
      <td className="py-3 pr-4">
        <div>
          <span className="text-[12px] text-muted-foreground/50 tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtDate(tx.created_at)}</span>
          <span className="text-[10px] text-muted-foreground/25 ml-1.5 tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtTime(tx.created_at)}</span>
        </div>
      </td>
      {/* Actions */}
      <td className="py-3">
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
      className="rounded-xl bg-card border border-border/40 p-4 cursor-pointer active:scale-[0.985] transition-transform"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9 ring-1 ring-border/20">
            <AvatarFallback className={cn("text-[10px] font-bold", avatarColor(name))}>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
            <p className="text-[11px] text-muted-foreground/40 truncate">{tx.customer_email || methodLabels[tx.payment_method || ""] || ""}</p>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0", st.fg, st.bg)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />{st.label}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[20px] font-semibold text-foreground tabular-nums tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(Number(tx.amount))}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground/30">{methodLabels[tx.payment_method || ""] || "—"}</span>
            <span className="text-[10px] text-muted-foreground/20">·</span>
            <span className="text-[10px] text-muted-foreground/30 truncate max-w-[100px]">{tx.product_id ? prods[tx.product_id] || "" : "—"}</span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1.5">
          <span className="text-[11px] text-muted-foreground/40 tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtDate(tx.created_at)}</span>
          {tx.customer_phone && (
            <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center text-success">
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
      <DialogContent className="sm:max-w-md border-border/40 bg-card backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg"><Download className="h-5 w-5 text-primary" /> Exportar Vendas</DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">Filtros para exportação CSV</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</p>
              <div className="flex gap-2 text-[10px]">
                <button onClick={() => setSelectedStatuses(new Set())} className="text-muted-foreground hover:text-foreground">Limpar</button>
                <button onClick={() => setSelectedStatuses(new Set(ALL_STATUSES.map(s => s.value)))} className="text-primary">Todos</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => (
                <button key={s.value} onClick={() => toggleStatus(s.value)} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border", selectedStatuses.has(s.value) ? "border-primary/20 bg-primary/8 text-primary" : "border-border/30 text-muted-foreground/60 hover:border-border/50")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", selectedStatuses.has(s.value) ? s.dot : "bg-muted-foreground/20")} />{s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Método</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_METHODS.map(m => {
                const Icon = m.icon;
                return (
                  <button key={m.value} onClick={() => toggleMethod(m.value)} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border", selectedMethods.has(m.value) ? "border-primary/20 bg-primary/8 text-primary" : "border-border/30 text-muted-foreground/60 hover:border-border/50")}>
                    <Icon className="h-3 w-3" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          {txProducts.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Produtos</p>
              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                <button onClick={() => toggleProduct("all")} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-left", selectedProducts.has("all") ? "bg-primary/8 text-primary" : "text-muted-foreground hover:bg-muted/20")}>
                  {selectedProducts.has("all") ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />} Todos
                </button>
                {txProducts.map(p => (
                  <button key={p.id} onClick={() => toggleProduct(p.id)} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-left", selectedProducts.has(p.id) ? "bg-primary/8 text-primary" : "text-muted-foreground hover:bg-muted/20")}>
                    {selectedProducts.has(p.id) ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />} <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-xl bg-muted/10 border border-border/20 p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-foreground">{exportFiltered.length} transações</p>
              <p className="text-[10px] text-muted-foreground/40">serão exportadas</p>
            </div>
            <p className="text-[15px] font-bold text-primary tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(exportFiltered.reduce((a, t) => a + Number(t.net_amount), 0))}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl h-10 text-[12px]">Cancelar</Button>
          <Button onClick={() => { onExport(exportFiltered); onOpenChange(false); }} disabled={exportFiltered.length === 0} className="flex-1 rounded-xl h-10 gap-2 text-[12px]">
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

    // Chart
    const dailyMap: Record<string, number> = {};
    const prevDailyMap: Record<string, number> = {};
    for (const t of current.approved) { const day = fmtDate(t.created_at); dailyMap[day] = (dailyMap[day] || 0) + Number(t.net_amount); }
    for (const t of previous.approved) { const day = fmtDate(t.created_at); prevDailyMap[day] = (prevDailyMap[day] || 0) + Number(t.net_amount); }
    const currentDays = Object.entries(dailyMap).map(([label, value]) => ({ label, value })).reverse();
    const prevDays = Object.values(prevDailyMap);
    const chartData = currentDays.map((d, i) => ({ ...d, previous: prevDays[i] || 0 }));

    // Hourly
    const hours = Array(24).fill(0);
    current.approved.forEach(t => { hours[new Date(t.created_at).getHours()]++; });

    const lastSaleAt = current.approved.length > 0 ? current.approved[0].created_at : null;
    return { current, previous, topProducts, chartData, hours, lastSaleAt };
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
  const maxHour = Math.max(...metrics.hours, 1);

  const paymentMix = [
    { label: "PIX", value: m.pixRev, count: m.pixCount, icon: <Smartphone className="h-4 w-4" />, total: m.totalNet },
    { label: "Cartão", value: m.cardRev, count: m.cardCount, icon: <CreditCard className="h-4 w-4" />, total: m.totalNet },
    { label: "Boleto", value: m.boletoRev, count: m.boletoCount, icon: <FileText className="h-4 w-4" />, total: m.totalNet },
  ];

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="mx-auto w-full max-w-[1200px] pb-10">

      {/* ═══ HERO HEADER ═══ */}
      <div className="mb-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          {/* Left: Title + Revenue */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold text-foreground tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Vendas</h1>
                <p className="text-[11px] text-muted-foreground/50">Visão geral do seu negócio</p>
              </div>
            </div>

            <div className="flex items-baseline gap-4">
              <span className="text-[36px] md:text-[44px] font-bold text-foreground tracking-tighter leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif", fontFeatureSettings: "'tnum'" }}>
                {hidden ? "R$ •••" : fmtCompact(m.totalNet)}
              </span>
              {!hidden && <DeltaBadge cur={m.totalNet} prev={p.totalNet} />}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[12px] text-muted-foreground/40">Receita líquida</span>
              {lastSaleText && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-success font-medium">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-success opacity-50" /><span className="relative rounded-full h-2 w-2 bg-success" /></span>
                  Última venda {lastSaleText}
                </span>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period pills */}
            <div className="flex items-center bg-muted/20 rounded-lg p-0.5 border border-border/30">
              {PERIODS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all",
                    !isCustom && selectedPeriod.label === opt.label
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button className={cn("h-8 px-3 rounded-lg border flex items-center gap-1.5 text-[11px] font-medium transition-all", isCustom ? "border-primary/30 bg-primary/5 text-primary" : "border-border/30 bg-card/60 text-muted-foreground hover:text-foreground")}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  {isCustom && customRange?.from
                    ? customRange.to ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
                    : "Custom"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0 rounded-xl border border-border/30 bg-card shadow-lg overflow-hidden">
                <div className="p-2">
                  <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-2" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
                </div>
              </PopoverContent>
            </Popover>

            <button onClick={toggleHidden} className="h-8 w-8 rounded-lg border border-border/30 bg-card/60 flex items-center justify-center transition-all hover:border-border" title={hidden ? "Mostrar" : "Ocultar"}>
              {hidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>

            <button onClick={() => setShowExportDialog(true)} className="h-8 rounded-lg border border-border/30 bg-card/60 px-3 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:border-border hover:text-foreground">
              <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Faturamento Bruto", value: hidden ? HIDE : fmt(m.totalGross), prev: p.totalGross, cur: m.totalGross, icon: <DollarSign className="h-4 w-4" /> },
          { label: "Ticket Médio", value: hidden ? HIDE : fmt(m.avgTicket), prev: p.avgTicket, cur: m.avgTicket, icon: <Receipt className="h-4 w-4" /> },
          { label: "Taxa de Conversão", value: hidden ? HIDE : `${m.conversion.toFixed(1)}%`, prev: p.conversion, cur: m.conversion, icon: <Target className="h-4 w-4" /> },
          { label: "Vendas Aprovadas", value: hidden ? HIDE : String(m.approved.length), prev: p.approved.length, cur: m.approved.length, icon: <CheckSquare className="h-4 w-4" /> },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card p-4 md:p-5 space-y-3 transition-colors hover:border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">{kpi.label}</span>
              <div className="h-7 w-7 rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground/40">
                {kpi.icon}
              </div>
            </div>
            <div>
              <span className="text-[22px] md:text-[26px] font-bold text-foreground tabular-nums tracking-tight leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{kpi.value}</span>
              {!hidden && <div className="mt-1.5"><DeltaBadge cur={kpi.cur} prev={kpi.prev} /></div>}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ ANALYTICS SECTION ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Revenue Chart — 3 cols */}
        <div className="lg:col-span-3 rounded-xl border border-border/40 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[14px] font-semibold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Receita diária</h2>
              <p className="text-[11px] text-muted-foreground/40 mt-0.5">Comparação com período anterior</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/40"><span className="h-2 w-5 rounded-full bg-primary/60" />Atual</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/40"><span className="h-[1px] w-5 border-t-2 border-dashed border-muted-foreground/20" />Anterior</span>
            </div>
          </div>
          <Chart data={metrics.chartData} hidden={hidden} />
        </div>

        {/* Right sidebar — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          {/* Payment Methods */}
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <h2 className="text-[14px] font-semibold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Métodos de pagamento</h2>
            <div className="space-y-4">
              {paymentMix.map(pm => {
                const pct = pm.total > 0 ? (pm.value / pm.total) * 100 : 0;
                return (
                  <div key={pm.label} className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted/15 flex items-center justify-center text-muted-foreground/50 shrink-0">
                      {pm.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium text-foreground">{pm.label}</span>
                        <span className="text-[13px] font-bold text-foreground tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{hidden ? HIDE : fmt(pm.value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/10 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-primary" />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground/30 tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{pm.count} vendas</span>
                        <span className="text-[10px] text-muted-foreground/40 font-semibold tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Health */}
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <h2 className="text-[14px] font-semibold text-foreground mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Saúde operacional</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Reembolso", value: `${m.refundRate.toFixed(1)}%`, bad: m.refundRate > 5 },
                { label: "Chargeback", value: `${m.chargebackRate.toFixed(1)}%`, bad: m.chargebackRate > 1 },
                { label: "Falhas", value: `${m.failedRate.toFixed(1)}%`, bad: m.failedRate > 20 },
              ].map(h => (
                <div key={h.label} className={cn("rounded-lg p-3 text-center border", h.bad ? "border-destructive/20 bg-destructive/5" : "border-border/20 bg-muted/5")}>
                  <p className={cn("text-[18px] font-bold tabular-nums", h.bad ? "text-destructive" : "text-success")} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{h.value}</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">{h.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border/15 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground/40">Pendentes</span>
                <span className="text-[13px] font-bold text-foreground tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{m.pending.length}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground/40">Taxas</span>
                <span className="text-[13px] font-bold text-destructive/70 tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{hidden ? HIDE : `-${fmt(m.totalFees)}`}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SECONDARY ROW ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Top Products */}
        <div className="rounded-xl border border-border/40 bg-card p-5">
          <h2 className="text-[14px] font-semibold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Top produtos</h2>
          {metrics.topProducts.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/30 py-8 text-center">Sem dados no período</p>
          ) : (
            <div className="space-y-1">
              {metrics.topProducts.map((prod, i) => {
                const maxRev = metrics.topProducts[0]?.revenue || 1;
                const pct = (prod.revenue / maxRev) * 100;
                return (
                  <div key={prod.id} className="flex items-center gap-3 py-2.5 rounded-lg px-2 hover:bg-muted/[0.04] transition-colors">
                    <span className="text-[12px] font-bold text-muted-foreground/25 w-5 text-right tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] font-medium text-foreground truncate pr-3">{prod.name}</span>
                        <span className="text-[13px] font-bold text-foreground tabular-nums shrink-0" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{hidden ? HIDE : fmt(prod.revenue)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted/10 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-primary/50" />
                      </div>
                      <span className="text-[10px] text-muted-foreground/30 mt-1 inline-block tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{prod.sales} vendas</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hourly Activity */}
        <div className="rounded-xl border border-border/40 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Atividade por hora</h2>
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground/30" />
              <span className="text-[13px] font-bold text-foreground tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{m.uniqueCustomers}</span>
              {!hidden && <DeltaBadge cur={m.uniqueCustomers} prev={p.uniqueCustomers} />}
              <span className="text-[10px] text-muted-foreground/30">clientes</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-[3px] items-end h-16">
              {metrics.hours.map((count, hour) => {
                const intensity = count / maxHour;
                return (
                  <div key={hour} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(intensity * 100, 4)}%` }}
                      transition={{ duration: 0.4, delay: hour * 0.015, ease: [0.16, 1, 0.3, 1] }}
                      className={cn("w-full rounded-t-sm transition-colors", intensity > 0 ? "bg-primary/40 group-hover:bg-primary/60" : "bg-muted/10")}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="bg-popover border border-border rounded-md px-2 py-1 text-[10px] font-medium text-foreground whitespace-nowrap shadow-md" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{hour}h · {count}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/20 tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TRANSACTIONS SECTION ═══ */}
      <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
        {/* Header */}
        <div className="p-5 pb-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <h2 className="text-[14px] font-semibold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Transações</h2>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30" />
              <input
                id="vendas-search" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail ou ID…"
                className="w-full h-9 pl-9 pr-12 rounded-lg bg-muted/10 border border-border/20 text-[12px] text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
              />
              {search ? (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground/30 hover:text-foreground transition-colors" /></button>
              ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline text-[9px] text-muted-foreground/25 bg-muted/15 px-1.5 py-0.5 rounded font-mono border border-border/15">⌘K</kbd>
              )}
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex gap-0 overflow-x-auto scrollbar-none border-b border-border/15">
            {statusTabs.map(f => {
              const isActive = statusFilter === f.value;
              return (
                <button key={f.value} onClick={() => setStatusFilter(f.value)} className={cn(
                  "shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium transition-all border-b-2 -mb-px",
                  isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground/40 hover:text-muted-foreground/70"
                )}>
                  {f.label}
                  <span className={cn("text-[10px] tabular-nums rounded-md px-1.5 py-0.5", isActive ? "bg-primary/10 text-primary" : "bg-muted/10 text-muted-foreground/30")} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{f.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between px-5 py-2 bg-muted/[0.03]">
          <p className="text-[11px] text-muted-foreground/30" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {sortedFiltered.length === 0 ? "Nenhuma transação" : `${Math.min(visibleCount, sortedFiltered.length)} de ${sortedFiltered.length}`}
          </p>
          {sortedFiltered.length > 0 && !hidden && <p className="text-[11px] text-primary/60 font-semibold tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(sortedFiltered.reduce((a, t) => a + Number(t.net_amount), 0))}</p>}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          {loading ? (
            <div className="p-16 text-center">
              <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[12px] text-muted-foreground/30">Carregando…</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/10">
                      <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} className="pl-5" />
                      <th className="text-left py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Produto</th>
                      <SortHead label="Valor" field="amount" sort={sort} onSort={handleSort} />
                      <th className="text-left py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Método</th>
                      <th className="text-left py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                      <SortHead label="Data" field="date" sort={sort} onSort={handleSort} />
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.length === 0 ? (
                      <tr><td colSpan={7}><EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="Nenhuma venda encontrada" subtitle="Ajuste os filtros ou período" /></td></tr>
                    ) : visibleItems.map((tx, i) => (
                      <Row key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleCount < sortedFiltered.length && (
                <div className="p-3 text-center border-t border-border/10">
                  <Button variant="ghost" size="sm" onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="gap-1.5 text-[11px] text-muted-foreground/40 hover:text-foreground font-medium">
                    <ChevronDown className="h-3 w-3" /> Carregar mais ({sortedFiltered.length - visibleCount} restantes)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-4 space-y-2">
          {loading ? (
            <div className="p-12 text-center"><div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2" /><p className="text-[12px] text-muted-foreground/30">Carregando…</p></div>
          ) : visibleItems.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="Nenhuma venda" subtitle="Ajuste os filtros" />
          ) : (
            <>
              {visibleItems.map((tx, i) => <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} i={i} />)}
              {visibleCount < sortedFiltered.length && (
                <Button variant="ghost" size="sm" onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="w-full gap-1.5 text-[11px] text-muted-foreground/40 font-medium">
                  <ChevronDown className="h-3 w-3" /> Mais {sortedFiltered.length - visibleCount}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
      <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} productsRaw={productsRaw} onExport={handleExportCSV} />
    </div>
  );
}
