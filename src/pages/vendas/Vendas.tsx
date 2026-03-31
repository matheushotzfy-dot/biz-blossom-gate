import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
  ShoppingCart, DollarSign, TrendingUp, CreditCard, Search, X, EyeOff,
  Phone, Mail, Calendar as CalendarIcon, Clock, Hash, Package, ArrowUpRight,
  RefreshCw, Copy, Check, Users, Eye, MessageCircle, ChevronDown,
  Download, Smartphone, FileText, BarChart3, ArrowDownRight, Zap, Filter,
  MoreHorizontal, ExternalLink, Receipt, CheckSquare, Square, CalendarDays,
  Wallet, Target,
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
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import type { DateRange } from "react-day-picker";

/* ─── Formatters ─── */
const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const _dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
const _timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const _dateCache = new Map<string, string>();
const _timeCache = new Map<string, string>();

const fmtDate = (d: string) => {
  let v = _dateCache.get(d);
  if (!v) { v = _dateFmt.format(new Date(d)); _dateCache.set(d, v); }
  return v;
};
const fmtTime = (d: string) => {
  let v = _timeCache.get(d);
  if (!v) { v = _timeFmt.format(new Date(d)); _timeCache.set(d, v); }
  return v;
};

type StatusFilter = "all" | "completed" | "pending" | "failed" | "refunded" | "chargeback";

const CENSORED = "••••••";

const PERIOD_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "Ontem", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
] as const;
type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const PAGE_SIZE = 50;

/* ─── Avatar helpers ─── */
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

/* ─── Status Dot ─── */
const STATUS_DOT_STYLES: Record<string, { dot: string; glow: string }> = {
  completed: { dot: "bg-success", glow: "shadow-[0_0_8px_hsl(var(--success)/0.6)]" },
  pending: { dot: "bg-warning", glow: "shadow-[0_0_8px_hsl(var(--warning)/0.6)]" },
  failed: { dot: "bg-destructive", glow: "shadow-[0_0_8px_hsl(var(--destructive)/0.6)]" },
  refunded: { dot: "bg-info", glow: "shadow-[0_0_8px_hsl(var(--info)/0.6)]" },
  chargeback: { dot: "bg-destructive", glow: "shadow-[0_0_8px_hsl(var(--destructive)/0.6)]" },
};

function StatusDot({ status }: { status: string }) {
  const s = STATUS_DOT_STYLES[status] || { dot: "bg-muted-foreground", glow: "" };
  return (
    <span className="flex items-center justify-center h-5 w-5">
      <span className={cn("h-2.5 w-2.5 rounded-full animate-pulse", s.dot, s.glow)} />
    </span>
  );
}

/* ─── MiniHeroCard (same as Dashboard) ─── */
function MiniHeroCard({ icon, label, value, tone, idx }: {
  icon: React.ReactNode; label: string; value: string;
  tone: "primary" | "info" | "success" | "warning";
  idx: number;
}) {
  const toneMap: Record<string, { accent: string; iconBg: string; iconText: string; ring: string }> = {
    primary: { accent: "bg-primary", iconBg: "bg-primary/10", iconText: "text-primary", ring: "ring-primary/20" },
    info: { accent: "bg-info", iconBg: "bg-info/10", iconText: "text-info", ring: "ring-info/20" },
    success: { accent: "bg-success", iconBg: "bg-success/10", iconText: "text-success", ring: "ring-success/20" },
    warning: { accent: "bg-warning", iconBg: "bg-warning/10", iconText: "text-warning", ring: "ring-warning/20" },
  };
  const t = toneMap[tone] || toneMap.primary;

  return (
    <div
      className="group relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/40 overflow-hidden hover:border-border/60 hover:shadow-[0_6px_20px_hsl(var(--foreground)/0.06)] transition-all duration-300 p-4 md:p-5 animate-fade-in"
      style={{ animationDelay: `${idx * 60}ms` }}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", t.accent)} />
      <div className="pl-1.5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">{label}</span>
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center ring-1", t.iconBg, t.ring)}>
            <span className={t.iconText}>{icon}</span>
          </div>
        </div>
        <p className="font-display font-black text-foreground text-[22px] md:text-2xl tracking-[-0.03em] tabular-nums">{value}</p>
      </div>
    </div>
  );
}

