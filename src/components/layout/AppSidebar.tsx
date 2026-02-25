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

const MILESTONES = [
  { label: "R$ 0", value: 0 },
  { label: "R$ 10K", value: 10000 },
  { label: "R$ 100K", value: 100000 },
  { label: "R$ 500K", value: 500000 },
  { label: "R$ 1M", value: 1000000 },
  { label: "R$ 5M", value: 5000000 },
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
    <Sidebar className="border-r border-sidebar-border bg-sidebar backdrop-blur-xl">
      <SidebarHeader className="relative px-4 pt-5 pb-4 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="h-10 w-10 rounded-xl overflow-hidden shadow-lg shadow-sidebar-primary/20 ring-1 ring-sidebar-primary/20 shrink-0">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-xl leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">HOTZFY</h1>
            <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground mt-0.5">Infoprodutos</p>
          </div>
        </div>

        {/* ─── Milestone Progress ─── */}
        <div className="mt-4 group-data-[collapsible=icon]:hidden">
          <div className="rounded-xl bg-sidebar-accent/60 border border-sidebar-border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-sidebar-primary" />
                <span className="text-[10px] font-semibold text-sidebar-foreground">{displayName}</span>
              </div>
              <span className="text-[11px] font-black text-sidebar-primary">{fmtCompact(revenue)}</span>
            </div>

            {/* Progress bar */}
            <div className="relative h-2 w-full rounded-full bg-sidebar-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(milestone.pct, 3)}%`,
                  background: "linear-gradient(90deg, hsl(152 58% 38%), hsl(152 58% 52%))",
                  animation: milestone.pct > 0 ? "progressGlow 2s ease-in-out infinite" : "none",
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[9px] text-sidebar-foreground/50">{milestone.current.label}</span>
              <span className="text-[9px] font-bold text-sidebar-primary/80">{milestone.next.label}</span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative px-2.5 py-3 overflow-y-auto">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={cn("px-0", idx > 0 && "mt-2")}>
            <SidebarGroupLabel className="px-3.5 mb-1 text-[10px] uppercase tracking-[0.2em] font-semibold text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5 px-1">
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
                            "group/nav relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium leading-none transition-all duration-150 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary group-data-[collapsible=icon]:hidden" />
                          )}
                          <item.icon className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60",
                          )} />
                          <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                          {item.badge && (
                            <span className="ml-auto rounded-md bg-sidebar-primary/15 px-1.5 py-0.5 text-[8px] font-bold text-sidebar-primary group-data-[collapsible=icon]:hidden">
                              {item.badge}
                            </span>
                          )}
                          {isActive && <ChevronRight className="ml-auto h-3 w-3 text-sidebar-primary/50 group-data-[collapsible=icon]:hidden" />}
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

      <SidebarFooter className="relative p-3 border-t border-sidebar-border">
        <button
          onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
          className="mb-2 w-full flex items-center gap-2.5 rounded-xl border border-sidebar-primary/15 bg-sidebar-primary/[0.06] p-2.5 text-left transition-all hover:bg-sidebar-primary/[0.1] group-data-[collapsible=icon]:hidden"
        >
          <Headphones className="h-4 w-4 text-sidebar-primary shrink-0" />
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-sidebar-accent-foreground block">Suporte para Escalar</span>
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-foreground/60 transition-all hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
