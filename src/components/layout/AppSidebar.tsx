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
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
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
    <Sidebar className="w-[280px] border-r border-sidebar-border bg-sidebar relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-10 h-60 w-60 rounded-full bg-sidebar-primary/10 blur-[80px]" />
        <div className="absolute bottom-20 right-0 h-40 w-40 rounded-full bg-sidebar-primary/5 blur-[60px]" />
      </div>

      {/* Brand header */}
      <div className="relative px-5 pt-5 pb-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-sidebar-primary/30 ring-1 ring-sidebar-primary/20">
            <Rocket className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-[22px] leading-none font-display font-black tracking-tight text-white">HOTZFY</h1>
            <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-sidebar-primary/70 mt-1">Infoprodutos Platform</p>
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/50">Plano</span>
              <span className="text-[10px] font-bold text-sidebar-primary">Enterprise</span>
            </div>
          </div>
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-sidebar-primary" style={{ animation: "pulse-glow 2s ease infinite" }} />
            <span className="text-[10px] font-bold text-sidebar-accent-foreground">Live</span>
          </div>
        </div>
      </div>

      <SidebarContent className="px-3 py-4 overflow-y-auto relative">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={idx > 0 ? "mt-5" : ""}>
            <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/40 font-bold px-3 mb-2">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {section.items.map((item) => {
                  const isActive = item.url === "/dashboard"
                    ? location.pathname === "/dashboard"
                    : location.pathname.startsWith(item.url);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/dashboard"}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] transition-all duration-200 group relative font-medium border ${
                            isActive
                              ? "text-white font-semibold bg-sidebar-accent border-sidebar-primary/25 shadow-lg shadow-sidebar-primary/10"
                              : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 border-transparent hover:border-sidebar-border"
                          }`}
                          activeClassName=""
                        >
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />
                          )}
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isActive ? "bg-sidebar-primary/15 text-sidebar-primary" : "bg-sidebar-accent/40 text-sidebar-foreground group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground"
                          }`}>
                            <item.icon className="h-[18px] w-[18px]" />
                          </div>
                          <span className="flex-1">{item.title}</span>
                          {isActive && <ChevronRight className="h-3.5 w-3.5 text-sidebar-primary/50" />}
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

      <SidebarFooter className="p-3 border-t border-sidebar-border relative">
        {/* CTA card */}
        <div className="rounded-xl border border-sidebar-primary/15 bg-sidebar-primary/[0.06] p-3 mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="h-3.5 w-3.5 text-sidebar-primary" />
            <span className="text-[11px] font-bold text-sidebar-accent-foreground">Upgrade Performance</span>
          </div>
          <p className="text-[10px] text-sidebar-foreground/70 leading-relaxed">Desbloqueie analytics avançado e checkout A/B</p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/[0.06] transition-all w-full text-[13px] font-medium"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
