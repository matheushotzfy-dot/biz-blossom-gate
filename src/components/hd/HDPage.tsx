import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * "High-density display" kit.
 *
 * Shared primitives that mirror the Dashboard visual language:
 * ambient backdrop, oversized display headings, micro-caps labels,
 * tabular numerals and solid 2rem cards. Used to keep Vendas, Produtos,
 * Taxas, Perfil and KYC visually consistent with /dashboard.
 */

export type HDTone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

const TONE_TEXT: Record<HDTone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
  neutral: "text-muted-foreground",
};

const TONE_SHELL: Record<HDTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  neutral: "bg-muted/50 text-muted-foreground",
};

/** Full-bleed page shell with the dashboard ambient gradient backdrop. */
export function HDShell({ children, className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative min-h-screen w-full text-foreground animate-in fade-in duration-500 overflow-hidden",
        className,
      )}
      {...rest}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(60% 40% at 80% 0%, hsl(var(--primary)/0.12), transparent 70%), radial-gradient(50% 40% at 10% 100%, hsl(var(--primary)/0.08), transparent 70%)",
        }}
      />
      <div className="relative z-10 px-2 sm:px-4 md:px-6 pt-4 pb-24 max-w-[1600px] mx-auto space-y-5">
        {children}
      </div>
    </div>
  );
}

export interface HDHeaderProps {
  /** Micro-caps kicker rendered above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions / status chips. */
  actions?: ReactNode;
  className?: string;
}

/** Oversized display heading row, matching the dashboard greeting. */
export function HDHeader({ eyebrow, title, subtitle, actions, className }: HDHeaderProps) {
  return (
    <header className={cn("flex flex-col md:flex-row md:items-center md:justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <span className="block text-[10px] font-bold uppercase tracking-[0.28em] text-primary mb-1.5">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="font-display font-extrabold tracking-[-0.035em] text-[26px] md:text-[38px] leading-[1.05]">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground/80 text-[13px] font-medium mt-1">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div> : null}
    </header>
  );
}

export interface HDStatProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ElementType;
  tone?: HDTone;
  className?: string;
}

/** Dense KPI card: micro-caps label, 28px black numerals, muted footnote. */
export function HDStat({ label, value, sub, icon: Icon, tone = "neutral", className }: HDStatProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-card/80 px-5 py-4 transition-colors hover:border-primary/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">{label}</p>
        {Icon ? (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl shrink-0", TONE_SHELL[tone])}>
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-3 font-display text-[28px] font-black leading-none tracking-[-0.03em] tabular-nums truncate",
          tone === "neutral" ? "text-foreground" : TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-2 truncate text-[11px] font-medium text-muted-foreground/70">{sub}</p>
      ) : null}
    </div>
  );
}

/** Responsive grid for HDStat cards. */
export function HDStatGrid({ children, className, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)} {...rest}>
      {children}
    </div>
  );
}

/** Solid section card with optional micro-caps header. */
export function HDCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[2rem] border border-border/60 bg-card/80", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
          <div className="min-w-0">
            {title ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">{title}</p>
            ) : null}
            {description ? (
              <p className="mt-1 truncate text-[12px] font-medium text-muted-foreground/60">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
