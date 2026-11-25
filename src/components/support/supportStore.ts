import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { markSeen, parseSeen, seedSeen, type SeenMap, type SupportTicket } from './supportModel';

/* "Visto" das respostas da equipe, guardado neste aparelho (a coluna do banco não pode ser zerada pelo cliente).
   Fica por conta, então outra pessoa no mesmo navegador não herda o que a primeira viu. */

const EVENT = 'vp-support-seen';
const storageKey = (userId: string) => `vp-support-seen:${userId}`;

function read(userId: string): string | null {
  try { return window.localStorage.getItem(storageKey(userId)); } catch { return null; }
}
function write(userId: string, map: SeenMap): void {
  try { window.localStorage.setItem(storageKey(userId), JSON.stringify(map)); } catch { /* sem armazenamento: o aviso só não persiste */ }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(EVENT, callback); };
}

/** `null` = este aparelho ainda não registrou nada (ou não há armazenamento). */
export function useSeen(userId: string | undefined): SeenMap | null {
  const raw = useSyncExternalStore(subscribe, () => (userId ? read(userId) : null), () => null);
  return useMemo(() => parseSeen(raw), [raw]);
}

/** Primeira visita: tudo que já existe conta como visto. */
export function useSeedSeen(userId: string | undefined, tickets: SupportTicket[] | undefined, seen: SeenMap | null): void {
  useEffect(() => {
    if (userId && tickets && seen === null && read(userId) === null) write(userId, seedSeen(tickets));
  }, [userId, tickets, seen]);
}

export function recordSeen(userId: string, ticket: Pick<SupportTicket, 'id' | 'replied_at'>): void {
  const current = parseSeen(read(userId)) ?? {};
  const next = markSeen(current, ticket);
  if (next !== current) write(userId, next);
}
