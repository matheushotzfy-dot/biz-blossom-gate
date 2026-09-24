import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  useTransactions, 
  useProducts as useProductsQuery, 
  useLedgerBalance, 
  useDashboardStats 
} from "@/hooks/useQueryData";
import { 
  QrCode, 
  ArrowDownRight, 
  Receipt, 
  KeyRound 
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { Seo } from "@/components/Seo";
import { useKycStatus } from "@/hooks/useKycStatus";
import { buildPeriod, type PeriodValue, type PeriodPresetId } from "@/components/PeriodPicker";
import { toast } from "sonner";
import { SellerOnboarding } from "@/components/dashboard/SellerOnboarding";
import QuickPixDialog from "@/components/QuickPixDialog";
import { useProfile } from "@/hooks/useProfile";
import { differenceInDays } from "date-fns";
import { isApprovedTransaction, deriveTransactionStatus } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

// Redesigned Components
import { DashboardHeader } from "@/components/dashboard/redesign/DashboardHeader";
import { DashboardKpis } from "@/components/dashboard/redesign/DashboardKpis";
import { DashboardRevenueChart } from "@/components/dashboard/redesign/DashboardRevenueChart";
import { DashboardSideInsights } from "@/components/dashboard/redesign/DashboardSideInsights";
import { DashboardActivity } from "@/components/dashboard/redesign/DashboardActivity";
import { PeriodDial } from "@/components/dashboard/redesign/PeriodDial";

// Hooks
import { useDashboardStatsFormatter } from "@/hooks/useDashboardStatsFormatter";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";

const PERIOD_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
] as const;

