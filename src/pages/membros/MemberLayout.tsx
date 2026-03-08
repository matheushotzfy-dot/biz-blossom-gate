import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogOut, Sparkles, Home, BookOpen, Menu, X, User as UserIcon } from "lucide-react";

export default function MemberLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => setMobileMenuOpen(false), [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/membros-area/login");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <div className="h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-zinc-600 text-xs">Carregando...</p>
      </div>
    </div>
  );

  const isHome = location.pathname === "/membros-area";
  const initial = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* ═══ Premium Nav ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#09090b]/90 backdrop-blur-2xl border-b border-zinc-800/40 shadow-xl shadow-black/20"
          : "bg-gradient-to-b from-black/70 via-black/30 to-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link to="/membros-area" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-shadow">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-extrabold tracking-tight">Área de Membros</span>
              </div>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              <Link to="/membros-area"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isHome ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}>
                <Home className="h-3.5 w-3.5" /> Início
              </Link>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* User info */}
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-800/40 border border-zinc-700/30">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/80 to-emerald-600/80 flex items-center justify-center text-[11px] font-bold text-white">
                  {initial}
                </div>
                <span className="text-[11px] text-zinc-400 max-w-[150px] truncate">{user?.email}</span>
              </div>

              <button onClick={handleLogout}
                className="h-9 w-9 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 flex items-center justify-center transition-all hover:scale-105 border border-zinc-700/20"
                title="Sair">
                <LogOut className="h-3.5 w-3.5 text-zinc-400" />
              </button>

              {/* Mobile menu */}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-9 w-9 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 flex items-center justify-center transition-all md:hidden border border-zinc-700/20">
                {mobileMenuOpen ? <X className="h-4 w-4 text-zinc-400" /> : <Menu className="h-4 w-4 text-zinc-400" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0e0e12]/98 backdrop-blur-2xl border-t border-zinc-800/40 animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              <Link to="/membros-area" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-800/40 transition-colors">
                <Home className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold">Início</span>
              </Link>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-800/20">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/80 to-emerald-600/80 flex items-center justify-center text-xs font-bold">{initial}</div>
                <div>
                  <p className="text-xs font-semibold">{user?.email}</p>
                  <p className="text-[10px] text-zinc-600">Membro ativo</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="pt-16 min-h-screen">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
