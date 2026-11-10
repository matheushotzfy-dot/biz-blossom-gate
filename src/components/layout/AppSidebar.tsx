import {
  BadgePercent,
  CircleUserRound,
  Grid2X2,
  LogOut,
  Headset,
  CircleHelp,
  LayoutDashboard,
  MessageSquare,
  ChevronRight,
  Package,
  TicketPercent,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { useAuth } from "@/hooks/useAuth";
import { useSupportUnread } from "@/hooks/useSupportUnread";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardStats } from "@/hooks/useQueryData";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/routePrefetch";

import {
  PinIcon,
} from "@/components/icons/ShellIcons";
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




function formatRevenue(revenue: number) {
  if (revenue >= 1000000) return `R$ ${(revenue / 1000000).toFixed(2).replace(".", ",")}M`;
  if (revenue >= 1000) return `R$ ${(revenue / 1000).toFixed(1).replace(".", ",")}K`;
  return `R$ ${revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function splitRevenue(revenue: number): { prefix: string; value: string; suffix: string } {
  if (revenue >= 1000000) return { prefix: "R$", value: (revenue / 1000000).toFixed(2).replace(".", ","), suffix: "M" };
  if (revenue >= 1000) return { prefix: "R$", value: (revenue / 1000).toFixed(1).replace(".", ","), suffix: "K" };
  return { prefix: "R$", value: revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), suffix: "" };
}

function isItemActive(pathname: string, item: SidebarItem) {
  return item.exact ? pathname === item.url : pathname.startsWith(item.url);
}

type RevenueBarProps = {
  collapsed: boolean;
  revenue: number;
  milestone: ReturnType<typeof getMilestone>;
  onOpenRewards: () => void;
};

function RevenueBar({ collapsed, revenue, milestone, onOpenRewards }: RevenueBarProps) {
  const pct = Math.max(0, Math.min(100, milestone.pct));
  const pctDisplay = Math.round(pct);
  const current = formatRevenue(revenue);
  const goal = milestone.next.label.replace(",", ".");

  return (
    <button
      type="button"
      onClick={onOpenRewards}
      aria-hidden={collapsed}
      tabIndex={collapsed ? -1 : 0}
      title={`${current} de ${goal} — ${pctDisplay}% • ${milestone.current.tier}`}
      className="sidebar-revenue-bar seller-clickable group/rev relative mt-4 block max-h-28 w-full overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent px-4 py-3.5 text-left hover:border-primary/40"
    >
      {/* Marca d'água da logo */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 opacity-[0.13] transition-opacity duration-300 group-hover/rev:opacity-25"
      >
        <VenxpayLogo size={54} plate={false} />
      </span>

      <div className="relative">
        <div className="flex items-baseline gap-1.5">
          <span className="font-numbers text-[19px] font-bold leading-none tracking-[-0.035em] tabular-nums text-sidebar-accent-foreground">
            {current}
          </span>
          <span className="font-numbers text-[12px] font-semibold leading-none tabular-nums text-sidebar-foreground/35">
            / {goal}
          </span>
        </div>

        {/* Trilho */}
        <div className="mt-2.5 h-[6px] w-[calc(100%-46px)] overflow-hidden rounded-full bg-sidebar-border/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
            {milestone.current.tier}
          </span>
          <span className="h-[3px] w-[3px] rounded-full bg-sidebar-foreground/25" />
          <span className="font-numbers text-[10px] font-semibold tabular-nums text-sidebar-foreground/45">
            {pctDisplay}%
          </span>
          <ChevronRight
            className="ml-auto mr-[46px] h-3 w-3 text-sidebar-foreground/30 transition-transform duration-200 group-hover/rev:translate-x-0.5 group-hover/rev:text-primary"
            strokeWidth={2.2}
          />
        </div>
      </div>
    </button>
  );
}




type SidebarNavListProps = {
  items: SidebarItem[];
  pathname: string;
};

function SidebarNavList({ items, pathname }: SidebarNavListProps) {
  return (
    <SidebarGroup className="px-0 py-0">
      <SidebarGroupContent>
        <SidebarMenu className="gap-1 px-0">
          {items.map((item) => {
            const isActive = isItemActive(pathname, item);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isActive}
                   className="h-auto rounded-none p-0 hover:bg-transparent active:bg-transparent data-[active=true]:bg-transparent group-data-[collapsible=icon]:!h-[56px] group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:!px-3 group-data-[collapsible=icon]:!py-0"
                >
                  <NavLink
                    to={item.url}
                    end={item.exact}
                    onMouseEnter={() => prefetchRoute(item.url)}
                    onTouchStart={() => prefetchRoute(item.url)}
                    activeClassName=""

                    className={cn(
                       "group/nav relative flex h-11 w-full items-center gap-3 overflow-hidden rounded-xl px-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      "transition-colors duration-200 ease-out",
                      isActive
                         ? "border border-transparent bg-sidebar-accent font-bold text-sidebar-accent-foreground"
                         : "border border-transparent font-medium text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <span
                      className={cn(
                         "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center transition-colors duration-300 ease-out",
                        isActive
                          ? "text-primary"
                          : "text-sidebar-foreground/48 group-hover/nav:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon
                         size={22}
                         strokeWidth={isActive ? 1.9 : 1.6}
                      />
                    </span>

                    <span className="sidebar-item-label relative z-10 truncate">{item.title}</span>

                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={cn(
                          "sidebar-item-meta relative z-10 ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-1 font-numbers text-[9.5px] font-bold leading-none tabular-nums",
                          isActive
                            ? "bg-primary/[0.14] text-primary"
                            : "bg-sidebar-foreground/[0.07] text-sidebar-foreground/45 group-hover/nav:text-sidebar-foreground/70",
                        )}
                      >
                        {item.count > 99 ? "99+" : item.count}
                      </span>
                    )}

                    {isActive && (
                      <span
                        aria-hidden
                        className="sidebar-item-meta absolute right-3.5 h-1.5 w-1.5 rounded-full bg-primary"
                      />
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




type AppSidebarProps = {
  pinned?: boolean;
  onTogglePin?: () => void;
  onHoverChange?: (hovering: boolean) => void;
};

export function AppSidebar({ pinned = true, onTogglePin, onHoverChange }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const overlaying = !pinned && !collapsed && !isMobile;

  const { user } = useAuth();
  const [counts, setCounts] = useState({ products: 0, courses: 0, subscriptions: 0, coupons: 0 });
  const supportUnread = useSupportUnread();

  // Lifetime range so the all-time revenue milestone stays correct, backed by
  // the seller dashboard aggregate RPC (cached 5min, not refetched per-route).
  const lifetimeRange = useMemo(() => ({ from: new Date(0), to: new Date() }), []);
  const { data: dashboardStats } = useDashboardStats(lifetimeRange.from, lifetimeRange.to, "month");
  const revenue = Number(dashboardStats?.current?.revenue ?? 0);

  useEffect(() => {
    let ignore = false;
    if (!user?.id) {
      setCounts({ products: 0, courses: 0, subscriptions: 0, coupons: 0 });
      return;
    }
    const load = async () => {
      const [{ count: products }, { count: courses }, { count: subscriptions }, { count: coupons }] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("seller_user_id", user.id).eq("status", "active"),
        supabase.from("coupons").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
      ]);

      if (ignore) return;

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

  const items: SidebarItem[] = useMemo(() => [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, exact: true },
    { title: "Vendas", url: "/vendas", icon: TrendingUp, exact: true },
    { title: "Produtos", url: "/vendas/produtos", icon: Package, count: counts.products },
    { title: "Cupons", url: "/vendas/cupons", icon: TicketPercent, count: counts.coupons },
    { title: "Financeiro", url: "/financeiro/saques", icon: Wallet },
    { title: "Apps & Integrações", url: "/integracoes", icon: Grid2X2 },
    { title: "Meu Perfil & KYC", url: "/perfil", icon: CircleUserRound },
    { title: "Premiações", url: "/premiacoes", icon: Trophy },
    { title: "Suporte", url: "/suporte", icon: MessageSquare, count: supportUnread },
  ], [counts, supportUnread]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={cn(
        "technical-sidebar z-40 overflow-hidden border-r border-sidebar-border/60",
        overlaying && "technical-sidebar-overlay",
      )}
    >
      <SidebarHeader className="relative px-4 pb-4 pt-5">
        {/* Brand + pino */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden">
            <VenxpayLogo size={30} />
          </div>
          <div className="sidebar-expanded-detail min-w-0 flex-1">
            <h1 className="font-heading text-[15px] leading-none tracking-[-0.02em] text-sidebar-accent-foreground">
              Vemprapay
            </h1>
          </div>
          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              aria-pressed={pinned}
              aria-label={pinned ? "Soltar menu (expandir ao passar o mouse)" : "Fixar menu"}
              title={pinned ? "Soltar menu" : "Fixar menu"}
              className={cn(
                "sidebar-expanded-detail hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] transition-colors",
                pinned
                  ? "text-primary"
                  : "text-sidebar-foreground/40 hover:text-foreground",
              )}
            >
              <PinIcon size={15} active={pinned} />
            </button>
          )}
        </div>
        <RevenueBar
          collapsed={collapsed}
          revenue={revenue}
          milestone={milestone}
          onOpenRewards={() => navigate("/premiacoes")}
        />
      </SidebarHeader>

      <SidebarContent className="relative gap-0 overflow-y-auto px-1.5 py-4">
        <SidebarNavList items={items} pathname={location.pathname} />
      </SidebarContent>

      <SidebarFooter className="relative shrink-0 border-t border-sidebar-border/60 p-2.5">
        <div className="flex w-full items-center justify-center gap-2 group-data-[collapsible=icon]:w-[51px] group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
          <button
            type="button"
            onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
            aria-label="Fale conosco"
            title="Fale conosco"
            className="flex h-11 flex-1 items-center justify-center rounded-[12px] border border-transparent text-primary transition-colors duration-200 hover:border-primary/20 hover:bg-primary/[0.08] group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:flex-none"
          >
            <Headset size={22} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => navigate("/suporte")}
            aria-label="Central de ajuda"
            title="Central de ajuda"
            className="flex h-11 flex-1 items-center justify-center rounded-[12px] border border-transparent text-sidebar-foreground/65 transition-colors duration-200 hover:border-sidebar-border/70 hover:bg-sidebar-accent/45 hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:flex-none"
          >
            <CircleHelp size={22} strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair da conta"
            title="Sair da conta"
            className="flex h-11 flex-1 items-center justify-center rounded-[12px] border border-transparent text-sidebar-foreground/65 transition-colors duration-200 hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:flex-none"
          >
            <LogOut size={22} strokeWidth={1.7} />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
