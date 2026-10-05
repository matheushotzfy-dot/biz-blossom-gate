import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type CheckoutPaymentMethod = "pix" | "credit_card" | "boleto";

interface PaymentMethodOption {
  id: CheckoutPaymentMethod;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

interface PaymentMethodSelectorProps {
  options: PaymentMethodOption[];
  value: CheckoutPaymentMethod;
  onChange: (value: CheckoutPaymentMethod) => void;
}

export function PaymentMethodSelector({ options, value, onChange }: PaymentMethodSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const selected = option.id === value;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex min-h-16 items-center gap-3 rounded-lg border px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-[color:var(--btn-color)]/30",
              selected
                ? "border-[color:var(--btn-color)] bg-[hsl(var(--checkout-bg-soft))] text-[hsl(var(--checkout-text))]"
                : "border-[hsl(var(--checkout-border))] bg-[hsl(var(--checkout-bg-elevated))] text-[hsl(var(--checkout-text-muted))]",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--checkout-border))] bg-[hsl(var(--checkout-bg-soft))]">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{option.label}</span>
              <span className="block text-xs">{option.description}</span>
            </span>
            <span aria-hidden="true" className={cn("ml-auto h-3 w-3 rounded-full border", selected && "border-[color:var(--btn-color)] bg-[color:var(--btn-color)]")} />
          </button>
        );
      })}
    </div>
  );
}