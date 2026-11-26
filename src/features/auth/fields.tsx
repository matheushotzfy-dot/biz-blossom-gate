/**
 * Peças de formulário do login, do cadastro e da recuperação.
 * Erro de campo sempre aparece embaixo do campo (`role="alert"`), ligado por `aria-describedby`,
 * e a cor de erro vem de `aria-invalid`: nada depende só de cor.
 */
import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Eye, EyeOff, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { passwordRules, passwordStrength, secondsLeft } from "./authModel";

export const inputClass =
  "h-11 rounded-md border-border bg-card px-4 text-base sm:text-[14px] text-foreground placeholder:text-muted-foreground/60 hover:border-foreground/25 focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/15";

export const labelClass = "mb-2 block text-[12px] font-semibold text-foreground/85";

export const primaryButtonClass =
  "h-11 w-full rounded-md bg-primary text-[14px] font-semibold text-primary-foreground hover:brightness-105 disabled:cursor-not-allowed";

export const secondaryButtonClass =
  "h-11 rounded-md border-border bg-transparent text-[14px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground";

export const linkButtonClass =
  "font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline";

export function describedBy(id: string, error?: string, hint?: ReactNode): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

/* ───────────────────────── cabeçalho e avisos ───────────────────────── */

export function AuthHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 data-auth-heading tabIndex={-1} className="text-[24px] font-heading font-semibold leading-[1.15] text-foreground outline-none sm:text-[26px]">
        {title}
      </h1>
      <p className="mt-2 max-w-[390px] text-[13px] leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  );
}

export type NoticeTone = "error" | "info" | "success";

export function FormNotice({ tone, children, actions, className }: { tone: NoticeTone; children: ReactNode; actions?: ReactNode; className?: string }) {
  const Icon = tone === "error" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-[10px] px-4 py-3 text-[13px] leading-relaxed",
        tone === "error" && "bg-destructive/[0.07] text-foreground ring-1 ring-destructive/25",
        tone === "info" && "bg-muted/60 text-foreground ring-1 ring-border",
        tone === "success" && "bg-success/10 text-foreground ring-1 ring-success/30",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "error" && "text-destructive", tone === "info" && "text-muted-foreground", tone === "success" && "text-success")} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p>{children}</p>
        {actions && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{actions}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground motion-reduce:animate-none", className)}
    />
  );
}

/* ───────────────────────── campos ───────────────────────── */

interface ShellProps { id: string; label: ReactNode; error?: string; hint?: ReactNode; children: ReactNode; className?: string }

export function FieldShell({ id, label, error, hint, children, className }: ShellProps) {
  return (
    <div className={className}>
      <Label htmlFor={id} className={labelClass}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-destructive">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
  wrapperClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, error, hint, trailing, wrapperClassName, className, ...input },
  ref,
) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={wrapperClassName}>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(inputClass, trailing ? "pr-12" : undefined, className)}
          {...input}
        />
        {trailing && <span className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center">{trailing}</span>}
      </div>
    </FieldShell>
  );
});

interface PasswordFieldProps extends Omit<TextFieldProps, "type" | "trailing"> {
  visible: boolean;
  onToggleVisible: () => void;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { visible, onToggleVisible, ...field },
  ref,
) {
  return (
    <TextField
      ref={ref}
      {...field}
      type={visible ? "text" : "password"}
      autoCapitalize="none"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {visible ? <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <Eye className="h-[18px] w-[18px]" aria-hidden="true" />}
        </button>
      }
    />
  );
});

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "onChange" | "value"> {
  id: string;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder: string;
  error?: string;
  hint?: ReactNode;
}

/** `<select>` nativo: no celular abre o seletor do sistema e o teclado funciona sem código extra. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { id, label, value, onValueChange, options, placeholder, error, hint, className, ...select },
  ref,
) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(
            "h-11 w-full appearance-none rounded-md border border-border bg-card pl-4 pr-10 text-base sm:text-[14px] outline-none transition-colors hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
            value ? "text-foreground" : "text-muted-foreground/70",
            className,
          )}
          {...select}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
    </FieldShell>
  );
});

/* ───────────────────────── escolhas (rádio nativo) ───────────────────────── */

