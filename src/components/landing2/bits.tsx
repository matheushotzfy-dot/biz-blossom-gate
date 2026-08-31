/**
 * Primitivos da landing v2 — puramente apresentacionais.
 */
import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export function Rise({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Título revelado linha a linha por máscara. */
export function CutLines({
  lines,
  as = "h1",
  className,
  delay = 0,
}: {
  lines: ReactNode[];
  as?: "h1" | "h2";
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });
  const reduce = useReducedMotion();
  const Tag = as;

  return (
    <div ref={ref}>
      <Tag className={className}>
        {lines.map((line, i) => (
          <span key={i} className="vx-line-clip">
            <motion.span
              className="block"
              initial={reduce ? false : { y: "115%" }}
              animate={inView ? { y: "0%" } : undefined}
              transition={{ duration: 0.9, delay: delay + i * 0.09, ease: EASE }}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </Tag>
    </div>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("vx-mono vx-mono-on", className)}>{children}</span>;
}
