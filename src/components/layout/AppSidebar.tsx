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
} from "@/components/ui/sidebar";

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
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Sidebar className="w-[320px] border-r border-sidebar-border bg-sidebar relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-sidebar-primary/12 blur-[90px]" />
        <div className="absolute bottom-10 right-0 h-52 w-52 rounded-full bg-sidebar-primary/8 blur-[80px]" />
      </div>

      <div className="relative px-6 pt-6 pb-5 border-b border-sidebar-border/80">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-sidebar-primary/30 ring-1 ring-sidebar-primary/25">
            <Rocket className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-[24px] leading-none font-display font-black tracking-tight text-sidebar-accent-foreground">HOTZFY</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground mt-1">Infoprodutos Ecosystem</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/45 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/70">Plano</span>
              <span className="text-[11px] font-bold text-sidebar-primary">Enterprise</span>
            </div>
          </div>
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/45 px-3 py-2.5 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-sidebar-primary animate-pulse" />
            <span className="text-[11px] font-bold text-sidebar-accent-foreground">Online</span>
          </div>
        </div>
      </div>

      <SidebarContent className="px-3.5 py-4 overflow-y-auto relative">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={idx > 0 ? "mt-5" : ""}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/70 font-bold px-3 mb-2">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1.5">
                {section.items.map((item) => {
                  const isActive = item.url === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(item.url);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/dashboard"}
                          className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[15px] transition-all duration-200 group relative font-medium border ${
                            isActive
                              ? "text-sidebar-accent-foreground font-semibold bg-sidebar-accent border-sidebar-primary/30 shadow-lg shadow-sidebar-primary/10"
                              : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 border-transparent hover:border-sidebar-border"
                          }`}
                          activeClassName=""
                        >
                          {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-sidebar-primary" />}
                          <div
                            className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isActive
                                ? "bg-sidebar-primary/15 text-sidebar-primary"
                                : "bg-sidebar-accent/40 text-sidebar-foreground group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground"
                            }`}
                          >
                            <item.icon className="h-5 w-5" />
                          </div>
                          <span className="flex-1 leading-none">{item.title}</span>
                          {item.badge && <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-sidebar-primary/15 text-sidebar-primary">{item.badge}</span>}
                          {isActive && <ChevronRight className="h-4 w-4 text-sidebar-primary/60" />}
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

      <SidebarFooter className="p-3.5 border-t border-sidebar-border relative">
        <div className="rounded-xl border border-sidebar-primary/20 bg-sidebar-primary/[0.08] p-3.5 mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="h-4 w-4 text-sidebar-primary" />
            <span className="text-[12px] font-bold text-sidebar-accent-foreground">Modo Escala Ativo</span>
          </div>
          <p className="text-[11px] text-sidebar-foreground/85 leading-relaxed">Analytics avançado, checkout otimizado e automações para crescer sem fricção.</p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/80 hover:text-destructive hover:bg-destructive/[0.08] transition-all w-full text-[14px] font-medium"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

