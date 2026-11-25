import { describe, expect, it } from 'vitest';
import {
  CATEGORIES, FAQ_ITEMS, MESSAGE_MAX, composeTicketBody, dayLabel, filterTickets, formatAgo, groupByDay, isUnread, legacyMessages,
  linkify, markSeen, matchesQuery, mergeAttachments, messageBudget, parseSeen, searchFaq, seedSeen, splitTicketBody, ticketBadge,
  ticketCode, ticketCounts, ticketPreview, ticketStage, toMessage, unreadCount, validateNewTicket,
  type SupportTicket,
} from '@/components/support/supportModel';
import type { Tables } from '@/integrations/supabase/types';

const NOW = Date.parse('2026-11-25T15:00:00Z');
const base: SupportTicket = {
  id: '847a1c39-5a08-44ce-8996-1e273d18e93e', user_id: 'u', subject: 'Taxa do cartão', message: 'Pode revisar minha taxa?', status: 'open', priority: 'normal',
  admin_reply: null, admin_user_id: null, replied_at: null, created_at: '2026-11-20T12:00:00Z', updated_at: '2026-11-20T12:00:00Z', admin_name: null, admin_role: null,
  last_message_at: '2026-11-20T12:00:00Z', unread_by_staff: 1, unread_by_customer: 0,
};
const t = (over: Partial<SupportTicket>): SupportTicket => ({ ...base, ...over });
const row: Tables<'ticket_messages'> = { id: 'message', ticket_id: 'ticket', body: 'Olá', sender_id: 'user', sender_type: 'customer', sender_name: null, sender_role: null, created_at: '2026-10-06T12:00:00Z', read_by_customer: true, read_by_staff: true, attachments: [] };

describe('Support transcript data', () => {
  it('accepts valid attachments and ignores malformed data', () => {
    const message = toMessage({ ...row, attachments: [{ path: 'a/file.pdf', name: 'file.pdf', size: 100, type: 'application/pdf' }, null, 'invalid', { name: 'missing path' }] });
    expect(message.attachments).toEqual([{ path: 'a/file.pdf', name: 'file.pdf', size: 100, type: 'application/pdf' }]);
    expect(message.body).toBe('Olá');
  });
  it('supports legacy records with no attachments', () => { expect(toMessage(row).attachments).toEqual([]); });
  it('rebuilds a conversation from legacy tickets that have no message rows', () => {
    const list = legacyMessages(t({ admin_reply: 'Já ajustamos.', replied_at: '2026-11-21T10:00:00Z', admin_name: 'Ana', admin_role: 'admin' }));
    expect(list.map((m) => [m.sender_type, m.body])).toEqual([['customer', 'Pode revisar minha taxa?'], ['staff', 'Já ajustamos.']]);
    expect(legacyMessages(base)).toHaveLength(1);
  });
});

describe('Ticket stage', () => {
  it('waits for the team until someone answers', () => {
    expect(ticketStage(base)).toBe('waiting');
    expect(ticketBadge(base)).toEqual({ label: 'Aguardando a equipe', tone: 'wait' });
    expect(ticketBadge(t({ status: 'in_progress' }))).toEqual({ label: 'Em andamento', tone: 'info' });
  });
  it('is answered while the team spoke last', () => {
    const answered = t({ status: 'answered', replied_at: '2026-11-21T10:00:00Z', last_message_at: '2026-11-21T10:00:00Z' });
    expect(ticketStage(answered)).toBe('answered');
    expect(ticketBadge(answered)).toEqual({ label: 'Respondido', tone: 'ok' });
  });
  it('goes back to waiting when the customer writes after the reply, even though status stays "answered"', () => {
    const again = t({ status: 'answered', replied_at: '2026-11-21T10:00:00Z', last_message_at: '2026-11-21T11:30:00Z' });
    expect(ticketStage(again)).toBe('waiting');
    expect(ticketPreview(again).who).toBe('none');
  });
  it('treats a legacy answered ticket with no dates as answered', () => {
    expect(ticketStage(t({ status: 'answered', replied_at: null, last_message_at: null }))).toBe('answered');
  });
  it('closes on resolved or closed and says which', () => {
    expect(ticketStage(t({ status: 'closed' }))).toBe('done');
    expect(ticketBadge(t({ status: 'resolved' })).label).toBe('Resolvido');
    expect(ticketBadge(t({ status: 'closed' })).label).toBe('Encerrado');
  });
  it('previews the team reply, or your own message when nothing was answered', () => {
    expect(ticketPreview(t({ status: 'answered', replied_at: '2026-11-21T10:00:00Z', last_message_at: '2026-11-21T10:00:00Z', admin_reply: 'Feito!' }))).toEqual({ who: 'team', text: 'Feito!' });
    expect(ticketPreview(base)).toEqual({ who: 'you', text: 'Pode revisar minha taxa?' });
    expect(ticketPreview(t({ message: 'Categoria: Saques e financeiro\n\nMeu saque sumiu' })).text).toBe('Meu saque sumiu');
  });
});

