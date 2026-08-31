/**
 * LandingNav — navegação flutuante que se condensa ao rolar.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "./parts";

const LINKS = [
  { label: "Motor", href: "#motor" },
  { label: "Checkout", href: "#checkout" },
  { label: "Plataforma", href: "#plataforma" },
  { label: "Segurança", href: "#seguranca" },
  { label: "Condições", href: "#condicoes" },
];

export function LandingNav({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between px-5 transition-all duration-500",
          scrolled ? "h-16" : "h-20",
        )}
      >
        <div
          className={cn(
            "absolute inset-x-0 top-0 -z-10 transition-all duration-500",
            scrolled
              ? "h-16 border-b border-border bg-background/80 backdrop-blur-xl"
              : "h-20 border-b border-transparent bg-transparent",
          )}
        />
        <a href="#topo" aria-label="VENXPAY — início">
          <Wordmark />
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-[13.5px] font-semibold text-muted-foreground transition-colors duration-300 hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <button type="button" onClick={onLogin} className="venx-ghost h-10 px-5 text-[13px]">
            Entrar
          </button>
          <button type="button" onClick={onSignup} className="venx-cta h-10 px-5 text-[13px]">
            Criar conta
          </button>
        </div>

        <button
          type="button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-border text-foreground lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="border-b border-border bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-5">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-[15px] font-semibold text-muted-foreground transition-colors hover:bg-primary/[0.06] hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-3 grid gap-2.5">
                <button type="button" onClick={() => { setOpen(false); onLogin(); }} className="venx-ghost w-full">
                  Entrar
                </button>
                <button type="button" onClick={() => { setOpen(false); onSignup(); }} className="venx-cta w-full">
                  Criar conta
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
