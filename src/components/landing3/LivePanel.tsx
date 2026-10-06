/** Painel do vendedor simulado: KPIs, gráfico desenhado no scroll e feed de vendas. */
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { CountUp, Reveal, SectionHead, SpotCard } from "./bits";
import { SaleToasts } from "./SaleToasts";

const PATH = "M0 210 C 60 200, 90 170, 140 176 S 220 130, 270 140 S 350 96, 400 104 S 480 60, 530 70 S 610 34, 660 40 S 740 16, 800 20";

const KPIS = [
  { label: "Faturamento hoje", node: <CountUp to={18742.6} decimals={2} prefix="R$ " /> },
  { label: "Vendas aprovadas", node: <CountUp to={214} /> },
  { label: "Aprovação geral", node: <CountUp to={78.4} decimals={1} suffix="%" /> },
  { label: "Ticket médio", node: <CountUp to={87.58} decimals={2} prefix="R$ " /> },
];

export function LivePanel() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "center 50%"] });
  const draw = useSpring(scrollYProgress, { stiffness: 80, damping: 22 });

  return (
    <section id="painel" className="vx3-section">
      <div className="vx3-shell">
        <SectionHead
          kicker="05 · Painel ao vivo"
          title={<>Cada venda, <em>no momento</em> em que acontece.</>}
          text="Faturamento, aprovação e ticket médio atualizados em tempo real, com notificação a cada venda aprovada."
        />
        <Reveal>
          <SpotCard className="vx3-panel vx3-live-panel">
            <div ref={ref} className="vx3-live-grid">
              <div className="vx3-live-main">
                <div className="vx3-kpis">
                  {KPIS.map((k) => (
                    <div key={k.label}><span className="vx3-mono">{k.label}</span><strong>{k.node}</strong></div>
                  ))}
                </div>
                <svg viewBox="0 0 800 230" preserveAspectRatio="none" className="vx3-live-chart" aria-hidden>
                  <defs>
                    <linearGradient id="vx3Live" x1="0" x2="1">
                      <stop offset="0%" stopColor="hsl(var(--vx-sky))" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" />
                    </linearGradient>
                    <linearGradient id="vx3LiveArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[46, 92, 138, 184].map((y) => <line key={y} x1="0" x2="800" y1={y} y2={y} className="vx3-gridline" />)}
                  <motion.path d={`${PATH} L 800 230 L 0 230 Z`} fill="url(#vx3LiveArea)" style={reduce ? undefined : { opacity: draw }} />
                  <motion.path d={PATH} fill="none" stroke="url(#vx3Live)" strokeWidth="3" style={reduce ? undefined : { pathLength: draw }} />
                </svg>
              </div>
              <div className="vx3-live-feed">
                <span className="vx3-mono">Últimas vendas</span>
                <SaleToasts visible={4} interval={2200} offset={3} className="vx3-feed-list" />
              </div>
            </div>
            <p className="vx3-footnote">Simulação ilustrativa do painel.</p>
          </SpotCard>
        </Reveal>
      </div>
    </section>
  );
}
