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
  ArrowUpDown, SortAsc, SortDesc,
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
import { AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, ComposedChart } from "recharts";

/* ─── Formatters ─── */
const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(".", ",")}K`;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
const CENSORED = "••••••";

const PERIOD_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
] as const;
type PeriodPreset = (typeof PERIOD_PRESETS)[number];
const PAGE_SIZE = 50;

/* ─── Avatar ─── */
const AVATAR_COLORS = [
  "bg-primary/15 text-primary",
  "bg-info/15 text-info",
  "bg-warning/15 text-warning",
  "bg-success/15 text-success",
  "bg-destructive/15 text-destructive",
];
const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
};

/* ─── Status config ─── */
const STATUS_META: Record<string, { label: string; color: string; dotClass: string }> = {
  completed: { label: "Aprovada", color: "text-success", dotClass: "bg-success" },
  pending: { label: "Pendente", color: "text-warning", dotClass: "bg-warning" },
  failed: { label: "Falha", color: "text-destructive", dotClass: "bg-destructive" },
  refunded: { label: "Reembolso", color: "text-info", dotClass: "bg-info" },
  chargeback: { label: "Chargeback", color: "text-destructive", dotClass: "bg-destructive" },
};

/* ─── Delta ─── */
function Delta({ current, previous, suffix = "%" }: { current: number; previous: number; suffix?: string }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="text-[10px] font-semibold text-success">novo</span>;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums", isUp ? "text-success" : "text-destructive")}>
      {isUp ? "+" : ""}{pct.toFixed(0)}%
    </span>
  );
}

/* ─── Sortable Header ─── */
function SortableHeader({ label, field, currentSort, onSort }: {
  label: string; field: SortField; currentSort: { field: SortField; dir: SortDir }; onSort: (f: SortField) => void;
}) {
  const isActive = currentSort.field === field;
  return (
    <th onClick={() => onSort(field)} className="text-left px-4 py-3.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider cursor-pointer select-none hover:text-foreground/80 transition-colors group whitespace-nowrap">
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (currentSort.dir === "desc" ? <SortDesc className="h-3 w-3 text-primary" /> : <SortAsc className="h-3 w-3 text-primary" />) : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
      </span>
    </th>
  );
}

/* ─── Transaction Row (Desktop) ─── */
function TxRow({ tx, products, onClick, index }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void; index: number;
}) {
  const methodConfig: Record<string, { label: string; icon: React.ReactNode }> = {
    pix: { label: "PIX", icon: <Smartphone className="h-3 w-3" /> },
    credit_card: { label: "Cartão", icon: <CreditCard className="h-3 w-3" /> },
    boleto: { label: "Boleto", icon: <FileText className="h-3 w-3" /> },
  };
  const method = methodConfig[tx.payment_method || ""] || { label: tx.payment_method || "—", icon: null };
  const customerName = tx.customer_name || "Cliente";
  const avatarColor = getAvatarColor(customerName);
  const status = STATUS_META[tx.status] || { label: tx.status, color: "text-muted-foreground", dotClass: "bg-muted-foreground" };

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.015, 0.3) }}
      onClick={onClick}
      className="border-b border-border/15 transition-colors cursor-pointer hover:bg-muted/[0.04] group"
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className={cn("text-[10px] font-bold", avatarColor)}>{getInitials(customerName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate leading-tight">{customerName}</p>
            {tx.customer_email && <p className="text-[11px] text-muted-foreground/50 truncate">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="text-[12px] text-muted-foreground/70 truncate block max-w-[120px]">{tx.product_id ? (products[tx.product_id] || "—") : "—"}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="text-[14px] font-semibold text-foreground tabular-nums font-numbers">{fmt(Number(tx.amount))}</span>
        <span className="text-[10px] text-muted-foreground/40 ml-1.5 tabular-nums">líq {fmt(Number(tx.net_amount))}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 font-medium">
          {method.icon}{method.label}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", status.color)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dotClass)} />
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span className="text-[12px] text-muted-foreground/60 tabular-nums">{fmtDate(tx.created_at)}</span>
        <span className="text-[10px] text-muted-foreground/30 ml-1 tabular-nums">{fmtTime(tx.created_at)}</span>
      </td>
      <td className="px-4 py-3.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/30">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[12px]"><Eye className="h-3.5 w-3.5" /> Ver Detalhes</DropdownMenuItem>
            {tx.customer_phone && (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_phone!); toast.success("Copiado!"); }} className="gap-2 text-[12px]"><Copy className="h-3.5 w-3.5" /> Copiar WhatsApp</DropdownMenuItem>
                <DropdownMenuItem asChild><a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="gap-2 text-[12px]"><MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp</a></DropdownMenuItem>
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

/* ─── Transaction Card (Mobile) ─── */
function TxCard({ tx, products, onClick, index }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void; index: number;
}) {
  const methodLabels: Record<string, string> = { pix: "PIX", credit_card: "Cartão", boleto: "Boleto" };
  const customerName = tx.customer_name || "Cliente";
  const avatarColor = getAvatarColor(customerName);
  const status = STATUS_META[tx.status] || { label: tx.status, color: "text-muted-foreground", dotClass: "bg-muted-foreground" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
      className="rounded-xl bg-card/60 border border-border/30 p-3.5 cursor-pointer active:scale-[0.99] transition-all"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className={cn("text-[10px] font-bold", avatarColor)}>{getInitials(customerName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{customerName}</p>
            <p className="text-[11px] text-muted-foreground/50 truncate">{tx.customer_email || ""}</p>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium shrink-0", status.color)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dotClass)} />{status.label}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[18px] font-semibold text-foreground tabular-nums font-numbers">{fmt(Number(tx.amount))}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground/40">{methodLabels[tx.payment_method || ""] || "—"}</span>
            <span className="text-[10px] text-muted-foreground/30">·</span>
            <span className="text-[10px] text-muted-foreground/40 truncate max-w-[100px]">{tx.product_id ? products[tx.product_id] || "Produto" : "—"}</span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-1.5">
          <span className="text-[11px] text-muted-foreground/50 tabular-nums">{fmtDate(tx.created_at)}</span>
          {tx.customer_phone && (
            <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="h-7 w-7 rounded-md bg-success/10 flex items-center justify-center text-success">
              <MessageCircle className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Revenue Chart ─── */
function RevenueChart({ data, hidden }: { data: { label: string; value: number; previous: number }[]; hidden: boolean }) {
  if (data.length < 2 || hidden) return <div className="h-[140px] flex items-center justify-center text-[11px] text-muted-foreground/30">{hidden ? "Valores ocultos" : "Dados insuficientes"}</div>;
  return (
    <ResponsiveContainer width="100%" height={140}>
      <ComposedChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis hide domain={["auto", "auto"]} />
        <ReTooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11, padding: "6px 10px" }}
          formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
          labelStyle={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}
        />
        <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" fill="none" opacity={0.25} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#revenueGrad)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ─── Export Dialog (unchanged logic, cleaner visual) ─── */
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
      <DialogContent className="sm:max-w-md border-border/40 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg"><Download className="h-5 w-5 text-primary" /> Exportar Vendas</DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">Escolha os filtros para a exportação CSV</DialogDescription>
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
              <div className="flex gap-2 text-[10px]">
                <button onClick={() => setSelectedMethods(new Set())} className="text-muted-foreground hover:text-foreground">Limpar</button>
                <button onClick={() => setSelectedMethods(new Set(ALL_METHODS.map(m => m.value)))} className="text-primary">Todos</button>
              </div>
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
                  {selectedProducts.has("all") ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />} Todos os produtos
                </button>
                {txProducts.map(p => (
                  <button key={p.id} onClick={() => toggleProduct(p.id)} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-left", selectedProducts.has(p.id) ? "bg-primary/8 text-primary" : "text-muted-foreground hover:bg-muted/20")}>
                    {selectedProducts.has(p.id) ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />} <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-lg bg-muted/10 border border-border/20 p-3 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-foreground">{exportFiltered.length} transações</p>
              <p className="text-[10px] text-muted-foreground/50">serão exportadas</p>
            </div>
            <p className="text-[14px] font-semibold text-primary font-numbers tabular-nums">{fmt(exportFiltered.reduce((a, t) => a + Number(t.net_amount), 0))}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-lg h-10 text-[12px]">Cancelar</Button>
          <Button onClick={() => { onExport(exportFiltered); onOpenChange(false); }} disabled={exportFiltered.length === 0} className="flex-1 rounded-lg h-10 gap-2 text-[12px]">
            <Download className="h-3.5 w-3.5" /> Exportar{exportFiltered.length > 0 ? ` (${exportFiltered.length})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════ MAIN ═══════════════════════════════════ */

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
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[2]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "date", dir: "desc" });
  const [privacyHidden, setPrivacyHidden] = useState(() => {
    try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; }
  });

  const togglePrivacy = useCallback(() => {
    setPrivacyHidden(prev => { const next = !prev; try { localStorage.setItem("privacy_mode", String(next)); } catch {} return next; });
  }, []);
  const handleSort = useCallback((field: SortField) => {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === "desc" ? "asc" : "desc" } : { field, dir: "desc" });
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

    // Hourly
    const hours = Array(24).fill(0);
    current.approved.forEach(t => { hours[new Date(t.created_at).getHours()]++; });

    // Last sale
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
    const sorted = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.field) {
      case "date": sorted.sort((a, b) => dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())); break;
      case "amount": sorted.sort((a, b) => dir * (Number(a.amount) - Number(b.amount))); break;
      case "net": sorted.sort((a, b) => dir * (Number(a.net_amount) - Number(b.net_amount))); break;
      case "customer": sorted.sort((a, b) => dir * ((a.customer_name || "").localeCompare(b.customer_name || ""))); break;
    }
    return sorted;
  }, [filtered, sort]);

  const visibleItems = useMemo(() => sortedFiltered.slice(0, visibleCount), [sortedFiltered, visibleCount]);

  const statusFilters = useMemo(() => {
    const counts: Record<string, number> = { all: dateFiltered.length, completed: 0, pending: 0, failed: 0, refunded: 0, chargeback: 0 };
    for (const t of dateFiltered) { if (t.status in counts) counts[t.status]++; }
    return [
      { label: "Todas", value: "all" as StatusFilter, count: counts.all },
      { label: "Aprovadas", value: "completed" as StatusFilter, count: counts.completed },
      { label: "Pendentes", value: "pending" as StatusFilter, count: counts.pending },
      { label: "Falhas", value: "failed" as StatusFilter, count: counts.failed },
      { label: "Reembolsos", value: "refunded" as StatusFilter, count: counts.refunded },
      { label: "Chargebacks", value: "chargeback" as StatusFilter, count: counts.chargeback },
    ];
  }, [dateFiltered]);

  const sanitizeCsvCell = useCallback((val: unknown): string => {
    const str = String(val ?? "");
    if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
    return str;
  }, []);

  const handleExportCSV = useCallback((txList: Tables<"transactions">[]) => {
    if (txList.length === 0) { toast.error("Nenhuma transação para exportar."); return; }
    const headers = ["ID", "Cliente", "Email", "Telefone", "CPF/CNPJ", "Produto", "Valor Bruto", "Taxa", "Líquido", "Método", "Status", "Data"];
    const rows = txList.map(t => [t.id, t.customer_name || "", t.customer_email || "", t.customer_phone || "", t.customer_document || "", t.product_id ? products[t.product_id] || "" : "", Number(t.amount), Number(t.fee_amount), Number(t.net_amount), t.payment_method || "", t.status, t.created_at]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${sanitizeCsvCell(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `vendas-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${txList.length} transações exportadas!`);
  }, [products, sanitizeCsvCell]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); document.getElementById("vendas-search")?.focus(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const m = metrics.current;
  const p = metrics.previous;
  const lastSaleText = metrics.lastSaleAt ? formatDistanceToNow(new Date(metrics.lastSaleAt), { locale: ptBR, addSuffix: true }) : null;

  /* ─── Payment method bar ─── */
  const paymentMethods = [
    { label: "PIX", value: m.pixRev, count: m.pixCount, total: m.totalNet },
    { label: "Cartão", value: m.cardRev, count: m.cardCount, total: m.totalNet },
    { label: "Boleto", value: m.boletoRev, count: m.boletoCount, total: m.totalNet },
  ];
  const maxHour = Math.max(...metrics.hours, 1);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 relative pb-8">

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between animate-fade-in">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">Painel de vendas</p>
          <h1 className="text-2xl md:text-3xl font-display font-black text-foreground tracking-tight leading-none">
            {privacyHidden ? CENSORED : fmt(m.totalNet)}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {!privacyHidden && <Delta current={m.totalNet} previous={p.totalNet} />}
            <span className="text-[11px] text-muted-foreground/40">receita líquida</span>
            {lastSaleText && (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-success/80 font-medium">
                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute h-full w-full rounded-full bg-success opacity-60" /><span className="relative rounded-full h-1.5 w-1.5 bg-success" /></span>
                {lastSaleText}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-3 text-[12px] font-medium text-foreground transition-all hover:border-border">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {isCustom && customRange?.from
                  ? customRange.to ? `${format(customRange.from, "dd/MM")} - ${format(customRange.to, "dd/MM")}` : format(customRange.from, "dd/MM/yyyy")
                  : selectedPeriod.label}
                <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-lg overflow-hidden">
              <div className="p-1.5 space-y-0.5 min-w-[140px]">
                <p className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-widest px-2.5 py-1.5">Período</p>
                {PERIOD_PRESETS.map(option => (
                  <button key={option.label} onClick={() => { setSelectedPeriod(option); setIsCustom(false); setCustomRange(undefined); setDatePickerOpen(false); }} className={cn("w-full text-left rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-all", !isCustom && selectedPeriod.label === option.label ? "bg-primary/10 text-primary" : "text-foreground/60 hover:bg-muted/30")}>
                    {option.label}
                  </button>
                ))}
                <div className="border-t border-border/15 my-1" />
                <button onClick={() => setIsCustom(true)} className={cn("w-full text-left rounded-md px-2.5 py-1.5 text-[12px] font-medium flex items-center gap-1.5", isCustom ? "bg-primary/10 text-primary" : "text-foreground/60 hover:bg-muted/30")}>
                  <CalendarDays className="h-3 w-3" /> Personalizado
                </button>
                {isCustom && (
                  <div className="border-t border-border/15 mt-1 pt-1">
                    <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="p-2" classNames={{ day_selected: "bg-primary text-primary-foreground", day_range_middle: "bg-primary/10 text-foreground", day_range_end: "bg-primary text-primary-foreground" }} />
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <button onClick={togglePrivacy} className="h-8 w-8 rounded-lg border border-border/50 bg-card/60 flex items-center justify-center transition-all hover:border-border" title={privacyHidden ? "Mostrar" : "Ocultar"}>
            {privacyHidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          <button onClick={() => setShowExportDialog(true)} className="h-8 rounded-lg border border-border/50 bg-card/60 px-3 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-all hover:border-border hover:text-foreground">
            <Download className="h-3.5 w-3.5" /> <span className="hidden md:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* ═══ METRICS ROW ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/20 rounded-xl overflow-hidden animate-fade-in" style={{ animationDelay: "60ms" }}>
        {[
          { label: "Bruto", value: privacyHidden ? CENSORED : fmt(m.totalGross), delta: <Delta current={m.totalGross} previous={p.totalGross} /> },
          { label: "Ticket Médio", value: privacyHidden ? CENSORED : fmt(m.avgTicket), delta: <Delta current={m.avgTicket} previous={p.avgTicket} /> },
          { label: "Conversão", value: privacyHidden ? CENSORED : `${m.conversion.toFixed(1)}%`, delta: <Delta current={m.conversion} previous={p.conversion} /> },
          { label: "Aprovadas", value: privacyHidden ? CENSORED : `${m.approved.length}`, delta: <Delta current={m.approved.length} previous={p.approved.length} /> },
        ].map((item, i) => (
          <div key={i} className="bg-card/80 p-4 md:p-5 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">{item.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-[17px] md:text-[20px] font-display font-bold text-foreground tabular-nums tracking-tight">{item.value}</span>
              {!privacyHidden && item.delta}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ ANALYTICS GRID ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: "120ms" }}>

        {/* Revenue Chart — takes 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-border/30 bg-card/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-foreground">Receita diária</p>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-[9px] text-muted-foreground/50"><span className="h-[6px] w-3 rounded-full bg-primary" />Atual</span>
              <span className="inline-flex items-center gap-1.5 text-[9px] text-muted-foreground/50"><span className="h-[1px] w-3 border-t border-dashed border-muted-foreground/30" />Anterior</span>
            </div>
          </div>
          <RevenueChart data={metrics.chartData} hidden={privacyHidden} />
        </div>

        {/* Right column — split into 2 panels */}
        <div className="space-y-4">
          {/* Payment mix */}
          <div className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-3">
            <p className="text-[12px] font-semibold text-foreground">Métodos de pagamento</p>
            <div className="space-y-2.5">
              {paymentMethods.map(pm => {
                const pct = pm.total > 0 ? (pm.value / pm.total) * 100 : 0;
                return (
                  <div key={pm.label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/70 font-medium">{pm.label}</span>
                      <span className="text-[11px] font-semibold text-foreground tabular-nums font-numbers">{privacyHidden ? CENSORED : fmt(pm.value)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted/15 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-primary/50" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground/30 tabular-nums">{pm.count} vendas</span>
                      <span className="text-[9px] text-muted-foreground/30 tabular-nums font-semibold">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Health indicators — compact inline */}
          <div className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-2.5">
            <p className="text-[12px] font-semibold text-foreground">Saúde</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Reembolso", value: `${m.refundRate.toFixed(1)}%`, bad: m.refundRate > 5 },
                { label: "Chargeback", value: `${m.chargebackRate.toFixed(1)}%`, bad: m.chargebackRate > 1 },
                { label: "Falhas", value: `${m.failedRate.toFixed(1)}%`, bad: m.failedRate > 20 },
              ].map(h => (
                <div key={h.label} className="text-center py-2">
                  <p className={cn("text-[15px] font-display font-bold tabular-nums", h.bad ? "text-destructive" : "text-success")}>{h.value}</p>
                  <p className="text-[9px] text-muted-foreground/40 mt-0.5">{h.label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/15">
              <span className="text-[10px] text-muted-foreground/40">Pendentes</span>
              <span className="text-[12px] font-semibold text-foreground tabular-nums">{m.pending.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/40">Taxas pagas</span>
              <span className="text-[12px] font-semibold text-destructive/60 tabular-nums">{privacyHidden ? CENSORED : `-${fmt(m.totalFees)}`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SECONDARY ROW — Top Products + Hourly Heatmap ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: "180ms" }}>
        {/* Top Products */}
        <div className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-3">
          <p className="text-[12px] font-semibold text-foreground">Top produtos</p>
          {metrics.topProducts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/30 py-6 text-center">Sem dados no período</p>
          ) : (
            <div className="space-y-0">
              {metrics.topProducts.map((prod, i) => {
                const maxRev = metrics.topProducts[0]?.revenue || 1;
                const pct = (prod.revenue / maxRev) * 100;
                return (
                  <div key={prod.id} className="flex items-center gap-3 py-2.5 group">
                    <span className="text-[11px] font-mono text-muted-foreground/30 w-4 text-right tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-medium text-foreground truncate pr-3">{prod.name}</span>
                        <span className="text-[12px] font-semibold text-foreground tabular-nums font-numbers shrink-0">{privacyHidden ? CENSORED : fmt(prod.revenue)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted/10 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-primary/40" />
                      </div>
                      <span className="text-[9px] text-muted-foreground/30 mt-0.5 inline-block tabular-nums">{prod.sales} vendas</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hourly Heatmap */}
        <div className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-3">
          <p className="text-[12px] font-semibold text-foreground">Atividade por hora</p>
          <div className="space-y-1.5">
            <div className="flex gap-[2px]">
              {metrics.hours.map((count, hour) => {
                const intensity = count / maxHour;
                return (
                  <div key={hour} className="flex-1 group relative">
                    <div className="h-7 rounded-[2px] transition-colors" style={{ backgroundColor: intensity > 0 ? `hsl(var(--primary) / ${0.08 + intensity * 0.55})` : "hsl(var(--muted) / 0.08)" }} />
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="bg-popover border border-border rounded px-1.5 py-0.5 text-[9px] font-medium text-foreground whitespace-nowrap shadow-md">{hour}h · {count}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[8px] text-muted-foreground/25 font-mono tabular-nums">
              <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-border/15">
            <span className="text-[10px] text-muted-foreground/40">Clientes únicos</span>
            <span className="text-[13px] font-display font-bold text-foreground tabular-nums">{m.uniqueCustomers}</span>
            {!privacyHidden && <Delta current={m.uniqueCustomers} previous={p.uniqueCustomers} />}
          </div>
        </div>
      </div>

      {/* ═══ SEARCH + FILTERS ═══ */}
      <div className="space-y-3 animate-fade-in" style={{ animationDelay: "240ms" }}>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <input
            id="vendas-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, telefone ou ID…"
            className="w-full h-9 pl-9 pr-12 rounded-lg bg-card/40 border border-border/30 text-[13px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
          />
          {search ? (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-foreground transition-colors" /></button>
          ) : (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline text-[9px] text-muted-foreground/30 bg-muted/20 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          )}
        </div>

        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {statusFilters.map(f => {
            const isActive = statusFilter === f.value;
            const sm = STATUS_META[f.value] || { dotClass: "bg-primary" };
            return (
              <button key={f.value} onClick={() => setStatusFilter(f.value)} className={cn(
                "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                isActive ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/10"
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? (f.value === "all" ? "bg-primary" : sm.dotClass) : "bg-muted-foreground/15")} />
                {f.label}
                <span className="text-[10px] tabular-nums opacity-50">{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] text-muted-foreground/40">{sortedFiltered.length === 0 ? "Nenhuma transação" : `${Math.min(visibleCount, sortedFiltered.length)} de ${sortedFiltered.length}`}</p>
        {sortedFiltered.length > 0 && !privacyHidden && <p className="text-[11px] text-primary/70 font-medium tabular-nums">{fmt(sortedFiltered.reduce((a, t) => a + Number(t.net_amount), 0))}</p>}
      </div>

      {/* ═══ DESKTOP TABLE ═══ */}
      <div className="hidden md:block rounded-xl border border-border/25 bg-card/70 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[12px] text-muted-foreground/40">Carregando…</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20">
                    <SortableHeader label="Cliente" field="customer" currentSort={sort} onSort={handleSort} />
                    <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Produto</th>
                    <SortableHeader label="Valor" field="amount" currentSort={sort} onSort={handleSort} />
                    <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Método</th>
                    <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Status</th>
                    <SortableHeader label="Data" field="date" currentSort={sort} onSort={handleSort} />
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr><td colSpan={7}><EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="Nenhuma venda encontrada" subtitle="Ajuste filtros ou período" /></td></tr>
                  ) : visibleItems.map((tx, i) => (
                    <TxRow key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
            {visibleCount < sortedFiltered.length && (
              <div className="p-2.5 text-center border-t border-border/15">
                <Button variant="ghost" size="sm" onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="gap-1.5 text-[11px] text-muted-foreground/50 hover:text-foreground font-medium">
                  <ChevronDown className="h-3 w-3" /> Mais {sortedFiltered.length - visibleCount} transações
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ MOBILE CARDS ═══ */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="p-12 text-center"><div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2" /><p className="text-[12px] text-muted-foreground/40">Carregando…</p></div>
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="Nenhuma venda" subtitle="Ajuste filtros" />
        ) : (
          <>
            {visibleItems.map((tx, i) => <TxCard key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />)}
            {visibleCount < sortedFiltered.length && (
              <Button variant="ghost" size="sm" onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="w-full gap-1.5 text-[11px] text-muted-foreground/50 font-medium">
                <ChevronDown className="h-3 w-3" /> Mais {sortedFiltered.length - visibleCount}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
      <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} productsRaw={productsRaw} onExport={handleExportCSV} />
    </div>
  );
}
