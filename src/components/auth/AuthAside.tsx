import { Component, lazy, Suspense, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Palco do login (desktop): o "V" 3D da marca como protagonista único.
 * O 3D é carregado sob demanda; o fallback em SVG evita tela vazia.
 */
const BrandV3D = lazy(() => import("./aside/BrandV3D"));

export interface AuthAsideProps {
  className?: string;
}

function VOutline() {
  return (
    <svg viewBox="-1.4 -1.2 2.8 2.4" className="auth-aside-mark h-40 w-40" fill="none" aria-hidden="true">
      <path d="M-1.25 -1 L-0.66 -1 L0 0.32 L0.66 -1 L1.25 -1 L0.3 1 L-0.3 1 Z" stroke="currentColor" strokeWidth="0.02" />
    </svg>
  );
}

/** Se o WebGL falhar, mantém o contorno em vez de quebrar a tela de login. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="flex h-full items-center justify-center"><VOutline /></div> : this.props.children;
  }
}

export function AuthAside({ className }: AuthAsideProps) {
  const reduced = useReducedMotion() ?? false;
  const fade = (delay: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <aside className={cn("auth-aside auth-stage relative isolate h-full overflow-hidden", className)} aria-label="VENXPAY">
      <div className="auth-stage-glow pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div className="absolute inset-0">
        <SceneBoundary>
          <Suspense fallback={<div className="flex h-full items-center justify-center"><VOutline /></div>}>
            <BrandV3D animated={!reduced} />
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="auth-stage-grain pointer-events-none absolute inset-0" aria-hidden="true" />

      <motion.span {...fade(0.2)} className="absolute right-10 top-9 font-heading text-[12px] font-semibold tracking-[0.4em] auth-aside-muted">
        VENXPAY
      </motion.span>

      <motion.div {...fade(0.35)} className="pointer-events-none absolute bottom-10 left-10 max-w-[420px]">
        <h2 className="font-heading text-[34px] font-semibold leading-[1.08] tracking-tight">
          Pagamentos<br />que não param.
        </h2>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.24em] auth-aside-muted">
          PIX · Cartão · Saque instantâneo
        </p>
      </motion.div>
    </aside>
  );
}

export default AuthAside;
