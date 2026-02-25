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
          <header className="h-16 hidden md:flex items-center border-b border-border px-6 bg-card/80 backdrop-blur-2xl sticky top-0 z-20 gap-4">
            <SidebarTrigger className="mr-1 lg:hidden">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>

            {/* Search */}
            <div className="flex items-center gap-2.5 px-4 h-10 rounded-xl border border-border bg-muted/40 text-muted-foreground w-full max-w-[380px] cursor-pointer hover:border-primary/20 transition-colors">
              <Search className="h-4 w-4" />
              <span className="text-[13px] flex-1">Buscar produtos, clientes, transações…</span>
              <div className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Command className="h-3 w-3" /> K
              </div>
            </div>

            <div className="flex-1" />

            {/* Actions */}
            <button
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl flex items-center justify-center border border-border bg-card hover:bg-muted/60 hover:border-primary/15 transition-all"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            </button>

            <button className="relative h-10 w-10 rounded-xl flex items-center justify-center border border-border bg-card hover:bg-muted/60 hover:border-primary/15 transition-all">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full ring-2 ring-card" />
            </button>

            {/* Profile */}
            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-border cursor-pointer hover:opacity-85 transition-opacity">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/15">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:block">
                <p className="text-sm font-semibold leading-none text-foreground">{profile?.full_name || "Usuário"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{profile?.email || ""}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden xl:block" />
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
