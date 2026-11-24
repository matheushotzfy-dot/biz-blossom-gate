import type { ReactNode } from "react";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Classe do conteúdo de diálogos do seller: cantos grandes, sem padding (o conteúdo cuida). */
export const dialogShell = "gap-0 overflow-hidden rounded-[28px] border-border bg-card p-0";

/** Cabeçalho de diálogo: ícone em círculo verde, título e apoio. `aside` fica à direita (deixa espaço para o X). */
export function DialogHead({ icon, title, subtitle, aside, className }: { icon: ReactNode; title: ReactNode; subtitle?: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 border-b border-border py-5 pl-6 pr-14 sm:pl-8", className)}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <DialogTitle className="truncate font-heading text-[21px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{title}</DialogTitle>
        <DialogDescription className="mt-0.5 truncate text-[14px] text-muted-foreground">{subtitle}</DialogDescription>
      </div>
      {aside && <div className="hidden shrink-0 sm:block">{aside}</div>}
    </div>
  );
}

/** Bloco de formulário com título e apoio. */
export function FormSection({ title, subtitle, children, aside, className }: { title: string; subtitle?: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Caixa que agrupa linhas de opção com divisórias. */
export function GroupBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-border overflow-hidden rounded-[16px] border border-border bg-card", className)}>{children}</div>;
}

/** Linha de opção: ícone, título, descrição e um controle à direita (Switch, campo…). */
export function ToggleRow({ icon, title, description, children, tone = "accent" }: { icon?: ReactNode; title: string; description?: string; children: ReactNode; tone?: "accent" | "warning" | "muted" }) {
  const tones = { accent: "bg-accent text-accent-foreground", warning: "bg-warning/15 text-warning", muted: "bg-muted text-muted-foreground" } as const;
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", tones[tone])}>{icon}</span>}
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold leading-tight text-foreground">{title}</p>
          {description && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Rótulo de campo com apoio opcional. */
export function FieldLabel({ htmlFor, children, hint, className }: { htmlFor?: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cn("mb-2", className)}>
      <label htmlFor={htmlFor} className="text-[13.5px] font-semibold text-foreground">{children}</label>
      {hint && <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Apoio de campo, abaixo do input (mantém campos lado a lado alinhados). */
export function FieldHint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-1.5 text-[12.5px] leading-snug text-muted-foreground", className)}>{children}</p>;
}

/** Pílula de opção selecionável (eventos, tipos, etc.). */
export function ChoiceChip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("vp-pill border border-border", className)}>
      {children}
    </button>
  );
}

/** Abas em pílula para diálogos (Radix Tabs): lista com rolagem horizontal e gatilho verde quando ativo. */
export const tabListClass = "scrollbar-none flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none !border-0 bg-transparent p-0";
export const tabTriggerClass = "vp-pill !h-10 shrink-0 gap-2 !rounded-full border-0 px-4 text-[14px] data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/.28)]";
