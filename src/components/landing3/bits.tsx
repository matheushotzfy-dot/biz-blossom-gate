/**
 * Primitivas de movimento da landing Vemprapay (v3).
 * Tudo é apresentacional; respeita `prefers-reduced-motion`.
 */
import { useEffect, useRef, useState, type ComponentProps, type PointerEvent, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

/** Revela o conteúdo ao entrar na tela (opacidade + deslocamento). */
export function Reveal({ children, className, delay = 0, y = 28 }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export interface SpotCardProps extends ComponentProps<"div"> {
  /** Inclinação 3D máxima em graus (0 desliga). */
  tilt?: number;
}

/**
 * Cartão com borda que acende onde o mouse passa e inclinação 3D leve.
 * Usa variáveis CSS (--mx/--my/--rx/--ry) para não re-renderizar o React.
 */
export function SpotCard({ tilt = 0, className, children, ...rest }: SpotCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || event.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    if (tilt) {
      el.style.setProperty("--rx", `${(0.5 - y) * tilt}deg`);
      el.style.setProperty("--ry", `${(x - 0.5) * tilt}deg`);
    }
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("vx3-spot", tilt > 0 && "vx3-tilt", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CountUpProps {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

/** Contador que sobe quando aparece na tela. */
export function CountUp({ to, decimals = 0, prefix = "", suffix = "", duration = 1.8, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView, reduce, to, duration]);

  const formatted = value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span ref={ref} className={cn("vx3-num", className)}>{prefix}{formatted}{suffix}</span>;
}

export interface SectionHeadProps {
  kicker: string;
  title: ReactNode;
  text?: ReactNode;
  className?: string;
}

/** Cabeçalho padrão de seção: rótulo técnico, título e apoio. */
export function SectionHead({ kicker, title, text, className }: SectionHeadProps) {
  return (
    <Reveal className={cn("vx3-head", className)}>
      <span className="vx3-kicker"><i aria-hidden />{kicker}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </Reveal>
  );
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
