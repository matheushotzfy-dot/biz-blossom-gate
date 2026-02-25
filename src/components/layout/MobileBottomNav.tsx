import { useState } from "react";
import {
  LayoutDashboard, ShoppingCart, FileText, Wallet, MoreHorizontal,
  Package, CreditCard, Layers, Ticket, Webhook, BookOpen,
  Building2, UserCircle, ArrowDownToLine, GraduationCap, User, LogOut, X, PieChart, Puzzle,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { label: "Home", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Vendas", icon: ShoppingCart, path: "/vendas" },
  { label: "Produtos", icon: Package, path: "/vendas/produtos" },
  { label: "Saques", icon: Wallet, path: "/financeiro/saques" },
  { label: "Mais", icon: MoreHorizontal, path: "__more__" },
];

const moreGroups = [
  {
    label: "Infoprodutos",
    items: [
      { title: "Checkout", url: "/vendas/checkout", icon: CreditCard },
      { title: "Área de Membros", url: "/membros", icon: GraduationCap },
      { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
      { title: "Cupons", url: "/vendas/cupons", icon: Ticket },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
      { title: "Dados Bancários", url: "/financeiro/dados-bancarios", icon: Building2 },
      { title: "Gastos", url: "/financeiro/gastos", icon: PieChart },
      { title: "KYC", url: "/financeiro/identidade", icon: UserCircle },
    ],
  },
  {
    label: "Config",
    items: [
      { title: "Webhooks", url: "/vendas/webhooks", icon: Webhook },
      { title: "Integrações", url: "/integracoes/apps", icon: Puzzle },
      { title: "API Docs", url: "/vendas/documentacao", icon: BookOpen },
      { title: "Meu Perfil", url: "/perfil", icon: User },
    ],
  },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl max-h-[75vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-base font-display font-bold text-foreground">Menu</h2>
              <button onClick={() => setMoreOpen(false)} className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 pb-6 space-y-4">
              {moreGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 mb-1.5">{group.label}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-2.5 rounded-lg transition-all text-center",
                            isActive ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <item.icon className="h-4.5 w-4.5" />
                          <span className="text-[9px] font-semibold leading-tight">{item.title}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-lg text-destructive bg-destructive/5 text-sm font-semibold mt-2"
              >
                <LogOut className="h-4 w-4" /> Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/90 backdrop-blur-xl border-t border-border">
        <div className="flex items-center justify-around px-1 py-1.5 safe-area-bottom">
          {tabs.map((tab) => {
            const isMore = tab.path === "__more__";
            const isActive = isMore
              ? moreOpen
              : location.pathname === tab.path ||
                (tab.path !== "/dashboard" && location.pathname.startsWith(tab.path));

            return (
              <button
                key={tab.path}
                onClick={() => {
                  if (isMore) {
                    setMoreOpen(!moreOpen);
                  } else {
                    setMoreOpen(false);
                    navigate(tab.path);
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-200 min-w-[52px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200",
                  isActive && "bg-primary/10"
                )}>
                  <tab.icon className={cn("h-[17px] w-[17px]", isActive && "scale-110")} />
                </div>
                <span className={cn(
                  "text-[9px] font-semibold",
                  isActive && "font-bold"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
