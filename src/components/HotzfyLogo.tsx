import { cn } from "@/lib/utils";

/**
 * HOTZFY logomark — futuristic "H" built from two vertical rails
 * bridged by a diagonal circuit slash and a payment node.
 * Fully inline SVG. Colors adapt via `currentColor` fallback + gradient stops.
 */
type Props = {
  className?: string;
  size?: number;
  withWordmark?: boolean;
  animated?: boolean;
};

export function HotzfyLogo({ className, size = 32, withWordmark = false, animated = true }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-label="HOTZFY"
        className={cn("shrink-0", animated && "drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]")}
      >
        <defs>
          <linearGradient id="hzMark" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="hzMarkSoft" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* outer hex frame */}
        <path
          d="M32 3 L57 17 V47 L32 61 L7 47 V17 Z"
          stroke="url(#hzMark)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.35"
        />

        {/* left rail */}
        <rect x="15" y="16" width="6" height="32" rx="2" fill="url(#hzMarkSoft)" />
        {/* right rail */}
        <rect x="43" y="16" width="6" height="32" rx="2" fill="url(#hzMarkSoft)" />

        {/* diagonal circuit bridge (the H bar as a slash) */}
        <path
          d="M21 34 L43 30"
          stroke="url(#hzMark)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* payment node */}
        <circle cx="32" cy="32" r="4.5" fill="#0b0f14" stroke="url(#hzMark)" strokeWidth="2" />
        <circle cx="32" cy="32" r="1.5" fill="url(#hzMark)">
          {animated && (
            <animate attributeName="r" values="1.2;2.2;1.2" dur="2.4s" repeatCount="indefinite" />
          )}
        </circle>

        {/* corner ticks */}
        <path d="M7 17 L11 17 M53 17 L57 17 M7 47 L11 47 M53 47 L57 47" stroke="url(#hzMark)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {withWordmark && (
        <span className="font-display font-black tracking-[-0.04em] text-[1.15em] leading-none text-foreground">
          HOTZ<span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">FY</span>
        </span>
      )}
    </span>
  );
}

export default HotzfyLogo;
