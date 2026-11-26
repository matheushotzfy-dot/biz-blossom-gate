import { Link } from "react-router-dom";
import { COMPANY, PROOFS, STEPS, hasCompany } from "./landingData";
import { Tight } from "./Tight";

/** Provas que dá para conferir sem criar conta. A empresa entra só quando os dados reais estiverem preenchidos. */
export function ProofStrip() {
  const company = hasCompany();
  return (
    <section className="lp-proofs" aria-labelledby="lp-proofs-title">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <h2 id="lp-proofs-title" className="text-[1.35rem] font-extrabold tracking-[-0.03em] text-foreground">
          Confira antes de abrir a conta
        </h2>
        <ul className="lp-proof-list" data-count={company ? 4 : 3}>
          {PROOFS.map((p) => (
            <li key={p.t} className="lp-proof">
              <p className="text-[1.05rem] font-extrabold tracking-[-0.02em] text-foreground">{p.t}</p>
              <p className="mt-1.5 text-[15px] leading-[1.6] text-muted-foreground">{p.d}</p>
              <Link to={p.to} className="lp-link mt-3 inline-block text-[15px]">{p.cta}</Link>
            </li>
          ))}
          {company && (
            <li className="lp-proof">
              <p className="text-[1.05rem] font-extrabold tracking-[-0.02em] text-foreground">Quem está por trás</p>
              <p className="mt-1.5 text-[15px] leading-[1.6] text-muted-foreground">
                {COMPANY.legalName}, CNPJ {COMPANY.cnpj}{COMPANY.city ? `, ${COMPANY.city}` : ""}.
              </p>
              <a href="#empresa" className="lp-link mt-3 inline-block text-[15px]">Ver os contatos</a>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

/** Do cadastro ao primeiro saque: a numeração existe porque a ordem é real. */
export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-background pb-20 pt-24 sm:pb-24 sm:pt-28">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <h2 className="lp-h2 max-w-[22ch] text-foreground"><Tight>Do cadastro ao primeiro saque.</Tight></h2>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.t} className="lp-step">
              <span className="lp-step-n" aria-hidden>{i + 1}</span>
              <h3 className="mt-5 text-[1.2rem] font-extrabold tracking-[-0.025em] text-foreground">{s.t}</h3>
              <p className="mt-2 text-[15.5px] leading-[1.65] text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
