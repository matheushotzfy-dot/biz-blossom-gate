/**
 * PhoneApprovals — réplica de um iPhone com a tela bloqueada recebendo
 * notificações de venda aprovada da VENXPAY.
 *
 * 100% apresentacional: os valores são gerados localmente apenas para a
 * demonstração da landing. Nenhuma consulta é feita a partir daqui.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { cn } from "@/lib/utils";

interface Alert {
  id: number;
  value: number;
  product: string;
  method: "Pix" | "Cartão";
  at: Date;
}

const PRODUCTS = [
  "Método Escala 10X",
  "Mentoria Alta Performance",
  "Comunidade Pro",
  "Tráfego Direto",
  "Copy Cirúrgica",
  "Imersão Presencial",
];

let seq = 0;
function makeAlert(): Alert {
  seq += 1;
  return {
    id: seq,
    value: Math.round((Math.random() * 940 + 47) * 100) / 100,
    product: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
    method: Math.random() > 0.28 ? "Pix" : "Cartão",
    at: new Date(),
  };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hhmm = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function PhoneApprovals({
  className,
  interval = 3200,
}: {
  className?: string;
  /** intervalo entre notificações, em ms */
  interval?: number;
}) {
  const reduce = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>(() => [makeAlert(), makeAlert(), makeAlert()]);
  const [clock, setClock] = useState(() => new Date());

  // só anima quando o aparelho está na viewport — poupa CPU e mantém 60fps
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || !visible) return;
    const tick = window.setInterval(() => {
      setAlerts((prev) => [makeAlert(), ...prev].slice(0, 4));
      setClock(new Date());
    }, interval);
    return () => window.clearInterval(tick);
  }, [reduce, visible, interval]);

  const dateLabel = useMemo(
    () =>
      clock
        .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
        .replace(/^\w/, (c) => c.toUpperCase()),
    [clock],
  );

  return (
    <div ref={hostRef} className={cn("venx-phone", className)}>
      <div className="venx-phone-screen">
        {/* dynamic island */}
        <span className="venx-phone-island" aria-hidden />

        {/* relógio da tela bloqueada */}
        <div className="px-6 pt-14 text-center">
          <p className="text-[12px] font-semibold text-white/70">{dateLabel}</p>
          <p className="num mt-0.5 text-[58px] font-semibold leading-none tracking-tight text-white">
            {hhmm(clock)}
          </p>
        </div>

        {/* pilha de notificações */}
        <div className="mt-7 flex flex-col gap-2 px-3.5 pb-6">
          <AnimatePresence initial={false}>
            {alerts.map((alert, index) => (
              <motion.article
                key={alert.id}
                layout
                initial={reduce ? false : { opacity: 0, y: -18, scale: 0.94 }}
                animate={{
                  opacity: index === 3 ? 0.35 : 1 - index * 0.14,
                  y: 0,
                  scale: 1 - index * 0.018,
                }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
                transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.7 }}
                className="venx-notif"
              >
                <span className="venx-notif-icon">
                  <VenxpayLogo size={26} plate={false} animated={false} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-white/60">
                      venxpay
                    </p>
                    <span className="num text-[10.5px] text-white/45">agora</span>
                  </div>
                  <p className="mt-0.5 text-[14.5px] font-bold leading-tight text-white">
                    Venda aprovada · {brl(alert.value)}
                  </p>
                  <p className="truncate text-[12.5px] leading-snug text-white/65">
                    {alert.product} · {alert.method}
                  </p>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>

        <div className="venx-phone-bar" aria-hidden />
      </div>
    </div>
  );
}
