import { cn } from "@/lib/utils";

/**
 * Vemprapay logomark — a solid money-green tile carrying a "V" drawn as a
 * forward check: the short left stroke lands, the long right stroke rises
 * past the tile edge line, reading as "approved / moving forward".
 * Inline SVG, theme-token driven, crisp at any size.
 */
export interface VemprapayLogoProps {
  className?: string;
  size?: number;
  withWordmark?: boolean;
  /** Kept for API compatibility; the mark is static by design. */
  animated?: boolean;
  /** Draws the green tile behind the mark. Default: true. */
  plate?: boolean;
}

export function VenxpayLogo({ className, size = 32, withWordmark = false, plate = true }: VemprapayLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label="Vemprapay" className="shrink-0">
        {plate && <rect x="0" y="0" width="64" height="64" rx="18" fill="hsl(var(--primary))" />}
        <path
          d="M16 27 L28.5 46 L48 16"
          stroke={plate ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="48" cy="16" r="4.2" fill={plate ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))"} opacity="0.9" />
      </svg>
      {withWordmark && (
        <span className="font-display font-extrabold tracking-[-0.035em] text-[1.15em] leading-none text-foreground">
          vempra<span className="text-primary">pay</span>
        </span>
      )}
    </span>
  );
}

export const VemprapayLogo = VenxpayLogo;
export default VenxpayLogo;
