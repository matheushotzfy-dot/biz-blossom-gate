import type { ReactNode } from "react";

export interface PageHeadProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Botões à direita (no celular descem para baixo do título). */
  actions?: ReactNode;
}

/** Cabeçalho padrão das telas do seller: mesma escala da saudação do Início. */
export function PageHead({ title, subtitle, actions }: PageHeadProps) {
  return (
    <header className="flex flex-col gap-4 pt-1 md:flex-row md:items-end md:justify-between md:gap-6">
      <div className="min-w-0">
        <h1 className="font-heading text-[28px] font-extrabold leading-[1.1] tracking-[-0.04em] text-foreground md:text-[36px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[64ch] text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 md:shrink-0 md:justify-end">{actions}</div>}
    </header>
  );
}
