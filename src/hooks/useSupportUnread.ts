/**
 * Avisos de resposta do suporte.
 * - `useSupportUnread()`: quantos chamados têm resposta da equipe que ainda não foi aberta (menu lateral).
 * - `useSupportAlerts()`: montado uma vez no painel; escuta mensagens novas da equipe e avisa com toast, som e
 *   notificação do navegador quando a pessoa não está olhando aquela conversa.
 * O navegador só é perguntado sobre notificações quando a pessoa pede (botão na tela de Suporte).
 */
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/hooks/useAuth";
import { playIncomingBeep } from "@/lib/ticketAttachments";
import { unreadCount, type SupportTicket } from "@/components/support/supportModel";
import { useSeedSeen, useSeen } from "@/components/support/supportStore";
import { supportListKey, useSupportList } from "@/components/support/useSupportList";

let activeTicket: string | null = null;
/** A tela de Suporte avisa qual conversa está aberta, para não apitar por algo que a pessoa já está vendo. */
export function setActiveSupportTicket(id: string | null): void { activeTicket = id; }

const seenMessageIds = new Set<string>();

export type NotifyState = "unsupported" | "default" | "granted" | "denied";
export function notifyState(): NotifyState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as NotifyState;
}
export async function askNotifyPermission(): Promise<NotifyState> {
  if (typeof Notification === "undefined") return "unsupported";
  try { await Notification.requestPermission(); } catch { /* ignora */ }
  return notifyState();
}

function showBrowserNotification(title: string, body: string, onOpen: () => void) {
  if (notifyState() !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: "/favicon.png", tag: "support-reply" });
    n.onclick = () => { window.focus(); onOpen(); n.close(); };
  } catch { /* ignora */ }
}

export function useSupportUnread(): number {
  const { user } = useAuth();
  const list = useSupportList(user?.id);
  const seen = useSeen(user?.id);
  useSeedSeen(user?.id, list.data, seen);
  return seen && list.data ? unreadCount(list.data, seen) : 0;
}

export function useSupportAlerts(): void {
  const { user } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const path = useRef(pathname);
  path.current = pathname;
  const go = useRef(navigate);
  go.current = navigate;
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    const refresh = () => { void client.invalidateQueries({ queryKey: supportListKey(userId) }); };

    const tickets = supabase
      .channel(uniqueChannelName(`support_unread_${userId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${userId}` }, refresh)
      .subscribe();

    // O realtime já respeita as políticas de acesso: só chegam mensagens de chamados do próprio usuário.
    const messages = supabase
      .channel(uniqueChannelName(`support_msgs_${userId}`))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: "sender_type=eq.staff" }, async (payload) => {
        const m = payload.new as { id?: string; ticket_id?: string; sender_name?: string | null; body?: string };
        if (!m?.id || !m.ticket_id || seenMessageIds.has(m.id)) return;
        seenMessageIds.add(m.id);
        refresh();

        const viewing = path.current.startsWith("/suporte") && activeTicket === m.ticket_id;
        if (viewing) return;

        const cached = client.getQueryData<SupportTicket[]>(supportListKey(userId))?.find((t) => t.id === m.ticket_id);
        let subject = cached?.subject;
        if (!subject) {
          const { data } = await supabase.from("support_tickets").select("subject, user_id").eq("id", m.ticket_id).maybeSingle();
          if (!data || data.user_id !== userId) return;
          subject = data.subject;
        }
        const who = m.sender_name || "Equipe Vemprapay";
        const preview = String(m.body || "").slice(0, 120);
        const open = () => go.current("/suporte");
        playIncomingBeep();
        toast.message(`Nova resposta: ${subject}`, { description: `${who}: ${preview}`, action: { label: "Abrir", onClick: open } });
        showBrowserNotification(`Nova resposta: ${subject}`, `${who}: ${preview}`, open);
      })
      .subscribe();

    return () => { void supabase.removeChannel(tickets); void supabase.removeChannel(messages); };
  }, [userId, client]);
}
