/** Cartão de crédito 3D que segue o mouse e QR PIX com varredura animada. */
import { useRef, type PointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Reveal, SectionHead, SpotCard } from "./bits";

// Matriz pseudo-aleatória determinística para o QR ilustrativo (21x21).
const QR = Array.from({ length: 21 * 21 }, (_, i) => {
  const x = i % 21, y = Math.floor(i / 21);
  const finder = (a: number, b: number) => x >= a && x < a + 7 && y >= b && y < b + 7;
  if (finder(0, 0) || finder(14, 0) || finder(0, 14)) {
    const lx = x % 14 === x ? x : x - 14, ly = y % 14 === y ? y : y - 14;
    const ring = lx === 0 || lx === 6 || ly === 0 || ly === 6;
    const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
    return ring || core;
  }
  return ((x * 7 + y * 13 + x * y * 3) % 5) < 2;
});

const CHIPS = ["Parcelamento em até 12x", "Aprovação 75%+", "PIX confirmado em segundos", "Checkout em 1 página"];

export function CardPix() {
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const ry = useSpring(useTransform(mx, [0, 1], [-22, 22]), { stiffness: 150, damping: 16 });
  const rx = useSpring(useTransform(my, [0, 1], [16, -16]), { stiffness: 150, damping: 16 });
  const shine = useTransform([mx, my], ([x, y]: number[]) =>
    `radial-gradient(circle at ${x * 100}% ${y * 100}%, hsl(var(--foreground) / .28), transparent 55%)`);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el || reduce || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => { mx.set(0.5); my.set(0.5); };

  return (
    <section id="checkout" className="vx3-section">
      <div className="vx3-shell">
        <SectionHead
          kicker="04 · Cartão e PIX"
          title={<>Dois métodos. <em>Uma aprovação</em> que não te deixa na mão.</>}
          text="Cartão com parcelamento e PIX instantâneo no mesmo checkout, com validação completa dos dados do comprador."
        />
        <div className="vx3-pay">
          <Reveal>
            <div ref={cardRef} className="vx3-card-zone" onPointerMove={onMove} onPointerLeave={onLeave}>
              <motion.div className="vx3-cc" style={reduce ? undefined : { rotateX: rx, rotateY: ry }}>
                <motion.span className="vx3-cc-shine" style={reduce ? undefined : { background: shine }} aria-hidden />
                <div className="flex items-start justify-between">
                  <span className="vx3-cc-chip" aria-hidden />
                  <span className="vx3-cc-brand">VENXPAY</span>
                </div>
                <span className="vx3-cc-number vx3-num">4970 •••• •••• 2026</span>
                <div className="flex items-end justify-between">
                  <span><small>Titular</small>CLIENTE APROVADO</span>
                  <span><small>Validade</small>12/31</span>
                </div>
              </motion.div>
              <span className="vx3-mono vx3-card-hint">Passe o mouse no cartão</span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <SpotCard className="vx3-panel vx3-pix">
              <div className="vx3-qr" aria-hidden>
                {QR.map((on, i) => <i key={`q${i}`} className={on ? "on" : undefined} />)}
                <span className="vx3-qr-scan" />
              </div>
              <div>
                <span className="vx3-mono">PIX · copia e cola</span>
                <strong className="vx3-pix-status"><i />Pagamento confirmado</strong>
                <p>O cliente escaneia, paga e a venda é aprovada em segundos.</p>
              </div>
            </SpotCard>
          </Reveal>
        </div>
        <ul className="vx3-chips-row">
          {CHIPS.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </div>
    </section>
  );
}
