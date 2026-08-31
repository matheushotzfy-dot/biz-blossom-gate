/**
 * GatewayWindow — réplica fiel da tela real do painel VENXPAY (sidebar,
 * barra de faturamento, KPIs, gráfico e últimas transações), montada em
 * componentes locais e dados sintéticos apenas para a landing.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutGrid,
  Receipt,
  Package,
  Wallet,
  Puzzle,
  Trophy,
  LifeBuoy,
  QrCode,
  CreditCard,
  ArrowUpRight,
} from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { cn } from "@/lib/utils";

const NAV = [
  { icon: LayoutGrid, label: "Dashboard", active: true },
  { icon: Receipt, label: "Vendas" },
  { icon: Package, label: "Produtos" },
  { icon: Wallet, label: "Financeiro" },
  { icon: Puzzle, label: "Integrações" },
  { icon: Trophy, label: "Premiações" },
  { icon: LifeBuoy, label: "Suporte" },
] satisfies { icon: typeof LayoutGrid; label: string; active?: boolean }[];

const NAMES = [
  "Ana Beatriz S.", "Lucas Moreira", "Fernanda Lima", "Ricardo Alves",
  "Juliana Prado", "Diego Ramos", "Marina Castro", "Thiago Nunes",
];
const PRODUCTS = ["Método Escala 10X", "Mentoria Alta Performance", "Comunidade Pro", "Tráfego Direto"];

interface Row {
  id: number;
  name: string;
  product: string;
  value: number;
  pix: boolean;
}

let seq = 0;
function makeRow(): Row {
  seq += 1;
  return {
    id: seq,
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    product: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
    value: Math.round((Math.random() * 780 + 47) * 100) / 100,
    pix: Math.random() > 0.25,
  };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const compact = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

/** Curva de faturamento em SVG — redesenhada suavemente a cada novo ponto. */
function RevenueCurve({ points }: { points: number[] }) {
  const path = useMemo(() => {
    const w = 640;
    const h = 150;
    const max = Math.max(...points, 1);
    const step = w / (points.length - 1);
    const coords = points.map((p, i) => [i * step, h - (p / max) * (h - 18) - 9] as const);
    let d = `M ${coords[0][0]},${coords[0][1]}`;
    for (let i = 1; i < coords.length; i += 1) {
      const [x0, y0] = coords[i - 1];
      const [x1, y1] = coords[i];
      const cx = (x0 + x1) / 2;
      d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return { line: d, area: `${d} L ${w},${h} L 0,${h} Z` };
  }, [points]);

  return (
    <svg viewBox="0 0 640 150" preserveAspectRatio="none" className="h-[150px] w-full" aria-hidden>
      <defs>
        <linearGradient id="vxGwArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((r) => (
        <line
          key={r}
          x1="0"
          x2="640"
          y1={150 * r}
          y2={150 * r}
          stroke="hsl(var(--border))"
          strokeOpacity="0.5"
          strokeDasharray="2 6"
        />
      ))}
      <motion.path d={path.area} fill="url(#vxGwArea)" animate={{ d: path.area }} initial={false}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      <motion.path d={path.line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2.2}
        strokeLinecap="round" animate={{ d: path.line }} initial={false}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
    </svg>
  );
}

