import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Sun, Moon, Rocket } from "lucide-react";

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
    <div className="md:hidden sticky top-0 z-20 bg-card/95 backdrop-blur-xl border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 mr-1">
          <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center">
            <Rocket className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-display font-extrabold text-foreground tracking-tight">HOTZFY</span>
        </div>

        <div className="flex-1 min-w-0 text-right">
          <span className="text-xs font-bold text-foreground">{fmtCompact(revenue)}</span>
          <span className="text-[10px] text-muted-foreground ml-1">receita</span>
        </div>

        <button
          onClick={toggleTheme}
          className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-warning" /> : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}
