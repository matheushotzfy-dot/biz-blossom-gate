import { useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, Wallet, MoreHorizontal,
  CreditCard, Layers, Webhook, BookOpen, Trophy, Bitcoin, Zap,
  Building2, UserCircle, ArrowDownToLine, GraduationCap, User, LogOut, X, PieChart, Puzzle, FileText,
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
      { title: "Compras", url: "/membros", icon: GraduationCap },
      { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Extrato", url: "/financeiro/extrato", icon: FileText },
      { title: "Banco", url: "/financeiro/dados-bancarios", icon: Building2 },
      { title: "Gastos", url: "/financeiro/gastos", icon: PieChart },
      { title: "KYC", url: "/financeiro/identidade", icon: UserCircle },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Webhooks", url: "/vendas/webhooks", icon: Webhook },
      { title: "Apps", url: "/integracoes/apps", icon: Puzzle },
      { title: "API Docs", url: "/vendas/documentacao", icon: BookOpen },
      { title: "Perfil", url: "/perfil", icon: User },
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
      {/* More sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-3xl max-h-[80vh] overflow-y-auto animate-slide-up shadow-2xl">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>

            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <h2 className="text-lg font-display font-black text-foreground">Navegação</h2>
              <button
                onClick={() => setMoreOpen(false)}
                className="h-9 w-9 rounded-xl flex items-center justify-center bg-muted/60 border border-border/80"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 pb-8 space-y-5">
              {moreGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold px-1 mb-2">{group.label}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all text-center border",
                            isActive
                              ? "bg-primary/10 border-primary/25 text-primary"
                              : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          <div className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center",
                            isActive ? "bg-primary/15" : "bg-muted/50"
                          )}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <span className="text-[10px] font-semibold leading-tight">{item.title}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl text-destructive bg-destructive/8 border border-destructive/15 text-sm font-bold mt-3"
              >
                <LogOut className="h-4 w-4" /> Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-card/95 backdrop-blur-xl border-t border-border/80">
          <div className="flex items-center justify-around px-2 py-1 safe-area-bottom">
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
                    "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px]",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200",
                    isActive && "bg-primary/12 scale-105"
                  )}>
                    <tab.icon className="h-[18px] w-[18px]" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold",
                    isActive && "font-bold text-primary"
                  )}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
