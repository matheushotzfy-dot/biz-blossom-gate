import {
  LayoutDashboard, Wallet, FileText, Building2, ArrowDownToLine,
  ShoppingCart, Package, ExternalLink, LogOut, UserCircle,
  Webhook, Ticket, BookOpen, PlayCircle, Layers, User, Puzzle,
  PieChart, Shield,
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
    label: "PRINCIPAL",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
      { title: "Saques", url: "/financeiro/saques", icon: ArrowDownToLine },
      { title: "Dados Bancários", url: "/financeiro/dados-bancarios", icon: Building2 },
      { title: "Controle de Gastos", url: "/financeiro/gastos", icon: PieChart },
      { title: "Identidade", url: "/financeiro/identidade", icon: UserCircle },
    ],
  },
  {
    label: "VENDAS",
    items: [
      { title: "Minhas Vendas", url: "/vendas", icon: ShoppingCart },
      { title: "Produtos", url: "/vendas/produtos", icon: Package },
      { title: "Checkout", url: "/vendas/checkout", icon: ExternalLink },
      { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
      { title: "Cupons", url: "/vendas/cupons", icon: Ticket },
      { title: "Webhooks", url: "/vendas/webhooks", icon: Webhook },
      { title: "API Docs", url: "/vendas/documentacao", icon: BookOpen },
    ],
  },
  {
    label: "PLATAFORMA",
    items: [
      { title: "Área de Membros", url: "/membros", icon: PlayCircle },
      { title: "Apps", url: "/integracoes/apps", icon: Puzzle },
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
    <Sidebar className="w-[256px] border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
            <Shield className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold text-white tracking-tight leading-none">SAFRAPAY</h1>
            <p className="text-[9px] text-sidebar-foreground/40 font-semibold tracking-[0.2em] mt-0.5">PAYMENT GATEWAY</p>
          </div>
        </div>
      </div>

      <SidebarContent className="px-3 py-3 overflow-y-auto">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={idx > 0 ? "mt-5" : ""}>
            <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/25 font-bold px-3 mb-1.5">
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
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/55 hover:text-white hover:bg-white/[0.04] transition-all duration-150 group relative"
                        activeClassName="text-white font-semibold bg-sidebar-accent border border-sidebar-primary/20"
                      >
                        <item.icon className="h-4 w-4 shrink-0 group-[.active]:text-sidebar-primary" />
                        <span className="text-[13px] font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/35 hover:text-red-400 hover:bg-red-500/[0.06] transition-all w-full text-[13px] font-medium"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
