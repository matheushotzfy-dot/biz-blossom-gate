import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
  ShoppingCart, DollarSign, TrendingUp, CreditCard, Search, X, EyeOff,
  Phone, Mail, Calendar as CalendarIcon, Clock, Hash, Package, ArrowUpRight,
  RefreshCw, Copy, Check, Users, Eye, MessageCircle, ChevronDown,
  Download, Smartphone, FileText, BarChart3, ArrowDownRight, Zap, Filter,
  MoreHorizontal, ExternalLink, Receipt, CheckSquare, Square,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
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
const fmtFull = (d: string) => `${fmtDate(d)} às ${fmtTime(d)}`;

type StatusFilter = "all" | "completed" | "pending" | "failed" | "refunded" | "chargeback";
type DatePreset = "today" | "yesterday" | "7d" | "15d" | "30d" | "custom" | "all";

const PAGE_SIZE = 50;

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: "Hoje", value: "today" },
  { label: "Ontem", value: "yesterday" },
  { label: "7 dias", value: "7d" },
  { label: "15 dias", value: "15d" },
  { label: "30 dias", value: "30d" },
  { label: "Tudo", value: "all" },
];

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

/* ─── Glass KPI Card ─── */
function VendasKpi({ label, value, sub, icon: Icon, iconBg, iconColor }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>;
  iconBg: string; iconColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-5 relative overflow-hidden group hover:border-border/70 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-[11px] font-medium text-muted-foreground tracking-wide">{label}</span>
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", iconBg)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </div>
      <p className="text-[22px] font-display font-bold text-foreground leading-none tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/60 mt-2">{sub}</p>}
    </motion.div>
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

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
      onClick={onClick}
      className="border-b border-border/30 dark:border-foreground/[0.04] hover:bg-muted/20 dark:hover:bg-foreground/[0.02] transition-colors cursor-pointer group"
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className={cn("text-[11px] font-bold", avatarColor)}>
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground font-medium text-[13px] leading-tight truncate">{customerName}</p>
            {tx.customer_email && <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      <td className="p-4">
        <span className="text-muted-foreground text-[12px] font-medium max-w-[130px] truncate block">{tx.product_id ? (products[tx.product_id] || tx.product_id.slice(0, 8)) : "—"}</span>
      </td>
      <td className="p-4">
        <div>
          <span className="font-display font-bold text-foreground text-[15px] block">
            {fmt(Number(tx.net_amount))}
          </span>
          {Number(tx.fee_amount) > 0 && (
            <span className="text-[10px] text-muted-foreground">taxa: {fmt(Number(tx.fee_amount))}</span>
          )}
        </div>
      </td>
      <td className="p-4">
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md", method.color)}>
          {method.icon}
          {method.label}
        </span>
      </td>
      <td className="p-4"><StatusBadge status={tx.status} /></td>
      <td className="p-4">
        <div>
          <p className="text-foreground/70 text-[12px] font-medium">{fmtDate(tx.created_at)}</p>
          <p className="text-muted-foreground text-[10px]">{fmtTime(tx.created_at)}</p>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4 cursor-pointer active:scale-[0.99] transition-transform"
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
        <StatusBadge status={tx.status} />
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

/* ─── Detail Modal ─── */
function TxDetailModal({ tx, products, onClose, onRefund }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClose: () => void; onRefund: (tx: Tables<"transactions">) => void;
}) {
  return <TransactionDetailPanel tx={tx} products={products} onClose={onClose} onRefund={onRefund} />;
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      {value}
    </div>
  );
}

