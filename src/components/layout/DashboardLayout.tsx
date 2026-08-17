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
import { usePrefetchDashboardData, useTransactions, useWithdrawals, useLedgerBalance } from "@/hooks/useQueryData";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

function DashboardLayoutInner() {
 const { user } = useAuth();
 const { theme, toggleTheme } = useTheme();
 const { profile } = useProfile();
 usePrefetchDashboardData();
 useRealtimeSync();
 const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const routeKey = pathname + search;
 const scrollRef = useRef<HTMLDivElement>(null);
 const [showApproved, setShowApproved] = useState(false);
 const [searchOpen, setSearchOpen] = useState(false);
 const [notifOpen, setNotifOpen] = useState(false);
   const unreadCount = useNotificationCount();
   const { data: transactions = [] } = useTransactions();
   const { data: withdrawals = [] } = useWithdrawals();
   const { data: ledgerBalance = 0 } = useLedgerBalance();
   const [privacyHidden, setPrivacyHidden] = useState(() => {
     try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; }
   });

   const togglePrivacy = () => {
     setPrivacyHidden(prev => {
       const next = !prev;
       try { localStorage.setItem("privacy_mode", String(next)); } catch { /* noop */ }
       return next;
     });
   };

   // Single source of truth: ledger RPC (same as Dashboard / Extrato / Saques)
   const balance = ledgerBalance;

   const formatBRL = (v: number) =>
     v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  useEffect(() => {
  scrollRef.current?.scrollTo({ top: 0, left: 0 });
   }, [routeKey]);

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
 if (!user?.id || !profile?.account_status) return;
 const key = `hotzfy_account_approved_shown_${user.id}`;
 // Only show once ever per user. If the flag already exists, never show again.
 if (profile.account_status === "approved" && !localStorage.getItem(key)) {
 // Mark as seen immediately so future logins don't trigger it, even if user dismisses via reload.
 localStorage.setItem(key, "1");
 // Do not auto-open on first login of an already-approved account — only when the transition is fresh (created_at within last 10 min AND matches updated_at meaning nothing else touched it). This avoids re-showing on every session.
 }
 }, [profile?.account_status, user?.id]);

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
        style={{ "--sidebar-width": "19.5rem", "--sidebar-width-icon": "5rem" } as { [key: string]: string }}
      >
 <div className="flex w-full h-full bg-background platform-shell">
 <AppSidebar />

  <SidebarInset className="ambient-backdrop relative min-w-0 bg-background flex flex-col h-full min-h-0 overflow-hidden">
   {/* Ambient light is handled by .ambient-backdrop CSS — no extra blobs needed */}

          <header className="relative z-30 h-16 flex items-center gap-2 border-b border-border bg-card px-4 lg:px-6 sticky top-0 md:flex transition-colors duration-300">
            <SidebarTrigger className="sidebar-toggle-fx group/trg seller-clickable icon-only relative h-10 w-10 rounded-xl border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-all duration-300 overflow-hidden">
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-0 group-hover/trg:opacity-100 transition-opacity duration-300" />
              <span className="pointer-events-none absolute -inset-1 rounded-2xl ring-1 ring-primary/0 group-hover/trg:ring-primary/30 transition" />
            </SidebarTrigger>

            {/* ─── COMMAND BAR ─── */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Pesquisar"
              className="seller-clickable group ml-1 mr-auto flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-2.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary md:min-w-[220px]"
            >
              <Search className="h-4 w-4" strokeWidth={2} />
              <span className="hidden md:inline text-[12.5px] font-medium">Buscar em tudo…</span>
              <kbd className="ml-auto hidden md:inline-flex items-center rounded-md border border-border/70 bg-background/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground/80">
                ⌘K
              </kbd>
            </button>

            {/* ─── BALANCE ─── */}
            <div className="hidden md:flex items-center justify-center px-3">
              <div className="group/balance relative flex h-[46px] items-center gap-3 overflow-hidden rounded-xl border border-border bg-card px-4 transition-colors hover:border-primary/40">
                <div className="cmd-live relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Wallet className="h-3.5 w-3.5" strokeWidth={2.5} />
                </div>
                <div className="leading-none">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Saldo disponível</p>
                  <p className="mt-1 font-display text-[15px] font-bold tabular-nums tracking-[-0.03em] text-foreground">
                    {privacyHidden ? "••••••" : formatBRL(Math.max(balance, 0))}
                  </p>
                </div>
                <button
                  onClick={() => navigate("/financeiro/saques")}
                  className="ml-2 hidden lg:inline-flex h-7 items-center rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/20"
                >
                  Sacar
                </button>
              </div>
            </div>


            {/* ─── ACTION CLUSTER — perfectly aligned ─── */}
            <div className="flex items-center gap-1.5 ml-auto md:ml-0">
              <button
                onClick={togglePrivacy}
                aria-label={privacyHidden ? "Mostrar saldo" : "Ocultar saldo"}
                className="seller-clickable icon-only h-9 w-9 rounded-xl border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors"
              >
                {privacyHidden ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
              </button>

              <button
                onClick={toggleTheme}
                aria-label="Alternar tema"
                className="seller-clickable icon-only h-9 w-9 rounded-xl border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" strokeWidth={2} /> : <Moon className="h-4 w-4" strokeWidth={2} />}
              </button>

              <button
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notificações"
                className="seller-clickable icon-only relative h-9 w-9 rounded-xl border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors"
              >
                <Bell className="h-4 w-4" strokeWidth={2} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
                )}
              </button>

            </div>

            <div className="mx-2 h-6 w-px bg-border/60" />

            <button onClick={() => navigate("/perfil")} className="seller-clickable flex items-center rounded-xl border-transparent p-0.5">
              <Avatar className="h-8 w-8 ring-1 ring-border/60 hover:ring-primary/40 transition-all cursor-pointer">
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
  className="seller-clickable relative z-20 flex items-center gap-3 w-full px-5 lg:px-8 py-3 border-b cursor-pointer bg-warning/8 border-warning/20 text-warning hover:bg-warning/12"
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
  <div key={routeKey} className="page-fluid">
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
