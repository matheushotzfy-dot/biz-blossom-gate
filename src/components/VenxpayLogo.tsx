import { cn } from "@/lib/utils";

/**
 * Vemprapay logomark — a minimalist "V" cut from two beveled rails:
 * the left rail is solid (capital in), the right rail is a gradient blade
 * (settlement out), joined by a payment node at the vertex.
 * 100% inline SVG — no external assets, scales cleanly at any size.
 */
type Props = {
  className?: string;
  size?: number;
  withWordmark?: boolean;
  animated?: boolean;
  /** Renderiza a placa (squircle) em volta do "V". Padrão: true. */
  plate?: boolean;
};

export function VenxpayLogo({ className, size = 32, withWordmark = false, animated = true, plate = true }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label="Vemprapay"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="vxBlade" x1="32" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="vxRail" x1="10" y1="8" x2="32" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* squircle plate — hairline, no glow */}
        {plate && (
          <rect x="2.5" y="2.5" width="59" height="59" rx="17" stroke="currentColor" strokeOpacity="0.16" />
        )}

        {/* left rail of the V (thick, structural) */}
        <path
          d="M17 17 L32 48"
          stroke="url(#vxRail)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* right blade of the V (gradient, tapering) */}
        <path
          d="M47 17 L32 48"
          stroke="url(#vxBlade)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* clearing notch — the detail that makes the mark */}
        <path d="M24.5 30 H39.5" stroke="hsl(var(--background))" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M25.5 30 H38.5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />

        {/* settlement node at the vertex */}
        <circle cx="32" cy="48" r="3.2" fill="hsl(var(--primary))">
          {animated && (
            <animate attributeName="opacity" values="1;0.35;1" dur="2.6s" repeatCount="indefinite" />
          )}
        </circle>
      </svg>

      {withWordmark && (
        <span className="font-display font-black tracking-[-0.045em] text-[1.15em] leading-none text-foreground">
          VENX<span className="text-primary">PAY</span>
        </span>
      )}
    </span>
  );
}

export default VenxpayLogo;
