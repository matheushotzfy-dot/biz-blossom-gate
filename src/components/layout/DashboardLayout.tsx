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

          <header className="relative z-20 h-14 flex items-center border-b border-border/50 bg-background/80 backdrop-blur-md px-3 lg:px-5 sticky top-0 md:flex">
            <SidebarTrigger className="h-8 w-8 rounded-md hover:bg-muted/60 transition-colors flex items-center justify-center text-muted-foreground/70 hover:text-foreground md:flex">
              <Menu className="h-[15px] w-[15px]" strokeWidth={1.85} />
            </SidebarTrigger>

            <button
              onClick={() => setSearchOpen(true)}
              className="ml-1 h-8 px-2.5 rounded-md hover:bg-muted/60 transition-colors flex items-center gap-2 text-muted-foreground/70 hover:text-foreground"
            >
              <Search className="h-[14px] w-[14px]" strokeWidth={1.85} />
              <span className="text-[12px] font-medium hidden lg:inline">Buscar</span>
              <kbd className="hidden lg:inline-flex h-4 items-center gap-0.5 rounded border border-border/60 bg-muted/40 px-1 text-[9px] font-medium text-muted-foreground/60">⌘K</kbd>
            </button>

            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-3 px-4 h-9 rounded-full bg-muted/30 border border-border/40 transition-all hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Saldo</span>
                </div>
                <span className="text-sm font-display font-black text-foreground tabular-nums">
                  {privacyHidden ? "••••••" : formatBRL(Math.max(balance, 0))}
                </span>
                <button 
                  onClick={togglePrivacy}
                  className="ml-1 h-6 w-6 rounded-md flex items-center justify-center hover:bg-background/50 text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  {privacyHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
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
  <div className="mx-auto w-full max-w-[1180px] py-4 md:py-8">
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
 <h2 className="text-2xl font-display font-black text-foreground mb-2">CONTA APROVADA! ✅</h2>
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
