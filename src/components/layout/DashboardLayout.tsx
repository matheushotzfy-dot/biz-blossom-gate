import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { Outlet } from "react-router-dom";
import { Menu, Bell, Sun, Moon, ChevronDown, Search, Command, Sparkles } from "lucide-react";
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <main className="flex-1 flex flex-col min-h-screen relative">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-info/10 blur-3xl" />
          </div>

          <header className="h-16 hidden md:flex items-center border-b border-border px-6 bg-card/75 backdrop-blur-xl sticky top-0 z-20 gap-3">
            <SidebarTrigger className="mr-1 lg:hidden">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>

            <div className="flex items-center gap-2 px-3.5 h-10 rounded-xl border border-border bg-muted/45 text-muted-foreground min-w-[320px] max-w-[420px] w-full">
              <Search className="h-4 w-4" />
              <span className="text-sm">Buscar produtos, clientes, transações…</span>
              <div className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Command className="h-3 w-3" /> K
              </div>
            </div>

            <div className="flex-1" />

            <div className="hidden lg:flex items-center gap-2 px-3 h-9 rounded-lg border border-border bg-muted/35">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Modo Enterprise</span>
            </div>

            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-lg flex items-center justify-center border border-border bg-muted/35 hover:bg-muted/65 transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-warning" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <button className="relative h-9 w-9 rounded-lg flex items-center justify-center border border-border bg-muted/35 hover:bg-muted/65 transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full ring-2 ring-card" />
            </button>

            <div className="flex items-center gap-2.5 ml-1 pl-3 border-l border-border cursor-pointer hover:opacity-85 transition-opacity">
              <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25">
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

          <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto pb-20 md:pb-6 relative z-10">
            <Outlet />
          </div>
        </main>

        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
