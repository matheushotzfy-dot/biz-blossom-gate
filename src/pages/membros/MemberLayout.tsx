/**
 * MemberLayout — Cinematic Noir
 * Minimal floating top nav, transparent over hero, solid on scroll.
 * No sidebar. No chrome. The content is the experience.
 */
import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function MemberLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [stats, setStats] = useState<{ xp: number; streak: number }>({ xp: 0, streak: 0 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/membros-area/login", { replace: true }); return; }
      setUser(session.user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) { navigate("/membros-area/login", { replace: true }); return; }
      setUser(session.user);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Lightweight stats (XP = lessons completed * 50, streak = consecutive days with progress)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_progress")
        .select("completed, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (!data) return;
      const completed = data.filter(d => d.completed).length;
      const days = new Set(data.map(d => new Date(d.updated_at).toDateString()));
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 60; i++) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        if (days.has(d.toDateString())) streak++;
        else if (i > 0) break;
      }
      setStats({ xp: completed * 50, streak });
    })();
  }, [user]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => { setProfileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = () => setProfileOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [profileOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/membros-area/login");
  };

  if (loading) return (
    <div className="min-h-dvh bg-[#050505] flex items-center justify-center">
      <div className="h-1 w-32 bg-white/5 overflow-hidden">
        <motion.div
          className="h-full w-full bg-emerald-500"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );

  const isCourse = location.pathname.includes("/curso/");
  const initial = user?.email?.charAt(0).toUpperCase() || "U";
  const displayName = user?.email?.split("@")[0] || "Membro";

  return (
    <div className="min-h-dvh bg-[#050505] text-zinc-100 font-display antialiased selection:bg-emerald-500/30">
      {/* Floating cinematic nav */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-700",
        scrolled || isCourse
          ? "bg-[#050505]/85 backdrop-blur-2xl border-b border-white/[0.03] py-2"
          : "bg-gradient-to-b from-black/80 via-black/40 to-transparent py-4"
      )}>
        <div className="px-6 lg:px-16 h-16 flex items-center justify-between gap-4 max-w-[1800px] mx-auto">
          {/* Logo — Hotzfy Premium */}
          <Link to="/membros-area" className="flex items-center gap-3 shrink-0 group">
            <div className="h-10 w-10 rounded-lg bg-white text-[#050505] flex items-center justify-center font-black text-xl tracking-tighter transition-transform group-hover:scale-110">
              H
            </div>
            <span className="font-display font-black tracking-[-0.04em] text-white text-lg lg:text-xl uppercase">
              Hotzfy <span className="text-zinc-500 font-medium">Members</span>
            </span>
          </Link>

          {/* Right: avatar only */}
          <div className="flex items-center gap-3">
            {/* Profile */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}
                className="h-9 w-9 rounded-full bg-zinc-900 border border-white/10 hover:border-emerald-500/40 flex items-center justify-center font-display text-sm font-semibold text-zinc-200 transition-colors"
              >
                {initial}
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-[calc(100%+10px)] w-72 rounded-sm bg-[#0c0c0c] border border-white/10 overflow-hidden"
                  >
                    <div className="p-5 border-b border-white/5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-bold mb-1">Conectado como</p>
                      <p className="font-display font-semibold text-zinc-100 truncate">{displayName}</p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{user?.email}</p>
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-3 border-b border-white/5">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 font-bold">XP</p>
                        <p className="font-mono text-emerald-400 tabular-nums text-sm mt-1">{stats.xp.toLocaleString("pt-BR")}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 font-bold">Streak</p>
                        <p className="font-mono text-orange-400 tabular-nums text-sm mt-1">{stats.streak}d</p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-5 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm font-medium text-zinc-300">Sair</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </nav>

      <main className={cn(isCourse ? "pt-0" : "")}>
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
