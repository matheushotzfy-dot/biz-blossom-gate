import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
  ShoppingCart, DollarSign, TrendingUp, CreditCard, Search, X,
  Phone, Mail, Calendar as CalendarIcon, Clock, Hash, Package, ArrowUpRight,
  RefreshCw, Copy, Check, Users, Eye, MessageCircle, ChevronDown,
  Download, Smartphone, FileText, BarChart3, ArrowDownRight, Zap, Filter,
  MoreHorizontal, ExternalLink,
} from "lucide-react";
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
import { LineChart, Line, ResponsiveContainer } from "recharts";

/* ─── Formatters (cached) ─── */
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

/* ─── Avatar color generator ─── */
const AVATAR_COLORS = [
  "from-primary/80 to-primary/40",
  "from-info/80 to-info/40",
  "from-warning/80 to-warning/40",
  "from-success/80 to-success/40",
  "from-destructive/60 to-destructive/30",
  "from-accent-foreground/60 to-accent-foreground/30",
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

/* ─── Sparkline data builder ─── */
function buildSparkline(transactions: Tables<"transactions">[], days: number, field: "net_amount" | "amount" | "count") {
  const now = new Date();
  const data: { v: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = subDays(now, i);
    const dayStr = format(day, "yyyy-MM-dd");
    const dayTxs = transactions.filter(t => t.status === "completed" && t.created_at.startsWith(dayStr));
    if (field === "count") data.push({ v: dayTxs.length });
    else data.push({ v: dayTxs.reduce((a, t) => a + Number(t[field]), 0) });
  }
  return data;
}

/* ─── Status pill config ─── */
const STATUS_PILL_STYLES: Record<string, { active: string; dot: string }> = {
  all: { active: "bg-primary/12 text-primary border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.15)]", dot: "bg-primary" },
  completed: { active: "bg-success/12 text-success border-success/30 shadow-[0_0_12px_hsl(var(--success)/0.15)]", dot: "bg-success" },
  pending: { active: "bg-warning/12 text-warning border-warning/30 shadow-[0_0_12px_hsl(var(--warning)/0.15)]", dot: "bg-warning" },
  failed: { active: "bg-destructive/12 text-destructive border-destructive/30 shadow-[0_0_12px_hsl(var(--destructive)/0.15)]", dot: "bg-destructive" },
  refunded: { active: "bg-info/12 text-info border-info/30 shadow-[0_0_12px_hsl(var(--info)/0.15)]", dot: "bg-info" },
  chargeback: { active: "bg-destructive/12 text-destructive border-destructive/30 shadow-[0_0_12px_hsl(var(--destructive)/0.15)]", dot: "bg-destructive" },
};

/* ─── Premium KPI Card ─── */
function VendasKpi({ label, value, sub, icon: Icon, gradient, glowColor, trend, trendUp, sparkData, sparkColor }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>;
  gradient: string; glowColor: string; trend?: string; trendUp?: boolean;
  sparkData?: { v: number }[]; sparkColor?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-card/40 backdrop-blur-xl p-5"
    >
      {/* Glow effect */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[120%] h-24 rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-700 blur-3xl pointer-events-none" style={{ background: glowColor }} />
      
      {/* Sparkline background */}
      {sparkData && sparkData.length > 1 && (
        <div className="absolute bottom-0 right-0 w-[55%] h-[60%] opacity-20 group-hover:opacity-35 transition-opacity pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey="v" stroke={sparkColor || "hsl(var(--primary))"} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">{label}</span>
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg", gradient)}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <p className="text-[28px] md:text-[32px] font-display font-black text-foreground leading-none tracking-tight">{value}</p>
        <div className="flex items-center gap-2 mt-2.5">
          {trend && (
            <span className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-lg border",
              trendUp
                ? "bg-success/10 text-success border-success/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            )}>
              {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend}
            </span>
          )}
          {sub && <p className="text-[11px] text-muted-foreground/40 font-medium">{sub}</p>}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Transaction Row (Desktop) ─── */
function TxRow({ tx, products, onClick, index }: {
  tx: Tables<"transactions">; products: Record<string, string>; onClick: () => void; index: number;
}) {
  const methodConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pix: { icon: <Smartphone className="h-3 w-3" />, label: "PIX", color: "text-success bg-success/10 border-success/20" },
    credit_card: { icon: <CreditCard className="h-3 w-3" />, label: "Cartão", color: "text-info bg-info/10 border-info/20" },
    boleto: { icon: <FileText className="h-3 w-3" />, label: "Boleto", color: "text-warning bg-warning/10 border-warning/20" },
  };
  const method = methodConfig[tx.payment_method || ""] || { icon: null, label: tx.payment_method || "—", color: "text-muted-foreground bg-muted/30 border-border/30" };
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
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      onClick={onClick}
      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-all duration-200 cursor-pointer group"
    >
      <td className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={cn("bg-gradient-to-br text-white text-[11px] font-bold", avatarColor)}>
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground font-semibold text-[13px] leading-tight truncate">{customerName}</p>
            {tx.customer_email && <p className="text-muted-foreground/35 text-[11px] mt-0.5 truncate">{tx.customer_email}</p>}
          </div>
        </div>
      </td>
      <td className="p-4">
        <span className="text-foreground/60 text-[12px] font-medium max-w-[130px] truncate block">{tx.product_id ? (products[tx.product_id] || tx.product_id.slice(0, 8)) : "—"}</span>
      </td>
      <td className="p-4">
        <div>
          <span className="font-display font-black text-primary text-[16px] block drop-shadow-[0_0_8px_hsl(var(--primary)/0.3)]">
            {fmt(Number(tx.net_amount))}
          </span>
          {Number(tx.fee_amount) > 0 && (
            <span className="text-[10px] text-muted-foreground/30 font-medium">taxa: {fmt(Number(tx.fee_amount))}</span>
          )}
        </div>
      </td>
      <td className="p-4">
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border", method.color)}>
          {method.icon}
          {method.label}
        </span>
      </td>
      <td className="p-4"><StatusBadge status={tx.status} /></td>
      <td className="p-4">
        <div>
          <p className="text-foreground/50 text-[12px] font-medium">{fmtDate(tx.created_at)}</p>
          <p className="text-muted-foreground/25 text-[10px]">{fmtTime(tx.created_at)}</p>
        </div>
      </td>
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08]">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground/50" />
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-card/40 backdrop-blur-xl cursor-pointer active:scale-[0.98] transition-transform p-4"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className={cn("bg-gradient-to-br text-white text-xs font-bold", avatarColor)}>
              {getInitials(customerName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-foreground font-bold text-[14px] leading-tight truncate">{customerName}</p>
            <p className="text-muted-foreground/35 text-[11px] mt-0.5 truncate">{tx.customer_email || ""}</p>
          </div>
        </div>
        <StatusBadge status={tx.status} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-primary font-display font-black text-[22px] leading-none drop-shadow-[0_0_10px_hsl(var(--primary)/0.25)]">
            {fmt(Number(tx.net_amount))}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-muted-foreground/50 text-[10px] bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
              {methodLabels[tx.payment_method || ""] || tx.payment_method || "—"}
            </span>
            <span className="text-muted-foreground/25 text-[10px] font-medium truncate max-w-[100px]">
              {tx.product_id ? products[tx.product_id] || "Produto" : "—"}
            </span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <p className="text-muted-foreground/35 text-[11px] font-medium">{fmtDate(tx.created_at)}</p>
          {tx.customer_phone && (
            <a
              href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="h-9 w-9 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success hover:bg-success/20 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
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
  const [copiedId, setCopiedId] = useState(false);
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    toast.success("ID copiado!");
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-2xl"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-card/80 backdrop-blur-2xl shadow-2xl"
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

          <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-white/[0.06] bg-card/90 backdrop-blur-xl rounded-t-2xl">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] mb-1.5">Detalhes da Venda</p>
              <div className="flex items-center gap-3">
                <StatusBadge status={tx.status} />
                <span className="text-[28px] font-display font-black text-foreground">{fmt(Number(tx.amount))}</span>
              </div>
            </div>
            <button onClick={onClose} className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="relative p-6 space-y-6">
            <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] mb-4">Resumo Financeiro</p>
              <div className="space-y-3">
                <DetailRow label="Valor bruto" value={fmt(Number(tx.amount))} icon={<DollarSign className="h-3 w-3" />} />
                <DetailRow label="Taxa da plataforma" value={`- ${fmt(Number(tx.fee_amount))}`} className="text-destructive" icon={<ArrowDownRight className="h-3 w-3" />} />
                <div className="border-t border-white/[0.06] pt-3 mt-3">
                  <DetailRow label="Valor líquido (seu)" value={fmt(Number(tx.net_amount))} className="text-primary" bold icon={<Zap className="h-3 w-3" />} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">Informações da Venda</p>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                <DetailRow label="ID da venda" value={
                  <button onClick={() => handleCopyId(tx.id)} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-foreground/80 hover:text-primary transition-colors bg-white/[0.04] px-2 py-1 rounded-md border border-white/[0.08]">
                    {tx.id.slice(0, 16)}...
                    {copiedId ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground/40" />}
                  </button>
                } icon={<Hash className="h-3 w-3" />} />
                <DetailRow label="Método" value={tx.payment_method === "credit_card" ? "Cartão de crédito" : tx.payment_method === "pix" ? "PIX" : tx.payment_method || "—"} icon={<CreditCard className="h-3 w-3" />} />
                <DetailRow label="Data" value={fmtFull(tx.created_at)} icon={<CalendarIcon className="h-3 w-3" />} />
                {tx.product_id && <DetailRow label="Produto" value={products[tx.product_id] || tx.product_id.slice(0, 12)} icon={<Package className="h-3 w-3" />} />}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">Cliente</p>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                <DetailRow label="Nome" value={tx.customer_name || "—"} icon={<Users className="h-3 w-3" />} />
                <DetailRow label="Email" value={tx.customer_email || "—"} icon={<Mail className="h-3 w-3" />} />
                <DetailRow label="Telefone" value={tx.customer_phone || "—"} icon={<Phone className="h-3 w-3" />} />
                {tx.customer_document && <DetailRow label="CPF/CNPJ" value={tx.customer_document} icon={<Hash className="h-3 w-3" />} />}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {tx.customer_phone && (
                <a href={`https://wa.me/55${tx.customer_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full gap-2 rounded-xl h-11 border-success/20 text-success hover:bg-success/5 font-bold text-[13px]">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                </a>
              )}
              {tx.status === "completed" && (
                <Button variant="outline" className="flex-1 gap-2 rounded-xl h-11 border-destructive/20 text-destructive hover:bg-destructive/5 font-bold text-[13px]" onClick={() => onRefund(tx)}>
                  <RefreshCw className="h-4 w-4" /> Reembolsar
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function DetailRow({ label, value, icon, className = "", bold = false }: { label: string; value: React.ReactNode; icon?: React.ReactNode; className?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2 text-muted-foreground/45 text-[12px]">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`text-[13px] ${bold ? "font-black text-base" : "font-semibold"} ${className || "text-foreground"}`}>{value}</span>
    </div>
  );
}

/* ─── Segmented Date Control ─── */
function DateSegmentedControl({ datePreset, setDatePreset, customFrom, setCustomFrom, customTo, setCustomTo }: {
  datePreset: DatePreset; setDatePreset: (v: DatePreset) => void;
  customFrom: Date | undefined; setCustomFrom: (v: Date | undefined) => void;
  customTo: Date | undefined; setCustomTo: (v: Date | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="inline-flex items-center rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setDatePreset(p.value)}
            className={cn(
              "px-3 py-2 rounded-lg text-[11px] font-bold transition-all relative",
              datePreset === p.value
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground/50 hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(
            "px-3 py-2 rounded-xl text-[11px] font-bold transition-all border inline-flex items-center gap-1.5",
            datePreset === "custom"
              ? "bg-primary/12 text-primary border-primary/25"
              : "bg-white/[0.03] text-muted-foreground/50 border-white/[0.06] hover:text-foreground"
          )}>
            <CalendarIcon className="h-3 w-3" />
            {datePreset === "custom" && customFrom && customTo
              ? `${format(customFrom, "dd/MM", { locale: ptBR })} - ${format(customTo, "dd/MM", { locale: ptBR })}`
              : "Personalizado"
            }
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b border-border/40">
            <p className="text-xs font-bold text-foreground mb-1">Selecionar período</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-0 sm:gap-2">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground px-3 pt-2">De:</p>
              <Calendar mode="single" selected={customFrom} onSelect={(d) => { setCustomFrom(d); setDatePreset("custom"); }} locale={ptBR} className="p-3 pointer-events-auto" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground px-3 pt-2">Até:</p>
              <Calendar mode="single" selected={customTo} onSelect={(d) => { setCustomTo(d); setDatePreset("custom"); }} locale={ptBR} disabled={(date) => customFrom ? date < customFrom : false} className="p-3 pointer-events-auto" />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
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
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

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

  // Sparkline data
  const sparkRevenue = useMemo(() => buildSparkline(dateFiltered, 7, "net_amount"), [dateFiltered]);
  const sparkGross = useMemo(() => buildSparkline(dateFiltered, 7, "amount"), [dateFiltered]);
  const sparkTicket = useMemo(() => buildSparkline(dateFiltered, 7, "net_amount"), [dateFiltered]);
  const sparkCount = useMemo(() => buildSparkline(dateFiltered, 7, "count"), [dateFiltered]);

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

  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) { toast.error("Nenhuma transação para exportar."); return; }
    const headers = ["ID", "Cliente", "Email", "Telefone", "Produto", "Valor Bruto", "Taxa", "Líquido", "Método", "Status", "Data"];
    const rows = filtered.map(t => [
      t.id, t.customer_name || "", t.customer_email || "", t.customer_phone || "",
      t.product_id ? products[t.product_id] || "" : "", Number(t.amount), Number(t.fee_amount), Number(t.net_amount),
      t.payment_method || "", t.status, t.created_at,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${sanitizeCsvCell(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vendas-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação concluída!");
  }, [filtered, products, sanitizeCsvCell]);

  // Keyboard shortcut
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
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <PageTitle icon={<ShoppingCart className="h-6 w-6" />} title="Minhas Vendas" subtitle="Centro de comando de transações e receita" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 rounded-xl h-10 border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06] font-bold text-[12px]">
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <VendasKpi label="Receita Líquida" value={fmt(totalSales)} sub={`${approved.length} aprovadas`} icon={DollarSign} gradient="from-primary to-primary/70" glowColor="hsl(152 55% 40% / 0.15)" trend={approved.length > 0 ? `${conversion.toFixed(0)}% conv.` : undefined} trendUp={conversion > 50} sparkData={sparkRevenue} sparkColor="hsl(152, 55%, 50%)" />
        <VendasKpi label="Faturamento Bruto" value={fmt(totalGross)} sub="antes das taxas" icon={BarChart3} gradient="from-info to-info/70" glowColor="hsl(210 70% 50% / 0.12)" sparkData={sparkGross} sparkColor="hsl(210, 70%, 55%)" />
        <VendasKpi label="Ticket Médio" value={fmt(avgTicket)} sub="por venda aprovada" icon={TrendingUp} gradient="from-warning to-warning/70" glowColor="hsl(38 92% 50% / 0.12)" sparkData={sparkTicket} sparkColor="hsl(38, 92%, 55%)" />
        <VendasKpi label="Total Transações" value={String(dateFiltered.length)} sub={`${statusFilters.find(f => f.value === "pending")?.count || 0} pendentes`} icon={Users} gradient="from-accent-foreground to-accent-foreground/70" glowColor="hsl(152 52% 24% / 0.12)" sparkData={sparkCount} sparkColor="hsl(152, 52%, 40%)" />
      </div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        {/* Date + Search Row */}
        <div className="flex flex-col lg:flex-row gap-3">
          <DateSegmentedControl
            datePreset={datePreset} setDatePreset={setDatePreset}
            customFrom={customFrom} setCustomFrom={setCustomFrom}
            customTo={customTo} setCustomTo={setCustomTo}
          />
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/25" />
            <input
              id="vendas-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, e-mail, WhatsApp ou ID..."
              className="w-full h-10 pl-11 pr-20 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/25 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {search ? (
                <button onClick={() => setSearch("")} className="p-1">
                  <X className="h-3.5 w-3.5 text-muted-foreground/30 hover:text-foreground transition-colors" />
                </button>
              ) : (
                <kbd className="hidden md:inline-flex items-center gap-0.5 text-[9px] font-bold text-muted-foreground/30 bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded-md">
                  ⌘K
                </kbd>
              )}
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {statusFilters.map((f) => {
            const isActive = statusFilter === f.value;
            const style = STATUS_PILL_STYLES[f.value];
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold transition-all border",
                  isActive
                    ? style.active
                    : "bg-white/[0.02] text-muted-foreground/45 border-white/[0.06] hover:border-white/[0.12] hover:text-foreground"
                )}
              >
                {isActive && <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", style.dot)} />}
                {f.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-md font-black min-w-[22px] text-center",
                  isActive ? "bg-white/10" : "bg-white/[0.04] text-muted-foreground/30"
                )}>{f.count}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Results summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] text-muted-foreground/40 font-medium">
          {filtered.length === 0
            ? "Nenhuma transação encontrada"
            : `Mostrando ${Math.min(visibleCount, filtered.length)} de ${filtered.length} transações`}
        </p>
        {filtered.length > 0 && (
          <p className="text-[12px] text-primary font-bold">{fmt(filtered.reduce((a, t) => a + Number(t.net_amount), 0))} no período</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-2xl border border-white/[0.06] bg-card/30 backdrop-blur-xl overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="h-8 w-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground/40 font-medium">Carregando transações...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Cliente", "Produto", "Líquido", "Método", "Status", "Data", ""].map((h) => (
                      <th key={h} className="text-left p-4 text-[10px] font-black text-muted-foreground/35 uppercase tracking-[0.2em]">{h}</th>
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
              <div className="p-4 border-t border-white/[0.04] text-center">
                <Button variant="ghost" size="sm" onClick={loadMore} className="gap-2 text-xs text-muted-foreground/50 hover:text-foreground font-bold">
                  <ChevronDown className="h-3.5 w-3.5" /> Carregar mais ({filtered.length - visibleCount} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-white/[0.06] bg-card/30 backdrop-blur-xl p-12 text-center">
            <div className="h-8 w-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground/40 font-medium">Carregando...</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="h-7 w-7" />} title="Nenhuma venda" subtitle="Tente ajustar os filtros" />
        ) : (
          <>
            {visibleItems.map((tx, i) => (
              <TxCard key={tx.id} tx={tx} products={products} onClick={() => setSelectedTx(tx)} index={i} />
            ))}
            {visibleCount < filtered.length && (
              <Button variant="ghost" size="sm" onClick={loadMore} className="w-full gap-2 text-xs text-muted-foreground font-bold">
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
    </PageShell>
  );
}
