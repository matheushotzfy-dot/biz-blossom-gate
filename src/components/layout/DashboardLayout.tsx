import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { Outlet } from "react-router-dom";
import { Menu, Bell, Sun, Moon, ChevronDown, Search, Command } from "lucide-react";
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
    supabase.from("profiles").select("*").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <main className="flex-1 flex flex-col min-h-screen">
          {/* Top bar */}
          <header className="h-[72px] hidden md:flex items-center border-b border-border/80 px-6 lg:px-8 bg-card/90 backdrop-blur-xl sticky top-0 z-20 gap-4">
            <SidebarTrigger className="mr-1 h-10 w-10 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/25 transition-all">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>

            {/* Search */}
            <div className="flex items-center gap-2.5 px-4 h-11 rounded-xl border border-border/80 bg-muted/35 text-muted-foreground w-full max-w-[460px] cursor-pointer hover:border-primary/25 hover:bg-muted/50 transition-colors">
              <Search className="h-4 w-4" />
              <span className="text-[13px] md:text-sm flex-1">Buscar produtos, clientes, transações…</span>
              <div className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Command className="h-3 w-3" /> K
              </div>
            </div>

            <div className="flex-1" />

            {/* Actions */}
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

            {/* Profile */}
            <div className="flex items-center gap-3 ml-1 pl-4 border-l border-border/80 cursor-pointer hover:opacity-90 transition-opacity">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/15">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:block min-w-[140px]">
                <p className="text-sm font-semibold leading-none text-foreground truncate">{profile?.full_name || "Usuário"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{profile?.email || ""}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden xl:block" />
            </div>
          </header>

          <MobileRevenueBar />

          <div className="flex-1 px-4 md:px-6 lg:px-8 py-4 md:py-6 overflow-x-hidden overflow-y-auto pb-24 md:pb-8">
            <div className="mx-auto w-full max-w-[1700px]">
              <Outlet />
            </div>
          </div>
        </main>

        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
