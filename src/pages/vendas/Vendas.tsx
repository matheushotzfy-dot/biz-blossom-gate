import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
  Search, X, EyeOff, Eye, Phone, Mail, Clock, RefreshCw, Check,
  Download, FileText, ChevronDown, ChevronUp, ArrowUpDown, ArrowUpRight, ArrowDownRight,
  CreditCard, ShoppingCart, MoreHorizontal, CheckSquare, Square, CalendarDays, MessageCircle,
  AlertTriangle, ShieldAlert, Command as CommandIcon, Rows3, Rows4, Copy, Filter, Zap,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { AreaChart, Area, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";

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
const fmtHour = (d: string) => { const h = new Date(d).getHours(); return `${h.toString().padStart(2, "0")}h`; };

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

/* ─── Revenue Chart ─── */
function RevenueChart({ data, hidden }: { data: { label: string; value: number; previous: number }[]; hidden: boolean }) {
  if (data.length < 2 || hidden) {
    return (
      <div className="h-[260px] flex items-center justify-center">
        <span className="text-[11px] text-muted-foreground font-medium">{hidden ? "Valores ocultos" : "Sem dados suficientes"}</span>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="rv-clean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.18} />
            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={10} interval="preserveStartEnd" />
        <YAxis width={52} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={8} tickFormatter={(v: number) => v >= 1000 ? `R$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `R$${v}`} />
        <ReTooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11, padding: "8px 10px" }}
          formatter={(v: number, name: string) => [fmt(v), name === "value" ? "Atual" : "Anterior"]}
          labelStyle={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginBottom: 4, fontWeight: 600 }}
          cursor={{ stroke: "hsl(var(--success))", strokeWidth: 1, strokeDasharray: "3 3", strokeOpacity: 0.5 }}
        />
        <Area type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" fill="none" opacity={0.5} dot={false} />
        <Area type="monotone" dataKey="value" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#rv-clean)" dot={false} activeDot={{ r: 4, stroke: "hsl(var(--success))", strokeWidth: 2, fill: "hsl(var(--card))" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Method config ─── */
const METHODS: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  pix: { label: "Pix", icon: PixLogoMark, color: "text-success", bg: "bg-success/10", border: "border-success/25" },
  credit_card: { label: "Cartão", icon: CreditCard, color: "text-info", bg: "bg-info/10", border: "border-info/25" },
  card: { label: "Cartão", icon: CreditCard, color: "text-info", bg: "bg-info/10", border: "border-info/25" },
  boleto: { label: "Boleto", icon: FileText, color: "text-warning", bg: "bg-warning/10", border: "border-warning/25" },
};

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
              {tx.status === "completed" && <><DropdownMenuSeparator className="my-1" /><DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Entre em contato com o suporte."); }} className="gap-2 text-[12px] font-medium text-destructive focus:text-destructive rounded-md py-1.5"><RefreshCw className="h-3.5 w-3.5" /> Reembolsar</DropdownMenuItem></>}
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
  { value: "pix", label: "PIX", icon: PixLogoMark },
  { value: "credit_card", label: "Cartão", icon: CreditCard },
  { value: "boleto", label: "Boleto", icon: FileText },
];

function ExportDialog({ open, onOpenChange, transactions, products, onExport }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  transactions: Tables<"transactions">[]; products: Record<string, string>;
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
    if (t.payment_method && !(selectedMethods.has(t.payment_method) || (t.payment_method === "card" && selectedMethods.has("credit_card")))) return false;
    if (!selectedProducts.has("all") && t.product_id && !selectedProducts.has(t.product_id)) return false;
    return true;
  }), [transactions, selectedStatuses, selectedMethods, selectedProducts]);
  const txProducts = useMemo(() => {
    const ids = new Set(transactions.map(t => t.product_id).filter(Boolean) as string[]);
    return Array.from(ids).map(id => ({ id, name: products[id] || id.slice(0, 8) }));
  }, [transactions, products]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-card rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold"><Download className="h-4 w-4" /> Exportar Vendas</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">Configure os filtros de exportação</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</p>
              <div className="flex gap-2.5 text-[10px]">
                <button onClick={() => setSelectedStatuses(new Set())} className="text-muted-foreground hover:text-foreground transition-colors">Limpar</button>
                <button onClick={() => setSelectedStatuses(new Set(ALL_STATUSES.map(s => s.value)))} className="text-foreground font-bold">Todos</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => (
                <button key={s.value} onClick={() => toggleStatus(s.value)} className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors border", selectedStatuses.has(s.value) ? "border-foreground/30 bg-muted text-foreground" : "border-border text-muted-foreground hover:border-foreground/20")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", selectedStatuses.has(s.value) ? s.dot : "bg-muted-foreground/30")} />{s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Método</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_METHODS.map(m => {
                const Icon = m.icon;
                return (
                  <button key={m.value} onClick={() => toggleMethod(m.value)} className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors border", selectedMethods.has(m.value) ? "border-foreground/30 bg-muted text-foreground" : "border-border text-muted-foreground hover:border-foreground/20")}>
                    <Icon className="h-3 w-3" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          {txProducts.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Produtos</p>
              <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                <button onClick={() => toggleProduct("all")} className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-left transition-colors", selectedProducts.has("all") ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:bg-muted/50")}>
                  {selectedProducts.has("all") ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />} Todos
                </button>
                {txProducts.map(p => (
                  <button key={p.id} onClick={() => toggleProduct(p.id)} className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-left transition-colors", selectedProducts.has(p.id) ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:bg-muted/50")}>
                    {selectedProducts.has(p.id) ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />} <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-lg bg-muted/50 border border-border p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">{exportFiltered.length} transações</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">serão exportadas</p>
            </div>
            <p className="text-base font-bold text-foreground tabular-nums">{fmt(exportFiltered.reduce((a, t) => a + Number(t.net_amount), 0))}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-lg h-9 text-[12px] font-semibold">Cancelar</Button>
          <Button onClick={() => { onExport(exportFiltered); onOpenChange(false); }} disabled={exportFiltered.length === 0} className="flex-1 rounded-lg h-9 gap-1.5 text-[12px] font-bold">
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
  useAuth();
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
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(PERIODS[2]); // 7D default
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "date", dir: "desc" });
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; } });
  const [cmdOpen, setCmdOpen] = useState(false);
  const [density, setDensity] = useState<"compact" | "comfortable">(() => { try { return (localStorage.getItem("vendas_density") as "compact" | "comfortable") || "comfortable"; } catch { return "comfortable"; } });
  const toggleDensity = useCallback(() => {
    setDensity(p => { const n = p === "compact" ? "comfortable" : "compact"; try { localStorage.setItem("vendas_density", n); } catch {} return n; });
  }, []);

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
      const cardRev = approved.filter(t => t.payment_method === "credit_card" || t.payment_method === "card").reduce((a, t) => a + Number(t.net_amount), 0);
      const boletoRev = approved.filter(t => t.payment_method === "boleto").reduce((a, t) => a + Number(t.net_amount), 0);
      const pixCount = approved.filter(t => t.payment_method === "pix").length;
      const cardCount = approved.filter(t => t.payment_method === "credit_card" || t.payment_method === "card").length;
      const boletoCount = approved.filter(t => t.payment_method === "boleto").length;
      const uniqueCustomers = new Set(approved.map(t => t.customer_email).filter(Boolean)).size;
      const refundRate = approved.length > 0 ? (refunded.length / (approved.length + refunded.length)) * 100 : 0;
      const chargebackRate = approved.length > 0 ? (chargebacks.length / (approved.length + chargebacks.length)) * 100 : 0;
      return { approved, pending, refunded, chargebacks, failed, totalNet, totalGross, totalFees, avgTicket, conversion, pixRev, cardRev, boletoRev, pixCount, cardCount, boletoCount, uniqueCustomers, refundRate, chargebackRate };
    };
    const current = calc(dateFiltered);
    const previous = calc(previousPeriodFiltered);

    const dailyMap: Record<string, { net: number; count: number; ticket: number; pix: number; card: number; boleto: number; refunds: number; chargebacks: number; total: number }> = {};
    const prevDailyMap: Record<string, number> = {};
    for (const t of current.approved) {
      const day = fmtDate(t.created_at);
      const e = dailyMap[day] || (dailyMap[day] = { net: 0, count: 0, ticket: 0, pix: 0, card: 0, boleto: 0, refunds: 0, chargebacks: 0, total: 0 });
      e.net += Number(t.net_amount); e.count += 1;
      if (t.payment_method === "pix") e.pix += Number(t.net_amount);
      else if (t.payment_method === "credit_card" || t.payment_method === "card") e.card += Number(t.net_amount);
      else if (t.payment_method === "boleto") e.boleto += Number(t.net_amount);
    }
    for (const t of dateFiltered) { const day = fmtDate(t.created_at); const e = dailyMap[day] || (dailyMap[day] = { net: 0, count: 0, ticket: 0, pix: 0, card: 0, boleto: 0, refunds: 0, chargebacks: 0, total: 0 }); e.total += 1; if (t.status === "refunded") e.refunds += Number(t.amount); if (t.status === "chargeback") e.chargebacks += Number(t.amount); }
    for (const t of previous.approved) { const day = fmtDate(t.created_at); prevDailyMap[day] = (prevDailyMap[day] || 0) + Number(t.net_amount); }
    const dayKeys = Object.keys(dailyMap).reverse();
    const currentDays = dayKeys.map(label => ({ label, value: dailyMap[label].net }));
    const prevDays = Object.values(prevDailyMap);
    const chartData = currentDays.map((d, i) => ({ ...d, previous: prevDays[i] || 0 }));

    // Sparkline series per KPI
    const series = {
      net: dayKeys.map(k => dailyMap[k].net),
      count: dayKeys.map(k => dailyMap[k].count),
      ticket: dayKeys.map(k => dailyMap[k].count > 0 ? dailyMap[k].net / dailyMap[k].count : 0),
      approval: dayKeys.map(k => dailyMap[k].total > 0 ? (dailyMap[k].count / dailyMap[k].total) * 100 : 0),
      refunds: dayKeys.map(k => dailyMap[k].refunds),
      chargebacks: dayKeys.map(k => dailyMap[k].chargebacks),
    };

    const lastSaleAt = current.approved.length > 0 ? current.approved[0].created_at : null;
    return { current, previous, chartData, lastSaleAt, series };
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

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const visibleItems = useMemo(() => sortedFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [sortedFiltered, currentPage]);

  const statusTabs = useMemo(() => {
    const c: Record<string, number> = { all: dateFiltered.length, completed: 0, pending: 0, failed: 0, refunded: 0, chargeback: 0 };
    for (const t of dateFiltered) {
      if (t.status in c) c[t.status]++;
    }
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
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || (target as any).isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen(o => !o); return; }
      if (e.key === "/" && !inField) { e.preventDefault(); document.getElementById("vendas-search")?.focus(); return; }
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "e") { e.preventDefault(); setShowExportDialog(true); }
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
  }, [toggleHidden, toggleDensity]);

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

  const mixTotal = m.pixRev + m.cardRev + m.boletoRev;
  const mixRows = [
    { label: "PIX", value: m.pixRev, count: m.pixCount, dot: "bg-success", bar: "bg-success" },
    { label: "Cartão", value: m.cardRev, count: m.cardCount, dot: "bg-info", bar: "bg-info" },
    { label: "Boleto", value: m.boletoRev, count: m.boletoCount, dot: "bg-warning", bar: "bg-warning" },
  ].map(r => ({ ...r, share: mixTotal > 0 ? (r.value / mixTotal) * 100 : 0 }));

  const approvalRate = dateFiltered.length > 0 ? (m.approved.length / dateFiltered.length) * 100 : 0;
  const refundedAmount = m.refunded.reduce((acc, tx) => acc + Number(tx.amount), 0);
  const chargebackAmount = m.chargebacks.reduce((acc, tx) => acc + Number(tx.amount), 0);

  const heroKpis = [
    { label: "Receita líquida", value: hidden ? HIDE : fmtCompact(m.totalNet), sub: hidden ? "—" : `Bruto ${fmtCompact(m.totalGross)}`, accent: "text-success", spark: metrics.series.net, sparkColor: "hsl(var(--success))", delta: { cur: m.totalNet, prev: p.totalNet } },
    { label: "Vendas aprovadas", value: hidden ? HIDE : m.approved.length.toLocaleString("pt-BR"), sub: `${dateFiltered.length} tentativas`, accent: "text-foreground", spark: metrics.series.count, sparkColor: "hsl(var(--info))", delta: { cur: m.approved.length, prev: p.approved.length } },
    { label: "Ticket médio", value: hidden ? HIDE : fmtCompact(m.avgTicket), sub: `${m.uniqueCustomers} ${m.uniqueCustomers === 1 ? "cliente" : "clientes"}`, accent: "text-foreground", spark: metrics.series.ticket, sparkColor: "hsl(var(--foreground))", delta: { cur: m.avgTicket, prev: p.avgTicket } },
    { label: "Aprovação", value: `${approvalRate.toFixed(1)}%`, sub: `${m.pending.length} pendentes`, accent: approvalRate >= 60 ? "text-success" : "text-warning", spark: metrics.series.approval, sparkColor: approvalRate >= 60 ? "hsl(var(--success))" : "hsl(var(--warning))", delta: undefined as undefined | { cur: number; prev: number } },
  ];

  const riskKpis = [
    { label: "Reembolsos", value: hidden ? HIDE : fmtCompact(refundedAmount), count: m.refunded.length, rate: m.refundRate, accent: m.refundRate > 5 ? "text-destructive" : "text-foreground", tone: "info" as const, icon: AlertTriangle },
    { label: "MED", value: hidden ? HIDE : fmt(0), count: 0, rate: 0, accent: "text-foreground", tone: "warning" as const, icon: ShieldAlert },
    { label: "Chargebacks", value: hidden ? HIDE : fmtCompact(chargebackAmount), count: m.chargebacks.length, rate: m.chargebackRate, accent: m.chargebacks.length > 0 ? "text-destructive" : "text-foreground", tone: "destructive" as const, icon: ShieldAlert },
  ];

  /* ═══════════ RENDER ═══════════ */
  return (
    <div
      className="mx-auto w-full max-w-[1480px] pb-24 md:pb-10 antialiased [text-rendering:geometricPrecision] [-webkit-font-smoothing:antialiased] [-moz-osx-font-smoothing:grayscale]"
      style={{ fontFeatureSettings: '"ss01","cv11","tnum","kern"' }}
    >

      {/* ─────────── COMANDO LIMPO ─────────── */}
      <div className="px-5 pt-4 sm:px-8 sm:pt-6">
        <header className="border-b border-border/70 pb-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-[48px] font-black leading-[0.88] tracking-[-0.06em] text-foreground sm:text-[68px]">
                Vendas
              </h1>
              <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-2">
                <p
                  key={`hero-${animKey}`}
                  className={cn(
                    "vendas-rise font-display text-[58px] font-black leading-[0.84] tracking-[-0.075em] tabular-nums sm:text-[84px]",
                    hidden ? "text-foreground" : "text-success",
                  )}
                  style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                >
                  {hidden ? HIDE : fmt(m.totalNet)}
                </p>
                <div className="pb-1.5">
                  <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-[-0.005em] text-foreground">
                    <span className="inline-block h-2 w-[3px] rounded-full bg-success" />
                    Receita líquida no período
                  </p>
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
              <div className="flex w-full flex-wrap items-center gap-1 xl:w-auto xl:justify-end">
                <div className="hidden items-center rounded-lg border border-border/60 bg-card p-[3px] md:inline-flex">
                  {PERIODS.map((opt) => {
                    const active = !isCustom && selectedPeriod.label === opt.label;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                        className={cn(
                          "relative rounded-[6px] px-2.5 py-[5px] text-[11px] font-bold tracking-[-0.005em] transition-all duration-200",
                          active
                            ? "bg-success/15 text-success ring-1 ring-success/30"
                            : "text-muted-foreground/90 hover:text-foreground",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <span className="hidden h-5 w-px bg-border/60 md:mx-1 md:block" />

                <Tooltip>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button aria-label="Período personalizado" className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                          isCustom ? "border-foreground/80 bg-secondary text-foreground" : "border-border/60 bg-card/70 text-muted-foreground/90 hover:border-foreground/40 hover:bg-muted/60 hover:text-foreground")}>
                          <CalendarDays className="h-[15px] w-[15px]" strokeWidth={2.1} />
                        </button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <PopoverContent align="end" className="w-auto overflow-hidden rounded-lg border border-border bg-popover p-0 shadow-lg">
                      <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="pointer-events-auto p-3" />
                    </PopoverContent>
                  </Popover>
                  <TooltipContent side="bottom" className="flex items-center gap-2">Período personalizado</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => window.location.reload()} aria-label="Atualizar" className="group inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-card/70 text-muted-foreground/90 transition-all duration-200 hover:border-foreground/40 hover:bg-muted/60 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20">
                      <RefreshCw className="h-[15px] w-[15px] transition-transform duration-500 group-hover:rotate-180" strokeWidth={2.1} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="flex items-center gap-2">Atualizar <Kbd>R</Kbd></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={toggleHidden} aria-label={hidden ? "Mostrar valores" : "Ocultar valores"} className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
                      hidden ? "border-foreground/80 bg-secondary text-foreground" : "border-border/60 bg-card/70 text-muted-foreground/90 hover:border-foreground/40 hover:bg-muted/60 hover:text-foreground")}>
                      {hidden ? <EyeOff className="h-[15px] w-[15px]" strokeWidth={2.1} /> : <Eye className="h-[15px] w-[15px]" strokeWidth={2.1} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="flex items-center gap-2">{hidden ? "Mostrar valores" : "Ocultar valores"} <Kbd>P</Kbd></TooltipContent>
                </Tooltip>

                <span className="hidden h-5 w-px bg-border/60 md:mx-1 md:block" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowExportDialog(true)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[11px] font-black tracking-[-0.005em] text-primary-foreground transition-all duration-200 hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <Download className="h-[14px] w-[14px]" strokeWidth={2.6} />
                      Exportar
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="flex items-center gap-2">Exportar CSV <Kbd>E</Kbd></TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          <div className="mt-8 grid grid-cols-2 border-y border-border/70 lg:grid-cols-4 lg:divide-x lg:divide-border/70">
            {[
              { label: "Receita bruta", value: hidden ? HIDE : fmtCompact(m.totalGross), sub: undefined, accent: "text-foreground", delta: { cur: m.totalGross, prev: p.totalGross }, rail: "bg-success" },
              { ...heroKpis[1], rail: "bg-info" },
              { ...heroKpis[2], rail: "bg-foreground/40" },
              { ...heroKpis[3], rail: approvalRate >= 60 ? "bg-success" : "bg-warning" },
            ].map((k, idx) => (
              <div
                key={`${k.label}-${animKey}`}
                className={cn(
                  "vendas-rise group relative min-h-[140px] px-6 py-6 transition-colors duration-200 hover:bg-muted/25 rounded-xl border border-transparent hover:border-border/40",
                  idx === 1 && "vendas-rise-d1",
                  idx === 2 && "vendas-rise-d2",
                  idx === 3 && "vendas-rise-d3",
                  idx > 1 && "border-t border-border/70 lg:border-t-0",
                  idx === 1 && "border-l border-border/70 lg:border-l-0",
                )}
              >
                <span className={cn("absolute left-0 top-6 h-8 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity", k.rail)} />
                <div className="flex items-center justify-between gap-2 pl-2">
                  <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/60">{k.label}</p>
                </div>
                <p
                  className={cn(
                    "mt-3 pl-2 font-display text-[34px] font-black leading-[0.9] tracking-[-0.06em] tabular-nums sm:text-[40px]",
                    k.accent,
                  )}
                  style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                >
                  {k.value}
                </p>
                <div className="mt-4 flex items-center gap-2 pl-2">
                  <p className="truncate text-[11.5px] font-bold text-muted-foreground/85">{k.sub}</p>
                  {k.delta && <DeltaBadge cur={k.delta.cur} prev={k.delta.prev} />}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 border-b border-border/70 sm:grid-cols-3 sm:divide-x sm:divide-border/70">
            {riskKpis.map((r, idx) => (
              <div
                key={`${r.label}-${animKey}`}
                className={cn(
                  "vendas-rise group relative flex flex-col gap-2.5 px-6 py-6 transition-colors duration-200 hover:bg-muted/25",
                  idx === 0 && "vendas-rise-d3",
                  idx === 1 && "vendas-rise-d4",
                  idx === 2 && "vendas-rise-d5",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-[19px] font-black tracking-[-0.035em] text-foreground">{r.label}</p>
                  <p
                    className={cn("font-display text-[26px] font-black leading-none tabular-nums tracking-[-0.05em]", r.accent)}
                    style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}
                  >
                    {r.value}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground">
                  <span className="font-display tabular-nums font-black text-foreground">{r.count}</span>
                  <span>{r.count === 1 ? "Transação" : "Transações"}</span>
                  <span className="inline-block h-[3px] w-[3px] rounded-full bg-muted-foreground/50" />
                  <span className="tabular-nums font-bold">{r.rate.toFixed(2).replace(".", ",")}%</span>
                </div>
              </div>
            ))}
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

        {/* Chart and payment mix removed — already shown on Dashboard */}

        {/* ─────────── TRANSACTIONS ─────────── */}
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          {/* HEADER */}
          <div className="relative border-b border-border/70 px-6 pt-6 pb-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h2 className="font-display text-[32px] font-black leading-[0.9] tracking-[-0.055em] text-foreground sm:text-[38px]">
                  Extrato de Vendas
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                  <span className="text-[12px] font-semibold text-muted-foreground/85">
                    <span className="font-numbers font-black tabular-nums text-foreground">{sortedFiltered.length.toLocaleString("pt-BR")}</span> {sortedFiltered.length === 1 ? "resultado" : "resultados"}
                  </span>
                  <span className="h-3 w-px bg-border/70" />
                  <span className="text-[12px] font-semibold text-muted-foreground/85">
                    Líquido <span className="font-numbers font-black tabular-nums text-success" style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}>{hidden ? HIDE : fmt(filteredNetTotal)}</span>
                  </span>
                </div>
              </div>

              <div className="relative w-full lg:w-[380px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" strokeWidth={2.2} />
                <input
                  id="vendas-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nome, email, telefone, ID…"
                  className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-16 text-[13px] font-medium text-foreground transition-all duration-200 placeholder:text-muted-foreground/65 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none"
                />
                {search ? (
                  <button onClick={() => setSearch("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                ) : (
                  <Kbd className="absolute right-3 top-1/2 -translate-y-1/2">/</Kbd>
                )}
              </div>
            </div>
          </div>

          {/* TABS */}
          <div className="overflow-x-auto border-b border-border/70 bg-background">
            <div className="flex min-w-max items-stretch">
              {statusTabs.map((tab) => {
                const active = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={cn(
                      "group relative flex items-center gap-2 whitespace-nowrap px-5 py-3.5 text-[12.5px] font-bold tracking-[-0.01em] transition-colors duration-150",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground/80 hover:bg-muted/30 hover:text-foreground",
                    )}
                  >
                    {tab.dot ? (
                      <span className="relative flex h-1.5 w-1.5">
                        {active && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", tab.dot)} />}
                        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", tab.dot)} />
                      </span>
                    ) : (
                      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-foreground" : "bg-muted-foreground/40")} />
                    )}
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "ml-0.5 inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-md px-1.5 text-[10.5px] font-black tabular-nums leading-none transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground/85 group-hover:bg-muted",
                      )}
                    >
                      {tab.count}
                    </span>
                    {active && (
                      <span className="absolute inset-x-0 -bottom-px h-[2.5px] bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden md:block">
            {loading ? (
              <div className="p-16 text-center">
                <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
                <p className="text-[11px] text-muted-foreground">Carregando…</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-border/70 bg-muted/15">
                        <SortHead label="Cliente" field="customer" sort={sort} onSort={handleSort} className="pl-5" />
                        <SortHead label="Produto / Data" field="date" sort={sort} onSort={handleSort} />
                        <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground/90">Status</th>
                        <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground/90">Método</th>
                        <SortHead label="Bruto / Taxa" field="amount" sort={sort} onSort={handleSort} align="right" />
                        <SortHead label="Líquido" field="net" sort={sort} onSort={handleSort} align="right" />
                        <th className="w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.length === 0 ? (
                        <tr><td colSpan={7} className="py-16">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center border border-border bg-muted">
                              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-[13px] font-bold text-foreground">Nenhuma venda encontrada</p>
                            <p className="text-[11px] text-muted-foreground">Ajuste o período ou refine a pesquisa.</p>
                          </div>
                        </td></tr>
                      ) : visibleItems.map((tx) => (
                        <TxRow key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} density={density} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleItems.length > 0 && totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border bg-background px-4 py-3">
                    <span className="text-[11.5px] font-medium text-muted-foreground tabular-nums">
                      Página <span className="font-bold text-foreground">{currentPage}</span> de <span className="font-bold text-foreground">{totalPages}</span> · {sortedFiltered.length} transações
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="inline-flex h-8 items-center gap-1 border border-border bg-card px-3 text-[11.5px] font-semibold text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30">
                        Anterior
                      </button>
                      <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="inline-flex h-8 items-center gap-1 border border-border bg-card px-3 text-[11.5px] font-semibold text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30">
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="divide-y divide-border md:hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                <p className="text-[12px] font-semibold text-foreground">Nenhuma venda encontrada</p>
              </div>
            ) : (
              <>
                {visibleItems.map((tx) => (
                  <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} />
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border bg-card px-3 py-2.5">
                    <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25">← Anterior</button>
                    <span className="text-[11.5px] font-bold tabular-nums text-foreground">{currentPage} / {totalPages}</span>
                    <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25">Próxima →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {selectedTx && <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={async () => toast.info("Entre em contato com o suporte.")} />}
      <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} transactions={dateFiltered} products={products} onExport={handleExportCSV} />

      {/* ─── Command Palette ─── */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Buscar comandos, clientes, ações…" />
        <CommandList>
          <CommandEmpty>Nenhum resultado.</CommandEmpty>
          <CommandGroup heading="Ações">
            <CommandItem onSelect={() => { setShowExportDialog(true); setCmdOpen(false); }}>
              <Download className="h-4 w-4" /> Exportar CSV <CommandShortcut>E</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => { window.location.reload(); }}>
              <RefreshCw className="h-4 w-4" /> Atualizar dados <CommandShortcut>R</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => { toggleHidden(); setCmdOpen(false); }}>
              {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {hidden ? "Mostrar valores" : "Ocultar valores"} <CommandShortcut>P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => { toggleDensity(); setCmdOpen(false); }}>
              {density === "compact" ? <Rows3 className="h-4 w-4" /> : <Rows4 className="h-4 w-4" />} Alternar densidade <CommandShortcut>D</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => { document.getElementById("vendas-search")?.focus(); setCmdOpen(false); }}>
              <Search className="h-4 w-4" /> Focar busca <CommandShortcut>/</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Filtrar status">
            {statusTabs.map((tab, i) => (
              <CommandItem key={tab.value} onSelect={() => { setStatusFilter(tab.value); setCmdOpen(false); }}>
                {tab.dot ? <span className={cn("h-2 w-2 rounded-full", tab.dot)} /> : <Filter className="h-4 w-4" />} {tab.label}
                <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{tab.count}</span>
                <CommandShortcut>{i + 1}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Período">
            {PERIODS.map(opt => (
              <CommandItem key={opt.label} onSelect={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); setCmdOpen(false); }}>
                <CalendarDays className="h-4 w-4" /> {opt.label}
                {!isCustom && selectedPeriod.label === opt.label && <Check className="ml-auto h-3.5 w-3.5 text-success" />}
              </CommandItem>
            ))}
          </CommandGroup>
          {sortedFiltered.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Transações recentes">
                {sortedFiltered.slice(0, 6).map(tx => (
                  <CommandItem key={tx.id} onSelect={() => { setSelectedTx(tx); setCmdOpen(false); }}>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{tx.customer_name || "Cliente"}</span>
                    <span className="ml-auto text-[11px] font-bold tabular-nums text-foreground">{fmt(Number(tx.net_amount))}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
