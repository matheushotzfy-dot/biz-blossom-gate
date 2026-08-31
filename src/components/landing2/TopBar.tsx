/**
 * TopBar — barra fixa fina, com regra inferior que ganha opacidade no scroll.
 */
import { useEffect, useState } from "react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#fluxo", label: "Fluxo" },
  { href: "#painel", label: "Painel" },
  { href: "#checkout", label: "Checkout" },
  { href: "#incluso", label: "Incluso" },
  { href: "#condicoes", label: "Condições" },
];

export function TopBar({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        solid ? "border-b border-border bg-background/92 backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5">
        <a href="#topo" className="flex items-center gap-2.5">
          <VenxpayLogo size={26} plate={false} animated={false} />
          <span className="font-heading text-[15px] font-extrabold tracking-tight text-foreground">venxpay</span>
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onLogin}
            className="hidden h-9 px-4 text-[13px] font-bold text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={onSignup}
            className="h-9 rounded-[3px] bg-primary px-4 text-[13px] font-extrabold text-primary-foreground transition-colors hover:bg-primary/88"
          >
            Criar conta
          </button>
        </div>
      </div>
    </header>
  );
}
