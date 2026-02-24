import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, Zap, LayoutDashboard, Users, Package, AlertTriangle,
  RotateCcw, ShieldAlert, CreditCard, ArrowDownToLine, Tag, GraduationCap,
  Activity, Settings, ChevronLeft, ChevronRight, Bell, Search,
  Moon, Sun, UserCog, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { logAdminAction } from "@/lib/auditLog";
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

// Tabs accessible by employees (restricted)
const EMPLOYEE_ALLOWED_TABS = new Set(["overview", "sellers", "products", "transactions"]);

const SIDEBAR_SECTIONS = [
  {
    title: "Principal",
    items: [
      { id: "overview", label: "Dashboard", icon: LayoutDashboard, employeeAccess: true },
      { id: "transactions", label: "Transações", icon: CreditCard, employeeAccess: true },
      { id: "sellers", label: "Vendedores", icon: Users, employeeAccess: true },
      { id: "products", label: "Produtos", icon: Package, employeeAccess: true },
      { id: "withdrawals", label: "Saques", icon: ArrowDownToLine, employeeAccess: false },
    ],
  },
  {
    title: "Pagamentos",
    items: [
      { id: "acquirers", label: "Adquirentes", icon: CreditCard, employeeAccess: false },
    ],
  },
  {
    title: "Disputas",
    items: [
      { id: "medpix", label: "MedPix", icon: AlertTriangle, employeeAccess: false },
      { id: "refunds", label: "Reembolsos", icon: RotateCcw, employeeAccess: false },
      { id: "premed", label: "Pre-Med PIX", icon: ShieldAlert, employeeAccess: false },
    ],
  },
  {
    title: "Plataforma",
    items: [
      { id: "employees", label: "Funcionários", icon: UserCog, employeeAccess: false },
      { id: "coupons", label: "Cupons", icon: Tag, employeeAccess: false },
      { id: "courses", label: "Cursos", icon: GraduationCap, employeeAccess: false },
      { id: "audit", label: "Auditoria", icon: Activity, employeeAccess: false },
      { id: "settings", label: "Configurações", icon: Settings, employeeAccess: false },
    ],
  },
] as const;

