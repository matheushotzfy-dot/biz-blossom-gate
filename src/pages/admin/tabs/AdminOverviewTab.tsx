import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import {
  DollarSign, Users, TrendingUp, CheckCircle2, XCircle,
  CreditCard, Package, Activity, Percent, ShieldAlert, RotateCcw, Lock,
  Eye, Radio, AlertCircle, UserCheck, Flame, Wallet, CalendarDays,
  Clock3, Hourglass, UserPlus, ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line,
} from "recharts";
import KycReviewDialog from "@/components/admin/KycReviewDialog";
import type { Tables } from "@/integrations/supabase/types";
import { cn, isApprovedTransaction } from "@/lib/utils";
import React from "react";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import {
  PremiumPanel, PremiumMetric, PremiumMetricGrid, PremiumSegmented, premiumTable,
} from "./AdminPremium";
import { AdminOverviewMetrics } from "@/features/admin-finance/AdminOverviewMetrics";
import { AdminAlertsBanner } from "@/components/admin/AdminAlertsBanner";

interface Dispute {
  id: string; type: string; status: string; seller_user_id: string;
  amount: number; created_at: string; transaction_id: string | null;
}

interface Props {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
  withdrawals: Tables<"withdrawals">[];
  onWithdrawalAction: (id: string, action: "approved" | "rejected") => void;
  onUserStatus: (userId: string, status: string) => void;
  onReload?: () => void;
  fmtCurrency: (v: number) => string;
  isEmployee?: boolean;
  dateRange?: { from: Date; to: Date };
  onNavigate?: (tabId: string) => void;
  financialOverview?: AdminFinancialOverview | null;
}

export interface AdminFinancialOverview {
  summary?: { gross_volume?: number; net_volume?: number; platform_fees?: number; acquirer_fees?: number; profit?: number; total_count?: number; approved_count?: number; pending_count?: number; chargeback_count?: number; refunded_amount?: number; retained_amount?: number; simulated_count?: number; active_sellers?: number };
  month?: { gross_volume?: number; approved_count?: number; platform_fees?: number; profit?: number };
  operations?: { pending_withdrawals_count?: number; pending_withdrawals_amount?: number; open_disputes_count?: number; open_disputes_amount?: number };
}

type Tone = "primary" | "success" | "warning" | "destructive" | "info" | "neutral";

/* ═════════════════════════════════════════════════════════════
   PREMIUM KIT — soft surfaces, generous radius, semantic tokens
   Inspired by AdminTopSellersTab. Works in light + dark via the
   admin-shell token cascade.
   ═════════════════════════════════════════════════════════════ */

const TONE_TEXT: Record<Tone, string> = {
  primary:     "text-primary",
  success:     "text-success",
  warning:     "text-warning",
  destructive: "text-destructive",
  info:        "text-info",
  neutral:     "text-foreground",
};
const TONE_PILL: Record<Tone, string> = {
  primary:     "bg-primary/10 text-primary border-primary/20",
  success:     "bg-success/10 text-success border-success/20",
  warning:     "bg-warning/10 text-warning border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  info:        "bg-info/10 text-info border-info/20",
  neutral:     "bg-muted/40 text-muted-foreground border-border/60",
};
const TONE_BAR: Record<Tone, string> = {
  primary:     "bg-primary",
  success:     "bg-success",
  warning:     "bg-warning",
  destructive: "bg-destructive",
  info:        "bg-info",
  neutral:     "bg-muted-foreground",
};

function Pill({ tone = "neutral", children, className }: {
  tone?: Tone; children: React.ReactNode; className?: string;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[9.5px] font-black uppercase tracking-wider",
      TONE_PILL[tone], className,
    )}>
      {children}
    </span>
  );
}

