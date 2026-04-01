import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogOut, Sparkles, Home, Menu, X, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-xl shadow-primary/10">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm font-display font-bold tracking-tight">Carregando...</p>
      </motion.div>
    </div>
  );

  const isHome = location.pathname === "/membros-area";
  const initial = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ═══ Premium Glass Nav ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        scrolled
          ? "bg-background/85 backdrop-blur-2xl border-b border-border/40 shadow-[0_1px_40px_hsl(var(--background)/0.6)]"
          : "bg-gradient-to-b from-background/90 via-background/50 to-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="h-[68px] flex items-center justify-between">
            {/* Logo */}
            <Link to="/membros-area" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 group-hover:scale-[1.04] transition-all duration-300 border border-primary/20">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <span className="text-base font-display font-black tracking-[-0.04em] text-foreground">Área de Membros</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1.5">
              <Link to="/membros-area"
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-display font-bold transition-all duration-300 ${
                  isHome
                    ? "bg-primary/10 text-primary border border-primary/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}>
                <Home className="h-4 w-4" /> Início
              </Link>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* User pill */}
              <div className="hidden sm:flex items-center gap-3 pl-3 pr-4 py-2 rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 hover:border-border/30 transition-all duration-300">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary via-primary to-primary/60 flex items-center justify-center text-xs font-display font-black text-primary-foreground shadow-sm">
                  {initial}
                </div>
                <span className="text-sm text-foreground/70 max-w-[180px] truncate font-display font-semibold">{user?.email}</span>
              </div>

              <button onClick={handleLogout}
                className="h-10 w-10 rounded-xl bg-card/50 backdrop-blur-xl hover:bg-destructive/10 hover:border-destructive/20 flex items-center justify-center transition-all duration-300 border border-border/20 group"
                title="Sair">
                <LogOut className="h-4 w-4 text-muted-foreground group-hover:text-destructive transition-colors" />
              </button>

              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-10 w-10 rounded-xl bg-card/50 backdrop-blur-xl hover:bg-card/70 flex items-center justify-center transition-all md:hidden border border-border/20">
                {mobileMenuOpen ? <X className="h-4.5 w-4.5 text-foreground" /> : <Menu className="h-4.5 w-4.5 text-foreground" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden bg-card/95 backdrop-blur-2xl border-t border-border/20 overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-5 py-4 space-y-2">
                <Link to="/membros-area" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-muted/10 transition-all active:scale-[0.98]">
                  <Home className="h-5 w-5 text-primary" />
                  <span className="text-base font-display font-bold">Início</span>
                </Link>
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted/8 border border-border/10">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-sm font-display font-black text-primary-foreground shadow-sm">{initial}</div>
                  <div>
                    <p className="text-sm font-display font-bold text-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground font-display">Membro ativo</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-destructive/5 transition-all w-full text-left active:scale-[0.98]">
                  <LogOut className="h-5 w-5 text-destructive/60" />
                  <span className="text-base font-display font-bold text-destructive/70">Sair da conta</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Content */}
      <main className="pt-[68px] min-h-screen">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
