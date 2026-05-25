import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions, useProducts, useWithdrawals } from "@/hooks/useQueryData";
import {
  Search, X, EyeOff, Eye, Phone, Mail, Clock, RefreshCw,
  Download, FileText, ChevronDown, ChevronUp, ArrowUpDown, ArrowUpRight, ArrowDownRight,
  CreditCard, MoreHorizontal, CalendarDays, MessageCircle,
  AlertTriangle, ShieldAlert, Receipt, Rows3, Rows4, Copy, Percent,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
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
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { LineChart, Line, ResponsiveContainer } from "recharts";

/* ─────────────────────── Helpers ─────────────────────── */
function PixLogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="538 29 73 73" fill="none" aria-hidden="true" className={cn("select-none", className)} style={{ color: "hsl(173 58% 47%)" }}>
      <path d="m 596.82737,86.620206 c -3.08045,0 -5.97782,-1.19944 -8.15622,-3.37679 l -11.77678,-11.77713 c -0.82691,-0.82903 -2.26801,-0.82656 -3.09456,0 l -11.81982,11.82017 c -2.17841,2.17734 -5.07577,3.37679 -8.15623,3.37679 h -2.32092 l 14.9158,14.915444 c 4.65807,4.65808 12.21069,4.65808 16.86912,0 l 14.95813,-14.958484 z" fill="currentColor" />
      <path d="m 553.82398,44.565556 c 3.08046,0 5.97782,1.19945 8.15623,3.37679 l 11.81981,11.81982 c 0.82691,0.82691 2.26766,0.82691 3.09457,0 l 11.77677,-11.77678 c 2.17841,-2.17734 5.07577,-3.37678 8.15622,-3.37678 h 2.27859 l -14.91545,-14.91545 c -4.65843,-4.65843 -12.21069,-4.65843 -16.86912,0 l -14.9158,14.91545 z" fill="currentColor" />
      <path d="m 609.05953,47.875036 h -2.23272 c -1.52542,0 -3.04195,0.62759 -4.14374,1.73009 l -11.77678,11.77713 c -2.64724,2.64688 -6.95364,2.64688 -9.60088,0 l -11.81981,-11.82017 c -1.10214,-1.10215 -2.61867,-1.72975 -4.14375,-1.72975 h -2.27577 l 15.00244,15.00244 c 0.82692,0.82726 0.82692,2.26801 0,3.09492 l -15.00244,15.00244 h 2.27577 c 1.52508,0 3.04161,-0.6276 4.14375,-1.72974 l 11.82016,-11.82017 c 2.64689,-2.64689 6.95329,-2.64689 9.60053,0 l 11.77678,11.77712 c 1.10179,1.1025 2.61832,1.7301 4.14374,1.7301 h 2.23272 l -15.04547,-15.04548 c -0.82727,-0.82691 -0.82727,-2.26766 0,-3.09457 z" fill="currentColor" />
    </svg>
  );
}

const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

type StatusFilter = "all" | "completed" | "pending" | "refunded" | "chargeback";
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
  "bg-primary/10 text-primary",
  "bg-info/10 text-info",
  "bg-warning/10 text-warning",
  "bg-success/10 text-success",
  "bg-muted text-foreground",
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
  completed: { label: "Aprovada", fg: "text-success", dot: "bg-success", bg: "bg-success/10", border: "border-success/25" },
  pending: { label: "Pendente", fg: "text-warning", dot: "bg-warning", bg: "bg-warning/10", border: "border-warning/25" },
  failed: { label: "Falha", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/10", border: "border-destructive/25" },
  expired: { label: "Expirada", fg: "text-muted-foreground", dot: "bg-muted-foreground/50", bg: "bg-muted", border: "border-border" },
  refunded: { label: "Reembolso", fg: "text-info", dot: "bg-info", bg: "bg-info/10", border: "border-info/25" },
  chargeback: { label: "Chargeback", fg: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/10", border: "border-destructive/25" },
};

const METHODS: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  pix: { label: "Pix", icon: PixLogoMark, color: "text-success", bg: "bg-success/10", border: "border-success/25" },
  credit_card: { label: "Cartão", icon: CreditCard, color: "text-info", bg: "bg-info/10", border: "border-info/25" },
  card: { label: "Cartão", icon: CreditCard, color: "text-info", bg: "bg-info/10", border: "border-info/25" },
  boleto: { label: "Boleto", icon: FileText, color: "text-warning", bg: "bg-warning/10", border: "border-warning/25" },
};

