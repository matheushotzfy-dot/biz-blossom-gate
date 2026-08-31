/**
 * Primitivos compartilhados das cenas da landing.
 * Puramente apresentacional — nenhum acesso a dados.
 */
import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Reveal({
  children,
  className,
  delay = 0,
  y = 26,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Título revelado linha a linha por máscara. */
export function MaskLines({
  lines,
  className,
  delay = 0,
}: {
  lines: ReactNode[];
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <h1 className={className}>
      {lines.map((line, i) => (
        <span key={i} className="venx-line">
          <motion.span
            className="block"
            initial={reduce ? false : { y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.95, delay: delay + i * 0.11, ease: EASE }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

export function SectionHead({
  kicker,
  title,
  copy,
  center,
  className,
}: {
  kicker: string;
  title: ReactNode;
  copy?: string;
  center?: boolean;
  className?: string;
}) {
  return (
    <Reveal className={cn(center && "text-center", className)}>
      <span className="venx-kicker">{kicker}</span>
      <h2
        className={cn(
          "mt-5 text-[32px] font-extrabold text-foreground sm:text-[46px] lg:text-[54px]",
          center && "mx-auto max-w-4xl",
        )}
      >
        {title}
      </h2>
      {copy && (
        <p
          className={cn(
            "mt-5 max-w-2xl text-[15.5px] leading-[1.75] text-muted-foreground",
            center && "mx-auto",
          )}
        >
          {copy}
        </p>
      )}
    </Reveal>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="venx-mark">V</span>
      <span className="font-heading text-[16px] font-extrabold tracking-tight text-foreground">
        venxpay
      </span>
    </span>
  );
}
