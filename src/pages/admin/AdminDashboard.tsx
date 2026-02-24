import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, Zap, LayoutDashboard, Users, Package, AlertTriangle,
  RotateCcw, ShieldAlert, CreditCard, ArrowDownToLine, Tag, GraduationCap,
  Activity, Settings, ChevronLeft, ChevronRight, Bell, Search,
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

const SIDEBAR_SECTIONS = [
  {
    title: "Principal",
    items: [
      { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
      { id: "transactions", label: "Transações", icon: CreditCard },
      { id: "sellers", label: "Vendedores", icon: Users },
      { id: "products", label: "Produtos", icon: Package },
      { id: "withdrawals", label: "Saques", icon: ArrowDownToLine },
    ],
  },
  {
    title: "Disputas",
    items: [
      { id: "medpix", label: "MedPix", icon: AlertTriangle },
      { id: "refunds", label: "Reembolsos", icon: RotateCcw },
      { id: "premed", label: "Pre-Med PIX", icon: ShieldAlert },
    ],
  },
  {
    title: "Plataforma",
    items: [
      { id: "coupons", label: "Cupons", icon: Tag },
      { id: "courses", label: "Cursos", icon: GraduationCap },
      { id: "audit", label: "Auditoria", icon: Activity },
      { id: "settings", label: "Configurações", icon: Settings },
    ],
  },
] as const;

type TabId = "overview" | "transactions" | "sellers" | "products" | "withdrawals" | "medpix" | "refunds" | "premed" | "coupons" | "courses" | "audit" | "settings";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [withdrawals, setWithdrawals] = useState<Tables<"withdrawals">[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => {
        if (!data) { navigate("/admin-matheus"); return; }
        setIsAdmin(true);
        setLoading(false);
        loadData();
      });
  }, [user]);

  const loadData = async () => {
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
  };

  if (loading) return (
    <div className="min-h-screen bg-[hsl(228,20%,4%)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_60px_rgba(239,68,68,0.3)] animate-pulse">
          <Shield className="h-7 w-7 text-white" />
        </div>
        <p className="text-[11px] text-white/20 font-medium tracking-wider uppercase">Carregando painel...</p>
      </div>
    </div>
  );

  const handleWithdrawalAction = async (id: string, action: "approved" | "rejected") => {
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

  return (
    <div className="min-h-screen bg-[hsl(228,20%,4%)] text-white flex">
      {/* ═══════════════ SIDEBAR ═══════════════ */}
      <aside className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out border-r border-white/[0.04] bg-[hsl(228,20%,5%)]/95 backdrop-blur-2xl ${sidebarCollapsed ? "w-[68px]" : "w-[240px]"}`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/[0.04] shrink-0">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.25)] shrink-0">
            <Shield className="h-5 w-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="ml-3 overflow-hidden">
              <h1 className="text-sm font-extrabold tracking-tight whitespace-nowrap">Admin Master</h1>
              <p className="text-[9px] text-white/20 whitespace-nowrap">Enterprise Dashboard</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.title}>
              {!sidebarCollapsed && (
                <p className="text-[9px] uppercase tracking-[0.15em] text-white/15 font-bold px-2.5 mb-2">{section.title}</p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const hasBadge = item.id === "withdrawals" && pendingWdCount > 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as TabId)}
                      className={`w-full flex items-center gap-3 rounded-xl transition-all duration-200 group relative ${
                        sidebarCollapsed ? "h-10 justify-center px-0" : "h-10 px-3"
                      } ${
                        isActive
                          ? "bg-white/[0.08] text-white shadow-lg shadow-white/[0.02]"
                          : "text-white/35 hover:text-white/70 hover:bg-white/[0.03]"
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-red-500 to-rose-600 rounded-r-full" />
                      )}
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-red-400" : ""}`} />
                      {!sidebarCollapsed && (
                        <span className="text-[12px] font-semibold whitespace-nowrap flex-1 text-left">{item.label}</span>
                      )}
                      {hasBadge && (
                        <span className={`${sidebarCollapsed ? "absolute -top-0.5 -right-0.5" : ""} h-4 min-w-[16px] px-1 rounded-full bg-red-500/90 text-[9px] font-bold flex items-center justify-center text-white`}>
                          {pendingWdCount}
                        </span>
                      )}
                      {/* Tooltip for collapsed */}
                      {sidebarCollapsed && (
                        <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[hsl(228,18%,10%)] border border-white/[0.08] rounded-lg text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-xl">
                          {item.label}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-white/[0.04] p-2.5 shrink-0">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center h-9 rounded-xl text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* User / Logout */}
        <div className="border-t border-white/[0.04] p-2.5 shrink-0">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 rounded-xl h-10 text-white/25 hover:text-red-400 hover:bg-red-500/[0.06] transition-all ${sidebarCollapsed ? "justify-center px-0" : "px-3"}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span className="text-[11px] font-semibold">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "ml-[68px]" : "ml-[240px]"}`}>
        {/* Top Header Bar */}
        <header className="h-14 border-b border-white/[0.04] flex items-center justify-between px-6 bg-[hsl(228,20%,4%)]/80 backdrop-blur-2xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-sm font-bold tracking-tight">{activeTabLabel}</h2>
              <p className="text-[10px] text-white/20 capitalize">{todayStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Status indicators */}
            <div className="flex items-center gap-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-full px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-wider">Sistema Online</span>
            </div>
            <span className="text-[10px] text-white/15">{transactions.length} tx • {profiles.length} sellers</span>
            <button onClick={loadData} className="text-[10px] text-white/25 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all">
              <Zap className="h-3 w-3" /> Sync
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          {activeTab === "overview" && (
            <AdminOverviewTab
              transactions={transactions} profiles={profiles} products={products}
              withdrawals={withdrawals} onWithdrawalAction={handleWithdrawalAction}
              onUserStatus={handleUserStatus} fmtCurrency={fmtCurrency}
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
            <AdminProductsTab products={products} profiles={profiles} fmtCurrency={fmtCurrency} />
          )}
          {activeTab === "withdrawals" && (
            <AdminWithdrawalsTab withdrawals={withdrawals} profiles={profiles} onWithdrawalAction={handleWithdrawalAction} fmtCurrency={fmtCurrency} />
          )}
          {activeTab === "medpix" && (
            <AdminDisputesTab type="medpix" title="MedPix" profiles={profiles} fmtCurrency={fmtCurrency} />
          )}
          {activeTab === "refunds" && (
            <AdminDisputesTab type="refund" title="Reembolsos" profiles={profiles} fmtCurrency={fmtCurrency} />
          )}
          {activeTab === "premed" && (
            <AdminDisputesTab type="pre_med_pix" title="Pre-Med PIX" profiles={profiles} fmtCurrency={fmtCurrency} />
          )}
          {activeTab === "coupons" && (
            <AdminCouponsTab profiles={profiles} fmtCurrency={fmtCurrency} />
          )}
          {activeTab === "courses" && (
            <AdminCoursesTab profiles={profiles} products={products} />
          )}
          {activeTab === "audit" && (
            <AdminAuditTab />
          )}
          {activeTab === "settings" && (
            <AdminSettingsTab />
          )}
        </div>
      </main>
    </div>
  );
}
