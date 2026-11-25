import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Building2, LifeBuoy, Lock, LogOut, Percent, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/seller-ui/tx";
import { topbarKyc, type KycKey } from "@/components/account/accountMeta";
import { accountMenuLinks, firstNameOf, initialOf, type MenuIcon } from "./accountMenu";

const ICONS: Record<MenuIcon, LucideIcon> = { user: UserRound, shield: ShieldCheck, lock: Lock, percent: Percent, bank: Building2, help: LifeBuoy };
const PILL_TONE = { ok: "ok", warn: "wait", alert: "alert" } as const;

export interface AccountMenuProps {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  kyc: KycKey;
  onSignOut: () => void;
  /** Itens extras no topo da lista (no celular: o tema). */
  extra?: ReactNode;
}

/** Conteúdo do menu que abre no avatar: quem sou eu, situação da conta, atalhos e sair. */
export function AccountMenuContent({ name, email, avatarUrl, kyc, onSignOut, extra }: AccountMenuProps) {
  const look = topbarKyc(kyc);
  const links = accountMenuLinks(kyc);

  return (
    <>
      <DropdownMenuItem asChild className="rounded-[18px] p-2.5 focus:bg-accent/60">
        <Link to="/perfil" aria-label="Abrir minha conta">
          <span className="flex min-w-0 items-center gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="bg-accent text-[17px] font-bold text-accent-foreground">{initialOf(name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold text-foreground">{name?.trim() || firstNameOf(name)}</span>
              {email && <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">{email}</span>}
              <span className="mt-1.5 block"><StatusPill tone={PILL_TONE[look.tone]} label={look.label} /></span>
            </span>
          </span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {extra}
      {links.map((l) => {
        const Icon = ICONS[l.icon];
        return (
          <DropdownMenuItem key={l.key} asChild className="rounded-[14px] px-2.5 py-2 focus:bg-accent/60">
            <Link to={l.to}>
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Icon className="h-[17px] w-[17px]" aria-hidden /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-foreground">{l.title}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">{l.hint}</span>
                </span>
              </span>
            </Link>
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onSignOut} className="rounded-[14px] px-2.5 py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive">
        <LogOut className="mr-3 h-4 w-4" aria-hidden />Sair da conta
      </DropdownMenuItem>
    </>
  );
}
