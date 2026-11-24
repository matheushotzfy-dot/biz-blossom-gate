export const SP_TZ = "America/Sao_Paulo";

/** Hora cheia (0–23) agora em São Paulo, independente do fuso do navegador. */
export function saoPauloHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: SP_TZ }).format(now)) % 24;
}
