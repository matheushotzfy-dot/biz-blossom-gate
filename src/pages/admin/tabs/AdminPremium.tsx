import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Peças compartilhadas das abas do admin. O visual vive em `.ax-*` (src/index.css, bloco "Admin: padrão visual"):
 * cores, raios e tamanhos saem dos tokens `--as-*`, então claro e escuro seguem o mesmo desenho.
 * Os ícones e `eyebrow` continuam aceitos nas props para não quebrar quem já passa, mas não são desenhados:
 * ícone apagado em todo cartão e rótulo miúdo em cima de todo título eram enfeite, não informação.
 */

type Tone = "primary" | "success" | "warning" | "destructive" | "info" | "neutral";

export function PremiumPanel({ children, className, title, description, action }: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <section className={cn("ax-panel", className)}>
      {(title || description || action) && (
        <header className="ax-panel-head">
          <div className="min-w-0">
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {action && <div className="ax-panel-action">{action}</div>}
        </header>
      )}
      <div className="ax-panel-body">{children}</div>
    </section>
  );
}

export function PremiumMetric({ label, value, sub, tone = "neutral", className, onClick }: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
  /** Quando existe, o indicador vira um botão que leva à aba onde o número nasce. */
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="ax-metric-label">
        {(tone === "warning" || tone === "destructive") && <i aria-hidden className="ax-dot" />}
        <span>{label}</span>
      </span>
      <span className="ax-metric-value">{value}</span>
      {sub && <span className="ax-metric-sub">{sub}</span>}
    </>
  );
  if (onClick) {
    return <button type="button" onClick={onClick} className={cn("ax-metric ax-metric-btn", className)} data-tone={tone}>{body}</button>;
  }
  return <div className={cn("ax-metric", className)} data-tone={tone}>{body}</div>;
}

/** Indicadores numa faixa só, com divisórias finas entre eles (em vez de quatro cartões soltos iguais). */
export function PremiumMetricGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  return (
    <div className="ax-kpis">
      <div className="ax-kpis-grid" data-cols={cols}>{children}</div>
    </div>
  );
}

export function PremiumSegmented<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="ax-seg">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PremiumEmpty({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="ax-empty">
      <span className="ax-empty-icon"><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
      <p className="ax-empty-title">{title}</p>
      {subtitle && <p className="ax-empty-sub">{subtitle}</p>}
    </div>
  );
}

export const premiumTable = {
  wrapper: "ax-table-wrap",
  table: "ax-table",
  headRow: "ax-table-head",
  th: "ax-th",
  row: "ax-row group",
  td: "ax-td",
};
