import { Link, useNavigate } from "react-router-dom";
import { Search, Eye, EyeOff, Moon, Sun, Bell, LogOut, HelpCircle } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { SellerTabs } from "./SellerTabs";
import { Money } from "@/components/home/Money";

export interface SellerTopbarProps {
  balance: number;
  hidden: boolean;
  onTogglePrivacy: () => void;
  theme: string;
  onToggleTheme: () => void;
  unread: number;
  onOpenNotifications: () => void;
  onOpenSearch: () => void;
  avatarUrl?: string | null;
  name?: string | null;
  kycApproved: boolean;
}

const iconBtn = "grid h-9 w-9 place-items-center rounded-full vp-top-muted transition-colors hover:bg-[hsl(var(--vp-ink-2))] hover:text-[hsl(var(--vp-ink-fg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Barra superior navy do seller: marca, busca, saldo, ações e abas. Só desktop/tablet. */
export function SellerTopbar(p: SellerTopbarProps) {
  const navigate = useNavigate();
  const logout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  return (
    <header className="vp-top sticky top-0 z-40 hidden md:block">
      <div className="mx-auto flex h-[60px] max-w-[1320px] items-center gap-4 px-6">
        <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="Vemprapay — início">
          <VenxpayLogo size={30} />
          <span className="text-[17px] font-extrabold tracking-[-0.03em]">vempra<span className="text-primary">pay</span></span>
        </Link>

        <button
          onClick={p.onOpenSearch}
          className="vp-top-chip ml-4 flex h-9 w-full max-w-[380px] items-center gap-2.5 rounded-full px-3.5 text-left text-[13px] vp-top-muted transition-colors"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 truncate">Buscar vendas, produtos, páginas…</span>
          <kbd className="rounded-md border vp-top-line px-1.5 py-0.5 text-[10.5px] font-semibold">Ctrl K</kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => navigate("/financeiro/saques")}
            className="vp-top-chip mr-2 flex h-9 items-center gap-2.5 rounded-full pl-3.5 pr-1 transition-colors"
            aria-label="Ver saldo e sacar"
          >
            <span className="text-[11px] font-semibold vp-top-muted">Saldo</span>
            <Money value={Math.max(p.balance, 0)} hidden={p.hidden} className="text-[14px] font-bold" />
            <span className="rounded-full bg-primary px-3 py-1 text-[11.5px] font-bold text-primary-foreground">Sacar</span>
          </button>
          <button onClick={p.onTogglePrivacy} className={iconBtn} aria-label={p.hidden ? "Mostrar valores" : "Ocultar valores"}>
            {p.hidden ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
          </button>
          <button onClick={p.onToggleTheme} className={iconBtn} aria-label="Alternar tema">
            {p.theme === "dark" ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
          </button>
          <button onClick={p.onOpenNotifications} className={cn(iconBtn, "relative")} aria-label="Notificações">
            <Bell className="h-[17px] w-[17px]" />
            {p.unread > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9.5px] font-bold text-primary-foreground">
                {p.unread > 9 ? "9+" : p.unread}
              </span>
            )}
          </button>
          <button onClick={() => navigate("/suporte")} className={iconBtn} aria-label="Ajuda e suporte">
            <HelpCircle className="h-[17px] w-[17px]" />
          </button>
          <button onClick={() => navigate("/perfil")} className="relative ml-1 rounded-full" aria-label="Meu perfil">
            <Avatar className="h-8 w-8 ring-2 ring-[hsl(var(--vp-ink-line))]">
              <AvatarImage src={p.avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="bg-primary text-[12px] font-bold text-primary-foreground">
                {(p.name || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[hsl(var(--vp-ink))]", p.kycApproved ? "bg-success" : "bg-warning")} />
          </button>
          <button onClick={logout} className={iconBtn} aria-label="Sair da conta"><LogOut className="h-[16px] w-[16px]" /></button>
        </div>
      </div>
      <div className="border-t vp-top-line">
        <div className="mx-auto max-w-[1320px] px-4"><SellerTabs /></div>
      </div>
    </header>
  );
}
