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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
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
      { title: "Identidade & KYC", url: "/financeiro/identidade", icon: UserCircle },
      { title: "Meu Perfil", url: "/perfil", icon: User },
    ],
  },
];

export function AppSidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Sidebar className="w-[278px] border-r border-sidebar-border bg-sidebar relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-10 left-5 h-40 w-40 rounded-full bg-sidebar-primary/15 blur-3xl" />
      </div>

      <div className="px-4 pt-4 pb-3 border-b border-sidebar-border relative">
        <div className="rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 p-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-sidebar-primary/20">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl leading-none font-display font-extrabold tracking-tight text-sidebar-accent-foreground">HOTZFY</h1>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/60 mt-0.5">Infoprodutos OS</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-sidebar-border bg-sidebar/50 px-2.5 py-2">
              <p className="text-[8px] uppercase tracking-widest text-sidebar-foreground/55">Operação</p>
              <p className="text-[11px] font-bold text-sidebar-accent-foreground mt-0.5">Enterprise</p>
            </div>
            <div className="rounded-lg border border-sidebar-border bg-sidebar/50 px-2.5 py-2">
              <p className="text-[8px] uppercase tracking-widest text-sidebar-foreground/55">Status</p>
              <p className="text-[11px] font-bold text-sidebar-primary mt-0.5">Online</p>
            </div>
          </div>
        </div>
      </div>

      <SidebarContent className="px-3 py-3 overflow-y-auto relative">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={idx > 0 ? "mt-4" : ""}>
            <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.18em] text-sidebar-foreground/45 font-bold px-3 mb-1">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/65 transition-all duration-150 group relative font-medium border border-transparent"
                        activeClassName="text-sidebar-accent-foreground font-semibold bg-sidebar-accent border border-sidebar-primary/25"
                      >
                        <item.icon className="h-4 w-4 shrink-0 group-[.active]:text-sidebar-primary" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border relative">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/35 p-2.5 mb-2.5">
          <p className="text-[10px] font-semibold text-sidebar-accent-foreground">Suporte Priority</p>
          <p className="text-[9px] text-sidebar-foreground/65 mt-0.5">hotzfy.app/suporte</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/[0.08] transition-all w-full text-[13px] font-medium"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
