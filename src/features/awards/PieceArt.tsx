import { useCallback, useRef, type PointerEvent } from "react";
import { Lock } from "lucide-react";
import { ART_H, ART_W, type AwardItem } from "./awards-data";

/** Placa desenhada quando o admin cria uma peça sem imagem (nunca empresta a arte de outro valor). */
function PlaqueFallback({ award }: { award: AwardItem }) {
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="vw-img" role="img" aria-label={`Peça ${award.title}`}>
      <defs>
        <linearGradient id={`pf-${award.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${award.glow} / .55)`} />
          <stop offset="1" stopColor="hsl(160 40% 6%)" />
        </linearGradient>
      </defs>
      {[{ y: 622, rx: 385 }, { y: 562, rx: 330 }, { y: 508, rx: 276 }].map((d, i) => (
        <g key={i}>
          <ellipse cx="390" cy={d.y + 22} rx={d.rx} ry={d.rx * 0.16} fill="hsl(168 55% 8%)" />
          <ellipse cx="390" cy={d.y} rx={d.rx} ry={d.rx * 0.16} fill="hsl(176 40% 16%)" stroke="hsl(170 60% 85% / .8)" strokeWidth="3" />
        </g>
      ))}
      <rect x="224" y="14" width="332" height="500" rx="6" fill="hsl(24 18% 10%)" />
      <rect x="244" y="34" width="292" height="460" fill={`url(#pf-${award.id})`} stroke={`hsl(${award.glow} / .8)`} strokeWidth="3" />
      <path d="M300 130 L390 330 L480 130" fill="none" stroke={`hsl(${award.glow})`} strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
      <text x="390" y="430" textAnchor="middle" fontSize="64" fontWeight="800" fill="hsl(150 28% 94%)" fontFamily="system-ui, sans-serif">{award.label}</text>
      <text x="390" y="468" textAnchor="middle" fontSize="22" fill="hsl(150 14% 78%)" fontFamily="system-ui, sans-serif">em vendas</text>
    </svg>
  );
}

const prefersReducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

/**
 * A peça no palco: inclina com o mouse, brilha só sobre o metal (a máscara é a própria silhueta),
 * reflete no piso e fica escura e trancada enquanto não foi conquistada.
 */
export function PieceArt({ award, sealed }: { award: AwardItem; sealed: boolean }) {
  const tilt = useRef<HTMLDivElement>(null);
  const showGlare = !!award.image && !award.custom && !sealed;

  const move = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = tilt.current;
    if (!el || e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    const py = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
    el.dataset.live = "true";
    el.style.setProperty("--ry", `${((px - 0.5) * 14).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-(py - 0.5) * 10).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
    el.style.setProperty("--sx", `${(130 - px * 170).toFixed(1)}%`);
  }, []);

  const leave = useCallback(() => {
    const el = tilt.current;
    if (!el) return;
    delete el.dataset.live;
    for (const k of ["--rx", "--ry", "--gx", "--gy", "--sx"]) el.style.removeProperty(k);
  }, []);

  return (
    <div className="vw-piece" onPointerMove={move} onPointerLeave={leave}>
      <div ref={tilt} className="vw-tilt">
        {award.image ? (
          <img
            src={award.image}
            alt={sealed ? `${award.title}, ainda selada` : award.title}
            width={ART_W}
            height={ART_H}
            decoding="async"
            draggable={false}
            data-sealed={sealed}
            className="vw-img"
          />
        ) : (
          <PlaqueFallback award={award} />
        )}
        {showGlare && (
          <div
            aria-hidden
            className="vw-glare"
            style={{ WebkitMaskImage: `url("${award.image}")`, maskImage: `url("${award.image}")` }}
          />
        )}
      </div>
      {award.image && (
        <div aria-hidden className="vw-reflect" data-sealed={sealed}>
          <img src={award.image} alt="" draggable={false} />
        </div>
      )}
      {sealed && (
        <span aria-hidden className="vw-lock"><Lock className="h-6 w-6" /></span>
      )}
    </div>
  );
}
