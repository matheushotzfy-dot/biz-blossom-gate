/**
 * sessionStorage/localStorage podem lançar (modo privado, cota cheia, bloqueio de cookies).
 * O checkout nunca pode quebrar por isso: sem armazenamento ele só perde a conveniência.
 */
type Kind = "session" | "local";

function area(kind: Kind): Storage | null {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(kind: Kind, key: string): T | null {
  try {
    const raw = area(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(kind: Kind, key: string, value: unknown): void {
  try {
    area(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    /* sem armazenamento: segue sem lembrar */
  }
}

export function removeKey(kind: Kind, key: string): void {
  try {
    area(kind)?.removeItem(key);
  } catch {
    /* idem */
  }
}
