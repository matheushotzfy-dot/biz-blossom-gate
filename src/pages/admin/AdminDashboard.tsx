import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, Zap, LayoutDashboard, Users, Package, AlertTriangle,
  RotateCcw, ShieldAlert, CreditCard, ArrowDownToLine, Tag, GraduationCap,
  Activity, Settings, Bell,
  Moon, Sun, UserCog, RefreshCw, Rocket,
  Bug, UserX, Search, Banknote, ShieldCheck,
  FileWarning, Package2, Radio, BarChart3, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { logAdminAction } from "@/lib/auditLog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import AdminOverviewTab from "./tabs/AdminOverviewTab";
import AdminSellersTab from "./tabs/AdminSellersTab";
import AdminProductsTab from "./tabs/AdminProductsTab";
import AdminDisputesTab from "./tabs/AdminDisputesTab";
import AdminTransactionsTab from "./tabs/AdminTransactionsTab";
import AdminWithdrawalsTab from "./tabs/AdminWithdrawalsTab";
import AdminCouponsTab from "./tabs/AdminCouponsTab";
import AdminCoursesTab from "./tabs/AdminCoursesTab";
import AdminAuditTab from "./tabs/AdminAuditTab";
import AdminSettingsTab from "./tabs/AdminSettingsTab";
import AdminAcquirersTab from "./tabs/AdminAcquirersTab";
import AdminEmployeesTab from "./tabs/AdminEmployeesTab";
import AdminTopSellersTab from "./tabs/AdminTopSellersTab";
import AdminTopProductsTab from "./tabs/AdminTopProductsTab";
import AdminErrorLogsTab from "./tabs/AdminErrorLogsTab";
import AdminInactiveSellersTab from "./tabs/AdminInactiveSellersTab";
import AdminRiskComplianceTab from "./tabs/AdminRiskComplianceTab";
import AdminAnalyticsTab from "./tabs/AdminAnalyticsTab";
import AdminManagersTab from "./tabs/AdminManagersTab";
import AdminNotificationsTab from "./tabs/AdminNotificationsTab";

const EMPLOYEE_ALLOWED_TABS = new Set(["god-mode", "sellers", "products", "transactions"] as string[]);

const NAV_ITEMS = [
  { id: "god-mode", label: "Dashboard", icon: LayoutDashboard, section: "core", employeeAccess: true },
  { id: "analytics", label: "Analytics", icon: BarChart3, section: "core", employeeAccess: false },
  { id: "sellers", label: "Sellers", icon: Users, section: "core", employeeAccess: true },
  { id: "top-sellers", label: "Top Sellers", icon: Zap, section: "core", employeeAccess: false },
  { id: "inactive-sellers", label: "Inativos", icon: UserX, section: "core", employeeAccess: false },
  { id: "employees", label: "Staff", icon: UserCog, section: "core", employeeAccess: false },
  { id: "managers", label: "Gerentes", icon: Shield, section: "core", employeeAccess: false },
  { id: "withdrawals", label: "Saques", icon: ArrowDownToLine, section: "treasury", employeeAccess: false },
  { id: "transactions", label: "Transações", icon: CreditCard, section: "treasury", employeeAccess: true },
  { id: "risk-compliance", label: "Anti-Fraude", icon: ShieldCheck, section: "risk", employeeAccess: false },
  { id: "medpix", label: "MedPix", icon: AlertTriangle, section: "risk", employeeAccess: false },
  { id: "refunds", label: "Reembolsos", icon: RotateCcw, section: "risk", employeeAccess: false },
  { id: "premed", label: "Pre-Med", icon: ShieldAlert, section: "risk", employeeAccess: false },
  { id: "products", label: "Produtos", icon: Package, section: "content", employeeAccess: true },
  { id: "top-products", label: "Top Prod.", icon: Package2, section: "content", employeeAccess: false },
  { id: "courses", label: "Cursos", icon: GraduationCap, section: "content", employeeAccess: false },
  { id: "coupons", label: "Cupons", icon: Tag, section: "content", employeeAccess: false },
  { id: "acquirers", label: "Adquirentes", icon: Banknote, section: "system", employeeAccess: false },
  { id: "settings", label: "Config", icon: Settings, section: "system", employeeAccess: false },
  { id: "error-logs", label: "Erros", icon: Bug, section: "system", employeeAccess: false },
  { id: "notifications", label: "Notificações", icon: Bell, section: "system", employeeAccess: false },
  { id: "audit", label: "Audit", icon: Activity, section: "system", employeeAccess: false },
] as const;

