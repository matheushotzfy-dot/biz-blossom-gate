import {
  LayoutDashboard,
  BarChart3,
  Package,
  CreditCard,
  GraduationCap,
  Bitcoin,
  Handshake,
  Users,
  Layers,
  Trophy,
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
  Headphones,
  Zap,
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
      { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
      { title: "Afiliados", url: "/vendas/afiliados", icon: Users },
      { title: "Coproduções", url: "/vendas/coproducoes", icon: Handshake },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
      { title: "Saques PIX", url: "/financeiro/saques", icon: ArrowDownToLine },
      { title: "Saques Crypto", url: "/financeiro/saques-crypto", icon: Bitcoin },
      { title: "Dados Bancários", url: "/financeiro/dados-bancarios", icon: Building2 },
      { title: "Taxas", url: "/financeiro/taxas", icon: Zap },
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
  {
    label: "COMPRAS",
    items: [
      { title: "Minhas Compras", url: "/membros", icon: GraduationCap },
      { title: "Premiações", url: "/premiacoes", icon: Trophy },
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

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("transactions")
      .select("net_amount")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .then(({ data }) => {
        if (data) setRevenue(data.reduce((s, t) => s + Number(t.net_amount), 0));
      });
  }, [user?.id]);

  const milestone = useMemo(() => getMilestone(revenue), [revenue]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60 bg-sidebar/95 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-sidebar-primary/10 to-transparent" />

      <SidebarHeader className="relative px-4 pt-5 pb-4 border-b border-sidebar-border/80">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center") }>
          <div className="h-14 w-14 rounded-2xl overflow-hidden shadow-lg shadow-sidebar-primary/25 ring-1 ring-sidebar-primary/30 shrink-0 bg-card">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain" />
          </div>

          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-[30px] leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">HOTZFY</h1>
          </div>
        </div>

        <div className="mt-4 group-data-[collapsible=icon]:hidden cursor-pointer" onClick={() => navigate("/premiacoes")}>
          <div className="relative rounded-2xl border border-sidebar-primary/20 bg-gradient-to-br from-sidebar-primary/[0.08] to-sidebar-accent/30 px-4 py-3.5 overflow-hidden group/milestone hover:border-sidebar-primary/35 hover:shadow-lg hover:shadow-sidebar-primary/8 active:scale-[0.985] transition-all duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]">
            {/* Ambient glow */}
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-sidebar-primary/15 rounded-full blur-2xl group-hover/milestone:bg-sidebar-primary/25 transition-all duration-700" />
            <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-sidebar-primary/10 rounded-full blur-xl" />

            {/* Flame icon */}
            <div className="relative flex items-center gap-2 mb-3">
              <div className="relative h-8 w-8 rounded-xl bg-sidebar-primary/15 flex items-center justify-center">
                <Zap className="h-4 w-4 text-sidebar-primary animate-pulse" />
                <div className="absolute inset-0 rounded-xl bg-sidebar-primary/10 animate-ping" style={{ animationDuration: '3s' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/50">Faturamento</p>
                <p className="text-[18px] font-black text-sidebar-accent-foreground leading-tight tracking-tight">
                  {revenue >= 1000000
                    ? `R$ ${(revenue / 1000000).toFixed(2).replace('.', ',')}M`
                    : revenue >= 1000
                    ? `R$ ${(revenue / 1000).toFixed(1).replace('.', ',')}K`
                    : `R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold text-sidebar-primary/80">{milestone.current.label}</span>
                <span className="text-[9px] font-bold text-sidebar-foreground/40">Meta: {milestone.next.label}</span>
              </div>
              <div className="relative h-2.5 w-full rounded-full bg-sidebar-accent/60 overflow-hidden">
                {/* Glow track */}
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-sidebar-primary via-sidebar-primary to-sidebar-primary/70 transition-all duration-1000 ease-out"
                  style={{ width: `${milestone.pct}%` }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_2s_infinite]" />
                </div>
                {/* Glow dot at end */}
                {milestone.pct > 3 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-sidebar-primary shadow-[0_0_10px_2px] shadow-sidebar-primary/50 border-2 border-sidebar/80 transition-all duration-1000"
                    style={{ left: `calc(${milestone.pct}% - 7px)` }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] font-extrabold text-sidebar-primary">
                  {milestone.pct.toFixed(0)}%
                </span>
              </div>
              <p className="text-center text-[9px] font-bold text-sidebar-primary/40 group-hover/milestone:text-sidebar-primary/70 mt-2.5 transition-colors">
                Ver Premiações
              </p>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative gap-0 px-2.5 py-3 overflow-y-auto">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className="px-0 py-0">
            {idx > 0 && <div className="mx-4 my-3 border-t border-sidebar-border/20 group-data-[collapsible=icon]:mx-1" />}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1 px-1">
                {section.items.map((item) => {
                  const isActive = item.url === "/dashboard" || item.url === "/vendas"
                    ? location.pathname === item.url
                    : location.pathname.startsWith(item.url);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="h-auto p-0 hover:bg-transparent active:bg-transparent">
                        <NavLink
                          to={item.url}
                          end={item.url === "/dashboard" || item.url === "/vendas"}
                          activeClassName=""
                          className={cn(
                            "group/nav relative flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold leading-none transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.985] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                            isActive
                              ? "bg-gradient-to-r from-sidebar-primary/[0.12] to-sidebar-primary/[0.04] text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary shadow-[0_0_12px_2px] shadow-sidebar-primary/50 group-data-[collapsible=icon]:hidden" />
                          )}

                          <span
                            className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                              isActive
                                ? "bg-sidebar-primary/15 text-sidebar-primary shadow-lg shadow-sidebar-primary/10"
                                : "bg-sidebar-accent/30 text-sidebar-foreground/60 group-hover/nav:bg-sidebar-accent/50 group-hover/nav:text-sidebar-accent-foreground",
                            )}
                          >
                            <item.icon className={cn("h-[18px] w-[18px]", isActive && "drop-shadow-[0_0_4px_hsl(var(--sidebar-primary)/0.5)]")} />
                          </span>

                          <span className={cn("truncate group-data-[collapsible=icon]:hidden", isActive && "font-bold")}>{item.title}</span>

                          {item.badge && (
                            <span className={cn(
                              "ml-auto rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide group-data-[collapsible=icon]:hidden",
                              isActive
                                ? "bg-sidebar-primary/20 text-sidebar-primary shadow-sm shadow-sidebar-primary/10"
                                : "bg-sidebar-accent/50 text-sidebar-foreground/50"
                            )}>
                              {item.badge}
                            </span>
                          )}

                          {isActive && <ChevronRight className="h-4 w-4 text-sidebar-primary/50 group-data-[collapsible=icon]:hidden" />}
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

      <SidebarFooter className="relative p-3 border-t border-sidebar-border/80">
        <button
          onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
          className="mb-2 w-full flex items-center gap-2.5 rounded-2xl border border-sidebar-primary/20 bg-sidebar-primary/[0.09] p-3.5 text-left transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sidebar-primary/[0.14] hover:border-sidebar-primary/30 group-data-[collapsible=icon]:hidden"
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
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold text-sidebar-foreground/85 transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-destructive/[0.08] hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span className="group-data-[collapsible=icon]:hidden">Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

