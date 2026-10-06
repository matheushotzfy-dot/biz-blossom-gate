import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uniqueChannelName } from '@/lib/realtime';
import { toast } from 'sonner';
import { playIncomingBeep, uploadTicketAttachments, type Attachment } from '@/lib/ticketAttachments';
import { toMessage, type SupportMessage, type SupportTicket } from './supportModel';

export function useSupportTickets(userId: string | undefined) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const operation = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const listKey = ['support-tickets', userId];
  const list = useQuery({ queryKey: listKey, enabled: Boolean(userId), staleTime: 30000, queryFn: async () => {
    if (!userId) return [];
    const { data, error } = await supabase.from('support_tickets').select('*').eq('user_id', userId).order('last_message_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  } });
  const tickets = list.data ?? [];
  // Desktop opens the newest conversation; mobile keeps its compact list until a ticket is chosen.
  const effectiveId = selectedId ?? (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches ? tickets[0]?.id ?? null : null);
  const selected = tickets.find(t => t.id === effectiveId);
  const threadKey = ['support-messages', userId, effectiveId];
  const thread = useQuery({ queryKey: threadKey, enabled: Boolean(userId && effectiveId), staleTime: 15000, queryFn: async () => {
    const { data, error } = await supabase.from('ticket_messages').select('*').eq('ticket_id', effectiveId ?? '').order('created_at');
    if (error) throw error;
    return data.map(toMessage);
  } });
  useEffect(() => { if (list.error) toast.error('Não foi possível carregar seus chamados.'); }, [list.error]);
  useEffect(() => { if (thread.error) toast.error('Não foi possível carregar a conversa.'); }, [thread.error]);
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(uniqueChannelName(`support_list_${userId}`)).on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets', filter: `user_id=eq.${userId}` }, () => { void client.invalidateQueries({ queryKey: ['support-tickets', userId] }); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, client]);
  useEffect(() => {
    if (!effectiveId || !userId) return;
    void supabase.from('support_tickets').update({ unread_by_customer: 0 }).eq('id', effectiveId).eq('user_id', userId).then(({ error }) => {
      if (!error) client.setQueryData<SupportTicket[]>(['support-tickets', userId], old => old?.map(t => t.id === effectiveId ? { ...t, unread_by_customer: 0 } : t));
    });
    const channel = supabase.channel(uniqueChannelName(`ticket_${effectiveId}`)).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${effectiveId}` }, payload => {
      const incoming = toMessage(payload.new as Parameters<typeof toMessage>[0]);
      client.setQueryData<SupportMessage[]>(['support-messages', userId, effectiveId], old => old?.some(m => m.id === incoming.id) ? old : [...(old ?? []), incoming]);
      void client.invalidateQueries({ queryKey: ['support-messages', userId, effectiveId] });
      if (incoming.sender_type === 'staff') playIncomingBeep();
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [effectiveId, userId, client]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [effectiveId, thread.data]);
  const sendReply = async (body: string, files: File[]): Promise<boolean> => {
    if (!userId || !effectiveId || operation.current || (body.trim().length < 2 && !files.length)) return false;
    operation.current = true; setSending(true);
    try {
      const attachments = await uploadTicketAttachments(effectiveId, files);
      const { data, error } = await supabase.from('ticket_messages').insert({ ticket_id: effectiveId, sender_id: userId, sender_type: 'customer', body: body.trim() || '(anexo)', attachments }).select().single();
      if (error) throw error;
      client.setQueryData<SupportMessage[]>(threadKey, old => old?.some(m => m.id === data.id) ? old : [...(old ?? []), toMessage(data)]);
      await client.invalidateQueries({ queryKey: listKey });
      return true;
    } catch { toast.error('Não foi possível enviar a resposta. Tente novamente.'); return false; }
    finally { operation.current = false; setSending(false); }
  };
  const createTicket = async (subject: string, message: string, priority: string, files: File[]): Promise<boolean> => {
    if (!userId || operation.current) return false;
    if (subject.trim().length < 3 || message.trim().length < 10) { toast.error('Informe assunto e mensagem completos.'); return false; }
    operation.current = true; setSubmitting(true);
    try {
      const { data, error } = await supabase.from('support_tickets').insert({ user_id: userId, subject: subject.trim().slice(0, 100), message: message.trim().slice(0, 2000), priority }).select().single();
      if (error) throw error;
      let attachments: Attachment[] = [];
      try { attachments = await uploadTicketAttachments(data.id, files); } catch { toast.error('Chamado aberto, mas os anexos não foram enviados. Adicione-os na conversa.'); }
      const initial = await supabase.from('ticket_messages').insert({ ticket_id: data.id, sender_id: userId, sender_type: 'customer', body: data.message, attachments });
      if (initial.error) toast.error('Chamado salvo. A mensagem inicial será exibida a partir do chamado.');
      client.setQueryData<SupportTicket[]>(listKey, old => [data, ...(old ?? [])]);
      setSelectedId(data.id); void client.invalidateQueries({ queryKey: listKey });
      toast.success('Chamado aberto.'); return true;
    } catch { toast.error('Não foi possível abrir o chamado.'); return false; }
    finally { operation.current = false; setSubmitting(false); }
  };
  return { tickets, selected, selectedId: effectiveId, setSelectedId, messages: thread.data ?? [], loading: list.isLoading, loadingThread: thread.isLoading, endRef, sending, submitting, sendReply, createTicket };
}