describe('Filters and search', () => {
  const list = [
    base,
    t({ id: 'b0000000-0000-0000-0000-000000000000', subject: 'Saque pendente', status: 'answered', replied_at: '2026-11-21T10:00:00Z', last_message_at: '2026-11-21T10:00:00Z' }),
    t({ id: 'c0000000-0000-0000-0000-000000000000', subject: 'Cupom', status: 'resolved' }),
  ];
  it('counts and filters by who has the ball', () => {
    expect(ticketCounts(list)).toEqual({ all: 3, open: 1, answered: 1, closed: 1 });
    expect(filterTickets(list, 'answered', '').map((x) => x.subject)).toEqual(['Saque pendente']);
    expect(filterTickets(list, 'closed', '').map((x) => x.subject)).toEqual(['Cupom']);
  });
  it('searches every word, ignoring accents, case and the ticket number prefix', () => {
    expect(matchesQuery(base, 'TAXA cartao')).toBe(true);
    expect(matchesQuery(base, 'taxa boleto')).toBe(false);
    expect(matchesQuery(base, '#847a1c39')).toBe(true);
    expect(matchesQuery(base, '   ')).toBe(true);
    expect(filterTickets(list, 'all', 'saque')).toHaveLength(1);
  });
  it('formats the ticket number', () => { expect(ticketCode(base.id)).toBe('#847A1C39'); });
});

describe('Unread replies (server count + what this device has seen)', () => {
  const answered = t({ status: 'answered', replied_at: '2026-11-21T10:00:00Z', last_message_at: '2026-11-21T10:00:00Z', unread_by_customer: 1 });
  it('flags a reply newer than what was seen', () => {
    expect(isUnread(answered, {})).toBe(true);
    expect(isUnread(answered, { [answered.id]: '2026-11-21T10:00:00Z' })).toBe(false);
    expect(isUnread(answered, { [answered.id]: '2026-11-20T10:00:00Z' })).toBe(true);
    expect(isUnread(base, {})).toBe(false);
  });
  it('is read once the server count is cleared, even if this device never opened it', () => {
    expect(isUnread({ ...answered, unread_by_customer: 0 }, {})).toBe(false);
    expect(unreadCount([{ ...answered, unread_by_customer: 0 }], {})).toBe(0);
  });
  it('marks a reply as seen and a newer one as unread again', () => {
    const seen = markSeen({}, answered);
    expect(unreadCount([answered], seen)).toBe(0);
    expect(unreadCount([{ ...answered, replied_at: '2026-11-22T09:00:00Z', unread_by_customer: 2 }], seen)).toBe(1);
    expect(markSeen(seen, answered)).toBe(seen);
  });
  it('treats everything that exists on the first visit as already seen', () => {
    const seen = seedSeen([answered, base]);
    expect(unreadCount([answered, base], seen)).toBe(0);
  });
  it('reads the stored value defensively', () => {
    expect(parseSeen(null)).toBeNull();
    expect(parseSeen('not json')).toEqual({});
    expect(parseSeen('[1,2]')).toEqual({});
    expect(parseSeen('{"a":"2026-11-21T10:00:00Z","b":3}')).toEqual({ a: '2026-11-21T10:00:00Z' });
  });
});

describe('Ticket text', () => {
  it('puts category and reference on top and splits them back', () => {
    const body = composeTicketBody({ category: 'payouts', reference: '  saque   9f3a ', message: ' Meu saque não caiu. ' });
    expect(body).toBe('Categoria: Saques e financeiro\nReferência: saque 9f3a\n\nMeu saque não caiu.');
    expect(splitTicketBody(body)).toEqual({ category: 'Saques e financeiro', reference: 'saque 9f3a', text: 'Meu saque não caiu.' });
  });
  it('adds no header for "Outro assunto" without reference', () => {
    expect(composeTicketBody({ category: 'other', message: 'Oi, tudo bem?' })).toBe('Oi, tudo bem?');
    expect(composeTicketBody({ category: 'other', reference: 'ABC', message: 'Oi' })).toBe('Referência: ABC\n\nOi');
  });
  it('never hides text that only looks like a header', () => {
    expect(splitTicketBody('Categoria: Qualquer coisa\n\nOi')).toEqual({ category: null, reference: null, text: 'Categoria: Qualquer coisa\n\nOi' });
    expect(splitTicketBody('Categoria: Saques e financeiro\nsem linha em branco')).toEqual({ category: null, reference: null, text: 'Categoria: Saques e financeiro\nsem linha em branco' });
    expect(splitTicketBody('Olá, preciso de ajuda')).toEqual({ category: null, reference: null, text: 'Olá, preciso de ajuda' });
  });
  it('keeps the whole stored message inside the 2000 character column', () => {
    const budget = messageBudget('payouts', 'ref');
    expect(budget).toBeLessThan(MESSAGE_MAX);
    expect(composeTicketBody({ category: 'payouts', reference: 'ref', message: 'x'.repeat(budget) }).length).toBeLessThanOrEqual(MESSAGE_MAX);
    expect(messageBudget('other', '')).toBe(MESSAGE_MAX);
  });
  it('validates the new ticket form', () => {
    expect(validateNewTicket({ subject: 'ok', message: 'curta', reference: '', category: 'other' })).toEqual({ subject: expect.any(String), message: expect.any(String) });
    expect(validateNewTicket({ subject: 'Saque pendente', message: 'Meu saque de ontem não caiu.', reference: '', category: 'payouts' })).toEqual({});
    expect(validateNewTicket({ subject: 'x'.repeat(101), message: 'Mensagem longa o bastante', reference: '', category: 'other' }).subject).toMatch(/100/);
    expect(validateNewTicket({ subject: 'Assunto', message: 'x'.repeat(MESSAGE_MAX), reference: 'abc', category: 'payouts' }).message).toBeDefined();
  });
  it('turns only http(s) addresses into links and keeps trailing punctuation outside', () => {
    expect(linkify('Veja https://vemprapay.com/ajuda, ok?')).toEqual([
      { type: 'text', text: 'Veja ' }, { type: 'link', text: 'https://vemprapay.com/ajuda', href: 'https://vemprapay.com/ajuda' }, { type: 'text', text: ',' }, { type: 'text', text: ' ok?' },
    ]);
    expect(linkify('sem link')).toEqual([{ type: 'text', text: 'sem link' }]);
    expect(linkify('javascript:alert(1) e ftp://x.com').every((p) => p.type === 'text')).toBe(true);
  });
});

