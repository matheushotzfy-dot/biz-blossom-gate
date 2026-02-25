import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Sun, Moon, Bell } from "lucide-react";
import hotzfyLogo from "@/assets/hotzfy-logo.png";

const fmtCompact = (v: number) => {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}K`;
  return `R$ ${v.toFixed(0)}`;
};

export function MobileRevenueBar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed")
      .then(({ data }) => {
        if (data) setRevenue(data.reduce((a, t) => a + Number(t.net_amount), 0));
      });
  }, [user]);

  return (
    <div className="md:hidden sticky top-0 z-20 border-b border-border/80 bg-card/95 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img src={hotzfyLogo} alt="HOTZFY" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-[15px] font-display font-black text-foreground tracking-tight">HOTZFY</span>
        </div>

        <div className="flex-1" />

        {/* Revenue chip */}
        <div className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/8 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[12px] font-bold text-primary">{fmtCompact(revenue)}</span>
        </div>

        {/* Notification */}
        <button className="relative h-9 w-9 rounded-xl flex items-center justify-center border border-border/80 bg-muted/40">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full ring-2 ring-card" />
        </button>

        {/* Theme */}
        <button
          onClick={toggleTheme}
          className="h-9 w-9 rounded-xl flex items-center justify-center border border-border/80 bg-muted/40"
        >
          {theme === "dark" ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}
