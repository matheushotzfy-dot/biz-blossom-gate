import { ArrowUpRight } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { Button } from "@/components/ui/button";
import { CutLines } from "./bits";

const LEGAL = [
  ["/termos-de-uso", "Termos"], ["/politica-de-privacidade", "Privacidade"],
  ["/docs", "Documentação"], ["/status", "Status"],
];

export interface ClosingProps { onSignup: () => void; }

export function Closing({ onSignup }: ClosingProps) {
  return (
    <section className="vx-closing">
      <div className="vx-closing-lines" aria-hidden />
      <div className="vx-shell vx-closing-inner">
        <span className="vx-kicker">COMECE PELO CONTROLE</span>
        <CutLines as="h2" className="vx-closing-title" lines={[<>SUA PRÓXIMA</>, <><em>VENDA,</em></>, <>SEM RUÍDO.</>]} />
        <div className="vx-closing-action">
          <p>Abra sua conta e coloque sua operação em movimento.</p>
          <Button size="lg" onClick={onSignup}>Começar agora <ArrowUpRight /></Button>
        </div>
      </div>
      <footer className="vx-footer">
        <div className="vx-shell">
          <a href="#topo" aria-label="VENXPAY — início"><VenxpayLogo size={24} plate={false} animated={false} /><b>VENXPAY</b></a>
          <nav>{LEGAL.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </section>
  );
}