export interface Choice { value: string; label: string; hint?: string; icon?: ReactNode }

interface ChoiceGroupProps {
  id: string;
  name: string;
  legend: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<Choice>;
  /** `card` mostra ícone, título e frase; `chip` é só o texto. */
  variant?: "card" | "chip";
  error?: string;
}

export function ChoiceGroup({ id, name, legend, value, onChange, options, variant = "chip", error }: ChoiceGroupProps) {
  return (
    <fieldset id={id} className="min-w-0" aria-describedby={error ? `${id}-error` : undefined} aria-invalid={error ? true : undefined}>
      <legend className={labelClass}>{legend}</legend>
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5">
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label key={option.value} className="relative block cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              {variant === "card" ? (
                <span
                  className={cn(
                    "flex min-h-[104px] flex-col justify-between rounded-2xl border p-4 text-left transition-colors duration-200",
                    "border-border bg-card hover:border-foreground/25 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40",
                    checked && "border-primary bg-primary/[0.07] hover:border-primary",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", checked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{option.icon}</span>
                    <span className={cn("flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-colors", checked ? "border-primary bg-primary" : "border-border")}>
                      {checked && <Check className="h-3 w-3 text-primary-foreground" aria-hidden="true" />}
                    </span>
                  </span>
                  <span className="mt-3 block">
                    <span className="block text-[14px] font-semibold text-foreground">{option.label}</span>
                    {option.hint && <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{option.hint}</span>}
                  </span>
                </span>
              ) : (
                <span
                  className={cn(
                    "flex min-h-[44px] items-center justify-center rounded-[10px] border px-3 py-2.5 text-center text-[13px] font-medium tabular-nums transition-colors duration-200",
                    "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40",
                    checked && "border-primary bg-primary/[0.07] text-foreground hover:border-primary",
                  )}
                >
                  {option.label}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-destructive">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}

/* ───────────────────────── senha: força e regras ───────────────────────── */

const LEVEL_BAR = ["bg-muted", "bg-destructive", "bg-warning", "bg-success"] as const;

export function PasswordHelp({ password }: { password: string }) {
  const strength = passwordStrength(password);
  if (!password) {
    return (
      <ul className="mt-2.5 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-4 gap-y-1.5" aria-label="Regras da senha">
        {passwordRules("").map((rule) => (
          <li key={rule.id} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Check className="h-3.5 w-3.5 opacity-30" aria-hidden="true" />{rule.label}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-2" role="status" aria-live="polite">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <span key={i} className={cn("h-[3px] flex-1 rounded-full transition-colors", i <= strength.level ? LEVEL_BAR[strength.level] : "bg-muted")} />
          ))}
        </div>
        <span className="text-[11.5px] font-medium text-foreground/70">Senha {strength.label.toLowerCase()}</span>
      </div>
      <ul className="mt-2.5 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-4 gap-y-1.5" aria-label="Regras da senha">
        {passwordRules(password).map((rule) => (
          <li key={rule.id} className={cn("flex items-center gap-1.5 text-[12px]", rule.ok ? "text-success" : "text-muted-foreground")}>
            <Check className={cn("h-3.5 w-3.5", rule.ok ? "opacity-100" : "opacity-30")} aria-hidden="true" />
            <span className="sr-only">{rule.ok ? "Cumprida: " : "Falta: "}</span>{rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────── contagem regressiva ───────────────────────── */

/** Segundos que faltam para liberar um botão (reenvio de código, pausa depois de erros). */
export function useCountdown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [until]);

  const start = (seconds: number) => {
    const current = Date.now();
    setNow(current);
    setUntil(current + seconds * 1000);
  };

  return { seconds: secondsLeft(until, now), start };
}
