import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogOut, Sparkles, Home, Menu, X, Search } from "lucide-react";
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
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/12 flex items-center justify-center border border-primary/10">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-muted-foreground/40 text-xs font-display font-bold">Carregando...</p>
      </motion.div>
    </div>
  );

  const isHome = location.pathname === "/membros-area";
  const initial = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ═══ Glass Nav ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        scrolled
          ? "bg-background/80 backdrop-blur-2xl border-b border-border/30 shadow-[0_4px_30px_hsl(var(--background)/0.8)]"
          : "bg-gradient-to-b from-background/80 via-background/40 to-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link to="/membros-area" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/15 group-hover:shadow-primary/25 transition-all duration-300">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-display font-black tracking-[-0.03em] hidden sm:block">Área de Membros</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              <Link to="/membros-area"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-display font-bold transition-all duration-300 ${
                  isHome ? "bg-primary/8 text-foreground" : "text-muted-foreground/50 hover:text-foreground hover:bg-card/40"
                }`}>
                <Home className="h-3.5 w-3.5" /> Início
              </Link>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-card/30 backdrop-blur-xl border border-border/15">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-[11px] font-display font-black text-primary-foreground">
                  {initial}
                </div>
                <span className="text-[11px] text-muted-foreground/50 max-w-[150px] truncate font-display font-bold">{user?.email}</span>
              </div>

              <button onClick={handleLogout}
                className="h-9 w-9 rounded-xl bg-card/30 backdrop-blur-xl hover:bg-card/50 flex items-center justify-center transition-all duration-300 border border-border/15 hover:border-border/30"
                title="Sair">
                <LogOut className="h-3.5 w-3.5 text-muted-foreground/40" />
              </button>

              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-9 w-9 rounded-xl bg-card/30 backdrop-blur-xl hover:bg-card/50 flex items-center justify-center transition-all md:hidden border border-border/15">
                {mobileMenuOpen ? <X className="h-4 w-4 text-muted-foreground" /> : <Menu className="h-4 w-4 text-muted-foreground" />}
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
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden bg-card/95 backdrop-blur-2xl border-t border-border/20 overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
                <Link to="/membros-area" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/15 transition-colors">
                  <Home className="h-4 w-4 text-primary" />
                  <span className="text-sm font-display font-bold">Início</span>
                </Link>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/10">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xs font-display font-black text-primary-foreground">{initial}</div>
                  <div>
                    <p className="text-xs font-display font-bold">{user?.email}</p>
                    <p className="text-[10px] text-muted-foreground/40 font-display font-bold">Membro ativo</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Content */}
      <main className="pt-16 min-h-screen">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