type TabId = "overview" | "transactions" | "sellers" | "products" | "withdrawals" | "acquirers" | "medpix" | "refunds" | "premed" | "employees" | "coupons" | "courses" | "audit" | "settings";

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
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const isDark = theme === "dark";

  useEffect(() => {
    if (!user) return;
    // Check role
    supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "employee"])
      .then(({ data }) => {
        if (!data || data.length === 0) { navigate("/admin-matheus"); return; }
        const roles = data.map(r => r.role);
        if (roles.includes("admin")) {
          setIsAdmin(true);
        } else if (roles.includes("employee")) {
          setIsEmployee(true);
        }
        setLoading(false);
        loadData();
      });
  }, [user]);

  const loadData = async () => {
    setSyncing(true);
    const [txRes, pRes, prodRes, wRes] = await Promise.all([
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*"),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (txRes.data) setTransactions(txRes.data);
    if (pRes.data) setProfiles(pRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (wRes.data) setWithdrawals(wRes.data);
    setSyncing(false);
  };

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[hsl(222,20%,4%)]" : "bg-[hsl(220,20%,97%)]"}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-[18px] bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-[0_0_60px_rgba(59,130,246,0.3)] animate-pulse">
          <Shield className="h-7 w-7 text-white" />
        </div>
        <p className={`text-[11px] font-medium tracking-wider uppercase ${isDark ? "text-white/20" : "text-slate-400"}`}>Carregando painel...</p>
      </div>
    </div>
  );

  const handleWithdrawalAction = async (id: string, action: "approved" | "rejected") => {
    if (!isAdmin) { toast.error("Sem permissão"); return; }
    if (action === "approved") {
      toast.info("Processando saque via PIX...");
      const { data, error } = await supabase.functions.invoke("podpay-cashout", { body: { withdrawalId: id } });
      if (error || !data?.success) { toast.error(data?.error || error?.message || "Erro ao processar"); return; }
      toast.success("Saque aprovado e enviado!");
      await logAdminAction("approve_withdrawal", "withdrawal", id, { method: "podpay_pix" });
    } else {
      const { error } = await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", id);
      if (error) { toast.error("Erro ao recusar"); return; }
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
  const todayStr = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

  const pendingWdCount = withdrawals.filter(w => w.status === "pending").length;
  const activeTabLabel = SIDEBAR_SECTIONS.flatMap(s => [...s.items]).find((i: any) => i.id === activeTab)?.label || "";

  const handleTabChange = (tabId: TabId) => {
    if (isEmployee && !EMPLOYEE_ALLOWED_TABS.has(tabId)) {
      toast.error("Sem permissão para acessar esta área");
      return;
    }
    setActiveTab(tabId);
  };

  // Color tokens
  const bg = isDark ? "bg-[hsl(222,20%,4%)]" : "bg-[hsl(220,14%,96%)]";
  const sidebarBg = isDark ? "bg-[hsl(222,22%,5%)]/98 border-white/[0.04]" : "bg-white/95 border-slate-200/80";
  const headerBg = isDark ? "bg-[hsl(222,20%,4%)]/90 border-white/[0.04]" : "bg-white/90 border-slate-200/60";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-white/40" : "text-slate-500";
  const textMuted = isDark ? "text-white/20" : "text-slate-400";
  const hoverBg = isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-100";
  const activeBg = isDark ? "bg-white/[0.06]" : "bg-blue-50";
  const activeText = isDark ? "text-white" : "text-blue-700";

  return (
    <div className={`min-h-screen ${bg} ${textPrimary} flex`}>
      {/* ═══════════════ SIDEBAR ═══════════════ */}
      <aside className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out border-r backdrop-blur-2xl ${sidebarBg} ${sidebarCollapsed ? "w-[72px]" : "w-[260px]"}`}>
        {/* Logo */}
        <div className={`h-[72px] flex items-center px-5 border-b shrink-0 ${isDark ? "border-white/[0.04]" : "border-slate-200/60"}`}>
          <div className="h-11 w-11 rounded-[14px] bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-[0_8px_30px_rgba(59,130,246,0.25)] shrink-0">
            <Shield className="h-5.5 w-5.5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="ml-3.5 overflow-hidden">
              <h1 className="text-[14px] font-extrabold tracking-tight whitespace-nowrap">PayGate</h1>
              <p className={`text-[10px] whitespace-nowrap ${textMuted}`}>
                {isEmployee ? "Employee Panel" : "Admin Console"}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          {SIDEBAR_SECTIONS.map((section) => {
            const visibleItems = isEmployee
              ? section.items.filter(i => i.employeeAccess)
              : section.items;
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                {!sidebarCollapsed && (
                  <p className={`text-[10px] uppercase tracking-[0.14em] font-bold px-3 mb-2.5 ${textMuted}`}>{section.title}</p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const hasBadge = item.id === "withdrawals" && pendingWdCount > 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id as TabId)}
                        className={`w-full flex items-center gap-3 rounded-xl transition-all duration-200 group relative ${
                          sidebarCollapsed ? "h-11 justify-center px-0" : "h-11 px-3"
                        } ${
                          isActive
                            ? `${activeBg} ${activeText} font-semibold`
                            : `${textSecondary} ${hoverBg}`
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full" />
                        )}
                        <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-blue-500" : ""}`} />
                        {!sidebarCollapsed && (
                          <span className="text-[13px] whitespace-nowrap flex-1 text-left">{item.label}</span>
                        )}
                        {hasBadge && (
                          <span className={`${sidebarCollapsed ? "absolute -top-0.5 -right-0.5" : ""} h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center text-white`}>
                            {pendingWdCount}
                          </span>
                        )}
                        {sidebarCollapsed && (
                          <div className={`absolute left-full ml-2.5 px-3 py-2 ${isDark ? "bg-[hsl(222,22%,10%)] border-white/[0.08]" : "bg-white border-slate-200"} border rounded-xl text-[12px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-xl`}>
                            {item.label}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className={`border-t p-3 shrink-0 space-y-1 ${isDark ? "border-white/[0.04]" : "border-slate-200/60"}`}>
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-2.5 rounded-xl h-10 transition-all ${sidebarCollapsed ? "justify-center px-0" : "px-3"} ${textSecondary} ${hoverBg}`}
          >
            {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            {!sidebarCollapsed && <span className="text-[12px] font-medium">{isDark ? "Modo Claro" : "Modo Escuro"}</span>}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center justify-center h-9 rounded-xl transition-all ${textMuted} ${hoverBg}`}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 rounded-xl h-10 transition-all ${sidebarCollapsed ? "justify-center px-0" : "px-3"} text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06]`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span className="text-[12px] font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "ml-[72px]" : "ml-[260px]"}`}>
        {/* Top Header Bar */}
        <header className={`h-[64px] border-b flex items-center justify-between px-7 backdrop-blur-2xl sticky top-0 z-40 ${headerBg}`}>
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight">{activeTabLabel}</h2>
              <p className={`text-[11px] capitalize ${textMuted}`}>{todayStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isEmployee && (
              <div className={`flex items-center gap-2 ${isDark ? "bg-amber-500/[0.08] border-amber-500/20" : "bg-amber-50 border-amber-200"} border rounded-full px-3.5 py-1.5`}>
                <UserCog className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Funcionário</span>
              </div>
            )}
            <div className={`flex items-center gap-2 ${isDark ? "bg-emerald-500/[0.06] border-emerald-500/15" : "bg-emerald-50 border-emerald-200"} border rounded-full px-3.5 py-1.5`}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Online</span>
            </div>
            <span className={`text-[11px] ${textMuted}`}>{transactions.length} tx • {profiles.length} sellers</span>
            <button
              onClick={loadData}
              disabled={syncing}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-all ${isDark ? "text-white/30 hover:text-white hover:bg-white/[0.04]" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"}`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-7">
          {activeTab === "overview" && (
            <AdminOverviewTab
              transactions={transactions} profiles={profiles} products={products}
              withdrawals={withdrawals} onWithdrawalAction={handleWithdrawalAction}
              onUserStatus={handleUserStatus} fmtCurrency={fmtCurrency}
              isEmployee={isEmployee}
            />
          )}
          {activeTab === "transactions" && (
            <AdminTransactionsTab transactions={transactions} profiles={profiles} products={products} fmtCurrency={fmtCurrency} />
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
          {activeTab === "withdrawals" && isAdmin && (
            <AdminWithdrawalsTab withdrawals={withdrawals} profiles={profiles} onWithdrawalAction={handleWithdrawalAction} fmtCurrency={fmtCurrency} />
          )}
          {activeTab === "acquirers" && isAdmin && (
            <AdminAcquirersTab />
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
            <AdminAuditTab />
          )}
          {activeTab === "settings" && isAdmin && (
            <AdminSettingsTab />
          )}
        </div>
      </main>
    </div>
  );
}