type PeriodPreset = (typeof PERIOD_PRESETS)[number];
const CENSORED = "••••••";

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function brasiliaToday() {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { data: transactions = [], isError: txError, refetch: refetchTx } = useTransactions(25);
  const { data: productsData, isError: productsError } = useProductsQuery();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>(PERIOD_PRESETS[0]);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCustom, setIsCustom] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const privacy = usePrivacyMode();
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const { data: balance = 0 } = useLedgerBalance();
  const kyc = useKycStatus();
  const accountLocked = !kyc.approved;

  const periodValue = useMemo<PeriodValue>(() => {
    if (isCustom && customRange?.from) {
      const from = new Date(customRange.from); from.setHours(0, 0, 0, 0);
      const to = new Date(customRange.to ?? customRange.from); to.setHours(23, 59, 59, 999);
      return { presetId: null, from, to };
    }
    const map: Record<number, PeriodPresetId> = { 0: "today", 7: "7d", 15: "15d", 30: "30d" };
    return buildPeriod(map[selectedPeriod.days] ?? "today");
  }, [isCustom, customRange, selectedPeriod]);

  const applyPeriod = useCallback((v: PeriodValue) => {
    const presetDays: Partial<Record<PeriodPresetId, number>> = { today: 0, "7d": 7, "15d": 15, "30d": 30 };
    if (v.presetId && v.presetId in presetDays) {
      const days = presetDays[v.presetId]!;
      const preset = PERIOD_PRESETS.find((p) => p.days === days) ?? PERIOD_PRESETS[0];
      setSelectedPeriod(preset);
      setIsCustom(false);
      setCustomRange(undefined);
      return;
    }
    setCustomRange({ from: v.from, to: v.to });
    setIsCustom(true);
  }, []);

  const requireApprovedAccount = useCallback((target = "/perfil?tab=identidade&scrollTo=kyc") => {
    if (!accountLocked) return false;
    toast.warning("Complete o KYC e aguarde aprovação do administrador para liberar esta função.");
    navigate(target);
    return true;
  }, [accountLocked, navigate]);

  const { rangeStart, rangeEnd, bucket } = useMemo(() => {
    const today = brasiliaToday();
    let start: Date;
    let end: Date;

    if (isCustom && customRange?.from) {
      start = new Date(customRange.from);
      end = new Date(customRange.to ?? customRange.from);
    } else if (selectedPeriod.days === 0) {
      start = new Date(today);
      end = new Date(today);
    } else {
      start = new Date(today);
      start.setDate(start.getDate() - (selectedPeriod.days - 1));
      end = new Date(today);
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const span = differenceInDays(end, start) + 1;
    const b: "hour" | "day" | "month" = span <= 1 ? "hour" : span > 60 ? "month" : "day";
    return { rangeStart: start, rangeEnd: end, bucket: b };
  }, [isCustom, customRange, selectedPeriod]);

  const { data: stats, isError: statsError, isPending: statsLoading, refetch: refetchStats } = useDashboardStats(rangeStart, rangeEnd, bucket);

  const formattedStats = useDashboardStatsFormatter(stats, rangeStart, rangeEnd, bucket);

  const chartTicks = useMemo(() => {
    const { chartData } = formattedStats;
    if (chartData.length <= 1) return chartData.map((p) => p.timestamp);
    const granularity = chartData[0]?.granularity;
    if (granularity === "hour") return chartData.map((p) => p.timestamp);
    const maxTicks = granularity === "month" ? Math.min(chartData.length, 8) : chartData.length <= 31 ? chartData.length : 8;
    const indexes = new Set<number>();
    for (let i = 0; i < maxTicks; i++) {
      indexes.add(Math.round((i * (chartData.length - 1)) / (maxTicks - 1)));
    }
    return Array.from(indexes).sort((a, b) => a - b).map((index) => chartData[index].timestamp);
  }, [formattedStats]);

  const chartTickFormatter = useCallback((value: number) => {
    const d = new Date(value);
    const granularity = formattedStats.chartData[0]?.granularity;
    if (granularity === "hour") return `${d.getHours()}h`;
    if (granularity === "month") return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    if (formattedStats.chartData.length > 15 && formattedStats.chartData.length <= 31) return d.toLocaleDateString("pt-BR", { day: "2-digit" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }, [formattedStats]);

  const activity = useMemo(() => {
    const tx = transactions.slice(0, 10).map((t) => ({
      id: t.id,
      kind: "transaction" as const,
      createdAt: t.created_at,
      amount: Number(t.amount),
      status: deriveTransactionStatus(t),
      label: t.payment_method || "Venda",
      tx: t,
    }));
    return tx.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions]);

  const statusLabel = (s: string) => isApprovedTransaction(s) ? 'Aprovado' : s === 'pending' || s === 'processing' ? 'Pendente' : s === 'expired' ? 'Expirada' : s === 'refunded' || s === 'partially_refunded' ? 'Reembolso' : s === 'chargeback' ? 'Chargeback' : s === 'med' || s === 'mediation' || s === 'dispute' || s === 'disputed' ? 'MED' : s === 'cancelled' || s === 'canceled' ? 'Cancelada' : s === 'failed' || s === 'refused' || s === 'rejected' || s === 'error' ? 'Erro' : s;

  const productsMap = useMemo(() => {
    const map: Record<string, string> = {};
    (productsData || []).forEach((p: { id: string; name: string | null }) => { map[p.id] = p.name || p.id; });
    return map;
  }, [productsData]);

  const goalTarget = 100000;
  const goalPct = Math.min(100, (formattedStats.revenue / goalTarget) * 100);

  const quickActions = [
    { label: "Gerar PIX", sub: "QR Code para receber", icon: QrCode, onClick: () => { if (!requireApprovedAccount()) setPixDialogOpen(true); } },
    { label: "Solicitar Saque", sub: "Transferir via PIX", icon: ArrowDownRight, onClick: () => { if (!requireApprovedAccount()) navigate("/financeiro/saques"); } },
    { label: "Transações", sub: "Ver histórico", icon: Receipt, onClick: () => { if (!requireApprovedAccount()) navigate("/vendas"); } },
    { label: "Credenciais API", sub: "Gerencie suas credenciais", icon: KeyRound, onClick: () => { if (!requireApprovedAccount()) navigate("/integracoes/credenciais"); } },
  ];

  return (
    <div className="seller-dashboard relative min-h-full w-full text-foreground animate-in fade-in duration-500">
      <Seo title="Dashboard | Venxpay" description="Painel operacional Venxpay — saldos, ranking, aprovação e liquidações em tempo real." path="/dashboard" noindex />

      <div className="relative z-10 mx-auto max-w-[1440px] space-y-4 px-1 pb-20 pt-1 sm:px-2 md:px-3">
        {(txError || statsError || productsError) && (
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-[12px] text-destructive">
            <span className="font-semibold">Falha ao carregar métricas</span>
            <button onClick={() => { refetchTx(); refetchStats(); }} className="rounded-lg border border-destructive/50 px-3 py-1 text-[11px] font-bold hover:bg-destructive/10">Tentar novamente</button>
          </div>
        )}

        <SellerOnboarding />

        <DashboardHeader 
          name={profile?.full_name}
          privacyHidden={privacy.hidden} 
          onPrivacyToggle={privacy.toggle} 
          periodControl={
            <PeriodDial
              open={datePickerOpen}
              setOpen={setDatePickerOpen}
              label={isCustom ? "Período" : selectedPeriod.label}
              goalPct={goalPct}
              revenueLabel={privacy.hidden ? CENSORED : fmt(formattedStats.revenue)}
              value={periodValue}
              onChange={applyPeriod}
            />
          }
        />

        <DashboardKpis
          balance={balance}
          revenue={formattedStats.revenue}
          approvedCount={formattedStats.approvedCount}
          conversion={formattedStats.conversion}
          averageTicket={formattedStats.averageTicket}
          pendingBalance={formattedStats.pendingBalance}
          disputedAmount={formattedStats.disputedAmount}
          chargebackRate={formattedStats.chargebackRate}
          productsCount={(productsData ?? []).length}
          actions={quickActions}
          isLoading={statsLoading}
          privacyHidden={privacy.hidden}
          formatCurrency={fmt}
        />

        <section className="dashboard-analytics grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.85fr)]">
          <DashboardRevenueChart
            chartData={formattedStats.chartData}
            chartTicks={chartTicks}
            chartTickFormatter={chartTickFormatter}
            revenue={formattedStats.revenue}
            periodLabel={isCustom ? "período personalizado" : selectedPeriod.label}
            formatCurrency={fmt}
          />
          <DashboardSideInsights
            chartData={formattedStats.chartData}
            chartTickFormatter={chartTickFormatter}
            pixConversion={formattedStats.pixConversion}
            chargebackRate={formattedStats.chargebackRate}
            onPaymentLinkClick={() => { if (!requireApprovedAccount()) navigate("/vendas/link-pagamento"); }}
          />
        </section>

        <DashboardActivity 
          activity={activity}
          statusLabel={statusLabel}
          formatCurrency={fmt}
          privacyHidden={privacy.hidden}
          onTxClick={setDetailTx}
          onViewAllClick={() => { if (!requireApprovedAccount()) navigate("/vendas"); }}
        />

        {detailTx && (
          <TransactionDetailPanel
            tx={detailTx}
            products={productsMap}
            onClose={() => setDetailTx(null)}
            variant="seller"
          />
        )}

        <QuickPixDialog open={pixDialogOpen} onOpenChange={setPixDialogOpen} />
      </div>
    </div>
  );
}
