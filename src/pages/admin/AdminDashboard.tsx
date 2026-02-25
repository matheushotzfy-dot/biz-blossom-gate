import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, Zap, LayoutDashboard, Users, Package, AlertTriangle,
  RotateCcw, ShieldAlert, CreditCard, ArrowDownToLine, Tag, GraduationCap,
  Activity, Settings, ChevronLeft, ChevronRight, Bell,
  Moon, Sun, UserCog, RefreshCw, Rocket, Sparkles, Search, Command,
  Bug, UserX,
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
    title: "COMANDO",
    items: [
      { id: "overview", label: "Dashboard", icon: LayoutDashboard, employeeAccess: true },
      { id: "transactions", label: "Transações", icon: CreditCard, employeeAccess: true },
      { id: "sellers", label: "Vendedores", icon: Users, employeeAccess: true },
      { id: "products", label: "Produtos", icon: Package, employeeAccess: true },
      { id: "top-sellers", label: "Top Sellers", icon: Zap, employeeAccess: false },
      { id: "top-products", label: "Top Produtos", icon: Package, employeeAccess: false },
      { id: "withdrawals", label: "Saques", icon: ArrowDownToLine, employeeAccess: false },
    ],
  },
  {
    title: "PAGAMENTOS",
    items: [
      { id: "acquirers", label: "Adquirentes", icon: CreditCard, employeeAccess: false },
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
    title: "MONITORAMENTO",
    items: [
      { id: "error-logs", label: "Log de Erros", icon: Bug, employeeAccess: false },
      { id: "inactive-sellers", label: "Sellers Inativos", icon: UserX, employeeAccess: false },
      { id: "audit", label: "Auditoria", icon: Activity, employeeAccess: false },
    ],
  },
  {
    title: "PLATAFORMA",
    items: [
      { id: "employees", label: "Funcionários", icon: UserCog, employeeAccess: false },
      { id: "coupons", label: "Cupons", icon: Tag, employeeAccess: false },
      { id: "courses", label: "Cursos", icon: GraduationCap, employeeAccess: false },
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

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* ═══════════════ SIDEBAR ═══════════════ */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out border-r border-sidebar-border bg-sidebar/95 backdrop-blur-2xl overflow-hidden",
          sidebarCollapsed ? "w-[76px]" : "w-[300px]"
        )}
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-28 -left-20 h-80 w-80 rounded-full bg-primary/12 blur-[90px]" />
          <div className="absolute bottom-6 -right-10 h-64 w-64 rounded-full bg-primary/10 blur-[84px]" />
        </div>

        {/* Logo */}
        <div className={cn(
          "relative h-[88px] flex items-center border-b border-sidebar-border shrink-0",
          sidebarCollapsed ? "px-3 justify-center" : "px-5"
        )}>
          <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25 ring-1 ring-primary/30 shrink-0">
            <Rocket className="h-5.5 w-5.5 text-primary-foreground" />
          </div>
          {!sidebarCollapsed && (
            <div className="ml-3.5 overflow-hidden">
              <h1 className="text-2xl font-display font-black tracking-tight text-sidebar-accent-foreground">HOTZFY</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sidebar-foreground mt-0.5">
                {isEmployee ? "Employee Panel" : "Admin Console"}
              </p>
            </div>
          )}
        </div>

        {/* Status badges */}
        {!sidebarCollapsed && (
          <div className="relative px-4 pt-4 pb-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/55 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/70">Plano</span>
                  <span className="text-[11px] font-black text-primary">Enterprise</span>
                </div>
              </div>
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/55 px-3 py-2.5 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-bold text-sidebar-accent-foreground">Online</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="relative flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
          {SIDEBAR_SECTIONS.map((section) => {
            const visibleItems = isEmployee
              ? section.items.filter(i => i.employeeAccess)
              : section.items;
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                {!sidebarCollapsed && (
                  <p className="text-[10px] uppercase tracking-[0.22em] font-bold px-3.5 mb-2.5 text-sidebar-foreground/60">{section.title}</p>
                )}
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const hasBadge = item.id === "withdrawals" && pendingWdCount > 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id as TabId)}
                        className={cn(
                          "group/nav relative w-full flex items-center gap-3 rounded-2xl border transition-all duration-200",
                          sidebarCollapsed ? "h-12 justify-center px-0 border-transparent" : "h-[52px] px-3.5",
                          isActive
                            ? "border-primary/30 bg-sidebar-accent text-sidebar-accent-foreground shadow-lg shadow-primary/10"
                            : "border-transparent text-sidebar-foreground hover:border-sidebar-border hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        {isActive && !sidebarCollapsed && (
                          <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                        )}

                        <span className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "bg-sidebar-accent/45 text-sidebar-foreground group-hover/nav:bg-sidebar-accent group-hover/nav:text-sidebar-accent-foreground"
                        )}>
                          <item.icon className="h-[18px] w-[18px]" />
                        </span>

                        {!sidebarCollapsed && (
                          <span className="text-[14px] font-semibold whitespace-nowrap flex-1 text-left truncate">{item.label}</span>
                        )}

                        {hasBadge && (
                          <span className={cn(
                            "h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center text-destructive-foreground",
                            sidebarCollapsed && "absolute -top-0.5 -right-0.5"
                          )}>
                            {pendingWdCount}
                          </span>
                        )}

                        {isActive && !sidebarCollapsed && (
                          <ChevronRight className="h-4 w-4 text-primary/65" />
                        )}

                        {sidebarCollapsed && (
                          <div className="absolute left-full ml-2.5 px-3 py-2 bg-popover border border-border rounded-xl text-[12px] font-semibold whitespace-nowrap opacity-0 group-hover/nav:opacity-100 pointer-events-none transition-opacity z-[60] shadow-xl">
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
        <div className="relative border-t border-sidebar-border p-3 shrink-0 space-y-1">
          {!sidebarCollapsed && (
            <div className="mb-2 rounded-2xl border border-primary/20 bg-primary/[0.08] p-3.5">
              <div className="mb-1 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-[12px] font-black text-sidebar-accent-foreground">Controle Total</span>
              </div>
              <p className="text-[11px] leading-relaxed text-sidebar-foreground/90">
                Gerencie vendedores, transações e saques em tempo real.
              </p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3 w-3" /> Master Admin
              </div>
            </div>
          )}

          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-xl h-10 transition-all text-sidebar-foreground hover:bg-sidebar-accent/65",
              sidebarCollapsed ? "justify-center px-0" : "px-3"
            )}
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4" />}
            {!sidebarCollapsed && <span className="text-[13px] font-medium">{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>}
          </button>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center h-9 rounded-xl transition-all text-sidebar-foreground/60 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-xl h-10 transition-all text-destructive/70 hover:text-destructive hover:bg-destructive/[0.08]",
              sidebarCollapsed ? "justify-center px-0" : "px-3"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span className="text-[13px] font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <main className={cn("flex-1 transition-all duration-300 min-h-screen", sidebarCollapsed ? "ml-[76px]" : "ml-[300px]")}>
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-info/8 blur-[130px]" />
        </div>

        {/* Top Header Bar */}
        <header className="relative z-20 h-[72px] border-b border-border/80 flex items-center justify-between px-6 lg:px-8 bg-background/86 backdrop-blur-xl sticky top-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-[16px] font-display font-bold tracking-tight text-foreground">{activeTabLabel}</h2>
              <p className="text-[11px] capitalize text-muted-foreground">{todayStr}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden lg:flex h-10 w-full max-w-[400px] items-center gap-2.5 rounded-xl border border-border/75 bg-muted/35 px-3.5 text-muted-foreground transition-colors hover:border-primary/25 hover:bg-muted/55">
              <Search className="h-4 w-4" />
              <span className="flex-1 text-[13px]">Buscar…</span>
              <div className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Command className="h-3 w-3" /> K
              </div>
            </div>

            {isEmployee && (
              <div className="flex items-center gap-2 border border-warning/20 bg-warning/10 rounded-full px-3.5 py-1.5">
                <UserCog className="h-3 w-3 text-warning" />
                <span className="text-[10px] font-bold text-warning uppercase tracking-wider">Funcionário</span>
              </div>
            )}

            <div className="flex items-center gap-2 border border-primary/20 bg-primary/10 rounded-full px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Online</span>
            </div>

            <span className="text-[11px] text-muted-foreground hidden xl:block">{transactions.length} tx • {profiles.length} sellers</span>

            <button
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl flex items-center justify-center border border-border/80 bg-card hover:bg-muted/60 hover:border-primary/20 transition-all"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>

            <button className="relative h-10 w-10 rounded-xl flex items-center justify-center border border-border/80 bg-card hover:bg-muted/60 hover:border-primary/20 transition-all">
              <Bell className="h-4 w-4 text-muted-foreground" />
              {pendingWdCount > 0 && <span className="absolute top-2 right-2 h-2 w-2 bg-destructive rounded-full ring-2 ring-card" />}
            </button>

            <button
              onClick={loadData}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12px] font-semibold transition-all border border-border/80 bg-card hover:bg-muted/60 hover:border-primary/20 text-muted-foreground"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} /> Sync
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="relative z-10 p-6 lg:p-8">
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
