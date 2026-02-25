import {
  LayoutDashboard, Wallet, FileText, Building2, ArrowDownToLine,
  ShoppingCart, Package, ExternalLink, LogOut, Zap, UserCircle,
  Webhook, Ticket, BookOpen, PlayCircle, Layers, User, Puzzle,
  PieChart,
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
    label: "OVERVIEW",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
      { title: "Dados Bancários", url: "/financeiro/dados-bancarios", icon: Building2 },
      { title: "Identidade", url: "/financeiro/identidade", icon: UserCircle },
      { title: "Saques", url: "/financeiro/saques", icon: ArrowDownToLine },
      { title: "Gastos", url: "/financeiro/gastos", icon: PieChart },
    ],
  },
  {
    label: "COMERCIAL",
    items: [
      { title: "Vendas", url: "/vendas", icon: ShoppingCart },
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
      { title: "Meus Cursos", url: "/membros", icon: PlayCircle },
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
    <Sidebar className="w-[260px] border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center neon-glow">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">PayGate</h1>
            <p className="text-[11px] text-sidebar-foreground/50 font-medium tracking-wide">PAYMENT GATEWAY</p>
          </div>
        </div>
      </div>

      <SidebarContent className="px-3 py-4 overflow-y-auto">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={idx > 0 ? "mt-6" : ""}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.25em] text-sidebar-foreground/30 font-bold px-3 mb-2">
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
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/60 hover:text-white hover:bg-white/5 transition-all duration-150 group relative"
                        activeClassName="text-white font-semibold bg-primary/15 border border-primary/20"
                      >
                        <item.icon className="h-[17px] w-[17px] shrink-0 group-[.active]:text-primary" />
                        <span className="text-[14px] font-medium">{item.title}</span>
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/40 hover:text-red-400 hover:bg-red-500/5 transition-all w-full text-[14px] font-medium"
        >
          <LogOut className="h-[17px] w-[17px]" />
          <span>Sair da conta</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