/* Tooltip — solid card, rounded, no glow */
type ChartTipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
  fmtCurrency: (n: number) => string;
};
function ChartTip({ active, payload, label, fmtCurrency }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm pointer-events-none">
      {label && (
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </span>
            <span className="font-bold tabular-nums text-foreground">
              {typeof p.value === "number" && p.value > 100 ? fmtCurrency(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   COMPONENT
   ═════════════════════════════════════════════════════════════ */

export default function AdminOverviewTab({
  transactions, profiles, products, withdrawals,
  onWithdrawalAction, onReload, fmtCurrency,
  isEmployee = false, dateRange, onNavigate, financialOverview,
}: Props) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [realtimeTx, setRealtimeTx] = useState<Tables<"transactions">[]>([]);
  const [fraudLogs, setFraudLogs] = useState<Tables<"fraud_logs">[]>([]);
  const [kycReview, setKycReview] = useState<Tables<"profiles"> | null>(null);
  const [selectedTx, setSelectedTx] = useState<Tables<"transactions"> | null>(null);

  const productsMap = useMemo(() => {
    const m: Record<string, string> = {};
    products.forEach(p => { m[p.id] = p.name; });
    return m;
  }, [products]);
  const sellerFor = (uid: string) => {
    const p = profiles.find(pr => pr.user_id === uid);
    return p ? { full_name: p.full_name, email: p.email, nickname: p.nickname } : null;
  };

  // KYC decisions go through the audited owner routines (same as the Sellers tab):
  // approval also assigns the default manager; never write account_status directly here.
  const handleKycApprove = async (userId: string) => {
    const { error } = await supabase.rpc("admin_approve_seller_with_manager", { _seller: userId });
    if (error) { toast.error("Erro ao aprovar KYC"); return; }
    toast.success("KYC aprovado!");
    onReload?.();
  };

  const handleKycReject = async (userId: string, reason: string) => {
    const { error } = await supabase.rpc("admin_reject_kyc", { _user_id: userId, _reason: reason });
    if (error) { toast.error("Erro ao recusar KYC"); return; }
    toast.success("KYC recusado");
    onReload?.();
  };

  useEffect(() => {
    Promise.all([
      supabase.from("disputes").select("id,type,status,seller_user_id,amount,created_at,transaction_id").order("created_at", { ascending: false }).limit(500),
      supabase.from("fraud_logs").select("*").order("created_at", { ascending: false }).limit(20),
    ]).then(([dRes, fRes]) => {
      if (dRes.data) setDisputes(dRes.data as Dispute[]);
      if (fRes.data) setFraudLogs(fRes.data);
    });
  }, []);

  useEffect(() => {
    setRealtimeTx(transactions.slice(0, 25));
  }, [transactions]);

  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName("admin-god-mode-tx"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        setRealtimeTx(prev => [payload.new as Tables<"transactions">, ...prev].slice(0, 25));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" }, (payload) => {
        setRealtimeTx(prev => prev.map(t => t.id === (payload.new as Tables<"transactions">).id ? payload.new as Tables<"transactions"> : t));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  /* ── Computations (preserved verbatim) ── */
  const allTx = transactions;
  const approved = useMemo(() => allTx.filter(t => isApprovedTransaction(t.status)), [allTx]);
  const filteredTx = useMemo(() => {
    if (!dateRange) return allTx;
    return allTx.filter(t => { const d = new Date(t.created_at); return d >= dateRange.from && d <= dateRange.to; });
  }, [allTx, dateRange]);
  const filteredApproved = useMemo(() => filteredTx.filter(t => isApprovedTransaction(t.status)), [filteredTx]);

  const pendingWd = withdrawals.filter(w => w.status === "pending");
  const pendingMeds = useMemo(() => disputes.filter(d => ["medpix", "pre_med_pix"].includes(d.type) && ["open", "in_review"].includes(d.status)), [disputes]);
  const summaryTotalCount = Number(financialOverview?.summary?.total_count ?? filteredTx.length);
  const summaryApprovedCount = Number(financialOverview?.summary?.approved_count ?? filteredApproved.length);
  const conversionRate = summaryTotalCount > 0 ? (summaryApprovedCount / summaryTotalCount * 100).toFixed(1) : "0.0";
  const rangeLabel = dateRange ? `${dateRange.from.toLocaleDateString("pt-BR")} → ${dateRange.to.toLocaleDateString("pt-BR")}` : "Período selecionado";

  const statusLabelMap: Record<string, string> = {
    completed: "Pago", approved: "Pago", pending: "Pendente",
    failed: "Recusado", expired: "Expirado", refunded: "Estornado", chargeback: "CB",
  };
  const statusToneMap: Record<string, Tone> = {
    completed: "success", approved: "success", pending: "warning",
    failed: "destructive", expired: "neutral", refunded: "info", chargeback: "destructive",
  };


  /* ── Employee view ── */
  if (isEmployee) {
    return (
      <div className="space-y-6 animate-fade-in">
        <FinanceiroHero
          eyebrow="Painel Staff"
          title="Visão geral"
          subtitle="Acesso restrito a operações autorizadas."
          status={{ tone: "info", label: "Staff", pulse: true }}
        />
        <PremiumMetricGrid cols={4}>
          <PremiumMetric icon={Users} label="Sellers" value={String(profiles.length)} sub="Cadastrados" tone="primary" />
          <PremiumMetric icon={Package} label="Produtos" value={String(products.length)} sub={`${products.filter(p => p.status === "active").length} ativos`} tone="info" />
          <PremiumMetric icon={CreditCard} label="Transações" value={String(allTx.length)} sub={`${approved.length} aprovadas`} tone="success" />
          <PremiumMetric icon={Percent} label="Conversão" value={`${conversionRate}%`} sub={`${summaryApprovedCount.toLocaleString("pt-BR")}/${summaryTotalCount.toLocaleString("pt-BR")}`} tone="warning" />
        </PremiumMetricGrid>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════════
     ADMIN VIEW
     ═════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Hero (matches seller Financeiro aesthetic) ── */}
      <FinanceiroHero
        eyebrow="Admin · Command Center"
        title="Visão Geral"
        subtitle={`Operação em tempo real · ${rangeLabel}`}
        status={{ tone: "info", label: "Dados reais", pulse: false }}
      />

      {/* ── Alertas críticos abertos ── */}
      <AdminAlertsBanner isAdmin={!isEmployee} />



      <AdminOverviewMetrics dateRange={dateRange} refreshSignal={financialOverview} onNavigate={onNavigate} />

      {/* ── Live activity + Risk alerts ── */}
      <div className="grid grid-cols-1 gap-5">
        <div>
          <PremiumPanel
            title="Atividade ao vivo"
            icon={Radio}
            eyebrow={`${realtimeTx.length} eventos em tempo real`}
          >
            <div className={premiumTable.wrapper}>
              <table className={premiumTable.table}>
                <thead>
                  <tr className={premiumTable.headRow}>
                    <th className={premiumTable.th}>Status</th>
                    <th className={premiumTable.th}>Cliente</th>
                    <th className={premiumTable.th}>Método</th>
                    <th className={cn(premiumTable.th, "text-right")}>Valor</th>
                    <th className={cn(premiumTable.th, "text-right")}>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {realtimeTx.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-xs font-bold text-muted-foreground">Aguardando transações…</td></tr>
                  )}
                  {realtimeTx.slice(0, 8).map(t => {
                    const tone = statusToneMap[t.status] || "neutral";
                    return (
                      <tr key={t.id} className={cn(premiumTable.row, "cursor-pointer")} onClick={() => setSelectedTx(t)}>
                        <td className={premiumTable.td}><Pill tone={tone}>{statusLabelMap[t.status] || t.status}</Pill></td>
                        <td className={cn(premiumTable.td, "max-w-[180px] truncate text-xs font-bold text-foreground")}>
                          {t.customer_name || "Anônimo"}
                        </td>
                        <td className={cn(premiumTable.td, "text-[10.5px] font-bold uppercase text-muted-foreground")}>
                          {t.payment_method || "—"}
                        </td>
                        <td className={cn(premiumTable.td, "text-right text-xs font-black text-foreground tabular-nums")}>
                          {fmtCurrency(Number(t.amount))}
                        </td>
                        <td className={cn(premiumTable.td, "text-right text-[10.5px] font-bold text-muted-foreground tabular-nums")}>
                          {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PremiumPanel>
        </div>

      </div>

      {/* ── KYC queue + Pending withdrawals ── */}
      <div className="grid grid-cols-1 gap-5">
        <PremiumPanel
          title={`Saques em revisão (${pendingWd.length})`}
          icon={Wallet}
          action={onNavigate && (
            <button onClick={() => onNavigate("withdrawals")}
                    className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-primary hover:underline">
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        >
          {pendingWd.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
                <CheckCircle2 className="h-5 w-5 opacity-50" />
              </div>
              <p className="text-xs font-bold">Nenhum saque pendente</p>
            </div>
          ) : (
            <div className="max-h-[340px] overflow-y-auto -mx-2">
              {pendingWd.slice(0, 10).map(w => {
                const sp = profiles.find(p => p.user_id === w.user_id);
                const isNew = sp ? (Date.now() - new Date(sp.created_at).getTime()) / (1000 * 60 * 60 * 24) < 30 : false;
                const isHigh = Number(w.amount) >= 5000;
                return (
                  <div key={w.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-display text-sm font-black text-foreground tabular-nums">
                          {fmtCurrency(Number(w.amount))}
                        </span>
                        {isHigh && <Pill tone="warning">Alto</Pill>}
                        {isNew && <Pill tone="info">Novo</Pill>}
                      </div>
                      <p className="truncate text-[10.5px] font-bold text-muted-foreground">
                        {sp?.full_name || "—"} · {sp?.email || ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => onWithdrawalAction(w.id, "approved")}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-success/30 bg-success/10 px-2.5 text-[10.5px] font-black text-success hover:bg-success/15">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </button>
                      <button onClick={() => onWithdrawalAction(w.id, "rejected")}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PremiumPanel>
      </div>

      {/* ── MEDs ── */}
      <PremiumPanel
        title={`MEDs Pendentes (${pendingMeds.length})`}
        icon={AlertCircle}
        action={onNavigate && (
          <button onClick={() => onNavigate("medpix")}
                  className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-primary hover:underline">
            Ver todos <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      >
        {pendingMeds.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
              <CheckCircle2 className="h-5 w-5 opacity-50" />
            </div>
            <p className="text-xs font-bold">Nenhum MED em aberto</p>
          </div>
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  <th className={premiumTable.th}>Valor</th>
                  <th className={premiumTable.th}>Tipo</th>
                  <th className={premiumTable.th}>Status</th>
                  <th className={premiumTable.th}>Seller</th>
                  <th className={premiumTable.th}>TX</th>
                </tr>
              </thead>
              <tbody>
                {pendingMeds.slice(0, 10).map(d => {
                  const tx = transactions.find(t => t.id === d.transaction_id);
                  const seller = profiles.find(p => p.user_id === d.seller_user_id);
                  return (
                    <tr key={d.id} className={cn(premiumTable.row, "cursor-pointer")}
                        onClick={() => onNavigate?.("medpix")}>
                      <td className={cn(premiumTable.td, "font-display text-sm font-black text-foreground tabular-nums")}>
                        {fmtCurrency(Number(d.amount))}
                      </td>
                      <td className={premiumTable.td}>
                        <Pill tone="destructive">{d.type === "medpix" ? "MED" : d.type === "pre_med_pix" ? "Pre-MED" : "Reemb"}</Pill>
                      </td>
                      <td className={premiumTable.td}>
                        <Pill tone="warning">{d.status === "open" ? "Aberto" : "Em análise"}</Pill>
                      </td>
                      <td className={cn(premiumTable.td, "max-w-[200px] truncate text-xs font-bold text-foreground")}>
                        {seller?.full_name || "—"}
                      </td>
                      <td className={cn(premiumTable.td, "font-mono text-[10.5px] text-muted-foreground")}>
                        {d.transaction_id?.slice(0, 8) || "—"} · {tx?.payment_method || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumPanel>

      {/* ── Fraud blocks ── */}
      <PremiumPanel title="Bloqueios Anti-Fraude" icon={ShieldAlert}>
        {fraudLogs.length > 0 ? (
          <div className="grid max-h-[320px] grid-cols-1 gap-2.5 overflow-y-auto md:grid-cols-2">
            {fraudLogs.slice(0, 20).map((f) => (
              <div key={f.id} className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  <span className="truncate text-xs font-black text-destructive">
                    {f.block_reason || "Blocked"}
                  </span>
                  <span className="ml-auto text-[10px] font-bold text-muted-foreground tabular-nums">
                    {new Date(f.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {f.block_type && <Pill tone="destructive">{f.block_type}</Pill>}
                  {f.matched_type && <Pill tone="warning">{f.matched_type}</Pill>}
                  {f.customer_email && (
                    <span className="truncate text-[10.5px] font-bold text-muted-foreground">
                      {f.customer_email}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-xs font-bold text-muted-foreground">Nenhum bloqueio recente</p>
        )}
      </PremiumPanel>

      <KycReviewDialog
        profile={kycReview}
        open={!!kycReview}
        onClose={() => setKycReview(null)}
        onApprove={handleKycApprove}
        onReject={handleKycReject}
      />
      {selectedTx && (
        <TransactionDetailPanel
          tx={selectedTx}
          products={productsMap}
          onClose={() => setSelectedTx(null)}
          variant="admin"
          seller={sellerFor(selectedTx.user_id)}
        />
      )}
    </div>
  );
}

/* ─── Subcomponents ───────────────────────────────────────── */

function HeroStat({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="bg-card p-3.5">
      <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">{label}</p>
      <p className={cn("mt-2 font-display text-[17px] font-black tabular-nums leading-none tracking-tight", TONE_TEXT[tone])}>
        {value}
      </p>
    </div>
  );
}

function HeroBigStat({ label, value, sub, tone, wide }: {
  label: string; value: string; sub?: string; tone: Tone; wide?: boolean;
}) {
  return (
    <div className={cn(
      "group relative bg-card p-4 sm:p-5 transition-colors hover:bg-muted/20",
      wide && "lg:col-span-2",
    )}>
      <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">{label}</p>
      <p className={cn(
        "mt-2.5 font-display font-black leading-none tracking-tight tabular-nums break-words",
        wide ? "text-[28px] sm:text-[36px]" : "text-[20px] sm:text-[24px]",
        TONE_TEXT[tone],
      )}>
        {value}
      </p>
      {sub && <p className="mt-2 text-[10.5px] font-bold text-muted-foreground/75 truncate">{sub}</p>}
      <span className={cn("absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100", TONE_BAR[tone])} />
    </div>
  );
}

function PulseStat({ icon: Icon, label, value, tone }: {
  icon: LucideIcon; label: string; value: string; tone: Tone;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon className={cn("h-3 w-3 shrink-0", TONE_TEXT[tone])} strokeWidth={2.4} />
        <span className="truncate text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span>
      </span>
      <span className={cn("shrink-0 text-xs font-black tabular-nums", TONE_TEXT[tone])}>{value}</span>
    </div>
  );
}

function CommandMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-primary px-3 py-2.5">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary-foreground/70">{label}</p>
      <p className="mt-1 font-display text-lg font-black leading-none text-primary-foreground tabular-nums">{value}</p>
    </div>
  );
}

function DashboardKpi({ icon: Icon, label, value, sub, tone, onClick }: {
  icon: LucideIcon; label: string; value: string; sub?: string; tone: Tone; onClick?: () => void;
}) {
  const isInteractive = typeof onClick === "function";
  const Tag = (isInteractive ? "button" : "div") as React.ElementType;
  return (
    <Tag
      type={isInteractive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "admin-card group relative overflow-hidden rounded-xl border border-border/60 bg-card px-5 py-4 text-left transition-colors duration-200",
        isInteractive && "cursor-pointer hover:border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/70">{label}</p>
        <Icon className={cn("h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-90", TONE_TEXT[tone])} strokeWidth={2.2} />
      </div>
      <p className="mt-4 break-words font-display text-[26px] font-black leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {sub && <p className="mt-2 truncate text-[11px] font-medium text-muted-foreground/75">{sub}</p>}
      <span className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100", TONE_BAR[tone])} />
    </Tag>
  );
}

function RiskRow({ label, value, threshold, alert }: {
  label: string; value: string; threshold: string; alert: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors",
      alert ? "border-destructive/25 bg-destructive/5" : "border-border/60 bg-muted/20",
    )}>
      <div className="min-w-0">
        <p className="text-xs font-black text-foreground">{label}</p>
        <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">{threshold}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn(
          "font-display text-sm font-black tabular-nums",
          alert ? "text-destructive" : "text-success",
        )}>
          {value}
        </span>
        {alert
          ? <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
          : <CheckCircle2 className="h-4 w-4 text-success" />}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   PUBLIC API — backward-compatible exports for other admin tabs.
   Now rendered in the Premium aesthetic (soft borders, generous
   radius, semantic tokens — works in light & dark).
   ═════════════════════════════════════════════════════════════ */

export function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "admin-card overflow-hidden rounded-[24px] border border-border/60 bg-card p-5",
      className,
    )}>
      {children}
    </div>
  );
}

export function GlassPanelTitle({ children, color, icon }: {
  children: React.ReactNode; color: string; icon?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    emerald: "hsl(var(--success))", green: "hsl(var(--success))", teal: "hsl(var(--info))",
    blue: "hsl(var(--info))", cyan: "hsl(var(--info))", indigo: "hsl(var(--primary))",
    violet: "hsl(var(--primary))", amber: "hsl(var(--warning))", red: "hsl(var(--destructive))",
    zinc: "hsl(var(--muted-foreground))",
  };
  const c = colorMap[color] || "hsl(var(--primary))";
  return (
    <h3 className="mb-4 flex items-center gap-2 border-b border-border/40 pb-3 font-display text-sm font-black uppercase tracking-tight text-foreground">
      <span className="h-4 w-[3px] rounded-full" style={{ background: c }} />
      {icon && <span style={{ color: c }} className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      {children}
    </h3>
  );
}

export { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle };

export function AdminKpi({ icon, label, value, sub, alert, highlight, gradient }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  alert?: boolean; highlight?: boolean; iconColor?: string;
  gradient?: string; glowColor?: string;
}) {
  const tone: Tone =
    alert ? "destructive" :
    highlight ? "warning" :
    gradient?.includes("emerald") || gradient?.includes("green") ? "success" :
    gradient?.includes("amber") || gradient?.includes("orange") || gradient?.includes("yellow") ? "warning" :
    gradient?.includes("red") || gradient?.includes("rose") || gradient?.includes("pink") ? "destructive" :
    gradient?.includes("blue") || gradient?.includes("cyan") || gradient?.includes("sky") || gradient?.includes("teal") ? "info" :
    gradient?.includes("violet") || gradient?.includes("indigo") || gradient?.includes("purple") ? "primary" :
    "neutral";
  return (
    <div className="admin-card group relative overflow-hidden rounded-[24px] border border-border/60 bg-card p-5 hover:border-primary/35">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9.5px] font-black uppercase tracking-[0.22em] text-muted-foreground/70 leading-tight">
            {label}
          </p>
          <p className={cn(
            "mt-3 break-words font-display text-2xl font-black leading-none tracking-tight tabular-nums",
            TONE_TEXT[tone],
          )}>
            {value}
          </p>
          {sub && <p className="mt-2 truncate text-[11px] font-bold text-muted-foreground/70">{sub}</p>}
        </div>
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          TONE_PILL[tone],
        )}>
          <span className="[&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        </div>
      </div>
    </div>
  );
}
