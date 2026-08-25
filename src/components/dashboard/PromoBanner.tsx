import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

/**
 * Editorial brand banner for the seller dashboard.
 * 100% code-drawn (SVG + CSS) — no stock imagery, no third-party assets.
 * Left: engraved editorial headline. Right: an original "liquidity engine" plate.
 */

const CHIPS = [
  { label: "PIX D+0" },
  { label: "Sem reserva" },
  { label: "Taxa a partir de 2,99%" },
  { label: "Saque 24/7" },
];

function LiquidityPlate() {
  return (
    <svg viewBox="0 0 420 260" className="h-full w-full" role="img" aria-label="Ilustração do motor de liquidez Venxpay">
      <defs>
        <linearGradient id="pb-arc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="pb-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="pb-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
          <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* engraved guilloché rings */}
      <g transform="translate(230 130)">
        <circle r="118" fill="url(#pb-core)" />
        {[118, 100, 82, 64, 46].map((r, i) => (
          <circle
            key={r}
            r={r}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeOpacity={0.1 + i * 0.05}
            strokeWidth={i === 0 ? 1 : 0.65}
            strokeDasharray={i % 2 ? "2 6" : undefined}
          />
        ))}

        {/* radial tick ruler */}
        {Array.from({ length: 72 }).map((_, i) => {
          const a = (i / 72) * Math.PI * 2;
          const long = i % 6 === 0;
          const r1 = 118;
          const r2 = 118 + (long ? 9 : 4);
          return (
            <line
              key={i}
              x1={Math.cos(a) * r1}
              y1={Math.sin(a) * r1}
              x2={Math.cos(a) * r2}
              y2={Math.sin(a) * r2}
              stroke="hsl(var(--foreground))"
              strokeOpacity={long ? 0.28 : 0.12}
              strokeWidth={long ? 1.1 : 0.7}
            />
          );
        })}

        {/* settlement arc — sweeps continuously */}
        <g className="pb-spin">
          <path d="M 0 -100 A 100 100 0 0 1 86.6 50" fill="none" stroke="url(#pb-arc)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="0" cy="-100" r="3.5" fill="hsl(var(--primary))" />
        </g>
        <g className="pb-spin-rev">
          <path d="M 0 64 A 64 64 0 0 1 -55.4 -32" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.5" strokeWidth="1.4" strokeLinecap="round" />
        </g>

        {/* core monogram — angular H cut */}
        <g>
          <rect x="-30" y="-34" width="60" height="68" rx="16" fill="hsl(var(--background))" stroke="hsl(var(--primary)/0.35)" />
          <path d="M -15 -19 L 0 19 L 15 -19" stroke="hsl(var(--primary))" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </g>
      </g>

      {/* liquidity rails travelling into the core */}
      {[54, 96, 168, 210].map((y, i) => (
        <g key={y}>
          <path d={`M 8 ${y} H 128 Q 152 ${y} 160 ${130 + (y - 130) * 0.35}`} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
          <circle r="2.6" fill="hsl(var(--primary))" className="pb-flow" style={{ animationDelay: `${i * 0.7}s`, offsetPath: `path("M 8 ${y} H 128 Q 152 ${y} 160 ${130 + (y - 130) * 0.35}")` } as React.CSSProperties} />
        </g>
      ))}

      {/* baseline scale */}
      <line x1="8" y1="244" x2="412" y2="244" stroke="url(#pb-fade)" strokeWidth="1" />
    </svg>
  );
}

export function PromoBanner() {
  return (
    <section className="relative isolate overflow-hidden rounded-[12px] border border-border/60 bg-[hsl(var(--card))] md:rounded-[28px]">
      {/* engraved paper texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
 "repeating-linear-gradient(115deg, hsl(var(--foreground)/0.028) 0 1px, transparent 1px 9px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
 "radial-gradient(70% 130% at 78% 45%, hsl(var(--primary)/0.16), transparent 62%), radial-gradient(50% 90% at 0% 0%, hsl(var(--primary)/0.07), transparent 60%)",
        }}
      />
      {/* oversized monogram slab bleeding off the left edge */}
      <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -left-16 -top-10 h-[130%] w-auto opacity-[0.06]">
        <path d="M38 14 L100 188 L162 14" stroke="hsl(var(--primary))" strokeWidth="26" strokeLinecap="round" fill="none" />
      </svg>
      {/* hairline frame */}
      <div aria-hidden className="pointer-events-none absolute inset-3 rounded-[20px] border border-primary/10 md:inset-4" />

      <div className="relative grid gap-4 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-center md:gap-4 md:p-6 lg:p-7">
        {/* ── Editorial copy ── */}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="h-px w-6 bg-primary/60" />
            <span className="text-[11px] font-medium tracking-[0.02em] text-primary">Infraestrutura Venxpay</span>
          </div>

          <h2 className="mt-2.5 max-w-[16ch] font-display text-[22px] font-extrabold leading-[0.95] tracking-[-0.04em] text-foreground sm:text-[26px] lg:text-[30px]">
            Taxas baixas e
            <span className="block font-serif text-[24px] font-normal italic tracking-[-0.02em] text-primary sm:text-[29px] lg:text-[34px]">
              saques instantâneos
            </span>
          </h2>

          <p className="mt-2 max-w-sm text-[12.5px] font-medium leading-snug text-muted-foreground">
            que movem o seu negócio de verdade. Liquidação Pix no mesmo dia, sem reserva financeira e sem burocracia.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {CHIPS.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground"
              >
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-primary" aria-hidden>
                  <circle cx="6" cy="6" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M3.6 6.2 L5.2 7.8 L8.4 4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {c.label}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              to="/financeiro/saques"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sacar agora
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group- group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/taxas"
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 px-4 py-2.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              Ver minhas taxas
            </Link>
          </div>
        </div>

        {/* ── Plate ── */}
        <div className="relative hidden h-[176px] sm:block md:h-[196px]">
          <LiquidityPlate />

          {/* floating engraved readouts */}
          <div className="absolute left-1 top-1 rounded-lg border border-border/70 bg-background/85 px-2.5 py-1.5">
            <p className="text-[10px] font-medium text-muted-foreground/70">Liquidação</p>
            <p className="font-display text-[13px] font-bold tabular-nums leading-none text-foreground">D+0</p>
          </div>
          <div className="absolute bottom-2 left-1 rounded-lg border border-border/70 bg-background/85 px-2.5 py-1.5">
            <p className="text-[10px] font-medium text-muted-foreground/70">Reserva</p>
            <p className="font-display text-[13px] font-bold tabular-nums leading-none text-primary">0%</p>
          </div>
          <div className="absolute right-1 top-3 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5">
            <p className="text-[10px] font-medium text-primary/80">Autorização</p>
            <p className="font-display text-[13px] font-bold tabular-nums leading-none text-foreground">118ms</p>
          </div>
        </div>
      </div>

    </section>
  );
}

export default PromoBanner;
