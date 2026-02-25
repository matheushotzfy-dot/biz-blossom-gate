import {
  LayoutDashboard, Wallet, FileText, Building2, ArrowDownToLine,
  ShoppingCart, Package, ExternalLink, LogOut, CreditCard, UserCircle,
  Webhook, Ticket, BookOpen, PlayCircle, Layers, User, Puzzle,
  PieChart,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
];

const financeItems = [
  { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
  { title: "Dados Bancários", url: "/financeiro/dados-bancarios", icon: Building2 },
  { title: "Identidade & KYC", url: "/financeiro/identidade", icon: UserCircle },
  { title: "Saques", url: "/financeiro/saques", icon: ArrowDownToLine },
  { title: "Controle de Gastos", url: "/financeiro/gastos", icon: PieChart },
];

const salesItems = [
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Produtos", url: "/vendas/produtos", icon: Package },
  { title: "Checkout", url: "/vendas/checkout", icon: ExternalLink },
  { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
  { title: "Cupons", url: "/vendas/cupons", icon: Ticket },
  { title: "Webhooks", url: "/vendas/webhooks", icon: Webhook },
  { title: "API Docs", url: "/vendas/documentacao", icon: BookOpen },
];

const integrationItems = [
  { title: "Apps", url: "/integracoes/apps", icon: Puzzle },
];

const memberItems = [
  { title: "Meus Cursos", url: "/membros", icon: PlayCircle },
];

const accountItems = [
  { title: "Meu Perfil", url: "/perfil", icon: User },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const isActive = (url: string) => {
    if (url === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(url);
  };

  const renderItems = (items: typeof mainItems) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/dashboard"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/70 hover:text-foreground hover:bg-sidebar-accent/80 transition-all duration-200 group relative"
            activeClassName="text-primary font-semibold bg-primary/10 shadow-sm"
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full opacity-0 group-[.active]:opacity-100 transition-all bg-primary" />
            <item.icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-200" />
            <span className="text-[14px] font-medium tracking-tight">{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/40 font-bold px-3 mb-1.5">
      {children}
    </SidebarGroupLabel>
  );

  return (
    <Sidebar className="w-[260px] border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary text-primary-foreground shadow-lg">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[16px] font-extrabold text-sidebar-foreground tracking-tight">PayGate</h1>
            <p className="text-[11px] text-sidebar-foreground/40 font-medium">Gateway de Pagamentos</p>
          </div>
        </div>
      </div>

      <SidebarContent className="px-3 py-5 overflow-y-auto">
        <SidebarGroup>
          <SectionLabel>Principal</SectionLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(mainItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SectionLabel>Financeiro</SectionLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(financeItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SectionLabel>Vendas</SectionLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(salesItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SectionLabel>Membros</SectionLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(memberItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SectionLabel>Integrações</SectionLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(integrationItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SectionLabel>Conta</SectionLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(accountItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/8 transition-all duration-200 w-full text-[14px] font-medium"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span>Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
