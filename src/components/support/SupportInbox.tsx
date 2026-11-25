import { Bell, BellOff, Check, Inbox, RefreshCw, SearchX } from 'lucide-react';
import { FilterPills } from '@/components/seller-ui/FilterPills';
import { SearchField } from '@/components/seller-ui/SearchField';
import { EmptyPanel } from '@/components/seller-ui/EmptyPanel';
import { cn } from '@/lib/utils';
import type { NotifyState } from '@/hooks/useSupportUnread';
import { formatAgo, formatFull, isUnread, ticketBadge, ticketPreview, type SeenMap, type SupportFilter, type SupportTicket } from './supportModel';

export type SupportTab = 'tickets' | 'help';

export function SupportTabs({ tab, onTab, count, className }: { tab: SupportTab; onTab: (t: SupportTab) => void; count: number; className?: string }) {
  return (
    <div role="group" aria-label="Seção do suporte" className={cn('flex gap-1', className)}>
      <button type="button" className="vp-pill" aria-pressed={tab === 'tickets'} onClick={() => onTab('tickets')}>
        Chamados{count > 0 && <span className="rounded-full bg-foreground/[0.07] px-1.5 text-[12px] font-bold tabular-nums">{count}</span>}
      </button>
      <button type="button" className="vp-pill" aria-pressed={tab === 'help'} onClick={() => onTab('help')}>Central de ajuda</button>
    </div>
  );
}

export interface SupportInboxProps {
  tickets: SupportTicket[]; filtered: SupportTicket[]; counts: Record<SupportFilter, number>; seen: SeenMap | null; selectedId: string | null;
  loading: boolean; error: boolean; search: string; filter: SupportFilter; tab: SupportTab; visible: boolean; notify: NotifyState;
  onSearch: (v: string) => void; onFilter: (v: SupportFilter) => void; onSelect: (id: string) => void; onTab: (t: SupportTab) => void;
  onNew: () => void; onRetry: () => void; onEnableNotify: () => void; onClearFilters: () => void;
}

export function SupportInbox(p: SupportInboxProps) {
  const options: { value: SupportFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Todos', count: p.counts.all },
    { value: 'open', label: 'Abertos', count: p.counts.open },
    { value: 'answered', label: 'Respondidos', count: p.counts.answered },
    { value: 'closed', label: 'Encerrados', count: p.counts.closed },
  ];
  return (
    <aside aria-label="Seus chamados" className={cn('sp-inbox', p.visible ? 'flex' : 'hidden xl:flex')}>
      <div className="space-y-3.5 p-4 sm:p-5">
        <SupportTabs tab={p.tab} onTab={p.onTab} count={p.tickets.length} className="xl:hidden" />
        <div className="hidden min-h-[38px] items-center justify-between gap-3 xl:flex">
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">Chamados{p.tickets.length > 0 && <span className="ml-2 rounded-full bg-foreground/[0.07] px-2 py-0.5 text-[12px] font-bold tabular-nums text-muted-foreground">{p.tickets.length}</span>}</h2>
          {p.selectedId && <button type="button" className="vp-ghost !h-9 !px-4 !text-[13px]" onClick={() => p.onTab('help')}>Central de ajuda</button>}
        </div>
        {p.tickets.length > 0 && <SearchField value={p.search} onChange={p.onSearch} label="Buscar chamados" placeholder="Buscar por assunto ou número" />}
        {p.tickets.length > 3 && <FilterPills label="Filtrar chamados" value={p.filter} options={options} onChange={p.onFilter} />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border p-2" aria-busy={p.loading}>
        {p.loading ? (
          <div role="status" aria-label="Carregando chamados" className="space-y-1">
            {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-2.5 px-4 py-4"><span className="vp-skel block h-4 w-3/4" /><span className="vp-skel block h-3.5 w-full" /><span className="vp-skel block h-3 w-1/3" /></div>)}
          </div>
        ) : p.error ? (
          <EmptyPanel icon={<RefreshCw className="h-6 w-6" />} title="Não deu para carregar" text="Confira sua conexão e tente de novo. Seus chamados continuam salvos."
            action={<button type="button" className="vp-cta" onClick={p.onRetry}>Tentar de novo</button>} />
        ) : p.tickets.length === 0 ? (
          <EmptyPanel icon={<Inbox className="h-6 w-6" />} title="Nenhum chamado ainda" text="Procure sua dúvida na central de ajuda ou abra um chamado para falar com a equipe."
            action={<button type="button" className="vp-cta" onClick={p.onNew}>Novo chamado</button>} />
        ) : p.filtered.length === 0 ? (
          <EmptyPanel icon={<SearchX className="h-6 w-6" />} title="Nada encontrado" text="Nenhum chamado combina com a busca ou com o filtro escolhido."
            action={<button type="button" className="vp-ghost" onClick={p.onClearFilters}>Limpar filtros</button>} />
        ) : (
          <ul className="space-y-0.5">
            {p.filtered.map((t) => {
              const badge = ticketBadge(t);
              const preview = ticketPreview(t);
              const unread = p.seen ? isUnread(t, p.seen) : false;
              const when = t.last_message_at || t.created_at;
              return (
                <li key={t.id}>
                  <button type="button" className="sp-row" aria-current={p.selectedId === t.id} onClick={() => p.onSelect(t.id)}>
                    <span className="flex items-baseline gap-2">
                      <span className={cn('min-w-0 flex-1 truncate text-[15px] text-foreground', unread ? 'font-extrabold' : 'font-bold')}>{t.subject}</span>
                      <time dateTime={when} title={formatFull(when)} className={cn('shrink-0 text-[12.5px] tabular-nums', unread ? 'font-bold text-primary' : 'text-muted-foreground')}>{formatAgo(when)}</time>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="line-clamp-2 min-w-0 flex-1 text-[13.5px] leading-snug text-muted-foreground">
                        {preview.who !== 'none' && <span className="font-semibold text-foreground/80">{preview.who === 'team' ? 'Equipe: ' : 'Você: '}</span>}{preview.text}
                      </span>
                      {unread && <span className="sp-dot" role="img" aria-label="Resposta nova" />}
                    </span>
                    <span className="sp-state" data-tone={badge.tone}><i aria-hidden />{badge.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {p.notify !== 'unsupported' && (
        <div className="flex items-center gap-3 border-t border-border px-5 py-3.5">
          {p.notify === 'granted' ? <Check aria-hidden className="h-4 w-4 shrink-0 text-primary" /> : p.notify === 'denied' ? <BellOff aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Bell aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">
            {p.notify === 'granted' ? 'Avisos do navegador ligados.' : p.notify === 'denied' ? 'Avisos bloqueados. Libere nas configurações do site.' : 'Receba um aviso quando a equipe responder.'}
          </p>
          {p.notify === 'default' && <button type="button" className="vp-ghost !h-9 !px-4 !text-[13px]" onClick={p.onEnableNotify}>Ativar</button>}
        </div>
      )}
    </aside>
  );
}
