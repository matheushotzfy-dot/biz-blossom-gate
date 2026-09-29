/**
 * Realtime channel naming helper.
 *
 * Why: `supabase.channel(name)` returns the *already existing* channel when a
 * channel with the same topic is alive. If the same component/hook is mounted
 * twice (e.g. desktop header + mobile bar), the second mount calls `.on()` on a
 * channel that is already subscribed, and realtime-js throws
 * "cannot add `postgres_changes` callbacks ... after `subscribe()`", which
 * crashes the whole page through the ErrorBoundary.
 *
 * Use this ONLY for `postgres_changes` listeners (each subscriber is
 * independent). Do NOT use it for presence/broadcast channels, where every
 * participant must share the exact same topic.
 */
export function uniqueChannelName(base: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${base}-${suffix}`;
}
