import {
  LayoutDashboard,
  Wallet,
  FileText,
  Percent,
  Building2,
  ArrowDownToLine,
  ShoppingCart,
  Package,
  ExternalLink,
  Shield,
  Users,
  Settings,
  LogOut,
  CreditCard,
  UserCircle,
  Webhook,
  Ticket,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
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

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
];

const financeItems = [
  { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
  { title: "Taxas", url: "/financeiro/taxas", icon: Percent },
  { title: "Dados Bancários", url: "/financeiro/dados-bancarios", icon: Building2 },
  { title: "Identidade", url: "/financeiro/identidade", icon: UserCircle },
  { title: "Saques", url: "/financeiro/saques", icon: ArrowDownToLine },
];

const salesItems = [
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Produtos", url: "/vendas/produtos", icon: Package },
  { title: "Checkout", url: "/vendas/checkout", icon: ExternalLink },
  { title: "Cupons", url: "/vendas/cupons", icon: Ticket },
  { title: "Webhooks", url: "/vendas/webhooks", icon: Webhook },
];

const adminItems = [
  { title: "Painel Admin", url: "/admin", icon: Shield },
  { title: "Usuários", url: "/admin/usuarios", icon: Users },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const renderItems = (items: typeof mainItems) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/dashboard"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
            activeClassName="bg-sidebar-accent text-primary font-semibold"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="text-sm">{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar className="w-64 border-r border-sidebar-border gradient-sidebar">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-accent-foreground tracking-tight">PayGate</h1>
            <p className="text-[11px] text-sidebar-foreground">Gateway de Pagamentos</p>
          </div>
        </div>
      </div>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold px-3 mb-1">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold px-3 mb-1">
            Financeiro
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(financeItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold px-3 mb-1">
            Vendas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(salesItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold px-3 mb-1">
            Administração
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(adminItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 w-full text-sm"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
