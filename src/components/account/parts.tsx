import { useId, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldHint } from "@/components/seller-ui/form";

/** Etiqueta pequena (tipo de conta, apelido…). */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-3 text-[12.5px] font-semibold text-muted-foreground", className)}>{children}</span>;
}

/** Célula de dado (rótulo, valor e apoio) para as faixas de fatos. */
export function Fact({ label, children, sub, className }: { label: string; children: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 bg-card px-5 py-4 sm:px-6", className)}>
      <dt className="text-[13px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 text-[15.5px] font-semibold leading-snug text-foreground">{children}</dd>
      {sub && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Cabeçalho de painel: título, apoio e algo à direita. */
export function PanelHead({ title, subtitle, aside, id }: { title: string; subtitle?: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="font-heading text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 max-w-[56ch] text-[14px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

/** Campo de texto com rótulo, apoio e erro ligados por id (leitor de tela lê o erro junto do campo). */
export function Field({ id: given, label, hint, error, locked, optional, children }: {
  id?: string; label: string; hint?: ReactNode; error?: string; locked?: boolean; optional?: boolean;
  children: (p: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode;
}) {
  const auto = useId();
  const id = given ?? auto;
  const note = error || hint ? `${id}-note` : undefined;
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-1.5">
        <label htmlFor={id} className="text-[13.5px] font-semibold text-foreground">{label}</label>
        {optional && <span className="text-[12.5px] text-muted-foreground">opcional</span>}
        {locked && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Campo travado" />}
      </div>
      {children({ id, "aria-invalid": !!error, "aria-describedby": note })}
      {(error || hint) && (
        <FieldHint className={cn(error && "font-medium text-destructive")}>
          <span id={note} role={error ? "alert" : undefined}>{error || hint}</span>
        </FieldHint>
      )}
    </div>
  );
}

/** Campo travado: mostra o valor com um cadeado, sem parecer um campo quebrado. */
export function LockedInput({ id, value, ...aria }: { id: string; value: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) {
  return (
    <div className="relative">
      <input id={id} readOnly value={value} className="vp-field" style={{ paddingRight: 44, background: "hsl(var(--muted) / .5)" }} {...aria} />
      <Lock className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  );
}

