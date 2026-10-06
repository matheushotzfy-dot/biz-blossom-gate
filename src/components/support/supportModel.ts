import type { Tables } from '@/integrations/supabase/types';
import type { Attachment } from '@/lib/ticketAttachments';

export type SupportTicket = Tables<'support_tickets'>;
export interface SupportMessage extends Omit<Tables<'ticket_messages'>, 'attachments'> {
  attachments: Attachment[];
}
export type SupportFilter = 'all' | 'open' | 'answered' | 'closed';
export const STATUS_MAP: Record<string, { label: string; dot: string; text: string }> = {
  open: { label: 'Aberto', dot: 'bg-warning', text: 'text-warning' },
  pending: { label: 'Aguardando', dot: 'bg-warning', text: 'text-warning' },
  in_progress: { label: 'Em andamento', dot: 'bg-primary', text: 'text-primary' },
  answered: { label: 'Respondido', dot: 'bg-primary', text: 'text-primary' },
  resolved: { label: 'Resolvido', dot: 'bg-success', text: 'text-success' },
  closed: { label: 'Fechado', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
};
export const PRIORITIES: Record<string, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
export const ROLE_LABEL: Record<string, string> = { admin: 'Equipe VENXPAY', manager: 'Gerente de suporte', employee: 'Atendente', staff: 'Suporte' };
export const HELP_CATEGORIES = [
  { label: 'Saques e financeiro', subject: 'Dúvida sobre saques e financeiro' },
  { label: 'Produtos e checkout', subject: 'Dúvida sobre produtos e checkout' },
  { label: 'Conta e segurança', subject: 'Problema com conta ou segurança' },
  { label: 'Integrações e API', subject: 'Dúvida sobre integrações ou API' },
];
export const FAQ_ITEMS = [
  { q: 'Como criar meu primeiro produto?', a: "Acesse Produtos, clique em '+', preencha nome, preço e descrição e salve. Depois configure o checkout e o conteúdo." },
  { q: 'Como solicitar um saque?', a: 'Acesse Financeiro > Saques, escolha PIX ou Cripto, informe o valor e confirme. Acompanhe o status na mesma página.' },
  { q: 'Onde consultar minhas taxas?', a: 'Consulte as condições da sua conta na área financeira. Para esclarecer uma cobrança, abra um chamado com o ID da transação.' },
  { q: 'Como falar sobre a segurança da conta?', a: 'Abra um chamado em Conta e segurança. Nunca envie senhas, códigos de autenticação ou chaves secretas na conversa.' },
  { q: 'Como melhorar meu checkout?', a: 'Revise o produto, os dados de pagamento e as opções disponíveis no editor de checkout. Para investigar uma falha, envie o ID da transação e uma captura sem dados sensíveis.' },
];
export const formatFull = (iso: string): string => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const formatTime = (iso: string): string => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
};
export function toMessage(row: Tables<'ticket_messages'>): SupportMessage {
  const attachments: Attachment[] = [];
  for (const a of Array.isArray(row.attachments) ? row.attachments : []) {
    if (typeof a === 'object' && a !== null && !Array.isArray(a) && typeof a.path === 'string' && typeof a.name === 'string' && typeof a.size === 'number' && typeof a.type === 'string') {
      attachments.push({ path: a.path, name: a.name, size: a.size, type: a.type });
    }
  }
  return { ...row, attachments };
}
