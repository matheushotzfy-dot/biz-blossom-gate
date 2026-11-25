import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uniqueChannelName } from '@/lib/realtime';
import { toast } from 'sonner';
import { discardAttachments, playIncomingBeep, uploadTicketAttachments, type Attachment } from '@/lib/ticketAttachments';
import { setActiveSupportTicket } from '@/hooks/useSupportUnread';
import {
  composeTicketBody, legacyMessages, toMessage, validateNewTicket,
  type CategoryId, type SupportMessage, type SupportTicket,
} from './supportModel';
import { recordSeen, useSeedSeen, useSeen } from './supportStore';
import { supportListKey, useSupportList } from './useSupportList';

export interface NewTicket { subject: string; message: string; category: CategoryId; reference: string; priority: string }

export function useSupportTickets(userId: string | undefined) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const operation = useRef(false);
  const clearedOnServer = useRef(new Set<string>());
  const listKey = supportListKey(userId);
  const list = useSupportList(userId);
  const tickets = list.data ?? [];
  const seen = useSeen(userId);
  useSeedSeen(userId, list.data, seen);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;
  const activeId = selected?.id ?? null;
  const threadKey = ['support-messages', userId, activeId];
  const thread = useQuery<SupportMessage[]>({
    queryKey: threadKey, enabled: Boolean(userId && activeId), staleTime: 15_000, retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_messages').select('*').eq('ticket_id', activeId ?? '').order('created_at');
      if (error) throw error;
      return data.map(toMessage);
    },
  });

  // Se o chamado aberto sumir da lista (outra aba, outro aparelho), volta para a ajuda.
  useEffect(() => { if (selectedId && list.isSuccess && !selected) setSelectedId(null); }, [selectedId, selected, list.isSuccess]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(uniqueChannelName(`support_list_${userId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: `user_id=eq.${userId}` }, () => { void client.invalidateQueries({ queryKey: supportListKey(userId) }); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, client]);

  // Abrir (ou receber uma resposta com o chamado aberto) conta como ler.
  const repliedAt = selected?.replied_at ?? null;
  useEffect(() => { if (userId && activeId) recordSeen(userId, { id: activeId, replied_at: repliedAt }); }, [userId, activeId, repliedAt]);
  useEffect(() => { setActiveSupportTicket(activeId); return () => setActiveSupportTicket(null); }, [activeId]);
  const unreadOnServer = selected?.unread_by_customer ?? 0;
  useEffect(() => {
    // Melhor esforço: o banco só aceita isso de quem tem permissão; o "visto" local é o que vale para o vendedor.
    if (!userId || !activeId || unreadOnServer <= 0 || clearedOnServer.current.has(activeId)) return;
    clearedOnServer.current.add(activeId);
    void supabase.from('support_tickets').update({ unread_by_customer: 0 }).eq('id', activeId).eq('user_id', userId).then(() => undefined);
  }, [userId, activeId, unreadOnServer]);

  useEffect(() => {
    if (!activeId || !userId) return;
    const channel = supabase.channel(uniqueChannelName(`ticket_${activeId}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${activeId}` }, (payload) => {
        const incoming = toMessage(payload.new as Parameters<typeof toMessage>[0]);
        client.setQueryData<SupportMessage[]>(['support-messages', userId, activeId], (old) => (old?.some((m) => m.id === incoming.id) ? old : [...(old ?? []), incoming]));
        void client.invalidateQueries({ queryKey: ['support-messages', userId, activeId] });
        if (incoming.sender_type === 'staff') playIncomingBeep();
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeId, userId, client]);

  const messages = thread.data && thread.data.length ? thread.data : selected && thread.isSuccess ? legacyMessages(selected) : thread.data ?? [];

  const sendReply = async (body: string, files: File[]): Promise<boolean> => {
    const text = body.trim();
    if (!userId || !selected || operation.current || (!text && !files.length)) return false;
    operation.current = true; setSending(true);
    const ticketId = selected.id;
    let attachments: Attachment[] = [];
    try {
      try { attachments = await uploadTicketAttachments(ticketId, files); }
      catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível enviar os anexos.'); return false; }
      const { data, error } = await supabase.from('ticket_messages').insert({ ticket_id: ticketId, sender_id: userId, sender_type: 'customer', body: text || '(anexo)', attachments }).select().single();
      if (error) { await discardAttachments(attachments); throw error; }
      client.setQueryData<SupportMessage[]>(['support-messages', userId, ticketId], (old) => (old?.some((m) => m.id === data.id) ? old : [...(old && old.length ? old : legacyMessages(selected)), toMessage(data)]));
      client.setQueryData<SupportTicket[]>(listKey, (old) => old?.map((t) => (t.id === ticketId ? { ...t, last_message_at: data.created_at, status: t.status === 'closed' || t.status === 'resolved' ? 'open' : t.status } : t)));
      void client.invalidateQueries({ queryKey: listKey });
      return true;
    } catch { toast.error('Não foi possível enviar a mensagem. O texto continua aí, é só tentar de novo.'); return false; }
    finally { operation.current = false; setSending(false); }
  };

  /** Devolve o id do chamado criado, ou null se não foi possível. */
  const createTicket = async (input: NewTicket, files: File[]): Promise<string | null> => {
    if (!userId || operation.current) return null;
    if (Object.keys(validateNewTicket({ ...input, category: input.category })).length) { toast.error('Revise os campos do chamado.'); return null; }
    operation.current = true; setSubmitting(true);
    try {
      const body = composeTicketBody({ category: input.category, reference: input.reference, message: input.message });
      const { data, error } = await supabase.from('support_tickets').insert({ user_id: userId, subject: input.subject.trim().slice(0, 100), message: body, priority: input.priority }).select().single();
      if (error) throw error;
      let attachments: Attachment[] = [];
      try { attachments = await uploadTicketAttachments(data.id, files); }
      catch { toast.error('Chamado aberto, mas os anexos não foram enviados. Anexe de novo dentro da conversa.'); }
      const first = await supabase.from('ticket_messages').insert({ ticket_id: data.id, sender_id: userId, sender_type: 'customer', body: data.message, attachments }).select().single();
      if (first.error) { await discardAttachments(attachments); toast.error('Chamado aberto. Se a mensagem não aparecer na conversa, escreva de novo por lá.'); }
      else client.setQueryData<SupportMessage[]>(['support-messages', userId, data.id], [toMessage(first.data)]);
      client.setQueryData<SupportTicket[]>(listKey, (old) => [data, ...(old ?? [])]);
      void client.invalidateQueries({ queryKey: listKey });
      setSelectedId(data.id);
      toast.success('Chamado aberto. A equipe responde por aqui.');
      return data.id;
    } catch { toast.error('Não foi possível abrir o chamado. Tente novamente.'); return null; }
    finally { operation.current = false; setSubmitting(false); }
  };

  return {
    tickets, seen, selected, selectedId: activeId, select: setSelectedId, messages,
    loading: list.isPending, listError: list.isError && !list.data, reloadList: () => { void list.refetch(); },
    loadingThread: thread.isLoading, threadError: thread.isError, reloadThread: () => { void thread.refetch(); },
    sending, submitting, sendReply, createTicket,
  };
}
