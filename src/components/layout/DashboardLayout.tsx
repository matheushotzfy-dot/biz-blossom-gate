import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { NotificationPanel, useNotificationCount } from "@/components/NotificationPanel";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu, Bell, Sun, Moon, Search, AlertTriangle, ArrowRight, X as XIcon, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { ProfileProvider, useProfile } from "@/hooks/useProfile";
import { usePrefetchDashboardData } from "@/hooks/useQueryData";
import { useEffect, useState } from "react";

function DashboardLayoutInner() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { profile } = useProfile();
  usePrefetchDashboardData();
  const navigate = useNavigate();
  const [showApproved, setShowApproved] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = useNotificationCount();

  useEffect(() => {
    if (!user?.id || !profile?.account_status || !profile?.updated_at) return;
    const key = `hotzfy_account_approved_shown_${user.id}`;
    if (profile.account_status === "approved" && !localStorage.getItem(key)) {
      const updatedAt = new Date(profile.updated_at).getTime();
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      if (updatedAt > fiveMinAgo) {
        setShowApproved(true);
      }
      localStorage.setItem(key, "true");
    }
  }, [profile?.account_status, profile?.updated_at, user?.id]);

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
      style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "3.5rem" } as { [key: string]: string }}
    >
      <div className="flex w-full h-full bg-background">
        <AppSidebar />

        <SidebarInset className="relative min-w-0 bg-background flex flex-col h-full min-h-0">
          {/* Desktop header */}
          <header className="relative z-20 hidden h-12 md:flex items-center gap-2 border-b border-border/20 bg-background/80 backdrop-blur-xl px-4 lg:px-6 sticky top-0">
            <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-muted/40 transition-colors flex items-center justify-center">
              <Menu className="h-4 w-4 text-muted-foreground" />
            </SidebarTrigger>

            <div className="flex-1" />

            <button
              onClick={() => setSearchOpen(true)}
              className="h-8 px-3 rounded-lg border border-border/30 bg-muted/10 hover:bg-muted/25 transition-all flex items-center gap-2 text-muted-foreground/50"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium hidden lg:inline">Buscar</span>
              <kbd className="hidden lg:inline text-[9px] font-mono bg-muted/30 rounded px-1 py-0.5 text-muted-foreground/30 border border-border/15">⌘K</kbd>
            </button>

            <button
              onClick={toggleTheme}
              className="h-8 w-8 rounded-lg hover:bg-muted/40 transition-colors flex items-center justify-center"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-warning" /> : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>

            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative h-8 w-8 rounded-lg hover:bg-muted/40 transition-colors flex items-center justify-center"
            >
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 h-3.5 min-w-[14px] px-0.5 bg-primary rounded-full ring-2 ring-background flex items-center justify-center text-[8px] font-bold text-primary-foreground">{unreadCount}</span>
              )}
            </button>

            <button onClick={() => navigate("/perfil")} className="ml-0.5">
              <Avatar className="h-7 w-7 ring-1 ring-border/30 hover:ring-primary/30 transition-all cursor-pointer">
                <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="bg-primary/8 text-primary text-[10px] font-bold">
                  {(profile?.full_name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </header>

          {/* Verification banner */}
          {profile && profile.account_status !== "approved" && (
            <button
              onClick={() => navigate("/financeiro/identidade")}
              className={`relative z-20 flex items-center gap-3 w-full px-5 lg:px-8 py-2.5 border-b transition-colors cursor-pointer ${
                profile.document_number
                  ? "bg-info/6 border-info/15 text-info hover:bg-info/10"
                  : "bg-warning/6 border-warning/15 text-warning hover:bg-warning/10"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <p className="text-[12px] font-semibold flex-1 text-left">
                {profile.document_number
                  ? "Conta em análise — será aprovada o quanto antes!"
                  : "Complete sua verificação para realizar saques"}
              </p>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}

          <MobileRevenueBar />

          <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 xl:px-8 pb-24 md:pb-8 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="mx-auto w-full max-w-[1180px] py-5 md:py-6">
              <Outlet />
            </div>
          </div>
        </SidebarInset>

        <MobileBottomNav />
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

      {/* Account Approved Popup */}
      {showApproved && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setShowApproved(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-primary/20 bg-card shadow-2xl animate-scale-in overflow-hidden">
            <button
              onClick={() => setShowApproved(false)}
              className="absolute top-3 right-3 h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted z-10"
            >
              <XIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <div className="relative p-7 text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-display font-black text-foreground mb-2">Conta Aprovada!</h2>
              <p className="text-muted-foreground text-sm mb-5">
                Sua conta foi verificada com sucesso. Agora você pode realizar saques e utilizar todas as funcionalidades.
              </p>
              <button
                onClick={() => setShowApproved(false)}
                className="w-full h-10 rounded-xl gradient-primary text-primary-foreground font-bold text-sm"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
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
