/**
 * ProductMock — réplica fiel (estática) do dashboard HOTZFY para a landing page.
 * Renderizada dentro de um frame de navegador, com cartões flutuantes de
 * notificação. É puramente apresentacional: nenhum dado real é consultado.
 */
import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard, ShoppingBag, Package, Users, Wallet, LineChart,
  Settings, Search, Bell, ArrowUpRight, CheckCircle2, QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: ShoppingBag, label: "Vendas" },
  { icon: Package, label: "Produtos" },
  { icon: Users, label: "Afiliados" },
  { icon: Wallet, label: "Financeiro" },
  { icon: LineChart, label: "Relatórios" },
  { icon: Settings, label: "Configurações" },
];

const KPIS = [
  { label: "Faturamento hoje", value: "R$ 48.290,00", delta: "+18,4%" },
  { label: "Vendas aprovadas", value: "312", delta: "+9,1%" },
  { label: "Ticket médio", value: "R$ 154,77", delta: "+3,6%" },
  { label: "Aprovação PIX", value: "98,7%", delta: "+0,4%" },
];

const ROWS = [
  { name: "Ana Carolina", product: "Pack Criativos Pro", value: "R$ 1.469,42" },
  { name: "Diego Fontes", product: "Mentoria Black", value: "R$ 854,40" },
  { name: "Heitor Prado", product: "Comunidade VIP", value: "R$ 1.820,52" },
  { name: "Eduarda Lima", product: "Trilha Copy 360", value: "R$ 1.735,00" },
];

/** Curva do gráfico — pontos fixos para manter render determinístico. */
const POINTS = [8, 26, 18, 40, 33, 52, 46, 68, 60, 82, 74, 96];

