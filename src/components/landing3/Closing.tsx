import { ArrowUpRight } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { Button } from "@/components/ui/button";
import { Reveal } from "./bits";

const LEGAL: ReadonlyArray<readonly [string, string]> = [
  ["/termos-de-uso", "Termos"], ["/politica-de-privacidade", "Privacidade"],
  ["/docs", "Documentação"], ["/status", "Status"],
];

export interface ClosingProps { onSignup: () => void; onLogin: () => void; }

export function Closing({ onSignup, onLogin }: ClosingProps) {
  return (
    <section className="vx3-closing">
      <div className="vx3-closing-glow" aria-hidden />
      <div className="vx3-shell vx3-closing-inner">
        <Reveal>
          <span className="vx3-kicker"><i aria-hidden />Comece hoje</span>
          <h2>Multiplique seus <em>resultados</em>.</h2>
          <p>Aprovação acima de 75%, saque instantâneo e uma plataforma completa. Crie sua conta em minutos.</p>
          <div className="vx3-hero-cta">
            <Button size="lg" onClick={onSignup} className="vx3-btn-glow">Criar minha conta <ArrowUpRight /></Button>
            <Button size="lg" variant="outline" onClick={onLogin}>Já tenho conta</Button>
          </div>
        </Reveal>
      </div>
      <footer className="vx3-footer">
        <div className="vx3-shell">
          <a href="#topo" aria-label="VENXPAY — início" className="flex items-center gap-2">
            <VenxpayLogo size={22} plate={false} animated={false} className="text-foreground" /><b>VENXPAY</b>
          </a>
          <nav aria-label="Links legais">{LEGAL.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
          <span>© {new Date().getFullYear()} VENXPAY</span>
        </div>
      </footer>
    </section>
  );
}
