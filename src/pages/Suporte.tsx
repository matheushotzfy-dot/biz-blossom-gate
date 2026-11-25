import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Seo } from '@/components/Seo';
import { PageHead } from '@/components/seller-ui/PageHead';
import { useAuth } from '@/hooks/useAuth';
import { useTicketTyping } from '@/hooks/useTicketTyping';
import { askNotifyPermission, notifyState, type NotifyState } from '@/hooks/useSupportUnread';
import { SupportInbox, type SupportTab } from '@/components/support/SupportInbox';
import { SupportConversation } from '@/components/support/SupportConversation';
import { SupportHelp } from '@/components/support/SupportHelp';
import { SupportComposer } from '@/components/support/SupportComposer';
import { useSupportTickets } from '@/components/support/useSupportTickets';
import {
  CATEGORIES, EMPTY_DRAFT, categoryById, filterTickets, isUnread, mergeAttachments, ticketCounts,
  type CategoryId, type ComposerDraft, type SupportFilter,
} from '@/components/support/supportModel';
import '@/components/support/support.css';

export default function Suporte() {
  const { user } = useAuth();
  const support = useSupportTickets(user?.id);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<SupportTab>('tickets');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SupportFilter>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft>(EMPTY_DRAFT);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [replyFiles, setReplyFiles] = useState<Record<string, File[]>>({});
  const [notify, setNotify] = useState<NotifyState>(() => notifyState());

  const identity = useMemo(() => (user ? { role: 'customer' as const, name: String(user.user_metadata?.full_name || '').split(' ')[0] || user.email?.split('@')[0] || 'Cliente' } : null), [user]);
  const { others, notifyTyping } = useTicketTyping(support.selectedId, identity);

  const filtered = useMemo(() => filterTickets(support.tickets, filter, search), [support.tickets, filter, search]);
  const counts = useMemo(() => ticketCounts(support.tickets), [support.tickets]);
  const unread = useMemo(() => (support.seen ? support.tickets.filter((t) => isUnread(t, support.seen!)) : []), [support.tickets, support.seen]);

  const id = support.selectedId;
  const reply = id ? replies[id] ?? '' : '';
  const files = id ? replyFiles[id] ?? [] : [];

  const { select } = support;
  const openTicket = useCallback((ticketId: string) => { select(ticketId); setTab('tickets'); }, [select]);
  const openComposer = useCallback((prefill?: { category?: CategoryId; subject?: string }) => {
    if (prefill) {
      const cat = categoryById(prefill.category ?? 'other');
      setDraft((d) => ({ ...d, category: cat?.id ?? 'other', subject: prefill.subject || (d.subject.trim() ? d.subject : cat?.subject ?? '') }));
    }
    setComposerOpen(true);
  }, []);

  // Links de outras telas: /suporte?novo=account abre o formulário já no assunto; /suporte?chamado=<id> abre a conversa.
  useEffect(() => {
    const novo = params.get('novo');
    const chamado = params.get('chamado');
    if (!novo && !chamado) return;
    if (novo) openComposer({ category: CATEGORIES.some((c) => c.id === novo) ? (novo as CategoryId) : 'other' });
    if (chamado && support.tickets.some((t) => t.id === chamado)) openTicket(chamado);
    if (novo || !support.loading) setParams({}, { replace: true });
  }, [params, setParams, openComposer, openTicket, support.tickets, support.loading]);

  const pickTab = (next: SupportTab) => { setTab(next); if (next === 'help') support.select(null); };
  const addFiles = (incoming: File[], current: File[], apply: (files: File[]) => void) => {
    const merged = mergeAttachments(current, incoming);
    if (merged.errors.length) toast.error(merged.errors.join(' '));
    apply(merged.files);
  };

  const changeStatus = async (status: 'resolved' | 'open') => {
    const ticket = support.selected;
    if (!ticket) return;
    const ok = await support.setStatus(ticket.id, status);
    if (!ok) return;
    if (status === 'open') { toast.success('Chamado reaberto.'); return; }
    toast.success('Chamado marcado como resolvido.', { action: { label: 'Desfazer', onClick: () => { void support.setStatus(ticket.id, 'open'); } } });
  };

  const send = async () => {
    if (!id) return;
    const ok = await support.sendReply(reply, files);
    if (ok) { setReplies((r) => ({ ...r, [id]: '' })); setReplyFiles((f) => ({ ...f, [id]: [] })); }
  };
  const create = async () => {
    const created = await support.createTicket({ subject: draft.subject, message: draft.message, category: draft.category, reference: draft.reference, priority: draft.priority }, draft.files);
    if (created) { setComposerOpen(false); setDraft(EMPTY_DRAFT); setTab('tickets'); setSearch(''); setFilter('all'); }
  };
  const enableNotify = async () => {
    const state = await askNotifyPermission();
    setNotify(state);
    if (state === 'denied') toast.error('O navegador bloqueou os avisos. Libere nas configurações do site para ligar.');
  };

  const showPaneNarrow = Boolean(support.selected) || tab === 'help';

  return (
    <div className="sp-page">
      <Seo title="Suporte | Vemprapay" description="Seus chamados e conversas com a equipe Vemprapay." path="/suporte" noindex />
      <div className={support.selected ? 'hidden xl:block' : undefined}>
        <PageHead title="Suporte" subtitle="Tire dúvidas ou fale com a equipe."
          actions={<button type="button" className="vp-cta" onClick={() => openComposer()}><Plus className="h-[18px] w-[18px]" />Novo chamado</button>} />
      </div>

      <div className="sp-shell vp-sheet">
        <SupportInbox tickets={support.tickets} filtered={filtered} counts={counts} seen={support.seen} selectedId={support.selectedId}
          loading={support.loading} error={support.listError} search={search} filter={filter} tab={tab} visible={!showPaneNarrow} notify={notify}
          onSearch={setSearch} onFilter={setFilter} onSelect={openTicket} onTab={pickTab} onNew={() => openComposer()} onRetry={support.reloadList}
          onEnableNotify={() => { void enableNotify(); }} onClearFilters={() => { setSearch(''); setFilter('all'); }} />

        {support.selected ? (
          <SupportConversation key={support.selected.id} ticket={support.selected} messages={support.messages} loading={support.loadingThread} error={support.threadError} visible
            reply={reply} files={files} sending={support.sending} typing={others}
            onBack={() => { if (!support.sending) support.select(null); }} onRetry={support.reloadThread}
            onReply={(v) => setReplies((r) => ({ ...r, [support.selected!.id]: v }))} onTyping={notifyTyping}
            onFiles={(next) => setReplyFiles((f) => ({ ...f, [support.selected!.id]: next }))}
            onAddFiles={(incoming) => addFiles(incoming, files, (next) => setReplyFiles((f) => ({ ...f, [support.selected!.id]: next })))}
            onSend={() => { void send(); }} statusBusy={support.changingStatus} onStatus={(status) => { void changeStatus(status); }} />
        ) : (
          <SupportHelp visible={showPaneNarrow} tab={tab} ticketCount={support.tickets.length} unread={unread} onTab={pickTab} onOpenTicket={openTicket} onNew={openComposer} />
        )}
      </div>

      <SupportComposer open={composerOpen} draft={draft} submitting={support.submitting} onOpenChange={setComposerOpen} onChange={setDraft}
        onAddFiles={(incoming) => addFiles(incoming, draft.files, (next) => setDraft((d) => ({ ...d, files: next })))}
        onSubmit={() => { void create(); }} onClear={() => setDraft(EMPTY_DRAFT)} />
    </div>
  );
}
