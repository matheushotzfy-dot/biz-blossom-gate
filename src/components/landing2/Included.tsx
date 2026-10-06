import { ArrowUpRight } from "lucide-react";
import { Rise } from "./bits";

const ITEMS = [
  ["Checkout", "Personalização, ofertas e recuperação de pedidos."],
  ["Membros", "Conteúdo, progresso, acesso e certificação."],
  ["Afiliados", "Comissão e coprodução ligadas à aprovação."],
  ["Integração", "API e webhooks para operações próprias."],
  ["Proteção", "Antifraude, disputas e histórico operacional."],
  ["Financeiro", "Saldo, extrato, recebíveis e saques."],
];

export function Included() {
  return (
    <section id="incluso" className="vx-section vx-included">
      <div className="vx-shell">
        <div className="vx-section-intro vx-section-intro-wide">
          <span className="vx-kicker">04 / A ESTRUTURA</span>
          <h2>O essencial já nasce conectado.</h2>
        </div>
        <div className="vx-capability-list">
          {ITEMS.map(([title, copy], index) => (
            <Rise key={title} delay={index * 0.04} className="vx-capability-row">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <ArrowUpRight />
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}