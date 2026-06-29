import { useEffect, useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, Wallet, MoreHorizontal,
  Trophy, Ticket, Building2, User, LogOut, X, Blocks,
  MessageSquare, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { label: "Home", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Vendas", icon: ShoppingCart, path: "/vendas" },
  { label: "Produtos", icon: Package, path: "/vendas/produtos" },
  { label: "Financeiro", icon: Wallet, path: "/financeiro/saques" },
  { label: "Mais", icon: MoreHorizontal, path: "__more__" },
];

const moreGroups: Array<{
  label: string;
  items: Array<{ title: string; subtitle?: string; url: string; icon: LucideIcon; accent?: string }>;
}> = [
  {
    label: "Conta",
    items: [
      { title: "Perfil & KYC", subtitle: "Dados pessoais e verificação", url: "/perfil", icon: User, accent: "primary" },
      { title: "Premiações", subtitle: "Suas conquistas e troféus", url: "/premiacoes", icon: Trophy, accent: "warning" },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Cupons", subtitle: "Descontos e promoções", url: "/vendas/cupons", icon: Ticket, accent: "info" },
      { title: "Taxas & Config", subtitle: "Tarifas e regras financeiras", url: "/financeiro/config", icon: Building2, accent: "success" },
      { title: "Integrações", subtitle: "Apps, Webhooks e API", url: "/integracoes", icon: Blocks, accent: "primary" },
    ],
  },
  {
    label: "Suporte",
    items: [
      { title: "Central de Ajuda", subtitle: "Fale com nosso time", url: "/suporte", icon: MessageSquare, accent: "info" },
    ],
  },
];

const ACCENTS: Record<string, { wrap: string; icon: string }> = {
  primary: { wrap: "bg-primary/10 border-primary/20", icon: "text-primary" },
  warning: { wrap: "bg-warning/10 border-warning/20", icon: "text-warning" },
  info:    { wrap: "bg-info/10 border-info/20", icon: "text-info" },
  success: { wrap: "bg-success/10 border-success/20", icon: "text-success" },
};

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (moreOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [moreOpen]);

  const handleLogout = async () => {
    setMoreOpen(false);
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <>
      {/* ═══ "Mais" bottom sheet — app-grade ═══ */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-[28px] max-h-[88vh] overflow-y-auto shadow-2xl animate-slide-up">
            {/* Handle */}
            <div className="sticky top-0 z-10 bg-card pt-3 pb-1 rounded-t-[28px]">
              <div className="flex justify-center">
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Menu</p>
                  <h2 className="text-lg font-display font-black text-foreground tracking-tight leading-tight">Tudo da plataforma</h2>
                </div>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="h-9 w-9 rounded-xl flex items-center justify-center bg-muted/60 active:scale-95 transition-transform"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Groups */}
            <div className="px-4 pb-8 space-y-5">
              {moreGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60 font-black px-2 mb-2">
                    {group.label}
                  </p>
                  <div className="rounded-2xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                      const acc = ACCENTS[item.accent || "primary"];
                      return (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3.5 py-3 active:bg-muted/40 transition-colors",
                            isActive && "bg-primary/[0.06]"
                          )}
                        >
                          <div className={cn(
                            "h-10 w-10 rounded-xl border flex items-center justify-center shrink-0",
                            acc.wrap
                          )}>
                            <item.icon className={cn("h-[18px] w-[18px]", acc.icon)} strokeWidth={2.25} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-black text-foreground tracking-tight truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-[11px] font-medium text-muted-foreground/70 truncate">{item.subtitle}</p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-destructive bg-destructive/[0.08] border border-destructive/20 text-[12px] font-black uppercase tracking-wider active:scale-[0.98] transition-transform"
              >
                <LogOut className="h-4 w-4" /> Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Bottom Tab Bar ═══ */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-card/95 backdrop-blur-xl border-t border-border">
          <div className="flex items-center justify-around px-1 pt-1.5 pb-[env(safe-area-inset-bottom,0px)]">
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
                    if (isMore) { setMoreOpen(!moreOpen); }
                    else { setMoreOpen(false); navigate(tab.path); }
                  }}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[56px] active:scale-[0.92] transition-all duration-150",
                    isActive ? "text-primary" : "text-muted-foreground/70"
                  )}
                >
                  <div className={cn(
                    "h-8 w-11 rounded-[12px] flex items-center justify-center transition-all duration-200",
                    isActive && "bg-primary/[0.12]"
                  )}>
                    <tab.icon className={cn("h-[18px] w-[18px]", isActive && "stroke-[2.5]")} />
                  </div>
                  <span className={cn(
                    "text-[9.5px] leading-none font-semibold tracking-tight",
                    isActive && "font-black"
                  )}>
                    {tab.label}
                  </span>
                  {isActive && !isMore && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
