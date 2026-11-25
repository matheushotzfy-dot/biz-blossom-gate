import { SidebarProvider } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { SellerTopbar } from "@/components/seller-shell/SellerTopbar";
import { SellerRail } from "@/components/seller-shell/SellerRail";
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
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { prefetchIdleRoutes } from "@/lib/routePrefetch";
import { kycBanner, topbarKyc, type KycKey } from "@/components/account/accountMeta";



function DashboardLayoutInner() {
 const { user } = useAuth();
 const { theme, toggleTheme } = useTheme();
 const { profile } = useProfile();
 const kyc = useKycStatus();
 const kycLook = kyc.resolved ? topbarKyc(kyc.state as KycKey) : { label: "Verificação pendente", tone: "warn" as const };
 const kycBannerInfo = kyc.resolved ? kycBanner(kyc.state as KycKey) : null;
 usePrefetchDashboardData();
 useRealtimeSync();
 // Aquece os chunks das abas mais usadas em segundo plano (evita "só carregando").
 useEffect(() => { prefetchIdleRoutes(); }, []);
 // Identidade do seller: clara (a do cadastro) por padrão; escura só se o perfil escolher "escuro".
 // As classes ficam no <html> para que diálogos e menus em portal herdem os mesmos tokens.
 useEffect(() => {
   const root = document.documentElement;
   root.classList.add("vp-seller");
   root.classList.toggle("vp-noir", theme === "dark");
   return () => root.classList.remove("vp-seller", "vp-noir");
 }, [theme]);
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
   const { hidden: privacyHidden, toggle: togglePrivacy } = usePrivacyMode();
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


   // Single source of truth: ledger RPC (same as Dashboard / Extrato / Saques)
   const balance = ledgerBalance;

   const formatBRL = (v: number) =>
     v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  useEffect(() => {
  scrollRef.current?.scrollTo({ top: 0, left: 0 });
   }, [routeKey]);

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
      <SidebarProvider open={false} onOpenChange={() => {}} className="block">
  <div className="vp-seller-shell vp-stage flex h-full w-full">
          <SellerRail />
  <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <SellerTopbar
            unread={unreadCount}
            onOpenNotifications={() => setNotifOpen(!notifOpen)}
            onOpenSearch={() => setSearchOpen(true)}
            avatarUrl={profile?.avatar_url}
            name={profile?.full_name}
            email={profile?.email}
            kyc={kyc.resolved ? (kyc.state as KycKey) : undefined}
            kycApproved={kyc.approved}
            kycLabel={kycLook.label}
            kycTone={kycLook.tone}
            balance={balance}
            hidden={privacyHidden}
            onToggleHidden={togglePrivacy}
          />



{/* ─── VERIFICATION BANNER ─── */}
 {kyc.resolved && kycBannerInfo && (
 <button
 type="button"
 onClick={() => navigate(kycBannerInfo.to)}
 className={cn(
 "seller-clickable relative z-20 flex w-full cursor-pointer items-center gap-2.5 border-b px-4 py-2.5 lg:px-8",
 kycBannerInfo.tone === "alert" ? "border-destructive/20 bg-destructive/[0.08] text-destructive hover:bg-destructive/[0.12]" : "border-warning/20 bg-warning/[0.08] text-warning hover:bg-warning/[0.12]",
 )}
 >
 <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
 <p className="flex-1 text-left text-[13px] font-semibold leading-snug">{kycBannerInfo.text}</p>
 <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
 </button>
 )}

 <MobileRevenueBar />

             <div ref={scrollRef} className={cn("dashboard-scroll-field relative z-10 flex-1 min-h-0", pathname === "/suporte" ? "flex flex-col overflow-hidden pb-20 md:pb-0" : "overflow-y-auto overscroll-contain px-3 sm:px-5 md:px-8 pb-28 md:pb-12")}>
   <div className={cn("mx-auto w-full", pathname === "/suporte" ? "flex min-h-0 flex-1 flex-col max-w-none" : "py-3 md:pb-8 md:pt-1", pathname !== "/suporte" && (pathname.startsWith("/premiacoes") ? "max-w-none" : "max-w-[1440px]"))}>
  <div key={routeKey} className={cn("page-fluid", pathname === "/suporte" && "flex min-h-0 flex-1 flex-col")}>
  <Outlet />
  </div>
  </div>
 </div>
 </div>

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
