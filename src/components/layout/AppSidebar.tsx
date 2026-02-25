import {
  LayoutDashboard,
  BarChart3,
  Package,
  CreditCard,
  GraduationCap,
  Layers,
  Ticket,
  FileText,
  ArrowDownToLine,
  Building2,
  PieChart,
  Webhook,
  Puzzle,
  BookOpen,
  UserCircle,
  User,
  LogOut,
  ChevronRight,
  Trophy,
  Headphones,
  Flame,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import hotzfyLogo from "@/assets/hotzfy-logo.png";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const MILESTONES = [
  { label: "R$ 0", value: 0 },
  { label: "R$ 10K", value: 10000 },
  { label: "R$ 100K", value: 100000 },
  { label: "R$ 500K", value: 500000 },
  { label: "R$ 1M", value: 1000000 },
  { label: "R$ 5M", value: 5000000 },
];

function getMilestone(revenue: number) {
  let current = MILESTONES[0];
  let next = MILESTONES[1];
  for (let i = 0; i < MILESTONES.length - 1; i++) {
    if (revenue >= MILESTONES[i].value) {
      current = MILESTONES[i];
      next = MILESTONES[i + 1];
    }
  }
  const range = next.value - current.value;
  const pct = range > 0 ? Math.min(((revenue - current.value) / range) * 100, 100) : 100;
  return { current, next, pct, tier: MILESTONES.indexOf(current) };
}

const fmtCompact = (v: number) => {
  if (v === 0) return "R$ 0";
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}K`;
  return `R$ ${v.toFixed(0)}`;
};

const sections = [
  {
    label: "COMANDO",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, badge: "Live" },
      { title: "Minhas Vendas", url: "/vendas", icon: BarChart3 },
    ],
  },
  {
    label: "INFOPRODUTOS",
    items: [
      { title: "Produtos", url: "/vendas/produtos", icon: Package },
      { title: "Checkout", url: "/vendas/checkout", icon: CreditCard },
      { title: "Área de Membros", url: "/membros", icon: GraduationCap },
      { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
      { title: "Cupons", url: "/vendas/cupons", icon: Ticket },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
      { title: "Saques", url: "/financeiro/saques", icon: ArrowDownToLine },
      { title: "Dados Bancários", url: "/financeiro/dados-bancarios", icon: Building2 },
      { title: "Controle de Gastos", url: "/financeiro/gastos", icon: PieChart },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { title: "Webhooks", url: "/vendas/webhooks", icon: Webhook },
      { title: "Integrações", url: "/integracoes/apps", icon: Puzzle },
      { title: "API Docs", url: "/vendas/documentacao", icon: BookOpen },
      { title: "Identidade", url: "/financeiro/identidade", icon: UserCircle },
      { title: "Meu Perfil", url: "/perfil", icon: User },
    ],
  },
] as const;

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user } = useAuth();
  const [revenue, setRevenue] = useState(0);
  const [profile, setProfile] = useState<Tables<"profiles"> & { nickname?: string } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed"),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    ]).then(([txRes, profileRes]) => {
      if (txRes.data) setRevenue(txRes.data.reduce((s, t) => s + Number(t.net_amount), 0));
      if (profileRes.data) setProfile(profileRes.data as any);
    });
  }, [user?.id]);

  const milestone = useMemo(() => getMilestone(revenue), [revenue]);
  const displayName = (profile as any)?.nickname || profile?.full_name?.split(" ")[0] || "Seller";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Sidebar className="border-r-2 border-sidebar-border/80 bg-sidebar/95 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-20 h-80 w-80 rounded-full bg-sidebar-primary/12 blur-[90px]" />
        <div className="absolute bottom-6 -right-10 h-64 w-64 rounded-full bg-sidebar-primary/10 blur-[84px]" />
      </div>

      <SidebarHeader className="relative px-4 pt-5 pb-4 border-b-2 border-sidebar-border/80">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center") }>
          <div className="h-14 w-14 rounded-2xl overflow-hidden shadow-lg shadow-sidebar-primary/25 ring-2 ring-sidebar-primary/30 shrink-0 bg-card">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain" />
          </div>

          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-[30px] leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">HOTZFY</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sidebar-foreground mt-1">Infoprodutos Ecosystem</p>
          </div>
        </div>

        {/* Milestone Progress with flame effect */}
        <div className="mt-4 group-data-[collapsible=icon]:hidden">
          <div className="rounded-xl border-2 border-sidebar-primary/25 bg-sidebar-primary/[0.08] px-3.5 py-3 relative overflow-hidden">
            {/* Subtle flame glow behind progress */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-sidebar-primary/10 to-transparent" />
            </div>
            
            <div className="relative flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-sidebar-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/80">{displayName}</span>
              </div>
              <span className="text-[10px] font-black text-sidebar-primary">{fmtCompact(revenue)}</span>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-sidebar-foreground/60">{milestone.current.label}</span>
              <span className="text-[11px] font-black text-sidebar-primary">{milestone.next.label}</span>
            </div>
            
            {/* Progress bar with flame */}
            <div className="relative h-3 w-full rounded-full bg-sidebar-accent/60 overflow-visible">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sidebar-primary/80 to-sidebar-primary transition-all duration-700"
                style={{ width: `${milestone.pct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sidebar-primary/40 to-sidebar-primary/60 blur-sm"
                style={{ width: `${milestone.pct}%` }}
              />
              {/* Flame tip on progress edge */}
              {milestone.pct > 0 && (
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-6"
                  style={{ left: `calc(${milestone.pct}% - 8px)` }}
                >
                  <div className="w-full h-full relative">
                    <div className="absolute inset-0 rounded-full bg-sidebar-primary/80 blur-[3px] animate-pulse" />
                    <Flame className="absolute -top-2 left-0 h-4 w-4 text-sidebar-primary animate-pulse" />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[9px] font-bold text-sidebar-foreground/60">Progresso</span>
              <span className="text-[10px] font-black text-sidebar-primary">{milestone.pct.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative px-2.5 py-4 overflow-y-auto">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={cn("px-0", idx > 0 && "mt-3.5")}>
            <SidebarGroupLabel className="px-3.5 mb-2 text-[10px] uppercase tracking-[0.22em] font-bold text-sidebar-foreground/75 group-data-[collapsible=icon]:hidden">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1.5 px-1">
                {section.items.map((item) => {
                  const isActive = item.url === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(item.url);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="h-auto p-0 hover:bg-transparent active:bg-transparent">
                        <NavLink
                          to={item.url}
                          end={item.url === "/dashboard"}
                          activeClassName=""
                          className={cn(
                            "group/nav relative flex items-center gap-3 rounded-2xl border px-3.5 py-3.5 text-[16px] font-semibold leading-none transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                            isActive
                              ? "border-sidebar-primary/35 bg-sidebar-accent text-sidebar-accent-foreground shadow-lg shadow-sidebar-primary/10"
                              : "border-transparent text-sidebar-foreground hover:border-sidebar-border hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary group-data-[collapsible=icon]:hidden" />
                          )}

                          <span
                            className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                              isActive
                                ? "bg-sidebar-primary/15 text-sidebar-primary"
                                : "bg-sidebar-accent/45 text-sidebar-foreground group-hover/nav:bg-sidebar-accent group-hover/nav:text-sidebar-accent-foreground",
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                          </span>

                          <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>

                          {item.badge && (
                            <span className="ml-auto rounded-md bg-sidebar-primary/15 px-2 py-0.5 text-[10px] font-bold text-sidebar-primary group-data-[collapsible=icon]:hidden">
                              {item.badge}
                            </span>
                          )}

                          {isActive && <ChevronRight className="h-4 w-4 text-sidebar-primary/65 group-data-[collapsible=icon]:hidden" />}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="relative p-3 border-t-2 border-sidebar-border/80">
        <button
          onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
          className="mb-2 w-full flex items-center gap-2.5 rounded-2xl border-2 border-sidebar-primary/20 bg-sidebar-primary/[0.09] p-3.5 text-left transition-all hover:bg-sidebar-primary/[0.15] hover:border-sidebar-primary/30 group-data-[collapsible=icon]:hidden"
        >
          <div className="h-8 w-8 rounded-xl bg-sidebar-primary/15 flex items-center justify-center shrink-0">
            <Headphones className="h-4 w-4 text-sidebar-primary" />
          </div>
          <div>
            <span className="text-[12px] font-black text-sidebar-accent-foreground block">Solicitar Suporte</span>
            <span className="text-[10px] text-sidebar-foreground/70">Para escalar seu negócio</span>
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold text-sidebar-foreground/85 transition-all hover:bg-destructive/[0.1] hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span className="group-data-[collapsible=icon]:hidden">Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
