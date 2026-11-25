import { LiveLedger } from "./LiveLedger";
import { Tight } from "./Tight";

export function HeroSection({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="bg-background">
      <div className="mx-auto grid max-w-[1180px] items-center gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)] lg:gap-16 lg:pb-28 lg:pt-20">
        <div>
          <h1 className="text-[clamp(2.6rem,6.6vw,5.1rem)] font-extrabold leading-[1.01] tracking-[-0.048em] text-foreground">
            <Tight>Venda, entregue e receba num painel só.</Tight>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[clamp(1.05rem,1.6vw,1.2rem)] leading-[1.65] text-muted-foreground">
            Checkout com Pix, cartão e boleto. Área de membros que libera o acesso quando o pagamento confirma. Divisão automática com coprodutor e afiliado. Saque por Pix para a sua conta.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <button type="button" onClick={onSignup} className="lp-btn">Abrir minha conta</button>
            <a href="#venda" className="lp-link text-[16px]">Ver uma venda do começo ao fim</a>
          </div>
          <p className="mt-6 max-w-[32rem] text-[14.5px] leading-relaxed text-muted-foreground">
            Sem mensalidade. A taxa de cada forma de pagamento aparece no painel antes da sua primeira venda.
          </p>
        </div>
        <LiveLedger />
      </div>
    </section>
  );
}
