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
  Headphones,
  TrendingUp,
  Zap,
  Crown,
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

/* ─── Milestone tiers ─── */
const MILESTONES = [
  { label: "R$ 0", value: 0, rank: "Iniciante" },
  { label: "R$ 10K", value: 10000, rank: "Bronze" },
  { label: "R$ 100K", value: 100000, rank: "Prata" },
  { label: "R$ 500K", value: 500000, rank: "Ouro" },
  { label: "R$ 1M", value: 1000000, rank: "Diamante" },
  { label: "R$ 5M", value: 5000000, rank: "Lenda" },
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
  return { current, next, pct };
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
    <Sidebar className="border-r border-sidebar-border sidebar-premium">
      {/* ─── HEADER ─── */}
      <SidebarHeader className="relative px-5 pt-6 pb-5 border-b border-sidebar-border/60">
        {/* Ambient glow */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-sidebar-primary/[0.04] to-transparent pointer-events-none" />

        <div className={cn("relative flex items-center gap-3.5", collapsed && "justify-center")}>
          <div className="h-11 w-11 rounded-2xl overflow-hidden shadow-xl shadow-sidebar-primary/25 ring-2 ring-sidebar-primary/20 shrink-0 sidebar-logo-glow">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-[22px] leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">
              HOTZ<span className="text-sidebar-primary">FY</span>
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-sidebar-primary/60 mt-1">Plataforma de Infoprodutos</p>
          </div>
        </div>

        {/* ─── Milestone Progress Card ─── */}
        <div className="mt-5 group-data-[collapsible=icon]:hidden">
          <div className="relative rounded-2xl overflow-hidden">
            {/* Card background with gradient border effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sidebar-primary/20 via-sidebar-primary/5 to-transparent p-[1px]">
              <div className="h-full w-full rounded-2xl bg-sidebar-accent/80 backdrop-blur-sm" />
            </div>

            <div className="relative p-4">
              {/* Name + Revenue */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-sidebar-primary/15 flex items-center justify-center">
                    <Crown className="h-3 w-3 text-sidebar-primary" />
                  </div>
                  <span className="text-[11px] font-bold text-sidebar-accent-foreground">{displayName}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sidebar-primary/60">
                  {milestone.current.rank}
                </span>
              </div>

              {/* Revenue amount */}
              <p className="text-xl font-display font-black text-sidebar-primary mb-3 tracking-tight">
                {fmtCompact(revenue)}
              </p>

              {/* Progress bar with flame */}
              <div className="relative">
                <div className="relative h-[10px] w-full rounded-full bg-sidebar-border/40 overflow-visible">
                  {/* Track glow */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full sidebar-progress-bar"
                    style={{ width: `${Math.max(milestone.pct, 4)}%` }}
                  />

                  {/* Flame at tip */}
                  {milestone.pct > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 sidebar-flame-container"
                      style={{ left: `${Math.max(milestone.pct, 4)}%` }}
                    >
                      <div className="sidebar-flame" />
                      <div className="sidebar-flame-inner" />
                      <div className="sidebar-flame-spark sidebar-flame-spark-1" />
                      <div className="sidebar-flame-spark sidebar-flame-spark-2" />
                      <div className="sidebar-flame-spark sidebar-flame-spark-3" />
                    </div>
                  )}
                </div>

                {/* Labels */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px] font-medium text-sidebar-foreground/40">{milestone.current.label}</span>
                  <div className="flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5 text-sidebar-primary/60" />
                    <span className="text-[9px] font-bold text-sidebar-primary/70">{milestone.next.label}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarHeader>

      {/* ─── NAVIGATION ─── */}
      <SidebarContent className="relative px-3 py-4 overflow-y-auto sidebar-nav-scroll">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={cn("px-0", idx > 0 && "mt-3")}>
            <SidebarGroupLabel className="px-3 mb-1.5 text-[9px] uppercase tracking-[0.25em] font-bold text-sidebar-foreground/30 group-data-[collapsible=icon]:hidden">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5 px-0.5">
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
                            "group/nav relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium leading-none transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                            isActive
                              ? "sidebar-nav-active text-sidebar-accent-foreground"
                              : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/40",
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary shadow-[0_0_8px_hsl(152_58%_48%/0.5)] group-data-[collapsible=icon]:hidden" />
                          )}
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
                            isActive
                              ? "bg-sidebar-primary/15 shadow-sm shadow-sidebar-primary/10"
                              : "bg-sidebar-accent/50 group-hover/nav:bg-sidebar-accent",
                          )}>
                            <item.icon className={cn(
                              "h-4 w-4 transition-colors",
                              isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover/nav:text-sidebar-foreground/80",
                            )} />
                          </div>
                          <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                          {item.badge && (
                            <span className="ml-auto rounded-full bg-sidebar-primary/20 px-2 py-0.5 text-[8px] font-black text-sidebar-primary tracking-wider group-data-[collapsible=icon]:hidden sidebar-badge-pulse">
                              {item.badge}
                            </span>
                          )}
                          {isActive && !item.badge && (
                            <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/40 group-data-[collapsible=icon]:hidden" />
                          )}
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

      {/* ─── FOOTER ─── */}
      <SidebarFooter className="relative p-4 border-t border-sidebar-border/60">
        {/* Support CTA */}
        <button
          onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
          className="mb-3 w-full flex items-center gap-3 rounded-xl border border-sidebar-primary/20 bg-gradient-to-r from-sidebar-primary/[0.08] to-sidebar-primary/[0.03] p-3 text-left transition-all hover:border-sidebar-primary/30 hover:from-sidebar-primary/[0.12] hover:to-sidebar-primary/[0.06] group-data-[collapsible=icon]:hidden group/support"
        >
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary/15 flex items-center justify-center shrink-0 group-hover/support:bg-sidebar-primary/20 transition-colors">
            <Headphones className="h-4 w-4 text-sidebar-primary" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-sidebar-accent-foreground block leading-tight">Suporte para Escalar</span>
            <span className="text-[9px] text-sidebar-foreground/50">Fale com nosso time</span>
          </div>
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/50 transition-all hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
