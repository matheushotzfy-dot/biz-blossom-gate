import {
  LayoutDashboard, Wallet, FileText, Percent, Building2, ArrowDownToLine,
  ShoppingCart, Package, ExternalLink, LogOut, CreditCard, UserCircle,
  Webhook, Ticket, BookOpen, PlayCircle, Layers, User,
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

const accountItems = [
  { title: "Meu Perfil", url: "/perfil", icon: User },
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
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-white/35 hover:text-white/70 transition-all duration-300 group relative overflow-hidden"
            activeClassName="text-white font-semibold"
          >
            {/* Active indicator glow */}
            <div className="absolute inset-0 opacity-0 group-[.active]:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(90deg, rgba(0,255,163,0.08), transparent)" }} />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full opacity-0 group-[.active]:opacity-100 transition-opacity" style={{ background: "#00FFA3", boxShadow: "0 0 10px rgba(0,255,163,0.5)" }} />
            <item.icon className="h-[16px] w-[16px] shrink-0 relative z-10 group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[13px] font-medium relative z-10">{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar className="w-[250px] border-r border-white/[0.04]" style={{ background: "linear-gradient(180deg, #080c18, #0a0f1e, #080c18)" }}>
      {/* Logo */}
      <div className="p-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center relative" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", boxShadow: "0 0 20px rgba(0,255,163,0.25)" }}>
            <CreditCard className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white tracking-tight">PayGate</h1>
            <p className="text-[10px] text-white/20">Gateway de Pagamentos</p>
          </div>
        </div>
      </div>

      <SidebarContent className="px-3 py-4 overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.25em] text-white/15 font-bold px-3 mb-1">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(mainItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.25em] text-white/15 font-bold px-3 mb-1">
            Financeiro
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(financeItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.25em] text-white/15 font-bold px-3 mb-1">
            Vendas
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(salesItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.25em] text-white/15 font-bold px-3 mb-1">
            Membros
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(memberItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-[9px] uppercase tracking-[0.25em] text-white/15 font-bold px-3 mb-1">
            Conta
          </SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(accountItems)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-white/[0.04]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/5 transition-all duration-300 w-full text-[13px] font-medium group"
        >
          <LogOut className="h-[16px] w-[16px] group-hover:scale-110 transition-transform duration-300" />
          <span>Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
