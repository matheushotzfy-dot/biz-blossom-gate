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
      style={{ "--sidebar-width": "22rem", "--sidebar-width-icon": "4.25rem" } as { [key: string]: string }}
    >
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <AppSidebar />

        <SidebarInset className="relative min-w-0 bg-background">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
            <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-info/10 blur-[130px]" />
          </div>

          <header className="relative z-20 hidden h-[78px] md:flex items-center gap-3 border-b border-border/80 bg-background/86 backdrop-blur-xl px-5 lg:px-8 sticky top-0">
            <SidebarTrigger className="h-11 w-11 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/25 transition-all">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>

            <div className="flex h-11 w-full max-w-[520px] items-center gap-2.5 rounded-xl border border-border/75 bg-muted/35 px-4 text-muted-foreground transition-colors hover:border-primary/25 hover:bg-muted/55">
              <Search className="h-4 w-4" />
              <span className="flex-1 text-[13px] md:text-sm">Buscar produtos, checkouts, clientes e transações…</span>
              <div className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Command className="h-3 w-3" /> K
              </div>
            </div>

            <div className="flex-1" />


            <button
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl flex items-center justify-center border border-border/80 bg-card hover:bg-muted/60 hover:border-primary/20 transition-all"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>

            <button className="relative h-10 w-10 rounded-xl flex items-center justify-center border border-border/80 bg-card hover:bg-muted/60 hover:border-primary/20 transition-all">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full ring-2 ring-card" />
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

          <MobileRevenueBar />

          <div className="relative z-10 flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pb-24 md:pb-10">
            <div className="mx-auto w-full max-w-[1800px] py-5 md:py-7">
              <Outlet />
            </div>
          </div>
        </SidebarInset>

        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
