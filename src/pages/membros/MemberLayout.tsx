import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogOut, Sparkles, Search, Bell } from "lucide-react";

export default function MemberLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

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
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/membros-area/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Netflix-style top nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0a0a0a]/95 backdrop-blur-xl shadow-lg shadow-black/30" : "bg-gradient-to-b from-black/80 to-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/membros-area" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight hidden sm:block">Área de Membros</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 hidden sm:block">{user?.email}</span>
            <button onClick={handleLogout} className="h-8 w-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 flex items-center justify-center transition-colors" title="Sair">
              <LogOut className="h-3.5 w-3.5 text-zinc-400" />
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-16 min-h-screen">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
