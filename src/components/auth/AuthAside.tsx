import type { PointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import heroV from "@/assets/auth-v-hero.jpg";

/**
 * Palco do login (desktop): render cinematográfico do "V" da marca,
 * com parallax suave guiado pelo ponteiro.
 */
export interface AuthAsideProps {
  className?: string;
}

const SPRING = { stiffness: 60, damping: 18, mass: 0.6 };

export function AuthAside({ className }: AuthAsideProps) {
  const reduced = useReducedMotion() ?? false;
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);
  const x = useTransform(sx, (v) => v * -14);
  const y = useTransform(sy, (v) => v * -10);
  const rotY = useTransform(sx, (v) => v * 2.2);
  const rotX = useTransform(sy, (v) => v * -1.6);

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    py.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onLeave = () => { px.set(0); py.set(0); };

  const fade = (delay: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <aside
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("auth-aside relative isolate h-full overflow-hidden [perspective:1200px]", className)}
      aria-label="VENXPAY"
    >
      <motion.img
        src={heroV}
        alt=""
        width={1536}
        height={1920}
        decoding="async"
        {...{ fetchpriority: "high" }}
        style={reduced ? undefined : { x, y, rotateX: rotX, rotateY: rotY }}
        initial={reduced ? false : { opacity: 0, scale: 1.12 }}
        animate={{ opacity: 1, scale: 1.08 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_40%]"
      />
      <div className="auth-stage-vignette pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="auth-stage-grain pointer-events-none absolute inset-0" aria-hidden="true" />

      <motion.span {...fade(0.3)} className="absolute right-10 top-9 font-heading text-[12px] font-semibold tracking-[0.4em] auth-aside-muted">
        VENXPAY
      </motion.span>

      <motion.div {...fade(0.5)} className="pointer-events-none absolute bottom-10 left-10 max-w-[420px]">
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
