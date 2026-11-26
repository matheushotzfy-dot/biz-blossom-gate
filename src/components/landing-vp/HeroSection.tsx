import painelInicio from "@/assets/landing/painel-inicio.webp";
import checkoutPix from "@/assets/landing/checkout-pix.webp";
import { Tight } from "./Tight";

const FACTS = ["Sem mensalidade", "Conta com CPF ou CNPJ", "Saque por Pix com a sua senha"] as const;

/** O React 18 não conhece `fetchPriority`; o atributo em minúsculas passa direto para o HTML. */
const HIGH_PRIORITY = { fetchpriority: "high" } as Record<string, string>;

/**
 * Topo: o que é, para quem, e as duas pontas de uma venda na mesma cena —
 * o cliente pagando no celular e o vendedor vendo o dinheiro no painel. As duas telas são capturas reais.
 */
export function HeroSection({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="lp-hero">
      <div className="mx-auto max-w-[1200px] px-5 pt-10 sm:px-8 sm:pt-14 lg:pt-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:items-end lg:gap-16">
          <h1 className="lp-display max-w-[17ch] text-foreground">
            <Tight>Do Pix do cliente ao seu saque, tudo na sua frente.</Tight>
          </h1>
          <div className="lg:pb-2">
            <p className="max-w-[34rem] text-[clamp(1.05rem,1.5vw,1.15rem)] leading-[1.65] text-muted-foreground">
              Checkout com Pix, cartão e boleto, área de membros, divisão com coprodutor e afiliado e saque por Pix. Cada movimentação vira um lançamento no seu extrato.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
              <button type="button" onClick={onSignup} className="lp-btn">Abrir minha conta</button>
              <a href="#painel" className="lp-link text-[16px]">Ver o painel por dentro</a>
            </div>
          </div>
        </div>
        <ul className="lp-facts" aria-label="Condições">
          {FACTS.map((f) => (
            <li key={f}><span aria-hidden className="lp-tick" />{f}</li>
          ))}
        </ul>
      </div>

      <figure className="lp-scene" aria-label="O cliente paga no checkout e a venda aparece no painel">
        <div className="lp-scene-floor" aria-hidden />
        <div className="relative mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="lp-scene-stage">
            <div className="lp-shot lp-shot-panel">
              <img
                src={painelInicio}
                width={1440}
                height={900}
                alt="Painel do vendedor: saldo disponível, vendas de hoje e faturamento aprovado"
                {...HIGH_PRIORITY}
                decoding="async"
              />
            </div>
            <div className="lp-phone">
              <img src={checkoutPix} width={780} height={1542} alt="Checkout no celular com o QR Code do Pix aguardando o pagamento" decoding="async" />
            </div>
          </div>
          <figcaption className="lp-caption">Telas reais do checkout e do painel. Nomes e valores são exemplos.</figcaption>
        </div>
      </figure>
    </section>
  );
}