describe('Attachments', () => {
  const file = (name: string, size = 2000, type = '', lastModified = 1) => ({ name, size, type, lastModified });
  it('accepts images, PDF and office files, by type or extension', () => {
    expect(mergeAttachments([], [file('print.png', 5000, 'image/png'), file('nota.pdf'), file('planilha.xlsx')]).errors).toEqual([]);
    expect(mergeAttachments([], [file('colado.HEIC'), file('lista.csv')]).files).toHaveLength(2);
  });
  it('rejects unknown formats, empty and oversized files with a clear reason', () => {
    const { files, errors } = mergeAttachments([], [file('virus.exe'), file('vazio.png', 0, 'image/png'), file('grande.pdf', 6 * 1024 * 1024, 'application/pdf')]);
    expect(files).toEqual([]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/formato não aceito/);
    expect(errors[2]).toMatch(/5 MB/);
  });
  it('stops at three files and skips duplicates silently', () => {
    const a = file('a.png', 10, 'image/png');
    const merged = mergeAttachments([a], [a, file('b.png', 10, 'image/png', 2), file('c.png', 10, 'image/png', 3), file('d.png', 10, 'image/png', 4)]);
    expect(merged.files.map((f) => f.name)).toEqual(['a.png', 'b.png', 'c.png']);
    expect(merged.errors).toEqual(['Máximo de 3 arquivos por mensagem.']);
  });
});

describe('Dates', () => {
  it('shows short relative times in the list', () => {
    expect(formatAgo('2026-11-25T14:59:40Z', NOW)).toBe('agora');
    expect(formatAgo('2026-11-25T14:40:00Z', NOW)).toBe('20 min');
    expect(formatAgo('2026-11-25T12:00:00Z', NOW)).toBe('3 h');
    expect(formatAgo('2026-11-24T15:00:00Z', NOW)).toBe('ontem');
    expect(formatAgo('2026-11-10T15:00:00Z', NOW)).toMatch(/10.*nov/);
  });
  it('groups the conversation by São Paulo day', () => {
    const groups = groupByDay([
      { id: '1', created_at: '2026-11-24T15:00:00Z' }, { id: '2', created_at: '2026-11-24T20:00:00Z' }, { id: '3', created_at: '2026-11-25T13:00:00Z' },
    ], NOW);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([['Ontem', 2], ['Hoje', 1]]);
    expect(dayLabel('2026-09-12T12:00:00Z', NOW)).toMatch(/12 de setembro/);
  });
});

describe('Help center', () => {
  it('has answers for every category with real screens behind the links', () => {
    for (const c of CATEGORIES.filter((x) => x.id !== 'other')) expect(FAQ_ITEMS.some((f) => f.category === c.id)).toBe(true);
    expect(new Set(FAQ_ITEMS.map((f) => f.id)).size).toBe(FAQ_ITEMS.length);
    for (const f of FAQ_ITEMS) if (f.link) expect(f.link.to).toMatch(/^\/[a-z]/);
  });
  it('searches questions and answers, optionally inside a category', () => {
    expect(searchFaq(FAQ_ITEMS, 'chave pix', null).map((f) => f.id)).toContain('payout-pix');
    expect(searchFaq(FAQ_ITEMS, 'webhook', 'integrations').length).toBeGreaterThan(0);
    expect(searchFaq(FAQ_ITEMS, 'webhook', 'payouts')).toEqual([]);
    expect(searchFaq(FAQ_ITEMS, '', 'other')).toHaveLength(FAQ_ITEMS.length);
    expect(searchFaq(FAQ_ITEMS, 'xyzxyz', null)).toEqual([]);
  });
});
