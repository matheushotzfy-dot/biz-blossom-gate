import type { SVGProps } from "react";

/**
 * Ícones próprios do shell Venxpay — geometria técnica, traço fino.
 * Substituem os ícones genéricos na topbar/sidebar para dar identidade própria.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

/** Busca — anel técnico com haste diagonal reta e micro-tick */
export function ScanSearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M10.5 4.5v1.6M10.5 14.9v1.6M4.5 10.5h1.6M14.9 10.5h1.6" strokeOpacity="0.55" />
      <path d="M15.2 15.2 20 20" />
    </svg>
  );
}

/** Toggle da sidebar — painel com barra de estado */
export function PanelToggleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <path d="M9.5 4.5v15" />
      <path d="M5.6 9.5h1.9M5.6 12h1.9" strokeOpacity="0.6" />
    </svg>
  );
}

/** Privacidade — íris geométrica */
export function IrisIcon({ off = false, ...props }: IconProps & { off?: boolean }) {
  return (
    <svg {...base(props)}>
      <path d="M2.6 12s3.6-5.6 9.4-5.6S21.4 12 21.4 12s-3.6 5.6-9.4 5.6S2.6 12 2.6 12Z" />
      <path d="M12 9.6 14.4 12 12 14.4 9.6 12Z" />
      {off && <path d="M4 20 20 4" strokeWidth={1.7} />}
    </svg>
  );
}

/** Tema claro — disco com raios em tick marks */
export function SunDialIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4.2" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const long = i % 2 === 0;
        const r1 = 6.6;
        const r2 = long ? 9.4 : 8.4;
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * r1}
            y1={12 + Math.sin(a) * r1}
            x2={12 + Math.cos(a) * r2}
            y2={12 + Math.sin(a) * r2}
            strokeOpacity={long ? 1 : 0.5}
          />
        );
      })}
    </svg>
  );
}

/** Tema escuro — crescente sólido com micro estrelas */
export function MoonDialIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19 14.2A7.6 7.6 0 0 1 9.8 5a7.6 7.6 0 1 0 9.2 9.2Z" />
      <path d="M17.4 4.4v2.2M16.3 5.5h2.2" strokeOpacity="0.6" />
    </svg>
  );
}

/** Notificações — silhueta trapezoidal técnica */
export function SignalBellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.4 16.4 8 9.6A4.2 4.2 0 0 1 12 6.4a4.2 4.2 0 0 1 4 3.2l1.6 6.8Z" />
      <path d="M4.8 16.4h14.4" />
      <path d="M10.4 19.2h3.2" strokeOpacity="0.7" />
      <path d="M12 4v1.4" strokeOpacity="0.7" />
    </svg>
  );
}

/** Pino — fixar a sidebar */
export function PinIcon({ active = false, ...props }: IconProps & { active?: boolean }) {
  return (
    <svg {...base(props)}>
      <path d="M9 3.5h6l-.9 5.2 3.1 3.1H6.8l3.1-3.1Z" fill={active ? "currentColor" : "none"} />
      <path d="M12 11.8V20.5" />
    </svg>
  );
}

/** Glifos de navegação — geometria técnica própria */
export function GlyphDashboard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5.5H9V20H5a1 1 0 0 1-1-1Z" />
    </svg>
  );
}
export function GlyphSales(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 19h16" strokeOpacity="0.5" />
      <path d="M5 15.5 10 10l3.4 3.2L19 6.5" />
      <path d="M15.2 6.5H19v3.7" strokeOpacity="0.7" />
    </svg>
  );
}
export function GlyphProduct(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.8 20 8v8l-8 4.2L4 16V8Z" />
      <path d="M4 8l8 4.2L20 8M12 12.2V20.2" strokeOpacity="0.55" />
    </svg>
  );
}
export function GlyphCoupon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 8.5h17v2.2a1.3 1.3 0 0 0 0 2.6v2.2h-17v-2.2a1.3 1.3 0 0 0 0-2.6Z" />
      <path d="M9.6 11v2" strokeOpacity="0.7" />
      <path d="M14.4 11v2" strokeOpacity="0.7" />
    </svg>
  );
}
export function GlyphWithdraw(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v9.5" />
      <path d="M8.4 10.4 12 14l3.6-3.6" />
      <path d="M4.5 17.5h15" strokeOpacity="0.6" />
    </svg>
  );
}
export function GlyphFees(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 17.5 17.5 6.5" />
      <circle cx="8.4" cy="8.4" r="2.2" />
      <circle cx="15.6" cy="15.6" r="2.2" />
    </svg>
  );
}
export function GlyphApps(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="7" height="7" rx="1.4" />
      <rect x="13" y="4" width="7" height="7" rx="3.5" strokeOpacity="0.7" />
      <rect x="4" y="13" width="7" height="7" rx="3.5" strokeOpacity="0.7" />
      <rect x="13" y="13" width="7" height="7" rx="1.4" />
    </svg>
  );
}
export function GlyphProfile(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      <path d="M12 11.4a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4Z" />
    </svg>
  );
}
export function GlyphTrophy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0Z" />
      <path d="M7.5 5.5H5v1.8a2.8 2.8 0 0 0 2.5 2.7M16.5 5.5H19v1.8a2.8 2.8 0 0 1-2.5 2.7" strokeOpacity="0.6" />
      <path d="M12 13v3.6M8.6 20h6.8" />
    </svg>
  );
}
export function GlyphSupport(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.6A3.6 3.6 0 0 1 7.6 5h8.8A3.6 3.6 0 0 1 20 8.6v4.6a3.6 3.6 0 0 1-3.6 3.6H10l-4.6 3.1v-3.3A3.6 3.6 0 0 1 4 13.2Z" />
      <path d="M8.8 11h6.4" strokeOpacity="0.6" />
    </svg>
  );
}