/* ─── Date Segmented Control ─── */
function DateSegmentedControl({ datePreset, setDatePreset, customFrom, setCustomFrom, customTo, setCustomTo }: {
  datePreset: DatePreset; setDatePreset: (v: DatePreset) => void;
  customFrom: Date | undefined; setCustomFrom: (v: Date | undefined) => void;
  customTo: Date | undefined; setCustomTo: (v: Date | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Segmented Control — single container, no individual borders */}
      <div className="inline-flex items-center rounded-lg bg-muted/30 dark:bg-foreground/[0.04] p-1">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setDatePreset(p.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
              datePreset === p.value
                ? "bg-card dark:bg-foreground/[0.08] text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(
            "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all inline-flex items-center gap-1.5",
            datePreset === "custom"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}>
            <CalendarIcon className="h-3 w-3" />
            {datePreset === "custom" && customFrom && customTo
              ? `${format(customFrom, "dd/MM", { locale: ptBR })} - ${format(customTo, "dd/MM", { locale: ptBR })}`
              : "Personalizado"
            }
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b border-border/30">
            <p className="text-xs font-medium text-foreground mb-1">Selecionar período</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-0 sm:gap-2">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground px-3 pt-2">De:</p>
              <Calendar mode="single" selected={customFrom} onSelect={(d) => { setCustomFrom(d); setDatePreset("custom"); }} locale={ptBR} className="p-3 pointer-events-auto" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground px-3 pt-2">Até:</p>
              <Calendar mode="single" selected={customTo} onSelect={(d) => { setCustomTo(d); setDatePreset("custom"); }} locale={ptBR} disabled={(date) => customFrom ? date < customFrom : false} className="p-3 pointer-events-auto" />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
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
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  };
  const toggleMethod = (v: string) => {
    setSelectedMethods(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  };
  const toggleProduct = (id: string) => {
    if (id === "all") {
      setSelectedProducts(new Set(["all"]));
      return;
    }
    setSelectedProducts(prev => {
      const next = new Set(prev);
      next.delete("all");
      next.has(id) ? next.delete(id) : next.add(id);
      if (next.size === 0) next.add("all");
      return next;
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

  const handleExport = () => {
    onExport(exportFiltered);
    onOpenChange(false);
  };

  // Unique products from transactions
  const txProducts = useMemo(() => {
    const ids = new Set(transactions.map(t => t.product_id).filter(Boolean) as string[]);
    return Array.from(ids).map(id => ({ id, name: products[id] || id.slice(0, 8) }));
  }, [transactions, products]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/40 dark:border-foreground/[0.06] bg-card/95 dark:bg-card/90 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Download className="h-5 w-5 text-primary" />
            Exportar Vendas
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">
            Escolha os filtros para a exportação CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Status filter */}
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
                  <button
                    key={s.value}
                    onClick={() => toggleStatus(s.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/30 dark:border-foreground/[0.06] text-muted-foreground hover:border-border/50"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", active ? s.dot : "bg-muted-foreground/30")} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment method filter */}
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
                  <button
                    key={m.value}
                    onClick={() => toggleMethod(m.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/30 dark:border-foreground/[0.06] text-muted-foreground hover:border-border/50"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product filter */}
          {txProducts.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Produtos</p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                <button
                  onClick={() => toggleProduct("all")}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left",
                    selectedProducts.has("all")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  {selectedProducts.has("all")
                    ? <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                    : <Square className="h-3.5 w-3.5 shrink-0" />
                  }
                  Todos os produtos
                </button>
                {txProducts.map(p => {
                  const active = selectedProducts.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleProduct(p.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      {active
                        ? <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                        : <Square className="h-3.5 w-3.5 shrink-0" />
                      }
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview count */}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-lg h-10 text-[12px] font-medium">
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={exportFiltered.length === 0} className="flex-1 rounded-lg h-10 gap-2 text-[12px] font-medium">
            <Download className="h-3.5 w-3.5" />
            Exportar {exportFiltered.length > 0 ? `(${exportFiltered.length})` : ""}
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
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
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

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, statusFilter, datePreset]);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (datePreset === "all") return null;
    if (datePreset === "custom" && customFrom && customTo) return { from: startOfDay(customFrom), to: endOfDay(customTo) };
    if (datePreset === "custom") return null;
    const days: Record<string, number> = { today: 0, yesterday: 1, "7d": 7, "15d": 15, "30d": 30 };
    const d = days[datePreset] ?? 30;
    if (datePreset === "yesterday") return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    return { from: startOfDay(subDays(now, d)), to: endOfDay(now) };
  }, [datePreset, customFrom, customTo]);

  const dateFiltered = useMemo(() => {
    if (!dateRange) return transactions;
    return transactions.filter(t => {
      const d = new Date(t.created_at);
      return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
    });
  }, [transactions, dateRange]);

  const approved = useMemo(() => dateFiltered.filter((t) => t.status === "completed"), [dateFiltered]);
  const totalSales = useMemo(() => approved.reduce((a, t) => a + Number(t.net_amount), 0), [approved]);
  const avgTicket = useMemo(() => approved.length > 0 ? totalSales / approved.length : 0, [approved, totalSales]);
  const conversion = useMemo(() => dateFiltered.length > 0 ? (approved.length / dateFiltered.length) * 100 : 0, [approved, dateFiltered]);
  const totalGross = useMemo(() => approved.reduce((a, t) => a + Number(t.amount), 0), [approved]);

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
    <PageShell>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageTitle icon={<Receipt className="h-6 w-6" />} title="Minhas Vendas" subtitle="Acompanhe todas as suas transações" />
        <div className="flex items-center gap-2">
          <button
            onClick={togglePrivacy}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/25"
            title={privacyHidden ? "Mostrar valores" : "Ocultar valores"}
          >
            {privacyHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
          </button>
          <Button variant="ghost" size="sm" onClick={() => setShowExportDialog(true)} className="gap-2 rounded-lg h-9 font-medium text-[12px] text-muted-foreground hover:text-foreground">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPIs — Glass cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <VendasKpi label="Receita Líquida" value={privacyHidden ? "••••••" : fmt(totalSales)} sub={privacyHidden ? "••••" : `${approved.length} aprovadas`} icon={DollarSign} iconBg="bg-primary/10" iconColor="text-primary" />
        <VendasKpi label="Faturamento Bruto" value={privacyHidden ? "••••••" : fmt(totalGross)} sub="antes das taxas" icon={BarChart3} iconBg="bg-info/10" iconColor="text-info" />
        <VendasKpi label="Ticket Médio" value={privacyHidden ? "••••••" : fmt(avgTicket)} sub="por venda aprovada" icon={TrendingUp} iconBg="bg-warning/10" iconColor="text-warning" />
        <VendasKpi label="Total Transações" value={privacyHidden ? "••••••" : String(dateFiltered.length)} sub={privacyHidden ? "••••" : `${conversion.toFixed(0)}% conversão`} icon={Users} iconBg="bg-accent" iconColor="text-accent-foreground" />
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <DateSegmentedControl
            datePreset={datePreset} setDatePreset={setDatePreset}
            customFrom={customFrom} setCustomFrom={setCustomFrom}
            customTo={customTo} setCustomTo={setCustomTo}
          />
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <input
              id="vendas-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, e-mail, WhatsApp ou ID..."
              className="w-full h-9 pl-10 pr-16 rounded-lg bg-muted/30 dark:bg-foreground/[0.03] border border-border/40 dark:border-foreground/[0.05] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
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

        {/* Status Pills — subtle, no heavy borders */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {statusFilters.map((f) => {
            const isActive = statusFilter === f.value;
            const style = STATUS_PILL_STYLES[f.value];
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                  isActive
                    ? style.active
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {isActive && <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />}
                {f.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium min-w-[20px] text-center",
                  isActive ? "bg-foreground/10" : "text-muted-foreground/60"
                )}>{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>

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

      {/* Desktop table */}
      <div className="hidden md:block rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl overflow-hidden">
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
                  <tr className="border-b border-border/40">
                    {["Cliente", "Produto", "Líquido", "Método", "Status", "Data", ""].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">{h}</th>
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

      {/* Mobile cards */}
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
        <TxDetailModal tx={selectedTx} products={products} onClose={() => setSelectedTx(null)} onRefund={handleRefund} />
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
    </PageShell>
  );
}
