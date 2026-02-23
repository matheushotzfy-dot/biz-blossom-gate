import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Sun, Moon } from "lucide-react";

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

export function MobileRevenueBar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("transactions").select("amount").eq("user_id", user.id).eq("status", "completed")
      .then(({ data }) => {
        if (data) setRevenue(data.reduce((a, t) => a + Number(t.amount), 0));
      });
  }, [user]);

  const milestone = getCurrentMilestone(revenue);

  return (
    <div className="md:hidden sticky top-0 z-20 bg-background border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-3">
        {/* Progress section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-foreground">{fmtCompact(revenue)}</span>
            <span className="text-[10px] font-medium text-muted-foreground">Meta: {milestone.next.label}</span>
          </div>
          <div className="w-full rounded-full h-2 bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000"
              style={{ width: `${Math.max(milestone.pct, 2)}%` }}
            />
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
          aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-yellow-400" />
          ) : (
            <Moon className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}
