import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu, Bell, Sun, Moon, ChevronDown, Search, Command, AlertTriangle, ArrowRight, X as XIcon, CheckCircle2 } from "lucide-react";
import hotzfyLogo from "@/assets/hotzfy-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { ProfileProvider, useProfile } from "@/hooks/useProfile";
import { usePrefetchDashboardData } from "@/hooks/useQueryData";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function DashboardLayoutInner() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { profile } = useProfile();
  usePrefetchDashboardData();
  const navigate = useNavigate();
  const [showApproved, setShowApproved] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications
  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setNotifications(data);
          setUnreadCount(data.filter((n: any) => !n.is_read).length);
        }
      });
  }, [user]);

  // Load notifications
  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setNotifications(data);
          setUnreadCount(data.filter((n: any) => !n.is_read).length);
        }
      });
  }, [user]);

  useEffect(() => {
    if (profile?.account_status === "approved" && user?.id) {
      const key = `hotzfy_account_approved_${user.id}`;
      if (!localStorage.getItem(key)) {
        setShowApproved(true);
        localStorage.setItem(key, "1");
      }
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
      style={{ "--sidebar-width": "22rem", "--sidebar-width-icon": "4.25rem" } as { [key: string]: string }}
    >
        <div className="flex w-full h-full bg-background">
          <AppSidebar />

          <SidebarInset className="relative min-w-0 bg-background flex flex-col h-full min-h-0">
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
            <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-info/10 blur-[130px]" />
          </div>

          <header className="relative z-20 hidden h-[78px] md:flex items-center gap-3 border-b border-border/80 bg-background/86 backdrop-blur-xl px-5 lg:px-8 sticky top-0">
            <SidebarTrigger className="h-11 w-11 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/25 transition-all">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>

            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-11 w-full max-w-[520px] items-center gap-2.5 rounded-xl border border-border/75 bg-muted/35 px-4 text-muted-foreground transition-colors hover:border-primary/25 hover:bg-muted/55"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-[13px] md:text-sm text-left">Buscar produtos, checkouts, clientes e transações…</span>
              <div className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Command className="h-3 w-3" /> K
              </div>
            </button>

            <div className="flex-1" />

            <button
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl flex items-center justify-center border border-border/80 bg-card hover:bg-muted/60 hover:border-primary/20 transition-all"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>

            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative h-10 w-10 rounded-xl flex items-center justify-center border border-border/80 bg-card hover:bg-muted/60 hover:border-primary/20 transition-all"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 bg-primary rounded-full ring-2 ring-card flex items-center justify-center text-[9px] font-bold text-primary-foreground">{unreadCount}</span>
              )}
            </button>

            <div className="flex items-center gap-3 ml-1 pl-4 border-l border-border/80 cursor-pointer hover:opacity-90 transition-opacity">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/15">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:block min-w-[150px]">
                <p className="text-sm font-semibold leading-none text-foreground truncate">{profile?.full_name || "Usuário"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{profile?.email || ""}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden xl:block" />
            </div>
          </header>

          {/* ─── VERIFICATION BANNER ─── */}
          {profile && profile.account_status !== "approved" && (
            <button
              onClick={() => navigate("/financeiro/identidade")}
              className={`relative z-20 flex items-center gap-3 w-full px-5 lg:px-8 py-3 border-b transition-colors cursor-pointer ${
                profile.document_number
                  ? "bg-info/8 border-info/20 text-info hover:bg-info/12"
                  : "bg-warning/8 border-warning/20 text-warning hover:bg-warning/12"
              }`}
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

          <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 lg:px-8 pb-24 md:pb-10 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="mx-auto w-full max-w-[1800px] py-5 md:py-7">
              <Outlet />
            </div>
          </div>
        </SidebarInset>

        <MobileBottomNav />
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

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
