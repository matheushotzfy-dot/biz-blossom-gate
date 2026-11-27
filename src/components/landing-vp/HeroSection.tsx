import { Bell, Lock } from "lucide-react";
import painelInicio from "@/assets/landing/painel-inicio.webp";
import checkoutPix from "@/assets/landing/checkout-pix.webp";
import { Tight } from "./Tight";

const FACTS = ["Sem mensalidade", "Conta com CPF ou CNPJ", "Saque por Pix com a sua senha"] as const;

/** O React 18 não conhece `fetchPriority`; o atributo em minúsculas passa direto para o HTML. */
const HIGH_PRIORITY = { fetchpriority: "high" } as Record<string, string>;

/** Janela do painel: barra com o nome da tela (sem endereço inventado) e a captura real. */
export function PanelWindow({ src, alt, eager = false, label = "Painel do vendedor" }: { src: string; alt: string; eager?: boolean; label?: string }) {
  return (
    <div className="lp-window">
      <div className="lp-window-bar" aria-hidden="true">
        <i /><i /><i />
        <span><Lock />{label}</span>
      </div>
      <img src={src} width={1440} height={900} alt={alt} decoding="async" {...(eager ? HIGH_PRIORITY : { loading: "lazy" as const })} />
    </div>
  );
}

/**
 * Topo: o verde da marca com o que é e para quem, e embaixo as duas pontas de uma venda — o cliente pagando
 * o Pix no celular, o painel do vendedor e o aviso "Nova venda aprovada" que o painel mostra (mesmo texto da
 * notificação real). As telas são capturas reais com dados de exemplo, e a legenda avisa.
 */
export function HeroSection({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="lp-hero lp-on-green" style={{ ["--lp-tail" as string]: "clamp(7rem, 22vw, 17rem)" }}>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="lp-hero-copy">
          <h1 className="lp-display">
            <Tight>Checkout, área de membros e saque num painel só.</Tight>
          </h1>
          <div>
            <p className="lp-lead">
              Pix, cartão e boleto no mesmo checkout, o curso liberado quando o pagamento confirma e cada venda
              no seu extrato. Para quem vende curso, mentoria e produto digital.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <button type="button" onClick={onSignup} className="lp-btn lp-btn-light">Abrir minha conta</button>
              <a href="#painel" className="lp-link lp-link-light text-[16px]">Ver o painel por dentro</a>
            </div>
            <ul className="lp-facts" aria-label="Condições">
              {FACTS.map((f) => (
                <li key={f}><span aria-hidden className="lp-tick" />{f}</li>
              ))}
            </ul>
          </div>
        </div>

        <figure className="lp-scene m-0" aria-label="O cliente paga o Pix no celular e a venda aparece no painel">
          <div className="lp-stage">
            <PanelWindow eager src={painelInicio} alt="Painel do vendedor: saldo disponível, vendas de hoje e faturamento aprovado" />
            <div className="lp-phone">
              <img src={checkoutPix} width={780} height={1542} alt="Checkout no celular com o QR Code do Pix aguardando o pagamento" decoding="async" />
            </div>
            <div className="lp-toast">
              <span className="lp-toast-icon" aria-hidden="true"><Bell /></span>
              <span className="min-w-0">
                <b>Nova venda aprovada</b>
                <small>Você recebeu R$ 278,42 líquidos.</small>
              </span>
              <time aria-hidden="true">agora</time>
            </div>
          </div>
          <figcaption className="lp-caption">Telas reais do checkout e do painel. Nomes e valores são exemplos.</figcaption>
        </figure>
      </div>
    </section>
  );
}
