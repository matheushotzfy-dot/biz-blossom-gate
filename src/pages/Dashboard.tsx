import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown, FileCheck2, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useProfile } from "@/hooks/useProfile";
import { useKycStatus } from "@/hooks/useKycStatus";
import { useDashboardStats, useLedgerBalance, useProducts, useTransactions, type DashboardBucket } from "@/hooks/useQueryData";
import { PeriodPicker, buildPeriod, type PeriodPresetId, type PeriodValue } from "@/components/PeriodPicker";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { SellerOnboarding } from "@/components/dashboard/SellerOnboarding";
import { Seo } from "@/components/Seo";
import { HomeView } from "@/components/home/HomeView";
import { saoPauloHour } from "@/components/home/time";
import type { SalesPoint } from "@/components/home/RevenueChart";
import type { PendingTask } from "@/components/home/PendingTasks";

const PRESET_LABEL: Record<string, string> = { today: "Hoje", yesterday: "Ontem", "7d": "7 dias", "15d": "15 dias", "30d": "30 dias", month: "Este mês" };
const periodLabel = (p: PeriodValue) =>
  (p.presetId && PRESET_LABEL[p.presetId]) || `${format(p.from, "dd MMM", { locale: ptBR }).replace(".", "")} a ${format(p.to, "dd MMM", { locale: ptBR }).replace(".", "")}`;
const rate = (a: number, t: number) => (t > 0 ? Math.round((a / t) * 100) : 0);
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function usePrivacy() {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; } });
  const toggle = useCallback(() => setHidden((h) => {
    try { localStorage.setItem("privacy_mode", String(!h)); window.dispatchEvent(new StorageEvent("storage")); } catch { /* noop */ }
    return !h;
  }), []);
  return { hidden, toggle };
}

