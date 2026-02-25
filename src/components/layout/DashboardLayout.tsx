import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { Outlet } from "react-router-dom";
import { Menu, Bell, Sun, Moon, ChevronDown, Search } from "lucide-react";
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
          <header className="h-14 hidden md:flex items-center border-b border-border px-6 bg-card/80 backdrop-blur-xl sticky top-0 z-10 gap-3">
            <SidebarTrigger className="mr-1 lg:hidden">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>

            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-muted-foreground text-sm max-w-xs flex-1 lg:max-w-[280px]">
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Buscar...</span>
            </div>

            <div className="flex-1" />

            <button
              onClick={toggleTheme}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/60 transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-warning" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <button className="relative h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/60 transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full ring-2 ring-card" />
            </button>

            {/* Profile */}
            <div className="flex items-center gap-2.5 ml-2 pl-3 border-l border-border cursor-pointer hover:opacity-80 transition-opacity">
              <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:block">
                <p className="text-sm font-semibold leading-none text-foreground">{profile?.full_name || "Usuário"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{profile?.email || ""}</p>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden xl:block" />
            </div>
          </header>

          <MobileRevenueBar />

          <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto pb-20 md:pb-6">
            <Outlet />
          </div>
        </main>

        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
