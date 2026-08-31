/**
 * Included — lista tipográfica densa em duas colunas, sem cards.
 */
import { Rise } from "./bits";

const ITEMS: [string, string][] = [
  ["Checkout personalizável", "Order bump, upsell, cupom, prova social e recuperação de Pix."],
  ["Área de membros", "Módulos, aulas, progresso, comentários e certificado automático."],
  ["Afiliados e coprodução", "Percentuais definidos uma vez, crédito automático na aprovação."],
  ["API REST e webhooks", "Cobrança, consulta, reembolso e estorno com assinatura HMAC-SHA256."],
  ["Antifraude e disputas", "Score por transação e acompanhamento assistido de MED e chargeback."],
  ["Nota fiscal", "Emissão integrada para cada venda aprovada, sem trabalho manual."],
  ["Saques quando quiser", "Pix a qualquer hora, sem janela fixa e sem valor mínimo escondido."],
  ["Suporte humano", "Atendimento em português, por gente que conhece a operação."],
];

export function Included() {
  return (
    <section id="incluso" className="vx-cv relative py-28 sm:py-36">
      <div className="mx-auto max-w-[1280px] px-5">
        <span className="vx-mono">o que já vem ligado</span>
        <h2 className="mt-5 max-w-[20ch] text-[38px] font-extrabold text-foreground sm:text-[58px]">
          Nada disso é módulo pago à parte
        </h2>

        <div className="mt-14 grid gap-x-14 border-t border-border md:grid-cols-2">
          {ITEMS.map(([title, copy], i) => (
            <Rise key={title} delay={(i % 2) * 0.05}>
              <div className="group border-b border-border py-7 transition-colors duration-300 hover:border-primary/50">
                <div className="flex items-baseline gap-4">
                  <span className="vx-mono w-7 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-[20px] font-bold text-foreground transition-colors duration-300 group-hover:text-primary sm:text-[24px]">
                      {title}
                    </h3>
                    <p className="mt-2 max-w-[46ch] text-[13.5px] leading-[1.7] text-muted-foreground">{copy}</p>
                  </div>
                </div>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}
