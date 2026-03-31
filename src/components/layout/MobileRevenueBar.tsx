import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useProfile } from "@/hooks/useProfile";
import { Sun, Moon, Bell } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import hotzfyLogo from "@/assets/hotzfy-logo.png";

const fmtCompact = (v: number) => {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}K`;
  return `R$ ${v.toFixed(0)}`;
};

export function MobileRevenueBar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed").limit(1000)
      .then(({ data }) => {
        if (data) setRevenue(data.reduce((a, t) => a + Number(t.net_amount), 0));
        setLoading(false);
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
          {loading ? (
            <span className="h-3 w-12 rounded bg-primary/20 animate-pulse" />
          ) : (
            <span className="text-[12px] font-black font-numbers text-primary tracking-[-0.02em]">{fmtCompact(revenue)}</span>
          )}
        </div>

        {/* Avatar */}
        <button onClick={() => navigate("/perfil")} className="shrink-0">
          <Avatar className="h-8 w-8 ring-1 ring-border/40">
            <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
              {(profile?.full_name || "U").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>

        {/* Theme */}
        <button
          onClick={toggleTheme}
          className="h-8 w-8 rounded-xl flex items-center justify-center border border-border/60 bg-muted/30"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-warning" /> : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}
