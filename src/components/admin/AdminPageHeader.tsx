import type { ReactNode } from "react";

type StatusTone = "success" | "warning" | "info" | "neutral" | "destructive";

/**
 * Cabeçalho de cada aba do admin: título, uma frase dizendo para que serve a tela, o estado atual (opcional) e as ações.
 * O estilo vive em `.ax-head` (src/index.css, bloco "Admin: padrão visual"); a seção da aba aparece no topo do painel.
 * `eyebrow` continua aceito para não quebrar quem já passa, mas não é desenhado: o menu e a barra do topo já dizem onde a pessoa está.
 */
export function AdminPageHeader({
  title,
  subtitle,
  status,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status?: { tone: StatusTone; label: string; pulse?: boolean };
  actions?: ReactNode;
}) {
  return (
    <header className="ax-head">
      <div className="ax-head-main">
        <div className="ax-head-title">
          <h1>{title}</h1>
          {status && (
            <span className="ax-status" data-tone={status.tone} data-pulse={status.pulse ? "true" : undefined}>
              {status.label}
            </span>
          )}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ax-head-actions">{actions}</div>}
    </header>
  );
}
