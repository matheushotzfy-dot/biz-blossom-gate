import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogOut, Zap, LayoutDashboard, Users, Package, AlertTriangle,
  RotateCcw, ShieldAlert, CreditCard, ArrowDownToLine, Tag, GraduationCap,
  Activity, Settings, Bell, MessageSquare,
  UserCog, RefreshCw, Rocket, Coins,
  Bug, UserX, Search, Banknote, ShieldCheck,

  FileWarning, Package2, Radio, BarChart3, Calendar,
  ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft,
  Flame, Sparkles, Crown, Globe, Palette, CheckCircle2, Trophy,
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
import { Button } from "@/components/ui/button";
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
import AdminStaffCommissionsTab from "./tabs/AdminStaffCommissionsTab";

import AdminNotificationsTab from "./tabs/AdminNotificationsTab";
import AdminAffiliateSalesTab from "./tabs/AdminAffiliateSalesTab";
import AdminSupportTab from "./tabs/AdminSupportTab";
import AdminSubscriptionsTab from "./tabs/AdminSubscriptionsTab";
import AdminReferralsTab from "./tabs/AdminReferralsTab";
import AdminRewardsTab from "./tabs/AdminRewardsTab";

const EMPLOYEE_ALLOWED_TABS = new Set(["god-mode", "sellers", "products", "transactions"] as string[]);

const NAV_SECTIONS: { id: string; label: string; items: { id: string; label: string; icon: any; employeeAccess: boolean }[] }[] = [
  {
    id: "core", label: "OPERACIONAL",
    items: [
      { id: "god-mode", label: "Dashboard", icon: LayoutDashboard, employeeAccess: true },
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
    id: "treasury", label: "FINANCEIRO",
    items: [
      { id: "withdrawals", label: "Saques", icon: ArrowDownToLine, employeeAccess: false },
      { id: "transactions", label: "Transações", icon: CreditCard, employeeAccess: true },
    ],
  },
  {
    id: "risk", label: "RISCO & COMPLIANCE",
    items: [
      { id: "risk-compliance", label: "Anti-Fraude", icon: ShieldCheck, employeeAccess: false },
      { id: "medpix", label: "MedPix", icon: AlertTriangle, employeeAccess: false },
      { id: "refunds", label: "Reembolsos", icon: RotateCcw, employeeAccess: false },
      { id: "premed", label: "Pre-Med", icon: ShieldAlert, employeeAccess: false },
    ],
  },
  {
    id: "content", label: "CONTEÚDO",
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
    id: "system", label: "SISTEMA",
    items: [
      { id: "acquirers", label: "Adquirentes", icon: Banknote, employeeAccess: false },
      { id: "settings", label: "Configurações", icon: Settings, employeeAccess: false },
      { id: "error-logs", label: "Error Logs", icon: Bug, employeeAccess: false },
      { id: "notifications", label: "Notificações", icon: Bell, employeeAccess: false },
      { id: "support", label: "Suporte", icon: MessageSquare, employeeAccess: false },
      { id: "rewards", label: "Premiações", icon: Trophy, employeeAccess: false },
      { id: "audit", label: "Auditoria", icon: Activity, employeeAccess: false },
    ],
  },
];

type TabId = string;
type AdminTheme = "dark-green" | "dark" | "midnight" | "mint";

const ADMIN_THEMES: Record<AdminTheme, {
  label: string; bg: string; sidebarBg: string; topBarBg: string;
  accent: string; accentLight: string; accentGlow: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  border: string; cardBg: string; isDark: boolean;
}> = {
  "mint": {
    label: "Verde Suave",
    bg: "linear-gradient(135deg, #0b1a14 0%, #0e1f18 30%, #111f1a 60%, #0b1a14 100%)",
    sidebarBg: "linear-gradient(180deg, rgba(11,26,20,0.98) 0%, rgba(8,20,15,0.99) 100%)",
    topBarBg: "linear-gradient(90deg, rgba(11,26,20,0.85) 0%, rgba(14,31,24,0.75) 100%)",
    accent: "emerald", accentLight: "rgba(52,211,153,0.12)", accentGlow: "rgba(52,211,153,0.35)",
    textPrimary: "rgba(255,255,255,0.95)", textSecondary: "rgba(255,255,255,0.60)", textMuted: "rgba(255,255,255,0.32)",
    border: "rgba(255,255,255,0.07)", cardBg: "rgba(52,211,153,0.04)", isDark: true,
  },
  "dark-green": {
    label: "Esmeralda Pro",
    bg: "linear-gradient(135deg, #040f08 0%, #061210 30%, #081a12 60%, #040f08 100%)",
    sidebarBg: "linear-gradient(180deg, rgba(6,18,12,0.98) 0%, rgba(4,15,8,0.99) 100%)",
    topBarBg: "linear-gradient(90deg, rgba(6,18,12,0.85) 0%, rgba(8,20,14,0.75) 100%)",
    accent: "emerald", accentLight: "rgba(16,185,129,0.15)", accentGlow: "rgba(16,185,129,0.4)",
    textPrimary: "rgba(255,255,255,0.93)", textSecondary: "rgba(255,255,255,0.58)", textMuted: "rgba(255,255,255,0.30)",
    border: "rgba(255,255,255,0.07)", cardBg: "rgba(16,185,129,0.04)", isDark: true,
  },
  "dark": {
    label: "Violeta Stealth",
    bg: "linear-gradient(135deg, #09090f 0%, #0d0d18 30%, #10101e 60%, #09090f 100%)",
    sidebarBg: "linear-gradient(180deg, rgba(9,9,18,0.98) 0%, rgba(7,7,14,0.99) 100%)",
    topBarBg: "linear-gradient(90deg, rgba(9,9,18,0.85) 0%, rgba(12,12,22,0.75) 100%)",
    accent: "violet", accentLight: "rgba(139,92,246,0.15)", accentGlow: "rgba(139,92,246,0.4)",
    textPrimary: "rgba(255,255,255,0.93)", textSecondary: "rgba(255,255,255,0.58)", textMuted: "rgba(255,255,255,0.30)",
    border: "rgba(255,255,255,0.07)", cardBg: "rgba(139,92,246,0.04)", isDark: true,
  },
  "midnight": {
    label: "Midnight Emerald",
    bg: "radial-gradient(ellipse at top, #0f2540 0%, #0a1628 35%, #060d1a 70%, #04081a 100%)",
    sidebarBg: "linear-gradient(180deg, rgba(10,22,40,0.98) 0%, rgba(6,13,26,0.99) 100%)",
    topBarBg: "linear-gradient(90deg, rgba(10,22,40,0.85) 0%, rgba(15,37,64,0.70) 100%)",
    accent: "emerald", accentLight: "rgba(16,185,129,0.14)", accentGlow: "rgba(16,185,129,0.45)",
    textPrimary: "rgba(255,255,255,0.95)", textSecondary: "rgba(255,255,255,0.62)", textMuted: "rgba(255,255,255,0.34)",
    border: "rgba(148,184,232,0.10)", cardBg: "rgba(16,185,129,0.05)", isDark: true,
  },
};

type DatePresetId = "today" | "yesterday" | "7d" | "14d" | "40d";

const DATE_PRESETS: { id: DatePresetId; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "14d", label: "14 dias" },
  { id: "40d", label: "40 dias" },
];

