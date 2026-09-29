import { lazy, Suspense, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import {
  Shield, LogOut, Zap, LayoutDashboard, Users, Package, AlertTriangle,
  RotateCcw, ShieldAlert, CreditCard, ArrowDownToLine, Tag, GraduationCap,
  Activity, Settings, Bell, MessageSquare,
  UserCog, RefreshCw, Coins,
  Bug, UserX, ShieldCheck,
  Package2, BarChart3, Calendar,
  PanelLeftClose, PanelLeft,
  Trophy, Search, ChevronDown, Sun, Moon, Target, Gauge, Lock, Clock, SearchX,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { logAdminAction } from "@/lib/auditLog";
import { cn, isApprovedTransaction } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AdminFinancialOverview } from "./tabs/AdminOverviewTab";

const AdminOverviewTab = lazy(() => import("./tabs/AdminOverviewTab"));
const AdminSellersTab = lazy(() => import("./tabs/AdminSellersTab"));
const AdminProductsTab = lazy(() => import("./tabs/AdminProductsTab"));
const DisputesCenter = lazy(() => import("@/features/admin-finance/DisputesCenter"));
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

const EMPLOYEE_ALLOWED_TABS = new Set(["god-mode", "sellers", "products", "transactions"] as string[]);

const NAV_SECTIONS: { id: string; label: string; items: { id: string; label: string; icon: LucideIcon; employeeAccess: boolean }[] }[] = [
  {
    id: "core", label: "Operacional",
    items: [
      { id: "god-mode", label: "Dashboard", icon: LayoutDashboard, employeeAccess: true },
      { id: "command-center", label: "Centro de Comando", icon: Gauge, employeeAccess: false },
      { id: "analytics", label: "Analytics", icon: BarChart3, employeeAccess: false },
      { id: "sellers", label: "Sellers", icon: Users, employeeAccess: true },
      { id: "top-sellers", label: "Top Sellers", icon: Zap, employeeAccess: false },
      { id: "inactive-sellers", label: "Inativos", icon: UserX, employeeAccess: false },
      { id: "employees", label: "Staff", icon: UserCog, employeeAccess: false },
      { id: "managers", label: "Gerentes", icon: Shield, employeeAccess: false },
      { id: "staff-commissions", label: "Comissões Staff", icon: Coins, employeeAccess: false },
    ],
  },
  {
    id: "treasury", label: "Financeiro",
    items: [
      { id: "withdrawals", label: "Saques", icon: ArrowDownToLine, employeeAccess: false },
      { id: "transactions", label: "Transações", icon: CreditCard, employeeAccess: true },
      { id: "payment-links", label: "Links de Pagamento", icon: LinkIcon, employeeAccess: false },
    ],
  },
  {
    id: "risk", label: "Risco & Compliance",
    items: [
      { id: "risk-compliance", label: "Anti-Fraude", icon: ShieldCheck, employeeAccess: false },
      { id: "abuse-metrics", label: "Abuso & Auth", icon: ShieldAlert, employeeAccess: false },
      { id: "medpix", label: "MedPix", icon: AlertTriangle, employeeAccess: false },
      { id: "chargeback", label: "Chargeback", icon: CreditCard, employeeAccess: false },
      { id: "refunds", label: "Reembolsos", icon: RotateCcw, employeeAccess: false },
      { id: "premed", label: "Pre-Med", icon: ShieldAlert, employeeAccess: false },
    ],
  },
  {
    id: "content", label: "Conteúdo",
    items: [
      { id: "products", label: "Produtos", icon: Package, employeeAccess: true },
      { id: "top-products", label: "Top Produtos", icon: Package2, employeeAccess: false },
      { id: "courses", label: "Cursos", icon: GraduationCap, employeeAccess: false },
      { id: "coupons", label: "Cupons", icon: Tag, employeeAccess: false },
      { id: "affiliates", label: "Afiliados", icon: Users, employeeAccess: false },
      { id: "subscriptions", label: "Assinaturas", icon: CreditCard, employeeAccess: false },
      { id: "referrals", label: "Indicações", icon: Zap, employeeAccess: false },
    ],
  },
  {
    id: "system", label: "Sistema",
    items: [
      { id: "settings", label: "Configurações", icon: Settings, employeeAccess: false },
      { id: "error-logs", label: "Error Logs", icon: Bug, employeeAccess: false },
      { id: "notifications", label: "Notificações", icon: Bell, employeeAccess: false },
      { id: "support", label: "Suporte", icon: MessageSquare, employeeAccess: false },
      { id: "rewards", label: "Premiações", icon: Trophy, employeeAccess: false },
      { id: "corridas", label: "Corridas Faturamento", icon: Trophy, employeeAccess: false },
      { id: "goals", label: "Metas de Faturamento", icon: Target, employeeAccess: false },
      { id: "tools", label: "Ferramentas", icon: Settings, employeeAccess: false },
      { id: "audit", label: "Auditoria", icon: Activity, employeeAccess: false },
    ],
  },
];

type TabId = string;
type DatePresetId = "today" | "yesterday" | "7d" | "14d" | "40d";

const DATE_PRESETS: { id: DatePresetId; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7d" },
  { id: "14d", label: "14d" },
  { id: "40d", label: "40d" },
];

const ALL_TAB_IDS = new Set(NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id)));

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  useIdleLogout(15);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [financialOverview, setFinancialOverview] = useState<AdminFinancialOverview | null>(null);
  const [dataCapHit, setDataCapHit] = useState<{ field: string; count: number }[]>([]);
  const lastLoadAtRef = useRef<number>(0);
  const loadRequestRef = useRef(0);
  const loadInFlightRef = useRef(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [hasSupportPerm, setHasSupportPerm] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  // A aba ativa vive na URL (?tab=...) para sobreviver a refresh e voltar/avançar.
  const urlTab = searchParams.get("tab") ?? "";
  const activeTab: TabId = ALL_TAB_IDS.has(urlTab) ? urlTab : "god-mode";
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const navSearchRef = useRef<HTMLInputElement>(null);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [datePreset, setDatePreset] = useState<DatePresetId | "custom">("today");
  const [calOpen, setCalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (loadInFlightRef.current) {
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
      if (requestId !== loadRequestRef.current) return;
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
      lastLoadAtRef.current = Date.now();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "desconhecido";
      toast.error("Erro ao carregar dados: " + msg);
    } finally {
      loadInFlightRef.current = false;
      if (requestId === loadRequestRef.current) setSyncing(false);
    }
  }, [dateRange.from, dateRange.to]);

  // ── Role check (runs ONCE when user is available) ──
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/admin-matheus", { replace: true }); return; }
    let cancelled = false;
    (async () => {
      try {
        const [adminRes, employeeRes, permRes] = await Promise.all([
          supabase.rpc("current_user_has_role", { _role: "admin" }),
          supabase.rpc("current_user_has_role", { _role: "employee" }),
          supabase.from("staff_permissions").select("permission_key").eq("user_id", user.id).eq("permission_key", "view_support"),
        ]);
        if (cancelled) return;
        const hasAdmin = adminRes.data === true;
        const hasEmployee = employeeRes.data === true;
        const hasSupport = (permRes.data?.length ?? 0) > 0;
        if (!hasAdmin && !hasEmployee) { navigate("/admin-matheus"); return; }
        if (hasAdmin) setIsAdmin(true);
        else if (hasEmployee) setIsEmployee(true);
        setHasSupportPerm(hasSupport);
        setRoleChecked(true);
      } catch {
        if (!cancelled) toast.error("Falha ao verificar permissões");
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, navigate]);

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

  const handleDatePreset = (preset: DatePresetId) => {
    const now = new Date();
    if (preset === "today") setDateRange({ from: startOfDay(now), to: endOfDay(now) });
    else if (preset === "yesterday") {
      const yesterday = subDays(now, 1);
      setDateRange({ from: startOfDay(yesterday), to: endOfDay(yesterday) });
    } else {
      const days = Number(preset.replace("d", ""));
      setDateRange({ from: startOfDay(subDays(now, days - 1)), to: endOfDay(now) });
    }
    setDatePreset(preset);
  };

  const handleWithdrawalAction = async (id: string, action: "approved" | "rejected") => {
    if (!isAdmin) { toast.error("Sem permissão"); return; }
    if (action === "approved") {
      toast.error("Saques estão indisponíveis sem uma adquirente configurada.");
      return;
    } else {
      const { error, data: updated } = await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", id).eq("status", "pending").select("id");
      if (error) { toast.error("Erro ao recusar"); return; }
      if (!updated || updated.length === 0) { toast.error("Saque já foi processado"); loadData(); return; }
      toast.success("Saque recusado");
      await logAdminAction("reject_withdrawal", "withdrawal", id);
    }
    loadData();
  };

  const handleUserStatus = async (userId: string, status: string) => {
    // Alterar status de conta é ação privilegiada: apenas admin.
    if (!isAdmin) { toast.error("Sem permissão"); return; }
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("user_id", userId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Conta ${status === "approved" ? "aprovada" : "bloqueada"}!`);
    await logAdminAction(status === "approved" ? "approve_user" : "block_user", "profile", userId, { new_status: status });
    loadData();
  };

  const handleLogout = async () => {
    await logAdminAction("admin_logout", "session", user?.id ?? "unknown");
    await supabase.auth.signOut();
    navigate("/admin-matheus");
  };

  const fmtCurrency = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const pendingWdCount = withdrawals.filter(w => w.status === "pending").length;
  const allItems = NAV_SECTIONS.flatMap(s => s.items);
  const activeTabLabel = allItems.find(i => i.id === activeTab)?.label || "";

  const handleTabChange = useCallback((tabId: TabId) => {
    if (isEmployee && !EMPLOYEE_ALLOWED_TABS.has(tabId) && !(tabId === "support" && hasSupportPerm)) {
      toast.error("Sem permissão para acessar esta área");
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tabId);
      return next;
    }, { replace: false });
    const scrollable = document.querySelector("[data-admin-content]");
    if (scrollable) scrollable.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [isEmployee, hasSupportPerm, setSearchParams]);

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


  const visibleSections = isEmployee
    ? NAV_SECTIONS.map(s => ({
        ...s,
        items: s.items.filter(i => i.employeeAccess || (i.id === "support" && hasSupportPerm)),
      })).filter(s => s.items.length > 0)
    : NAV_SECTIONS;

  const filteredSections = navQuery.trim()
    ? visibleSections
        .map(s => ({ ...s, items: s.items.filter(i => i.label.toLowerCase().includes(navQuery.toLowerCase())) }))
        .filter(s => s.items.length > 0)
    : visibleSections;

  const approvedTx = transactions.filter(t => isApprovedTransaction(t.status));
  const totalRevenue = approvedTx.reduce((a, t) => a + Number(t.net_amount), 0);

  if (loading) {
    return (
      <div className="admin-frame min-h-screen flex items-center justify-center af-bg-soft">
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

  return (
    <div className="admin-frame h-screen flex overflow-hidden af-bg-soft af-text">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-background/80 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside
        className={cn(
          "relative z-[70] h-full flex flex-col shrink-0 transition-[width] duration-200 af-surface af-border border-r",
          sidebarCollapsed ? "w-[72px]" : "w-[264px]",
          "max-lg:fixed max-lg:left-0 max-lg:top-0",
          mobileMenuOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="h-[64px] flex items-center px-4 gap-3 af-border border-b shrink-0">
           <div className="h-9 w-9 rounded-md af-accent-bg flex items-center justify-center shrink-0 text-primary-foreground">
            <Shield className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold tracking-tight af-text leading-tight">VENXPAY</h1>
              <p className="text-[11px] af-muted leading-tight">{isEmployee ? "Staff Panel" : "Admin Panel"}</p>
            </div>
          )}
        </div>

        {/* Search */}
        {!sidebarCollapsed && (
          <div className="px-3 pt-3.5 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 af-muted-2" />
              <input
                ref={navSearchRef}
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder="Buscar aba..."
                aria-label="Buscar aba do painel"
                className="af-input w-full h-9 pl-9 pr-12 text-[13px] rounded-md focus:outline-none"
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold af-muted-2 pointer-events-none">⌘K</kbd>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 scrollbar-thin">
          {filteredSections.length === 0 && !sidebarCollapsed && (
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
              {!sidebarCollapsed && (
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] af-muted-2 px-2.5 mb-1.5 mt-1">
                  {section.label}
                </p>
              )}
              {sidebarCollapsed && <div className="h-px af-border border-t mx-2 mb-1.5" />}
              <div className="space-y-px">
                {section.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const hasBadge = item.id === "withdrawals" && pendingWdCount > 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { handleTabChange(item.id as TabId); setMobileMenuOpen(false); }}
                      title={sidebarCollapsed ? item.label : undefined}
                      data-active={isActive ? "true" : "false"}
                      className={cn(
                        "admin-nav-item relative w-full flex items-center gap-3 rounded-md group",
                        sidebarCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                        isActive ? "af-accent-bg" : "af-text-3 hover:af-surface-2 hover:af-text"
                      )}
                      style={!isActive ? {} : undefined}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "" : "af-muted group-hover:af-text")} strokeWidth={2} />
                      {!sidebarCollapsed && (
                        <span className={cn("text-[13.5px] truncate", isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
                      )}
                      {hasBadge && (
                        <span className={cn(
                           "h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center",
                          sidebarCollapsed ? "absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px]" : "ml-auto"
                         )}>
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
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md af-muted hover:af-surface-2 hover:af-text transition-colors max-lg:hidden"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!sidebarCollapsed && <span className="text-[11.5px] font-medium">Recolher</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md af-muted hover:af-surface-2 transition-colors"
            style={{ }}
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span className="text-[11.5px] font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-[64px] flex items-center px-4 lg:px-6 gap-3 shrink-0 af-surface af-border border-b">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden h-8 w-8 rounded-md flex items-center justify-center af-border border af-text-3 hover:af-surface-2"
            >
              <PanelLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[12px] font-medium af-muted-2 hidden sm:inline">Admin</span>
              <ChevronDown className="h-3 w-3 af-muted-2 -rotate-90 hidden sm:inline" />
              <h2 className="text-[16px] font-semibold af-text truncate">{activeTabLabel}</h2>
            </div>

            {syncing ? (
              <span className="hidden sm:flex items-center gap-1.5 text-[11.5px] font-medium af-muted af-surface-2 af-border border rounded-md px-2.5 py-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Sincronizando
              </span>
            ) : lastSync ? (
              <span className="hidden xl:flex items-center gap-1.5 text-[11.5px] font-medium af-muted-2" title="Atualiza automaticamente a cada 60s">
                <Clock className="h-3 w-3" />
                {lastSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
          </div>

          {/* Date picker */}
          <div className="flex items-center gap-px p-0.5 rounded-md af-surface-2 af-border border max-w-[50vw] overflow-x-auto scrollbar-thin md:max-w-none md:overflow-visible">
            {DATE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => handleDatePreset(p.id)}
                className={cn(
                   "px-2.5 md:px-3 py-1.5 rounded text-[12px] font-semibold transition-colors shrink-0",
                  datePreset === p.id
                    ? "af-surface af-text af-border border"
                    : "af-muted hover:af-text"
                )}
              >
                {p.label}
              </button>
            ))}
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button
                  title="Período personalizado"
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors shrink-0",
                    datePreset === "custom" ? "af-surface af-text af-border border" : "af-muted hover:af-text hover:af-surface"
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {datePreset === "custom" && (
                    <span className="text-[11.5px] font-semibold whitespace-nowrap">
                      {dateRange.from.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}–{dateRange.to.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 af-surface af-border border rounded-md shadow-lg" align="end">
                <CalendarComponent
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                      setDatePreset("custom");
                      setCalOpen(false);
                    }
                  }}
                  className="p-3 pointer-events-auto"
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            {isEmployee && (
              <span className="rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">STAFF</span>
            )}
              <span className="hidden lg:flex items-center gap-1.5 text-[12px] font-medium af-muted af-surface-2 af-border border rounded-md px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Volume {totalRevenue >= 1000 ? `R$ ${(totalRevenue / 1000).toFixed(1)}K` : fmtCurrency(totalRevenue)}
            </span>

            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-md flex items-center justify-center af-border border af-text-3 hover:af-surface-2 transition-colors"
              title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              onClick={() => {
                if (pendingWdCount > 0) handleTabChange("withdrawals");
                else handleTabChange("notifications");
              }}
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
              className="af-accent-bg flex items-center gap-2 px-3 py-2 rounded-md text-[12.5px] font-semibold transition-colors disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto af-bg-soft scrollbar-thin admin-shell" data-admin-content>
          <div className="p-5 lg:p-7 xl:p-9 admin-fluid" key={activeTab}>
            <div className="mx-auto max-w-[1800px]">
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
                  onUserStatus={handleUserStatus} fmtCurrency={fmtCurrency}
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
                  transactions={transactions}
                  profiles={profiles}
                  withdrawals={withdrawals}
                  fmtCurrency={fmtCurrency}
                  onNavigate={(id) => handleTabChange(id as TabId)}
                />
              )}
              {activeTab === "analytics" && isAdmin && (
                <AdminAnalyticsTab transactions={transactions} profiles={profiles} products={products} withdrawals={withdrawals} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "transactions" && (
                <AdminTransactionsTab transactions={transactions} profiles={profiles} products={products} fmtCurrency={fmtCurrency} onReload={loadData} dateRange={dateRange} />
              )}
              {activeTab === "sellers" && (
                <AdminSellersTab profiles={profiles} transactions={transactions} withdrawals={withdrawals} onReload={loadData} fmtCurrency={fmtCurrency} isAdmin={isAdmin} />
              )}
              {activeTab === "products" && (
                <AdminProductsTab products={products} profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} onReload={loadData} />
              )}
              {activeTab === "top-sellers" && isAdmin && (
                <AdminTopSellersTab profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "top-products" && isAdmin && (
                <AdminTopProductsTab products={products} profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "withdrawals" && isAdmin && (
                <AdminWithdrawalsTab withdrawals={withdrawals} profiles={profiles} onWithdrawalAction={handleWithdrawalAction} onReload={loadData} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "risk-compliance" && isAdmin && (
                <AdminRiskComplianceTab profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "abuse-metrics" && isAdmin && <AdminAbuseMetricsTab />}
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
              {activeTab === "payment-links" && isAdmin && <AdminPaymentLinksTab fmtCurrency={fmtCurrency} />}
              {activeTab === "support" && (isAdmin || hasSupportPerm) && <AdminSupportTab profiles={profiles} />}
              {activeTab === "rewards" && isAdmin && <AdminRewardsTab profiles={profiles} />}
              {activeTab === "corridas" && isAdmin && <AdminCorridasTab />}
              {activeTab === "goals" && isAdmin && <AdminGoalsTab />}
              {activeTab === "audit" && isAdmin && <AdminAuditTab profiles={profiles} />}
              {activeTab === "error-logs" && isAdmin && <AdminErrorLogsTab profiles={profiles} />}
              {activeTab === "inactive-sellers" && isAdmin && (
                <AdminInactiveSellersTab profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "settings" && isAdmin && <AdminSettingsTab />}
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
