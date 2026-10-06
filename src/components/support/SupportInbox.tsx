import { Inbox, Plus, Search, CircleHelp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STATUS_MAP, formatTime, type SupportTicket, type SupportFilter } from './supportModel';
export interface SupportInboxProps {
  tickets: SupportTicket[]; filtered: SupportTicket[]; selectedId: string | null; loading: boolean;
  search: string; filter: SupportFilter; onSearch: (v: string) => void; onFilter: (v: SupportFilter) => void;
  onSelect: (id: string) => void; onNew: () => void; onHelp: () => void;
}
export function SupportInbox(p: SupportInboxProps) {
  const tabs: { value: SupportFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Todos', count: p.tickets.length },
    { value: 'open', label: 'Abertos', count: p.tickets.filter(t => ['open', 'pending', 'in_progress'].includes(t.status)).length },
    { value: 'answered', label: 'Respondidos', count: p.tickets.filter(t => t.status === 'answered').length },
    { value: 'closed', label: 'Fechados', count: p.tickets.filter(t => ['closed', 'resolved'].includes(t.status)).length },
  ];
  return <aside aria-label="Caixa de entrada" className={cn('support-inbox flex min-h-0 flex-col bg-card', p.selectedId && 'hidden md:flex')}>
    <div className="space-y-4 px-4 pb-3 pt-5">
      <div className="flex items-center justify-between gap-2"><h1 className="text-xl font-semibold">Suporte<span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">{p.tickets.length}</span></h1>
        <div className="flex gap-1"><Button variant="ghost" size="icon" title="Perguntas frequentes" aria-label="Perguntas frequentes" className="h-8 w-8" onClick={p.onHelp}><CircleHelp /></Button><Button size="icon" title="Novo chamado" aria-label="Novo chamado" className="h-8 w-8 rounded-md" onClick={p.onNew}><Plus /></Button></div></div>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label="Buscar chamados" value={p.search} onChange={e => p.onSearch(e.target.value)} placeholder="Buscar chamados…" className="h-10 w-full rounded-md border border-border bg-muted pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
      <div className="grid grid-cols-2 gap-1" aria-label="Filtrar chamados">{tabs.map(tab => <Button key={tab.value} variant="ghost" onClick={() => p.onFilter(tab.value)} aria-pressed={p.filter === tab.value} className={cn('h-7 justify-between rounded-md px-2 text-[11px]', p.filter === tab.value && 'bg-accent text-primary')}><span>{tab.label}</span><span className="font-mono text-[10px] text-muted-foreground">{tab.count}</span></Button>)}</div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-border p-2">
      {p.loading ? <div className="flex justify-center p-8" role="status" aria-label="Carregando chamados"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : p.filtered.length === 0 ? <div className="px-4 py-10 text-center text-muted-foreground"><Inbox className="mx-auto mb-3 h-6 w-6" /><p className="text-sm">{p.tickets.length ? 'Nenhum chamado encontrado.' : 'Nenhum chamado ainda.'}</p>{!p.tickets.length && <Button variant="link" onClick={p.onNew}>Novo chamado</Button>}</div> : p.filtered.map(t => {
        const status = STATUS_MAP[t.status] ?? STATUS_MAP.open;
        return <Button key={t.id} variant="ghost" aria-pressed={p.selectedId === t.id} onClick={() => p.onSelect(t.id)} className={cn('support-ticket mb-1 flex h-auto w-full flex-col items-stretch gap-1.5 whitespace-normal rounded-lg border border-transparent px-3 py-3 text-left', p.selectedId === t.id && 'border-input bg-accent')}>
          <span className="flex items-center gap-1.5"><span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} /><span className={cn('text-[10px] font-medium', status.text)}>{status.label}</span><time dateTime={t.last_message_at || t.created_at} className="ml-auto font-mono text-[10px] text-muted-foreground">{formatTime(t.last_message_at || t.created_at)}</time></span>
          <span className="flex min-w-0 items-center gap-2"><span className="truncate text-[13px] font-semibold text-foreground">{t.subject}</span>{t.unread_by_customer > 0 && <span aria-label="Mensagem não lida" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}</span>
          <span className="line-clamp-2 text-xs font-normal leading-relaxed text-muted-foreground">{t.admin_reply || t.message}</span>
        </Button>;
      })}
    </div>
    <div className="border-t border-border px-4 py-3"><Button variant="ghost" size="sm" className="h-8 w-full justify-start px-0 text-xs" onClick={p.onHelp}><CircleHelp />Ajuda e documentação</Button></div>
  </aside>;
}
