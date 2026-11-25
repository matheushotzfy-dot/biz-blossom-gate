import { lazy, Suspense, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { useSellerSkin } from "@/hooks/useSellerSkin";
import { useReason } from "@/components/seller-ui/confirm";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useMinWidth } from "@/hooks/useMinWidth";
import {
  Shield, LogOut, Bell, RefreshCw, PanelLeftClose, PanelLeft, Search, ChevronDown, Sun, Moon, Clock, SearchX, X, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { logAdminAction } from "@/lib/auditLog";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { startOfDay, endOfDay } from "date-fns";
import { todayInSaoPaulo } from "@/components/period/periodMeta";
import type { AdminFinancialOverview } from "./tabs/AdminOverviewTab";
import AdminDateBar from "./AdminDateBar";
import { canOpenTab, compactBRL, resolveActiveTab, searchSections, sectionsFor, NAV_SECTIONS } from "./adminNav";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";

const AdminOverviewTab = lazy(() => import("./tabs/AdminOverviewTab"));
const AdminSellersTab = lazy(() => import("./tabs/AdminSellersTab"));
const AdminProductsTab = lazy(() => import("./tabs/AdminProductsTab"));
const FinancialAuditTab = lazy(() => import("@/features/admin-finance/FinancialAuditTab"));
const DisputesCenter = lazy(() => import("@/features/admin-finance/DisputesCenter"));
const RefundApprovalsTab = lazy(() => import("@/features/admin-finance/RefundApprovalsTab"));
const StaffRequestsTab = lazy(() => import("@/features/admin-finance/StaffRequestsTab"));
const AcquirersPanel = lazy(() => import("@/features/admin-finance/AcquirersPanel"));
const FinancialMetricsPanel = lazy(() => import("@/features/admin-finance/FinancialMetricsPanel").then((m) => ({ default: m.FinancialMetricsPanel })));
const AdminTransactionsTab = lazy(() => import("./tabs/AdminTransactionsTab"));
const AdminWithdrawalsTab = lazy(() => import("./tabs/AdminWithdrawalsTab"));
const AdminCouponsTab = lazy(() => import("./tabs/AdminCouponsTab"));
const AdminCoursesTab = lazy(() => import("./tabs/AdminCoursesTab"));
const AdminAuditTab = lazy(() => import("./tabs/AdminAuditTab"));
const AdminSettingsTab = lazy(() => import("./tabs/AdminSettingsTab"));
const AdminEmployeesTab = lazy(() => import("./tabs/AdminEmployeesTab"));
const AdminTopSellersTab = lazy(() => import("./tabs/AdminTopSellersTab"));
const AdminTopProductsTab = lazy(() => import("./tabs/AdminTopProductsTab"));
const AdminErrorLogsTab = lazy(() => import("./tabs/AdminErrorLogsTab"));
const AdminInactiveSellersTab = lazy(() => import("./tabs/AdminInactiveSellersTab"));
const AdminRiskComplianceTab = lazy(() => import("./tabs/AdminRiskComplianceTab"));
const AdminAbuseMetricsTab = lazy(() => import("./tabs/AdminAbuseMetricsTab"));
const AdminAnalyticsTab = lazy(() => import("./tabs/AdminAnalyticsTab"));
const AdminManagersTab = lazy(() => import("./tabs/AdminManagersTab"));
const AdminStaffCommissionsTab = lazy(() => import("./tabs/AdminStaffCommissionsTab"));
const AdminNotificationsTab = lazy(() => import("./tabs/AdminNotificationsTab"));
const AdminAffiliateSalesTab = lazy(() => import("./tabs/AdminAffiliateSalesTab"));
const AdminSupportTab = lazy(() => import("./tabs/AdminSupportTab"));
const AdminSubscriptionsTab = lazy(() => import("./tabs/AdminSubscriptionsTab"));
const AdminReferralsTab = lazy(() => import("./tabs/AdminReferralsTab"));
const AdminRewardsTab = lazy(() => import("./tabs/AdminRewardsTab"));
const AdminCorridasTab = lazy(() => import("./tabs/AdminCorridasTab"));
const AdminGoalsTab = lazy(() => import("./tabs/AdminGoalsTab"));
const AdminCommandCenterTab = lazy(() => import("./tabs/AdminCommandCenterTab"));
const AdminToolsTab = lazy(() => import("./tabs/AdminToolsTab"));
const AdminPaymentLinksTab = lazy(() => import("./tabs/AdminPaymentLinksTab"));
const AdminCheckoutDeliveriesTab = lazy(() => import("./tabs/AdminCheckoutDeliveriesTab"));

type TabId = string;

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  useIdleLogout(15);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  // Os diálogos do admin (portais fora da casca) usam o kit seller-ui, que depende destas classes no <html>.
  useSellerSkin();
  const { ask: askReason, dialog: reasonDialog } = useReason();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [financialOverview, setFinancialOverview] = useState<AdminFinancialOverview | null>(null);
  const [dataCapHit, setDataCapHit] = useState<{ field: string; count: number }[]>([]);
  const lastLoadAtRef = useRef<number>(0);
  const loadRequestRef = useRef(0);
  const loadInFlightRef = useRef(false);
  const reloadQueuedRef = useRef(false);
  const latestLoadRef = useRef<() => Promise<void>>(async () => {});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [hasSupportPerm, setHasSupportPerm] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);
  const [roleFailed, setRoleFailed] = useState(false);
  const [roleAttempt, setRoleAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  // Falha ao carregar/atualizar os dados do painel: fica na tela até a próxima carga dar certo.
  const [loadError, setLoadError] = useState(false);
  // A aba ativa vive na URL (?tab=...) para sobreviver a refresh e voltar/avançar.
  const urlTab = searchParams.get("tab") ?? "";
  const access = { isEmployee, hasSupportPerm };
  const activeTab: TabId = resolveActiveTab(urlTab, access);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const navSearchRef = useRef<HTMLInputElement>(null);
  const openMenuRef = useRef<HTMLButtonElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const menuWasOpen = useRef(false);
  const isDesktop = useMinWidth(1024);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const today = todayInSaoPaulo();
    return { from: startOfDay(today), to: endOfDay(today) };
  });
  const latestRangeRef = useRef(dateRange);
  latestRangeRef.current = dateRange;

  const loadData = useCallback(async () => {
    if (loadInFlightRef.current) {
      reloadQueuedRef.current = true;
      return;
    }
    loadInFlightRef.current = true;
    const requestId = ++loadRequestRef.current;
    setSyncing(true);
    try {
      const fromIso = dateRange.from.toISOString();
      const toIso = dateRange.to.toISOString();
      const [dashboardResult, overviewResult] = await Promise.all([
        supabase.rpc("get_admin_dashboard_data" as never, {
          _from: fromIso, _to: toIso,
          _tx_limit: 5000, _profile_limit: 2000, _product_limit: 2000, _withdrawal_limit: 5000,
        } as never),
        supabase.rpc("get_admin_financial_overview" as never, { _from: fromIso, _to: toIso, _bucket: "day" } as never),
      ]);
      if (dashboardResult.error) throw dashboardResult.error;
      if (overviewResult.error) throw overviewResult.error;
      const data = dashboardResult.data;
      const payload = (data ?? {}) as {
        transactions?: Tables<"transactions">[];
        profiles?: Tables<"profiles">[];
        products?: Tables<"products">[];
        withdrawals?: Tables<"withdrawals">[];
      };
      if (requestId !== loadRequestRef.current || latestRangeRef.current !== dateRange) return;
      setTransactions(payload.transactions ?? []);
      setProfiles(payload.profiles ?? []);
      setProducts(payload.products ?? []);
      setWithdrawals(payload.withdrawals ?? []);
      setFinancialOverview((overviewResult.data ?? null) as AdminFinancialOverview | null);
      const caps: { field: string; count: number }[] = [];
      if ((payload.transactions?.length ?? 0) >= 5000) caps.push({ field: "transações", count: 5000 });
      if ((payload.profiles?.length ?? 0) >= 2000) caps.push({ field: "perfis", count: 2000 });
      if ((payload.products?.length ?? 0) >= 2000) caps.push({ field: "produtos", count: 2000 });
      if ((payload.withdrawals?.length ?? 0) >= 5000) caps.push({ field: "saques", count: 5000 });
      setDataCapHit(caps);
      setLastSync(new Date());
      setLoadError(false);
      lastLoadAtRef.current = Date.now();
    } catch {
      // Sem toast: a atualização automática roda a cada minuto e empilharia avisos. O aviso fixo da tela basta.
      if (requestId === loadRequestRef.current) setLoadError(true);
    } finally {
      loadInFlightRef.current = false;
      if (requestId === loadRequestRef.current) setSyncing(false);
      if (reloadQueuedRef.current) {
        reloadQueuedRef.current = false;
        void latestLoadRef.current();
      }
    }
  }, [dateRange.from, dateRange.to]);

  latestLoadRef.current = loadData;

  // ── Role check (runs ONCE when user is available) ──
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/admin-matheus", { replace: true }); return; }
    let cancelled = false;
    setRoleFailed(false);
    (async () => {
      try {
        const [adminRes, employeeRes, permRes] = await Promise.all([
          supabase.rpc("current_user_has_role", { _role: "admin" }),
          supabase.rpc("current_user_has_role", { _role: "employee" }),
          supabase.from("staff_permissions").select("permission_key").eq("user_id", user.id).eq("permission_key", "view_support"),
        ]);
        if (cancelled) return;
        // Erro de rede/servidor não é "sem permissão": não manda para o login, deixa tentar de novo.
        if (adminRes.error || employeeRes.error) throw adminRes.error ?? employeeRes.error;
        const hasAdmin = adminRes.data === true;
        const hasEmployee = employeeRes.data === true;
        const hasSupport = (permRes.data?.length ?? 0) > 0;
        if (!hasAdmin && !hasEmployee) { navigate("/admin-matheus"); return; }
        if (hasAdmin) setIsAdmin(true);
        else if (hasEmployee) setIsEmployee(true);
        setHasSupportPerm(hasSupport);
        setRoleChecked(true);
      } catch {
        if (!cancelled) setRoleFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, navigate, roleAttempt]);

  // ── Data load (independent: reacts to date range changes, no role re-check) ──
  useEffect(() => {
    if (!roleChecked) return;
    let cancelled = false;
    (async () => {
      await loadData();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [roleChecked, loadData]);

  useEffect(() => {
    if (!roleChecked) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reconcile = () => {
      if (timer) return;
      const elapsed = Date.now() - lastLoadAtRef.current;
      const wait = Math.max(500, 10_000 - elapsed);
      timer = setTimeout(() => { timer = null; void loadData(); }, wait);
    };
    const channel = supabase.channel(uniqueChannelName("admin-financial-sync"))
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, reconcile)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, reconcile)
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, reconcile)
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_ledger" }, reconcile)
      .on("postgres_changes", { event: "*", schema: "public", table: "balance_adjustments" }, reconcile)
      .subscribe((status) => { if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reconcile(); });
    const onFocus = () => { if (document.visibilityState === "visible") void loadData(); };
    window.addEventListener("focus", onFocus);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [roleChecked, loadData]);

  const handleWithdrawalAction = async (id: string, action: "approved" | "rejected") => {
    if (!isAdmin) { toast.error("Sem permissão"); return; }
    if (action === "approved") {
      toast.error("Saques estão indisponíveis sem uma adquirente configurada.");
      return;
    } else {
      const reason = await askReason({
        title: "Recusar este saque",
        description: "O valor reservado volta para o saldo do seller. O motivo fica registrado na auditoria; o seller recebe só o aviso de saque recusado.",
        label: "Motivo da recusa",
        minLength: 5,
        confirmLabel: "Recusar saque",
        tone: "danger",
      });
      if (!reason) return;
      const { error, data: updated } = await supabase.from("withdrawals").update({ status: "rejected", rejection_reason: reason.slice(0, 500), processed_by: user?.id ?? null }).eq("id", id).eq("status", "pending").select("id");
      if (error) { toast.error("Erro ao recusar"); return; }
      if (!updated || updated.length === 0) { toast.error("Saque já foi processado"); loadData(); return; }
      toast.success("Saque recusado");
      await logAdminAction("reject_withdrawal", "withdrawal", id, { reason });
    }
    loadData();
  };

  const queryClient = useQueryClient();
  const handleLogout = async () => {
    await logAdminAction("admin_logout", "session", user?.id ?? "unknown");
    try { await supabase.auth.signOut(); } catch { /* sem rede: a sessão local é descartada do mesmo jeito */ }
    queryClient.clear();
    navigate("/admin-matheus", { replace: true });
  };

  const fmtCurrency = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const pendingWdCount = withdrawals.filter(w => w.status === "pending").length;
  const activeTabLabel = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === activeTab)?.label || "";

  const handleTabChange = useCallback((tabId: TabId) => {
    if (!canOpenTab(tabId, { isEmployee, hasSupportPerm })) {
      toast.error("Sem permissão para acessar esta área");
      return;
    }
    // Clicar na aba que já está aberta não empilha outra entrada no histórico do navegador.
    if (tabId !== activeTab) setSearchParams({ tab: tabId });
    const scrollable = document.querySelector("[data-admin-content]");
    if (scrollable) scrollable.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [isEmployee, hasSupportPerm, activeTab, setSearchParams]);

  // ── Auto refresh silencioso a cada 60s (só com a aba do navegador visível) ──
  useEffect(() => {
    if (!roleChecked) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") loadData();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [roleChecked, loadData]);

  // ── Atalhos: ⌘K/Ctrl+K foca a busca de abas, Esc fecha o menu mobile ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebarCollapsed(false);
        navSearchRef.current?.focus();
      }
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Menu do celular: abre com o foco no botão de fechar e devolve o foco ao botão que o abriu.
  useEffect(() => {
    if (mobileMenuOpen) {
      menuWasOpen.current = true;
      closeMenuRef.current?.focus();
    } else if (menuWasOpen.current) {
      menuWasOpen.current = false;
      openMenuRef.current?.focus();
    }
  }, [mobileMenuOpen]);

  // Passou para o computador com o menu do celular aberto: fecha para não deixar a película na tela.
  useEffect(() => { if (isDesktop) setMobileMenuOpen(false); }, [isDesktop]);


  const filteredSections = searchSections(sectionsFor(access), navQuery);
  const openFirstMatch = () => {
    const first = filteredSections[0]?.items[0];
    if (!first) return;
    handleTabChange(first.id);
    setNavQuery("");
    setMobileMenuOpen(false);
  };

  // Volume aprovado do período: vem do agregado do servidor (não é limitado como as listas abaixo).
  const periodVolume = financialOverview?.summary?.gross_volume;
  const collapsed = sidebarCollapsed && isDesktop;
  const drawerClosed = !isDesktop && !mobileMenuOpen;

  if (roleFailed) {
    return (
      <div className="admin-frame min-h-screen flex items-center justify-center af-bg-soft px-6">
        <div role="alert" className="flex max-w-[360px] flex-col items-center gap-3 text-center">
          <div className="h-12 w-12 rounded-md af-accent-bg flex items-center justify-center"><Shield className="h-6 w-6" /></div>
          <h1 className="text-[16px] font-semibold af-text">Não deu para confirmar seu acesso</h1>
          <p className="text-[13px] af-muted">Costuma ser a conexão. Nenhuma permissão foi alterada. Tente de novo; se continuar, saia e entre outra vez.</p>
          <div className="mt-1 flex items-center gap-2">
            <button onClick={() => setRoleAttempt((n) => n + 1)} className="af-accent-bg flex items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-semibold">
              <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
            </button>
            <button onClick={handleLogout} className="af-border border rounded-md px-3.5 py-2 text-[13px] font-semibold af-text-3 hover:af-surface-2">Sair</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-frame min-h-screen flex items-center justify-center af-bg-soft" role="status">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-md af-accent-bg flex items-center justify-center">
            <Shield className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2 text-[12px] af-muted font-medium">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Carregando painel...
          </div>
        </div>
      </div>
    );
  }

  const themeButtonLabel = theme === "dark" ? "Tema claro" : "Tema escuro";

  return (
    <div className="admin-frame h-screen flex overflow-hidden af-bg-soft af-text">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-background/80 lg:hidden" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside
        aria-label="Menu do painel"
        {...(drawerClosed ? ({ inert: "" } as object) : {})}
        className={cn(
          "relative z-[70] lg:z-20 h-full flex flex-col shrink-0 transition-[width] duration-200 af-surface af-border border-r",
          collapsed ? "w-[72px]" : "w-[264px]",
          "max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:max-w-[86vw]",
          mobileMenuOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="h-[64px] flex items-center px-4 gap-3 af-border border-b shrink-0">
          <div className="h-9 w-9 rounded-md af-accent-bg flex items-center justify-center shrink-0 text-primary-foreground">
            <Shield className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-[15px] font-semibold tracking-tight af-text leading-tight">Vemprapay</h1>
              <p className="text-[11px] af-muted leading-tight">{isEmployee ? "Staff Panel" : "Admin Panel"}</p>
            </div>
          )}
          <button
            ref={closeMenuRef}
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
            className="lg:hidden ml-auto h-8 w-8 rounded-md flex items-center justify-center af-muted hover:af-surface-2 hover:af-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-3 pt-3.5 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 af-muted-2" />
              <input
                ref={navSearchRef}
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); openFirstMatch(); }
                  if (e.key === "Escape" && navQuery) { e.stopPropagation(); setNavQuery(""); }
                }}
                placeholder="Buscar aba..."
                aria-label="Buscar aba do painel"
                className="af-input w-full h-9 pl-9 pr-12 text-[13px] rounded-md focus:outline-none"
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold af-muted-2 pointer-events-none max-lg:hidden">⌘K</kbd>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav aria-label="Abas do painel" className="flex-1 overflow-y-auto py-3 px-2.5 scrollbar-thin">
          {filteredSections.length === 0 && !collapsed && (
            <div className="flex flex-col items-center gap-2 py-10 px-3 text-center">
              <SearchX className="h-5 w-5 af-muted-2" />
              <p className="text-[12px] af-muted">Nenhuma aba encontrada para "{navQuery}".</p>
              <button onClick={() => setNavQuery("")} className="text-[11.5px] font-semibold af-text underline underline-offset-2">
                Limpar busca
              </button>
            </div>
          )}
          {filteredSections.map(section => (
            <div key={section.id} className="mb-4">
              {!collapsed && (
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] af-muted-2 px-2.5 mb-1.5 mt-1">
                  {section.label}
                </p>
              )}
              {collapsed && <div className="h-px af-border border-t mx-2 mb-1.5" />}
              <div className="space-y-px">
                {section.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const hasBadge = item.id === "withdrawals" && pendingWdCount > 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { handleTabChange(item.id); setMobileMenuOpen(false); }}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      aria-current={isActive ? "page" : undefined}
                      data-active={isActive ? "true" : "false"}
                      className={cn(
                        "admin-nav-item relative w-full flex items-center gap-3 rounded-md group",
                        collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                        isActive ? "af-accent-bg" : "af-text-3 hover:af-surface-2 hover:af-text"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "" : "af-muted group-hover:af-text")} strokeWidth={2} />
                      {!collapsed && (
                        <span className={cn("text-[13.5px] truncate", isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
                      )}
                      {hasBadge && (
                        <span
                          aria-label={`${pendingWdCount} saque(s) pendente(s)`}
                          className={cn(
                            "h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center",
                            collapsed ? "absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px]" : "ml-auto"
                          )}
                        >
                          {pendingWdCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="af-border border-t p-2 space-y-0.5 shrink-0">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md af-muted hover:af-surface-2 hover:af-text transition-colors sm:hidden"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="text-[11.5px] font-medium">{themeButtonLabel}</span>
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : undefined}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md af-muted hover:af-surface-2 hover:af-text transition-colors max-lg:hidden"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span className="text-[11.5px] font-medium">Recolher</span>}
          </button>
          <button
            onClick={handleLogout}
            aria-label="Sair do painel"
            title={collapsed ? "Sair" : undefined}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md af-muted hover:af-surface-2 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="text-[11.5px] font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-[64px] flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-3 shrink-0 af-surface af-border border-b">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button
              ref={openMenuRef}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
              className="lg:hidden h-9 w-9 shrink-0 rounded-md flex items-center justify-center af-border border af-text-3 hover:af-surface-2"
            >
              <PanelLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[12px] font-medium af-muted-2 hidden sm:inline">Admin</span>
              <ChevronDown className="h-3 w-3 af-muted-2 -rotate-90 hidden sm:inline" />
              <h2 className="text-[15px] sm:text-[16px] font-semibold af-text truncate">{activeTabLabel}</h2>
            </div>

            {syncing ? (
              <span role="status" className="hidden 2xl:flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-medium af-muted af-surface-2 af-border border rounded-md px-2.5 py-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Sincronizando
              </span>
            ) : loadError ? (
              <span className="hidden 2xl:flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Falha ao atualizar
              </span>
            ) : lastSync ? (
              <span className="hidden 2xl:flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-medium af-muted-2" title="Atualiza automaticamente a cada 60s">
                <Clock className="h-3 w-3" />
                {lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
          </div>

          <AdminDateBar range={dateRange} onChange={setDateRange} />

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            {isEmployee && (
              <span className="rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">STAFF</span>
            )}
            {periodVolume != null && (
              <span title="Volume bruto aprovado no período selecionado" className="hidden min-[1480px]:flex items-center gap-1.5 text-[12px] font-medium af-muted af-surface-2 af-border border rounded-md px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Volume {compactBRL(Number(periodVolume))}
              </span>
            )}

            <button
              onClick={toggleTheme}
              aria-label={themeButtonLabel}
              className="hidden sm:flex h-9 w-9 rounded-md items-center justify-center af-border border af-text-3 hover:af-surface-2 transition-colors"
              title={themeButtonLabel}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              onClick={() => handleTabChange(pendingWdCount > 0 && isAdmin ? "withdrawals" : isAdmin ? "notifications" : "god-mode")}
              aria-label={pendingWdCount > 0 ? `${pendingWdCount} saque(s) pendente(s). Abrir Saques` : "Abrir Notificações"}
              className="relative h-9 w-9 rounded-md flex items-center justify-center af-border border af-text-3 hover:af-surface-2 transition-colors"
              title={pendingWdCount > 0 ? `${pendingWdCount} saque(s) pendente(s)` : "Notificações"}
            >
              <Bell className="h-4 w-4" />
              {pendingWdCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                  {pendingWdCount}
                </span>
              )}
            </button>

            <button
              onClick={loadData}
              disabled={syncing}
              aria-label="Atualizar dados"
              title={lastSync ? `Atualizar agora. Última atualização às ${lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}; o painel atualiza sozinho a cada minuto.` : "Atualizar agora"}
              className="af-accent-bg flex h-9 items-center gap-2 px-2.5 sm:px-3 rounded-md text-[12.5px] font-semibold transition-colors disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto af-bg-soft scrollbar-thin admin-shell" data-admin-content>
          <div className="p-5 lg:p-7 xl:p-9 admin-fluid" key={activeTab}>
            <div className="mx-auto max-w-[1800px]">
              {loadError && (
                <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <span className="flex min-w-0 items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {lastSync
                        ? `Não foi possível atualizar os dados do painel. Vendas, sellers e saques abaixo são de ${lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`
                        : "Não foi possível carregar os dados do painel (vendas, sellers, produtos e saques do período). Os números abaixo ainda não foram carregados."}
                    </span>
                  </span>
                  <button
                    onClick={loadData}
                    disabled={syncing}
                    className="shrink-0 rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-muted disabled:opacity-60"
                  >
                    Tentar de novo
                  </button>
                </div>
              )}
              <Suspense fallback={<div className="min-h-[320px] animate-pulse rounded-2xl border border-border/50 bg-card/40" aria-label="Carregando área administrativa" />}>
              {activeTab === "god-mode" && (
                <>
                {dataCapHit.length > 0 && (
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                    <span>
                      Mostrando os {dataCapHit.map(c => `${c.count} ${c.field} mais recentes`).join(", ")} — pode haver mais dados no período selecionado.
                    </span>
                  </div>
                )}
                <AdminOverviewTab
                  transactions={transactions} profiles={profiles} products={products}
                  withdrawals={withdrawals} onWithdrawalAction={handleWithdrawalAction}
                  fmtCurrency={fmtCurrency}
                  isEmployee={isEmployee} dateRange={dateRange}
                   financialOverview={financialOverview}
                  onNavigate={(id) => handleTabChange(id as TabId)}
                />
                </>
              )}
              {activeTab === "tools" && isAdmin && (
                <AdminToolsTab transactions={transactions} profiles={profiles} withdrawals={withdrawals} />
              )}
              {activeTab === "command-center" && isAdmin && (
                <AdminCommandCenterTab
                  dateRange={dateRange}
                  fmtCurrency={fmtCurrency}
                  onNavigate={(id) => handleTabChange(id as TabId)}
                />
              )}
              {activeTab === "analytics" && isAdmin && (
                <AdminAnalyticsTab dateRange={dateRange} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "transactions" && (
                <AdminTransactionsTab profiles={profiles} products={products} dateRange={dateRange} onNavigate={isAdmin ? (id) => handleTabChange(id as TabId) : undefined} />
              )}
              {activeTab === "sellers" && isAdmin && (
                <AdminSellersTab profiles={profiles} transactions={transactions} withdrawals={withdrawals} onReload={loadData} fmtCurrency={fmtCurrency} isAdmin={isAdmin} dateRange={dateRange} />
              )}
              {activeTab === "products" && (
                <AdminProductsTab products={products} profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} onReload={loadData} />
              )}
              {activeTab === "top-sellers" && isAdmin && (
                <AdminTopSellersTab dateRange={dateRange} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "top-products" && isAdmin && (
                <AdminTopProductsTab products={products} profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "withdrawals" && isAdmin && (
                <AdminWithdrawalsTab withdrawals={withdrawals} profiles={profiles} onReload={loadData} />
              )}
              {activeTab === "risk-compliance" && isAdmin && (
                <AdminRiskComplianceTab profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "abuse-metrics" && isAdmin && <AdminAbuseMetricsTab />}
              {activeTab === "financial-audit" && isAdmin && <FinancialAuditTab profiles={profiles} />}
              {activeTab === "refund-approvals" && isAdmin && <RefundApprovalsTab />}
              {activeTab === "staff-requests" && isAdmin && <StaffRequestsTab profiles={profiles} />}
              {activeTab === "acquirers-panel" && isAdmin && <AcquirersPanel profiles={profiles} />}
              {activeTab === "fin-metrics" && isAdmin && (
                <div className="space-y-6 animate-fade-in">
                  <FinanceiroHero
                    eyebrow="Financeiro · Métricas"
                    title="Métricas financeiras"
                    subtitle="Quanto entra, quanto sai e cada tipo de taxa, por período, seller e adquirente. O período daqui é próprio e não segue o seletor do topo."
                  />
                  <FinancialMetricsPanel profiles={profiles} />
                </div>
              )}
              {["medpix", "refunds", "chargeback", "premed"].includes(activeTab) && isAdmin && (
                <DisputesCenter
                  profiles={profiles}
                  initialType={activeTab === "refunds" ? "refund" : activeTab === "premed" ? "pre_med_pix" : activeTab === "chargeback" ? "chargeback" : "medpix"}
                />
              )}
              {activeTab === "employees" && isAdmin && <AdminEmployeesTab profiles={profiles} onReload={loadData} />}
              {activeTab === "managers" && isAdmin && <AdminManagersTab profiles={profiles} onReload={loadData} />}
              {activeTab === "staff-commissions" && isAdmin && <AdminStaffCommissionsTab profiles={profiles} />}
              {activeTab === "notifications" && isAdmin && <AdminNotificationsTab profiles={profiles} />}
              {activeTab === "coupons" && isAdmin && <AdminCouponsTab profiles={profiles} products={products} transactions={transactions} fmtCurrency={fmtCurrency} />}
              {activeTab === "courses" && isAdmin && <AdminCoursesTab profiles={profiles} products={products} />}
              {activeTab === "affiliates" && isAdmin && <AdminAffiliateSalesTab profiles={profiles} products={products} fmtCurrency={fmtCurrency} />}
              {activeTab === "subscriptions" && isAdmin && <AdminSubscriptionsTab profiles={profiles} fmtCurrency={fmtCurrency} />}
              {activeTab === "referrals" && isAdmin && <AdminReferralsTab profiles={profiles} fmtCurrency={fmtCurrency} />}
              {activeTab === "payment-links" && isAdmin && <AdminPaymentLinksTab />}
              {activeTab === "checkout-deliveries" && isAdmin && <AdminCheckoutDeliveriesTab />}
              {activeTab === "support" && (isAdmin || hasSupportPerm) && <AdminSupportTab profiles={profiles} />}
              {activeTab === "rewards" && isAdmin && <AdminRewardsTab profiles={profiles} />}
              {activeTab === "corridas" && isAdmin && <AdminCorridasTab />}
              {activeTab === "goals" && isAdmin && <AdminGoalsTab />}
              {activeTab === "audit" && isAdmin && <AdminAuditTab profiles={profiles} />}
              {activeTab === "error-logs" && isAdmin && <AdminErrorLogsTab profiles={profiles} />}
              {activeTab === "inactive-sellers" && isAdmin && (
                <AdminInactiveSellersTab fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "settings" && isAdmin && <AdminSettingsTab />}
              </Suspense>
            </div>
          </div>
        </main>
      </div>
      {reasonDialog}
    </div>
  );
}
