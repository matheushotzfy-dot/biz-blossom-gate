import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import bracelet from "@/assets/awards/venx-bracelet-10k.webp";
import p100 from "@/assets/awards/venx-plaque-100k.webp";
import p250 from "@/assets/awards/venx-plaque-250k.webp";
import p500 from "@/assets/awards/venx-plaque-500k.webp";
import p1m from "@/assets/awards/venx-plaque-1m.webp";
import p5m from "@/assets/awards/venx-plaque-5m.webp";
import p10m from "@/assets/awards/venx-plaque-10m.webp";
import { Tight } from "./Tight";

const PIECES = [
  { src: bracelet, alt: "Kit de pulseiras, a primeira premiação" },
  { src: p100, alt: "Placa de 100 mil em vendas" },
  { src: p250, alt: "Placa de 250 mil em vendas" },
  { src: p500, alt: "Placa de 500 mil em vendas" },
  { src: p1m, alt: "Placa de 1 milhão em vendas" },
  { src: p5m, alt: "Placa de prata de 5 milhões em vendas" },
  { src: p10m, alt: "Placa de ouro de 10 milhões em vendas" },
];

export function AwardsShelf() {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const piece = el.querySelector<HTMLElement>(".lp-piece");
    const step = (piece?.offsetWidth ?? 320) * 2;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * step, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section id="premiacoes" className="lp-stagebg py-24 sm:py-32">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-x-12 gap-y-8 px-5 sm:px-8">
        <div className="max-w-[40rem]">
          <h2 className="lp-h2">
            <Tight>Bateu a meta, a placa vai para a sua casa.</Tight>
          </h2>
          <p className="mt-5 max-w-[34rem] text-[17px] leading-[1.7]" style={{ color: "hsl(218 14% 72%)" }}>
            A cada marco de faturamento você libera uma peça, do kit de pulseiras às placas de milhões. Contam as vendas pagas, pelo valor líquido. O resgate é pedido no painel, com o seu endereço, e você acompanha o pedido até a entrega.
          </p>
        </div>
        <div className="hidden gap-2.5 sm:flex">
          <button type="button" className="lp-arrow" onClick={() => go(-1)} disabled={edge.start} aria-label="Ver peças anteriores"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" className="lp-arrow" onClick={() => go(1)} disabled={edge.end} aria-label="Ver mais peças"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
      <div ref={ref} className="lp-shelf mt-14" onScroll={measure} tabIndex={0} role="region" aria-label="Peças de premiação por faturamento">
        {PIECES.map((p) => (
          <figure key={p.src} className="lp-piece">
            <img src={p.src} alt={p.alt} width={781} height={712} loading="lazy" decoding="async" draggable={false} />
          </figure>
        ))}
      </div>
    </section>
  );
}
