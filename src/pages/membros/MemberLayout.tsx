/**
 * Moldura da área do aluno: exige sessão, mantém o tema escuro e mostra a barra do topo
 * (menos no player, que tem a própria). O contexto do <Outlet> leva o usuário e o primeiro nome.
 */
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { Award, BookOpen, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMemberSkin } from "@/hooks/useMemberSkin";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type MemberOutletContext = { user: User; name: string };

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn("inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-3 text-[14.5px] font-semibold transition-colors sm:px-4", isActive ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground");

export default function MemberLayout() {
  useMemberSkin();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/membros-area/login", { replace: true }); return; }
      setUser(session.user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { navigate("/membros-area/login", { replace: true }); return; }
      setUser(session.user);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const profile = useQuery({
    queryKey: ["member-profile", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, nickname").eq("user_id", (user as User).id).maybeSingle();
      return data;
    },
  });

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch { /* sem rede: a sessão local já foi descartada */ }
    queryClient.clear();
    navigate("/membros-area/login", { replace: true });
  };

  if (loading || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10" role="status" aria-label="Carregando">
          <div className="h-full w-1/2 animate-[member-load_1.2s_ease-in-out_infinite] rounded-full bg-primary motion-reduce:animate-none" />
        </div>
        <style>{"@keyframes member-load{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}"}</style>
      </div>
    );
  }

  const isCourse = location.pathname.includes("/curso/");
  const full = profile.data?.full_name?.trim() || profile.data?.nickname?.trim() || "";
  const email = user.email ?? "";
  const first = (full.split(/\s+/)[0] || email.split("@")[0] || "aluno");
  const name = first.charAt(0).toUpperCase() + first.slice(1);
  const ctx: MemberOutletContext = { user, name };

  if (isCourse) {
    return <div className="min-h-dvh bg-background text-foreground antialiased"><Outlet context={ctx} /></div>;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link to="/membros-area" className="mr-2 flex items-center gap-2.5" aria-label="Área de membros, início">
            <VenxpayLogo size={30} />
            <span className="hidden text-[16px] font-extrabold tracking-[-0.02em] sm:inline">Área de membros</span>
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1">
            <NavLink to="/membros-area" end className={navClass}><BookOpen className="hidden h-4 w-4 sm:block" aria-hidden /> Meus cursos</NavLink>
            <NavLink to="/membros-area#certificados" className={() => navClass({ isActive: false })}><Award className="hidden h-4 w-4 sm:block" aria-hidden /> Certificados</NavLink>
          </nav>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Minha conta" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-[15px] font-extrabold text-foreground transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {name.charAt(0)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" collisionPadding={16} className="w-64 rounded-[16px] p-1.5">
                <DropdownMenuLabel className="px-3 py-2.5">
                  <span className="block truncate text-[15px] font-bold text-foreground">{full || name}</span>
                  <span className="block truncate text-[13px] font-normal text-muted-foreground">{email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()} className="cursor-pointer gap-2.5 rounded-[12px] px-3 py-2.5 text-[14.5px] font-semibold">
                  <LogOut className="h-4 w-4" aria-hidden /> Sair da conta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        <Outlet context={ctx} />
      </main>
    </div>
  );
}