/* ─────────────────────── Micro Components ─────────────────────── */
function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) {
    return <span className="text-[10px] font-bold text-success bg-success/10 border border-success/25 px-1.5 py-0.5 rounded">novo</span>;
  }
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded border",
      up ? "text-success bg-success/10 border-success/25" : "text-destructive bg-destructive/10 border-destructive/25")}>
      {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function Sparkline({ points, color = "hsl(var(--success))" }: { points: number[]; color?: string }) {
  if (!points || points.length < 2) return <div className="h-7 w-full" />;
  const data = points.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={28}>
      <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-background px-1 font-mono text-[10px] font-semibold text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]", className)}>
      {children}
    </kbd>
  );
}

function SortHead({ label, field, sort, onSort, align = "left", className }: { label: string; field: SortField; sort: { field: SortField; dir: SortDir }; onSort: (f: SortField) => void; align?: "left" | "right"; className?: string }) {
  const active = sort.field === field;
  return (
    <th onClick={() => onSort(field)} className={cn("py-3 px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors group", align === "right" ? "text-right" : "text-left", className)}>
      <span className={cn("inline-flex items-center gap-1", align === "right" && "justify-end")}>
        {label}
        {active
          ? (sort.dir === "desc" ? <ChevronDown className="h-3 w-3 text-foreground" /> : <ChevronUp className="h-3 w-3 text-foreground" />)
          : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
      </span>
    </th>
  );
}

/* ─── Desktop Row ─── */
function TxRow({ tx, prods, onClick, density = "comfortable" }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; density?: "compact" | "comfortable" }) {
  const method = METHODS[tx.payment_method || ""] || { label: tx.payment_method || "—", icon: FileText, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" };
  const MethodIcon = method.icon;
  const name = tx.customer_name || "Cliente";
  const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground/50", bg: "bg-muted", border: "border-border" };
  const prodName = tx.product_id ? (prods[tx.product_id] || "Produto sem nome") : "Sem produto";
  const fee = Number(tx.fee_amount);
  const net = Number(tx.net_amount);
  const gross = Number(tx.amount);

  const py = density === "compact" ? "py-2" : "py-3.5";
  const avatarSize = density === "compact" ? "h-8 w-8" : "h-9 w-9";
  return (
    <tr onClick={onClick} className="group cursor-pointer border-b border-border/60 transition-colors duration-150 hover:bg-muted/30 last:border-b-0">
      <td className={cn("pl-5 pr-3 align-middle", py)}>
        <div className="flex items-center gap-3">
          <Avatar className={cn(avatarSize, "shrink-0 rounded-md ring-1 ring-border/40")}>
            <AvatarFallback className={cn("rounded-md text-[11px] font-black tracking-[-0.01em]", avatarColor(name))}>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold tracking-[-0.01em] text-foreground leading-tight">{name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {tx.customer_email && <p className="truncate text-[11px] text-muted-foreground/85 max-w-[180px]">{tx.customer_email}</p>}
              {tx.customer_phone && (
                <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-success transition-colors hover:text-success/80">
                  <MessageCircle className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className={cn("px-3 align-middle", py)}>
        <p className="truncate text-[12px] font-semibold text-foreground/95 max-w-[180px]">{prodName}</p>
        <p className="text-[11px] text-muted-foreground/80 mt-0.5 tabular-nums">{fmtDate(tx.created_at)} · {fmtTime(tx.created_at)}</p>
      </td>
      <td className={cn("px-3 align-middle", py)}>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-[-0.005em]", st.fg, st.bg, st.border)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
          {st.label}
        </span>
      </td>
      <td className={cn("px-3 align-middle", py)}>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-[-0.005em]", method.color, method.bg, method.border)}>
          <MethodIcon className="h-3 w-3" />
          {method.label}
        </span>
      </td>
      <td className={cn("px-3 align-middle text-right", py)}>
        <p className="text-[13px] font-bold text-foreground tabular-nums tracking-[-0.01em]" style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}>{fmt(gross)}</p>
        {fee > 0 && <p className="text-[10px] text-muted-foreground/80 tabular-nums mt-0.5">−{fmt(fee)} taxa</p>}
      </td>
      <td className={cn("px-4 align-middle text-right", py)}>
        <p className={cn("text-[14px] font-black tabular-nums tracking-[-0.015em]",
          tx.status === "completed" ? "text-success" : tx.status === "pending" ? "text-warning" : "text-foreground/60"
        )} style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}>{fmt(net)}</p>
      </td>
      <td className={cn("pr-3 align-middle w-12", py)}>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-lg border-border bg-popover p-1">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[12px] font-medium rounded-md py-1.5"><Eye className="h-3.5 w-3.5" /> Ver detalhes</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.id); toast.success("ID copiado"); }} className="gap-2 text-[12px] font-medium rounded-md py-1.5"><Copy className="h-3.5 w-3.5" /> Copiar ID</DropdownMenuItem>
              {tx.customer_phone && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_phone!); toast.success("Telefone copiado"); }} className="gap-2 text-[12px] font-medium rounded-md py-1.5"><Phone className="h-3.5 w-3.5" /> Copiar telefone</DropdownMenuItem>}
              {tx.customer_email && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.customer_email!); toast.success("Email copiado"); }} className="gap-2 text-[12px] font-medium rounded-md py-1.5"><Mail className="h-3.5 w-3.5" /> Copiar email</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

