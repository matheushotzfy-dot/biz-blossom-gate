import { useEffect } from "react";
import { motion, type Variants } from "framer-motion";

/** Monograma em V, desenhado aqui (cada porta mostra uma metade). */
function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <path d="M24 16 L60 96 L96 16" fill="none" stroke="hsl(158 62% 48%)" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="42" y="44" width="36" height="9" rx="4.5" fill="hsl(160 40% 7%)" />
    </svg>
  );
}

const EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];

const doorL: Variants = {
  closed: { x: "0%" },
  open: { x: "-103%", transition: { duration: 1.2, ease: EASE, delay: 0.3 } },
};
const doorR: Variants = {
  closed: { x: "0%" },
  open: { x: "103%", transition: { duration: 1.2, ease: EASE, delay: 0.3 } },
};
const flood: Variants = {
  closed: { opacity: 0 },
  open: { opacity: [0, 0.95, 0], scaleX: [0.2, 1, 1.6], transition: { duration: 1.5, times: [0, 0.35, 1], delay: 0.2 } },
};
const veil: Variants = {
  closed: { opacity: 1 },
  open: { opacity: 0, transition: { duration: 0.4, delay: 1.45 } },
};
const pulse: Variants = {
  closed: { opacity: [0.55, 1, 0.55], transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } },
  open: { opacity: 0, transition: { duration: 0.3 } },
};

/**
 * Abertura: portas de cofre fechadas enquanto os dados carregam; ao abrir, o monograma se parte,
 * a luz sai pela fresta e a sala aparece. Qualquer tecla ou clique em "Pular" encerra na hora.
 */
export function VaultIntro({ open, onFinish }: { open: boolean; onFinish: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onFinish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFinish]);

  return (
    <motion.div
      className="vw-intro"
      variants={veil}
      initial="closed"
      animate={open ? "open" : "closed"}
      onAnimationComplete={(def) => { if (def === "open") onFinish(); }}
    >
      <span className="sr-only" role="status">{open ? "Abrindo as premiações" : "Carregando as premiações"}</span>
      <motion.div className="vw-flood" variants={flood} />
      <motion.div className="vw-door vw-door-l" variants={doorL}>
        <motion.div className="vw-door-mark" variants={pulse}><Mark className="h-36 w-auto sm:h-48" /></motion.div>
      </motion.div>
      <motion.div className="vw-door vw-door-r" variants={doorR}>
        <motion.div className="vw-door-mark" variants={pulse}><Mark className="h-36 w-auto sm:h-48" /></motion.div>
      </motion.div>
      <button type="button" className="vw-skip" onClick={onFinish}>Pular abertura</button>
    </motion.div>
  );
}
