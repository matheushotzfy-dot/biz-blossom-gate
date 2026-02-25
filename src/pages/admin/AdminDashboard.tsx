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
  Bug, UserX, Search, Command,
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

const EMPLOYEE_ALLOWED_TABS = new Set(["overview", "sellers", "products", "transactions"] as string[]);

const SIDEBAR_SECTIONS = [
  {
    title: "PRINCIPAL",
    items: [
      { id: "overview", label: "Visão Geral", icon: LayoutDashboard, employeeAccess: true },
      { id: "transactions", label: "Transações", icon: CreditCard, employeeAccess: true },
      { id: "withdrawals", label: "Saques", icon: ArrowDownToLine, employeeAccess: false },
    ],
  },
  {
    title: "VENDEDORES",
    items: [
      { id: "sellers", label: "Vendedores", icon: Users, employeeAccess: true },
      { id: "top-sellers", label: "Top Sellers", icon: Zap, employeeAccess: false },
      { id: "inactive-sellers", label: "Inativos", icon: UserX, employeeAccess: false },
    ],
  },
  {
    title: "PRODUTOS",
    items: [
      { id: "products", label: "Produtos", icon: Package, employeeAccess: true },
      { id: "top-products", label: "Top Produtos", icon: Package, employeeAccess: false },
      { id: "courses", label: "Cursos", icon: GraduationCap, employeeAccess: false },
      { id: "coupons", label: "Cupons", icon: Tag, employeeAccess: false },
    ],
  },
  {
    title: "DISPUTAS",
    items: [
      { id: "medpix", label: "MedPix", icon: AlertTriangle, employeeAccess: false },
      { id: "refunds", label: "Reembolsos", icon: RotateCcw, employeeAccess: false },
      { id: "premed", label: "Pre-Med PIX", icon: ShieldAlert, employeeAccess: false },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { id: "acquirers", label: "Adquirentes", icon: CreditCard, employeeAccess: false },
      { id: "employees", label: "Funcionários", icon: UserCog, employeeAccess: false },
      { id: "error-logs", label: "Log de Erros", icon: Bug, employeeAccess: false },
      { id: "audit", label: "Auditoria", icon: Activity, employeeAccess: false },
      { id: "settings", label: "Configurações", icon: Settings, employeeAccess: false },
    ],
  },
] as const;

type TabId = "overview" | "transactions" | "sellers" | "products" | "top-sellers" | "top-products" | "withdrawals" | "acquirers" | "medpix" | "refunds" | "premed" | "employees" | "coupons" | "courses" | "audit" | "settings" | "error-logs" | "inactive-sellers";

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

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "employee"])
      .then(({ data }) => {
        if (!data || data.length === 0) { navigate("/admin-matheus"); return; }
        const roles = data.map(r => r.role);
        if (roles.includes("admin")) setIsAdmin(true);
        else if (roles.includes("employee")) setIsEmployee(true);
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/30 animate-pulse">
          <Shield className="h-7 w-7 text-primary-foreground" />
        </div>
        <p className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground">Carregando painel...</p>
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
    <div className="min-h-screen bg-background text-foreground flex">
      {/* ═══ SIDEBAR ═══ */}
      <aside className={cn(
        "fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 border-r border-border bg-card overflow-hidden",
        sidebarCollapsed ? "w-[68px]" : "w-[260px]"
      )}>
        {/* Logo */}
        <div className={cn(
          "h-16 flex items-center border-b border-border shrink-0",
          sidebarCollapsed ? "px-3 justify-center" : "px-5"
        )}>
          <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Rocket className="h-4 w-4 text-primary-foreground" />
          </div>
          {!sidebarCollapsed && (
            <div className="ml-3 overflow-hidden">
              <h1 className="text-lg font-display font-black tracking-tight text-foreground">HOTZFY</h1>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {isEmployee ? "Employee" : "Admin"}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          {SIDEBAR_SECTIONS.map((section) => {
            const visibleItems = isEmployee
              ? section.items.filter(i => i.employeeAccess)
              : section.items;
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                {!sidebarCollapsed && (
                  <p className="text-[9px] uppercase tracking-[0.2em] font-bold px-3 mb-1.5 text-muted-foreground/50">{section.title}</p>
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
                          "group relative w-full flex items-center gap-2.5 rounded-lg transition-all duration-150",
                          sidebarCollapsed ? "h-10 justify-center" : "h-9 px-3",
                          isActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!sidebarCollapsed && (
                          <span className="text-[13px] whitespace-nowrap flex-1 text-left truncate">{item.label}</span>
                        )}
                        {hasBadge && (
                          <span className={cn(
                            "h-4 min-w-[16px] px-1 rounded-full bg-destructive text-[9px] font-bold flex items-center justify-center text-destructive-foreground",
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
        <div className="border-t border-border p-2 shrink-0 space-y-0.5">
          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg h-9 transition-all text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              sidebarCollapsed ? "justify-center" : "px-3"
            )}
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4" />}
            {!sidebarCollapsed && <span className="text-[13px]">{theme === "dark" ? "Claro" : "Escuro"}</span>}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center h-8 rounded-lg text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground transition-all"
          >
            {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg h-9 transition-all text-destructive/60 hover:text-destructive hover:bg-destructive/[0.06]",
              sidebarCollapsed ? "justify-center" : "px-3"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span className="text-[13px]">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main className={cn("flex-1 transition-all duration-300 min-h-screen", sidebarCollapsed ? "ml-[68px]" : "ml-[260px]")}>
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/80 backdrop-blur-sm sticky top-0 z-20">
          <h2 className="text-sm font-bold text-foreground">{activeTabLabel}</h2>

          <div className="flex items-center gap-2">
            {isEmployee && (
              <span className="text-[10px] font-bold text-warning bg-warning/10 border border-warning/20 rounded-full px-2.5 py-1 uppercase tracking-wider">Funcionário</span>
            )}

            <span className="hidden lg:block text-[11px] text-muted-foreground">{profiles.length} sellers</span>

            <button className="relative h-8 w-8 rounded-lg flex items-center justify-center border border-border bg-card hover:bg-muted/50 transition-all">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              {pendingWdCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-destructive rounded-full" />}
            </button>

            <button
              onClick={loadData}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border border-border bg-card hover:bg-muted/50 text-muted-foreground"
            >
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} /> Sync
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-5 lg:p-6">
          <div className="mx-auto max-w-[1800px]">
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
