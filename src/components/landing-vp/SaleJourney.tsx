import type { ReactNode } from "react";
import { CheckMark, CheckoutSpecimen, MemberSpecimen, PaidSpecimen, PayoutSpecimen, WebhookSpecimen } from "./Specimens";
import { Tight } from "./Tight";

const STAGES: Array<{ title: string; text: string; specimen: ReactNode }> = [
  {
    title: "O cliente abre o seu checkout",
    text: "Pix, cartão ou boleto, o que você deixar ligado no produto. Você escolhe a cor do botão, o banner, o cronômetro da oferta e os order bumps, e vê o resultado ao vivo enquanto edita.",
    specimen: <CheckoutSpecimen />,
  },
  {
    title: "O pagamento é confirmado",
    text: "O Pix aprovado vira venda paga na hora, com o status de cada tentativa no painel. Cartão e boleto seguem o prazo mostrado na página Taxas.",
    specimen: <PaidSpecimen />,
  },
  {
    title: "O seu sistema é avisado",
    text: "Cada evento sai assinado para o endereço que você cadastrar. Se o seu servidor não responder, tentamos de novo mais algumas vezes, e você reenvia à mão pelo painel.",
    specimen: <WebhookSpecimen />,
  },
  {
    title: "O aluno recebe o acesso",
    text: "Só pagamento confirmado libera o acesso, e ele vai para o e-mail da compra. O aluno entra numa área própria, continua de onde parou e acompanha o progresso.",
    specimen: <MemberSpecimen />,
  },
  {
    title: "O dinheiro vai para o seu saldo",
    text: "Com coprodutor ou afiliado, a divisão já chega feita: cada um vê a sua parte no próprio saldo. Do seu, você pede o saque por Pix, ou liga o saque automático para sacar sozinho ao chegar no valor que escolher.",
    specimen: <PayoutSpecimen />,
  },
];

export function SaleJourney() {
  return (
    <section id="venda" className="bg-background pb-24 pt-4 sm:pb-32">
      <div className="mx-auto grid max-w-[1180px] gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-[clamp(2rem,4.2vw,3.1rem)] font-extrabold leading-[1.07] tracking-[-0.04em] text-foreground">
            <Tight>Uma venda de R$ 197, do clique ao saque.</Tight>
          </h2>
          <p className="mt-5 max-w-[30rem] text-[17px] leading-[1.65] text-muted-foreground">
            Este é o caminho de uma compra de exemplo. Você configura o produto uma vez e o resto acontece sozinho, com cada passo visível no painel.
          </p>
          <p className="mt-4 text-[13.5px] text-muted-foreground">Nomes e valores desta página são exemplos.</p>
        </div>
        <ol className="lp-stages">
          {STAGES.map((s) => (
            <li key={s.title} className="lp-stage">
              <span className="lp-node"><CheckMark /></span>
              <div className="min-w-0">
                <h3 className="text-[1.3rem] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{s.title}</h3>
                <p className="mt-2 max-w-[35rem] text-[16px] leading-[1.7] text-muted-foreground">{s.text}</p>
                <div className="mt-6" aria-hidden="true">{s.specimen}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
