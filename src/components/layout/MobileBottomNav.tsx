import { useState } from "react";
import {
  LayoutDashboard, ShoppingCart, FileText, Wallet, MoreHorizontal,
  Package, ExternalLink, Layers, Ticket, Webhook, BookOpen,
  Percent, Building2, UserCircle, ArrowDownToLine, PlayCircle, User, LogOut, X,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { label: "Home", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Vendas", icon: ShoppingCart, path: "/vendas" },
  { label: "Extrato", icon: FileText, path: "/financeiro/extrato" },
  { label: "Saques", icon: Wallet, path: "/financeiro/saques" },
  { label: "Mais", icon: MoreHorizontal, path: "__more__" },
];

const moreGroups = [
  {
    label: "Vendas",
    items: [
      { title: "Produtos", url: "/vendas/produtos", icon: Package },
      { title: "Checkout", url: "/vendas/checkout", icon: ExternalLink },
      { title: "Conteúdo", url: "/vendas/conteudo", icon: Layers },
      { title: "Cupons", url: "/vendas/cupons", icon: Ticket },
      { title: "Webhooks", url: "/vendas/webhooks", icon: Webhook },
      { title: "API Docs", url: "/vendas/documentacao", icon: BookOpen },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Taxas", url: "/financeiro/taxas", icon: Percent },
      { title: "Dados Bancários", url: "/financeiro/dados-bancarios", icon: Building2 },
      { title: "Identidade & KYC", url: "/financeiro/identidade", icon: UserCircle },
    ],
  },
  {
    label: "Membros",
    items: [
      { title: "Meus Cursos", url: "/membros", icon: PlayCircle },
    ],
  },
  {
    label: "Conta",
    items: [
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
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-2xl max-h-[75vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-base font-bold text-foreground">Menu</h2>
              <button onClick={() => setMoreOpen(false)} className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 pb-6 space-y-4">
              {moreGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 mb-1.5">{group.label}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all text-center",
                            isActive ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          <span className="text-[10px] font-semibold leading-tight">{item.title}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-destructive bg-destructive/5 text-sm font-semibold mt-2"
              >
                <LogOut className="h-4 w-4" /> Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/80 backdrop-blur-2xl border-t border-border">
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
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200",
                  isActive && "bg-primary/10"
                )}>
                  <tab.icon className={cn("h-[18px] w-[18px]", isActive && "scale-110")} />
                </div>
                <span className={cn(
                  "text-[9px] font-semibold tracking-wide",
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
