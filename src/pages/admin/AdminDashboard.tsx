import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, Zap, LayoutDashboard, Users, Package, AlertTriangle,
  RotateCcw, ShieldAlert, CreditCard, ArrowDownToLine, Tag, GraduationCap,
  Activity, Settings, ChevronLeft, ChevronRight, Bell,
  Moon, Sun, UserCog, RefreshCw, Rocket,
  Bug, UserX, Search, Command, Banknote, Eye, ShieldCheck,
  FileWarning, Package2, Radio, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { logAdminAction } from "@/lib/auditLog";
import { cn } from "@/lib/utils";
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

const EMPLOYEE_ALLOWED_TABS = new Set(["god-mode", "sellers", "products", "transactions"] as string[]);

const SIDEBAR_SECTIONS = [
  {
    title: "GOD MODE",
    items: [
      { id: "god-mode", label: "Dashboard", icon: LayoutDashboard, employeeAccess: true },
      { id: "analytics", label: "Analytics", icon: BarChart3, employeeAccess: false },
    ],
  },
  {
    title: "SELLERS",
    items: [
      { id: "sellers", label: "Gestão de Sellers", icon: Users, employeeAccess: true },
      { id: "top-sellers", label: "Top Sellers", icon: Zap, employeeAccess: false },
      { id: "inactive-sellers", label: "Inativos", icon: UserX, employeeAccess: false },
      { id: "employees", label: "Funcionários", icon: UserCog, employeeAccess: false },
    ],
  },
  {
    title: "TESOURARIA",
    items: [
      { id: "withdrawals", label: "Fila de Saques", icon: ArrowDownToLine, employeeAccess: false },
      { id: "transactions", label: "Transações", icon: CreditCard, employeeAccess: true },
    ],
  },
  {
    title: "RISCO",
    items: [
      { id: "risk-compliance", label: "Anti-Fraude", icon: ShieldCheck, employeeAccess: false },
      { id: "medpix", label: "MedPix", icon: AlertTriangle, employeeAccess: false },
      { id: "refunds", label: "Reembolsos", icon: RotateCcw, employeeAccess: false },
      { id: "premed", label: "Pre-Med PIX", icon: ShieldAlert, employeeAccess: false },
    ],
  },
  {
    title: "PRODUTOS",
    items: [
      { id: "products", label: "Moderação", icon: Package, employeeAccess: true },
      { id: "top-products", label: "Top Produtos", icon: Package2, employeeAccess: false },
      { id: "courses", label: "Cursos", icon: GraduationCap, employeeAccess: false },
      { id: "coupons", label: "Cupons", icon: Tag, employeeAccess: false },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { id: "acquirers", label: "Adquirentes", icon: Banknote, employeeAccess: false },
      { id: "settings", label: "Config Global", icon: Settings, employeeAccess: false },
      { id: "error-logs", label: "Log de Erros", icon: Bug, employeeAccess: false },
      { id: "audit", label: "Audit Trail", icon: Activity, employeeAccess: false },
    ],
  },
] as const;

