import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useProfile } from "@/hooks/useProfile";
import { NotificationPanel, useNotificationCount } from "@/components/NotificationPanel";
import { Sun, Moon, Bell, Search } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
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
 const unreadCount = useNotificationCount();
 const [revenue, setRevenue] = useState(0);
 const [loading, setLoading] = useState(true);
 const [notifOpen, setNotifOpen] = useState(false);
 const [searchOpen, setSearchOpen] = useState(false);

 useEffect(() => {
 if (!user) return;
 supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed").limit(1000)
 .then(({ data }) => {
 if (data) setRevenue(data.reduce((a, t) => a + Number(t.net_amount), 0));
 setLoading(false);
 });
 }, [user]);

 return (
 <>
 <div className="md:hidden sticky top-0 z-20 border-b border-border/50 bg-background/85 backdrop-blur-2xl">
 <div className="flex items-center gap-2 px-3 py-2.5">
 {/* Logo */}
 <div className="flex items-center gap-2 shrink-0">
 <img src={hotzfyLogo} alt="HOTZFY" className="h-7 w-7 rounded-lg object-contain" />
 <span className="text-sm font-display font-black text-foreground tracking-tight">HOTZFY</span>
 </div>

 <div className="flex-1" />

 {/* Revenue chip */}
 <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1">
 <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
 {loading ? (
 <span className="h-3 w-10 rounded bg-primary/20 animate-pulse" />
 ) : (
 <span className="text-[11px] font-black font-numbers text-primary tabular-nums">{fmtCompact(revenue)}</span>
 )}
 </div>

 {/* Search */}
 <button
 onClick={() => setSearchOpen(true)}
 className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/30 active:scale-95 transition-transform"
 >
 <Search className="h-3.5 w-3.5 text-muted-foreground" />
 </button>

 {/* Notifications */}
 <button
 onClick={() => setNotifOpen(!notifOpen)}
 className="relative h-8 w-8 rounded-full flex items-center justify-center bg-muted/30 active:scale-95 transition-transform"
 >
 <Bell className="h-3.5 w-3.5 text-muted-foreground" />
 {unreadCount > 0 && (
 <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 bg-primary rounded-full ring-2 ring-background flex items-center justify-center text-[8px] font-bold text-primary-foreground">
 {unreadCount > 9 ? "9+" : unreadCount}
 </span>
 )}
 </button>

 {/* Avatar */}
 <button onClick={() => navigate("/perfil")} className="shrink-0 active:scale-95 transition-transform">
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
 className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/30 active:scale-95 transition-transform"
 >
 {theme === "dark" ? <Sun className="h-3.5 w-3.5 text-warning" /> : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
 </button>
 </div>
 </div>

 <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
 <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
 </>
 );
}
