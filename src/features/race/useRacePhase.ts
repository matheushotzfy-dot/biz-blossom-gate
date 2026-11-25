import { useEffect, useState } from "react";
import { racePhase, type Race, type RacePhase } from "./raceMeta";

const MAX_TIMEOUT = 2_147_000_000; // setTimeout estoura acima de ~24,8 dias

/** Fase da temporada. Só renderiza de novo nas viradas (começou, terminou), não a cada segundo. */
export function useRacePhase(race: Pick<Race, "starts_at" | "ends_at"> | null): RacePhase {
  const [now, setNow] = useState(() => Date.now());
  const start = race ? Date.parse(race.starts_at) : NaN;
  const end = race ? Date.parse(race.ends_at) : NaN;

  useEffect(() => {
    if (!race) return;
    const at = Date.now();
    const next = [start, end].filter((t) => Number.isFinite(t) && t > at).sort((a, b) => a - b)[0];
    if (!next) return; // sem mais viradas (já encerrou): nada a agendar
    const id = setTimeout(() => setNow(Date.now()), Math.min(next - at + 50, MAX_TIMEOUT));
    return () => clearTimeout(id);
  }, [race, start, end, now]);

  // `now` só existe para disparar a nova renderização na virada; a fase sai do relógio do momento.
  void now;
  return race ? racePhase(race, Date.now()) : "live";
}
