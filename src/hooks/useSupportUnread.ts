/**
 * Tracks unread support replies for the current user in real time.
 * - Sums `support_tickets.unread_by_customer` for the signed-in user.
 * - Refreshes on realtime UPDATE/INSERT to `support_tickets`.
 * - When a new staff message arrives and the user is not on /suporte,
 *   fires a toast + browser Notification (if allowed) + soft beep.
 *
 * Mount once, high in the tree, and read the count anywhere else via
 * subscribing to the same hook (React Query cache).
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { playIncomingBeep } from "@/lib/ticketAttachments";

let notificationRequested = false;
const seenMessageIds = new Set<string>();

async function maybeRequestPermission() {
  if (notificationRequested) return;
  notificationRequested = true;
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch { /* ignore */ }
  }
}

function showBrowserNotification(title: string, body: string, url: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: "/favicon.png", tag: "support-reply" });
    n.onclick = () => { window.focus(); window.location.href = url; n.close(); };
  } catch { /* ignore */ }
}

export function useSupportUnread(): number {
  const { user } = useAuth();
  const location = useLocation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.id) { setCount(0); return; }

    let cancelled = false;
    const refresh = async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("unread_by_customer")
        .eq("user_id", user.id);
      if (cancelled) return;
      const total = (data ?? []).reduce(
        (s, t: any) => s + (t.unread_by_customer ?? 0),
        0,
      );
      setCount(total);
    };

    void refresh();
    void maybeRequestPermission();

    // Realtime: refresh count on any ticket change for this user
    const ticketsChannel = (supabase as any)
      .channel(`support_unread_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${user.id}` },
        () => { void refresh(); },
      )
      .subscribe();

    // Realtime: pop toast + beep + browser notification on new staff message.
    // Filter server-side by sender_type only; we then confirm ownership via a
    // lightweight lookup because ticket_messages carries no user_id column.
    const messagesChannel = (supabase as any)
      .channel(`support_msgs_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages", filter: `sender_type=eq.staff` },
        async (payload: any) => {
          const m = payload?.new;
          if (!m?.id || seenMessageIds.has(m.id)) return;
          seenMessageIds.add(m.id);

          const { data: ticket } = await supabase
            .from("support_tickets")
            .select("id, user_id, subject")
            .eq("id", m.ticket_id)
            .maybeSingle();
          if (!ticket || ticket.user_id !== user.id) return;

          const onSupportPage = location.pathname.startsWith("/suporte");
          void refresh();
          if (onSupportPage) return; // already viewing — silent update

          const who = m.sender_name || "Equipe Venxpay";
          const preview = String(m.body || "").slice(0, 120);
          playIncomingBeep();
          toast.message(`Nova resposta: ${ticket.subject}`, {
            description: `${who} — ${preview}`,
            action: { label: "Abrir", onClick: () => { window.location.href = "/suporte"; } },
          });
          showBrowserNotification(
            `Nova resposta — ${ticket.subject}`,
            `${who}: ${preview}`,
            "/suporte",
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      (supabase as any).removeChannel(ticketsChannel);
      (supabase as any).removeChannel(messagesChannel);
    };
  }, [user?.id, location.pathname]);

  return count;
}
