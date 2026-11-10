import { VenxpayLogo } from "@/components/VenxpayLogo";
import { Button } from "@/components/ui/button";

export interface SiteNavProps { onLogin: () => void; onSignup: () => void }

const LINKS = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#duvidas", label: "Dúvidas" },
];

export function SiteNav({ onLogin, onSignup }: SiteNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <a href="#topo" className="flex items-center gap-2" aria-label="Vemprapay — início">
          <VenxpayLogo size={32} />
          <span className="font-heading text-[19px] font-extrabold tracking-[-0.035em]">vempra<span className="text-primary">pay</span></span>
        </a>
        <nav className="hidden flex-1 items-center gap-6 md:flex" aria-label="Seções">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[14px] font-semibold text-muted-foreground transition-colors hover:text-foreground">{l.label}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={onLogin} className="rounded-full font-semibold">Entrar</Button>
          <Button onClick={onSignup} className="rounded-full px-5 font-bold">Abrir conta</Button>
        </div>
      </div>
    </header>
  );
}
