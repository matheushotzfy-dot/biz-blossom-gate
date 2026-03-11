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
  const { theme, toggleTheme } = useTheme();
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
    const [txRes, pRes, prodRes, wRes] = await Promise.all([
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("products").select("*").limit(500),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(300),
    ]);
    if (txRes.data) setTransactions(txRes.data);
    if (pRes.data) setProfiles(pRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (wRes.data) setWithdrawals(wRes.data);
    setSyncing(false);
  };

  const handleDatePreset = (days: number) => {
    const to = new Date();
    const from = days === 0 ? startOfDay(to) : subDays(to, days);
    setDateRange({ from, to });
    setDatePreset(days === 0 ? "Hoje" : `${days}d`);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#050505", fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 animate-pulse">
          <Shield className="h-7 w-7 text-white" />
        </div>
        <p className="text-[11px] font-semibold tracking-[0.3em] uppercase text-white/30">Initializing God Mode...</p>
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
      const { error, count } = await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", id).eq("status", "pending");
      if (error) { toast.error("Erro ao recusar"); return; }
      if (count === 0) { toast.error("Saque já foi processado"); loadData(); return; }
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
  };

  // Visible nav items (first 8 for top bar, rest in "more")
  const visibleItems = isEmployee ? NAV_ITEMS.filter(i => i.employeeAccess) : [...NAV_ITEMS];
  const primaryNav = visibleItems.slice(0, 10);
  const overflowNav = visibleItems.slice(10);

  return (
    <div
      className="h-screen text-white flex flex-col overflow-hidden"
      style={{
        background: "#050505",
        fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif",
      }}
    >
      {/* ═══ Ambient Glow — indigo/violet ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-indigo-900/[0.06] rounded-full blur-[180px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-900/[0.04] rounded-full blur-[150px]" />
      </div>

      {/* ═══ TOP NAVIGATION BAR (Vercel-style) ═══ */}
      <header className="relative z-50 h-14 border-b border-white/[0.06] flex items-center px-4 lg:px-6 gap-3 shrink-0 backdrop-blur-2xl bg-[#050505]/90">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-4">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Rocket className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-extrabold tracking-tight">HOTZFY</h1>
            <p className="text-[7px] font-semibold uppercase tracking-[0.3em] text-white/20">
              {isEmployee ? "Employee" : "God Mode"}
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-white/[0.08] mr-1" />

        {/* Primary Navigation */}
        <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
          {primaryNav.map((item) => {
            const isActive = activeTab === item.id;
            const hasBadge = item.id === "withdrawals" && pendingWdCount > 0;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id as TabId)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "bg-white/[0.08] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                    : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]"
                )}
              >
                <item.icon className={cn("h-3 w-3", isActive && "text-indigo-400")} />
                <span className="hidden lg:inline">{item.label}</span>
                {hasBadge && (
                  <span className="h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-[8px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                    {pendingWdCount}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="admin-nav-indicator"
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
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
              <PopoverContent className="w-48 p-1.5 bg-[#0A0A10] border-white/[0.08] shadow-2xl shadow-black/60" align="start">
                {overflowNav.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id as TabId)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-all",
                      activeTab === item.id
                        ? "bg-indigo-500/10 text-indigo-400"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
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
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            {DATE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => handleDatePreset(p.days)}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
                  datePreset === (p.days === 0 ? "Hoje" : `${p.days}d`)
                    ? "bg-indigo-500/15 text-indigo-400 shadow-sm"
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
              <PopoverContent className="w-auto p-0 bg-[#0A0A10] border-white/[0.08]" align="end">
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

          <button className="relative h-7 w-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all">
            <Bell className="h-3 w-3 text-white/30" />
            {pendingWdCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.5)]" />}
          </button>

          <button
            onClick={loadData}
            disabled={syncing}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-all"
          >
            <RefreshCw className={cn("h-2.5 w-2.5", syncing && "animate-spin")} /> Sync
          </button>

          <button onClick={toggleTheme} className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all">
            {theme === "dark" ? <Sun className="h-3 w-3 text-amber-400" /> : <Moon className="h-3 w-3 text-white/30" />}
          </button>

          <button onClick={handleLogout} className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.06] hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all">
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 overflow-y-auto relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="p-4 lg:p-6"
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
