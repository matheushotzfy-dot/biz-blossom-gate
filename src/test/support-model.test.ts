import { describe, expect, it } from 'vitest';
import { toMessage, STATUS_MAP } from '@/components/support/supportModel';
import type { Tables } from '@/integrations/supabase/types';
const row: Tables<'ticket_messages'> = { id: 'message', ticket_id: 'ticket', body: 'Olá', sender_id: 'user', sender_type: 'customer', sender_name: null, sender_role: null, created_at: '2026-10-06T12:00:00Z', read_by_customer: true, read_by_staff: false, attachments: null };
describe('Support transcript data', () => {
  it('accepts valid attachments and ignores malformed data', () => {
    const message = toMessage({ ...row, attachments: [{ path: 'a/file.pdf', name: 'file.pdf', size: 100, type: 'application/pdf' }, null, 'invalid', { name: 'missing path' }] });
    expect(message.attachments).toEqual([{ path: 'a/file.pdf', name: 'file.pdf', size: 100, type: 'application/pdf' }]);
    expect(message.body).toBe('Olá');
  });
  it('supports legacy records with no attachments', () => { expect(toMessage(row).attachments).toEqual([]); });
  it('uses semantic status colors only', () => { expect(Object.values(STATUS_MAP).every(s => !/amber-|blue-|emerald-|red-/.test(s.dot + s.text))).toBe(true); });
});
