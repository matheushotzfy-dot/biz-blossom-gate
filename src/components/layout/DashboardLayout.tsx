import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileRevenueBar } from "./MobileRevenueBar";
import { Outlet } from "react-router-dom";
import { Menu, Bell, Search, Command, Trophy, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";

const MILESTONES = [
  { label: "R$ 0", value: 0 },
  { label: "R$ 10K", value: 10000 },
  { label: "R$ 100K", value: 100000 },
  { label: "R$ 500K", value: 500000 },
  { label: "R$ 1M", value: 1000000 },
  { label: "R$ 5M", value: 5000000 },
];

function getCurrentMilestone(revenue: number) {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (revenue >= MILESTONES[i].value) {
      const next = MILESTONES[i + 1] || MILESTONES[i];
      const prev = MILESTONES[i];
      const pct = next.value === prev.value ? 100 : ((revenue - prev.value) / (next.value - prev.value)) * 100;
      return { current: prev, next, pct: Math.min(pct, 100) };
    }
  }
  return { current: MILESTONES[0], next: MILESTONES[1], pct: (revenue / MILESTONES[1].value) * 100 };
}

const fmtCompact = (v: number) => {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}K`;
  return `R$ ${v.toFixed(0)}`;
};

export function DashboardLayout() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [allTimeRevenue, setAllTimeRevenue] = useState(0);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    supabase.from("profiles").select("*").eq("user_id", uid).single()
      .then(({ data }) => { if (data) setProfile(data); });
    supabase.from("transactions").select("net_amount").eq("user_id", uid).eq("status", "completed")
      .then(({ data }) => {
        if (data) setAllTimeRevenue(data.reduce((a, t) => a + Number(t.net_amount), 0));
      });
  }, [user]);

  const milestone = getCurrentMilestone(allTimeRevenue);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen">
          {/* Desktop header */}
          <header className="h-16 hidden md:flex items-center border-b border-border px-4 md:px-6 bg-background/60 backdrop-blur-2xl sticky top-0 z-10 gap-3">
            <SidebarTrigger className="mr-2 lg:hidden">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9 h-9 bg-muted/50 border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/30 transition-all" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground/50 text-[10px]">
                <Command className="h-3 w-3" />K
              </div>
            </div>

            <div className="flex-1" />

            {/* Milestone Progress Bar */}
            <div className="flex items-center gap-2.5 bg-muted/50 border border-border rounded-xl px-3 py-1.5 min-w-[220px]">
              <Trophy className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold text-foreground/90">{fmtCompact(allTimeRevenue)}</span>
                  <span className="text-[10px] font-bold text-muted-foreground">/ {milestone.next.label}</span>
                </div>
                <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: "var(--bar-track)" }}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-1000 relative"
                    style={{ width: `${Math.max(milestone.pct, 2)}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/30 animate-shimmer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl hover:bg-muted/80 transition-colors"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-yellow-400" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <button className="relative p-2.5 rounded-xl hover:bg-muted/80 transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full shadow-[0_0_8px_hsl(152,68%,46%,0.6)]" />
            </button>

            <div className="flex items-center gap-3 ml-2 pl-3 border-l border-border">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary shadow-[0_0_12px_hsl(152,68%,46%,0.15)]">
                {(profile?.full_name || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold leading-none text-foreground">{profile?.full_name || "Usuário"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{profile?.email || ""}</p>
              </div>
            </div>
          </header>

          {/* Mobile revenue bar */}
          <MobileRevenueBar />

          <div className="flex-1 p-3 md:p-6 overflow-auto pb-20 md:pb-6">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
