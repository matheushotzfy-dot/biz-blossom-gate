import { motion, useReducedMotion } from "framer-motion";

const METRICS = [
  { value: "75%+", label: "Aprovação", fill: 0.78 },
  { value: "Instantâneo", label: "Saque", fill: 0.95 },
  { value: "24/7", label: "Disponível", fill: 1 },
] as const;

export function MetricCells() {
  const reduced = useReducedMotion();
  return (
    <dl className="auth-aside-border grid grid-cols-3 border">
      {METRICS.map((m, i) => (
        <div key={m.label} className={i > 0 ? "auth-aside-border border-l px-4 py-3" : "px-4 py-3"}>
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] auth-aside-muted">{m.label}</dt>
          <dd className="mt-1 font-heading text-[17px] font-semibold">{m.value}</dd>
          <div className="auth-aside-panel mt-2 h-[3px] overflow-hidden">
            <motion.div
              className="auth-aside-bar h-full"
              initial={reduced ? false : { width: 0 }}
              animate={{ width: `${m.fill * 100}%` }}
              transition={{ duration: 1.1, delay: 0.5 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}
