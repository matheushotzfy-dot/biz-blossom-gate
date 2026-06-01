import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { NotificationPanel, useNotificationCount } from "@/components/NotificationPanel";
import { KycOnboardingPopup } from "@/components/KycOnboardingPopup";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu, Bell, Sun, Moon, Search, AlertTriangle, ArrowRight, X as XIcon, CheckCircle2, Wallet, Eye, EyeOff } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { ProfileProvider, useProfile } from "@/hooks/useProfile";
import { usePrefetchDashboardData, useTransactions, useWithdrawals } from "@/hooks/useQueryData";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

function DashboardLayoutInner() {
 const { user } = useAuth();
 const { theme, toggleTheme } = useTheme();
 const { profile } = useProfile();
 usePrefetchDashboardData();
 const navigate = useNavigate();
 const { pathname } = useLocation();
 const scrollRef = useRef<HTMLDivElement>(null);
 const [showApproved, setShowApproved] = useState(false);
 const [searchOpen, setSearchOpen] = useState(false);
 const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = useNotificationCount();
  const { data: transactions = [] } = useTransactions();
  const { data: withdrawals = [] } = useWithdrawals();
  const [balanceAdjustments, setBalanceAdjustments] = useState(0);
  const [privacyHidden, setPrivacyHidden] = useState(() => {
    try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; }
  });

  const togglePrivacy = () => {
    setPrivacyHidden(prev => {
      const next = !prev;
      try { localStorage.setItem("privacy_mode", String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("balance_adjustments").select("amount, type").eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          const adj = data.reduce((acc, a) => acc + (a.type === "credit" ? Number(a.amount) : -Number(a.amount)), 0);
          setBalanceAdjustments(adj);
        }
      });
  }, [user?.id]);

  const balance = transactions
    .filter(t => t.status === "completed")
    .reduce((acc, t) => acc + Number(t.net_amount), 0) + 
    balanceAdjustments - 
    withdrawals
      .filter(w => w.status === "approved" || w.status === "pending")
      .reduce((acc, w) => acc + Number(w.amount), 0) -
    transactions
      .filter(t => t.status === "completed" && !t.retention_released && Number(t.retained_amount) > 0)
      .reduce((acc, t) => acc + Number(t.retained_amount), 0);

  const formatBRL = (v: number) => 
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

 useEffect(() => {
 scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  // Sync privacy mode with dashboard
  useEffect(() => {
    const handleStorage = () => {
      const isHidden = localStorage.getItem("privacy_mode") === "true";
      setPrivacyHidden(isHidden);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

 useEffect(() => {
 if (!user?.id || !profile?.account_status || !profile?.updated_at) return;
 const key = `hotzfy_account_approved_shown_${user.id}`;
 if (profile.account_status === "approved" && !localStorage.getItem(key)) {
 // Only show if profile was updated in the last 5 minutes (i.e. just approved)
 const updatedAt = new Date(profile.updated_at).getTime();
 const fiveMinAgo = Date.now() - 5 * 60 * 1000;
 if (updatedAt > fiveMinAgo) {
 setShowApproved(true);
 }
 localStorage.setItem(key, "true");
 }
 }, [profile?.account_status, profile?.updated_at, user?.id]);

 // Cmd+K shortcut
 useEffect(() => {
 const handler = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === "k") {
 e.preventDefault();
 setSearchOpen(true);
 }
 };
 window.addEventListener("keydown", handler);
 return () => window.removeEventListener("keydown", handler);
 }, []);

 return (
      <SidebarProvider
        style={{ "--sidebar-width": "19.5rem", "--sidebar-width-icon": "4.5rem" } as { [key: string]: string }}
      >
 <div className="flex w-full h-full bg-background">
 <AppSidebar />

  <SidebarInset className="ambient-backdrop relative min-w-0 bg-background flex flex-col h-full min-h-0 overflow-hidden">
   {/* Ambient light is handled by .ambient-backdrop CSS — no extra blobs needed */}

          <header className="relative z-30 h-16 flex items-center border-b border-border/40 bg-background/80 backdrop-blur-xl px-4 lg:px-6 sticky top-0 md:flex transition-all duration-300">
            <SidebarTrigger className="h-9 w-9 rounded-xl hover:bg-muted/60 transition-all flex items-center justify-center text-muted-foreground/70 hover:text-foreground">
              <Menu className="h-4 w-4" strokeWidth={2} />
            </SidebarTrigger>

            {/* ─── SEARCH TRIGGER ─── */}
            <div className="flex-1 max-w-sm lg:max-w-md ml-4 mr-auto">
              <button
                onClick={() => setSearchOpen(true)}
                className="w-full h-[38px] px-4 rounded-[1.25rem] bg-muted/20 border border-border/20 hover:bg-muted/40 hover:border-primary/20 hover:shadow-[0_0_15px_-5px_rgba(var(--primary),0.1)] transition-all flex items-center gap-3 text-muted-foreground/60 hover:text-foreground group overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Search className="h-[14px] w-[14px] transition-transform group-hover:scale-110 text-primary/60 group-hover:text-primary" strokeWidth={2.5} />
                <span className="text-[12px] font-medium tracking-tight flex-1 text-left hidden sm:inline truncate">O que você está procurando?</span>
                <span className="text-[12px] font-medium tracking-tight flex-1 text-left sm:hidden">Buscar...</span>
                <div className="hidden lg:flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg bg-background/50 border border-border/40 shadow-sm">
                  <span className="text-[9px] font-bold text-muted-foreground/30">⌘</span>
                  <span className="text-[9px] font-bold text-muted-foreground/30">K</span>
                </div>
              </button>
            </div>

            {/* ─── BALANCE ─── */}
            <div className="hidden md:flex items-center justify-center px-4">
              <div className="group/balance relative flex items-center gap-4 px-6 h-[46px] rounded-[1.5rem] bg-secondary/20 border border-border/30 backdrop-blur-md transition-all hover:bg-secondary/40 hover:border-primary/30 hover:shadow-[0_0_25px_-5px_rgba(var(--primary),0.15)] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm border border-primary/10 group-hover/balance:scale-110 transition-transform duration-500">
                    <Wallet className="h-4 w-4" strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 group-hover/balance:text-muted-foreground/70 transition-colors">Saldo</span>
                </div>
                <span className="text-[16px] font-display font-bold text-foreground tabular-nums tracking-[-0.03em] relative z-10">
                  {privacyHidden ? "••••••" : formatBRL(Math.max(balance, 0))}
                </span>
                <button 
                  onClick={togglePrivacy}
                  className="relative z-10 ml-1 h-8 w-8 rounded-xl flex items-center justify-center hover:bg-background/80 text-muted-foreground/30 hover:text-foreground transition-all active:scale-90"
                >
                  {privacyHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-0.5 ml-auto md:ml-0">
              <button
                onClick={toggleTheme}
                className="h-8 w-8 rounded-md hover:bg-muted/60 transition-colors flex items-center justify-center text-muted-foreground/70 hover:text-foreground"
              >
                {theme === "dark" ? <Sun className="h-[15px] w-[15px]" strokeWidth={1.85} /> : <Moon className="h-[15px] w-[15px]" strokeWidth={1.85} />}
              </button>

              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative h-8 w-8 rounded-md hover:bg-muted/60 transition-colors flex items-center justify-center text-muted-foreground/70 hover:text-foreground"
              >
                <Bell className="h-[15px] w-[15px]" strokeWidth={1.85} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-primary rounded-full ring-2 ring-background" />
                )}
              </button>
            </div>

            <div className="mx-2 h-5 w-px bg-border/60" />

            <button onClick={() => navigate("/perfil")} className="flex items-center">
              <Avatar className="h-7 w-7 ring-1 ring-border/60 hover:ring-primary/40 transition-all cursor-pointer">
                <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="bg-muted text-foreground text-[11px] font-semibold">
                  {(profile?.full_name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </header>

 {/* ─── VERIFICATION BANNER ─── */}
 {profile && profile.account_status !== "approved" && (
 <button
 onClick={() => navigate("/perfil?tab=identidade&scrollTo=kyc")}
 className="relative z-20 flex items-center gap-3 w-full px-5 lg:px-8 py-3 border-b transition-colors cursor-pointer bg-warning/8 border-warning/20 text-warning hover:bg-warning/12"
 >
 <AlertTriangle className="h-4 w-4 shrink-0" />
 <p className="text-[13px] font-semibold flex-1 text-left">
 {profile.document_number
 ? "Conta em análise — será aprovada o quanto antes!"
 : "Complete sua verificação para realizar saques na plataforma"}
 </p>
 <ArrowRight className="h-4 w-4 shrink-0" />
 </button>
 )}

 <MobileRevenueBar />

 <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-7 xl:px-10 pb-20 md:pb-10 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
  <div className="mx-auto w-full max-w-[1180px] py-2 md:py-4">
  <div key={pathname} className="page-rise">
  <Outlet />
  </div>
  </div>
 </div>
 </SidebarInset>

 <MobileBottomNav />
 </div>

 <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
 <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

 {/* ─── ACCOUNT APPROVED POPUP ─── */}
 {showApproved && (
 <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setShowApproved(false)} />
 <div className="relative w-full max-w-sm rounded-2xl border border-primary/30 bg-card shadow-2xl animate-scale-in overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
 <button
 onClick={() => setShowApproved(false)}
 className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted z-10"
 >
 <XIcon className="h-4 w-4 text-muted-foreground" />
 </button>
 <div className="relative p-8 text-center">
 <div className="mx-auto mb-5 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
 <CheckCircle2 className="h-10 w-10 text-primary" />
 </div>
 <h2 className="text-2xl font-display font-bold text-foreground mb-2">CONTA APROVADA! ✅</h2>
 <p className="text-muted-foreground text-sm mb-6">
 Sua conta foi verificada com sucesso. Agora você pode realizar saques e utilizar todas as funcionalidades da plataforma!
 </p>
 <button
 onClick={() => setShowApproved(false)}
 className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-bold shadow-lg shadow-primary/15"
 >
 Concluir
 </button>
 </div>
 </div>
 </div>
 )}

 <KycOnboardingPopup />
 </SidebarProvider>
 );
}

export function DashboardLayout() {
 return (
 <ProfileProvider>
 <DashboardLayoutInner />
 </ProfileProvider>
 );
}
