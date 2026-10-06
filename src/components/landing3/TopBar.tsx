import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#velocidade", label: "Velocidade" },
  { href: "#adquirencia", label: "Aprovação" },
  { href: "#saque", label: "Saque" },
  { href: "#painel", label: "Painel" },
  { href: "#perguntas", label: "Perguntas" },
];

export interface TopBarProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function TopBar({ onLogin, onSignup }: TopBarProps) {
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Menu móvel: foco inicial, Tab preso dentro do menu e Escape para fechar.
  useEffect(() => {
    if (!menuOpen) return;
    const focusable = menuRef.current?.querySelectorAll<HTMLElement>("a, button");
    focusable?.item(0)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className={cn("vx3-nav", (compact || menuOpen) && "vx3-nav-compact")}>
      <div className="vx3-shell flex h-[68px] items-center justify-between gap-4">
        <a href="#topo" className="flex items-center gap-2.5" aria-label="VENXPAY — início">
          <VenxpayLogo size={28} plate={false} animated={false} className="text-foreground" />
          <span className="font-heading text-sm font-extrabold tracking-[0.14em] text-foreground">VENXPAY</span>
        </a>

        <nav className="vx3-nav-pill hidden lg:flex" aria-label="Navegação principal">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onLogin} className="hidden sm:inline-flex">Entrar</Button>
          <Button onClick={onSignup} className="vx3-btn-glow">Criar conta</Button>
          <Button
            ref={menuButtonRef}
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <nav ref={menuRef} className="vx3-mobile-nav" aria-label="Navegação móvel">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>
          ))}
          <button type="button" onClick={onLogin}>Entrar</button>
        </nav>
      )}
    </header>
  );
}
