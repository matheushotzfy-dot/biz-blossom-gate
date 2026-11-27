import { useId, useRef, useState, type KeyboardEvent } from "react";
import { GraduationCap, Receipt, ShoppingCart, Wallet, Webhook, type LucideIcon } from "lucide-react";
import { TOUR } from "./landingData";
import { PanelWindow } from "./HeroSection";
import { Tight } from "./Tight";

const ICONS: Record<string, LucideIcon> = { vendas: Receipt, checkout: ShoppingCart, membros: GraduationCap, saques: Wallet, webhooks: Webhook };

/**
 * "O painel por dentro": abas acessíveis (setas, Home e End trocam de aba; em pé no computador, deitadas no celular)
 * com as capturas reais. Todas as telas ficam no HTML para o leitor de tela e só a aba aberta aparece.
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
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(active + 1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(active - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(TOUR.length - 1); }
  };

  return (
    <section id="painel" className="lp-section lp-mist">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="lp-head">
          <h2 className="lp-h2 max-w-[14ch] text-foreground"><Tight>O painel por dentro.</Tight></h2>
          <p className="lp-lead">As telas que você usa todo dia, do jeito que elas são. Só os nomes e os valores são de exemplo.</p>
        </div>

        <div className="lp-tour-grid">
          <div role="tablist" aria-label="Telas do painel" aria-orientation="vertical" className="lp-tabs">
            {TOUR.map((t, i) => {
              const Icon = ICONS[t.id] ?? Receipt;
              return (
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
                  <span className="lp-tab-ico" aria-hidden="true"><Icon /></span>
                  {t.label}
                </button>
              );
            })}
          </div>

          <div>
            {TOUR.map((t, i) => (
              <div
                key={t.id}
                role="tabpanel"
                id={`${base}-panel-${t.id}`}
                aria-labelledby={`${base}-tab-${t.id}`}
                hidden={active !== i}
                className="lp-tour-panel"
              >
                <PanelWindow src={t.image} alt={t.alt} label={t.id === "checkout" ? "Checkout do seu produto" : t.id === "membros" ? "Área do aluno" : "Painel do vendedor"} />
                <h3>{t.title}</h3>
                <ul className="lp-points">
                  {t.points.map((p) => (
                    <li key={p}><span aria-hidden className="lp-tick" />{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
