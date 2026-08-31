/**
 * LiveConsole — recriação fiel do painel VENXPAY em movimento contínuo.
 * Os dados são gerados localmente apenas para demonstração visual: nenhuma
 * consulta é feita a partir da landing.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, QrCode, CreditCard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const NAMES = [
  "Ana Beatriz", "Lucas Moreira", "Fernanda Lima", "Ricardo Alves", "Juliana Prado",
  "Diego Ramos", "Marina Castro", "Thiago Nunes", "Carla Menezes", "Pedro Vasques",
];
const PRODUCTS = ["Método Escala 10X", "Mentoria Alta Performance", "Comunidade Pro", "Tráfego Direto", "Copy Cirúrgica"];
const METHODS = [
  { icon: QrCode, label: "Pix" },
  { icon: CreditCard, label: "Cartão" },
  { icon: Wallet, label: "Carteira" },
] as const;

interface Row {
  id: number;
  name: string;
  product: string;
  value: number;
  method: number;
}

let seq = 0;
function makeRow(): Row {
  seq += 1;
  return {
    id: seq,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    product: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
    value: Math.round((Math.random() * 780 + 47) * 100) / 100,
    method: Math.floor(Math.random() * METHODS.length),
  };
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Curva de faturamento desenhada com SVG, redesenhada a cada novo ponto. */
function Curve({ points }: { points: number[] }) {
  const path = useMemo(() => {
    const w = 560;
    const h = 130;
    const max = Math.max(...points, 1);
    const step = w / (points.length - 1);
    const coords = points.map((p, i) => [i * step, h - (p / max) * (h - 14) - 7] as const);
    // suavização por curvas de Bézier entre pontos
    let d = `M ${coords[0][0]},${coords[0][1]}`;
    for (let i = 1; i < coords.length; i++) {
      const [x0, y0] = coords[i - 1];
      const [x1, y1] = coords[i];
      const cx = (x0 + x1) / 2;
      d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return { line: d, area: `${d} L ${w},${h} L 0,${h} Z` };
  }, [points]);

  return (
    <svg viewBox="0 0 560 130" preserveAspectRatio="none" className="h-[130px] w-full">
      <defs>
        <linearGradient id="venxCurve" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.34" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={path.area}
        fill="url(#venxCurve)"
        initial={false}
        animate={{ d: path.area }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.path
        d={path.line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinecap="round"
        initial={false}
        animate={{ d: path.line }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

export function LiveConsole({ className, compact = false }: { className?: string; compact?: boolean }) {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 5 }, makeRow));
  const [total, setTotal] = useState(184_320.5);
  const [points, setPoints] = useState<number[]>(() =>
    Array.from({ length: 16 }, (_, i) => 30 + Math.sin(i / 2) * 14 + Math.random() * 22),
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || !visible) return;
    const tick = window.setInterval(() => {
      const row = makeRow();
      setRows((prev) => [row, ...prev].slice(0, compact ? 4 : 6));
      setTotal((prev) => prev + row.value);
      setPoints((prev) => [...prev.slice(1), Math.max(12, prev[prev.length - 1] + (Math.random() - 0.42) * 20)]);
    }, 2600);
    return () => window.clearInterval(tick);
  }, [reduce, visible, compact]);

  return (
    <div ref={hostRef} className={cn("venx-glass overflow-hidden", className)}>
      {/* cabeçalho */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="venx-pulse-dot" />
          <span className="num text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            painel · tempo real
          </span>
        </div>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted" />
          <span className="h-2 w-2 rounded-full bg-muted" />
          <span className="h-2 w-2 rounded-full bg-primary/60" />
        </div>
      </div>

      {/* faturamento */}
      <div className="px-5 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Faturamento hoje
        </p>
        <div className="mt-1.5 flex items-end gap-3">
          <motion.span
            key={Math.round(total)}
            initial={reduce ? false : { opacity: 0.4, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="num text-[30px] font-bold leading-none text-foreground sm:text-[38px]"
          >
            {brl(total)}
          </motion.span>
          <span className="mb-1 flex items-center gap-1 text-[12px] font-bold text-primary">
            <ArrowUpRight className="h-3.5 w-3.5" /> ao vivo
          </span>
        </div>
      </div>

      <div className="mt-2 px-1">
        <Curve points={points} />
      </div>

      {/* transações */}
      <div className="border-t border-border">
        {rows.map((row, i) => {
          const Method = METHODS[row.method].icon;
          return (
            <div
              key={row.id}
              className={cn(
                "flex items-center gap-3 border-b border-border/60 px-5 py-3 last:border-0",
                i === 0 && !reduce && "venx-row-in",
              )}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-background text-primary">
                <Method className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-foreground">{row.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{row.product}</p>
              </div>
              <div className="text-right">
                <p className="num text-[13px] font-bold text-foreground">{brl(row.value)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">aprovado</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