function buildPath(values: number[], width: number, height: number) {
  const max = Math.max(...values) * 1.18;
  const step = width / (values.length - 1);
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(height - (v / max) * height).toFixed(1)}`)
    .join(" ");
}

const CHART_W = 520;
const CHART_H = 118;
const LINE = buildPath(POINTS, CHART_W, CHART_H);
const AREA = `${LINE} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`;

function FloatCard({
  className, delay, icon: Icon, title, subtitle, value,
}: {
  className?: string;
  delay: number;
  icon: typeof CheckCircle2;
  title: string;
  subtitle: string;
  value?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn("absolute hidden lg:block", className)}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -9, 0] }}
        transition={{ duration: 6 + delay * 2, repeat: Infinity, ease: "easeInOut" }}
        className="tech-panel flex items-center gap-3 rounded-2xl px-4 py-3"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/12 text-emerald-300">
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <span className="min-w-0">
          <span className="block text-[12.5px] font-semibold leading-tight text-foreground">{title}</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">{subtitle}</span>
        </span>
        {value && (
          <span className="tech-mono ml-2 whitespace-nowrap text-[12.5px] font-bold text-emerald-300">{value}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

export const ProductMock = memo(function ProductMock() {
  return (
    <div className="relative mx-auto w-full max-w-[1100px] text-left">
      {/* halo sob o mockup */}
      <div aria-hidden className="tech-aurora pointer-events-none absolute -inset-x-16 -top-10 bottom-0 -z-10 rounded-[48px]" />

      {/* frame do navegador */}
      <div className="tech-panel tech-ring relative overflow-hidden rounded-[20px] p-0">
        {/* barra do navegador */}
        <div className="flex items-center gap-3 border-b border-foreground/10 bg-foreground/[0.03] px-4 py-3">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          </span>
          <span className="mx-auto flex items-center gap-2 rounded-lg border border-foreground/10 bg-background/50 px-3 py-1 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            app.hotzfy.com.br/dashboard
          </span>
        </div>

        {/* app */}
        <div className="flex bg-background/70">
          {/* sidebar */}
          <aside className="hidden w-[190px] shrink-0 flex-col gap-1 border-r border-foreground/10 p-3 sm:flex">
            <div className="mb-3 flex items-center gap-2 px-2 py-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-400/15 text-[11px] font-black text-emerald-300">H</span>
              <span className="text-[12.5px] font-bold tracking-tight text-foreground">HOTZFY</span>
            </div>
            {NAV.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px]",
                  active
                    ? "bg-emerald-400/10 font-semibold text-emerald-300"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                {label}
              </div>
            ))}
          </aside>

          {/* conteúdo */}
          <div className="min-w-0 flex-1 p-4 sm:p-5">
            {/* topbar */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 flex-1 items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.03] px-2.5 text-[11.5px] text-muted-foreground">
                <Search className="h-3.5 w-3.5" /> Buscar em tudo…
              </div>
              <div className="flex h-8 items-center gap-2 rounded-lg border border-foreground/10 px-2.5">
                <Wallet className="h-3.5 w-3.5 text-emerald-300" />
                <span className="tech-mono text-[11.5px] font-bold text-foreground">R$ 179.713,35</span>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/10 text-muted-foreground">
                <Bell className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* kpis */}
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {KPIS.map((k) => (
                <div key={k.label} className="rounded-xl border border-foreground/10 bg-foreground/[0.025] p-3">
                  <p className="text-[10.5px] text-muted-foreground">{k.label}</p>
                  <p className="tech-mono mt-1.5 text-[15px] font-bold tracking-tight text-foreground">{k.value}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                    <ArrowUpRight className="h-3 w-3" /> {k.delta}
                  </p>
                </div>
              ))}
            </div>

            {/* gráfico */}
            <div className="mt-3 rounded-xl border border-foreground/10 bg-foreground/[0.025] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11.5px] font-semibold text-foreground">Receita · últimos 12 dias</p>
                <span className="rounded-md border border-foreground/10 px-2 py-0.5 text-[10px] text-muted-foreground">Hoje</span>
              </div>
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-[112px] w-full" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="mockArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160 84% 45%)" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="hsl(160 84% 45%)" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="mockLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(160 84% 50%)" />
                    <stop offset="100%" stopColor="hsl(189 94% 58%)" />
                  </linearGradient>
                </defs>
                <path d={AREA} fill="url(#mockArea)" />
                <path d={LINE} fill="none" stroke="url(#mockLine)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* tabela */}
            <div className="mt-3 rounded-xl border border-foreground/10 bg-foreground/[0.025]">
              <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-2">
                <p className="text-[11.5px] font-semibold text-foreground">Últimas transações</p>
                <span className="text-[10.5px] text-emerald-300">Ver todas</span>
              </div>
              {ROWS.map((r) => (
                <div key={r.name} className="flex items-center gap-3 border-b border-foreground/[0.06] px-3 py-2 last:border-0">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
                    <QrCode className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-medium text-foreground">{r.name}</span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">{r.product}</span>
                  </span>
                  <span className="rounded-md bg-emerald-400/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-emerald-300">Pago</span>
                  <span className="tech-mono w-[92px] text-right text-[11.5px] font-bold text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* cartões flutuantes */}
      <FloatCard
        className="-left-6 top-[38%] xl:-left-24"
        delay={0.15}
        icon={CheckCircle2}
        title="Venda aprovada"
        subtitle="PIX confirmado em 412 ms"
        value="+ R$ 1.469"
      />
      <FloatCard
        className="-right-6 top-[18%] xl:-right-24"
        delay={0.3}
        icon={Wallet}
        title="Saque liquidado"
        subtitle="PIX D+0 · conta principal"
        value="R$ 12.000"
      />
      <FloatCard
        className="-left-4 bottom-10 xl:-left-20"
        delay={0.45}
        icon={ArrowUpRight}
        title="Conversão do checkout"
        subtitle="Últimas 24 horas"
        value="+21,3%"
      />
    </div>
  );
});

export default ProductMock;
