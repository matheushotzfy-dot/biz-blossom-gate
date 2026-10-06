import { useRef, type PointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroConsole } from "./HeroConsole";
import { SaleToasts } from "./SaleToasts";

const LETTERS = ["V", "E", "N", "X", "P", "A", "Y"] as const;
const EASE = [0.16, 1, 0.3, 1] as const;

export interface HeroProps { onSignup: () => void; }

export function Hero({ onSignup }: HeroProps) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const tiltX = useTransform(scrollYProgress, [0, 0.6], [22, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const fade = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-1, 1], [-7, 7]), { stiffness: 120, damping: 18 });
  const rotX = useSpring(useTransform(my, [-1, 1], [5, -5]), { stiffness: 120, damping: 18 });

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || reduce) return;
    mx.set((e.clientX / window.innerWidth) * 2 - 1);
    my.set((e.clientY / window.innerHeight) * 2 - 1);
  };

  const enter = (delay: number) => (reduce ? {} : {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: EASE },
  });

  return (
    <section ref={sectionRef} className="vx3-hero" onPointerMove={onMove}>
      <motion.div className="vx3-shell vx3-hero-copy" style={reduce ? undefined : { opacity: fade }}>
        <motion.span className="vx3-badge" {...enter(0.05)}>
          <Zap aria-hidden /> Gateway de pagamentos · PIX e cartão
        </motion.span>

        <div className="vx3-wordmark" aria-hidden>
          {LETTERS.map((letter, i) => (
            <span key={letter} className="vx3-letter-clip">
              <motion.span
                className="vx3-letter"
                initial={reduce ? false : { y: "110%", rotateX: -80 }}
                animate={{ y: "0%", rotateX: 0 }}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.07, ease: EASE }}
              >
                {letter}
              </motion.span>
            </span>
          ))}
        </div>

        <motion.h1 {...enter(0.55)}>
          <span className="sr-only">VENXPAY — </span>
          Aprovação acima de <em>75%</em> em PIX e cartão.
        </motion.h1>
        <motion.p className="vx3-hero-sub" {...enter(0.7)}>
          Adquirências nominais 100% exclusivas, saque instantâneo e checkout que converte.
          <b> Aqui você multiplica seus resultados.</b>
        </motion.p>

        <motion.div className="vx3-hero-cta" {...enter(0.85)}>
          <Button size="lg" onClick={onSignup} className="vx3-btn-glow">
            Começar agora <ArrowUpRight />
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#velocidade">Ver como funciona <ArrowRight /></a>
          </Button>
        </motion.div>
      </motion.div>

      <motion.div className="vx3-stage" style={reduce ? undefined : { y: lift }}>
        <motion.div
          className="vx3-stage-tilt"
          style={reduce ? undefined : { rotateX: tiltX }}
          initial={reduce ? false : { opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.9, ease: EASE }}
        >
          <motion.div style={reduce ? undefined : { rotateX: rotX, rotateY: rotY }} className="vx3-stage-inner">
            <HeroConsole />
            <SaleToasts className="vx3-hero-toasts" />
            <span className="vx3-chip vx3-chip-a"><i />PIX aprovado em segundos</span>
            <span className="vx3-chip vx3-chip-b"><i />Saque instantâneo enviado</span>
            <span className="vx3-chip vx3-chip-c"><i />Cartão · aprovação 75%+</span>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
