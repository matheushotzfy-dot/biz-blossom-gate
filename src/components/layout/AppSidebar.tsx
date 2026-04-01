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
  title: string;
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
      { title: "Analytics", url: "/analytics", icon: TrendingUp, exact: true },
    ],
  },
  {
    label: "INFOPRODUTOS",
    items: [
      { title: "Produtos", url: "/vendas/produtos", icon: Package },
      { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
      { title: "Afiliados", url: "/vendas/afiliados", icon: Users },
      { title: "Cupons", url: "/vendas/cupons", icon: Ticket },
      { title: "Assinaturas", url: "/vendas/assinaturas", icon: Repeat },
      { title: "Marketplace", url: "/marketplace", icon: Store, exact: true },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
      { title: "Saques", url: "/financeiro/saques", icon: ArrowDownToLine },
      { title: "Configurações", url: "/financeiro/config", icon: Building2 },
    ],
  },
  {
    label: "FERRAMENTAS",
    items: [
      { title: "Otimização", url: "/otimizacao", icon: FlaskConical },
      { title: "Integrações", url: "/integracoes", icon: Puzzle },
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

  return (
    <button type="button" className="mt-5 block w-full text-left" onClick={onOpenRewards}>
      <div className="overflow-hidden rounded-[24px] border border-sidebar-primary/25 bg-gradient-to-br from-sidebar-primary/[0.12] via-sidebar/95 to-sidebar-accent/40 px-4 py-4 shadow-lg transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-sidebar-primary/35 hover:bg-gradient-to-br hover:from-sidebar-primary/[0.14] hover:via-sidebar/95 hover:to-sidebar-accent/50">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sidebar-primary/15 bg-sidebar-primary/10">
            <Zap className="h-4.5 w-4.5 text-sidebar-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/55">Faturamento</p>
            <p className="mt-1 text-[18px] font-black leading-none tracking-tight text-sidebar-accent-foreground">
              {formatRevenue(revenue)}
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-sidebar-primary">{milestone.current.label}</span>
            <span className="text-sidebar-foreground/35">Meta: {milestone.next.label}</span>
          </div>
          <div className="h-2.5 rounded-full bg-sidebar-border/45">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sidebar-primary to-sidebar-primary/75 transition-[width] duration-700 ease-out"
              style={{ width: `${milestone.pct}%` }}
            />
          </div>
          <div className="pt-0.5">
            <p className="text-[12px] font-black text-sidebar-primary">{milestone.pct.toFixed(0)}%</p>
            <p className="mt-2 text-center text-[11px] font-semibold text-sidebar-primary/75">Ver Premiações</p>
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
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild className="h-auto rounded-[20px] p-0 hover:bg-transparent active:bg-transparent">
                  <NavLink
                    to={item.url}
                    end={item.exact}
                    activeClassName=""
                    className={cn(
                      "group/nav relative flex min-h-14 w-full items-center gap-3 rounded-[20px] px-3.5 py-3 text-[14px] font-semibold transition-all duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2.5",
                      isActive
                        ? "border border-sidebar-border/70 bg-card/95 text-sidebar-accent-foreground shadow-lg"
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
            <span className="text-[11px] text-sidebar-foreground/70">Para escalar seu negócio</span>
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
