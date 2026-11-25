import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, LifeBuoy, MessageCircle, SearchX, ShieldCheck } from 'lucide-react';
import { SearchField } from '@/components/seller-ui/SearchField';
import { EmptyPanel } from '@/components/seller-ui/EmptyPanel';
import { cn } from '@/lib/utils';
import { CATEGORIES, FAQ_ITEMS, searchFaq, type CategoryId, type SupportTicket } from './supportModel';
import { SupportTabs, type SupportTab } from './SupportInbox';
import { CATEGORY_ICON } from './categoryIcons';

export interface SupportHelpProps {
  visible: boolean; tab: SupportTab; ticketCount: number; unread: SupportTicket[];
  onTab: (t: SupportTab) => void; onOpenTicket: (id: string) => void; onNew: (prefill?: { category?: CategoryId; subject?: string }) => void;
}

export function SupportHelp(p: SupportHelpProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const items = useMemo(() => searchFaq(FAQ_ITEMS, query, category), [query, category]);
  const picked = CATEGORIES.find((c) => c.id === category);
  const newest = p.unread[0];

  return (
    <section aria-label="Central de ajuda" className={cn('sp-pane overflow-y-auto', p.visible ? 'flex' : 'hidden xl:flex')}>
      <div className="mx-auto w-full max-w-[820px] space-y-8 px-4 py-6 sm:px-8 sm:py-9">
        <SupportTabs tab={p.tab} onTab={p.onTab} count={p.ticketCount} className="xl:hidden" />

        <header>
          <h2 className="font-heading text-[26px] font-extrabold leading-[1.1] tracking-[-0.035em] text-foreground sm:text-[32px]">Como podemos ajudar?</h2>
          <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-muted-foreground">Procure a resposta em segundos. Se não achar, abra um chamado: a equipe responde por aqui e avisa você.</p>
          <SearchField className="mt-5" value={query} onChange={setQuery} label="Buscar na central de ajuda" placeholder="Busque por saque, taxa, checkout, verificação…" />
        </header>

        {newest && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-[18px] bg-accent p-4 text-accent-foreground">
            <span className="sp-dot" aria-hidden />
            <p className="min-w-0 flex-1 text-[14.5px] font-semibold">{p.unread.length === 1 ? `A equipe respondeu “${newest.subject}”.` : `Você tem ${p.unread.length} respostas novas da equipe.`}</p>
            <button type="button" className="vp-cta !h-10 !px-5 !text-[13.5px]" onClick={() => p.onOpenTicket(newest.id)}>Ver resposta</button>
          </div>
        )}

        <div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">Sobre o que é a sua dúvida?</h3>
          <div className="mt-3.5 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
            {CATEGORIES.filter((c) => c.id !== 'other').map((c) => {
              const Icon = CATEGORY_ICON[c.id];
              return (
                <button key={c.id} type="button" className="sp-tile" aria-pressed={category === c.id} onClick={() => { setCategory(category === c.id ? null : c.id); setOpen(null); }}>
                  <span className="sp-tile-icon"><Icon className="h-[18px] w-[18px]" /></span>
                  <span className="text-[14.5px] font-bold leading-tight text-foreground">{c.label}</span>
                </button>
              );
            })}
            <button type="button" className="sp-tile" data-action onClick={() => p.onNew(picked ? { category: picked.id } : undefined)}>
              <span className="sp-tile-icon"><MessageCircle className="h-[18px] w-[18px]" /></span>
              <span className="text-[14.5px] font-bold leading-tight text-foreground">Falar com a equipe<span className="mt-0.5 block text-[13px] font-medium text-muted-foreground">Abrir um chamado</span></span>
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">{picked ? picked.label : 'Perguntas frequentes'}</h3>
            {(category || query) && <button type="button" className="text-[13.5px] font-semibold text-primary hover:underline" onClick={() => { setCategory(null); setQuery(''); }}>Ver todas</button>}
          </div>
          {items.length === 0 ? (
            <div className="vp-sheet mt-3.5">
              <EmptyPanel icon={<SearchX className="h-6 w-6" />} title="Não achamos essa dúvida" text="Conte o que aconteceu e a equipe responde por aqui."
                action={<button type="button" className="vp-cta" onClick={() => p.onNew({ category: category ?? 'other', subject: query.trim().slice(0, 100) })}>Abrir chamado</button>} />
            </div>
          ) : (
            <ul className="vp-sheet mt-3.5 divide-y divide-border overflow-hidden">
              {items.map((item) => {
                const expanded = open === item.id;
                return (
                  <li key={item.id}>
                    <button type="button" className="sp-faq-q" aria-expanded={expanded} aria-controls={`faq-${item.id}`} onClick={() => setOpen(expanded ? null : item.id)}>
                      <span className="text-[15px] font-semibold leading-snug text-foreground">{item.q}</span>
                      <ChevronDown aria-hidden className="h-5 w-5" />
                    </button>
                    {expanded && (
                      <div id={`faq-${item.id}`} className="px-5 pb-5 pt-0.5">
                        <p className="max-w-[62ch] text-[14.5px] leading-relaxed text-muted-foreground">{item.a}</p>
                        {item.link && <Link to={item.link.to} className="vp-ghost mt-3.5 !h-10 !text-[13.5px]">{item.link.label}<ArrowRight className="h-4 w-4" /></Link>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="vp-sheet flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><LifeBuoy className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-extrabold tracking-[-0.02em] text-foreground">Não resolveu?</p>
            <p className="mt-0.5 text-[14px] leading-relaxed text-muted-foreground">Abra um chamado com o que aconteceu. Prints e IDs de venda ou saque ajudam a equipe a responder mais rápido.</p>
          </div>
          <button type="button" className="vp-cta shrink-0" onClick={() => p.onNew(picked ? { category: picked.id } : undefined)}>Novo chamado</button>
        </div>

        <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          A equipe da Vemprapay nunca pede senha, código de verificação ou chave secreta. Não envie esses dados em nenhum chamado.
        </p>
      </div>
    </section>
  );
}
