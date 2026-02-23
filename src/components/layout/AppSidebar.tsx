import {
  LayoutDashboard, Wallet, FileText, Percent, Building2, ArrowDownToLine,
  ShoppingCart, Package, ExternalLink, LogOut, CreditCard, UserCircle,
  Webhook, Ticket, ChevronDown, BookOpen, PlayCircle, Layers,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
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
  { title: "Taxas", url: "/financeiro/taxas", icon: Percent },
  { title: "Dados Bancários", url: "/financeiro/dados-bancarios", icon: Building2 },
  { title: "Identidade & KYC", url: "/financeiro/identidade", icon: UserCircle },
  { title: "Saques", url: "/financeiro/saques", icon: ArrowDownToLine },
];

const salesItems = [
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Produtos", url: "/vendas/produtos", icon: Package },
  { title: "Checkout", url: "/vendas/checkout", icon: ExternalLink },
  { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
  { title: "Cupons", url: "/vendas/cupons", icon: Ticket },
  { title: "Webhooks", url: "/vendas/webhooks", icon: Webhook },
  { title: "Documentação API", url: "/vendas/documentacao", icon: BookOpen },
];

const memberItems = [
  { title: "Meus Cursos", url: "/membros", icon: PlayCircle },
];

export function AppSidebar() {
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group"
            activeClassName="bg-primary/10 text-primary font-semibold shadow-sm"
          >
            <item.icon className="h-[18px] w-[18px] shrink-0 group-hover:scale-105 transition-transform" />
            <span className="text-[13px]">{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar className="w-[260px] border-r border-sidebar-border bg-[hsl(220,30%,5%)]">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/20">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white tracking-tight">PayGate</h1>
            <p className="text-[10px] text-zinc-500">Gateway de Pagamentos</p>
          </div>
        </div>
      </div>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 font-semibold px-3 mb-1">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(mainItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 font-semibold px-3 mb-1">
            Financeiro
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(financeItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 font-semibold px-3 mb-1">
            Vendas
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(salesItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 font-semibold px-3 mb-1">
            Área de Membros
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(memberItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 w-full text-[13px] group"
        >
          <LogOut className="h-[18px] w-[18px] group-hover:scale-105 transition-transform" />
          <span>Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
