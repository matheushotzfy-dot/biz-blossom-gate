import { FileSpreadsheet, Link2, Palette, Plug, Search, Target, TicketPercent, Users, type LucideIcon } from "lucide-react";
import { SELL_FEATURES } from "./landingData";
import { Tight } from "./Tight";

const ICONS: Record<string, LucideIcon> = {
  "Links de pagamento": Link2,
  "Checkout com a sua cara": Palette,
  "Cupons de desconto": TicketPercent,
  "Afiliados e coprodução": Users,
  "Pixels por produto": Target,
  "Apps conectados": Plug,
  "Relatórios que saem do painel": FileSpreadsheet,
  "Busca em qualquer tela": Search,
};

/** Ferramentas que já vêm na conta. Cada uma existe hoje no painel. */
export function FeaturesSection() {
  return (
    <section id="recursos" className="lp-section">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="lp-head">
          <h2 className="lp-h2 max-w-[13ch] text-foreground"><Tight>Tudo o que vem na conta.</Tight></h2>
          <p className="lp-lead">Nada para instalar: estas ferramentas já estão no painel no dia em que você abre a conta.</p>
        </div>
        <ul className="lp-features">
          {SELL_FEATURES.map((f) => {
            const Icon = ICONS[f.t] ?? Link2;
            return (
              <li key={f.t}>
                <span className="lp-icon" aria-hidden="true"><Icon /></span>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
