import { useId, useRef, useState, type KeyboardEvent } from "react";
import { TOUR } from "./landingData";
import { Tight } from "./Tight";

/**
 * "O painel por dentro": abas acessíveis (setas, Home e End trocam de aba) com as capturas reais.
 * Todas as imagens ficam no HTML para o leitor de tela e só a aba aberta aparece.
 */
export function PanelTour() {
  const base = useId();
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const go = (i: number) => {
    const next = (i + TOUR.length) % TOUR.length;
    setActive(next);
    tabs.current[next]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(TOUR.length - 1); }
  };

  return (
    <section id="painel" className="lp-tour">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 className="lp-h2 max-w-[18ch] text-foreground"><Tight>O painel por dentro.</Tight></h2>
          <p className="max-w-[34rem] text-[17px] leading-[1.7] text-muted-foreground lg:justify-self-end">
            Estas são as telas que você usa todo dia, do jeito que elas são. Só os nomes e os valores são de exemplo.
          </p>
        </div>

        <div role="tablist" aria-label="Telas do painel" className="lp-tabs">
          {TOUR.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => { tabs.current[i] = el; }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={active === i}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={active === i ? 0 : -1}
              className="lp-tab"
              onClick={() => setActive(i)}
              onKeyDown={onKey}
            >
              {t.label}
            </button>
          ))}
        </div>

        {TOUR.map((t, i) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`${base}-panel-${t.id}`}
            aria-labelledby={`${base}-tab-${t.id}`}
            hidden={active !== i}
            className="lp-tour-panel"
          >
            <div className="lp-tour-copy">
              <h3 className="text-[clamp(1.4rem,2.4vw,1.85rem)] font-extrabold leading-[1.15] tracking-[-0.035em] text-foreground">{t.title}</h3>
              <ul className="m-0 mt-6 grid gap-3.5 p-0" style={{ listStyle: "none" }}>
                {t.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-[15.5px] leading-[1.55] text-foreground">
                    <span aria-hidden className="lp-tick mt-[0.35rem]" />{p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lp-shot lp-shot-tour">
              <img src={t.image} width={1440} height={900} alt={t.alt} loading="lazy" decoding="async" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
