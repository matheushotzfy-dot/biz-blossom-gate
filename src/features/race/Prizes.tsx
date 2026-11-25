import { Gift, Target, Trophy } from "lucide-react";
import { StatusPill } from "@/components/seller-ui/tx";
import { spokenBRL } from "@/features/awards/awardMeta";
import { centsToReais, formatCents, isPlacePrize, ordinal, prizeStatus, type Prize, type PrizeContext } from "./raceMeta";

function Card({ prize, ctx, image }: { prize: Prize; ctx: PrizeContext; image: string | null }) {
  const st = prizeStatus(prize, ctx);
  const place = isPlacePrize(prize);
  return (
    <li className="vr-prize flex flex-col" data-won={st.tone === "ok"}>
      {image ? (
        <div className="aspect-[16/10] overflow-hidden bg-muted"><img src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /></div>
      ) : place ? (
        <div className="vr-tile" aria-hidden><div><b>{ordinal(prize.target_position as number)}</b><span>lugar</span></div></div>
      ) : (
        <div className="vr-tile" aria-hidden><div><Trophy className="mx-auto h-8 w-8" /><span>{spokenBRL(centsToReais(prize.min_revenue_cents))}</span></div></div>
      )}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {st.label && <StatusPill label={st.label} tone={st.tone === "ok" ? "ok" : "wait"} className="mb-2.5 self-start" />}
        <h3 className="text-[16.5px] font-extrabold leading-snug tracking-[-0.02em] text-foreground">{prize.title}</h3>
        {prize.description && <p className="mt-1.5 line-clamp-3 text-[14px] leading-relaxed text-muted-foreground">{prize.description}</p>}
        <p className="mt-3.5 flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
          <Target className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          {place ? `${ordinal(prize.target_position as number)} lugar no ranking` : `Meta de ${formatCents(prize.min_revenue_cents)} em vendas`}
        </p>
        {st.progress !== null && st.progress < 100 && (
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${Math.round(st.progress)}% da meta`}>
            <span className="block h-full rounded-full bg-primary" style={{ width: `${st.progress}%` }} />
          </div>
        )}
        {st.hint && <p className="mt-2 text-[13.5px] leading-snug text-muted-foreground">{st.hint}</p>}
      </div>
    </li>
  );
}

export function Prizes({ prizes, ctx, assetUrls }: { prizes: Prize[]; ctx: PrizeContext; assetUrls: Record<string, string> }) {
  if (prizes.length === 0) return null;
  const sorted = [...prizes].sort((a, b) => a.sort_order - b.sort_order);
  return (
    <section className="vp-sheet p-5 sm:p-7" aria-labelledby="premios-titulo">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Gift className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 id="premios-titulo" className="font-heading text-[22px] font-extrabold tracking-[-0.03em] text-foreground">Prêmios da temporada</h2>
          <p className="mt-0.5 text-[14.5px] text-muted-foreground">{ctx.phase === "ended" ? "O que estava em jogo." : "Cada colocação e cada meta tem o seu prêmio."}</p>
        </div>
      </div>
      <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-4">
        {sorted.map((p) => <Card key={p.id} prize={p} ctx={ctx} image={assetUrls[`prize:${p.id}`] || p.image_url || null} />)}
      </ul>
    </section>
  );
}

