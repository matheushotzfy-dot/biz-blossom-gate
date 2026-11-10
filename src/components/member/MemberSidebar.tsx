import {
  Home,
  BookOpen,
  Award,
  Heart,
  MessageSquare,
  Headphones,
  Settings,
  LogOut,
  ChevronRight,
  Search,
  Zap,
} from "lucide-react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const MENU_ITEMS = [
  { title: "Dashboard", icon: Home, url: "/membros-area" },
  { title: "Minha Biblioteca", icon: BookOpen, url: "/membros-area/cursos" },
  { title: "Certificações", icon: Award, url: "/membros-area/certificados" },
  { title: "Favoritos", icon: Heart, url: "/membros-area/favoritos" },
];

const SECONDARY_ITEMS = [
  { title: "Comunidade", icon: MessageSquare, url: "/membros-area/comunidade" },
  { title: "Suporte", icon: Headphones, url: "/membros-area/suporte" },
];

export function MemberSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/membros-area/login");
  };

  const isLinkActive = (url: string) => {
    if (url === "/membros-area") return location.pathname === url;
    return location.pathname.startsWith(url);
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() || "M";
  const userName = user?.email?.split("@")[0] || "Membro";

  return (
    <aside className="w-[280px] h-screen bg-[#080808] border-r border-white/5 flex flex-col shrink-0 overflow-hidden hidden lg:flex sticky top-0">
      {/* Brand */}
      <div className="p-8">
        <Link to="/membros-area" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xl tracking-tighter transition-all group-hover:scale-110 shadow-[0_0_20px_rgba(var(--primary),0.3)]">
            H
          </div>
          <div>
            <h1 className="font-display font-black tracking-tighter text-white text-lg leading-none">
              Vemprapay
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mt-1">
              Members Area
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-4 py-4 space-y-8 overflow-y-auto no-scrollbar">
        {/* Main Menu */}
        <div className="space-y-1">
          <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-4">Plataforma</p>
          {MENU_ITEMS.map((item) => {
            const active = isLinkActive(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                  active 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                )}
              >
                <item.icon className={cn("h-5 w-5 transition-colors", active ? "text-primary-foreground" : "text-zinc-500 group-hover:text-zinc-200")} />
                <span className="font-bold text-[13px] tracking-tight">{item.title}</span>
                {active && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
              </Link>
            );
          })}
        </div>

        {/* Support Menu */}
        <div className="space-y-1">
          <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-4">Suporte & Social</p>
          {SECONDARY_ITEMS.map((item) => {
            const active = isLinkActive(item.url);
            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                  active 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                )}
              >
                <item.icon className={cn("h-5 w-5 transition-colors", active ? "text-primary-foreground" : "text-zinc-500 group-hover:text-zinc-200")} />
                <span className="font-bold text-[13px] tracking-tight">{item.title}</span>
              </Link>
            );
          })}
        </div>

        {/* Premium Upgrade / Status Card */}
        <div className="px-2 pt-4">
          <div className="bg-gradient-to-br from-zinc-900 to-black border border-white/5 rounded-2xl p-5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 h-24 w-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-700" />
            <div className="relative z-10">
              <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center mb-4">
                <Zap className="h-4 w-4 fill-current" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-1">Status Pro</p>
              <h4 className="text-white font-black tracking-tight mb-3">Acesso Vitalício</h4>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-4">
                <div className="h-full w-full bg-primary" />
              </div>
              <button className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[11px] font-black uppercase tracking-widest transition-colors border border-white/5">
                Ver Rewards
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / User */}
      <div className="p-4 border-t border-white/5 bg-black/20">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-sm font-black text-primary ring-1 ring-primary/20">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-white truncate leading-none mb-1">{userName}</p>
            <p className="text-[11px] text-zinc-500 truncate">{user?.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-400/5 transition-all"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