export default function AdminDashboard() {
  const { user } = useAuth();
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [datePreset, setDatePreset] = useState<DatePresetId | "custom">("today");
  const [calOpen, setCalOpen] = useState(false);
  const [adminTheme, setAdminTheme] = useState<AdminTheme>(() => {
    const saved = localStorage.getItem("admin-theme") as string;
    if (saved === "light-green") return "midnight";
    if (saved && saved in ADMIN_THEMES) return saved as AdminTheme;
    return "midnight";
  });
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const themeConfig = ADMIN_THEMES[adminTheme];

  const changeAdminTheme = (t: AdminTheme) => {
    setAdminTheme(t);
    localStorage.setItem("admin-theme", t);
    toast.success(`Tema "${ADMIN_THEMES[t].label}" aplicado!`);
  };

  const loadData = useCallback(async () => {
    setSyncing(true);
    try {
      const fromIso = dateRange.from.toISOString();
      const toIso = dateRange.to.toISOString();
      const { data, error } = await (supabase as any).rpc("get_admin_dashboard_data", {
        _from: fromIso,
        _to: toIso,
        _tx_limit: 2000,
        _profile_limit: 1000,
        _product_limit: 1000,
        _withdrawal_limit: 2000,
      });
      if (error) throw error;
      const payload = data ?? {};
      setTransactions((payload.transactions ?? []) as any);
      setProfiles((payload.profiles ?? []) as any);
      setProducts((payload.products ?? []) as any);
      setWithdrawals((payload.withdrawals ?? []) as any);
    } catch (e: any) {
      toast.error("Erro ao carregar dados: " + (e?.message ?? "desconhecido"));
    } finally {
      setSyncing(false);
    }
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [adminRes, employeeRes] = await Promise.all([
          supabase.rpc("current_user_has_role", { _role: "admin" }),
          supabase.rpc("current_user_has_role", { _role: "employee" as any }),
        ]);
        if (cancelled) return;
        const hasAdmin = adminRes.data === true;
        const hasEmployee = employeeRes.data === true;
        if (!hasAdmin && !hasEmployee) { navigate("/admin-matheus"); return; }
        if (cancelled) return;
        if (hasAdmin) setIsAdmin(true);
        else if (hasEmployee) setIsEmployee(true);
        if (cancelled) return;
        await loadData();
      } catch (e) {
        if (!cancelled) toast.error("Falha ao verificar permissões");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, navigate, loadData]);

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

  if (loading) return (
    <div className="dark min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #040f08 0%, #061210 30%, #081a12 60%, #040f08 100%)", fontFamily: "'Plus Jakarta Sans', 'Space Grotesk', system-ui, sans-serif" }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 flex items-center justify-center shadow-[0_0_80px_rgba(16,185,129,0.4)] ring-1 ring-white/10">
            <Shield className="h-9 w-9 text-white drop-shadow-lg" />
          </div>
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 blur-[40px] animate-pulse" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/10" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-[13px] font-extrabold tracking-[0.3em] uppercase text-white/30" style={{ fontFamily: "'Space Grotesk', monospace" }}>HOTZFY</p>
          <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-emerald-400/60">Control Center</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          ))}
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
  const activeTabLabel = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === activeTab)?.label || "";

  const handleTabChange = (tabId: TabId) => {
    if (isEmployee && !EMPLOYEE_ALLOWED_TABS.has(tabId)) {
      toast.error("Sem permissão para acessar esta área");
      return;
    }
    setActiveTab(tabId);
    const scrollable = document.querySelector("[data-admin-content]");
    if (scrollable) scrollable.scrollTop = 0;
    else window.scrollTo(0, 0);
  };

  const visibleSections = isEmployee
    ? NAV_SECTIONS.map(s => ({ ...s, items: s.items.filter(i => i.employeeAccess) })).filter(s => s.items.length > 0)
    : NAV_SECTIONS;

  const approvedTx = transactions.filter(t => t.status === "completed" || t.status === "approved");
  const totalRevenue = approvedTx.reduce((a, t) => a + Number(t.net_amount), 0);

  const accentClasses = adminTheme === "dark" ? {
    gradient: "from-violet-500 via-violet-600 to-purple-700",
    text: "text-violet-400", textSoft: "text-violet-400/60", textGlow: "text-violet-400/50",
    bg: "bg-violet-500", bgSoft: "bg-violet-500/10", bgBorder: "border-violet-500/10",
    shadow: "shadow-[0_0_30px_rgba(139,92,246,0.35)]", glowBg: "bg-violet-950/25",
    ringActive: "ring-violet-500/20", indicatorGradient: "from-violet-400 via-violet-500 to-purple-500",
    indicatorShadow: "shadow-[0_0_14px_rgba(139,92,246,0.8)]",
    activeItem: "from-violet-500/[0.12] via-violet-500/[0.08] to-purple-500/[0.04] border-violet-500/[0.18] shadow-[inset_0_1px_0_rgba(139,92,246,0.12)]",
    activeIcon: "text-violet-400 drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]",
  } : adminTheme === "midnight" ? {
    gradient: "from-emerald-400 via-emerald-500 to-teal-600",
    text: "text-emerald-400", textSoft: "text-emerald-400/65", textGlow: "text-emerald-400/55",
    bg: "bg-emerald-400", bgSoft: "bg-emerald-500/10", bgBorder: "border-emerald-500/15",
    shadow: "shadow-[0_0_36px_rgba(16,185,129,0.45)]", glowBg: "bg-emerald-500/15",
    ringActive: "ring-emerald-500/25", indicatorGradient: "from-emerald-400 via-emerald-500 to-teal-500",
    indicatorShadow: "shadow-[0_0_16px_rgba(16,185,129,0.85)]",
    activeItem: "from-emerald-500/[0.16] via-emerald-500/[0.10] to-teal-500/[0.05] border-emerald-500/[0.22] shadow-[inset_0_1px_0_rgba(16,185,129,0.18)]",
    activeIcon: "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]",
  } : adminTheme === "mint" ? {
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    text: "text-emerald-300", textSoft: "text-emerald-300/60", textGlow: "text-emerald-300/50",
    bg: "bg-emerald-300", bgSoft: "bg-emerald-400/10", bgBorder: "border-emerald-400/10",
    shadow: "shadow-[0_0_30px_rgba(52,211,153,0.3)]", glowBg: "bg-emerald-900/20",
    ringActive: "ring-emerald-400/20", indicatorGradient: "from-emerald-300 via-teal-400 to-cyan-400",
    indicatorShadow: "shadow-[0_0_14px_rgba(52,211,153,0.7)]",
    activeItem: "from-emerald-400/[0.10] via-teal-400/[0.06] to-cyan-400/[0.03] border-emerald-400/[0.15] shadow-[inset_0_1px_0_rgba(52,211,153,0.10)]",
    activeIcon: "text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]",
  } : {
    gradient: "from-emerald-500 via-emerald-600 to-teal-700",
    text: "text-emerald-400", textSoft: "text-emerald-400/60", textGlow: "text-emerald-400/50",
    bg: "bg-emerald-400", bgSoft: "bg-emerald-500/10", bgBorder: "border-emerald-500/10",
    shadow: "shadow-[0_0_30px_rgba(16,185,129,0.35)]", glowBg: "bg-emerald-950/25",
    ringActive: "ring-emerald-500/20", indicatorGradient: "from-emerald-400 via-emerald-500 to-teal-500",
    indicatorShadow: "shadow-[0_0_14px_rgba(16,185,129,0.8)]",
    activeItem: "from-emerald-500/[0.12] via-emerald-500/[0.08] to-teal-500/[0.04] border-emerald-500/[0.18] shadow-[inset_0_1px_0_rgba(16,185,129,0.12)]",
    activeIcon: "text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]",
  };

  return (
    <div
      className="dark h-screen flex overflow-hidden text-white"
      style={{
        background: themeConfig.bg,
        fontFamily: "'Plus Jakarta Sans', 'Space Grotesk', system-ui, sans-serif",
      }}
    >
      {/* ═══ Ambient Glow ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div animate={{ opacity: [0.06, 0.12, 0.06] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className={cn("absolute top-[-200px] left-1/4 w-[900px] h-[600px] rounded-full blur-[200px]", accentClasses.glowBg)} />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      {/* ═══ MOBILE OVERLAY ═══ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside className={cn(
        "relative z-[70] h-full flex flex-col shrink-0 transition-all duration-300",
        sidebarCollapsed ? "w-[72px]" : "w-[248px]",
        "max-lg:fixed max-lg:left-0 max-lg:top-0",
        mobileMenuOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
      )} style={{ background: themeConfig.sidebarBg, backdropFilter: "blur(40px)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        
        {/* Sidebar ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className={cn("absolute top-0 left-0 right-0 h-32 bg-gradient-to-b to-transparent", adminTheme === "dark" ? "from-violet-500/[0.06]" : "from-emerald-500/[0.07]")} />
        </div>

        {/* Logo */}
        <div className="relative h-[64px] flex items-center px-4 gap-3 border-b border-white/[0.06] shrink-0">
          <div className={cn("relative h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center ring-1 ring-white/15 shrink-0", accentClasses.gradient, accentClasses.shadow)}>
            <Rocket className="h-[18px] w-[18px] text-white drop-shadow-sm" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/[0.12]" />
          </div>
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="min-w-0">
              <h1 className="text-[15px] font-black tracking-[-0.02em] bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>HOTZFY</h1>
              <p className={cn("text-[7px] font-bold uppercase tracking-[0.4em]", accentClasses.textGlow)}>
                {isEmployee ? "Staff Panel" : "Control Center"}
              </p>
            </motion.div>
          )}
        </div>

        {/* Quick Stats */}
        {!sidebarCollapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("mx-3 mt-3 mb-1 p-3 rounded-xl border", accentClasses.bgBorder)} style={{ background: themeConfig.cardBg }}>
            <div className="flex items-center gap-2 mb-2">
              <Globe className={cn("h-3 w-3", accentClasses.textSoft)} />
              <span className={cn("text-[8px] font-bold uppercase tracking-[0.25em]", accentClasses.textGlow)}>Volume Total</span>
            </div>
            <p className="text-[14px] font-black text-white/90 tracking-tight" style={{ fontFamily: "'Space Grotesk', monospace" }}>
              {totalRevenue >= 1000 ? `R$ ${(totalRevenue / 1000).toFixed(1)}K` : fmtCurrency(totalRevenue)}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className={cn("absolute h-full w-full animate-ping rounded-full opacity-40", accentClasses.bg)} />
                <span className={cn("relative h-1.5 w-1.5 rounded-full", accentClasses.bg)} />
              </span>
              <span className={cn("text-[8px] font-bold uppercase tracking-widest", accentClasses.textSoft)}>Live</span>
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5 scrollbar-thin">
          {visibleSections.map(section => (
            <div key={section.id}>
              {!sidebarCollapsed && (
                <p className="text-[7px] font-extrabold uppercase tracking-[0.35em] text-white/[0.12] px-3 mb-2">{section.label}</p>
              )}
              {sidebarCollapsed && <div className="h-px bg-white/[0.04] mx-2 mb-2" />}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const hasBadge = item.id === "withdrawals" && pendingWdCount > 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { handleTabChange(item.id as TabId); setMobileMenuOpen(false); }}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "relative w-full flex items-center gap-2.5 rounded-xl transition-all duration-200 group",
                        sidebarCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                        isActive
                          ? cn("bg-gradient-to-r text-white border", accentClasses.activeItem)
                          : "text-white/25 hover:text-white/55 hover:bg-white/[0.03] border border-transparent"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-indicator"
                          className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b", accentClasses.indicatorGradient, accentClasses.indicatorShadow)}
                          transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                      )}
                      <item.icon className={cn("h-4 w-4 shrink-0 transition-all", isActive ? accentClasses.activeIcon : "opacity-40 group-hover:opacity-70")} />
                      {!sidebarCollapsed && (
                        <span className={cn("text-[12px] truncate transition-all", isActive ? "font-bold" : "font-medium")}>{item.label}</span>
                      )}
                      {hasBadge && (
                        <span className={cn(
                          "h-4 min-w-[16px] px-1 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-[8px] font-bold flex items-center justify-center shadow-[0_0_14px_rgba(239,68,68,0.5)] ring-1 ring-red-400/30",
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

        {/* Sidebar Footer */}
        <div className="relative border-t border-white/[0.06] p-2.5 space-y-1 shrink-0">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-white/15 hover:text-white/40 hover:bg-white/[0.03] transition-all max-lg:hidden"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!sidebarCollapsed && <span className="text-[11px] font-medium">Recolher</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-white/15 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
          >
            <LogOut className="h-4 w-4" />
            {!sidebarCollapsed && <span className="text-[11px] font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ═══ TOP BAR ═══ */}
        <header className="relative z-40 h-[56px] flex items-center px-4 lg:px-5 gap-3 lg:gap-4 shrink-0" style={{ background: themeConfig.topBarBg, backdropFilter: "blur(30px)", borderBottom: `1px solid ${themeConfig.border}` }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Mobile hamburger */}
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${themeConfig.border}` }}>
              <PanelLeft className="h-4 w-4" style={{ color: themeConfig.textMuted }} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center border", accentClasses.bgBorder)} style={{ background: themeConfig.accentLight }}>
                {(() => {
                  const Icon = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === activeTab)?.icon || LayoutDashboard;
                  return <Icon className={cn("h-3.5 w-3.5", accentClasses.textSoft)} />;
                })()}
              </div>
              <h2 className="text-[14px] font-bold truncate" style={{ color: themeConfig.textPrimary, fontFamily: "'Space Grotesk', sans-serif" }}>{activeTabLabel}</h2>
            </div>
            {syncing && (
              <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 border", accentClasses.bgSoft, accentClasses.bgBorder)}>
                <RefreshCw className={cn("h-2.5 w-2.5 animate-spin", accentClasses.text)} />
                <span className={cn("text-[8px] font-bold uppercase tracking-wider", accentClasses.text)}>Sync</span>
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${themeConfig.border}` }}>
            {DATE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => handleDatePreset(p.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                  datePreset === p.id
                    ? cn(accentClasses.bgSoft, accentClasses.text, "shadow-sm ring-1", accentClasses.ringActive)
                    : ""
                )}
                style={datePreset !== p.id ? { color: themeConfig.textMuted } : {}}
              >
                {p.label}
              </button>
            ))}
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button className="px-2 py-1 rounded-md transition-all" style={{ color: themeConfig.textMuted }}>
                  <Calendar className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 backdrop-blur-3xl shadow-[0_24px_80px_rgba(0,0,0,0.9)] rounded-2xl" style={{ background: "rgba(6,18,16,0.98)", border: `1px solid ${themeConfig.border}` }} align="end">
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

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {isEmployee && (
              <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-wider">Staff</span>
            )}

            {/* Theme Picker */}
            <Popover open={themePickerOpen} onOpenChange={setThemePickerOpen}>
              <PopoverTrigger asChild>
                <button className="relative h-8 w-8 rounded-xl flex items-center justify-center transition-all group" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${themeConfig.border}` }}>
                  <Palette className="h-3.5 w-3.5 transition-colors" style={{ color: themeConfig.textMuted }} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 rounded-xl" style={{ background: "rgba(6,18,16,0.98)", border: `1px solid ${themeConfig.border}`, backdropFilter: "blur(30px)" }} align="end">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-1.5" style={{ color: themeConfig.textMuted }}>Tema do Painel</p>
                {(Object.entries(ADMIN_THEMES) as [AdminTheme, typeof ADMIN_THEMES[AdminTheme]][]).map(([key, theme]) => (
                  <button
                    key={key}
                    onClick={() => { changeAdminTheme(key); setThemePickerOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all text-left",
                      adminTheme === key ? cn(accentClasses.bgSoft, "ring-1", accentClasses.ringActive) : "hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="h-5 w-5 rounded-md border border-white/10 overflow-hidden" style={{ background: theme.bg }} />
                    <span className="text-[11px] font-semibold" style={{ color: adminTheme === key ? themeConfig.textPrimary : themeConfig.textSecondary }}>{theme.label}</span>
                    {adminTheme === key && <span className={cn("ml-auto h-1.5 w-1.5 rounded-full", accentClasses.bg)} />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <button className="relative h-8 w-8 rounded-xl flex items-center justify-center transition-all group" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${themeConfig.border}` }}>
              <Bell className="h-3.5 w-3.5 transition-colors" style={{ color: themeConfig.textMuted }} />
              {pendingWdCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-gradient-to-r from-red-500 to-rose-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.6)]" />}
            </button>

            <button
              onClick={loadData}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${themeConfig.border}`, color: themeConfig.textMuted }}
            >
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} /> Sync
            </button>
          </div>
        </header>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="flex-1 overflow-y-auto relative z-10 scrollbar-thin" data-admin-content>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="p-4 lg:p-6 xl:p-8"
            >
              <div className="mx-auto max-w-[1800px]">
                {activeTab === "god-mode" && (
                  <AdminOverviewTab
                    transactions={transactions} profiles={profiles} products={products}
                    withdrawals={withdrawals} onWithdrawalAction={handleWithdrawalAction}
                    onUserStatus={handleUserStatus} fmtCurrency={fmtCurrency}
                    isEmployee={isEmployee} dateRange={dateRange}
                    onNavigate={setActiveTab}
                  />
                )}
                {activeTab === "analytics" && isAdmin && (
                  <AdminAnalyticsTab transactions={transactions} profiles={profiles} products={products} withdrawals={withdrawals} fmtCurrency={fmtCurrency} />
                )}
                {activeTab === "transactions" && (
                  <AdminTransactionsTab transactions={transactions} profiles={profiles} products={products} fmtCurrency={fmtCurrency} onReload={loadData} />
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
                {activeTab === "affiliates" && isAdmin && <AdminAffiliateSalesTab profiles={profiles} products={products} fmtCurrency={fmtCurrency} />}
                {activeTab === "subscriptions" && isAdmin && <AdminSubscriptionsTab profiles={profiles} fmtCurrency={fmtCurrency} />}
                {activeTab === "referrals" && isAdmin && <AdminReferralsTab profiles={profiles} fmtCurrency={fmtCurrency} />}
                {activeTab === "support" && isAdmin && <AdminSupportTab profiles={profiles} />}
                {activeTab === "rewards" && isAdmin && <AdminRewardsTab profiles={profiles} />}
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
    </div>
  );
}
