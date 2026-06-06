import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineErrorProps {
  message?: string | null;
  className?: string;
  id?: string;
}

/**
 * Compact inline validation error: red icon + message,
 * semantic destructive tokens, animated fade-in.
 */
export function InlineError({ message, className, id }: InlineErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "flex items-start gap-1.5 text-[11px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200",
        className,
      )}
    >
      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" strokeWidth={2.5} />
      <span className="leading-tight">{message}</span>
    </p>
  );
}

/** Conditional input class helpers for error/focus visual states. */
export const errorInputClass = (hasError: boolean) =>
  hasError
    ? "border-destructive/60 focus-visible:ring-destructive/30 focus-visible:border-destructive"
    : "";