type TabId = typeof NAV_ITEMS[number]["id"];

const DATE_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("god-mode");
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [datePreset, setDatePreset] = useState("30d");
  const [calOpen, setCalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // CRITICAL: Force dark mode on admin panel to prevent white flash
  // Save previous theme and restore on unmount
  useEffect(() => {
    const prevTheme = theme;
    setTheme("dark");
    return () => {
      // Restore previous theme when leaving admin
      setTheme(prevTheme as "light" | "dark");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.rpc("current_user_has_role", { _role: "admin" }),
      supabase.rpc("current_user_has_role", { _role: "employee" as any }),
    ]).then(([adminRes, employeeRes]) => {
      const hasAdmin = adminRes.data === true;
      const hasEmployee = employeeRes.data === true;
      if (!hasAdmin && !hasEmployee) { navigate("/admin-matheus"); return; }
      if (hasAdmin) setIsAdmin(true);
      else if (hasEmployee) setIsEmployee(true);
      setLoading(false);
      loadData();
    });
  }, [user]);

  const loadData = async () => {
    setSyncing(true);
    // FIX: Increased limits to avoid silently truncating data for large platforms
    const [txRes, pRes, prodRes, wRes] = await Promise.all([
      supabase.from("transactions").select("id, user_id, product_id, amount, fee_amount, net_amount, status, payment_method, customer_name, customer_email, created_at, updated_at, retained_amount, retention_released").order("created_at", { ascending: false }).limit(1000),
      supabase.from("profiles").select("id, user_id, full_name, email, account_status, document_number, document_type, phone, nickname, seller_type, acquirer_id, balance_frozen, created_at, updated_at, avatar_url, kyc_rejection_reason, admin_notes, last_login_at").order("created_at", { ascending: false }).limit(1000),
      supabase.from("products").select("id, user_id, name, price, status, created_at, updated_at, image_url, checkout_url, affiliate_enabled, affiliate_commission").limit(1000),
      supabase.from("withdrawals").select("id, user_id, amount, fee_amount, net_amount, status, created_at, processed_at, bank_account_id, withdrawal_type, crypto_currency, crypto_network, crypto_address").order("created_at", { ascending: false }).limit(1000),
    ]);
    if (txRes.data) setTransactions(txRes.data as any);
    if (pRes.data) setProfiles(pRes.data as any);
    if (prodRes.data) setProducts(prodRes.data as any);
    if (wRes.data) setWithdrawals(wRes.data as any);
    setSyncing(false);
  };

  const handleDatePreset = (days: number) => {
    const to = new Date();
    const from = days === 0 ? startOfDay(to) : subDays(to, days);
    setDateRange({ from, to });
    setDatePreset(days === 0 ? "Hoje" : `${days}d`);
  };

  if (loading) return (
    <div className="dark min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, #07071a 0%, #060614 40%, #04040f 100%)", fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.35)] ring-1 ring-white/10">
            <Shield className="h-7 w-7 text-white drop-shadow-lg" />
          </div>
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 blur-xl animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-[11px] font-bold tracking-[0.35em] uppercase text-white/25">Initializing</p>
          <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-indigo-400/50 mt-1.5">Control Center</p>
        </div>
      </motion.div>
    </div>
  );

  const handleWithdrawalAction = async (id: string, action: "approved" | "rejected") => {
    if (!isAdmin) { toast.error("Sem permissão"); return; }
    if (action === "approved") {
      toast.info("Processando saque via PIX...");
      const { data, error } = await supabase.functions.invoke("podpay-cashout", { body: { withdrawalId: id } });
      if (error || !data?.success) { toast.error("Erro ao processar saque"); return; }
      toast.success("Saque aprovado e enviado!");
      await logAdminAction("approve_withdrawal", "withdrawal", id, { method: "podpay_pix" });
    } else {
      // FIX: Supabase JS v2 doesn't return count by default. Use select after update to verify.
      const { error, data: updated } = await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", id).eq("status", "pending").select("id");
      if (error) { toast.error("Erro ao recusar"); return; }
      if (!updated || updated.length === 0) { toast.error("Saque já foi processado"); loadData(); return; }
      toast.success("Saque recusado");
      await logAdminAction("reject_withdrawal", "withdrawal", id);
    }
    loadData();
  };

  const handleUserStatus = async (userId: string, status: string) => {
    if (!isAdmin && !isEmployee) { toast.error("Sem permissão"); return; }
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("user_id", userId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Conta ${status === "approved" ? "aprovada" : "bloqueada"}!`);
    await logAdminAction(status === "approved" ? "approve_user" : "block_user", "profile", userId, { new_status: status });
    loadData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin-matheus");
  };

  const fmtCurrency = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const pendingWdCount = withdrawals.filter(w => w.status === "pending").length;
  const activeTabLabel = NAV_ITEMS.find(i => i.id === activeTab)?.label || "";

  const handleTabChange = (tabId: TabId) => {
    if (isEmployee && !EMPLOYEE_ALLOWED_TABS.has(tabId)) {
      toast.error("Sem permissão para acessar esta área");
      return;
    }
    setActiveTab(tabId);
    setMoreOpen(false);
    // Scroll main content to top — target the actual scrollable container
    const scrollable = document.querySelector("[data-admin-content]");
    if (scrollable) scrollable.scrollTop = 0;
    else window.scrollTo(0, 0);
  };

  // Visible nav items (first 8 for top bar, rest in "more")
  const visibleItems = isEmployee ? NAV_ITEMS.filter(i => i.employeeAccess) : [...NAV_ITEMS];
  const primaryNav = visibleItems.slice(0, 10);
  const overflowNav = visibleItems.slice(10);

  return (
    <div
      className="dark h-screen text-white flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #07071a 0%, #060614 40%, #04040f 100%)",
        fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif",
      }}
    >
      {/* ═══ Ambient Glow — multi-layered ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-200px] left-1/4 w-[900px] h-[600px] bg-indigo-950/10 rounded-full blur-[200px]" />
        <div className="absolute top-[40%] right-[-100px] w-[500px] h-[500px] bg-violet-950/[0.07] rounded-full blur-[160px]" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-blue-950/[0.05] rounded-full blur-[150px]" />
      </div>

      {/* ═══ TOP NAVIGATION BAR ═══ */}
      <header className="relative z-50 h-[56px] border-b border-white/[0.06] flex items-center px-4 lg:px-6 gap-3 shrink-0 backdrop-blur-3xl bg-[#0a0a1e]/80">
        {/* Logo */}
        <div className="flex items-center gap-3 mr-5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center shadow-[0_0_24px_rgba(99,102,241,0.3)] ring-1 ring-white/10">
            <Rocket className="h-4 w-4 text-white drop-shadow-sm" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-[14px] font-black tracking-tight bg-gradient-to-r from-white via-white/90 to-indigo-200 bg-clip-text text-transparent">HOTZFY</h1>
            <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-indigo-400/60">
              {isEmployee ? "Employee Panel" : "Control Center"}
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent mr-1" />

        {/* Primary Navigation */}
        <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none py-1.5">
          {primaryNav.map((item) => {
            const isActive = activeTab === item.id;
            const hasBadge = item.id === "withdrawals" && pendingWdCount > 0;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id as TabId)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-b from-indigo-500/15 to-indigo-500/5 text-white shadow-[inset_0_1px_0_rgba(99,102,241,0.15),0_2px_8px_rgba(0,0,0,0.2)] border border-indigo-500/20"
                    : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
                )}
              >
                <item.icon className={cn("h-3.5 w-3.5", isActive ? "text-indigo-400" : "opacity-50")} />
                <span className="hidden lg:inline">{item.label}</span>
                {hasBadge && (
                  <span className="h-4 min-w-[16px] px-1 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-[8px] font-bold flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.5)] ring-1 ring-red-400/30">
                    {pendingWdCount}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="admin-nav-indicator"
                    className="absolute -bottom-[11px] left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 shadow-[0_0_16px_rgba(99,102,241,0.7)]"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}

          {/* More dropdown */}
          {overflowNav.length > 0 && (
            <Popover open={moreOpen} onOpenChange={setMoreOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.03] transition-all">
                  <span>More</span>
                  <span className="text-[9px] bg-white/[0.06] rounded px-1 py-0.5">{overflowNav.length}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 bg-[#0e0e22]/98 backdrop-blur-3xl border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.9)] rounded-2xl" align="start">
                {overflowNav.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id as TabId)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all",
                      activeTab === item.id
                        ? "bg-indigo-500/12 text-indigo-400 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)]"
                        : "text-white/35 hover:text-white/70 hover:bg-white/[0.05]"
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
        {/* Date Picker */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            {DATE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => handleDatePreset(p.days)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                  datePreset === (p.days === 0 ? "Hoje" : `${p.days}d`)
                    ? "bg-indigo-500/15 text-indigo-400 shadow-sm ring-1 ring-indigo-500/20"
                    : "text-white/25 hover:text-white/50"
                )}
              >
                {p.label}
              </button>
            ))}
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button className="px-2 py-1 rounded-md text-white/25 hover:text-white/50 transition-all">
                  <Calendar className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[#0e0e22]/98 backdrop-blur-3xl border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.9)] rounded-2xl" align="end">
                <CalendarComponent
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range: any) => {
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

          {isEmployee && (
            <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 uppercase tracking-wider">Staff</span>
          )}

          <button className="relative h-7 w-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all group">
            <Bell className="h-3 w-3 text-white/30 group-hover:text-white/60 transition-colors" />
            {pendingWdCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-gradient-to-r from-red-500 to-rose-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)] ring-2 ring-[#08081a]" />}
          </button>

          <button
            onClick={loadData}
            disabled={syncing}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-all"
          >
            <RefreshCw className={cn("h-2.5 w-2.5", syncing && "animate-spin")} /> Sync
          </button>

          {/* Admin is always dark — no theme toggle needed */}

          <button onClick={handleLogout} className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06] hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all">
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 overflow-y-auto relative z-10 scrollbar-thin" data-admin-content>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="p-4 lg:p-6 xl:p-8"
          >
            <div className="mx-auto max-w-[1800px]">
              {activeTab === "god-mode" && (
                <AdminOverviewTab
                  transactions={transactions} profiles={profiles} products={products}
                  withdrawals={withdrawals} onWithdrawalAction={handleWithdrawalAction}
                  onUserStatus={handleUserStatus} fmtCurrency={fmtCurrency}
                  isEmployee={isEmployee} dateRange={dateRange}
                />
              )}
              {activeTab === "analytics" && isAdmin && (
                <AdminAnalyticsTab transactions={transactions} profiles={profiles} products={products} withdrawals={withdrawals} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "transactions" && (
                <AdminTransactionsTab transactions={transactions} profiles={profiles} products={products} fmtCurrency={fmtCurrency} onReload={loadData} />
              )}
              {activeTab === "sellers" && (
                <AdminSellersTab profiles={profiles} transactions={transactions} withdrawals={withdrawals} onReload={loadData} fmtCurrency={fmtCurrency} />
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
                <AdminWithdrawalsTab withdrawals={withdrawals} profiles={profiles} onWithdrawalAction={handleWithdrawalAction} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "acquirers" && isAdmin && <AdminAcquirersTab />}
              {activeTab === "risk-compliance" && isAdmin && (
                <AdminRiskComplianceTab profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "medpix" && isAdmin && (
                <AdminDisputesTab type="medpix" title="MedPix" profiles={profiles} transactions={transactions} products={products} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "refunds" && isAdmin && (
                <AdminDisputesTab type="refund" title="Reembolsos" profiles={profiles} transactions={transactions} products={products} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "premed" && isAdmin && (
                <AdminDisputesTab type="pre_med_pix" title="Pre-Med PIX" profiles={profiles} transactions={transactions} products={products} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "employees" && isAdmin && <AdminEmployeesTab profiles={profiles} onReload={loadData} />}
              {activeTab === "managers" && isAdmin && <AdminManagersTab profiles={profiles} onReload={loadData} />}
              {activeTab === "notifications" && isAdmin && <AdminNotificationsTab profiles={profiles} />}
              {activeTab === "coupons" && isAdmin && <AdminCouponsTab profiles={profiles} fmtCurrency={fmtCurrency} />}
              {activeTab === "courses" && isAdmin && <AdminCoursesTab profiles={profiles} products={products} />}
              {activeTab === "audit" && isAdmin && <AdminAuditTab profiles={profiles} />}
              {activeTab === "error-logs" && isAdmin && <AdminErrorLogsTab profiles={profiles} />}
              {activeTab === "inactive-sellers" && isAdmin && (
                <AdminInactiveSellersTab profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} />
              )}
              {activeTab === "settings" && isAdmin && <AdminSettingsTab />}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
