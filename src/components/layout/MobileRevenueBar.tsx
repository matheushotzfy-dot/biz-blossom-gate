import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, LifeBuoy, LogOut, Moon, Search, Sun, UserRound, Wallet } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useProfile } from "@/hooks/useProfile";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useLedgerBalance } from "@/hooks/useQueryData";
import { NotificationPanel, useNotificationCount } from "@/components/NotificationPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { Money } from "@/components/home/Money";
import { supabase } from "@/integrations/supabase/client";

/** Barra superior do celular: marca, saldo, busca, avisos e conta (com o tema dentro do menu). */
export function MobileRevenueBar() {
  const { theme, toggleTheme } = useTheme();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const unreadCount = useNotificationCount();
  const { hidden } = usePrivacyMode();
  const { data: balance = 0 } = useLedgerBalance();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const logout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur md:hidden">
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="Início">
            <VenxpayLogo size={30} />
            <span className="hidden font-heading text-[18px] font-extrabold tracking-[-0.04em] text-foreground min-[460px]:inline">vempra<span className="text-primary">pay</span></span>
          </Link>

          <div className="flex-1" />

          <Link to="/financeiro/saques" aria-label="Saldo disponível" className="hidden h-10 items-center gap-1.5 rounded-full bg-accent pl-1.5 pr-3 text-accent-foreground min-[380px]:flex">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground"><Wallet className="h-3.5 w-3.5" strokeWidth={2.3} /></span>
            <Money value={balance} hidden={hidden} className="text-[13.5px] font-extrabold tracking-[-0.02em]" centsClassName="hidden" />
          </Link>

          <button onClick={() => setSearchOpen(true)} className="vp-orb !h-10 !w-10" aria-label="Buscar"><Search className="h-[18px] w-[18px]" /></button>
          <button onClick={() => setNotifOpen(!notifOpen)} className="vp-orb !h-10 !w-10" aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} novas` : "Notificações"}>
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-primary px-1 text-[9.5px] font-bold leading-none text-primary-foreground ring-2 ring-background">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Minha conta">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="bg-accent text-[14px] font-bold text-accent-foreground">{(profile?.full_name || "U").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
              <DropdownMenuItem className="rounded-xl py-2.5" onClick={() => navigate("/perfil")}><UserRound className="mr-2.5 h-4 w-4" />Minha conta</DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl py-2.5" onClick={toggleTheme}>{theme === "dark" ? <Sun className="mr-2.5 h-4 w-4" /> : <Moon className="mr-2.5 h-4 w-4" />}{theme === "dark" ? "Tema claro" : "Tema escuro"}</DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl py-2.5" onClick={() => navigate("/suporte")}><LifeBuoy className="mr-2.5 h-4 w-4" />Suporte</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="rounded-xl py-2.5 text-destructive focus:text-destructive"><LogOut className="mr-2.5 h-4 w-4" />Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