/* ─── Transaction Row (Desktop) ─── */
function TxRow({ tx, products, onClick, index }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void; index: number;
}) {
  const methodConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pix: { icon: <Smartphone className="h-3 w-3" />, label: "PIX", color: "text-success bg-success/10" },
    credit_card: { icon: <CreditCard className="h-3 w-3" />, label: "Cartão", color: "text-info bg-info/10" },
    boleto: { icon: <FileText className="h-3 w-3" />, label: "Boleto", color: "text-warning bg-warning/10" },
  };
  const method = methodConfig[tx.payment_method || ""] || { icon: null, label: tx.payment_method || "—", color: "text-muted-foreground bg-muted" };
  const customerName = tx.customer_name || "Cliente";
  const avatarColor = getAvatarColor(customerName);

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tx.customer_phone) {
      navigator.clipboard.writeText(tx.customer_phone);
      toast.success("WhatsApp copiado!");
    }
  };

  const statusAccent: Record<string, { border: string; bg: string }> = {
    completed: { border: "border-l-success", bg: "hover:bg-success/[0.04]" },
    pending: { border: "border-l-warning", bg: "hover:bg-warning/[0.04]" },
    failed: { border: "border-l-destructive", bg: "hover:bg-destructive/[0.04]" },
    refunded: { border: "border-l-info", bg: "hover:bg-info/[0.04]" },
    chargeback: { border: "border-l-destructive", bg: "hover:bg-destructive/[0.04]" },
  };
  const accent = statusAccent[tx.status] || { border: "border-l-muted-foreground", bg: "hover:bg-muted/10" };

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
      onClick={onClick}
      className={cn(
        "border-b border-border/20 dark:border-foreground/[0.03] transition-all cursor-pointer group border-l-[3px]",
        accent.border,
        accent.bg
      )}
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/20">
            <AvatarFallback className={cn("text-[11px] font-bold", avatarColor)}>
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground font-semibold text-[13px] leading-tight truncate">{customerName}</p>
            {tx.customer_email && <p className="text-muted-foreground/60 text-[11px] mt-0.5 truncate">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      <td className="p-4">
        <span className="text-muted-foreground text-[12px] font-medium max-w-[130px] truncate block">{tx.product_id ? (products[tx.product_id] || tx.product_id.slice(0, 8)) : "—"}</span>
      </td>
      <td className="p-4">
        <div>
          <span className="font-display font-black text-foreground text-[15px] block tracking-[-0.02em] tabular-nums">
            {fmt(Number(tx.net_amount))}
          </span>
          {Number(tx.fee_amount) > 0 && (
            <span className="text-[10px] text-muted-foreground/50 font-medium">taxa: {fmt(Number(tx.fee_amount))}</span>
          )}
        </div>
      </td>
      <td className="p-4">
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg", method.color)}>
          {method.icon}
          {method.label}
        </span>
      </td>
      <td className="p-4">
        <StatusDot status={tx.status} />
      </td>
      <td className="p-4">
        <div>
          <p className="text-foreground/70 text-[12px] font-medium tabular-nums">{fmtDate(tx.created_at)}</p>
          <p className="text-muted-foreground/40 text-[10px] tabular-nums">{fmtTime(tx.created_at)}</p>
        </div>
      </td>
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }} className="gap-2 text-[12px]">
              <Eye className="h-3.5 w-3.5" /> Ver Detalhes
            </DropdownMenuItem>
            {tx.customer_phone && (
              <>
                <DropdownMenuItem onClick={handleCopyPhone} className="gap-2 text-[12px]">
                  <Copy className="h-3.5 w-3.5" /> Copiar WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="gap-2 text-[12px]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp
                  </a>
                </DropdownMenuItem>
              </>
            )}
            {tx.status === "completed" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast.info("Para solicitar reembolso, entre em contato com o suporte."); }} className="gap-2 text-[12px] text-destructive focus:text-destructive">
                  <RefreshCw className="h-3.5 w-3.5" /> Reembolsar
                </DropdownMenuItem>
              </>
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

  const statusBorderMobile: Record<string, string> = {
    completed: "border-l-success",
    pending: "border-l-warning",
    failed: "border-l-destructive",
    refunded: "border-l-info",
    chargeback: "border-l-destructive",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      className={cn(
        "rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4 cursor-pointer active:scale-[0.99] transition-all border-l-[3px]",
        statusBorderMobile[tx.status] || "border-l-muted-foreground"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={cn("text-xs font-bold", avatarColor)}>
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground font-semibold text-[13px] leading-tight truncate">{customerName}</p>
            <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{tx.customer_email || ""}</p>
          </div>
        </div>
        <StatusDot status={tx.status} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-foreground font-display font-bold text-xl leading-none">
            {fmt(Number(tx.net_amount))}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-muted-foreground text-[10px] bg-muted/50 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
              {methodLabels[tx.payment_method || ""] || tx.payment_method || "—"}
            </span>
            <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">
              {tx.product_id ? products[tx.product_id] || "Produto" : "—"}
            </span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <p className="text-muted-foreground text-[11px]">{fmtDate(tx.created_at)}</p>
          {tx.customer_phone && (
            <a
              href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center text-success hover:bg-success/15 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Status pill config ─── */
const STATUS_PILL_STYLES: Record<string, { active: string; dot: string }> = {
  all: { active: "bg-primary/10 text-primary", dot: "bg-primary" },
  completed: { active: "bg-success/10 text-success", dot: "bg-success" },
  pending: { active: "bg-warning/10 text-warning", dot: "bg-warning" },
  failed: { active: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  refunded: { active: "bg-info/10 text-info", dot: "bg-info" },
  chargeback: { active: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

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
  transactions: Tables<"transactions">[];
  products: Record<string, string>;
  productsRaw: any[];
  onExport: (txList: Tables<"transactions">[]) => void;
}) {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(ALL_STATUSES.map(s => s.value)));
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set(ALL_METHODS.map(m => m.value)));
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set(["all"]));

  const toggleStatus = (v: string) => {
    setSelectedStatuses(prev => { const next = new Set(prev); next.has(v) ? next.delete(v) : next.add(v); return next; });
  };
  const toggleMethod = (v: string) => {
    setSelectedMethods(prev => { const next = new Set(prev); next.has(v) ? next.delete(v) : next.add(v); return next; });
  };
  const toggleProduct = (id: string) => {
    if (id === "all") { setSelectedProducts(new Set(["all"])); return; }
    setSelectedProducts(prev => {
      const next = new Set(prev); next.delete("all"); next.has(id) ? next.delete(id) : next.add(id);
      if (next.size === 0) next.add("all"); return next;
    });
  };

  const selectAllStatuses = () => setSelectedStatuses(new Set(ALL_STATUSES.map(s => s.value)));
  const clearAllStatuses = () => setSelectedStatuses(new Set());
  const selectAllMethods = () => setSelectedMethods(new Set(ALL_METHODS.map(m => m.value)));
  const clearAllMethods = () => setSelectedMethods(new Set());

  const exportFiltered = useMemo(() => {
    return transactions.filter(t => {
      if (!selectedStatuses.has(t.status)) return false;
      if (t.payment_method && !selectedMethods.has(t.payment_method)) return false;
      if (!selectedProducts.has("all") && t.product_id && !selectedProducts.has(t.product_id)) return false;
      return true;
    });
  }, [transactions, selectedStatuses, selectedMethods, selectedProducts]);

  const handleExport = () => { onExport(exportFiltered); onOpenChange(false); };

  const txProducts = useMemo(() => {
    const ids = new Set(transactions.map(t => t.product_id).filter(Boolean) as string[]);
    return Array.from(ids).map(id => ({ id, name: products[id] || id.slice(0, 8) }));
  }, [transactions, products]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/40 dark:border-foreground/[0.06] bg-card/95 dark:bg-card/90 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" /> Exportar Vendas
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">
            Escolha os filtros para a exportação CSV
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
              <div className="flex items-center gap-2">
                <button onClick={clearAllStatuses} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline font-medium">Limpar</button>
                <span className="text-muted-foreground/30">|</span>
                <button onClick={selectAllStatuses} className="text-[10px] text-primary hover:underline font-medium">Todos</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => {
                const active = selectedStatuses.has(s.value);
                return (
                  <button key={s.value} onClick={() => toggleStatus(s.value)} className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                    active ? "border-primary/30 bg-primary/10 text-primary" : "border-border/30 dark:border-foreground/[0.06] text-muted-foreground hover:border-border/50"
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", active ? s.dot : "bg-muted-foreground/30")} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Método de Pagamento</p>
              <div className="flex items-center gap-2">
                <button onClick={clearAllMethods} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline font-medium">Limpar</button>
                <span className="text-muted-foreground/30">|</span>
                <button onClick={selectAllMethods} className="text-[10px] text-primary hover:underline font-medium">Todos</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_METHODS.map(m => {
                const active = selectedMethods.has(m.value);
                const Icon = m.icon;
                return (
                  <button key={m.value} onClick={() => toggleMethod(m.value)} className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                    active ? "border-primary/30 bg-primary/10 text-primary" : "border-border/30 dark:border-foreground/[0.06] text-muted-foreground hover:border-border/50"
                  )}>
                    <Icon className="h-3 w-3" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          {txProducts.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Produtos</p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                <button onClick={() => toggleProduct("all")} className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left",
                  selectedProducts.has("all") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30"
                )}>
                  {selectedProducts.has("all") ? <CheckSquare className="h-3.5 w-3.5 shrink-0" /> : <Square className="h-3.5 w-3.5 shrink-0" />}
                  Todos os produtos
                </button>
                {txProducts.map(p => {
                  const active = selectedProducts.has(p.id);
                  return (
                    <button key={p.id} onClick={() => toggleProduct(p.id)} className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/30"
                    )}>
                      {active ? <CheckSquare className="h-3.5 w-3.5 shrink-0" /> : <Square className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="rounded-lg bg-muted/20 dark:bg-foreground/[0.03] border border-border/30 dark:border-foreground/[0.05] p-3 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-foreground">{exportFiltered.length} transações</p>
              <p className="text-[10px] text-muted-foreground">serão exportadas</p>
            </div>
            <p className="text-[14px] font-bold text-primary font-display">
              {fmt(exportFiltered.reduce((a, t) => a + Number(t.net_amount), 0))}
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-lg h-10 text-[12px] font-medium">Cancelar</Button>
          <Button onClick={handleExport} disabled={exportFiltered.length === 0} className="flex-1 rounded-lg h-10 gap-2 text-[12px] font-medium">
            <Download className="h-3.5 w-3.5" /> Exportar {exportFiltered.length > 0 ? `(${exportFiltered.length})` : ""}
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
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[0]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [privacyHidden, setPrivacyHidden] = useState(() => {
    try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; }
  });
  const togglePrivacy = useCallback(() => {
    setPrivacyHidden(prev => {
      const next = !prev;
      try { localStorage.setItem("privacy_mode", String(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, statusFilter, selectedPeriod, isCustom, customRange]);

  // Brasilia date helpers
  const brasiliaToday = useCallback(() => {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
    const parts = f.formatToParts(new Date());
    const y = parts.find(p => p.type === "year")!.value;
    const m = parts.find(p => p.type === "month")!.value;
    const d = parts.find(p => p.type === "day")!.value;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }, []);

  const toBrasiliaDate = useCallback((dateStr: string) => {
    let cached = _dateCache.get(dateStr);
    if (!cached) {
      cached = new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      _dateCache.set(dateStr, cached);
    }
    return cached;
  }, []);

  const dateFiltered = useMemo(() => {
    if (isCustom && customRange?.from) {
      const start = new Date(customRange.from);
      start.setHours(0, 0, 0, 0);
      const end = customRange.to ? new Date(customRange.to) : new Date(customRange.from);
      end.setHours(23, 59, 59, 999);
      return transactions.filter((t) => {
        const d = new Date(t.created_at);
        return d >= start && d <= end;
      });
    }

    const today = brasiliaToday();

    if (selectedPeriod.days === 0) {
      const todayStr = today.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return transactions.filter((t) => toBrasiliaDate(t.created_at) === todayStr);
    }

    if (selectedPeriod.days === 1) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return transactions.filter((t) => toBrasiliaDate(t.created_at) === yesterdayStr);
    }

    const start = new Date(today);
    start.setDate(start.getDate() - selectedPeriod.days);
    start.setHours(0, 0, 0, 0);

    return transactions.filter((t) => new Date(t.created_at) >= start);
  }, [transactions, selectedPeriod, isCustom, customRange, brasiliaToday, toBrasiliaDate]);

  const { approved, pending, refunded, chargebacks, totalSales, totalGross, avgTicket, conversion } = useMemo(() => {
    const _approved = dateFiltered.filter((t) => t.status === "completed");
    const _pending = dateFiltered.filter((t) => t.status === "pending");
    const _refunded = dateFiltered.filter((t) => t.status === "refunded");
    const _chargebacks = dateFiltered.filter((t) => t.status === "chargeback");
    const _totalSales = _approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const _totalGross = _approved.reduce((acc, t) => acc + Number(t.amount), 0);
    const _avgTicket = _approved.length > 0 ? _totalSales / _approved.length : 0;
    const _conversion = dateFiltered.length > 0 ? (_approved.length / dateFiltered.length) * 100 : 0;

    return {
      approved: _approved, pending: _pending, refunded: _refunded, chargebacks: _chargebacks,
      totalSales: _totalSales, totalGross: _totalGross, avgTicket: _avgTicket, conversion: _conversion,
    };
  }, [dateFiltered]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dateFiltered.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!search) return true;
      return (
        t.customer_name?.toLowerCase().includes(q) ||
        t.customer_email?.toLowerCase().includes(q) ||
        t.customer_phone?.includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [dateFiltered, search, statusFilter]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const handleRefund = async (_tx: Tables<"transactions">) => {
    toast.info("Para solicitar reembolso, entre em contato com o suporte.");
  };

  const statusFilters = useMemo(() => {
    const counts: Record<string, number> = { all: dateFiltered.length, completed: 0, pending: 0, failed: 0, refunded: 0, chargeback: 0 };
    for (const t of dateFiltered) {
      if (t.status in counts) counts[t.status]++;
    }
    return [
      { label: "Todas", value: "all" as StatusFilter, count: counts.all },
      { label: "Aprovadas", value: "completed" as StatusFilter, count: counts.completed },
      { label: "Pendentes", value: "pending" as StatusFilter, count: counts.pending },
      { label: "Falhas", value: "failed" as StatusFilter, count: counts.failed },
      { label: "Reembolsos", value: "refunded" as StatusFilter, count: counts.refunded },
      { label: "Chargebacks", value: "chargeback" as StatusFilter, count: counts.chargeback },
    ];
  }, [dateFiltered]);

  const loadMore = useCallback(() => setVisibleCount((c) => c + PAGE_SIZE), []);

  const sanitizeCsvCell = useCallback((val: unknown): string => {
    const str = String(val ?? "");
    if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
    return str;
  }, []);

  const handleExportCSV = useCallback((txList: Tables<"transactions">[]) => {
    if (txList.length === 0) { toast.error("Nenhuma transação para exportar."); return; }
    const headers = ["ID", "Cliente", "Email", "Telefone", "CPF/CNPJ", "Produto", "Valor Bruto", "Taxa", "Líquido", "Método", "Status", "Data"];
    const rows = txList.map(t => [
      t.id, t.customer_name || "", t.customer_email || "", t.customer_phone || "",
      t.customer_document || "",
      t.product_id ? products[t.product_id] || "" : "", Number(t.amount), Number(t.fee_amount), Number(t.net_amount),
      t.payment_method || "", t.status, t.created_at,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${sanitizeCsvCell(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vendas-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${txList.length} transações exportadas!`);
  }, [products, sanitizeCsvCell]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("vendas-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-5 md:space-y-6 relative animate-fade-in">
      {/* ─── HERO SECTION (matches Dashboard) ─── */}
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm backdrop-blur-xl p-4 md:p-8 animate-fade-in">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 -top-16 h-48 md:h-72 w-48 md:w-72 rounded-full bg-primary/15 blur-[60px] md:blur-[90px]" />
          <div className="absolute -right-10 bottom-0 h-40 md:h-56 w-40 md:w-56 rounded-full bg-info/10 blur-[70px] md:blur-[110px]" />
        </div>

        <div className="relative z-10 space-y-4 md:space-y-6">
          {/* Title row */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-border/40 bg-card/45 backdrop-blur-xl">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl md:text-3xl font-display font-black tracking-[-0.04em] leading-[1.05] text-foreground">
                  Minhas <span className="text-gradient">Vendas</span>
                </h1>
                <p className="text-[13px] text-muted-foreground/80">Acompanhe todas as suas transações</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
              {/* Date Picker (same as Dashboard) */}
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button className="inline-flex h-9 md:h-10 items-center gap-1.5 md:gap-2 rounded-xl border border-border/80 bg-card px-3 md:px-3.5 text-xs md:text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary/25">
                    <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    {isCustom && customRange?.from
                      ? customRange.to
                        ? `${format(customRange.from, "dd/MM", { locale: ptBR })} - ${format(customRange.to, "dd/MM", { locale: ptBR })}`
                        : format(customRange.from, "dd/MM/yyyy", { locale: ptBR })
                      : selectedPeriod.label}
                    <ChevronDown className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0 rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden">
                  <div className="p-2 space-y-0.5 min-w-[150px]">
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em] px-2.5 py-1.5">Período</p>
                    {PERIOD_PRESETS.map((option) => (
                      <button
                        key={option.label}
                        onClick={() => {
                          setSelectedPeriod(option);
                          setIsCustom(false);
                          setCustomRange(undefined);
                          setDatePickerOpen(false);
                        }}
                        className={cn(
                          "w-full text-left rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                          !isCustom && selectedPeriod.label === option.label
                            ? "bg-primary/10 text-primary font-bold"
                            : "text-foreground/70 hover:bg-muted/40 hover:text-foreground"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                    <div className="my-1.5 border-t border-border/20" />
                    <button
                      onClick={() => setIsCustom(true)}
                      className={cn(
                        "w-full text-left rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all flex items-center gap-2",
                        isCustom
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-foreground/70 hover:bg-muted/40 hover:text-foreground"
                      )}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      Personalizado
                    </button>
                    {isCustom && (
                      <div className="border-t border-border/20 mt-1.5 pt-1">
                        <Calendar
                          mode="range"
                          selected={customRange}
                          onSelect={(range) => {
                            setCustomRange(range);
                            setIsCustom(true);
                            if (range?.from && range?.to) {
                              setTimeout(() => setDatePickerOpen(false), 300);
                            }
                          }}
                          numberOfMonths={1}
                          locale={ptBR}
                          disabled={(date) => date > new Date()}
                          className={cn("p-3 pointer-events-auto")}
                          classNames={{
                            day_selected: "bg-primary text-primary-foreground hover:bg-primary/90",
                            day_range_middle: "bg-primary/10 text-foreground",
                            day_range_end: "bg-primary text-primary-foreground",
                          }}
                        />
                        {customRange?.from && (
                          <div className="px-3 pb-2 pt-1 border-t border-border/20 mt-1">
                            <p className="text-[11px] text-muted-foreground font-medium text-center">
                              {format(customRange.from, "dd MMM yyyy", { locale: ptBR })}
                              {customRange.to && ` — ${format(customRange.to, "dd MMM yyyy", { locale: ptBR })}`}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <button
                onClick={togglePrivacy}
                className="inline-flex h-9 md:h-10 items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/25"
                title={privacyHidden ? "Mostrar valores" : "Ocultar valores"}
              >
                {privacyHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
              </button>

              <Button variant="ghost" size="sm" onClick={() => setShowExportDialog(true)} className="gap-2 rounded-xl h-9 md:h-10 font-medium text-[12px] text-muted-foreground hover:text-foreground border border-border/80 bg-card shadow-sm hover:border-primary/25">
                <Download className="h-3.5 w-3.5" /> <span className="hidden md:inline">Exportar</span>
              </Button>
            </div>
          </div>

          {/* Hero metrics (same style as Dashboard) */}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
            <MiniHeroCard icon={<DollarSign className="h-4 w-4" />} label="Receita Líquida" value={privacyHidden ? CENSORED : fmt(totalSales)} tone="primary" idx={0} />
            <MiniHeroCard icon={<BarChart3 className="h-4 w-4" />} label="Faturamento Bruto" value={privacyHidden ? CENSORED : fmt(totalGross)} tone="info" idx={1} />
            <MiniHeroCard icon={<TrendingUp className="h-4 w-4" />} label="Ticket Médio" value={privacyHidden ? CENSORED : fmt(avgTicket)} tone="warning" idx={2} />
            <MiniHeroCard icon={<Target className="h-4 w-4" />} label="Conversão" value={privacyHidden ? CENSORED : `${conversion.toFixed(1)}%`} tone="success" idx={3} />
          </div>
        </div>
      </section>

      {/* ─── HEALTH CARDS (Aprovadas + Pendentes — matches Dashboard) ─── */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <QualityLine icon={<ShoppingCart className="h-4 w-4" />} label="Aprovadas" value={privacyHidden ? CENSORED : String(approved.length)} tone="success" />
        <QualityLine icon={<Clock className="h-4 w-4" />} label="Pendentes" value={privacyHidden ? CENSORED : String(pending.length)} tone="warning" />
        <QualityLine icon={<RefreshCw className="h-4 w-4" />} label="Reembolsos" value={privacyHidden ? CENSORED : String(refunded.length)} tone="info" />
        <QualityLine icon={<ArrowDownRight className="h-4 w-4" />} label="Chargebacks" value={privacyHidden ? CENSORED : String(chargebacks.length)} tone={chargebacks.length > 0 ? "destructive" : "success"} />
      </section>

      {/* ─── FILTERS ─── */}
      <section className="space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <input
              id="vendas-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, e-mail, WhatsApp ou ID..."
              className="w-full h-10 pl-10 pr-16 rounded-xl bg-card/50 backdrop-blur-xl border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {search ? (
                <button onClick={() => setSearch("")} className="p-1">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              ) : (
                <kbd className="hidden md:inline-flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {statusFilters.map((f) => {
            const isActive = statusFilter === f.value;
            const style = STATUS_PILL_STYLES[f.value];
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-semibold transition-all duration-200 border",
                  isActive
                    ? cn(style.active, "border-current/15 shadow-sm")
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/20"
                )}
              >
                <span className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  isActive ? cn(style.dot, "shadow-[0_0_6px_currentColor] animate-pulse") : "bg-muted-foreground/20"
                )} />
                {f.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-md font-bold min-w-[20px] text-center tabular-nums",
                  isActive ? "bg-foreground/10" : "text-muted-foreground/40"
                )}>{f.count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Results summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] text-muted-foreground/70">
          {filtered.length === 0
            ? "Nenhuma transação encontrada"
            : `Mostrando ${Math.min(visibleCount, filtered.length)} de ${filtered.length} transações`}
        </p>
        {filtered.length > 0 && (
          <p className="text-[12px] text-primary font-medium">{fmt(filtered.reduce((a, t) => a + Number(t.net_amount), 0))} no período</p>
        )}
      </div>

      {/* ─── Desktop table ─── */}
      <div className="hidden md:block rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center">
            <div className="h-7 w-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">Carregando transações...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/10">
                    {["Cliente", "Produto", "Líquido", "Método", "Status", "Data", ""].map((h) => (
                      <th key={h} className="text-left px-5 py-4 text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr><td colSpan={7}>
                      <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Nenhuma venda encontrada" subtitle="Tente ajustar os filtros ou período" />
                    </td></tr>
                  ) : visibleItems.map((tx, i) => (
                    <TxRow key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
            {visibleCount < filtered.length && (
              <div className="p-3 text-center border-t border-border/30">
                <Button variant="ghost" size="sm" onClick={loadMore} className="gap-2 text-xs text-muted-foreground hover:text-foreground font-medium">
                  <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Mobile cards ─── */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="p-12 text-center">
            <div className="h-7 w-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">Carregando...</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Nenhuma venda" subtitle="Tente ajustar os filtros" />
        ) : (
          <>
            {visibleItems.map((tx, i) => (
              <TxCard key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
            ))}
            {visibleCount < filtered.length && (
              <Button variant="ghost" size="sm" onClick={loadMore} className="w-full gap-2 text-xs text-muted-foreground font-medium">
                <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedTx && (
        <TransactionDetailPanel tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={handleRefund} />
      )}
      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        transactions={dateFiltered}
        products={products}
        productsRaw={productsRaw}
        onExport={handleExportCSV}
      />
    </div>
  );
}

/* ─── QualityLine (same as Dashboard) ─── */
function QualityLine({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "success" | "warning" | "destructive" | "info" }) {
  const styles: Record<string, { bg: string; text: string; ring: string }> = {
    success: { bg: "bg-success/10", text: "text-success", ring: "ring-success/20" },
    warning: { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/20" },
    destructive: { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/20" },
    info: { bg: "bg-info/10", text: "text-info", ring: "ring-info/20" },
  };

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card/90 shadow-sm backdrop-blur-xl px-4 py-3.5 transition-all duration-200 hover:bg-card hover:border-border/80">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center ring-1", styles[tone].bg, styles[tone].text, styles[tone].ring)}>{icon}</div>
      <span className="flex-1 text-[13px] font-semibold text-foreground/80">{label}</span>
      <span className="text-base font-display font-black text-foreground tabular-nums tracking-tight">{value}</span>
    </div>
  );
}
