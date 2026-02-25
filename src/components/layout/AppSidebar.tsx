import {
  LayoutDashboard, Wallet, FileText, Building2, ArrowDownToLine,
  ShoppingCart, Package, ExternalLink, LogOut, UserCircle,
  Webhook, Ticket, BookOpen, PlayCircle, Layers, User, Puzzle,
  PieChart, Zap, GraduationCap, CreditCard, BarChart2,
  Settings, HelpCircle, Rocket,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";

const sections = [
  {
    label: "GERAL",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Minhas Vendas", url: "/vendas", icon: BarChart2 },
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
    label: "CONFIGURAÇÕES",
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
    <Sidebar className="w-[250px] border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Rocket className="h-[18px] w-[18px] text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-display font-extrabold text-white tracking-tight leading-none">HOTZFY</h1>
            <p className="text-[8px] text-sidebar-foreground/30 font-semibold tracking-[0.3em] uppercase mt-0.5">Infoprodutos</p>
          </div>
        </div>
      </div>

      <SidebarContent className="px-2.5 py-3 overflow-y-auto">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={idx > 0 ? "mt-4" : ""}>
            <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/25 font-bold px-3 mb-1">
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
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground/60 hover:text-white hover:bg-white/[0.04] transition-all duration-150 group relative font-medium"
                        activeClassName="text-white font-semibold bg-sidebar-accent border border-sidebar-primary/15"
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

      <SidebarFooter className="p-2.5 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sidebar-foreground/30 hover:text-destructive hover:bg-destructive/[0.05] transition-all w-full text-[13px] font-medium"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
