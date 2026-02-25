import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { Outlet } from "react-router-dom";
import { Menu, Bell, Sun, Moon, ChevronDown, Search, Command } from "lucide-react";
import hotzfyLogo from "@/assets/hotzfy-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export function DashboardLayout() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "20rem", "--sidebar-width-icon": "3.5rem" } as { [key: string]: string }}
    >
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <AppSidebar />

        <SidebarInset className="relative min-w-0 bg-background">
          {/* Top bar - desktop */}
          <header className="relative z-20 hidden h-16 md:flex items-center gap-3 border-b border-border bg-card/80 backdrop-blur-lg px-5 lg:px-8 sticky top-0">
            <SidebarTrigger className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors">
              <Menu className="h-4 w-4 text-foreground" />
            </SidebarTrigger>

            <div className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 text-muted-foreground transition-colors hover:border-primary/15">
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-xs">Buscar…</span>
              <div className="inline-flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                <Command className="h-2.5 w-2.5" /> K
              </div>
            </div>

            <div className="flex-1" />

            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-lg flex items-center justify-center border border-border bg-card hover:bg-muted/60 transition-colors"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>

            <button className="relative h-9 w-9 rounded-lg flex items-center justify-center border border-border bg-card hover:bg-muted/60 transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full ring-2 ring-card" />
            </button>

            <div className="flex items-center gap-2.5 ml-1 pl-3 border-l border-border cursor-pointer hover:opacity-90 transition-opacity">
              <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground shadow-sm shadow-primary/15">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:block min-w-0">
                <p className="text-sm font-semibold leading-none text-foreground truncate">{profile?.full_name || "Usuário"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{profile?.email || ""}</p>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden xl:block" />
            </div>
          </header>

          <MobileRevenueBar />

          <div className="relative z-10 flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pb-24 md:pb-8">
            <div className="mx-auto w-full max-w-[1600px] py-5 md:py-6">
              <Outlet />
            </div>
          </div>
        </SidebarInset>

        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