/** Converte a série agregada do servidor em pontos do gráfico (sempre com todos os intervalos). */
function buildSeries(series: Array<{ bucket: string; revenue: number; count: number }>, start: Date, end: Date, bucket: DashboardBucket): SalesPoint[] {
  const rev = new Map<string, number>(); const cnt = new Map<string, number>();
  series.forEach((s) => { const k = String(s.bucket).slice(0, 13); rev.set(k, (rev.get(k) ?? 0) + Number(s.revenue)); cnt.set(k, (cnt.get(k) ?? 0) + Number(s.count)); });
  const pt = (d: Date, k: string, label: string, full: string): SalesPoint => ({ key: d.getTime(), label, full, revenue: rev.get(k) ?? 0, orders: cnt.get(k) ?? 0 });
  if (bucket === "hour") return Array.from({ length: 24 }, (_, h) => { const d = new Date(start); d.setHours(h); return pt(d, `${keyOf(d)}T${pad(h)}`, `${h}h`, `${h}:00 – ${h}:59`); });
  const out: SalesPoint[] = [];
  if (bucket === "month") {
    const c = new Date(start.getFullYear(), start.getMonth(), 1);
    while (c <= end) { const d = new Date(c); out.push(pt(d, `${keyOf(d)}T00`, d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))); c.setMonth(c.getMonth() + 1); }
    return out;
  }
  const c = new Date(start);
  while (c <= end) { const d = new Date(c); out.push(pt(d, `${keyOf(d)}T00`, d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }))); c.setDate(c.getDate() + 1); }
  return out;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const kyc = useKycStatus();
  const privacy = usePrivacy();
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod("30d"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detail, setDetail] = useState<Tables<"transactions"> | null>(null);

  const { start, end, bucket } = useMemo(() => {
    const s = new Date(period.from); s.setHours(0, 0, 0, 0);
    const e = new Date(period.to); e.setHours(23, 59, 59, 999);
    const span = differenceInDays(e, s) + 1;
    return { start: s, end: e, bucket: (span <= 1 ? "hour" : span > 60 ? "month" : "day") as DashboardBucket };
  }, [period]);
  const today = useMemo(() => { const s = new Date(); s.setHours(0, 0, 0, 0); const e = new Date(); e.setHours(23, 59, 59, 999); return { s, e }; }, []);

  const { data: stats, isPending: statsLoading, isError: statsError, refetch } = useDashboardStats(start, end, bucket);
  const { data: todayStats } = useDashboardStats(today.s, today.e, "hour");
  const { data: balance = 0 } = useLedgerBalance();
  const { data: txs = [], isPending: txLoading } = useTransactions(12);
  const { data: products = [] } = useProducts();

  const productNames = useMemo(() => Object.fromEntries((products as Array<{ id: string; name: string | null }>).map((p) => [p.id, p.name || "Produto"])), [products]);
  const series = useMemo(() => buildSeries(stats?.series ?? [], start, end, bucket), [stats, start, end, bucket]);

  const cur = stats?.current;
  const revenue = Number(cur?.revenue ?? 0);
  const prev = Number(stats?.previous?.revenue ?? 0);
  const trend = prev > 0 ? Math.round(((revenue - prev) / prev) * 100) : undefined;
  const approved = Number(cur?.approved_count ?? 0);

  const locked = !kyc.approved;
  const guard = useCallback((to: string) => {
    if (locked) { toast.warning("Conclua a verificação da conta para liberar esta função."); navigate("/perfil?tab=identidade&scrollTo=kyc"); return; }
    navigate(to);
  }, [locked, navigate]);

  const tasks: PendingTask[] = [];
  const inReview = (products as Array<{ status?: string }>).filter((p) => p.status === "pending_review").length;
  if (inReview > 0) tasks.push({ id: "review", title: `${inReview} ${inReview === 1 ? "produto em análise" : "produtos em análise"}`, desc: "Nossa equipe está revisando", icon: PackageSearch, tone: "info", onClick: () => navigate("/vendas/produtos") });
  if (kyc.approved && products.length === 0) tasks.push({ id: "first", title: "Crie seu primeiro produto", desc: "Leva poucos minutos", icon: FileCheck2, tone: "info", onClick: () => navigate("/vendas/produtos") });


  const todayHours = useMemo(() => buildSeries(todayStats?.series ?? [], today.s, today.e, "hour"), [todayStats, today]);
  const total = Number(cur?.total_count ?? 0);
  const firstName = (profile?.full_name || "").split(" ")[0] || "Seller";

  return (
    <>
      <Seo title="Início | Vemprapay" description="Saldo, vendas e extrato da sua conta Vemprapay." path="/dashboard" noindex />
      <HomeView
        firstName={firstName}
        alert={statsError && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
            <span className="font-semibold">Não foi possível carregar seus números.</span>
            <button onClick={() => refetch()} className="rounded-full border border-destructive/50 px-3.5 py-1 font-bold transition-colors hover:bg-destructive/10">Tentar novamente</button>
          </div>
        )}
        banner={<SellerOnboarding />}
        hero={{
          available: balance,
          pending: Number(stats?.global?.pending_balance ?? 0),
          disputed: Number(stats?.global?.disputed_amount ?? 0),
          trend,
          hidden: privacy.hidden,
          onTogglePrivacy: privacy.toggle,
          onPix: () => guard("/vendas/link-pagamento"),
          onWithdraw: () => guard("/financeiro/saques"),
          onCharge: () => guard("/vendas/link-pagamento"),
          onMore: () => navigate("/integracoes"),
        }}
        today={{
          revenue: Number(todayStats?.current?.revenue ?? 0),
          orders: Number(todayStats?.current?.approved_count ?? 0),
          hours: todayHours,
          nowHour: saoPauloHour(),
          hidden: privacy.hidden,
          loading: !todayStats,
          onCreateLink: () => guard("/vendas/link-pagamento"),
        }}
        tasks={tasks}
        chart={{
          data: series, bucket, hidden: privacy.hidden, loading: statsLoading,
          action: (
            <PeriodPicker open={pickerOpen} onOpenChange={setPickerOpen} value={period} onChange={setPeriod} align="end" side="bottom"
              trigger={<button className="vp-chip" aria-label={`Período: ${periodLabel(period)}. Escolher outro`}><CalendarDays className="h-4 w-4 text-muted-foreground" />{periodLabel(period)}<ChevronDown className="h-4 w-4 text-muted-foreground" /></button>} />
          ),
        }}
        performance={{
          conversion: rate(approved, total),
          pixRate: rate(Number(cur?.pix_approved ?? 0), Number(cur?.pix_total ?? 0)),
          cardRate: rate(Number(cur?.card_approved ?? 0), Number(cur?.card_total ?? 0)),
          ticket: approved > 0 ? revenue / approved : 0,
          orders: approved,
          attempts: total,
          hasData: total > 0,
          hidden: privacy.hidden,
          loading: statsLoading,
        }}
        statement={{ items: txs, products: productNames, hidden: privacy.hidden, loading: txLoading, onOpen: setDetail, onCreateLink: () => guard("/vendas/link-pagamento") }}
      />

      {detail && <TransactionDetailPanel tx={detail} products={productNames} onClose={() => setDetail(null)} variant="seller" />}
    </>
  );
}
