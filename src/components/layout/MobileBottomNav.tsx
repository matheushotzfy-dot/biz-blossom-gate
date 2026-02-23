import { LayoutDashboard, ShoppingCart, FileText, Wallet, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Home", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Vendas", icon: ShoppingCart, path: "/vendas" },
  { label: "Extrato", icon: FileText, path: "/financeiro/extrato" },
  { label: "Saques", icon: Wallet, path: "/financeiro/saques" },
  { label: "Perfil", icon: User, path: "/perfil" },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/80 backdrop-blur-2xl border-t border-border">
      <div className="flex items-center justify-around px-1 py-1.5 safe-area-bottom">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path || 
            (tab.path !== "/dashboard" && location.pathname.startsWith(tab.path));
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[56px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
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
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
