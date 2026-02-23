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
  { title: "API Docs", url: "/vendas/documentacao", icon: BookOpen },
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground/50 hover:bg-white/[0.04] hover:text-foreground transition-all duration-300 group"
            activeClassName="bg-primary/10 text-primary font-semibold shadow-[0_0_12px_hsl(152,68%,46%,0.1)]"
          >
            <item.icon className="h-[17px] w-[17px] shrink-0 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[13px] font-medium">{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar className="w-[260px] border-r border-white/[0.04] gradient-sidebar">
      {/* Logo */}
      <div className="p-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/20 glow-primary">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-foreground tracking-tight font-display">PayGate</h1>
            <p className="text-[10px] text-foreground/30">Gateway de Pagamentos</p>
          </div>
        </div>
      </div>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-foreground/20 font-bold px-3 mb-1">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(mainItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-foreground/20 font-bold px-3 mb-1">
            Financeiro
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(financeItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-foreground/20 font-bold px-3 mb-1">
            Vendas
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(salesItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-5">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-foreground/20 font-bold px-3 mb-1">
            Membros
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(memberItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-white/[0.04]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground/30 hover:bg-destructive/10 hover:text-destructive transition-all duration-300 w-full text-[13px] font-medium group"
        >
          <LogOut className="h-[17px] w-[17px] group-hover:scale-110 transition-transform duration-300" />
          <span>Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
