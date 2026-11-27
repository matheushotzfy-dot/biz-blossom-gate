import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Copy, Link2 } from "lucide-react";
import { COMPANY, PROOFS, STEPS, hasCompany } from "./landingData";
import { Tight } from "./Tight";

/** Provas que dá para conferir sem criar conta. A empresa entra só quando os dados reais estiverem preenchidos. */
export function ProofStrip() {
  const company = hasCompany();
  return (
    <div className="lp-proofs" aria-labelledby="lp-proofs-title">
      <h3 id="lp-proofs-title">Confira antes de abrir a conta</h3>
      <ul className="lp-proof-list" data-count={company ? 4 : 3}>
        {PROOFS.map((p) => (
          <li key={p.t}>
            <div className="lp-proof-card">
              <p>{p.t}</p>
              <p>{p.d}</p>
              <Link to={p.to} className="lp-link">{p.cta}</Link>
            </div>
          </li>
        ))}
        {company && (
          <li>
            <div className="lp-proof-card">
              <p>Quem está por trás</p>
              <p>{COMPANY.legalName}, CNPJ {COMPANY.cnpj}{COMPANY.city ? `, ${COMPANY.city}` : ""}.</p>
              <a href="#empresa" className="lp-link">Ver os contatos</a>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Miniaturas de cada passo, desenhadas com as mesmas peças do painel (dados de exemplo).
 * Repetem o texto do passo em forma de tela, então ficam fora do leitor de tela.
 */
function StepVignette({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="lp-vig-card">
        <span className="lp-vig-avatar">MS</span>
        <span className="min-w-0 flex-1"><b>Maria da Silva</b><small>Pessoa física</small></span>
        <span className="lp-vig-chip" data-tone="wait">Em análise</span>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="lp-vig-card">
        <span className="lp-vig-thumb" />
        <span className="min-w-0 flex-1"><b>Método Escala 10x</b><small>R$ 297,00</small></span>
        <span className="lp-vig-chip" data-tone="wait">Em revisão</span>
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="grid w-full gap-2">
        <div className="lp-vig-card lp-vig-link"><Link2 /><span>/pay/metodo-escala-10x</span><Copy /></div>
        <div className="lp-vig-card"><span className="lp-vig-ok"><Check /></span><span className="min-w-0 flex-1"><b>Pix aprovado</b><small>agora</small></span><span className="lp-vig-price">R$ 297,00</span></div>
      </div>
    );
  }
  return (
    <div className="lp-vig-card">
      <span className="lp-vig-ok"><ArrowUpRight /></span>
      <span className="min-w-0 flex-1"><b>Saque por Pix</b><small>Chave terminada em 4417</small></span>
      <span className="lp-vig-chip" data-tone="ok">Concluído</span>
    </div>
  );
}

/** Do cadastro ao primeiro saque: a numeração existe porque a ordem é real. */
export function HowItWorks() {
  return (
    <section id="como-funciona" className="lp-section">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="lp-head">
          <h2 className="lp-h2 max-w-[15ch] text-foreground"><Tight>Do cadastro ao primeiro saque.</Tight></h2>
          <p className="lp-lead">Quatro passos, nesta ordem. A conta abre em poucos minutos e você monta o produto enquanto os documentos são analisados.</p>
        </div>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.t} className="lp-step">
              <div className="lp-vig" aria-hidden="true"><StepVignette index={i} /></div>
              <h3><span className="lp-step-n" aria-hidden>{i + 1}</span>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-[13.5px] text-muted-foreground">Nomes e valores das miniaturas são exemplos.</p>
      </div>
    </section>
  );
}
