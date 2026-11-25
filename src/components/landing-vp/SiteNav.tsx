import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { NAV_LINKS } from "./landingData";

export interface SiteNavProps { onLogin: () => void; onSignup: () => void }

export function SiteNav({ onLogin, onSignup }: SiteNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="lp-nav">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-5 sm:px-8">
        <a href="#topo" className="flex items-center gap-2.5 no-underline" aria-label="Vemprapay, início">
          <VenxpayLogo size={32} />
          <span className="text-[19px] font-extrabold tracking-[-0.035em] text-foreground">vempra<span className="text-primary">pay</span></span>
        </a>
        <nav className="hidden flex-1 items-center gap-7 pl-4 lg:flex" aria-label="Seções da página">
          {NAV_LINKS.map((l) => <a key={l.href} href={l.href} className="lp-navlink">{l.label}</a>)}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={onLogin} className="lp-btn lp-btn-sm lp-btn-text lp-only-sm">Entrar</button>
          <button type="button" onClick={onSignup} className="lp-btn lp-btn-sm">Abrir conta</button>
          <button type="button" className="lp-menu-btn lg:hidden" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} aria-controls="lp-menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div id="lp-menu" className="lg:hidden" style={{ background: "hsl(var(--background))", boxShadow: "0 1px 0 hsl(var(--border)), 0 30px 40px -30px hsl(222 47% 11% / .4)" }}>
          <nav className="mx-auto flex max-w-[1180px] flex-col px-5 pb-5 pt-1 sm:px-8" aria-label="Seções da página">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-3.5 text-[17px] font-bold text-foreground no-underline" style={{ boxShadow: "0 1px 0 hsl(var(--border))" }}>{l.label}</a>
            ))}
            <button type="button" onClick={() => { setOpen(false); onLogin(); }} className="mt-4 self-start text-[16px] font-bold text-foreground underline underline-offset-4">Já tenho conta, entrar</button>
          </nav>
        </div>
      )}
    </header>
  );
}
