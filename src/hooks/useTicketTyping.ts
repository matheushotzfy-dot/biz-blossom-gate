/**
 * Realtime "typing…" indicator for a single support ticket.
 *
 * Uses Supabase Realtime **presence** on a per-ticket channel — no DB writes,
 * no extra table. Each participant tracks `{ role, name }` while actively
 * typing; state auto-clears 3s after the last keystroke (or on unmount).
 *
 * Returns:
 *  - `others`: array of other participants currently typing
 *  - `notifyTyping()`: call on every keystroke; the hook debounces the "stop"
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "customer" | "staff";

type Presence = { role: Role; name: string; typing: boolean; at: number };

export function useTicketTyping(
  ticketId: string | null,
  me: { role: Role; name: string } | null,
) {
  const [others, setOthers] = useState<Presence[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);

  // Stable identity key so participants can be deduped in presence state
  const key = useMemo(
    () => (me ? `${me.role}-${crypto.randomUUID()}` : null),
    [me?.role, me?.name, ticketId],
  );

  useEffect(() => {
    if (!ticketId || !me || !key) {
      setOthers([]);
      return;
    }
    const channel = supabase.channel(`ticket_typing_${ticketId}`, {
      config: { presence: { key } },
    });

    const syncFromState = () => {
      const state = channel.presenceState() as Record<string, Presence[]>;
      const flat: Presence[] = [];
      for (const [k, arr] of Object.entries(state)) {
        if (k === key) continue;
        for (const p of arr) if (p?.typing) flat.push(p);
      }
      setOthers(flat);
    };

    channel
      .on("presence", { event: "sync" }, syncFromState)
      .on("presence", { event: "join" }, syncFromState)
      .on("presence", { event: "leave" }, syncFromState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            role: me.role, name: me.name, typing: false, at: Date.now(),
          } as Presence);
        }
      });

    channelRef.current = channel;
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      isTypingRef.current = false;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [ticketId, key]);

  const notifyTyping = () => {
    const ch = channelRef.current;
    if (!ch || !me) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      ch.track({ role: me.role, name: me.name, typing: true, at: Date.now() } as Presence).catch(() => {});
    }
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = window.setTimeout(() => {
      isTypingRef.current = false;
      ch.track({ role: me.role, name: me.name, typing: false, at: Date.now() } as Presence).catch(() => {});
    }, 3000);
  };

  return { others, notifyTyping };
}
