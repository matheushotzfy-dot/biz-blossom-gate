import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Título de uma etapa do editor (produto, checkout, curso). */
export function StudioHeading({ title, subtitle, aside }: { title: ReactNode; subtitle?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-heading text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[30px]">{title}</h2>
        {subtitle && <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

/** Painel de conteúdo do editor. */
export function StudioPanel({ title, subtitle, aside, children, className }: { title?: ReactNode; subtitle?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("vp-sheet p-5 sm:p-7", className)}>
      {(title || aside) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-[17px] font-bold tracking-[-0.01em] text-foreground">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[14px] leading-snug text-muted-foreground">{subtitle}</p>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Opção de escolha única em cartão (tipo de entrega, tipo de upsell…). Use dentro de role="radiogroup". */
export function OptionCard({ selected, onClick, icon, title, description, badge, disabled, tone = "primary" }: {
  selected: boolean; onClick: () => void; icon?: ReactNode; title: string; description?: string; badge?: string; disabled?: boolean; tone?: "primary" | "info";
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "vp-r16 group relative flex w-full items-start gap-3.5 border p-4 text-left transition-colors",
        selected ? "border-primary/60 bg-accent" : "border-border bg-card hover:border-primary/40",
        disabled && "cursor-not-allowed opacity-60 hover:border-border",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      )}
    >
      {icon && (
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", selected ? (tone === "info" ? "bg-info text-white" : "bg-primary text-primary-foreground") : "bg-muted text-muted-foreground")}>{icon}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("text-[14.5px] font-bold leading-tight", selected ? "text-accent-foreground" : "text-foreground")}>{title}</span>
          {badge && <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">{badge}</span>}
        </span>
        {description && <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{description}</span>}
      </span>
      {selected && <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>}
    </button>
  );
}

const NOTICE_TONE = {
  info: "border-info/25 bg-info/10 text-foreground",
  warn: "border-warning/30 bg-warning/10 text-foreground",
  ok: "border-primary/25 bg-accent text-foreground",
} as const;
const NOTICE_ICON = { info: "bg-info/15 text-info", warn: "bg-warning/20 text-warning", ok: "bg-primary/15 text-primary" } as const;

/** Aviso em linha: explica um limite ou o que acontece, sem bloquear. */
export function Notice({ icon, title, children, tone = "info", className }: { icon?: ReactNode; title?: string; children: ReactNode; tone?: keyof typeof NOTICE_TONE; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3.5 rounded-[16px] border p-4", NOTICE_TONE[tone], className)}>
      {icon && <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", NOTICE_ICON[tone])}>{icon}</span>}
      <div className="min-w-0 text-[14px] leading-relaxed text-muted-foreground">
        {title && <p className="text-[14.5px] font-bold leading-tight text-foreground">{title}</p>}
        <div className={title ? "mt-1" : undefined}>{children}</div>
      </div>
    </div>
  );
}

/** Estado vazio dentro de uma etapa (precisa salvar antes, nada cadastrado…). */
export function StepEmpty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="vp-sheet grid place-items-center px-6 py-14 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground">{icon}</span>
      <p className="mt-5 text-[17px] font-extrabold tracking-[-0.02em] text-foreground">{title}</p>
      {children && <p className="mt-1 max-w-[380px] text-[14px] leading-relaxed text-muted-foreground">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
