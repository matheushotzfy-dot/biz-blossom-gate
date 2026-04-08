import {
  LayoutDashboard,
  BarChart3,
  Package,
  GraduationCap,
  Users,
  Layers,
  Trophy,
  FileText,
  ArrowDownToLine,
  Building2,
  Puzzle,
  User,
  LogOut,
  ChevronRight,
  Headphones,
  Zap,
  TrendingUp,
  FlaskConical,
  MessageSquare,
  Store,
  Repeat,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import hotzfyLogo from "@/assets/hotzfy-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const MILESTONES = [
  { label: "R$ 0", value: 0 },
  { label: "R$ 10K", value: 10000 },
  { label: "R$ 100K", value: 100000 },
  { label: "R$ 500K", value: 500000 },
  { label: "R$ 1M", value: 1000000 },
  { label: "R$ 5M", value: 5000000 },
];

type SidebarItem = {
  title: string | React.ReactNode;
  url: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
};

type SidebarSection = {
  label: string;
  items: SidebarItem[];
};

function getMilestone(revenue: number) {
  const lastMilestone = MILESTONES[MILESTONES.length - 1];
  if (revenue >= lastMilestone.value) {
    return { current: lastMilestone, next: lastMilestone, pct: 100, tier: MILESTONES.length - 1 };
  }
  let current = MILESTONES[0];
  let next = MILESTONES[1];
  for (let i = 0; i < MILESTONES.length - 1; i++) {
    if (revenue >= MILESTONES[i].value && revenue < MILESTONES[i + 1].value) {
      current = MILESTONES[i];
      next = MILESTONES[i + 1];
      break;
    }
  }
  const range = next.value - current.value;
  const pct = range > 0 ? Math.min(((revenue - current.value) / range) * 100, 100) : 100;
  return { current, next, pct, tier: MILESTONES.indexOf(current) };
}

