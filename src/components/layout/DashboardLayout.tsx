import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { Outlet } from "react-router-dom";
import { Menu, Bell, Sun, Moon } from "lucide-react";
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
          {/* Desktop header */}
          <header className="h-14 hidden md:flex items-center border-b border-border px-5 bg-background/80 backdrop-blur-xl sticky top-0 z-10 gap-3">
            <SidebarTrigger className="mr-2 lg:hidden">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>

            <div className="flex-1" />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-yellow-400" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <button className="relative h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full" />
            </button>

            <div className="flex items-center gap-3 ml-2 pl-3 border-l border-border">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold leading-none text-foreground">{profile?.full_name || "Usuário"}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{profile?.email || ""}</p>
              </div>
            </div>
          </header>

          {/* Mobile revenue bar */}
          <MobileRevenueBar />

          <div className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">
            <Outlet />
          </div>
        </main>

        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
