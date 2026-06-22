/**
 * MemberLayout — Cinematic Noir
 * Minimal floating top nav, transparent over hero, solid on scroll.
 * No sidebar. No chrome. The content is the experience.
 */
import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogOut, Search, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MemberSidebar } from "@/components/member/MemberSidebar";


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
    <div className="min-h-dvh bg-[#050505] text-zinc-100 font-display antialiased selection:bg-emerald-500/30 flex">
      {!isCourse && <MemberSidebar />}

      <div className="flex-1 flex flex-col relative overflow-x-hidden">
        {/* Top cinematic bar — only shows when not in course player (which has its own header) */}
        {!isCourse && (
          <header className={cn(
            "h-20 shrink-0 flex items-center justify-between px-6 lg:px-10 z-40 transition-all duration-500 sticky top-0",
            scrolled ? "bg-[#050505]/80 backdrop-blur-2xl border-b border-white/[0.05]" : "bg-transparent"
          )}>
            <div className="flex-1 max-w-2xl relative group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-primary" />
              <input 
                type="text" 
                placeholder="Pesquisar por cursos, aulas ou materiais..."
                className="w-full h-11 bg-white/[0.03] border border-white/5 rounded-xl pl-12 pr-4 text-sm font-medium text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 transition-all focus:bg-white/[0.05]"
              />
            </div>

            <div className="flex items-center gap-6 ml-auto">
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Pontos XP</p>
                <p className="text-sm font-bold text-emerald-400 tabular-nums">{stats.xp.toLocaleString("pt-BR")}</p>
              </div>
              <div className="h-10 w-px bg-white/5 hidden sm:block" />
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end hidden xs:flex">
                  <p className="text-[12px] font-bold text-white leading-none">{displayName}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">Membro Premium</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}
                  className="h-10 w-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center font-bold text-sm text-zinc-200 hover:border-primary/40 transition-all relative"
                >
                  {initial}
                  <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#050505] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-10 top-24 w-72 rounded-2xl bg-[#0c0c0c] border border-white/10 shadow-2xl overflow-hidden z-50 p-2"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-white/5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-bold mb-1">Conta Hotzfy</p>
                    <p className="font-bold text-white truncate">{displayName}</p>
                  </div>
                  <div className="py-2">
                    <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-zinc-400 hover:text-white">
                      <Settings className="h-4 w-4" />
                      <span className="text-[13px] font-bold">Configurações</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-400/5 rounded-xl transition-colors text-zinc-400 hover:text-red-400"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="text-[13px] font-bold">Sair da conta</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </header>
        )}

        <main className={cn("flex-1", !isCourse && "px-6 lg:px-10 pb-20")}>
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}

