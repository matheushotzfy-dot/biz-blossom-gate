/**
 * Closing — bloco final de tela cheia com o halo intensificado e CTA único.
 */
import { ArrowRight } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { CutLines } from "./bits";

const LEGAL = [
  { href: "/termos-de-uso", label: "Termos de uso" },
  { href: "/politica-de-privacidade", label: "Privacidade" },
  { href: "/docs", label: "Documentação" },
  { href: "/status", label: "Status" },
];

export function Closing({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="relative flex min-h-[86vh] flex-col justify-between overflow-hidden pt-28">
      <div className="pointer-events-none absolute inset-0 vx-grid-fine vx-fade-edges opacity-35" />
      <div className="pointer-events-none absolute bottom-[-160px] left-1/2 h-[620px] w-[1000px] -translate-x-1/2 vx-halo" />

      <div className="relative mx-auto w-full max-w-[1280px] flex-1 px-5">
        <CutLines
          as="h2"
          className="max-w-[14ch] text-[42px] font-extrabold text-foreground sm:text-[78px] lg:text-[96px]"
          lines={[<>Comece hoje.</>, <>Receba hoje.</>]}
        />
        <p className="mt-8 max-w-[46ch] text-[15.5px] leading-[1.75] text-muted-foreground">
          Cadastro, verificação e publicação do primeiro produto acontecem sem fila e sem reunião
          comercial.
        </p>
        <button type="button" onClick={onSignup} className="vx-btn mt-11">
          Abrir minha conta <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <footer className="relative mt-24 border-t border-border">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-6 px-5 py-8">
          <div className="flex items-center gap-2.5">
            <VenxpayLogo size={24} plate={false} animated={false} />
            <span className="font-heading text-[14px] font-extrabold text-foreground">venxpay</span>
          </div>
          <nav className="flex flex-wrap gap-x-7 gap-y-2">
            {LEGAL.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[12.5px] text-muted-foreground transition-colors hover:text-primary"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <p className="vx-mono text-[9px]">© {new Date().getFullYear()} venxpay</p>
        </div>
      </footer>
    </section>
  );
}
