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
  Headphones,
  MessageSquare,
  Repeat,
  Ticket,
  Sparkles,
  Activity,
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
  count?: number;
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

type RevenueCardProps = {
  collapsed: boolean;
  revenue: number;
  todayRevenue: number;
  salesToday: number;
  milestone: ReturnType<typeof getMilestone>;
  onOpenRewards: () => void;
};

function RevenueCard({ collapsed, revenue, todayRevenue, salesToday, milestone, onOpenRewards }: RevenueCardProps) {
  if (collapsed) return null;

  const pct = milestone.pct;

  return (
    <button
      type="button"
      onClick={onOpenRewards}
      className="group/rev mt-4 block w-full rounded-xl border border-sidebar-border/60 bg-gradient-to-b from-sidebar-accent/40 to-sidebar-accent/10 p-3 text-left transition-all hover:border-sidebar-primary/30 hover:from-sidebar-accent/60"
    >
      {/* Top: label + tier */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">
          Faturamento total
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-sidebar-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-sidebar-primary">
          <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
          T{milestone.tier + 1}
        </span>
      </div>

      {/* Big revenue */}
      <p className="font-display text-[18px] font-black leading-none tracking-tight text-sidebar-accent-foreground tabular-nums">
        {formatRevenue(revenue)}
      </p>

      {/* Progress bar */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-sidebar-border/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sidebar-primary/70 to-sidebar-primary transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[9.5px] font-semibold tabular-nums text-sidebar-foreground/55">
          {milestone.next.label}
        </span>
      </div>

      {/* Today stats */}
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-sidebar-border/40 pt-2.5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">Hoje</p>
          <p className="mt-0.5 text-[12px] font-bold tabular-nums text-sidebar-accent-foreground">
            {formatRevenue(todayRevenue)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">Vendas</p>
          <p className="mt-0.5 text-[12px] font-bold tabular-nums text-sidebar-accent-foreground">
            {salesToday}
          </p>
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
      <div className="px-3 pb-1.5 pt-3.5 group-data-[collapsible=icon]:hidden">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/35">
          {section.label}
        </span>
      </div>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5 px-0">
          {section.items.map((item) => {
            const isActive = isItemActive(pathname, item);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild className="h-auto rounded-md p-0 hover:bg-transparent active:bg-transparent">
                  <NavLink
                    to={item.url}
                    end={item.exact}
                    activeClassName=""
                    className={cn(
                      "group/nav relative flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-150 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-sidebar-primary group-data-[collapsible=icon]:hidden" />
                    )}
                    <item.icon
                      className={cn(
                        "h-[17px] w-[17px] shrink-0 transition-colors",
                        isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover/nav:text-sidebar-accent-foreground",
                      )}
                      strokeWidth={isActive ? 2.25 : 1.85}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="ml-auto rounded bg-sidebar-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sidebar-primary group-data-[collapsible=icon]:hidden">
                        {item.badge}
                      </span>
                    )}
                    {item.count !== undefined && item.count > 0 && !item.badge && (
                      <span className={cn(
                        "ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums group-data-[collapsible=icon]:hidden",
                        isActive
                          ? "bg-sidebar-primary/20 text-sidebar-primary"
                          : "bg-sidebar-border/50 text-sidebar-foreground/55",
                      )}>
                        {item.count}
                      </span>
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
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [salesToday, setSalesToday] = useState(0);
  const [counts, setCounts] = useState({ products: 0, courses: 0, subscriptions: 0, coupons: 0 });

  useEffect(() => {
    let ignore = false;
    if (!user?.id) {
      setRevenue(0);
      setTodayRevenue(0);
      setSalesToday(0);
      setCounts({ products: 0, courses: 0, subscriptions: 0, coupons: 0 });
      return;
    }
    const load = async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startISO = startOfDay.toISOString();

      const [{ data: tx }, { count: products }, { count: courses }, { count: subscriptions }, { count: coupons }] = await Promise.all([
        supabase.from("transactions").select("net_amount, created_at").eq("user_id", user.id).eq("status", "completed"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("seller_user_id", user.id).eq("status", "active"),
        supabase.from("coupons").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
      ]);

      if (ignore) return;

      if (tx) {
        const total = tx.reduce((sum, t) => sum + Number(t.net_amount ?? 0), 0);
        const todayTx = tx.filter((t) => t.created_at >= startISO);
        const today = todayTx.reduce((sum, t) => sum + Number(t.net_amount ?? 0), 0);
        setRevenue(total);
        setTodayRevenue(today);
        setSalesToday(todayTx.length);
      }
      setCounts({
        products: products ?? 0,
        courses: courses ?? 0,
        subscriptions: subscriptions ?? 0,
        coupons: coupons ?? 0,
      });
    };
    void load();
    return () => { ignore = true; };
  }, [user?.id]);

  const milestone = useMemo(() => getMilestone(revenue), [revenue]);

  const sections: SidebarSection[] = useMemo(() => [
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
        { title: "Meus Produtos", url: "/vendas/produtos", icon: Package, count: counts.products },
        { title: "Área De Membros", url: "/vendas/conteudo", icon: Layers, count: counts.courses },
        { title: "Afiliados", url: "/vendas/afiliados", icon: Users },
        { title: "Cupons", url: "/vendas/cupons", icon: Ticket, count: counts.coupons },
        { title: "Assinaturas", url: "/vendas/assinaturas", icon: Repeat, count: counts.subscriptions },
      ],
    },
    {
      label: "FINANCEIRO",
      items: [
        { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
        { title: "Saques", url: "/financeiro/saques", icon: ArrowDownToLine },
        { title: "Financeiro", url: "/financeiro/config", icon: Building2 },
      ],
    },
    {
      label: "FERRAMENTAS",
      items: [
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
  ], [counts]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const userInitial = (user?.email || "U").charAt(0).toUpperCase();
  const userName = user?.email?.split("@")[0] ?? "Vendedor";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="relative border-b border-sidebar-border/60 px-3 pb-3 pt-3.5">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-sidebar-border/50 bg-card">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-[19px] leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">
              HOTZFY
            </h1>
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-sidebar-foreground/50">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Sistema operacional
            </p>
          </div>
        </div>
        <RevenueCard
          collapsed={collapsed}
          revenue={revenue}
          todayRevenue={todayRevenue}
          salesToday={salesToday}
          milestone={milestone}
          onOpenRewards={() => navigate("/premiacoes")}
        />
      </SidebarHeader>

      <SidebarContent className="relative gap-0 overflow-y-auto px-2 py-2">
        {sections.map((section) => (
          <SidebarSectionNav key={section.label} section={section} pathname={location.pathname} />
        ))}
      </SidebarContent>

      <SidebarFooter className="relative border-t border-sidebar-border/60 p-2">
        {/* User chip */}
        <button
          type="button"
          onClick={() => navigate("/perfil")}
          className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/40 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary/30 to-sidebar-primary/10 text-[12px] font-bold text-sidebar-primary ring-1 ring-sidebar-primary/20">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[12px] font-semibold leading-tight text-sidebar-accent-foreground">
              {userName}
            </p>
            <p className="truncate text-[10.5px] leading-tight text-sidebar-foreground/45">
              {user?.email}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[12.5px] font-medium text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Headphones className="h-4 w-4 shrink-0 text-sidebar-foreground/45" strokeWidth={1.85} />
          <span className="group-data-[collapsible=icon]:hidden">Suporte 24/7</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium text-sidebar-foreground/55 transition-colors hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.85} />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
