import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { NotificationPanel, useNotificationCount } from "@/components/NotificationPanel";
import { KycOnboardingPopup } from "@/components/KycOnboardingPopup";
import { Outlet, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, X as XIcon, CheckCircle2, Wallet, Search } from "lucide-react";
import { IrisIcon, SunDialIcon, MoonDialIcon, SignalBellIcon, PanelToggleIcon } from "@/components/icons/ShellIcons";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { ProfileProvider, useProfile } from "@/hooks/useProfile";
import { usePrefetchDashboardData, useWithdrawals, useLedgerBalance } from "@/hooks/useQueryData";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useKycStatus } from "@/hooks/useKycStatus";
import { prefetchIdleRoutes } from "@/lib/routePrefetch";



function DashboardLayoutInner() {
 const { user } = useAuth();
 const { theme, toggleTheme } = useTheme();
 const { profile } = useProfile();
 const kyc = useKycStatus();
 usePrefetchDashboardData();
 useRealtimeSync();
 // Aquece os chunks das abas mais usadas em segundo plano (evita "só carregando").
 useEffect(() => { prefetchIdleRoutes(); }, []);
 const navigate = useNavigate();

  const { pathname, search } = useLocation();
  const routeKey = pathname + search;
 const scrollRef = useRef<HTMLDivElement>(null);
 const [showApproved, setShowApproved] = useState(false);
 const [searchOpen, setSearchOpen] = useState(false);
 const [notifOpen, setNotifOpen] = useState(false);
   const unreadCount = useNotificationCount();
   const { data: withdrawals = [] } = useWithdrawals();
   const { data: ledgerBalance = 0 } = useLedgerBalance();
   const [privacyHidden, setPrivacyHidden] = useState(() => {
     try { return localStorage.getItem("privacy_mode") === "true"; } catch { return false; }
   });
   // Sidebar: fixada (pino) ou reduzida com expansão no hover
   const [sidebarPinned, setSidebarPinned] = useState(() => {
     try { return localStorage.getItem("sidebar_pinned") !== "false"; } catch { return true; }
   });
    const [sidebarHover, setSidebarHover] = useState(false);
    const sidebarHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleSidebarHover = (hovering: boolean) => {
      if (sidebarHoverTimer.current) clearTimeout(sidebarHoverTimer.current);
      // A abertura responde imediatamente; uma tolerância curta no fechamento evita
      // oscilações quando o cursor cruza a borda do painel.
      sidebarHoverTimer.current = setTimeout(
        () => setSidebarHover(hovering),
        hovering ? 0 : 100,
      );
    };
   const togglePin = () => {
     setSidebarPinned((prev) => {
       const next = !prev;
       try { localStorage.setItem("sidebar_pinned", String(next)); } catch { /* noop */ }
       return next;
     });
   };


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
 const key = `venxpay_account_approved_shown_${user.id}`;
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
        open={sidebarPinned || sidebarHover}
        onOpenChange={(v) => setSidebarPinned(v)}
        style={{ "--sidebar-width": "17.5rem", "--sidebar-width-icon": "4.25rem" } as { [key: string]: string }}
      >
  <div className={cn("flex w-full h-full platform-shell venx-executive-shell", !sidebarPinned && "sidebar-unpinned")}>
 <AppSidebar
   pinned={sidebarPinned}
   onTogglePin={togglePin}
    onHoverChange={handleSidebarHover}
 />

  <SidebarInset className="ambient-backdrop dashboard-content-field relative min-w-0 bg-transparent flex flex-col h-full min-h-0 overflow-hidden">

          <header className="technical-topbar relative z-30 flex h-16 items-center gap-1.5 border-b border-border px-3 transition-colors duration-200 lg:px-7 sticky top-0 md:flex">
            <SidebarTrigger className="seller-clickable icon-only relative md:hidden h-8 w-8 rounded-[9px] border border-transparent bg-transparent flex items-center justify-center text-muted-foreground transition-colors duration-200 hover:border-border/70 hover:text-foreground [&>svg]:hidden">
              <PanelToggleIcon size={17} />
              <span className="sr-only">Alternar menu</span>
            </SidebarTrigger>


            {/* ─── SEARCH (ícone apenas) ─── */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Pesquisar (⌘K)"
              title="Buscar em tudo · ⌘K"
              className="seller-clickable mr-auto flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              <Search className="h-[17px] w-[17px]" strokeWidth={2.2} />
            </button>

            {/* ─── BALANCE ─── */}
            <div className="hidden md:flex items-center justify-center pr-1">
              <div className="flex h-9 items-center gap-2.5 rounded-lg border border-border bg-card px-3 transition-colors duration-200 hover:border-primary/30">
                <Wallet className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
                <div className="leading-none">
                  <p className="text-[9.5px] font-medium text-muted-foreground/60">Saldo disponível</p>
                  <p className="mt-[3px] font-numbers text-[13px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">
                    {privacyHidden ? "••••••" : formatBRL(Math.max(balance, 0))}
                  </p>
                </div>
                <button
                  onClick={() => navigate("/financeiro/saques")}
                  className="ml-1 hidden lg:inline-flex h-6 items-center rounded-[7px] bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:brightness-105"
                >
                  Sacar
                </button>
              </div>
            </div>

            {/* ─── ACTION CLUSTER ─── */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={togglePrivacy}
                aria-label={privacyHidden ? "Mostrar saldo" : "Ocultar saldo"}
                className={cn(
                  "seller-clickable icon-only h-8 w-8 rounded-[9px] border border-transparent bg-transparent flex items-center justify-center transition-colors duration-200 hover:border-border/70 hover:text-foreground",
                  privacyHidden ? "text-primary" : "text-muted-foreground",
                )}
              >
                <IrisIcon size={17} off={privacyHidden} />
              </button>

              <button
                onClick={toggleTheme}
                aria-label="Alternar tema"
                className="seller-clickable icon-only h-8 w-8 rounded-[9px] border border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:text-foreground flex items-center justify-center transition-colors duration-200"
              >
                {theme === "dark" ? <SunDialIcon size={17} /> : <MoonDialIcon size={17} />}
              </button>

              <button
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notificações"
                className="seller-clickable icon-only relative h-8 w-8 rounded-[9px] border border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:text-foreground flex items-center justify-center transition-colors duration-200"
              >
                <SignalBellIcon size={17} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-card" />
                )}
              </button>
            </div>

            <div className="mx-1.5 h-5 w-px bg-border/60" />

            <button
              onClick={() => navigate("/perfil")}
              aria-label="Meu perfil"
              className="seller-clickable relative flex items-center rounded-full p-[2px] transition-colors"
            >
              <Avatar className="h-7 w-7 ring-1 ring-border/70 hover:ring-primary/50 transition-colors cursor-pointer">
                <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="bg-muted font-display text-foreground text-[10.5px] font-bold">
                  {(profile?.full_name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute -bottom-0 -right-0 h-2 w-2 rounded-full ring-2 ring-card",
                  kyc.approved ? "bg-success" : "bg-warning",
                )}
              />
            </button>
          </header>



 {/* ─── VERIFICATION BANNER ─── */}
 {kyc.resolved && kyc.showOnboarding && (
 <button
 onClick={() => navigate("/perfil?tab=identidade&scrollTo=kyc")}
  className="seller-clickable relative z-20 flex w-full cursor-pointer items-center gap-2.5 border-b border-warning/20 bg-warning/[0.08] px-4 py-2.5 text-warning hover:bg-warning/[0.12] lg:px-8"
 >
 <AlertTriangle className="h-4 w-4 shrink-0" />
 <p className="flex-1 text-left text-[12.5px] font-semibold leading-snug">
 {profile?.document_number
 ? "Conta em análise — será aprovada o quanto antes!"
 : "Complete sua verificação para realizar saques na plataforma"}
 </p>
 <ArrowRight className="h-4 w-4 shrink-0" />
 </button>
 )}

 <MobileRevenueBar />

             <div ref={scrollRef} className={cn("dashboard-scroll-field relative z-10 flex-1 min-h-0", pathname === "/suporte" ? "flex flex-col overflow-hidden pb-20 md:pb-0" : "overflow-y-auto overscroll-contain px-3 sm:px-5 md:px-8 xl:px-12 pb-28 md:pb-12")}>
   <div className={cn("mx-auto w-full", pathname === "/suporte" ? "flex min-h-0 flex-1 flex-col max-w-none" : "py-3 md:py-7", pathname !== "/suporte" && (pathname.startsWith("/premiacoes") ? "max-w-none" : "max-w-[1280px]"))}>
  <div key={routeKey} className={cn("page-fluid", pathname === "/suporte" && "flex min-h-0 flex-1 flex-col")}>
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
 <div className="relative w-full max-w-sm rounded-[12px] border border-primary/30 bg-card  animate-scale-in overflow-hidden">
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
 className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-bold "
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
