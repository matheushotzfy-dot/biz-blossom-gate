import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  value: number | string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  max?: number;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, step = 1, min, max, disabled, ...props }, ref) => {
    const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;

    const increment = () => {
      if (disabled) return;
      const next = numValue + step;
      if (max !== undefined && next > max) return;
      onChange(String(parseFloat(next.toFixed(10))));
    };

    const decrement = () => {
      if (disabled) return;
      const next = numValue - step;
      if (min !== undefined && next < min) return;
      onChange(String(parseFloat(next.toFixed(10))));
    };

    return (
      <div className={cn(
        "flex items-center h-9 rounded-lg border border-input bg-background overflow-hidden transition-colors",
        "focus-within:ring-1 focus-within:ring-ring focus-within:border-ring",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}>
        <button
          type="button"
          onClick={decrement}
          disabled={disabled || (min !== undefined && numValue <= min)}
          className="h-full px-2.5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 border-r border-input"
          tabIndex={-1}
        >
          <Minus className="h-3 w-3" />
        </button>
        <input
          ref={ref}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          className="flex-1 h-full bg-transparent text-center text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0 px-1 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          {...props}
        />
        <button
          type="button"
          onClick={increment}
          disabled={disabled || (max !== undefined && numValue >= max)}
          className="h-full px-2.5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 border-l border-input"
          tabIndex={-1}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
