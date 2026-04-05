import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogOut, Home, Menu, X, GraduationCap, Search, Bell, ChevronRight, Bookmark, Settings, User as UserIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function MemberLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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

  useEffect(() => { setMobileMenuOpen(false); setProfileOpen(false); }, [location.pathname]);

  // Close profile dropdown on outside click
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-2xl shadow-primary/10">
            <GraduationCap className="h-7 w-7 text-primary/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm font-display font-bold tracking-tight">Carregando...</p>
      </motion.div>
    </div>
  );

  const isHome = location.pathname === "/membros-area";
  const isCourse = location.pathname.includes("/curso/");
  const initial = user?.email?.charAt(0).toUpperCase() || "U";
  const displayName = user?.email?.split("@")[0] || "Membro";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ═══ Premium Glass Nav ═══ */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        scrolled
          ? "bg-background/90 backdrop-blur-2xl border-b border-border/30 shadow-[0_4px_30px_hsl(var(--background)/0.5)]"
          : "bg-gradient-to-b from-background/95 via-background/60 to-transparent",
        isCourse && "bg-background/95 backdrop-blur-2xl border-b border-border/20"
      )}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/membros-area" className="flex items-center gap-2.5 group shrink-0">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 group-hover:scale-105 transition-all duration-300 border border-primary/20">
                <GraduationCap className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <span className="hidden sm:block text-sm font-display font-black tracking-[-0.03em] text-foreground">
                Membros
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              <NavItem to="/membros-area" active={isHome} icon={<Home className="h-4 w-4" />} label="Início" />
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}
                  className={cn(
                    "flex items-center gap-2.5 h-9 pl-1 pr-3 rounded-full transition-all duration-300 border",
                    profileOpen
                      ? "bg-card border-border/40"
                      : "bg-card/40 border-border/15 hover:bg-card/60 hover:border-border/30"
                  )}
                >
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary via-primary to-primary/50 flex items-center justify-center text-[11px] font-display font-black text-primary-foreground shadow-sm">
                    {initial}
                  </div>
                  <span className="hidden sm:block text-xs text-foreground/70 font-display font-semibold max-w-[120px] truncate">
                    {displayName}
                  </span>
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl bg-card/95 backdrop-blur-2xl border border-border/30 shadow-2xl shadow-background/50 overflow-hidden"
                    >
                      {/* User info */}
                      <div className="p-4 border-b border-border/15">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/50 flex items-center justify-center text-base font-display font-black text-primary-foreground shadow-md">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-display font-bold text-foreground truncate">{displayName}</p>
                            <p className="text-xs text-muted-foreground/60 truncate font-display">{user?.email}</p>
                          </div>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="p-2">
                        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-destructive/5 transition-all text-left group">
                          <LogOut className="h-4 w-4 text-destructive/50 group-hover:text-destructive transition-colors" />
                          <span className="text-sm font-display font-semibold text-destructive/60 group-hover:text-destructive transition-colors">Sair da conta</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile menu toggle */}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-9 w-9 rounded-xl bg-card/40 backdrop-blur-xl hover:bg-card/60 flex items-center justify-center transition-all md:hidden border border-border/15">
                {mobileMenuOpen ? <X className="h-4 w-4 text-foreground" /> : <Menu className="h-4 w-4 text-foreground" />}
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
              className="md:hidden bg-card/95 backdrop-blur-2xl border-t border-border/15 overflow-hidden"
            >
              <div className="max-w-[1440px] mx-auto px-4 py-3 space-y-1">
                <Link to="/membros-area" className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all active:scale-[0.98]",
                  isHome ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted/10"
                )}>
                  <Home className="h-5 w-5" />
                  <span className="text-sm font-display font-bold">Início</span>
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/5 transition-all w-full text-left">
                  <LogOut className="h-5 w-5 text-destructive/50" />
                  <span className="text-sm font-display font-bold text-destructive/60">Sair</span>
                </button>
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

/* ─── Nav Item ─── */
function NavItem({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display font-bold transition-all duration-300",
      active
        ? "bg-primary/10 text-primary border border-primary/12"
        : "text-muted-foreground hover:text-foreground hover:bg-card/40"
    )}>
      {icon} {label}
    </Link>
  );
}
