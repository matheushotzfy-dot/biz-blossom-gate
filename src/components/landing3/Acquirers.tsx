/** Diagrama animado de roteamento entre adquirências exclusivas com reserva. */
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, Fingerprint, GitBranch, Lock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp, Reveal, SectionHead, SpotCard } from "./bits";

const POINTS = [
  { icon: Fingerprint, title: "Nominais e exclusivas", text: "Adquirências 100% exclusivas da Vemprapay, não compartilhadas com o mercado." },
  { icon: GitBranch, title: "Roteamento inteligente", text: "Cada transação segue pela rota com melhor chance de aprovação." },
  { icon: Lock, title: "Reserva automática", text: "Se uma rota oscila, a venda desvia para a reserva sem o cliente perceber." },
  { icon: TrendingUp, title: "75%+ de aprovação", text: "PIX e cartão mantidos acima de 75% para você vender mais com o mesmo tráfego." },
];

// Caminhos do SVG (viewBox 600x320): checkout → adquirente → aprovado.
const ROUTES = [
  { id: "a", label: "Adquirente exclusiva A", y: 70, d: "M110 160 C 200 160, 200 70, 300 70 L 340 70 C 430 70, 430 160, 500 160" },
  { id: "b", label: "Adquirente exclusiva B", y: 160, d: "M110 160 L 500 160" },
  { id: "r", label: "Rota de reserva", y: 250, d: "M110 160 C 200 160, 200 250, 300 250 L 340 250 C 430 250, 430 160, 500 160" },
];

export function Acquirers() {
  const reduce = useReducedMotion();
  const [failA, setFailA] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setFailA((f) => !f), 3600);
    return () => window.clearInterval(id);
  }, [reduce]);

  const live = (id: string) => (id === "a" ? !failA : id === "r" ? failA : true);

  return (
    <section id="adquirencia" className="vx3-section">
      <div className="vx3-shell">
        <SectionHead
          kicker="02 · Adquirência"
          title={<>A melhor aprovação do mercado, <em>por design</em>.</>}
          text="Nominais e adquirências 100% exclusivas que mantêm PIX e cartão acima de 75% de aprovação."
        />
        <div className="vx3-acq">
          <Reveal className="vx3-acq-diagram">
            <SpotCard className="vx3-panel">
              <svg viewBox="0 0 600 320" className="w-full" role="img" aria-label="Venda roteada entre adquirências exclusivas com reserva automática">
                {ROUTES.map((r) => (
                  <g key={r.id} className={cn("vx3-route", live(r.id) ? "is-live" : "is-down")}>
                    <path d={r.d} className="vx3-route-base" />
                    <path d={r.d} className="vx3-route-flow" />
                    <rect x="300" y={r.y - 16} width="40" height="32" rx="8" className="vx3-route-node" />
                    <text x="320" y={r.y - 26} textAnchor="middle" className="vx3-svg-label">{r.label}</text>
                  </g>
                ))}
                <rect x="30" y="138" width="80" height="44" rx="10" className="vx3-end-node" />
                <text x="70" y="165" textAnchor="middle" className="vx3-svg-strong">Checkout</text>
                <rect x="500" y="138" width="80" height="44" rx="10" className="vx3-end-node is-ok" />
                <text x="540" y="165" textAnchor="middle" className="vx3-svg-strong">Aprovado</text>
              </svg>
              <div className="vx3-acq-status">
                <span className={cn("vx3-pill", failA ? "is-warn" : "is-ok")}>
                  {failA ? "Rota A oscilando · desviando para a reserva" : "Todas as rotas operando"}
                </span>
                <span className="vx3-acq-rate"><Check aria-hidden /> Aprovação <CountUp to={78.4} decimals={1} suffix="%" /></span>
              </div>
            </SpotCard>
          </Reveal>
          <div className="vx3-acq-points">
            {POINTS.map((p, i) => {
              const Icon = p.icon;
              return (
                <Reveal key={p.title} delay={i * 0.08}>
                  <SpotCard className="vx3-point">
                    <span className="vx3-icon"><Icon aria-hidden /></span>
                    <div><h3>{p.title}</h3><p>{p.text}</p></div>
                  </SpotCard>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
