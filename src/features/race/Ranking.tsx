import { useState } from "react";
import { Trophy } from "lucide-react";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { Face } from "./Face";
import { formatCents, maskedCents, OTHERS_ROUNDING_CENTS, type Leader, type RacePhase } from "./raceMeta";

const TOP = 10;

function Row({ l, me, top, hidden }: { l: Leader; me: boolean; top: number; hidden: boolean }) {
  const pct = top > 0 ? Math.max(3, (l.revenue_cents / top) * 100) : 3;
  return (
    <li className="vr-row" data-me={me}>
      <span className={`w-7 shrink-0 text-right text-[14px] font-bold tabular-nums ${l.rank_position <= 3 ? "vp-green-ink" : "text-muted-foreground"}`}>{l.rank_position}º</span>
      <Face name={l.seller_name} src={l.seller_avatar} size={38} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[14.5px] font-semibold text-foreground">
          <span className="truncate">{l.seller_name}</span>
          {me && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11.5px] font-bold text-primary-foreground">Você</span>}
        </p>
        <div className="vr-bar mt-1.5" aria-hidden><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
      </div>
      <span className="vp-num shrink-0 text-[14.5px] font-extrabold tracking-[-0.02em] text-foreground">{me ? maskedCents(l.revenue_cents, hidden, true) : formatCents(l.revenue_cents)}</span>
    </li>
  );
}

/** Classificação: os 10 primeiros, o seu lugar se estiver fora deles e, sob pedido, a lista inteira (até 100). */
export function Ranking({ leaders, userId, phase, hidden }: { leaders: Leader[]; userId: string | null | undefined; phase: RacePhase; hidden: boolean }) {
  const [all, setAll] = useState(false);
  const top = leaders[0]?.revenue_cents ?? 0;
  const shown = all ? leaders : leaders.slice(0, TOP);
  const mine = userId ? leaders.find((l) => l.seller_id === userId) ?? null : null;
  const pinned = mine && mine.rank_position > shown.length ? mine : null;

  return (
    <section className="vp-sheet p-5 sm:p-7" aria-labelledby="ranking-titulo">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          <h2 id="ranking-titulo" className="font-heading text-[22px] font-extrabold tracking-[-0.03em] text-foreground">{phase === "ended" ? "Classificação final" : "Classificação"}</h2>
          <p className="mt-1 text-[14.5px] text-muted-foreground">{all ? "Todos os participantes do ranking." : "Os 10 primeiros da temporada."}</p>
        </div>
        {leaders.length > 0 && <p className="vp-num text-[14.5px] font-semibold text-muted-foreground">{leaders.length} {leaders.length === 1 ? "participante" : "participantes"}</p>}
      </div>

      {leaders.length === 0 ? (
        <EmptyPanel
          icon={<Trophy className="h-7 w-7" aria-hidden />}
          title="Ranking vazio por enquanto"
          text={phase === "ended" ? "Ninguém pontuou nesta temporada." : "Quando a primeira venda aprovada entrar, o ranking aparece aqui."}
        />
      ) : (
        <>
          <ol className="mt-5" aria-label="Classificação da temporada">
            {shown.map((l) => <Row key={`${l.rank_position}-${l.seller_name}`} l={l} me={!!mine && l.rank_position === mine.rank_position && l.seller_id === mine.seller_id} top={top} hidden={hidden} />)}
          </ol>
          {pinned && (
            <ol className="mt-3" aria-label="Sua posição">
              <Row l={pinned} me top={top} hidden={hidden} />
            </ol>
          )}
          {leaders.length > TOP && (
            <button type="button" className="vp-ghost vp-r16 mt-4" onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? "Mostrar só os 10 primeiros" : `Ver os ${leaders.length} participantes`}
            </button>
          )}
          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            Os valores dos outros participantes são arredondados para baixo, em milhares de reais ({formatCents(OTHERS_ROUNDING_CENTS)}). Só você vê o seu valor exato.
          </p>
        </>
      )}
    </section>
  );
}
