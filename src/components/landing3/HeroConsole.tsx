/** Réplica sintética do painel mostrada na abertura (ilustração). */
import { motion, useReducedMotion } from "framer-motion";
import { CountUp } from "./bits";

const CHART = "M0 120 C 40 110, 60 96, 90 100 S 150 70, 180 76 S 240 40, 270 48 S 330 22, 360 30 S 420 8, 460 12";
const BARS = ["h-[38%]", "h-[52%]", "h-[44%]", "h-[66%]", "h-[58%]", "h-[80%]", "h-[72%]", "h-[92%]"];

export function HeroConsole() {
  const reduce = useReducedMotion();
  return (
    <div className="vx3-console">
      <div className="vx3-console-bar">
        <span className="vx3-dots" aria-hidden><i /><i /><i /></span>
        <span className="vx3-mono">painel.venxpay · ao vivo</span>
        <span className="vx3-live"><i />online</span>
      </div>
      <div className="vx3-console-body">
        <div className="vx3-console-main">
          <span className="vx3-mono">Saldo disponível</span>
          <strong className="vx3-console-big"><CountUp to={48392.1} decimals={2} prefix="R$ " duration={2.4} /></strong>
          <svg viewBox="0 0 460 130" className="vx3-console-chart" preserveAspectRatio="none">
            <defs>
              <linearGradient id="vx3Area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="vx3Line" x1="0" x2="1">
                <stop offset="0%" stopColor="hsl(var(--vx-sky))" />
                <stop offset="100%" stopColor="hsl(var(--primary))" />
              </linearGradient>
            </defs>
            <motion.path d={`${CHART} L 460 130 L 0 130 Z`} fill="url(#vx3Area)"
              initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 1 }} />
            <motion.path d={CHART} fill="none" stroke="url(#vx3Line)" strokeWidth="2.5"
              initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.2, duration: 1.8, ease: "easeInOut" }} />
          </svg>
        </div>
        <div className="vx3-console-side">
          <div className="vx3-ring">
            <svg viewBox="0 0 80 80" aria-hidden>
              <circle cx="40" cy="40" r="34" className="vx3-ring-track" />
              <motion.circle cx="40" cy="40" r="34" className="vx3-ring-fill"
                initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 0.784 }} transition={{ delay: 1.4, duration: 1.6, ease: "easeOut" }} />
            </svg>
            <span><CountUp to={78.4} decimals={1} suffix="%" /><small>aprovação</small></span>
          </div>
          <div className="vx3-bars" aria-hidden>
            {BARS.map((cls) => <i key={cls} className={cls} />)}
          </div>
          <span className="vx3-mono">vendas / hora</span>
        </div>
      </div>
    </div>
  );
}