function formatRevenue(revenue: number) {
  if (revenue >= 1000000) return `R$ ${(revenue / 1000000).toFixed(2).replace(".", ",")}M`;
  if (revenue >= 1000) return `R$ ${(revenue / 1000).toFixed(1).replace(".", ",")}K`;
  return `R$ ${revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isItemActive(pathname: string, item: SidebarItem) {
  return item.exact ? pathname === item.url : pathname.startsWith(item.url);
}

const sections: SidebarSection[] = [
  {
    label: "COMANDO",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, badge: "Live", exact: true },
      { title: "Minhas Vendas", url: "/vendas", icon: BarChart3, exact: true },
    ],
  },
  {
    label: "INFOPRODUTOS",
    items: [
      { title: "Meus Produtos", url: "/vendas/produtos", icon: Package },
      { title: "Área De Membros", url: "/vendas/conteudo", icon: Layers },
      { title: "Afiliados", url: "/vendas/afiliados", icon: Users },
      { title: "Cupons", url: "/vendas/cupons", icon: Ticket },
      { title: "Assinaturas", url: "/vendas/assinaturas", icon: Repeat },
      { title: (<span>Vitrine De Produtos<br /></span>), url: "/marketplace", icon: Store, exact: true },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
      { title: "Saques", url: "/financeiro/saques", icon: ArrowDownToLine },
      { title: (<span>Financeiro<br /></span>), url: "/financeiro/config", icon: Building2 },
    ],
  },
  {
    label: "FERRAMENTAS",
    items: [
      // { title: "Otimização", url: "/otimizacao", icon: FlaskConical },
      { title: "Apps & Integrações", url: "/integracoes", icon: Puzzle },
    ],
  },
  {
    label: "CONTA",
    items: [
      { title: "Meu Perfil", url: "/perfil", icon: User },
      { title: "Minhas Compras", url: "/membros", icon: GraduationCap },
      { title: "Premiações", url: "/premiacoes", icon: Trophy },
      { title: "Suporte", url: "/suporte", icon: MessageSquare },
    ],
  },
];

type RevenueCardProps = {
  collapsed: boolean;
  revenue: number;
  milestone: ReturnType<typeof getMilestone>;
  onOpenRewards: () => void;
};

function RevenueCard({ collapsed, revenue, milestone, onOpenRewards }: RevenueCardProps) {
  if (collapsed) return null;

  const pct = milestone.pct;
  const circ = 2 * Math.PI * 18;
  const offset = circ - (pct / 100) * circ;

  return (
    <button type="button" className="mt-5 block w-full text-left group/rev" onClick={onOpenRewards}>
      <div className="relative overflow-hidden rounded-2xl border border-sidebar-primary/20 bg-gradient-to-br from-sidebar-primary/[0.08] via-sidebar/95 to-sidebar-accent/30 p-4 shadow-xl shadow-sidebar-primary/5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-sidebar-primary/35 hover:shadow-sidebar-primary/10">
        {/* Ambient glow */}
        <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-sidebar-primary/10 blur-[50px] pointer-events-none group-hover/rev:bg-sidebar-primary/15 transition-colors duration-500" />
        <div className="absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-sidebar-primary/5 blur-[40px] pointer-events-none" />
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(var(--sidebar-foreground)) 0.5px, transparent 0.5px)", backgroundSize: "12px 12px" }} />

        <div className="relative z-10">
          {/* Header row with ring */}
          <div className="flex items-center gap-3 mb-3">
            {/* Mini completion ring */}
            <div className="relative h-11 w-11 shrink-0">
              <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="hsl(var(--sidebar-border) / 0.15)" strokeWidth="2.5" />
                <circle
                  cx="22" cy="22" r="18" fill="none"
                  stroke="hsl(var(--sidebar-primary))"
                  strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  className="transition-[stroke-dashoffset] duration-1000 ease-out"
                  style={{ filter: "drop-shadow(0 0 4px hsl(var(--sidebar-primary) / 0.4))" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-sidebar-primary" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-display font-bold uppercase tracking-[0.2em] text-sidebar-foreground/40">Faturamento Total</p>
              <p className="mt-0.5 text-[17px] font-display font-black leading-none tracking-[-0.03em] text-sidebar-accent-foreground tabular-nums">
                {formatRevenue(revenue)}
              </p>
            </div>
          </div>

          {/* Milestone labels */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-display font-bold text-sidebar-primary tabular-nums">{milestone.current.label}</span>
            <span className="text-[9px] font-display font-bold text-sidebar-foreground/30">Meta: {milestone.next.label}</span>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 rounded-full bg-sidebar-border/20 overflow-hidden ring-1 ring-sidebar-border/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sidebar-primary via-sidebar-primary/80 to-sidebar-primary/60 transition-[width] duration-1000 ease-out relative"
              style={{ width: `${pct}%`, boxShadow: "0 0 8px hsl(var(--sidebar-primary) / 0.35)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-2.5">
            <p className="text-[11px] font-display font-black text-sidebar-primary tabular-nums">{pct.toFixed(0)}%</p>
            <span className="text-[9px] font-display font-bold text-sidebar-primary/60 flex items-center gap-1 group-hover/rev:text-sidebar-primary transition-colors">
              Ver Premiações
              <ChevronRight className="h-3 w-3 group-hover/rev:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

type SidebarSectionNavProps = {
  section: SidebarSection;
  pathname: string;
};

function SidebarSectionNav({ section, pathname }: SidebarSectionNavProps) {
  return (
    <SidebarGroup className="px-0 py-0">
      <SidebarGroupContent>
        <SidebarMenu className="gap-1.5 px-0">
          {section.items.map((item) => {
            const isActive = isItemActive(pathname, item);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild className="h-auto rounded-[20px] p-0 hover:bg-transparent active:bg-transparent">
                  <NavLink
                    to={item.url}
                    end={item.exact}
                    activeClassName=""
                    className={cn(
                      "group/nav relative flex min-h-14 w-full items-center gap-3 rounded-[20px] px-3.5 py-3 text-[14px] font-semibold transition-all duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2.5",
                      isActive
                        ? "border border-primary/40 bg-card/95 text-sidebar-accent-foreground shadow-[0_0_20px_rgba(0,220,130,0.12),inset_0_1px_0_rgba(0,220,130,0.08)]"
                        : "text-sidebar-foreground/78 hover:bg-sidebar-accent/12 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary group-data-[collapsible=icon]:hidden" />
                    )}
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border transition-all duration-200",
                        isActive
                          ? "border-sidebar-primary/20 bg-sidebar-primary/12 text-sidebar-primary"
                          : "border-transparent bg-card/80 text-sidebar-foreground/58 group-hover/nav:border-sidebar-border/50 group-hover/nav:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className={cn("truncate group-data-[collapsible=icon]:hidden", isActive && "font-black")}>
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-sidebar-primary/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sidebar-primary group-data-[collapsible=icon]:hidden">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <ChevronRight className="ml-1 h-4 w-4 text-sidebar-primary/55 group-data-[collapsible=icon]:hidden" />
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user } = useAuth();
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    let ignore = false;
    if (!user?.id) { setRevenue(0); return; }
    const loadRevenue = async () => {
      const { data } = await supabase
        .from("transactions")
        .select("net_amount")
        .eq("user_id", user.id)
        .eq("status", "completed");
      if (!ignore && data) {
        setRevenue(data.reduce((sum, t) => sum + Number(t.net_amount ?? 0), 0));
      }
    };
    void loadRevenue();
    return () => { ignore = true; };
  }, [user?.id]);

  const milestone = useMemo(() => getMilestone(revenue), [revenue]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/70 bg-sidebar">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sidebar-primary/[0.08] to-transparent" />

      <SidebarHeader className="relative border-b border-sidebar-border/70 px-4 pb-4 pt-5">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[22px] border border-sidebar-primary/15 bg-card ring-1 ring-sidebar-primary/20 shadow-lg">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-[30px] leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">
              HOTZFY
            </h1>
          </div>
        </div>
        <RevenueCard collapsed={collapsed} revenue={revenue} milestone={milestone} onOpenRewards={() => navigate("/premiacoes")} />
      </SidebarHeader>

      <SidebarContent className="relative gap-0 overflow-y-auto px-3 py-3">
        {sections.map((section, index) => (
          <div key={section.label}>
            {index > 0 && (
              <div className="mx-3 my-4 border-t border-sidebar-border/30 group-data-[collapsible=icon]:mx-1.5" />
            )}
            <SidebarSectionNav section={section} pathname={location.pathname} />
          </div>
        ))}
      </SidebarContent>

      <SidebarFooter className="relative border-t border-sidebar-border/70 p-3">
        <button
          type="button"
          onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
          className="mb-3 flex w-full items-center gap-3 rounded-[22px] border border-sidebar-primary/20 bg-sidebar-primary/[0.1] p-4 text-left transition-all duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sidebar-primary/30 hover:bg-sidebar-primary/[0.14] group-data-[collapsible=icon]:hidden"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sidebar-primary/14">
            <Headphones className="h-4.5 w-4.5 text-sidebar-primary" />
          </div>
          <div>
            <span className="block text-[13px] font-black text-sidebar-accent-foreground">Solicitar Suporte</span>
            <span className="text-[11px] text-sidebar-foreground/70">24/07 ao seu dispor!</span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3.5 text-[14px] font-semibold text-sidebar-foreground/80 transition-all duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span className="group-data-[collapsible=icon]:hidden">Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
