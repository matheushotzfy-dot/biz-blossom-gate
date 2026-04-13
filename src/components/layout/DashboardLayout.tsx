import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { NotificationPanel, useNotificationCount } from "@/components/NotificationPanel";
import { KycOnboardingPopup } from "@/components/KycOnboardingPopup";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu, Bell, Sun, Moon, Search, AlertTriangle, ArrowRight, X as XIcon, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { ProfileProvider, useProfile } from "@/hooks/useProfile";
import { usePrefetchDashboardData } from "@/hooks/useQueryData";
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

 useEffect(() => {
 scrollRef.current?.scrollTo({ top: 0, left: 0 });
 }, [pathname]);

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
 style={{ "--sidebar-width": "18rem", "--sidebar-width-icon": "4.25rem" } as { [key: string]: string }}
 >
 <div className="flex w-full h-full bg-background">
 <AppSidebar />

  <SidebarInset className="ambient-backdrop relative min-w-0 bg-background flex flex-col h-full min-h-0 overflow-hidden">
  {/* Ambient light blobs — kept subtle to avoid double-stacking with CSS ambient-backdrop */}
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
   <div className="absolute -left-56 -top-24 h-[780px] w-[780px] rounded-full bg-primary/[0.06] blur-[380px]" />
   <div className="absolute -right-52 -top-16 h-[760px] w-[760px] rounded-full bg-info/[0.05] blur-[380px]" />
   <div className="absolute left-1/2 top-[42%] -translate-x-1/2 h-[820px] w-[980px] rounded-full bg-background/90 blur-[280px]" />
  </div>

 <header className="relative z-20 hidden h-14 md:flex items-center gap-2 border-b border-border/50 bg-background/82 backdrop-blur-2xl shadow-[0_1px_0_hsl(var(--foreground)/0.04)] px-4 lg:px-6 sticky top-0">
 <SidebarTrigger className="h-9 w-9 rounded-full hover:bg-muted/40 transition-colors flex items-center justify-center">
 <Menu className="h-4 w-4 text-muted-foreground" />
 </SidebarTrigger>

 <button
 onClick={() => setSearchOpen(true)}
 className="h-9 w-9 rounded-full hover:bg-muted/40 transition-colors flex items-center justify-center"
 >
 <Search className="h-4 w-4 text-muted-foreground" />
 </button>

 <div className="flex-1" />

 <button
 onClick={toggleTheme}
 className="h-9 w-9 rounded-full hover:bg-muted/40 transition-colors flex items-center justify-center"
 >
 {theme === "dark" ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
 </button>

 <button
 onClick={() => setNotifOpen(!notifOpen)}
 className="relative h-9 w-9 rounded-full hover:bg-muted/40 transition-colors flex items-center justify-center"
 >
 <Bell className="h-4 w-4 text-muted-foreground" />
 {unreadCount > 0 && (
 <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 bg-primary rounded-full ring-2 ring-background flex items-center justify-center text-[9px] font-bold text-primary-foreground">{unreadCount}</span>
 )}
 </button>

 <button onClick={() => navigate("/perfil")} className="ml-1">
 <Avatar className="h-8 w-8 ring-1 ring-border/40 hover:ring-primary/30 transition-all cursor-pointer">
 <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
 <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
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
 <Outlet />
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
