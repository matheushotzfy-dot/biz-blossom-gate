import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Moon, Search, ShieldCheck, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export interface SellerTopbarProps {
  unread: number;
  onOpenNotifications: () => void;
  onOpenSearch: () => void;
  avatarUrl?: string | null;
  name?: string | null;
  kycApproved: boolean;
}

/** Barra superior do conteúdo: busca, aparência, avisos e conta. Só desktop/tablet. */
export function SellerTopbar(p: SellerTopbarProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const first = (p.name || "").split(" ")[0] || "Seller";
  const logout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  return (
    <header className="sticky top-0 z-30 hidden h-[84px] shrink-0 items-center gap-4 bg-background/85 px-8 backdrop-blur-xl md:flex">
      <button
        onClick={p.onOpenSearch}
        aria-label="Buscar (Ctrl K)"
        className="flex h-[46px] w-full max-w-[460px] items-center gap-3 rounded-full border border-border bg-card px-4 text-left text-[14px] text-muted-foreground shadow-[0_1px_2px_hsl(222_47%_11%/.04)] transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-foreground" />
        <span className="flex-1 truncate">Buscar vendas, produtos ou clientes</span>
        <kbd className="hidden whitespace-nowrap rounded-md border font-sans border-border bg-muted px-1.5 py-0.5 text-[11px] font-semibold lg:inline">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        <button onClick={toggleTheme} className="vp-orb" aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}>
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <button onClick={p.onOpenNotifications} className="vp-orb" aria-label={p.unread > 0 ? `Notificações, ${p.unread} novas` : "Notificações"}>
          <Bell className="h-[18px] w-[18px]" />
          {p.unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background">
              {p.unread > 9 ? "9+" : p.unread}
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 flex items-center gap-3 rounded-full py-1 pl-1 pr-3.5 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Avatar className="h-11 w-11 ring-2 ring-primary/70 ring-offset-2 ring-offset-background">
              <AvatarImage src={p.avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="bg-accent text-[15px] font-bold text-accent-foreground">{first.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-left leading-tight">
              <span className="block text-[14px] font-bold text-foreground">{first}</span>
              <span className={cn("flex items-center gap-1 text-[12px] font-medium", p.kycApproved ? "vp-green-ink" : "text-warning")}>
                {p.kycApproved && <ShieldCheck className="h-3.5 w-3.5" />}
                {p.kycApproved ? "Conta verificada" : "Verificação pendente"}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => navigate("/perfil")}>Minha conta</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/financeiro/taxas")}>Minhas taxas</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/suporte")}>Suporte</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" />Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
