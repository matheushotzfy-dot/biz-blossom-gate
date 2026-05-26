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
  Zap,
  ChevronRight,
  TrendingUp,
  Activity,
  Crown,
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
  { label: "R$ 0", value: 0, tier: "Iniciante" },
  { label: "R$ 10K", value: 10000, tier: "Bronze" },
  { label: "R$ 100K", value: 100000, tier: "Prata" },
  { label: "R$ 500K", value: 500000, tier: "Ouro" },
  { label: "R$ 1M", value: 1000000, tier: "Platina" },
  { label: "R$ 5M", value: 5000000, tier: "Diamante" },
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
  milestone: ReturnType<typeof getMilestone>;
  onOpenRewards: () => void;
};

function RevenueCard({ collapsed, revenue, milestone, onOpenRewards }: RevenueCardProps) {
  if (collapsed) return null;

  const pct = Math.round(milestone.pct);

  return (
    <button
      type="button"
      onClick={onOpenRewards}
      className="group/rev relative mt-6 block w-full overflow-hidden rounded-[1.5rem] border border-sidebar-border/50 bg-sidebar-accent/30 p-5 text-left transition-all duration-300 hover:bg-sidebar-accent/50 hover:border-sidebar-primary/20 hover:shadow-lg hover:shadow-black/5"
    >
      <div className="flex items-center gap-4">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover/rev:scale-110">
          <Zap className="h-5 w-5" strokeWidth={2.5} fill="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 leading-none">
            Volume Total
          </p>
          <p className="mt-2 font-display text-2xl font-black leading-none tracking-[-0.03em] text-foreground tabular-nums">
            {formatRevenue(revenue)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/30">
        <span>{milestone.current.label}</span>
        <span>Meta: {milestone.next.label}</span>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sidebar-border/40">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out shadow-[0_0_8px_rgba(var(--primary),0.5)]"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-black text-primary tabular-nums tracking-tight">{pct}%</span>
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/30">Concluído</span>
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary/60 group-hover/rev:text-primary transition-colors">
          Rewards
          <ChevronRight className="h-3 w-3 transition-transform group-hover/rev:translate-x-0.5" strokeWidth={3} />
        </div>
      </div>
    </button>
  );
}

type SidebarSectionNavProps = {
  section: SidebarSection;
  pathname: string;
  isFirst: boolean;
};

function SidebarSectionNav({ section, pathname, isFirst }: SidebarSectionNavProps) {
  return (
    <SidebarGroup className="px-0 py-0">
      {!isFirst && (
        <div className="mx-4 my-2.5 h-px bg-sidebar-border/50 group-data-[collapsible=icon]:mx-2 group-data-[collapsible=icon]:my-2" />
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-1 px-0">
          {section.items.map((item) => {
            const isActive = isItemActive(pathname, item);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild className="h-auto rounded-2xl p-0 hover:bg-transparent active:bg-transparent">
                  <NavLink
                    to={item.url}
                    end={item.exact}
                    activeClassName=""
                    className={cn(
                      "group/nav relative flex h-[46px] w-full items-center gap-3 rounded-xl px-3 text-[13px] font-bold",
                      "transition-all duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
                      "active:scale-[0.98]",
                      "group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground hover:translate-x-[2px]",
                    )}
                  >
                    {/* Active indicator rail */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary-foreground group-data-[collapsible=icon]:hidden" />
                    )}
                    <item.icon
                      className={cn(
                        "h-5 w-5 transition-transform duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground/50 group-hover/nav:text-foreground group-hover/nav:scale-[1.08]",
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.15em] text-sidebar-primary group-data-[collapsible=icon]:hidden">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inset-0 animate-ping rounded-full bg-sidebar-primary opacity-70" />
                          <span className="relative h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
                        </span>
                        {item.badge}
                      </span>
                    )}
                    {item.count !== undefined && item.count > 0 && !item.badge && (
                      <span className={cn(
                        "ml-auto rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums group-data-[collapsible=icon]:hidden",
                        "transition-colors duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
                        isActive
                          ? "bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground"
                          : "bg-sidebar-border/50 text-sidebar-foreground/65 group-hover/nav:bg-sidebar-border group-hover/nav:text-foreground",
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
        { title: "Vendas", url: "/vendas", icon: BarChart3, exact: true },
      ],
    },
    {
      label: "INFOPRODUTOS",
      items: [
        { title: "Produtos", url: "/vendas/produtos", icon: Package, count: counts.products },
        { title: "Área De Membros", url: "/vendas/conteudo", icon: Layers, count: counts.courses },
        { title: "Afiliados", url: "/vendas/afiliados", icon: Users },
        { title: "Cupons", url: "/vendas/cupons", icon: Ticket, count: counts.coupons },
        { title: "Assinaturas", url: "/vendas/assinaturas", icon: Repeat, count: counts.subscriptions },
      ],
    },
    {
      label: "FINANCEIRO",
      items: [
        { title: "Financeiro", url: "/financeiro/saques", icon: ArrowDownToLine },
        { title: "Config. Financeiro", url: "/financeiro/config", icon: Building2 },
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
    <Sidebar collapsible="icon" className="border-r-2 border-sidebar-border/80 bg-sidebar">
      <SidebarHeader className="relative border-b border-sidebar-border/70 px-5 pb-6 pt-6">
        {/* Brand */}
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="group/logo relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border-2 border-sidebar-border/80 bg-sidebar-accent transition-all hover:border-sidebar-primary/50 hover:scale-[1.05]">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain p-1.5" />
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[20px] leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">
                HOTZFY
              </h1>
              <Crown className="h-3 w-3 text-sidebar-primary" strokeWidth={2.5} fill="hsl(var(--sidebar-primary))" />
            </div>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-sidebar-foreground/55">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Sistema operacional
            </p>
          </div>
        </div>
        <RevenueCard
          collapsed={collapsed}
          revenue={revenue}
          milestone={milestone}
          onOpenRewards={() => navigate("/premiacoes")}
        />
      </SidebarHeader>

      <SidebarContent className="relative gap-0 overflow-y-auto px-2.5 py-3">
        {sections.map((section, idx) => (
          <SidebarSectionNav
            key={section.label}
            section={section}
            pathname={location.pathname}
            isFirst={idx === 0}
          />
        ))}
      </SidebarContent>

      <SidebarFooter className="relative gap-2 border-t border-sidebar-border/60 p-3">
        {/* Solicitar Suporte — featured card */}
        <button
          type="button"
          onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
          className="group/sup relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-sidebar-border/70 bg-sidebar-accent/45 px-3 py-3 text-left transition-colors duration-200 hover:border-sidebar-primary/30 hover:bg-sidebar-accent/70 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-primary/25 bg-sidebar-primary/10 text-sidebar-primary">
            <Headphones className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="text-[13.5px] font-bold leading-tight text-sidebar-accent-foreground">
              Solicitar Suporte
            </p>
            <p className="mt-1 text-[11px] leading-tight text-sidebar-foreground/60">
              Time premium • 24/7 ao vivo
            </p>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 text-sidebar-primary/70 transition-transform group-hover/sup:translate-x-0.5 group-data-[collapsible=icon]:hidden" strokeWidth={2.5} />
        </button>

        {/* User chip */}
        <button
          type="button"
          onClick={() => navigate("/perfil")}
          className="flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-colors hover:border-sidebar-border/60 hover:bg-sidebar-accent/40 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary/18 text-[13px] font-black text-sidebar-primary ring-1 ring-sidebar-primary/30">
            {userInitial}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-success" />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[12.5px] font-bold leading-tight text-sidebar-accent-foreground">
              {userName}
            </p>
            <p className="truncate text-[10.5px] leading-tight text-sidebar-foreground/50">
              {user?.email}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[12.5px] font-semibold text-sidebar-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span className="group-data-[collapsible=icon]:hidden">Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
