import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface SellerTopbarProps {
  unread: number;
  onOpenNotifications: () => void;
  onOpenSearch: () => void;
  avatarUrl?: string | null;
  name?: string | null;
  kycApproved: boolean;
}

const orb = "relative grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Barra superior do conteúdo: busca, avisos e conta. Só desktop/tablet. */
export function SellerTopbar(p: SellerTopbarProps) {
  const navigate = useNavigate();
  const first = (p.name || "").split(" ")[0] || "Seller";
  const logout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  return (
    <header className="sticky top-0 z-30 hidden h-[76px] items-center justify-end gap-3 bg-background/80 px-8 backdrop-blur-xl md:flex">
      <button onClick={p.onOpenSearch} className={cn(orb, "w-auto gap-2.5 px-4 text-[13px] text-muted-foreground")} aria-label="Buscar (Ctrl K)">
        <Search className="h-[18px] w-[18px] text-foreground" />
        <span className="hidden lg:inline">Buscar</span>
        <kbd className="hidden rounded-md border border-border px-1.5 text-[10.5px] lg:inline">Ctrl K</kbd>
      </button>
      <button onClick={p.onOpenNotifications} className={orb} aria-label="Notificações">
        <Bell className="h-[18px] w-[18px]" />
        {p.unread > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger className="ml-1 flex items-center gap-3 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="relative">
            <Avatar className="h-11 w-11 ring-2 ring-primary/60">
              <AvatarImage src={p.avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="bg-accent text-[14px] font-bold text-accent-foreground">{first.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[14px] font-bold text-foreground">Olá, {first}</span>
            <span className={cn("block text-[12px]", p.kycApproved ? "text-muted-foreground" : "text-warning")}>{p.kycApproved ? "Conta verificada" : "Verificação pendente"}</span>
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
    </header>
  );
}
