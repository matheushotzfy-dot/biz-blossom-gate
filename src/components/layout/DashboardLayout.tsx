import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet } from "react-router-dom";
import { Menu, Bell, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";

export function DashboardLayout() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full dark">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 flex items-center border-b border-border px-4 md:px-6 bg-card/80 backdrop-blur-sm sticky top-0 z-10 gap-3">
            <SidebarTrigger className="mr-2 lg:hidden">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>

            <div className="hidden md:flex relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9 h-9 bg-muted/50 border-border/50" />
            </div>

            <div className="flex-1" />

            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="h-4.5 w-4.5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />
            </button>

            <div className="flex items-center gap-2.5 ml-2 pl-3 border-l border-border">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium leading-none">{profile?.full_name || "Usuário"}</p>
                <p className="text-xs text-muted-foreground">{profile?.email || ""}</p>
              </div>
            </div>
          </header>
          <div className="flex-1 p-4 md:p-6 overflow-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