type TabId = "god-mode" | "analytics" | "transactions" | "sellers" | "products" | "top-sellers" | "top-products" | "withdrawals" | "acquirers" | "medpix" | "refunds" | "premed" | "employees" | "coupons" | "courses" | "audit" | "settings" | "error-logs" | "inactive-sellers" | "risk-compliance";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 animate-pulse">
          <Shield className="h-7 w-7 text-primary-foreground" />
        </div>
        <p className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground">Carregando God Mode...</p>
      </div>
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
  const activeTabLabel = SIDEBAR_SECTIONS.flatMap(s => [...s.items]).find((i: any) => i.id === activeTab)?.label || "";

  const handleTabChange = (tabId: TabId) => {
    if (isEmployee && !EMPLOYEE_ALLOWED_TABS.has(tabId)) {
      toast.error("Sem permissão para acessar esta área");
      return;
    }
    setActiveTab(tabId);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-foreground flex">
      {/* ═══ Subtle ambient glow ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[150px]" />
      </div>

      {/* ═══ SIDEBAR ═══ */}
      <aside className={cn(
        "fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 border-r border-zinc-800/80 bg-[#0E0E10] overflow-hidden",
        sidebarCollapsed ? "w-[60px]" : "w-[220px]"
      )}>
        {/* Logo */}
        <div className={cn(
          "h-14 flex items-center border-b border-zinc-800/80 shrink-0",
          sidebarCollapsed ? "px-3 justify-center" : "px-4"
        )}>
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
            <Rocket className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          {!sidebarCollapsed && (
            <div className="ml-2.5 overflow-hidden">
              <h1 className="text-sm font-display font-black tracking-tight text-white">HOTZFY</h1>
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                {isEmployee ? "Employee" : "God Mode"}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
          {SIDEBAR_SECTIONS.map((section) => {
            const visibleItems = isEmployee
              ? section.items.filter(i => i.employeeAccess)
              : section.items;
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                {!sidebarCollapsed && (
                  <p className="text-[9px] uppercase tracking-[0.25em] font-bold px-3 mb-2 text-white/20">{section.title}</p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const hasBadge = item.id === "withdrawals" && pendingWdCount > 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id as TabId)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={cn(
                          "group relative w-full flex items-center gap-2.5 rounded-lg transition-all duration-200",
                          sidebarCollapsed ? "h-9 justify-center" : "h-8 px-3",
                          isActive
                            ? "bg-zinc-800/50 text-white font-medium"
                            : "text-zinc-500 hover:bg-zinc-800/30 hover:text-zinc-300"
                        )}
                      >
                        {/* Active indicator - neon left bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
                        )}
                        <item.icon className={cn("h-3.5 w-3.5 shrink-0 transition-colors", isActive && "text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]")} />
                        {!sidebarCollapsed && (
                          <span className={cn("text-[12px] whitespace-nowrap flex-1 text-left truncate", isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
                        )}
                        {hasBadge && (
                          <span className={cn(
                            "h-4 min-w-[16px] px-1 rounded-full bg-destructive/80 text-[9px] font-bold flex items-center justify-center text-white",
                            sidebarCollapsed && "absolute -top-0.5 -right-0.5"
                          )}>
                            {pendingWdCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-zinc-800/80 p-2 shrink-0 space-y-0.5">
          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg h-8 transition-all text-zinc-500 hover:bg-zinc-800/30 hover:text-zinc-300",
              sidebarCollapsed ? "justify-center" : "px-3"
            )}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-warning" /> : <Moon className="h-3.5 w-3.5" />}
            {!sidebarCollapsed && <span className="text-[12px]">{theme === "dark" ? "Claro" : "Escuro"}</span>}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center h-7 rounded-lg text-white/20 hover:bg-white/[0.03] hover:text-white/50 transition-all"
          >
            {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg h-8 transition-all text-destructive/50 hover:text-destructive hover:bg-destructive/[0.06]",
              sidebarCollapsed ? "justify-center" : "px-3"
            )}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!sidebarCollapsed && <span className="text-[12px]">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className={cn("flex-1 transition-all duration-300 min-h-screen relative z-10", sidebarCollapsed ? "ml-[60px]" : "ml-[220px]")}>
        {/* Header */}
        <header className="h-12 border-b border-white/[0.06] flex items-center justify-between px-5 bg-[#0A0A0C]/60 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[13px] font-bold text-white/90">{activeTabLabel}</h2>
            {activeTab === "god-mode" && (
              <span className="text-[8px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 uppercase tracking-wider flex items-center gap-1">
                <Radio className="h-2 w-2 animate-pulse" /> Live
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEmployee && (
              <span className="text-[9px] font-bold text-warning bg-warning/10 border border-warning/20 rounded-full px-2 py-0.5 uppercase tracking-wider">Funcionário</span>
            )}

            <span className="hidden lg:block text-[10px] text-white/25 font-medium">{profiles.length} sellers</span>

            <button className="relative h-7 w-7 rounded-lg flex items-center justify-center border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-all">
              <Bell className="h-3 w-3 text-white/30" />
              {pendingWdCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-destructive rounded-full shadow-[0_0_6px_hsl(var(--destructive)/0.5)]" />}
            </button>

            <button
              onClick={loadData}
              disabled={syncing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] text-white/35 hover:text-white/60"
            >
              <RefreshCw className={cn("h-2.5 w-2.5", syncing && "animate-spin")} /> Sync
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-5 lg:p-6">
          <div className="mx-auto max-w-[1800px]">
            {activeTab === "god-mode" && (
              <AdminOverviewTab
                transactions={transactions} profiles={profiles} products={products}
                withdrawals={withdrawals} onWithdrawalAction={handleWithdrawalAction}
                onUserStatus={handleUserStatus} fmtCurrency={fmtCurrency}
                isEmployee={isEmployee}
              />
            )}
            {activeTab === "analytics" && isAdmin && (
              <AdminAnalyticsTab transactions={transactions} profiles={profiles} products={products} withdrawals={withdrawals} fmtCurrency={fmtCurrency} />
            )}
            {activeTab === "transactions" && (
              <AdminTransactionsTab transactions={transactions} profiles={profiles} products={products} fmtCurrency={fmtCurrency} onReload={loadData} />
            )}
            {activeTab === "sellers" && (
              <AdminSellersTab
                profiles={profiles} transactions={transactions} withdrawals={withdrawals}
                onReload={loadData} fmtCurrency={fmtCurrency}
              />
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
            {activeTab === "acquirers" && isAdmin && (
              <AdminAcquirersTab />
            )}
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
            {activeTab === "employees" && isAdmin && (
              <AdminEmployeesTab profiles={profiles} onReload={loadData} />
            )}
            {activeTab === "coupons" && isAdmin && (
              <AdminCouponsTab profiles={profiles} fmtCurrency={fmtCurrency} />
            )}
            {activeTab === "courses" && isAdmin && (
              <AdminCoursesTab profiles={profiles} products={products} />
            )}
            {activeTab === "audit" && isAdmin && (
              <AdminAuditTab profiles={profiles} />
            )}
            {activeTab === "error-logs" && isAdmin && (
              <AdminErrorLogsTab profiles={profiles} />
            )}
            {activeTab === "inactive-sellers" && isAdmin && (
              <AdminInactiveSellersTab profiles={profiles} transactions={transactions} fmtCurrency={fmtCurrency} />
            )}
            {activeTab === "settings" && isAdmin && (
              <AdminSettingsTab />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