export function GatewayWindow({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 5 }, makeRow));
  const [revenue, setRevenue] = useState(184_320.5);
  const [approved, setApproved] = useState(2_418);
  const [points, setPoints] = useState<number[]>(() =>
    Array.from({ length: 24 }, (_, i) => 26 + Math.sin(i / 2.4) * 13 + Math.random() * 20),
  );

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
      setRows((prev) => [row, ...prev].slice(0, 5));
      setRevenue((prev) => prev + row.value);
      setApproved((prev) => prev + 1);
      setPoints((prev) => [
        ...prev.slice(1),
        Math.max(12, prev[prev.length - 1] + (Math.random() - 0.42) * 18),
      ]);
    }, 2800);
    return () => window.clearInterval(tick);
  }, [reduce, visible]);

  const kpis = [
    { label: "Faturamento hoje", value: brl(revenue), sub: "líquido já disponível", up: "+18,4%" },
    { label: "Vendas aprovadas", value: approved.toLocaleString("pt-BR"), sub: "no período", up: "+9,2%" },
    { label: "Ticket médio", value: brl(revenue / Math.max(approved, 1)), sub: "por transação", up: "+3,1%" },
    { label: "Conversão Pix", value: "86%", sub: "checkout → aprovado", up: "+2,6%" },
  ];

  return (
    <div ref={hostRef} className={cn("venx-window", className)}>
      {/* barra do navegador */}
      <div className="flex items-center gap-3 border-b border-border bg-[hsl(176_26%_5%)] px-4 py-2.5">
        <span className="flex gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-muted" />
          <i className="h-2.5 w-2.5 rounded-full bg-muted" />
          <i className="h-2.5 w-2.5 rounded-full bg-muted" />
        </span>
        <span className="num mx-auto rounded-md border border-border px-3 py-1 text-[10.5px] text-muted-foreground">
          app.venxpay.com/dashboard
        </span>
      </div>

      <div className="flex">
        {/* sidebar real */}
        <aside className="hidden w-[188px] shrink-0 flex-col border-r border-border bg-[hsl(176_26%_5%)] py-4 sm:flex">
          <div className="flex items-center gap-2 px-4">
            <VenxpayLogo size={26} plate={false} animated={false} />
            <span className="text-[13.5px] font-extrabold tracking-tight text-foreground">venxpay</span>
          </div>

          {/* barra de faturamento */}
          <div className="mx-3 mt-4 rounded-xl border border-border bg-background px-3 py-2.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              faturamento
            </p>
            <p className="num mt-0.5 text-[14px] font-bold text-foreground">{compact(revenue)}</p>
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted">
              <motion.span
                className="block h-full rounded-full bg-primary"
                animate={{ width: `${Math.min(96, 44 + (revenue % 40_000) / 900)}%` }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
          </div>

          <nav className="mt-4 flex flex-col gap-0.5 px-2">
            {NAV.map(({ icon: Icon, label, active }) => (
              <span
                key={label}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
                {label}
              </span>
            ))}
          </nav>
        </aside>

        {/* conteúdo */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-extrabold text-foreground">Visão geral</p>
              <p className="text-[11px] text-muted-foreground">Atualizando em tempo real</p>
            </div>
            <span className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
              <i className="venx-pulse-dot" />
              <span className="num text-[10px] uppercase tracking-[0.14em] text-muted-foreground">ao vivo</span>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-border bg-card px-3.5 py-3">
                <p className="truncate text-[10.5px] font-medium text-muted-foreground">{k.label}</p>
                <p className="num mt-1.5 truncate text-[17px] font-bold text-foreground">{k.value}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-primary">
                  <ArrowUpRight className="h-3 w-3" /> {k.up}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card pb-2 pt-3.5 lg:col-span-3">
              <div className="flex items-center justify-between px-4">
                <p className="text-[13px] font-bold text-foreground">Faturamento por hora</p>
                <span className="num text-[10px] uppercase tracking-[0.12em] text-muted-foreground">hoje</span>
              </div>
              <div className="mt-1 px-1">
                <RevenueCurve points={points} />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-2">
              <p className="border-b border-border px-4 py-3 text-[13px] font-bold text-foreground">
                Últimas transações
              </p>
              {rows.map((row, i) => (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5 last:border-0",
                    i === 0 && !reduce && "venx-row-in",
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-background text-primary">
                    {row.pix ? <QrCode className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-foreground">{row.name}</p>
                    <p className="truncate text-[10.5px] text-muted-foreground">{row.product}</p>
                  </div>
                  <div className="text-right">
                    <p className="num text-[12px] font-bold text-foreground">{brl(row.value)}</p>
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-primary">aprovado</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
