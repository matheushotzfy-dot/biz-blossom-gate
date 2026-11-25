import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Face } from "./Face";
import {
  countdownTarget, elapsedFraction, formatCents, formatCentsExact, formatRaceDate, ordinal, racePhase, spokenTime, timeParts,
  type Leader, type Race, type RacePhase,
} from "./raceMeta";

const PHASE_LABEL: Record<RacePhase, string> = { live: "Ao vivo", ended: "Encerrada", upcoming: "Começa em breve" };

/** Relógio da temporada: ticka sozinho a cada segundo, sem renderizar a página inteira. */
function Clock({ race }: { race: Race }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = countdownTarget(race, now);
  if (target === null) return null;
  const ms = Math.max(0, target - now);
  const t = timeParts(ms);
  const upcoming = racePhase(race, now) === "upcoming";
  const cells: Array<[string, number]> = [["Dias", t.d], ["Horas", t.h], ["Min", t.m], ["Seg", t.s]];
  return (
    <div role="timer" aria-label={`${upcoming ? "Começa em" : "Termina em"} ${spokenTime(ms)}`}>
      <p className="vw-dim mb-2.5 text-[14px] font-medium">{upcoming ? "Começa em" : "Termina em"}</p>
      <div className="vr-clock" aria-hidden>
        {cells.map(([k, v]) => (
          <div key={k}><b>{String(v).padStart(2, "0")}</b><span>{k}</span></div>
        ))}
      </div>
    </div>
  );
}

function Step({ l, mine, hidden, delay, reduce }: { l: Leader; mine: boolean; hidden: boolean; delay: number; reduce: boolean }) {
  const first = l.rank_position === 1;
  const height = first ? 168 : l.rank_position === 2 ? 128 : 96;
  const value = mine ? (hidden ? "R$ ••••" : formatCentsExact(l.revenue_cents)) : formatCents(l.revenue_cents);
  return (
    <motion.li
      className="flex min-w-0 flex-col items-center"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative">
        <div className="vr-ring" data-first={first}>
          <Face name={l.seller_name} src={l.seller_avatar} size={first ? 84 : 60} tone="dark" />
        </div>
        {first && <span aria-hidden className="absolute -top-3 left-1/2 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full bg-[hsl(var(--glow))] text-[hsl(var(--vw-ink))]"><Crown className="h-4 w-4" strokeWidth={2.4} /></span>}
      </div>
      <p className="vw-ink mt-3 max-w-full truncate text-[15px] font-bold">{l.seller_name}</p>
      <p className="vw-ink vp-num text-[15px] font-extrabold tracking-[-0.02em] sm:text-[17px]">{value}</p>
      <div className="mt-1 h-5">{mine && <span className="vr-me">Você</span>}</div>
      <div className="vr-step mt-2 w-full" data-rank={l.rank_position} style={{ height }}>
        <b aria-label={`${ordinal(l.rank_position)} lugar`}>{l.rank_position}</b>
      </div>
    </motion.li>
  );
}

export function Podium({ leaders, userId, hidden }: { leaders: Leader[]; userId: string | null | undefined; hidden: boolean }) {
  const reduce = !!useReducedMotion();
  const by = (n: number) => leaders.find((l) => l.rank_position === n);
  const order = [by(2), by(1), by(3)].filter(Boolean) as Leader[];
  return (
    <ol className="mx-auto grid max-w-[640px] grid-cols-[repeat(3,minmax(0,1fr))] items-end gap-2.5 sm:gap-5" aria-label="Os três primeiros colocados">
      {order.map((l) => (
        <Step key={`${l.rank_position}-${l.seller_name}`} l={l} mine={!!userId && l.seller_id === userId} hidden={hidden} reduce={reduce} delay={l.rank_position === 1 ? 0.2 : 0.08} />
      ))}
    </ol>
  );
}

export function Arena({ race, phase, leaders, userId, hidden, logo, participants }: {
  race: Race; phase: RacePhase; leaders: Leader[]; userId: string | null | undefined; hidden: boolean; logo?: string | null; participants: number;
}) {
  const elapsed = elapsedFraction(race, Date.now()) * 100;
  const empty = leaders.length === 0;
  return (
    <section className="vw-stage vr-arena" aria-labelledby="corrida-titulo">
      <div aria-hidden className="vw-lights">
        <div className="vw-halo" />
        <div className="vw-cone" />
        <div className="vw-beam" style={{ left: "24%", transform: "rotate(9deg)" }} />
        <div className="vw-beam" style={{ left: "64%", transform: "rotate(-8deg)", width: "8%", opacity: 0.8 }} />
      </div>
      <div className="relative z-[3] px-5 pb-0 pt-7 sm:px-9 sm:pt-9">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-end lg:gap-10">
          <div className="min-w-0">
            <span className="vr-chip" data-phase={phase}><i aria-hidden />{PHASE_LABEL[phase]}</span>
            <div className="mt-4 flex items-center gap-4">
              {logo && <img src={logo} alt="" className="h-14 w-14 shrink-0 object-contain" />}
              <h2 id="corrida-titulo" className="vw-ink min-w-0 font-heading text-[30px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[42px]">{race.title}</h2>
            </div>
            {race.description && <p className="vw-dim mt-3 max-w-[58ch] whitespace-pre-line text-[15px] leading-relaxed">{race.description}</p>}
            <div className="mt-6 max-w-[520px]">
              <div className="vw-meter" role="img" aria-label={`${Math.round(elapsed)}% do tempo da temporada`}><span style={{ width: `${elapsed}%` }} /></div>
              <div className="vw-dim mt-2.5 flex justify-between gap-4 text-[13px] font-medium">
                <span>{formatRaceDate(race.starts_at, "time")}</span>
                <span>{formatRaceDate(race.ends_at, "time")}</span>
              </div>
            </div>
          </div>
          {phase === "ended" ? (
            <div>
              <p className="vw-dim text-[14px] font-medium">Temporada encerrada</p>
              <p className="vw-ink mt-1.5 font-heading text-[24px] font-extrabold leading-tight tracking-[-0.03em]">{formatRaceDate(race.ends_at, "long")}</p>
              <p className="vw-dim mt-1.5 text-[14px]">{participants === 0 ? "Ninguém pontuou nesta temporada." : `${participants} ${participants === 1 ? "participante" : "participantes"} no ranking final.`}</p>
            </div>
          ) : (
            <Clock race={race} />
          )}
        </div>

        <div className="mt-9 sm:mt-11">
          {empty ? (
            <div className="grid place-items-center px-4 pb-14 pt-6 text-center">
              <p className="vw-ink text-[18px] font-extrabold tracking-[-0.02em]">O pódio ainda está vazio</p>
              <p className="vw-dim mt-1.5 max-w-[380px] text-[14.5px] leading-relaxed">
                {phase === "ended" ? "A temporada terminou sem vendas registradas." : phase === "upcoming" ? "O pódio aparece quando a temporada começar e as primeiras vendas forem aprovadas." : "O pódio aparece assim que as primeiras vendas aprovadas entrarem na temporada."}
              </p>
            </div>
          ) : (
            <Podium leaders={leaders} userId={userId} hidden={hidden} />
          )}
        </div>
      </div>
      <div aria-hidden className="vw-vignette" />
      <div aria-hidden className="vw-grain" />
    </section>
  );
}
