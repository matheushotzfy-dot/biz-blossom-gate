import {
  LayoutDashboard,
  BarChart3,
  Package,
  CreditCard,
  GraduationCap,
  Bitcoin,
  Handshake,
  Users,
  Layers,
  Trophy,
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
  Headphones,
  Zap,
  TrendingUp,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import hotzfyLogo from "@/assets/hotzfy-logo.png";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo } from "react";
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
  return { current, next, pct, tier: MILESTONES.indexOf(current) };
}

const sections = [
  {
    label: "COMANDO",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Minhas Vendas", url: "/vendas", icon: BarChart3 },
    ],
  },
  {
    label: "INFOPRODUTOS",
    items: [
      { title: "Produtos", url: "/vendas/produtos", icon: Package },
      { title: "Afiliados", url: "/vendas/afiliados", icon: Users },
      { title: "Coproduções", url: "/vendas/coproducoes", icon: Handshake },
      { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
      { title: "Saques PIX", url: "/financeiro/saques", icon: ArrowDownToLine },
      { title: "Saques Crypto", url: "/financeiro/saques-crypto", icon: Bitcoin },
      { title: "Dados Bancários", url: "/financeiro/dados-bancarios", icon: Building2 },
      { title: "Taxas", url: "/financeiro/taxas", icon: Zap },
      { title: "Controle de Gastos", url: "/financeiro/gastos", icon: PieChart },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { title: "Checkout", url: "/vendas/checkout", icon: CreditCard },
      { title: "Webhooks", url: "/vendas/webhooks", icon: Webhook },
      { title: "Integrações", url: "/integracoes/apps", icon: Puzzle },
      { title: "API Docs", url: "/vendas/documentacao", icon: BookOpen },
      { title: "Identidade", url: "/financeiro/identidade", icon: UserCircle },
      { title: "Meu Perfil", url: "/perfil", icon: User },
    ],
  },
  {
    label: "COMPRAS",
    items: [
      { title: "Minhas Compras", url: "/membros", icon: GraduationCap },
      { title: "Premiações", url: "/premiacoes", icon: Trophy },
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

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("transactions")
      .select("net_amount")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .then(({ data }) => {
        if (data) setRevenue(data.reduce((s, t) => s + Number(t.net_amount), 0));
      });
  }, [user?.id]);

  const milestone = useMemo(() => getMilestone(revenue), [revenue]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const fmtRevenue = (v: number) => {
    if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(2).replace('.', ',')}M`;
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}K`;
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/30 bg-sidebar">
      <SidebarHeader className="relative px-3 pt-4 pb-3">
        {/* Logo */}
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="h-10 w-10 rounded-xl overflow-hidden shadow-md ring-1 ring-sidebar-border/40 shrink-0 bg-card">
            <img src={hotzfyLogo} alt="HOTZFY" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-lg leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">HOTZFY</h1>
            <p className="text-[9px] font-semibold text-sidebar-foreground/40 mt-0.5 uppercase tracking-[0.15em]">Gateway</p>
          </div>
        </div>

        {/* Revenue Card */}
        <div className="mt-3 group-data-[collapsible=icon]:hidden cursor-pointer" onClick={() => navigate("/premiacoes")}>
          <div className="relative rounded-xl border border-sidebar-primary/15 bg-sidebar-primary/[0.05] px-3.5 py-3 overflow-hidden group/m hover:border-sidebar-primary/25 active:scale-[0.985] transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-sidebar-primary/12 flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 text-sidebar-primary" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/40">Faturamento</span>
              </div>
              <span className="text-[14px] font-display font-black text-sidebar-accent-foreground tracking-tight">
                {fmtRevenue(revenue)}
              </span>
            </div>
            {/* Progress */}
            <div className="relative h-1.5 w-full rounded-full bg-sidebar-accent/40 overflow-hidden">
              <div
                className="absolute h-full rounded-full bg-gradient-to-r from-sidebar-primary to-sidebar-primary/60 transition-all duration-700"
                style={{ width: `${milestone.pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[8px] font-bold text-sidebar-primary/60">{milestone.current.label}</span>
              <span className="text-[8px] font-bold text-sidebar-foreground/30">{milestone.next.label}</span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative gap-0 px-2 py-1 overflow-y-auto">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className="px-0 py-0">
            {idx > 0 && <div className="mx-3 my-2 border-t border-sidebar-border/15 group-data-[collapsible=icon]:mx-1" />}
            <SidebarGroupLabel className="px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] text-sidebar-foreground/25 group-data-[collapsible=icon]:hidden">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5 px-0.5">
                {section.items.map((item) => {
                  const isActive = item.url === "/dashboard" || item.url === "/vendas"
                    ? location.pathname === item.url
                    : location.pathname.startsWith(item.url);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="h-auto p-0 hover:bg-transparent active:bg-transparent">
                        <NavLink
                          to={item.url}
                          end={item.url === "/dashboard" || item.url === "/vendas"}
                          activeClassName=""
                          className={cn(
                            "group/nav relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium leading-none transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                            isActive
                              ? "bg-sidebar-primary/10 text-sidebar-primary font-semibold"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-5 w-[2.5px] -translate-y-1/2 rounded-r-full bg-sidebar-primary group-data-[collapsible=icon]:hidden" />
                          )}

                          <item.icon className={cn(
                            "h-[16px] w-[16px] shrink-0 transition-colors",
                            isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover/nav:text-sidebar-accent-foreground"
                          )} />

                          <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
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

      <SidebarFooter className="p-2.5 border-t border-sidebar-border/20">
        <button
          onClick={() => window.open("https://wa.me/5511999999999?text=Preciso%20de%20suporte%20para%20escalar!", "_blank")}
          className="mb-1 w-full flex items-center gap-2.5 rounded-lg border border-sidebar-border/20 bg-sidebar-accent/20 p-2.5 text-left transition-all duration-200 hover:bg-sidebar-accent/40 group-data-[collapsible=icon]:hidden"
        >
          <Headphones className="h-4 w-4 text-sidebar-primary shrink-0" />
          <div>
            <span className="text-[11px] font-bold text-sidebar-accent-foreground block">Suporte</span>
            <span className="text-[9px] text-sidebar-foreground/40">WhatsApp</span>
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-sidebar-foreground/50 transition-all duration-200 hover:bg-destructive/8 hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
