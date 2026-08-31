/**
 * OfferScene — condições comerciais em formato de contrato aberto.
 */
import { ArrowRight, Check, Minus } from "lucide-react";
import { Reveal, SectionHead } from "./parts";

const TERMS = [
  { label: "Mensalidade", value: "R$ 0", note: "Sem plano, sem fidelidade, sem setup" },
  { label: "Pix", value: "taxa única", note: "Liquidação no mesmo dia, inclusive fim de semana" },
  { label: "Cartão", value: "até 12x", note: "Antecipação disponível sob demanda" },
  { label: "Saque", value: "quando quiser", note: "Sem janela fixa e sem valor mínimo escondido" },
];

const INCLUDED = [
  "Checkout otimizado e personalizável",
  "Área de membros com certificados",
  "Afiliados, coprodução e splits",
  "API, webhooks e documentação",
  "Antifraude e disputas assistidas",
  "Suporte humano em português",
];

const EXCLUDED = ["Taxa de adesão", "Cobrança por produto criado", "Custo por saque agendado"];

export function OfferScene({ onSignup }: { onSignup: () => void }) {
  return (
    <section id="condicoes" className="venx-cv relative overflow-hidden py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-5">
        <SectionHead
          kicker="Condições"
          title={<>Regras claras, escritas antes de você começar</>}
          copy="Você não descobre a condição depois da primeira venda. Está tudo aqui, na mesma página em que você decide."
          center
        />

        <div className="mt-16 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <div className="venx-panel h-full p-7 sm:p-9">
              <div className="divide-y divide-border">
                {TERMS.map((t) => (
                  <div key={t.label} className="flex items-baseline justify-between gap-6 py-5 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-[14.5px] font-bold text-foreground">{t.label}</p>
                      <p className="mt-1 text-[12.5px] text-muted-foreground">{t.note}</p>
                    </div>
                    <p className="num shrink-0 text-[18px] font-bold text-primary">{t.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {INCLUDED.map((item) => (
                  <p key={item} className="flex items-start gap-2.5 text-[13.5px] text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </p>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6">
                {EXCLUDED.map((item) => (
                  <p key={item} className="flex items-center gap-2 text-[12.5px] text-muted-foreground/70 line-through">
                    <Minus className="h-3.5 w-3.5" />
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="venx-glass flex h-full flex-col justify-between p-7 sm:p-9">
              <div>
                <span className="venx-kicker">Comece hoje</span>
                <h3 className="mt-5 font-heading text-[28px] font-extrabold leading-[1.2] text-foreground">
                  Conta criada em minutos, primeira venda no mesmo dia
                </h3>
                <p className="mt-4 text-[14px] leading-[1.7] text-muted-foreground">
                  Cadastro, verificação e publicação do primeiro produto acontecem sem fila e sem reunião comercial.
                </p>
              </div>
              <div className="mt-9">
                <button type="button" onClick={onSignup} className="venx-cta w-full">
                  Criar minha conta <ArrowRight className="h-4 w-4" />
                </button>
                <p className="mt-4 text-center text-[11.5px] text-muted-foreground">
                  Sem cartão de crédito · sem mensalidade
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
