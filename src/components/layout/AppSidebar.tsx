import {
  LogOut,
  Headphones,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { useAuth } from "@/hooks/useAuth";
import { useSupportUnread } from "@/hooks/useSupportUnread";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  PinIcon,
  GlyphDashboard,
  GlyphSales,
  GlyphProduct,
  GlyphCoupon,
  GlyphWithdraw,
  GlyphFees,
  GlyphApps,
  GlyphProfile,
  GlyphTrophy,
  GlyphSupport,
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

type GlyphIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;


type SidebarItem = {
  title: string;
  url: string;
  icon: GlyphIcon;
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
      className="seller-clickable group/rev relative mt-3 block w-full overflow-hidden rounded-[10px] border border-sidebar-border/70 bg-transparent px-3 py-2.5 text-left transition-colors hover:border-border"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-sidebar-foreground/55">Faturamento total</span>
        <span className="rounded-[6px] border border-primary/30 px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-[0.1em] text-primary">
          {tierName}
        </span>
      </div>

      {/* Main figure */}
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-numbers text-[12px] font-medium leading-none text-sidebar-foreground/45 tabular-nums">
          {parts.prefix}
        </span>
        <p className="font-numbers text-[21px] font-bold leading-none tracking-[-0.03em] text-sidebar-accent-foreground tabular-nums">
          {parts.value}
          <span className="ml-0.5 text-[14px] font-bold text-sidebar-foreground/55">{parts.suffix}</span>
        </p>
      </div>

      {/* Progress bar */}
      <div className="relative mt-2.5">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-sidebar-border/60">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Scale */}
      <div className="mt-1.5 flex items-center justify-between font-numbers text-[10px] font-medium tabular-nums text-sidebar-foreground/40">
        <span>{milestone.current.label.replace(",", ".")}</span>
        <span>{milestone.next.label.replace(",", ".")}</span>
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between border-t border-sidebar-border/50 pt-2">
        <span className="text-[11px] font-medium text-sidebar-foreground/50">
          <span className="font-numbers font-semibold tabular-nums text-sidebar-accent-foreground">{pctDisplay}%</span> da meta
        </span>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
          Premiações
          <ChevronRight className="h-3 w-3" strokeWidth={2.2} />
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
                <SidebarMenuButton asChild className="h-auto rounded-[12px] p-0 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:!size-auto group-data-[collapsible=icon]:!p-0">
                  <NavLink
                    to={item.url}
                    end={item.exact}
                    activeClassName=""
                    className={cn(
                      "seller-nav-option group/nav relative flex h-[44px] w-full items-center gap-3 rounded-[10px] border border-transparent px-3 text-[13.5px] font-medium",
                      "transition-colors duration-200 ease-out",
 "group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:gap-0",
                      isActive
                        ? "border-primary/60 bg-primary/[0.07] font-semibold text-foreground"
                        : "text-sidebar-foreground/65 hover:border-sidebar-border/70 hover:text-foreground",
                    )}
                  >
                    {/* Active indicator rail */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-primary group-data-[collapsible=icon]:hidden" />
                    )}
                    {/* Collapsed active dot */}
                    {isActive && (
                      <span className="hidden group-data-[collapsible=icon]:block absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                    )}
                    <item.icon
                      className={cn(
 "h-[18px] w-[18px] transition-colors duration-150 ease-out group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground/55 group-hover/nav:text-foreground",
                      )}
                      strokeWidth={isActive ? 2.1 : 1.75}
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
 "ml-auto rounded-[6px] px-2 py-0.5 text-[11px] font-semibold tabular-nums group-data-[collapsible=icon]:hidden",
 "transition-colors duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
                        isActive
                          ? "bg-primary/15 text-primary"
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
  const supportUnread = useSupportUnread();

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
        { title: "Suporte", url: "/suporte", icon: MessageSquare, count: supportUnread },
      ],
    },
  ], [counts, supportUnread]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const userInitial = (user?.email || "U").charAt(0).toUpperCase();
  const userName = user?.email?.split("@")[0] ?? "Vendedor";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/70 bg-sidebar">
      <SidebarHeader className="relative border-b border-sidebar-border/70 px-4 pb-4 pt-4">
        {/* Brand */}
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="relative h-10 w-10 shrink-0 flex items-center justify-center overflow-hidden rounded-[10px] border border-sidebar-border/70 bg-transparent">
            <VenxpayLogo size={30} />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <h1 className="font-heading text-[16px] leading-none tracking-[-0.02em] text-sidebar-accent-foreground">
                VENXPAY
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


      <SidebarFooter className="relative border-t border-sidebar-border/60 p-2.5 pb-3">
        {/* Expanded footer */}
        <div className="group-data-[collapsible=icon]:hidden flex flex-col gap-2">
          {/* User row: avatar + info + logout */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/perfil")}
              className="seller-clickable flex items-center gap-2.5 rounded-[10px] p-1.5 text-left hover:bg-sidebar-accent/40"
            >
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-primary/30 bg-primary/[0.07] text-[12px] font-semibold text-primary">
                {userInitial}
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-sidebar bg-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold leading-tight text-sidebar-accent-foreground">
                  {userName}
                </p>
                <p className="truncate text-[10px] leading-tight text-sidebar-foreground/50">
                  {user?.email}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sair da conta"
              className="seller-clickable ml-auto flex h-8 w-8 items-center justify-center rounded-[9px] text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {/* Compact help row */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
              className="flex flex-1 items-center justify-center gap-1.5 h-8 rounded-[9px] border border-primary/30 bg-primary/[0.07] px-2 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary/[0.12]"
            >
              <Headphones className="h-3.5 w-3.5" strokeWidth={2.5} />
              Fale conosco
            </button>
            <button
              type="button"
              onClick={() => navigate("/suporte")}
              className="flex flex-1 items-center justify-center gap-1.5 h-8 rounded-[9px] border border-border/70 px-2 text-[11.5px] font-medium text-sidebar-foreground/70 transition-colors hover:border-border hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
              Central de ajuda
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("venxpay:open-cookie-settings"))}
            className="text-[10px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/70"
          >
            Preferências de cookies
          </button>
        </div>

        {/* Collapsed footer */}
        <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/perfil")}
            aria-label="Meu perfil"
            className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-primary/30 bg-primary/[0.07] text-[12px] font-semibold text-primary hover:bg-primary/[0.12]"
          >
            {userInitial}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-sidebar bg-success" />
          </button>
          <button
            type="button"
            onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
            aria-label="Fale conosco"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-primary/30 bg-primary/[0.07] text-primary hover:bg-primary/[0.12]"
          >
            <Headphones className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => navigate("/suporte")}
            aria-label="Central de ajuda"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border/70 text-sidebar-foreground/70 hover:border-border hover:text-foreground"
          >
            <MessageSquare className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair da conta"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
