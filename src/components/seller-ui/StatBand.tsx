import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatCell {
  label: string;
  value: ReactNode;
  /** Linha de apoio abaixo do número. */
  sub?: ReactNode;
  /** Destaca o número no verde da marca (a métrica principal da tela). */
  featured?: boolean;
  /** Barra fina de 0 a 100, para taxas. */
  meter?: number;
  loading?: boolean;
}

/** Faixa única de indicadores: um painel dividido em células, no lugar de quatro cartões iguais. */
export function StatBand({ cells, label }: { cells: StatCell[]; label: string }) {
  const odd = cells.length % 2 === 1;
  return (
    <section className="vp-sheet overflow-hidden" aria-label={label}>
      <dl className={cn("grid grid-cols-2 gap-px bg-border", cells.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
        {cells.map((c, i) => (
          <div key={c.label} className={cn("min-w-0 bg-card px-5 py-5 sm:px-6 sm:py-6", odd && i === cells.length - 1 && "col-span-2 lg:col-span-1")}>
            <dt className="text-[13.5px] font-medium text-muted-foreground">{c.label}</dt>
            <dd className="mt-2.5">
              {c.loading ? (
                <span className="vp-skel block h-8 w-32" />
              ) : (
                <span className={cn("vp-num block truncate text-[26px] font-extrabold leading-none tracking-[-0.04em] sm:text-[30px]", c.featured ? "vp-green-ink" : "text-foreground")}>{c.value}</span>
              )}
              {c.sub && <span className="mt-2.5 block text-[13px] leading-snug text-muted-foreground">{c.sub}</span>}
              {c.meter !== undefined && (
                <span className="mt-3.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(Math.max(c.meter, 0), 100)}%` }} />
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
