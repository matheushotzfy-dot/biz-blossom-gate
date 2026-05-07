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
function DeltaBadge({ cur, prev, positive = true }: { cur: number; prev: number; positive?: boolean }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success ring-1 ring-inset ring-success/30">
        novo
      </span>
    );
  }
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  const isGood = positive ? up : !up;

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1 ring-inset",
      isGood ? "bg-success/15 text-success ring-success/30" : "bg-destructive/15 text-destructive ring-destructive/30"
    )}>
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

function MetricCard({
  title, value, prevValue, icon: Icon, color, hidden, sparklineData, format = "currency", positive = true
}: {
  title: string; value: number; prevValue: number; icon: any; color: string; hidden: boolean; sparklineData?: number[]; format?: "currency" | "number" | "percent"; positive?: boolean
}) {
  const displayValue = hidden ? HIDE : (format === "currency" ? fmtCompact(value) : format === "percent" ? `${value.toFixed(1)}%` : value.toLocaleString("pt-BR"));
  
  return (
    <div className="border border-border/40 rounded-2xl bg-card p-5 hover:border-border transition-colors">
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{title}</span>
        <Icon className={cn("h-4 w-4 opacity-40", color)} />
      </div>
      <h3 className="mt-2 text-2xl font-black tracking-tight">{displayValue}</h3>
      <div className="mt-2 flex items-center justify-between gap-3">
        <DeltaBadge cur={value} prev={prevValue} positive={positive} />
        <p className="text-[10px] font-bold text-muted-foreground/40">vs período anterior</p>
      </div>
    </div>
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
    <tr onClick={onClick} className="group cursor-pointer border-b border-border/40 transition-all duration-200 hover:bg-muted/30 hover:shadow-[inset_4px_0_0_0_hsl(var(--primary))] last:border-b-0">
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
function MobileCard({ tx, prods, onClick, hidden }: { tx: Tables<"transactions">; prods: Record<string, string>; onClick: () => void; hidden: boolean }) {
  const name = tx.customer_name || "Cliente";
  const st = STATUS[tx.status] || { label: tx.status, fg: "text-muted-foreground", dot: "bg-muted-foreground/50", bg: "bg-muted", border: "border-border" };
  const method = METHODS[tx.payment_method || ""] || { label: tx.payment_method || "—", icon: FileText, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" };
  const MethodIcon = method.icon;
  const prodName = tx.product_id ? prods[tx.product_id] || "Produto sem nome" : "Sem produto";
  const net = Number(tx.net_amount);

  return (
    <div 
      className="group relative mx-4 mb-4 overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-5 shadow-sm backdrop-blur-sm transition-all active:scale-[0.98] hover:border-primary/30" 
      onClick={onClick}
    >
      {/* Decorative gradient background */}
      <div className={cn("absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-10 blur-3xl transition-all group-hover:opacity-20", st.bg)} />
      
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12 rounded-xl ring-2 ring-background shadow-md">
              <AvatarFallback className={cn("rounded-xl text-[14px] font-black", avatarColor(name))}>{initials(name)}</AvatarFallback>
            </Avatar>
            <div className={cn("absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-lg border-2 border-card shadow-sm", method.bg, method.color)}>
              <MethodIcon className="h-3 w-3" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-black tracking-tight text-foreground leading-none">{name}</p>
            <p className="truncate text-[12px] font-bold text-muted-foreground/70 mt-1.5 flex items-center gap-1.5">
              <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40" />
              {prodName}
            </p>
          </div>
        </div>
        
        <div className="text-right shrink-0">
          <p className={cn("text-[17px] font-black tabular-nums tracking-tight",
            tx.status === "completed" ? "text-success" : tx.status === "pending" ? "text-warning" : "text-foreground/60"
          )}>{hidden ? HIDE : fmt(net)}</p>
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground/40" />
            <p className="text-[10px] font-black text-muted-foreground/60 tabular-nums uppercase tracking-wider">{fmtTime(tx.created_at)}</p>
          </div>
        </div>
      </div>
      
      <div className="relative mt-5 flex items-center justify-between border-t border-border/40 pt-4">
        <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em]", st.fg, st.bg, st.border)}>
          <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", st.dot)} />
          {st.label}
        </span>
        <div className="flex items-center gap-2">
           <CalendarDays className="h-3 w-3 text-muted-foreground/40" />
           <p className="text-[10px] font-bold text-muted-foreground/80 tracking-tight">{fmtDate(tx.created_at)}</p>
        </div>
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
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
            <h1 className="text-3xl font-black tracking-tight text-foreground">Minhas Vendas</h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {dateFiltered.length} {dateFiltered.length === 1 ? "transação" : "transações"} no período
            {lastSaleText && <><span className="h-1 w-1 rounded-full bg-muted-foreground/30" /> última {lastSaleText}</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-muted/30 p-1 rounded-2xl border border-border/50">
            {PERIODS.map((opt) => {
              const active = !isCustom && selectedPeriod.label === opt.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => { setSelectedPeriod(opt); setIsCustom(false); setCustomRange(undefined); }}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                    active ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <TooltipProvider delayDuration={250}>
            <Tooltip>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "h-11 px-5 rounded-2xl border flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all",
                      isCustom ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground"
                    )}>
                      <CalendarDays className="h-4 w-4" />
                      {isCustom && customRange?.from ? format(customRange.from, "dd/MM") + " – " + (customRange?.to ? format(customRange.to, "dd/MM") : "") : "Personalizado"}
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <PopoverContent align="end" className="p-0 border-border/50 rounded-3xl overflow-hidden">
                  <Calendar mode="range" selected={customRange} onSelect={(range) => { setCustomRange(range); setIsCustom(true); if (range?.from && range?.to) setTimeout(() => setDatePickerOpen(false), 300); }} numberOfMonths={1} locale={ptBR} disabled={(date) => date > new Date()} className="pointer-events-auto p-3" />
                </PopoverContent>
              </Popover>
              <TooltipContent side="bottom">Período personalizado</TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => window.location.reload()} className="h-11 w-11 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-all group">
                    <RefreshCw className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="flex items-center gap-2">Atualizar <Kbd>R</Kbd></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={toggleHidden} className={cn("h-11 w-11 rounded-2xl border flex items-center justify-center transition-all", hidden ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
                    {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="flex items-center gap-2">{hidden ? "Mostrar" : "Ocultar"} <Kbd>P</Kbd></TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => setShowExportDialog(true)} className="bg-primary text-primary-foreground h-11 px-6 rounded-2xl font-black text-xs flex items-center gap-2 uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all">
                  <Download className="h-4 w-4" />
                  Exportar
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex items-center gap-2">Exportar CSV <Kbd>E</Kbd></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Hero Balance Card + Metric Cards */}
      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-2 relative overflow-hidden border border-primary/20 bg-primary/[0.02] rounded-2xl p-8 group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] transition-opacity group-hover:opacity-[0.06]">
            <Zap className="h-32 w-32 -rotate-12" />
          </div>
          <div className="flex items-center gap-2 text-primary font-black uppercase tracking-[0.2em] text-[10px]">
            <Check className="h-3 w-3" />
            Receita Líquida no Período
          </div>
          <div className="mt-3 flex items-baseline gap-4">
            <p className="text-[56px] font-black tracking-tighter leading-none tabular-nums" style={{ fontVariantNumeric: "tabular-nums slashed-zero" }}>
              {hidden ? HIDE : fmt(m.totalNet)}
            </p>
            <span className="text-muted-foreground font-bold text-sm">BRL</span>
          </div>
          <div className="mt-6 flex items-center gap-4 text-sm">
            <DeltaBadge cur={m.totalNet} prev={p.totalNet} />
            <span className="text-muted-foreground font-bold">
              Bruto: <span className="text-foreground">{hidden ? HIDE : fmtCompact(m.totalGross)}</span>
            </span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="text-muted-foreground font-bold">
              Taxas: <span className="text-foreground">{hidden ? HIDE : fmtCompact(m.totalFees)}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 lg:col-span-2">
          <MetricCard title="Vendas Aprovadas" value={m.approved.length} prevValue={p.approved.length} icon={CheckSquare} color="text-primary" hidden={hidden} format="number" />
          <MetricCard title="Ticket Médio" value={m.avgTicket} prevValue={p.avgTicket} icon={ShoppingCart} color="text-info" hidden={hidden} />
          <MetricCard title="Taxa de Aprovação" value={approvalRate} prevValue={p.approved.length > 0 ? (p.approved.length / (previousPeriodFiltered.length || 1)) * 100 : 0} icon={ChevronUp} color={approvalRate >= 60 ? "text-success" : "text-warning"} hidden={false} format="percent" />
          <MetricCard title="Clientes Únicos" value={m.uniqueCustomers} prevValue={p.uniqueCustomers} icon={MessageCircle} color="text-primary" hidden={hidden} format="number" />
        </div>
      </div>

      {/* Risk Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="border border-border/40 rounded-2xl bg-card p-5 hover:border-border transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Reembolsos</span>
            <RefreshCw className="h-4 w-4 opacity-40 text-destructive" />
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight">{hidden ? HIDE : fmtCompact(refundedAmount)}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] font-bold text-foreground">{m.refunded.length} vendas</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="text-[10px] font-bold text-destructive">{m.refundRate.toFixed(2)}%</span>
          </div>
        </div>

        <div className="border border-border/40 rounded-2xl bg-card p-5 hover:border-border transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Chargebacks</span>
            <ShieldAlert className="h-4 w-4 opacity-40 text-destructive" />
          </div>
          <p className="mt-2 text-2xl font-black tracking-tight">{hidden ? HIDE : fmtCompact(chargebackAmount)}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] font-bold text-foreground">{m.chargebacks.length} alertas</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="text-[10px] font-bold text-destructive">{m.chargebackRate.toFixed(2)}%</span>
          </div>
        </div>

        <div className="border border-border/40 rounded-2xl bg-card p-5 hover:border-border transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Mix de Pagamento</span>
            <CreditCard className="h-4 w-4 opacity-40 text-info" />
          </div>
          <div className="mt-3 space-y-2">
            {mixRows.map(r => (
              <div key={r.label} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", r.dot)} />
                  <span className="font-bold text-foreground">{r.label}</span>
                </div>
                <span className="font-black tabular-nums text-muted-foreground">{r.share.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────── TRANSACTIONS TABLE ─────────── */}
      <div className="border border-border/40 rounded-2xl bg-card overflow-hidden">
        {/* Table Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-border/40 px-8 py-6">
          <div className="space-y-1">
            <h2 className="text-xl font-black">Extrato de Vendas</h2>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span className="font-mono font-black text-foreground tabular-nums">{sortedFiltered.length.toLocaleString("pt-BR")}</span> resultados · Líquido <span className="font-mono font-black text-success tabular-nums">{hidden ? HIDE : fmt(filteredNetTotal)}</span>
            </p>
          </div>

          <div className="relative group w-full lg:w-[380px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" strokeWidth={2.2} />
            <input
              id="vendas-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, email, telefone, ID…"
              className="h-11 w-full rounded-2xl border border-border bg-card pl-11 pr-16 text-sm font-medium text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            {search ? (
              <button onClick={() => setSearch("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            ) : (
              <Kbd className="absolute right-3 top-1/2 -translate-y-1/2">/</Kbd>
            )}
          </div>
        </div>

        {/* Status Tabs */}
        <div className="overflow-x-auto border-b border-border/40 bg-muted/10">
          <div className="flex min-w-max items-stretch px-6">
            {statusTabs.map((tab) => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value as StatusFilter)}
                  className={cn(
                    "group relative flex items-center gap-2.5 whitespace-nowrap px-5 py-4 text-[12.5px] font-bold tracking-tight transition-all",
                    active ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30",
                  )}
                >
                  {tab.dot ? (
                    <span className={cn("h-1.5 w-1.5 rounded-full", tab.dot, active ? "opacity-100" : "opacity-40")} />
                  ) : (
                    <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-foreground" : "bg-muted-foreground/40")} />
                  )}
                  <span>{tab.label}</span>
                  <span className={cn(
                    "ml-0.5 inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-md px-1.5 text-[10.5px] font-black tabular-nums",
                    active ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground/80"
                  )}>
                    {tab.count}
                  </span>
                  {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
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

          <div className="md:hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 border border-dashed border-border">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-[14px] font-black text-foreground mt-2">Nenhuma venda encontrada</p>
                <p className="text-[12px] font-medium text-muted-foreground/60">Ajuste os filtros e tente novamente.</p>
              </div>
            ) : (
              <div className="space-y-1 pt-4 pb-10">
                {visibleItems.map((tx) => (
                  <MobileCard key={tx.id} tx={tx} prods={products} onClick={() => setSelectedTx(tx)} hidden={hidden} />
                ))}
                {totalPages > 1 && (
                  <div className="mx-4 mt-6 flex items-center justify-between rounded-xl border border-border/50 bg-card/40 p-3 backdrop-blur-sm">
                    <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="text-[12px] font-black text-primary transition-all active:scale-95 disabled:opacity-25 uppercase tracking-wider">← Anterior</button>
                    <span className="text-[12px] font-black tabular-nums text-foreground">{currentPage} de {totalPages}</span>
                    <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="text-[12px] font-black text-primary transition-all active:scale-95 disabled:opacity-25 uppercase tracking-wider">Próxima →</button>
                  </div>
                )}
              </div>
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
