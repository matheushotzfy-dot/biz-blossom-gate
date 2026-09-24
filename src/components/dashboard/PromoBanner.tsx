import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

/**
 * Brand banner — "Tech architectural" direction.
 * Left: message + actions. Right: technical panel with settlement
 * readouts and the monolithic VENXPAY monogram. 100% code-drawn.
 */

const CHIPS = [
  { label: "PIX D+0" },
  { label: "Sem reserva" },
  { label: "Saque 24/7" },
];

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-primary transition-colors hover:border-primary/50 hover:bg-primary/15">
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
        <circle cx="6" cy="6" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M3.6 6.2 L5.2 7.8 L8.4 4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}

/** Monolithic logomark with orbiting settlement arc */
function MonolithV() {
  return (
    <div className="relative h-[118px] w-[118px] shrink-0 sm:h-[132px] sm:w-[132px]">
      {/* orbit rings */}
      <div aria-hidden className="absolute -inset-3 rounded-full border border-primary/15" />
      <div aria-hidden className="absolute -inset-6 rounded-full border border-primary/[0.07]" />
      {/* rotating settlement arc */}
      <svg aria-hidden viewBox="0 0 132 132" className="pb-spin absolute -inset-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)]">
        <path d="M 66 12 A 54 54 0 0 1 112.8 81" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="66" cy="12" r="3" fill="hsl(var(--primary))" />
      </svg>
      {/* plate */}
      <div className="absolute inset-0 flex items-center justify-center rounded-[24px] border border-primary/25 bg-background shadow-[0_0_44px_-10px_hsl(var(--primary)/0.45)]">
        <svg viewBox="0 0 64 64" className="h-[58%] w-[58%]" role="img" aria-label="Logomarca Venxpay">
          <path d="M17 17 L32 48" stroke="hsl(var(--foreground))" strokeOpacity="0.92" strokeWidth="7" strokeLinecap="round" />
          <path d="M47 17 L32 48" stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round" />
          <path d="M24.5 30 H39.5" stroke="hsl(var(--background))" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M25.5 30 H38.5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
          <circle cx="32" cy="48" r="3.2" fill="hsl(var(--primary))" />
        </svg>
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  unit,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "default" | "primary";
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="h-[7px] w-px bg-primary/70" />
        <span className="h-px w-8 bg-gradient-to-r from-primary/70 to-transparent" />
      </div>
      <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
      <p className="mt-1 flex items-center gap-2">
        <span
          className={
            tone === "primary"
              ? "font-display text-[30px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-primary sm:text-[34px]"
              : "font-display text-[30px] font-extrabold leading-none tracking-[-0.04em] tabular-nums text-foreground sm:text-[34px]"
          }
        >
          {value}
        </span>
        {unit && <span className="font-display text-sm font-bold leading-none text-muted-foreground/70">{unit}</span>}
      </p>
    </div>
  );
}

export function PromoBanner({ periodControl }: { periodControl?: React.ReactNode }) {
  return (
    <section className="group relative isolate overflow-hidden rounded-[16px] border border-border/70 bg-card transition-colors duration-300 hover:border-primary/25 md:rounded-[22px]">
      {/* technical dot grid, fading toward the copy */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--primary)/0.4) 0.5px, transparent 0.5px)",
          backgroundSize: "22px 22px",
          maskImage: "linear-gradient(to left, black 12%, transparent 62%)",
          WebkitMaskImage: "linear-gradient(to left, black 12%, transparent 62%)",
        }}
      />
      {/* corner glow */}
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-primary/15 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-l from-primary/[0.07] via-transparent to-transparent" />
      {/* hairline frame */}
      <div aria-hidden className="pointer-events-none absolute inset-2.5 rounded-[12px] border border-primary/10 md:inset-3 md:rounded-[16px]" />

      {periodControl && (
        <div className="absolute right-4 top-4 z-20 md:right-5 md:top-5">{periodControl}</div>
      )}

      <div className="relative grid gap-5 p-5 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-6 md:p-6 lg:p-7">
        {/* ── Copy + actions ── */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {CHIPS.map((c) => (
              <Chip key={c.label} label={c.label} />
            ))}
          </div>

          <h2 className="mt-4 max-w-[18ch] font-display text-[24px] font-extrabold leading-[1.02] tracking-[-0.035em] text-foreground sm:text-[28px] lg:text-[32px]">
            Taxas baixas e
            <span className="block text-primary">saques instantâneos</span>
          </h2>

          <p className="mt-2.5 max-w-md text-[12.5px] font-medium leading-relaxed text-muted-foreground">
            A infraestrutura que move o seu negócio de verdade. Liquidação Pix no mesmo dia, sem reserva financeira e sem burocracia.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link
              to="/financeiro/saques"
              className="group inline-flex items-center gap-2 rounded-[12px] bg-primary px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-primary-foreground shadow-[0_8px_28px_-10px_hsl(var(--primary)/0.65)] transition-all duration-300 hover:-translate-y-px hover:shadow-[0_12px_32px_-10px_hsl(var(--primary)/0.8)] active:translate-y-0 active:scale-[0.98]"
            >
              Sacar agora
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              to="/financeiro/taxas"
              className="inline-flex items-center rounded-[12px] border border-border/80 bg-background/40 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-foreground/90 transition-colors duration-300 hover:border-primary/40 hover:text-primary"
            >
              Ver minhas taxas
            </Link>
          </div>
        </div>

        {/* ── Technical panel ── */}
        <div className="relative flex items-end justify-between gap-4 rounded-[14px] border border-border/50 bg-primary/[0.04] p-4 sm:border-l-0 sm:rounded-[0_16px_16px_0] md:p-5 lg:p-6">
          <div className="space-y-5 sm:space-y-6">
            <Readout label="Liquidação" value="D+0" />
            <Readout label="Reserva" value="0" unit="%" tone="primary" />
          </div>

          <div className="hidden sm:block">
            <MonolithV />
          </div>

          {/* status line */}
          <p className="absolute bottom-3 right-4 hidden items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60 sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Tempo real
          </p>
        </div>
      </div>
    </section>
  );
}

export default PromoBanner;
