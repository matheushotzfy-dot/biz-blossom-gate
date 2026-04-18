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
  MessageSquare,
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
    return { current: lastMilestone, next: lastMilestone, pct: 100 };
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
  return { current, next, pct };
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
      className="mt-3 block w-full rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 text-left transition-colors hover:bg-sidebar-accent/50"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/55">
          Faturamento total
        </p>
        <Trophy className="h-3.5 w-3.5 text-sidebar-foreground/40" strokeWidth={2} />
      </div>
      <p className="mt-1.5 font-display text-[22px] font-bold leading-none tracking-tight text-sidebar-accent-foreground tabular-nums">
        {formatRevenue(revenue)}
      </p>

      <div className="mt-3 flex items-center justify-between text-[10.5px] font-medium tabular-nums text-sidebar-foreground/60">
        <span>{milestone.current.label}</span>
        <span>{milestone.next.label}</span>
      </div>

      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sidebar-border">
        <div
          className="h-full rounded-full bg-sidebar-foreground/70 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-1.5 text-[10.5px] font-semibold tabular-nums text-sidebar-foreground/70">
        {pct}% até a próxima meta
      </p>
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
      <div className="px-3 pb-1 pt-3 group-data-[collapsible=icon]:hidden">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
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
                      "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[15px] w-[15px] shrink-0",
                        isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/55",
                      )}
                      strokeWidth={2}
                    />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="ml-auto rounded bg-sidebar-border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
                        {item.badge}
                      </span>
                    )}
                    {item.count !== undefined && item.count > 0 && !item.badge && (
                      <span className="ml-auto rounded bg-sidebar-border/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
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
  const [counts, setCounts] = useState({ products: 0, courses: 0, subscriptions: 0, coupons: 0 });

  useEffect(() => {
    let ignore = false;
    if (!user?.id) {
      setRevenue(0);
      setCounts({ products: 0, courses: 0, subscriptions: 0, coupons: 0 });
      return;
    }
    const load = async () => {
      const [{ data: tx }, { count: products }, { count: courses }, { count: subscriptions }, { count: coupons }] = await Promise.all([
        supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed"),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("seller_user_id", user.id).eq("status", "active"),
        supabase.from("coupons").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
      ]);

      if (ignore) return;

      if (tx) {
        const total = tx.reduce((sum, t) => sum + Number(t.net_amount ?? 0), 0);
        setRevenue(total);
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
      <SidebarHeader className="border-b border-sidebar-border px-3 pb-3 pt-3">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-sidebar-border bg-card">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-[17px] leading-none font-display font-bold tracking-tight text-sidebar-accent-foreground">
              HOTZFY
            </h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] font-medium text-sidebar-foreground/50">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Operacional
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

      <SidebarContent className="gap-0 overflow-y-auto px-2 py-2">
        {sections.map((section) => (
          <SidebarSectionNav key={section.label} section={section} pathname={location.pathname} />
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-1.5 border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={() => navigate("/perfil")}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/50 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/40 text-[12px] font-semibold text-sidebar-accent-foreground">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[12.5px] font-semibold leading-tight text-sidebar-accent-foreground">
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
          className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[12px] font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-[14px] w-[14px] shrink-0" strokeWidth={2} />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
