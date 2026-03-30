import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogOut, Sparkles, Home, Menu, X } from "lucide-react";

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
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-muted-foreground text-xs">Carregando...</p>
      </div>
    </div>
  );

  const isHome = location.pathname === "/membros-area";
  const initial = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ═══ Premium Nav ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-background/90 backdrop-blur-2xl border-b border-border/40 shadow-xl shadow-background/20"
          : "bg-gradient-to-b from-background/70 via-background/30 to-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link to="/membros-area" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-shadow">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-display font-black tracking-[-0.03em]">Área de Membros</span>
              </div>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              <Link to="/membros-area"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isHome ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                }`}>
                <Home className="h-3.5 w-3.5" /> Início
              </Link>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* User info */}
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-muted/30 border border-border/30">
                <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground">
                  {initial}
                </div>
                <span className="text-[11px] text-muted-foreground max-w-[150px] truncate">{user?.email}</span>
              </div>

              <button onClick={handleLogout}
                className="h-9 w-9 rounded-xl bg-muted/40 hover:bg-muted/60 flex items-center justify-center transition-all hover:scale-105 border border-border/20"
                title="Sair">
                <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {/* Mobile menu */}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-9 w-9 rounded-xl bg-muted/40 hover:bg-muted/60 flex items-center justify-center transition-all md:hidden border border-border/20">
                {mobileMenuOpen ? <X className="h-4 w-4 text-muted-foreground" /> : <Menu className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-card/98 backdrop-blur-2xl border-t border-border/40 animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              <Link to="/membros-area" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/30 transition-colors">
                <Home className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Início</span>
              </Link>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/20">
                <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">{initial}</div>
                <div>
                  <p className="text-xs font-semibold">{user?.email}</p>
                  <p className="text-[10px] text-muted-foreground">Membro ativo</p>
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
