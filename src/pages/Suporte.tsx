import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTicketTyping } from '@/hooks/useTicketTyping';
import { Seo } from '@/components/Seo';
import { SupportInbox } from '@/components/support/SupportInbox';
import { SupportConversation } from '@/components/support/SupportConversation';
import { SupportDialogs } from '@/components/support/SupportDialogs';
import { useSupportTickets } from '@/components/support/useSupportTickets';
import type { SupportFilter } from '@/components/support/supportModel';
import { MAX_FILES_PER_MESSAGE, MAX_FILE_SIZE_MB } from '@/lib/ticketAttachments';
import { toast } from 'sonner';
import { Headphones, Plus, CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Suporte() {
  const { user } = useAuth();
  const support = useSupportTickets(user?.id);
  const [reply, setReply] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normal');
  const [composerFiles, setComposerFiles] = useState<File[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SupportFilter>('all');
  const [showFaq, setShowFaq] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const identity = useMemo(() => user ? { role: 'customer' as const, name: user.email?.split('@')[0] || 'Cliente' } : null, [user]);
  const { others, notifyTyping } = useTicketTyping(support.selectedId, identity);
  const filtered = useMemo(() => support.tickets.filter(ticket => {
    const status = filter === 'all' || (filter === 'open' && ['open', 'pending', 'in_progress'].includes(ticket.status)) || (filter === 'answered' && ticket.status === 'answered') || (filter === 'closed' && ['closed', 'resolved'].includes(ticket.status));
    const query = search.trim().toLowerCase();
    return status && (!query || `${ticket.subject} ${ticket.message}`.toLowerCase().includes(query));
  }), [support.tickets, filter, search]);
  const addFiles = (incoming: FileList | null, current: File[], setter: (files: File[]) => void) => {
    const files = [...current];
    for (const file of Array.from(incoming ?? [])) {
      if (files.length >= MAX_FILES_PER_MESSAGE) { toast.error(`Máximo de ${MAX_FILES_PER_MESSAGE} arquivos.`); break; }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { toast.error(`"${file.name}" excede ${MAX_FILE_SIZE_MB}MB.`); continue; }
      if (!files.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) files.push(file);
    }
    setter(files);
  };
  const chooseTicket = (id: string) => { if (!support.sending) { support.setSelectedId(id); setReply(''); setReplyFiles([]); } };
  const openCategory = (value: string) => { setSubject(value); setShowFaq(false); setShowComposer(true); };
  const send = async () => { if (await support.sendReply(reply, replyFiles)) { setReply(''); setReplyFiles([]); } };
  const create = async () => {
    if (await support.createTicket(subject, message, priority, composerFiles)) { setShowComposer(false); setSubject(''); setMessage(''); setPriority('normal'); setComposerFiles([]); }
  };
  return <div className="support-surface flex min-h-0 flex-1 flex-col bg-background">
    <Seo title="Suporte | Vemprapay" description="Seus chamados e conversas com a equipe Vemprapay." path="/suporte" noindex />
    <header className="support-toolbar flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-7">
      <div className="flex items-center gap-3"><Headphones className="h-5 w-5 text-primary" /><h1 className="text-lg font-semibold md:text-xl">Central de suporte</h1></div>
      <div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Perguntas frequentes" title="Perguntas frequentes" onClick={() => setShowFaq(true)}><CircleHelp className="h-5 w-5" /></Button><Button className="h-10 rounded-md px-3 md:px-4" onClick={() => setShowComposer(true)}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Novo chamado</span><span className="sm:hidden">Novo</span></Button></div>
    </header>
    <div className="support-workspace overflow-hidden bg-card">
      <SupportInbox tickets={support.tickets} filtered={filtered} selectedId={support.selectedId} loading={support.loading} search={search} filter={filter} onSearch={setSearch} onFilter={setFilter} onSelect={chooseTicket} onNew={() => setShowComposer(true)} onHelp={() => setShowFaq(true)} />
      <SupportConversation ticket={support.selected} messages={support.messages} loading={support.loadingThread} reply={reply} files={replyFiles} sending={support.sending} typing={others} endRef={support.endRef} onBack={() => { if (!support.sending) { support.setSelectedId(null); setReply(''); setReplyFiles([]); } }} onReply={value => { setReply(value); notifyTyping(); }} onFiles={setReplyFiles} onAddFiles={files => addFiles(files, replyFiles, setReplyFiles)} onSend={send} />
    </div>
    <SupportDialogs showFaq={showFaq} onFaq={setShowFaq} openFaq={openFaq} onOpenFaq={setOpenFaq} showComposer={showComposer} onComposer={setShowComposer} subject={subject} onSubject={setSubject} message={message} onMessage={setMessage} priority={priority} onPriority={setPriority} files={composerFiles} onFiles={setComposerFiles} onAddFiles={files => addFiles(files, composerFiles, setComposerFiles)} submitting={support.submitting} onSubmit={create} onCategory={openCategory} />
  </div>;
}
