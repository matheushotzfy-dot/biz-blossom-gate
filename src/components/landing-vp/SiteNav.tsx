import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { NAV_LINKS } from "./landingData";

export interface SiteNavProps { onLogin: () => void; onSignup: () => void }

const SECTION_IDS = NAV_LINKS.map((l) => l.href.slice(1));

/**
 * Seção que está no meio da tela. `#seguranca` fica dentro de `#integracao`: quando as duas cruzam a faixa,
 * vale a última da lista do menu (a mais interna).
 */
function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const visible = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
      setActive([...SECTION_IDS].reverse().find((id) => visible.has(id)) ?? null);
    }, { rootMargin: "-45% 0px -50% 0px" });
    SECTION_IDS.forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);
  return active;
}

export function SiteNav({ onLogin, onSignup }: SiteNavProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Menu do celular: trava a rolagem da página, fecha com Esc (o foco volta ao botão) e ao passar para a largura do computador.
  useEffect(() => {
    if (!open) return undefined;
    const root = document.documentElement;
    root.classList.add("lp-menu-open");
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const wide = window.matchMedia?.("(min-width: 1280px)");
    const onWide = () => { if (wide?.matches) setOpen(false); };
    window.addEventListener("keydown", onKey);
    wide?.addEventListener?.("change", onWide);
    return () => {
      root.classList.remove("lp-menu-open");
      window.removeEventListener("keydown", onKey);
      wide?.removeEventListener?.("change", onWide);
    };
  }, [open]);

  return (
    <header className="lp-nav" data-scrolled={scrolled || open ? "" : undefined} data-open={open ? "" : undefined}>
      <a href="#conteudo" className="lp-skip">Pular para o conteúdo</a>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 sm:px-8">
        <a href="#topo" className="flex items-center gap-2.5 no-underline" aria-label="Vemprapay, início">
          <VenxpayLogo size={32} />
          <span className="text-[19px] font-extrabold tracking-[-0.035em] text-foreground">vempra<span className="text-primary">pay</span></span>
        </a>
        <nav className="hidden flex-1 items-center gap-7 pl-4 xl:flex" aria-label="Seções da página">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="lp-navlink" aria-current={active === l.href.slice(1) ? "location" : undefined}>{l.label}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={onLogin} className="lp-btn lp-btn-sm lp-btn-text lp-only-sm">Entrar</button>
          <button type="button" onClick={onSignup} className="lp-btn lp-btn-sm">Abrir conta</button>
          <button
            ref={toggleRef}
            type="button"
            className="lp-menu-btn xl:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="lp-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <>
          <div className="lp-menu-scrim xl:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
          <div id="lp-menu" ref={menuRef} className="lp-menu xl:hidden">
            <nav className="mx-auto flex max-w-[1200px] flex-col px-5 pb-6 pt-1 sm:px-8" aria-label="Seções da página">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={active === l.href.slice(1) ? "location" : undefined}
                  className="lp-menu-link"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                <button type="button" onClick={() => { setOpen(false); onSignup(); }} className="lp-btn">Abrir minha conta</button>
                <button type="button" onClick={() => { setOpen(false); onLogin(); }} className="lp-link bg-transparent p-0 text-[16px]" style={{ border: 0, cursor: "pointer" }}>Já tenho conta</button>
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