/* ─── Mobile Card ─── */
function MobileCard({ tx, prods, onClick }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void }) {
  const name = tx.customer_name || "Cliente";
  const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground/50", bg: "bg-muted", border: "border-border" };
  const method = METHODS[tx.payment_method || ""] || { label: tx.payment_method || "—", icon: FileText, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" };
  const MethodIcon = method.icon;
  const prodName = tx.product_id ? prods[tx.product_id] || "Produto sem nome" : "Sem produto";
  const net = Number(tx.net_amount);

  return (
    <div className="cursor-pointer border-b border-border bg-card p-3.5 transition-colors active:bg-muted/30" onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="h-10 w-10 shrink-0 rounded-md">
            <AvatarFallback className={cn("rounded-md text-[11px] font-bold", avatarColor(name))}>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">{name}</p>
            <p className="truncate text-[11px] text-muted-foreground mt-0.5">{prodName}</p>
          </div>
        </div>
        <p className={cn("text-[16px] font-bold tabular-nums shrink-0",
          tx.status === "completed" ? "text-success" : tx.status === "pending" ? "text-warning" : "text-foreground/60"
        )}>{fmt(net)}</p>
      </div>
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5">
          <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold", st.fg, st.bg, st.border)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />{st.label}
          </span>
          <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold", method.color, method.bg, method.border)}>
            <MethodIcon className="h-2.5 w-2.5" />{method.label}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground tabular-nums">{fmtDate(tx.created_at)}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN PAGE */
/* ═══════════════════════════════════════════════════════════════════════ */

export default function Extrato() {
  const { user } = useAuth();
  const { data: transactions = [], isLoading: loading } = useTransactions();
  const { data: withdrawals = [] } = useWithdrawals();
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
  const [density, setDensity] = useState<"compact" | "comfortable">(() => { try { return (localStorage.getItem("extrato_density") as any) || "comfortable"; } catch { return "comfortable"; } });

  const toggleHidden = useCallback(() => {
    setHidden(p => { const n = !p; try { localStorage.setItem("privacy_mode", String(n)); } catch {} return n; });
  }, []);
  const toggleDensity = useCallback(() => {
    setDensity(p => { const n = p === "compact" ? "comfortable" : "compact"; try { localStorage.setItem("extrato_density", n); } catch {} return n; });
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
      const refunded = txs.filter(t => t.status === "refunded");
      const chargebacks = txs.filter(t => t.status === "chargeback");
      const totalNet = approved.reduce((a, t) => a + Number(t.net_amount), 0);
      const totalGross = approved.reduce((a, t) => a + Number(t.amount), 0);
      const totalFees = approved.reduce((a, t) => a + Number(t.fee_amount), 0);
      const avgTicket = approved.length > 0 ? totalGross / approved.length : 0;
      const uniqueCustomers = new Set(approved.map(t => t.customer_email).filter(Boolean)).size;
      const refundedAmount = refunded.reduce((a, t) => a + Number(t.amount), 0);
      const chargebackAmount = chargebacks.reduce((a, t) => a + Number(t.amount), 0);
      const feeRate = totalGross > 0 ? (totalFees / totalGross) * 100 : 0;
      return { approved, refunded, chargebacks, totalNet, totalGross, totalFees, avgTicket, uniqueCustomers, refundedAmount, chargebackAmount, feeRate };
    };
    const current = calc(dateFiltered);
    const previous = calc(previousPeriodFiltered);

    // sparkline series (daily)
    const dailyNetMap: Record<string, number> = {};
    const dailyCountMap: Record<string, number> = {};
    const dailyFeeMap: Record<string, number> = {};
    for (const t of current.approved) {
      const day = fmtDate(t.created_at);
      dailyNetMap[day] = (dailyNetMap[day] || 0) + Number(t.net_amount);
      dailyCountMap[day] = (dailyCountMap[day] || 0) + 1;
      dailyFeeMap[day] = (dailyFeeMap[day] || 0) + Number(t.fee_amount);
    }
    const days = Object.keys(dailyNetMap).reverse();
    const series = {
      net: days.map(d => dailyNetMap[d]),
      count: days.map(d => dailyCountMap[d]),
      fee: days.map(d => dailyFeeMap[d]),
      ticket: days.map(d => (dailyCountMap[d] ? dailyNetMap[d] / dailyCountMap[d] : 0)),
    };

    const lastSaleAt = current.approved.length > 0
      ? current.approved.reduce((latest, t) => (new Date(t.created_at) > new Date(latest) ? t.created_at : latest), current.approved[0].created_at)
      : null;

    return { current, previous, series, lastSaleAt };
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
    const c: Record<string, number> = { all: dateFiltered.length, completed: 0, pending: 0, refunded: 0, chargeback: 0 };
    for (const t of dateFiltered) { if (t.status in c) c[t.status]++; }
    return [
      { label: "Todas", value: "all" as StatusFilter, count: c.all, dot: "" },
      { label: "Aprovadas", value: "completed" as StatusFilter, count: c.completed, dot: "bg-success" },
      { label: "Pendentes", value: "pending" as StatusFilter, count: c.pending, dot: "bg-warning" },
      { label: "Reembolsos", value: "refunded" as StatusFilter, count: c.refunded, dot: "bg-info" },
      { label: "Chargebacks", value: "chargeback" as StatusFilter, count: c.chargeback, dot: "bg-destructive" },
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
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || (target as any).isContentEditable);
      if (e.key === "/" && !inField) { e.preventDefault(); document.getElementById("extrato-search")?.focus(); return; }
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "e") { e.preventDefault(); handleExportCSV(); }
      else if (k === "r") { e.preventDefault(); window.location.reload(); }
      else if (k === "p") { e.preventDefault(); toggleHidden(); }
      else if (k === "d") { e.preventDefault(); toggleDensity(); }
      else if (e.key === "1") setStatusFilter("all");
      else if (e.key === "2") setStatusFilter("completed");
      else if (e.key === "3") setStatusFilter("pending");
      else if (e.key === "4") setStatusFilter("refunded");
      else if (e.key === "5") setStatusFilter("chargeback");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleHidden, toggleDensity, handleExportCSV]);

  const [availableBalance, setAvailableBalance] = useState<number>(0);

  useEffect(() => {
    if (!user?.id) return;
    const fetchBalance = async () => {
      const { data, error } = await supabase.rpc("get_ledger_balance", { _user_id: user.id });
      if (!error && data !== null) setAvailableBalance(Number(data));
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const m = metrics.current;
  const p = metrics.previous;
  const lastSaleText = metrics.lastSaleAt ? formatDistanceToNow(new Date(metrics.lastSaleAt), { locale: ptBR, addSuffix: true }) : null;

  const filteredNetTotal = sortedFiltered.reduce((acc, tx) => acc + Number(tx.net_amount), 0);
  const periodLabel = isCustom
    ? customRange?.from
      ? customRange?.to
        ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}`
        : format(customRange.from, "dd/MM/yyyy")
      : "Personalizado"
    : selectedPeriod.label;
  const animKey = isCustom
    ? `custom-${customRange?.from?.getTime() ?? 0}-${customRange?.to?.getTime() ?? 0}`
    : `p-${selectedPeriod.label}`;

  const approvalRate = dateFiltered.length > 0 ? (m.approved.length / dateFiltered.length) * 100 : 0;
  const refundRate = m.approved.length > 0 ? (m.refunded.length / m.approved.length) * 100 : 0;
  const chargebackRate = m.approved.length > 0 ? (m.chargebacks.length / m.approved.length) * 100 : 0;

  const heroKpis = [
    { label: "Saldo disponível", value: hidden ? HIDE : fmtCompact(availableBalance), sub: "Valor para saque", accent: "text-primary", spark: metrics.series.net, sparkColor: "hsl(var(--primary))", delta: undefined },
    { label: "Receita líquida", value: hidden ? HIDE : fmtCompact(m.totalNet), sub: hidden ? "—" : `Bruto ${fmtCompact(m.totalGross)}`, accent: "text-success", spark: metrics.series.net, sparkColor: "hsl(var(--success))", delta: { cur: m.totalNet, prev: p.totalNet } },
    { label: "Ticket médio", value: hidden ? HIDE : fmtCompact(m.avgTicket), sub: `${m.uniqueCustomers} ${m.uniqueCustomers === 1 ? "cliente" : "clientes"}`, accent: "text-foreground", spark: metrics.series.ticket, sparkColor: "hsl(var(--foreground))", delta: { cur: m.avgTicket, prev: p.avgTicket } },
    { label: "Aprovação", value: `${approvalRate.toFixed(1)}%`, sub: `${dateFiltered.length} tentativas`, accent: approvalRate >= 60 ? "text-success" : "text-warning", spark: metrics.series.count, sparkColor: approvalRate >= 60 ? "hsl(var(--success))" : "hsl(var(--warning))", delta: undefined },
  ];

  const riskKpis = [
    { label: "Taxas", value: hidden ? HIDE : fmtCompact(m.totalFees), sub: m.totalGross > 0 ? `${m.feeRate.toFixed(2)}% sobre o bruto` : "sem volume", accent: "text-muted-foreground", icon: Percent },
    { label: "Reembolsos", value: hidden ? HIDE : fmtCompact(m.refundedAmount), sub: `${m.refunded.length} casos · ${refundRate.toFixed(1)}%`, accent: refundRate > 5 ? "text-destructive" : "text-muted-foreground", icon: AlertTriangle },
    { label: "MED", value: hidden ? HIDE : fmt(0), sub: `0 casos · 0,00%`, accent: "text-muted-foreground", icon: ShieldAlert },
    { label: "Chargebacks", value: hidden ? HIDE : fmtCompact(m.chargebackAmount), sub: `${m.chargebacks.length} casos · ${chargebackRate.toFixed(2)}%`, accent: m.chargebacks.length > 0 ? "text-destructive" : "text-muted-foreground", icon: ShieldAlert },
  ];

  /* ═══════════ RENDER ═══════════ */
  return (
    <div
      className="mx-auto w-full max-w-[1480px] pb-24 md:pb-10 antialiased [text-rendering:geometricPrecision] [-webkit-font-smoothing:antialiased] [-moz-osx-font-smoothing:grayscale]"
      style={{ fontFeatureSettings: '"ss01","cv11","tnum","kern"' }}
    >

      {/* ─────────── HEADER ─────────── */}
      <div className="px-5 pt-4 sm:px-8 sm:pt-6">
        <header className="border-b border-border/70 pb-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.26em] text-muted-foreground/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                Live financial ledger
              </div>
              <h1 className="mt-2.5 font-display text-[34px] font-black leading-[0.95] tracking-[-0.045em] text-foreground sm:text-[46px]">
                Extrato
              </h1>
              <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
                <p
                  key={`hero-ext-${animKey}`}
                  className={cn(
                    "vendas-rise font-numbers text-[42px] font-black leading-[0.88] tracking-[-0.06em] tabular-nums sm:text-[60px]",
                    hidden ? "text-foreground" : "text-success",
                  )}
                  style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                >
                  {hidden ? HIDE : fmt(m.totalNet)}
                </p>
                <div className="pb-1.5">
                  <p className="text-[12px] font-bold tracking-[-0.005em] text-foreground">Receita líquida no período</p>
                  <p className="mt-1 text-[11.5px] font-medium text-muted-foreground/85">
                    <span className="font-bold text-foreground">{periodLabel}</span>
                    <span className="mx-1.5 inline-block h-[3px] w-[3px] -translate-y-[3px] rounded-full bg-muted-foreground/40 align-middle" />
                    {dateFiltered.length} {dateFiltered.length === 1 ? "transação" : "transações"}
                    {lastSaleText && (
                      <>
                        <span className="mx-1.5 inline-block h-[3px] w-[3px] -translate-y-[3px] rounded-full bg-muted-foreground/40 align-middle" />
                        última {lastSaleText}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <TooltipProvider delayDuration={250}>
              <div className="flex w-full flex-wrap items-center gap-1.5 xl:w-auto xl:justify-end">
                <div className="hidden items-center rounded-md border border-border/70 bg-card/60 p-0.5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.02)] backdrop-blur-sm md:inline-flex">
                  {PERIODS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                      className={cn(
                        "rounded-[5px] px-2.5 py-1 text-[11px] font-bold tracking-[-0.005em] transition-all duration-200",
                        !isCustom && selectedPeriod.label === opt.label
                          ? "bg-foreground text-background shadow-[0_1px_2px_hsl(var(--foreground)/0.18)]"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <Tooltip>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                          isCustom ? "border-foreground bg-secondary text-foreground" : "border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground")}>
                          <CalendarDays className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <PopoverContent align="end" className="w-auto overflow-hidden rounded-lg border border-border bg-popover p-0 shadow-lg">
                      <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="pointer-events-auto p-3" />
                    </PopoverContent>
                  </Popover>
                  <TooltipContent side="bottom" className="flex items-center gap-2">Período personalizado</TooltipContent>
                </Tooltip>

                <span className="hidden h-5 w-px bg-border/70 md:block" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={toggleDensity} className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                      density === "compact" ? "border-foreground bg-secondary text-foreground" : "border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground")}>
                      {density === "compact" ? <Rows4 className="h-3.5 w-3.5" /> : <Rows3 className="h-3.5 w-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="flex items-center gap-2">Densidade <Kbd>D</Kbd></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => window.location.reload()} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-card/60 text-muted-foreground transition-all duration-200 hover:border-border hover:bg-muted/60 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="flex items-center gap-2">Atualizar <Kbd>R</Kbd></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={toggleHidden} className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                      hidden ? "border-foreground bg-secondary text-foreground" : "border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground")}>
                      {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="flex items-center gap-2">{hidden ? "Mostrar valores" : "Ocultar valores"} <Kbd>P</Kbd></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleExportCSV}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[11px] font-black tracking-[-0.005em] text-background shadow-[0_1px_2px_hsl(var(--foreground)/0.25),inset_0_1px_0_hsl(var(--background)/0.18)] transition-all duration-200 hover:bg-foreground/90 hover:shadow-[0_2px_6px_hsl(var(--foreground)/0.28),inset_0_1px_0_hsl(var(--background)/0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Exportar
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="flex items-center gap-2">Exportar CSV <Kbd>E</Kbd></TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          {/* KPI grid */}
          <div className="mt-7 grid grid-cols-2 border-y border-border/70 lg:grid-cols-4 lg:divide-x lg:divide-border/70">
            {heroKpis.map((k, idx) => (
              <div
                key={`${k.label}-${animKey}`}
                className={cn(
                  "vendas-rise group relative min-h-[130px] px-5 py-5 transition-colors duration-200 hover:bg-muted/25",
                  idx === 1 && "vendas-rise-d1",
                  idx === 2 && "vendas-rise-d2",
                  idx === 3 && "vendas-rise-d3",
                  idx > 1 && "border-t border-border/70 lg:border-t-0",
                  idx === 1 && "border-l border-border/70 lg:border-l-0",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground/85">{k.label}</p>
                  {k.delta && <DeltaBadge cur={k.delta.cur} prev={k.delta.prev} />}
                </div>
                <p
                  className={cn(
                    "mt-3 font-numbers text-[28px] font-black leading-[0.95] tracking-[-0.055em] tabular-nums sm:text-[36px]",
                    k.accent,
                  )}
                  style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                >
                  {k.value}
                </p>
                <p className="mt-2.5 truncate text-[11.5px] font-semibold text-muted-foreground/80">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Risk row */}
          <div className="grid grid-cols-2 border-b border-border/70 sm:grid-cols-4 sm:divide-x sm:divide-border/70">
            {riskKpis.map((r, idx) => {
              const Icon = r.icon;
              return (
                <div key={r.label} className={cn("group flex items-center gap-3 px-5 py-3.5 transition-colors duration-200 hover:bg-muted/25", idx >= 2 && "border-t border-border/70 sm:border-t-0")}>
                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/40", r.accent)}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground/85">{r.label}</p>
                      <p
                        className={cn("font-numbers text-[15px] font-black leading-none tabular-nums tracking-[-0.02em]", r.accent)}
                        style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                      >
                        {r.value}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground/80">{r.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </header>

        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto md:hidden">
          {PERIODS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
              className={cn(
                "shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-bold tracking-[-0.005em] transition-all",
                !isCustom && selectedPeriod.label === opt.label
                  ? "border-foreground bg-foreground text-background shadow-[0_1px_2px_hsl(var(--foreground)/0.18)]"
                  : "border-border/70 bg-card/60 text-muted-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─────────── WORKSPACE ─────────── */}
      <div className="space-y-5 px-5 pt-6 sm:px-8">

        {/* ─────────── TRANSACTIONS ─────────── */}
        <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_0_hsl(var(--foreground)/0.02),0_1px_2px_hsl(var(--foreground)/0.03)]">
          <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] font-black leading-tight tracking-[-0.01em] text-foreground">Transações</p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/85">
                {sortedFiltered.length} {sortedFiltered.length === 1 ? "resultado" : "resultados"}
                <span className="mx-1.5 inline-block h-[3px] w-[3px] -translate-y-[3px] rounded-full bg-muted-foreground/40 align-middle" />
                líquido <span className="font-numbers font-black tabular-nums text-foreground">{hidden ? HIDE : fmt(filteredNetTotal)}</span>
              </p>
            </div>
            <div className="relative w-full sm:w-[340px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
              <input
                id="extrato-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, email, telefone, ID…"
                className="h-8 w-full rounded-md border border-border/70 bg-background pl-8 pr-16 text-[12px] font-medium text-foreground transition-all duration-200 placeholder:text-muted-foreground/70 hover:border-border focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10"
              />
              {search ? (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</Kbd>
              )}
            </div>
          </div>

          {/* Status pills */}
          <div className="flex gap-1 overflow-x-auto border-b border-border/70 px-5 py-2.5">
            {statusTabs.map((tab, i) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold tracking-[-0.005em] transition-all duration-200",
                    active
                      ? "border-foreground bg-foreground text-background shadow-[0_1px_2px_hsl(var(--foreground)/0.18)]"
                      : "border-border/70 bg-card/60 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {tab.dot && <span className={cn("h-1.5 w-1.5 rounded-full", tab.dot)} />}
                  {tab.label}
                  <span className={cn("rounded-sm px-1 py-0 text-[9.5px] font-black tabular-nums",
                    active ? "bg-background/20 text-background" : "bg-muted/60 text-muted-foreground")}>
                    {tab.count}
                  </span>
                  <Kbd className="ml-0.5 hidden md:inline-flex">{i + 1}</Kbd>
                </button>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            {loading ? (
              <div className="px-5 py-20 text-center">
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
                <p className="text-[11px] font-medium text-muted-foreground">Carregando transações…</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/70 bg-muted/20">
                        <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} className="pl-5" />
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Produto · Data</th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Status</th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Método</th>
                        <SortHead label="Bruto" field="amount" sort={sort} onSort={handleSort} align="right" />
                        <SortHead label="Líquido" field="net" sort={sort} onSort={handleSort} align="right" className="pr-4" />
                        <th className="w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-20">
                            <div className="flex flex-col items-center justify-center">
                              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted/40">
                                <Receipt className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <p className="text-[12px] font-bold text-foreground">Nenhuma transação encontrada</p>
                              <p className="mt-1 text-[11px] font-medium text-muted-foreground">Ajuste os filtros ou selecione outro período</p>
                            </div>
                          </td>
                        </tr>
                      ) : visibleItems.map((tx) => (
                        <TxRow key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} density={density} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleCount < sortedFiltered.length && (
                  <div className="border-t border-border/70 bg-muted/10 px-5 py-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="gap-1.5 rounded-md text-[11px] font-bold text-muted-foreground hover:text-foreground">
                      <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({sortedFiltered.length - visibleCount})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {loading ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
                <p className="text-[11px] font-medium text-muted-foreground">Carregando…</p>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-16">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted/40">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-[12px] font-bold text-foreground">Nenhuma transação</p>
              </div>
            ) : (
              <>
                {visibleItems.map((tx) => (
                  <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} />
                ))}
                {visibleCount < sortedFiltered.length && (
                  <div className="border-t border-border bg-muted/10 px-5 py-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="w-full gap-1.5 rounded-md text-[11px] font-bold text-muted-foreground hover:text-foreground">
                      <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({sortedFiltered.length - visibleCount})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
    </div>
  );
}
