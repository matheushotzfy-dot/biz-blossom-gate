import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** Log ilustrativo de eventos da gateway — sem valores financeiros. */
interface FeedEvent { id: number; kind: string; status: string; meta: string; tone: "green" | "blue" }

const SOURCE: readonly Omit<FeedEvent, "id">[] = [
  { kind: "PIX", status: "aprovado", meta: "182ms", tone: "green" },
  { kind: "CARTÃO", status: "antifraude ok", meta: "3DS", tone: "blue" },
  { kind: "SAQUE", status: "liquidado", meta: "instant", tone: "green" },
  { kind: "WEBHOOK", status: "entregue", meta: "200", tone: "blue" },
  { kind: "PIX", status: "aprovado", meta: "214ms", tone: "green" },
  { kind: "CARTÃO", status: "autorizado", meta: "1x", tone: "blue" },
];
const VISIBLE = 3;

export function EventFeed() {
  const reduced = useReducedMotion();
  const [cursor, setCursor] = useState(VISIBLE);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setCursor((c) => c + 1), 2200);
    return () => window.clearInterval(id);
  }, [reduced]);

  const rows: FeedEvent[] = Array.from({ length: VISIBLE }, (_, i) => {
    const n = cursor - i;
    return { id: n, ...SOURCE[n % SOURCE.length] };
  });

  return (
    <div className="auth-aside-panel auth-aside-corners px-4 py-3 font-mono text-[11px]">
      <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.16em] auth-aside-muted">
        <span>stream · eventos</span>
        <span className="auth-aside-border rounded-sm border px-1.5 py-px">demonstração</span>
      </div>
      <ul className="relative space-y-1.5 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((r) => (
            <motion.li
              key={r.id}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <span className={r.tone === "green" ? "auth-aside-green" : "auth-aside-accent"}>›</span>
              <span className="w-[72px] font-semibold">{r.kind}</span>
              <span className="flex-1 auth-aside-muted">{r.status}</span>
              <span className="auth-aside-muted tabular-nums">{r.meta}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
