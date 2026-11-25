import { Link } from "react-router-dom";
import { Bell, ChevronDown, Eye, EyeOff, Moon, Search, ShieldCheck, Sun, Wallet } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Money } from "@/components/home/Money";
import { useSignOut } from "@/hooks/useSignOut";
import type { KycKey } from "@/components/account/accountMeta";
import { AccountMenuContent } from "./AccountMenu";
import { firstNameOf, initialOf } from "./accountMenu";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export interface SellerTopbarProps {
  unread: number;
  onOpenNotifications: () => void;
  onOpenSearch: () => void;
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  /** Situação da verificação, para o texto do menu. */
  kyc?: KycKey;
  kycApproved: boolean;
  /** Texto curto da situação da conta ("Em análise", "Reprovada"…). */
  kycLabel?: string;
  kycTone?: "ok" | "warn" | "alert";
  /** Saldo disponível do razão (mesma fonte do Início). */
  balance: number;
  hidden: boolean;
  onToggleHidden: () => void;
}

/** Barra superior do conteúdo: busca, saldo à mão, aparência, avisos e conta. Só desktop/tablet. */
export function SellerTopbar(p: SellerTopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const first = firstNameOf(p.name);
  const signOut = useSignOut();
  const tone = p.kycApproved ? "ok" : p.kycTone ?? "warn";
  const label = p.kycApproved ? "Conta verificada" : p.kycLabel ?? "Verificação pendente";

  return (
    <header className="sticky top-0 z-30 hidden h-[84px] shrink-0 items-center gap-3 bg-background/85 px-8 backdrop-blur-xl md:flex">
      <button
        onClick={p.onOpenSearch}
        aria-label="Buscar (Ctrl K)"
        className="flex h-[46px] w-full min-w-0 max-w-[440px] items-center gap-3 rounded-full border border-border bg-card px-4 text-left text-[14px] text-muted-foreground shadow-[0_1px_2px_hsl(222_47%_11%/.04)] transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-foreground" />
        <span className="flex-1 truncate">Buscar vendas, produtos ou clientes</span>
        <kbd className="hidden whitespace-nowrap rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-semibold xl:inline">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        {/* Saldo sempre à vista; o olho oculta valores em todas as telas. */}
        <div className="flex h-[46px] items-center rounded-full bg-accent pl-1.5 pr-1.5 text-accent-foreground">
          <Link to="/financeiro/saques" className="flex items-center gap-2.5 rounded-full py-1 pl-0.5 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Ver saldo e saques">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"><Wallet className="h-4 w-4" strokeWidth={2.3} /></span>
            <span className="leading-none">
              <span className="hidden text-[11.5px] font-medium opacity-80 xl:block">Saldo disponível</span>
              <Money value={p.balance} hidden={p.hidden} className="block text-[15px] font-extrabold tracking-[-0.025em] xl:mt-0.5" centsClassName="opacity-70" />
            </span>
          </Link>
          <button onClick={p.onToggleHidden} aria-pressed={p.hidden} aria-label={p.hidden ? "Mostrar valores" : "Ocultar valores"} className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {p.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <button onClick={toggleTheme} className="vp-orb !h-[46px] !w-[46px]" aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}>
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <button onClick={p.onOpenNotifications} className="vp-orb !h-[46px] !w-[46px]" aria-label={p.unread > 0 ? `Notificações, ${p.unread} novas` : "Notificações"}>
          <Bell className="h-[18px] w-[18px]" />
          {p.unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background">
              {p.unread > 9 ? "9+" : p.unread}
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-0.5 flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className="relative">
              <Avatar className="h-[42px] w-[42px]">
                <AvatarImage src={p.avatarUrl || undefined} className="object-cover" />
                <AvatarFallback className="bg-accent text-[15px] font-bold text-accent-foreground">{initialOf(p.name)}</AvatarFallback>
              </Avatar>
              <span className={cn("absolute -bottom-0.5 -right-0.5 grid h-[17px] w-[17px] place-items-center rounded-full text-white ring-2 ring-background", tone === "ok" ? "bg-primary" : tone === "alert" ? "bg-destructive" : "bg-warning")}>
                <ShieldCheck className="h-[10px] w-[10px]" strokeWidth={3} />
              </span>
            </span>
            <span className="hidden min-w-0 text-left leading-tight lg:block">
              <span className="block max-w-[140px] truncate text-[14px] font-bold text-foreground">{first}</span>
              <span className={cn("block whitespace-nowrap text-[12px] font-medium", tone === "ok" ? "vp-green-ink" : tone === "alert" ? "text-destructive" : "text-warning")}>
                {label}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-[336px] max-w-[calc(100vw-24px)] rounded-[20px] p-2">
            <AccountMenuContent name={p.name} email={p.email} avatarUrl={p.avatarUrl} kyc={p.kyc ?? (p.kycApproved ? "approved" : "pending")} onSignOut={() => void signOut()} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
