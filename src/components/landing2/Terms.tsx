/**
 * Terms — condições comerciais em tipografia grande, números tabulares.
 */
import { ArrowRight, Minus } from "lucide-react";
import { Rise } from "./bits";

const TERMS: { label: string; value: string; note: string }[] = [
  { label: "Mensalidade", value: "R$ 0", note: "Sem plano, sem fidelidade, sem setup" },
  { label: "Pix", value: "taxa única", note: "Liquidação no mesmo dia, inclusive fim de semana" },
  { label: "Cartão", value: "até 12x", note: "Antecipação disponível sob demanda" },
  { label: "Saque", value: "quando quiser", note: "Sem janela fixa e sem valor mínimo escondido" },
];

const EXCLUDED = ["Taxa de adesão", "Cobrança por produto criado", "Custo por saque agendado"];

export function Terms({ onSignup }: { onSignup: () => void }) {
  return (
    <section id="condicoes" className="vx-cv relative py-28 sm:py-36">
      <div className="mx-auto max-w-[1280px] px-5">
        <span className="vx-mono">condições</span>
        <h2 className="mt-5 max-w-[19ch] text-[38px] font-extrabold text-foreground sm:text-[58px]">
          Escritas antes de você começar
        </h2>

        <div className="mt-14 border-t border-border">
          {TERMS.map((t, i) => (
            <Rise key={t.label} delay={i * 0.04}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-border py-8">
                <div>
                  <p className="text-[22px] font-bold text-foreground sm:text-[28px]">{t.label}</p>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">{t.note}</p>
                </div>
                <p className="vx-num text-[26px] font-extrabold text-primary sm:text-[34px]">{t.value}</p>
              </div>
            </Rise>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
          {EXCLUDED.map((e) => (
            <p key={e} className="flex items-center gap-2 text-[12.5px] text-muted-foreground/70 line-through">
              <Minus className="h-3.5 w-3.5" />
              {e}
            </p>
          ))}
        </div>

        <div className="mt-12">
          <button type="button" onClick={onSignup} className="vx-btn">
            Criar minha conta <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-3.5 text-[11.5px] text-muted-foreground">Sem cartão de crédito · sem mensalidade</p>
        </div>
      </div>
    </section>
  );
}
