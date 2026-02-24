import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield, Activity, Settings, LogOut, Zap,
  LayoutDashboard, Users, Package, AlertTriangle, RotateCcw, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { logAdminAction } from "@/lib/auditLog";
import AdminOverviewTab from "./tabs/AdminOverviewTab";
import AdminSellersTab from "./tabs/AdminSellersTab";
import AdminProductsTab from "./tabs/AdminProductsTab";
import AdminDisputesTab from "./tabs/AdminDisputesTab";

const TABS = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "sellers", label: "Vendedores", icon: Users },
  { id: "products", label: "Produtos", icon: Package },
  { id: "medpix", label: "MedPix", icon: AlertTriangle },
  { id: "refunds", label: "Reembolsos", icon: RotateCcw },
  { id: "premed", label: "Pre-Med PIX", icon: ShieldAlert },
] as const;

type TabId = typeof TABS[number]["id"];

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
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (txRes.data) setTransactions(txRes.data);
    if (pRes.data) setProfiles(pRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (wRes.data) setWithdrawals(wRes.data);
  };

  if (loading) return (
    <div className="min-h-screen bg-[hsl(228,20%,4%)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.3)] animate-pulse">
          <Shield className="h-6 w-6 text-white" />
        </div>
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

  return (
    <div className="min-h-screen bg-[hsl(228,20%,4%)] text-white">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-30%] left-[-10%] w-[800px] h-[800px] bg-red-500/[0.02] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[600px] h-[600px] bg-emerald-500/[0.02] rounded-full blur-[120px]" />
      </div>

      {/* Top nav */}
      <header className="h-16 border-b border-white/[0.04] flex items-center justify-between px-6 bg-[hsl(228,20%,4%)]/80 backdrop-blur-2xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.25)]">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight">Admin Master</h1>
            <p className="text-[10px] text-white/30 capitalize">{todayStr}</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <Link to="/admin-matheus/auditoria" className="text-[11px] text-white/40 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-all"><Activity className="h-3.5 w-3.5" /> Auditoria</Link>
          <Link to="/admin-matheus/configuracoes" className="text-[11px] text-white/40 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-all"><Settings className="h-3.5 w-3.5" /> Config</Link>
          <button onClick={handleLogout} className="text-[11px] text-white/30 hover:text-red-400 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-red-500/[0.06] transition-all ml-1"><LogOut className="h-3.5 w-3.5" /> Sair</button>
        </nav>
      </header>

      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-full px-3.5 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Online</span>
            </div>
            <span className="text-[10px] text-white/20">{transactions.length} transações • {profiles.length} vendedores</span>
          </div>
          <button onClick={loadData} className="text-[10px] text-white/30 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all"><Zap className="h-3 w-3" /> Atualizar</button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-white/[0.02] border border-white/[0.04] rounded-2xl p-1.5 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white/[0.08] text-white shadow-lg"
                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]"
              }`}>
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <AdminOverviewTab
            transactions={transactions} profiles={profiles} products={products}
            withdrawals={withdrawals} onWithdrawalAction={handleWithdrawalAction}
            onUserStatus={handleUserStatus} fmtCurrency={fmtCurrency}
          />
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
        {activeTab === "medpix" && (
          <AdminDisputesTab type="medpix" title="MedPix" profiles={profiles} fmtCurrency={fmtCurrency} />
        )}
        {activeTab === "refunds" && (
          <AdminDisputesTab type="refund" title="Reembolsos" profiles={profiles} fmtCurrency={fmtCurrency} />
        )}
        {activeTab === "premed" && (
          <AdminDisputesTab type="pre_med_pix" title="Pre-Med PIX" profiles={profiles} fmtCurrency={fmtCurrency} />
        )}
      </div>
    </div>
  );
}
