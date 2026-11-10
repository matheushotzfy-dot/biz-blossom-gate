import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInDays } from "date-fns";
import { ArrowDownToLine, CalendarDays, ChevronDown, FileCheck2, KeyRound, Link2, PackagePlus, QrCode, Receipt, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useProfile } from "@/hooks/useProfile";
import { useKycStatus } from "@/hooks/useKycStatus";
import { useDashboardStats, useLedgerBalance, useProducts, useTransactions, type DashboardBucket } from "@/hooks/useQueryData";
import { PeriodPicker, buildPeriod, type PeriodValue } from "@/components/PeriodPicker";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import { SellerOnboarding } from "@/components/dashboard/SellerOnboarding";
import { Seo } from "@/components/Seo";
import { BalanceCard } from "@/components/home/BalanceCard";
import { QuickActions, type QuickAction } from "@/components/home/QuickActions";
import { SalesChart, type SalesPoint } from "@/components/home/SalesChart";
import { DayPulse } from "@/components/home/DayPulse";
import { PaymentMix } from "@/components/home/PaymentMix";
import { Statement } from "@/components/home/Statement";
import { PendingTasks, type PendingTask } from "@/components/home/PendingTasks";

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
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod("7d"));
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
  const hourly = useMemo(() => buildSeries(todayStats?.series ?? [], today.s, today.e, "hour").map((p) => p.revenue), [todayStats, today]);

  const cur = stats?.current;
  const revenue = Number(cur?.revenue ?? 0);
  const prev = Number(stats?.previous?.revenue ?? 0);
  const trend = prev > 0 ? Math.round(((revenue - prev) / prev) * 100) : undefined;
  const lastPaid = txs.find((t) => t.status === "completed" || t.status === "approved" || t.status === "paid");

  const locked = !kyc.approved;
  const guard = useCallback((to: string) => {
    if (locked) { toast.warning("Conclua a verificação da conta para liberar esta função."); navigate("/perfil?tab=identidade&scrollTo=kyc"); return; }
    navigate(to);
  }, [locked, navigate]);

  const hour = new Date().getHours();
  const name = profile?.nickname || profile?.full_name?.split(" ")[0] || "";
  const greeting = `${hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"}${name ? `, ${name}` : ""}`;

  const actions: QuickAction[] = [
    { label: "Cobrar", hint: "Pix ou cartão", icon: QrCode, tone: "money", onClick: () => guard("/vendas/link-pagamento") },
    { label: "Sacar", hint: "Para sua conta", icon: ArrowDownToLine, onClick: () => guard("/financeiro/saques") },
    { label: "Vendas", hint: "Todos os pedidos", icon: Receipt, onClick: () => navigate("/vendas") },
    { label: "Novo produto", hint: "Comece a vender", icon: PackagePlus, onClick: () => guard("/vendas/produtos") },
    { label: "Link", hint: "Cobrança rápida", icon: Link2, onClick: () => guard("/vendas/link-pagamento") },
    { label: "API", hint: "Credenciais", icon: KeyRound, onClick: () => navigate("/integracoes?tab=keys") },
  ];

  const tasks: PendingTask[] = [];
  const inReview = (products as Array<{ status?: string }>).filter((p) => p.status === "pending_review").length;
  if (inReview > 0) tasks.push({ id: "review", title: `${inReview} ${inReview === 1 ? "produto em análise" : "produtos em análise"}`, desc: "Nossa equipe está revisando", icon: PackageSearch, tone: "info", onClick: () => navigate("/vendas/produtos") });
  if (kyc.approved && products.length === 0) tasks.push({ id: "first", title: "Crie seu primeiro produto", desc: "Leva poucos minutos", icon: FileCheck2, tone: "info", onClick: () => navigate("/vendas/produtos") });

  const periodLabel = period.presetId === "today" ? "Hoje" : period.presetId === "7d" ? "7 dias" : period.presetId === "15d" ? "15 dias" : period.presetId === "30d" ? "30 dias" : `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

  return (
    <div className="vp-fade space-y-4 pb-6 md:space-y-5">
      <Seo title="Início | Vemprapay" description="Saldo, vendas e extrato da sua conta Vemprapay." path="/dashboard" noindex />

      {statsError && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-[12.5px] text-destructive">
          <span className="font-semibold">Não foi possível carregar seus números.</span>
          <button onClick={() => refetch()} className="rounded-full border border-destructive/50 px-3 py-1 font-bold">Tentar novamente</button>
        </div>
      )}

      <SellerOnboarding />

      <BalanceCard
        greeting={greeting}
        available={balance}
        pending={Number(stats?.global?.pending_balance ?? 0)}
        disputed={Number(stats?.global?.disputed_amount ?? 0)}
        receivedToday={Number(stats?.global?.received_today ?? 0)}
        hidden={privacy.hidden}
        onTogglePrivacy={privacy.toggle}
        onWithdraw={() => guard("/financeiro/saques")}
        periodSlot={
          <PeriodPicker open={pickerOpen} onOpenChange={setPickerOpen} value={period} onChange={setPeriod} align="end" side="bottom"
            trigger={<button className="vp-balance-chip inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold"><CalendarDays className="h-3.5 w-3.5" />{periodLabel}<ChevronDown className="h-3.5 w-3.5 opacity-70" /></button>} />
        }
      />

      <PendingTasks items={tasks} />
      <QuickActions items={actions} />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] md:gap-5">
        <SalesChart data={series} revenue={revenue} orders={Number(cur?.approved_count ?? 0)} trend={trend} compareLabel={period.presetId === "today" ? "vs ontem" : "vs anterior"} hidden={privacy.hidden} loading={statsLoading} />
        <DayPulse hourly={hourly} todayRevenue={Number(todayStats?.current?.revenue ?? 0)} todayOrders={Number(todayStats?.current?.approved_count ?? 0)} lastSaleAt={lastPaid?.created_at} hidden={privacy.hidden} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px] md:gap-5">
        <Statement items={txs} products={productNames} hidden={privacy.hidden} loading={txLoading} onOpen={setDetail} />
        <PaymentMix
          total={Number(cur?.total_count ?? 0)} approved={Number(cur?.approved_count ?? 0)} customers={Number(cur?.unique_customers ?? 0)}
          pixTotal={Number(cur?.pix_total ?? 0)} pixApproved={Number(cur?.pix_approved ?? 0)} cardTotal={Number(cur?.card_total ?? 0)} cardApproved={Number(cur?.card_approved ?? 0)}
        />
      </div>

      {detail && <TransactionDetailPanel tx={detail} products={productNames} onClose={() => setDetail(null)} variant="seller" />}
    </div>
  );
}
