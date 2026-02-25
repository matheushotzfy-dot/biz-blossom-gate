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
  Rocket,
  Zap,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Sidebar className="border-r border-sidebar-border/80 bg-sidebar/95 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-20 h-80 w-80 rounded-full bg-sidebar-primary/12 blur-[90px]" />
        <div className="absolute bottom-6 -right-10 h-64 w-64 rounded-full bg-sidebar-primary/10 blur-[84px]" />
      </div>

      <SidebarHeader className="relative px-4 pt-5 pb-4 border-b border-sidebar-border/80">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center") }>
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-sidebar-primary/25 ring-1 ring-sidebar-primary/30 shrink-0">
            <Rocket className="h-6 w-6 text-primary-foreground" />
          </div>

          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-[30px] leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">HOTZFY</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sidebar-foreground mt-1">Infoprodutos Ecosystem</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2.5 group-data-[collapsible=icon]:hidden">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/55 px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/80">Plano</span>
              <span className="text-[12px] font-black text-sidebar-primary">Enterprise</span>
            </div>
          </div>
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/55 px-3.5 py-2.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sidebar-primary animate-pulse" />
            <span className="text-[12px] font-bold text-sidebar-accent-foreground">Online</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative px-2.5 py-4 overflow-y-auto">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={cn("px-0", idx > 0 && "mt-3.5")}>
            <SidebarGroupLabel className="px-3.5 mb-2 text-[10px] uppercase tracking-[0.22em] font-bold text-sidebar-foreground/75 group-data-[collapsible=icon]:hidden">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1.5 px-1">
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
                            "group/nav relative flex items-center gap-3 rounded-2xl border px-3.5 py-3.5 text-[16px] font-semibold leading-none transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                            isActive
                              ? "border-sidebar-primary/35 bg-sidebar-accent text-sidebar-accent-foreground shadow-lg shadow-sidebar-primary/10"
                              : "border-transparent text-sidebar-foreground hover:border-sidebar-border hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary group-data-[collapsible=icon]:hidden" />
                          )}

                          <span
                            className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                              isActive
                                ? "bg-sidebar-primary/15 text-sidebar-primary"
                                : "bg-sidebar-accent/45 text-sidebar-foreground group-hover/nav:bg-sidebar-accent group-hover/nav:text-sidebar-accent-foreground",
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                          </span>

                          <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>

                          {item.badge && (
                            <span className="ml-auto rounded-md bg-sidebar-primary/15 px-2 py-0.5 text-[10px] font-bold text-sidebar-primary group-data-[collapsible=icon]:hidden">
                              {item.badge}
                            </span>
                          )}

                          {isActive && <ChevronRight className="h-4 w-4 text-sidebar-primary/65 group-data-[collapsible=icon]:hidden" />}
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

      <SidebarFooter className="relative p-3 border-t border-sidebar-border/80">
        <div className="mb-2 rounded-2xl border border-sidebar-primary/20 bg-sidebar-primary/[0.09] p-3.5 group-data-[collapsible=icon]:hidden">
          <div className="mb-1.5 flex items-center gap-2">
            <Zap className="h-4 w-4 text-sidebar-primary" />
            <span className="text-[12px] font-black text-sidebar-accent-foreground">Modo Escala Ativo</span>
          </div>
          <p className="text-[11px] leading-relaxed text-sidebar-foreground/90">
            Analytics avançado, checkout otimizado e automações para crescer sem fricção.
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1 rounded-full border border-sidebar-primary/25 bg-sidebar-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-primary">
            <Sparkles className="h-3 w-3" /> Enterprise
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold text-sidebar-foreground/85 transition-all hover:bg-destructive/[0.1] hover:text-destructive group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span className="group-data-[collapsible=icon]:hidden">Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

