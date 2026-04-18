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
 // { title: "Vitrine De Produtos", url: "/marketplace", icon: Store, exact: true }, // Desativada temporariamente
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
    <button
      type="button"
      onClick={onOpenRewards}
      className="mt-4 block w-full text-left group/rev rounded-lg px-2.5 py-2 transition-colors hover:bg-sidebar-accent/40"
    >
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">Faturamento</span>
        <span className="text-[10px] font-medium text-sidebar-foreground/35 tabular-nums">{milestone.next.label}</span>
      </div>
      <p className="text-[15px] font-display font-bold leading-none tracking-tight text-sidebar-accent-foreground tabular-nums">
        {formatRevenue(revenue)}
      </p>
      <div className="mt-2 h-[3px] rounded-full bg-sidebar-border/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-sidebar-primary/80 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}

type SidebarSectionNavProps = {
 section: SidebarSection;
 pathname: string;
};

function SidebarSectionNav({ section, pathname, isFirst }: SidebarSectionNavProps & { isFirst?: boolean }) {
  return (
    <SidebarGroup className="px-0 py-0">
      {!isFirst && (
        <div className="mx-4 my-3 h-px bg-gradient-to-r from-transparent via-sidebar-border/60 to-transparent group-data-[collapsible=icon]:hidden" />
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-[3px] px-0">
          {section.items.map((item) => {
            const isActive = isItemActive(pathname, item);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild className="h-auto rounded-xl p-0 hover:bg-transparent active:bg-transparent">
                  <NavLink
                    to={item.url}
                    end={item.exact}
                    activeClassName=""
                    className={cn(
                      "group/nav relative flex h-[46px] w-full items-center gap-3.5 rounded-xl px-3.5 text-[14.5px] font-medium tracking-[-0.005em] transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                      isActive
                        ? "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/60 text-sidebar-accent-foreground font-semibold"
                        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary group-data-[collapsible=icon]:hidden" />
                    )}
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                        isActive
                          ? "bg-sidebar-primary/15 text-sidebar-primary"
                          : "text-sidebar-foreground/55 group-hover/nav:bg-sidebar-accent/70 group-hover/nav:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon
                        className="h-[19px] w-[19px]"
                        strokeWidth={isActive ? 2.3 : 1.95}
                      />
                    </span>
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="ml-auto flex items-center gap-1 rounded-md bg-sidebar-primary/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-sidebar-primary group-data-[collapsible=icon]:hidden">
                        <span className="h-1 w-1 rounded-full bg-sidebar-primary animate-pulse" />
                        {item.badge}
                      </span>
                    )}
                    {isActive && !item.badge && (
                      <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary/70 group-data-[collapsible=icon]:hidden" strokeWidth={2.5} />
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="relative border-b border-sidebar-border/60 px-4 pb-4 pt-4">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-sidebar-border/50 bg-card">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-[20px] leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">
              HOTZFY
            </h1>
          </div>
        </div>
        <RevenueCard collapsed={collapsed} revenue={revenue} milestone={milestone} onOpenRewards={() => navigate("/premiacoes")} />
      </SidebarHeader>

      <SidebarContent className="relative gap-0 overflow-y-auto px-2 py-2">
        {sections.map((section, idx) => (
          <SidebarSectionNav key={section.label} section={section} pathname={location.pathname} isFirst={idx === 0} />
        ))}
      </SidebarContent>

      <SidebarFooter className="relative border-t border-sidebar-border/60 p-2">
        <button
          type="button"
          onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
          className="mb-0.5 flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Headphones className="h-4 w-4 shrink-0 text-sidebar-foreground/45" strokeWidth={1.85} />
          <span className="group-data-[collapsible=icon]:hidden">Suporte 24/7</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-sidebar-foreground/55 transition-colors hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.85} />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
