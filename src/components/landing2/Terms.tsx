import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const TERMS = [
  ["Mensalidade", "R$ 0", "Sem adesão, plano ou fidelidade."],
  ["PIX", "direto", "Confirmação rápida e rastreável."],
  ["Cartão", "até 12x", "Recebíveis organizados por venda."],
  ["Saque", "sob demanda", "Solicitado e acompanhado pelo painel."],
];

export interface TermsProps { onSignup: () => void; }

export function Terms({ onSignup }: TermsProps) {
  return (
    <section id="condicoes" className="vx-section vx-terms">
      <div className="vx-shell">
        <span className="vx-kicker">06 / AS CONDIÇÕES</span>
        <div className="vx-terms-heading">
          <h2>Clareza antes da primeira venda.</h2>
          <div><Check /> Sem custo de adesão<br /><Check /> Sem cobrança por produto<br /><Check /> Sem mensalidade</div>
        </div>
        <div className="vx-terms-list">
          {TERMS.map(([label, value, note], index) => (
            <div key={label}><span>0{index + 1}</span><h3>{label}</h3><strong>{value}</strong><p>{note}</p></div>
          ))}
        </div>
        <Button size="lg" onClick={onSignup}>Criar minha conta <ArrowUpRight /></Button>
      </div>
    </section>
  );
}