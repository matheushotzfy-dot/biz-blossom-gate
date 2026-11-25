import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupportTicket } from './supportModel';

export const supportListKey = (userId: string | undefined) => ['support-tickets', userId] as const;

/** Chamados do usuário, do mais recente para o mais antigo. Compartilhado pela página, pelo menu e pelo aviso de resposta. */
export function useSupportList(userId: string | undefined) {
  return useQuery<SupportTicket[]>({
    queryKey: supportListKey(userId),
    enabled: Boolean(userId),
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from('support_tickets').select('*').eq('user_id', userId)
        .order('last_message_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
}
