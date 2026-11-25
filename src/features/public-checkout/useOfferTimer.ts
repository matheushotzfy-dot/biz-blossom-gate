import { useEffect, useState } from "react";
import { readJson, writeJson } from "./storage";

/**
 * Contagem da oferta (configurada pelo vendedor). O fim fica guardado na sessão: recarregar a página
 * não reinicia o relógio. O tempo vem da data, não de um contador, então aba em segundo plano não desvia.
 */
export function useOfferTimer(productId: string, enabled: boolean, minutes: number): { secondsLeft: number; expired: boolean } {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) { setEndsAt(null); return; }
    const key = `vp-ck-timer:${productId}:${minutes}`;
    const saved = readJson<number>("session", key);
    const end = typeof saved === "number" && Number.isFinite(saved) ? saved : Date.now() + minutes * 60_000;
    if (end !== saved) writeJson("session", key, end);
    setEndsAt(end);
    setNow(Date.now());
  }, [enabled, productId, minutes]);

  useEffect(() => {
    if (!enabled || endsAt === null || Date.now() >= endsAt) return;
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [enabled, endsAt]);

  const secondsLeft = enabled && endsAt !== null ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : minutes * 60;
  return { secondsLeft, expired: enabled && endsAt !== null && secondsLeft === 0 };
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
