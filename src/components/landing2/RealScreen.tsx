import { ConsoleReplica } from "./device/ConsoleReplica";
import { Rise } from "./bits";

const NOTES = [
  ["TEMPO REAL", "Aprovações, ticket e faturamento no mesmo campo de visão."],
  ["RASTREÁVEL", "Origem, método, taxa e destino preservados em cada movimento."],
  ["OPERACIONAL", "Produtos, vendas, financeiro e integrações sem trocar de sistema."],
];

export function RealScreen() {
  return (
    <section id="painel" className="vx-section vx-product">
      <div className="vx-shell">
        <div className="vx-product-heading">
          <span className="vx-kicker">02 / O PRODUTO</span>
          <h2>Uma operação inteira.<br />Uma única leitura.</h2>
          <p>O painel foi desenhado para mostrar o que exige atenção — e silenciar o resto.</p>
        </div>

        <Rise className="vx-console-stage"><ConsoleReplica /></Rise>

        <div className="vx-product-notes">
          {NOTES.map(([title, copy], index) => (
            <div key={title}><span>0{index + 1}</span><strong>{title}</strong><p>{copy}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}