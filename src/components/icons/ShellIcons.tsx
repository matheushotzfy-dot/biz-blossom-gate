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
