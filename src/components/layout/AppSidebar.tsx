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

import { MILESTONES, getMilestone } from "@/lib/tiers";

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



function formatRevenue(revenue: number) {
  if (revenue >= 1000000) return `R$ ${(revenue / 1000000).toFixed(2).replace(",", ".")}M`;
  if (revenue >= 1000) return `R$ ${(revenue / 1000).toFixed(1).replace(",", ".")}K`;
  return `R$ ${revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function splitRevenue(revenue: number): { prefix: string; value: string; suffix: string } {
  if (revenue >= 1000000) return { prefix: "R$", value: (revenue / 1000000).toFixed(2).replace(",", "."), suffix: "M" };
  if (revenue >= 1000) return { prefix: "R$", value: (revenue / 1000).toFixed(1).replace(",", "."), suffix: "K" };
  return { prefix: "R$", value: revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), suffix: "" };
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

  const pct = Math.max(0, Math.min(100, milestone.pct));
  const pctDisplay = Math.round(pct);
  
  const tierName = milestone.current.tier;

  const parts = splitRevenue(revenue);

  return (
    <button
      type="button"
      onClick={onOpenRewards}
      className="seller-clickable group/rev relative mt-4 block w-full overflow-hidden rounded-[10px] border-sidebar-border bg-sidebar-accent/15 px-3.5 py-3 text-left hover:border-sidebar-primary/60 hover:bg-sidebar-accent/35"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-sidebar-foreground/40" strokeWidth={2.5} />
          <span className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/50">
            Faturamento
          </span>
        </div>
        <span className="rounded border border-sidebar-primary/25 bg-sidebar-primary/10 px-1.5 py-[1px] font-display text-[8.5px] font-black uppercase tracking-[0.18em] text-sidebar-primary">
          {tierName}
        </span>
      </div>

      {/* Main figure */}
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-numbers text-[13px] font-bold leading-none text-sidebar-foreground/45 tabular-nums">
          {parts.prefix}
        </span>
        <p className="font-numbers text-[26px] font-black leading-none tracking-[-0.045em] text-sidebar-accent-foreground tabular-nums">
          {parts.value}
          <span className="ml-0.5 text-[18px] font-black text-sidebar-foreground/55">{parts.suffix}</span>
        </p>
        <span className="ml-auto font-display text-[8.5px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/35">
          total
        </span>
      </div>

      {/* Progress bar with ticks */}
      <div className="relative mt-3">
        <div className="pointer-events-none absolute -top-[3px] left-0 z-10 flex w-full justify-between px-px">
          <span className="h-[5px] w-px bg-sidebar-foreground/25" />
          <span className="h-[5px] w-px bg-sidebar-foreground/15" />
          <span className="h-[5px] w-px bg-sidebar-foreground/15" />
          <span className="h-[5px] w-px bg-sidebar-foreground/15" />
          <span className="h-[5px] w-px bg-sidebar-foreground/25" />
        </div>
        <div className="h-[4px] w-full overflow-hidden rounded-full bg-sidebar-border/50">
          <div
            className="h-full rounded-full bg-sidebar-primary transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Scale */}
      <div className="mt-2 flex items-center justify-between font-numbers text-[9px] font-semibold tabular-nums text-sidebar-foreground/40">
        <span>{milestone.current.label.replace(",", ".")}</span>
        <span>{milestone.next.label.replace(",", ".")}</span>
      </div>

      {/* Footer */}
      <div className="mt-2.5 flex items-center justify-between border-t border-sidebar-border/40 pt-2">
        <div className="flex items-baseline gap-1">
          <span className="font-numbers text-[12px] font-black tabular-nums text-sidebar-accent-foreground">
            {pctDisplay}%
          </span>
          <span className="font-display text-[8.5px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/40">
            da meta
          </span>
        </div>
        <span className="inline-flex items-center gap-0.5 font-display text-[9px] font-black uppercase tracking-[0.2em] text-sidebar-primary transition-transform group-hover/rev:translate-x-0.5">
          PREMIAÇÕES
          <ChevronRight className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
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
        <div className="mx-4 my-2.5 h-px bg-sidebar-border/50 group-data-[collapsible=icon]:mx-3 group-data-[collapsible=icon]:my-2.5" />
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-1 px-0 group-data-[collapsible=icon]:gap-2">


          {section.items.map((item) => {
            const isActive = isItemActive(pathname, item);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild className="h-auto rounded-2xl p-0 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:!size-auto group-data-[collapsible=icon]:!p-0">
                  <NavLink
                    to={item.url}
                    end={item.exact}
                    activeClassName=""
                    className={cn(
                      "seller-nav-option group/nav relative flex h-[46px] w-full items-center gap-3 rounded-xl border border-transparent px-3 text-[13px] font-bold",
                      "transition-all duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
                      "active:scale-[0.98]",
                      "group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:gap-0",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:shadow-[0_6px_20px_-8px_hsl(var(--sidebar-primary)/0.65)]"
                        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hover:bg-sidebar-accent/60 group-data-[collapsible=icon]:hover:border-sidebar-primary/40",
                    )}
                  >
                    {/* Active indicator rail */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary-foreground group-data-[collapsible=icon]:hidden" />
                    )}
                    {/* Collapsed active glow dot */}
                    {isActive && (
                      <span className="hidden group-data-[collapsible=icon]:block absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-sidebar-primary-foreground" />
                    )}
                    <item.icon
                      className={cn(
                        "h-5 w-5 transition-transform duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-data-[collapsible=icon]:h-[22px] group-data-[collapsible=icon]:w-[22px]",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground/50 group-hover/nav:text-foreground group-hover/nav:scale-[1.12]",
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-primary group-data-[collapsible=icon]:hidden">
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
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, exact: true },
        { title: "Vendas", url: "/vendas", icon: BarChart3, exact: true },
      ],
    },
    {
      label: "INFOPRODUTOS",
      items: [
        { title: "Produtos", url: "/vendas/produtos", icon: Package, count: counts.products },
        { title: "Cupons", url: "/vendas/cupons", icon: Ticket, count: counts.coupons },
      ],
    },
    {
      label: "FINANCEIRO",
      items: [
        { title: "Financeiro", url: "/financeiro/saques", icon: ArrowDownToLine },
        { title: "Taxas", url: "/financeiro/config", icon: Building2 },
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
        { title: "Meu Perfil & KYC", url: "/perfil", icon: User },
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
      <SidebarHeader className="relative border-b border-sidebar-border/70 px-4 pb-4 pt-4">
        {/* Brand */}
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] border border-sidebar-border bg-gradient-to-br from-sidebar-accent to-sidebar-accent/40 ring-1 ring-inset ring-sidebar-primary/10">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain p-[3px]" />
            <span className="pointer-events-none absolute inset-0 rounded-[10px] bg-gradient-to-br from-sidebar-primary/0 via-transparent to-sidebar-primary/10" />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <h1 className="font-display text-[15.5px] leading-none font-black tracking-[-0.045em] text-sidebar-accent-foreground">
                HOTZFY
              </h1>
            </div>
          </div>
        </div>
        <RevenueCard
          collapsed={collapsed}
          revenue={revenue}
          milestone={milestone}
          onOpenRewards={() => navigate("/premiacoes")}
        />
      </SidebarHeader>


      <SidebarContent className="relative gap-0 overflow-y-auto px-2.5 py-3 group-data-[collapsible=icon]:py-4">
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
          className="seller-clickable group/sup relative flex w-full items-center gap-3 overflow-hidden rounded-xl border-sidebar-border/70 bg-sidebar-accent/45 px-3 py-3 text-left hover:border-sidebar-primary/60 hover:bg-sidebar-accent/75 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
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
          className="seller-clickable flex w-full items-center gap-3 rounded-xl border-transparent px-2.5 py-2.5 text-left hover:border-sidebar-primary/40 hover:bg-sidebar-accent/55 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary/18 text-[13px] font-bold text-sidebar-primary ring-1 ring-sidebar-primary/30">
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
          className="seller-clickable flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-[12.5px] font-semibold text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span className="group-data-[collapsible=icon]:hidden">Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
