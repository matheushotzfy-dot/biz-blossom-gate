import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Inbox, LifeBuoy, Loader2, MailOpen, MessageSquare, Search, Timer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { agoLabel } from "@/features/admin-errors/errorsModel";
import { Chip } from "@/features/admin-settings/Chip";
import { useTicketTyping } from "@/hooks/useTicketTyping";
import { playIncomingBeep } from "@/lib/ticketAttachments";
import { uniqueChannelName } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid } from "@/pages/admin/tabs/AdminPremium";
import { TicketList } from "./TicketList";
import { TicketThread } from "./TicketThread";
import { LIST_KEY, callRpc, useRefreshSupport } from "./supportAdminApi";
import { FILTER_PILLS, PAGE_SIZE, durationLabel, emptyCopy, parseSupportPage, type FilterKey } from "./supportAdminModel";

// o seller vê "Equipe está digitando"; o nome de quem digita não precisa ir junto
const TYPING_ME = { role: "staff" as const, name: "Equipe" };

/** Chamados dos sellers. Vê quem é admin ou tem a permissão de suporte; responder pede também a permissão de responder. */
export default function SupportCenter({ isAdmin = true, hasSupportAccess = false }: { isAdmin?: boolean; hasSupportAccess?: boolean }) {
  if (!isAdmin && !hasSupportAccess) return <PremiumEmpty icon={LifeBuoy} title="Você não tem acesso ao suporte" subtitle="Peça ao administrador a permissão “Ver suporte”." />;
  return <Center />;
}

function Center() {
  const refresh = useRefreshSupport();
  const [filter, setFilter] = useState<FilterKey>("waiting");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // um rascunho (e seus arquivos) por chamado: trocar de conversa não leva o texto de uma para a outra
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [draftFiles, setDraftFiles] = useState<Record<string, File[]>>({});
  const openRef = useRef<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  openRef.current = selectedId;

  const q = useQuery({
    queryKey: [...LIST_KEY, filter, debounced, page],
    queryFn: async () => parseSupportPage(await callRpc("get_admin_support_page", { _filter: filter, _search: debounced || null, _page: page, _page_size: PAGE_SIZE })),
    placeholderData: keepPreviousData,
  });

  const { others, notifyTyping } = useTicketTyping(selectedId, TYPING_ME);

  // mensagem nova, resposta de outro atendente, chamado aberto: atualiza, mas espera a rajada passar
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(timer); timer = setTimeout(refresh, 800); };
    const ch = supabase.channel(uniqueChannelName("admin-support-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, (payload) => {
        const row = (payload as { new?: { sender_type?: string; ticket_id?: string } }).new;
        if (row?.sender_type === "customer" && row.ticket_id === openRef.current) playIncomingBeep();
        bump();
      })
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prog = q.data?.program ?? null;
  const rows = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const counts = q.data?.counts;

  useEffect(() => { if (q.data && rows.length === 0 && page > 1) setPage(1); }, [q.data, rows.length, page]);

  const searching = !!debounced;
  const filtersActive = searching || filter !== "waiting";
  const clear = () => { setSearch(""); setFilter("waiting"); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";

  const heroStatus = !prog ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : prog.waiting > 0 ? { tone: "warning" as const, label: `${prog.waiting.toLocaleString("pt-BR")} ${prog.waiting === 1 ? "chamado aguarda" : "chamados aguardam"} a equipe`, pulse: true }
      : prog.total === 0 ? { tone: "neutral" as const, label: "Nenhum chamado ainda" }
        : { tone: "success" as const, label: "Tudo respondido" };

  const pills = useMemo(() => FILTER_PILLS.map((p) => ({ ...p, count: counts ? counts[p.value] : null })), [counts]);
  const empty = emptyCopy(filter, searching, (prog?.total ?? 0) > 0);

  // ao abrir uma conversa, o painel sobe para ocupar a tela: a conversa e o campo de resposta aparecem inteiros
  const pick = (id: string) => {
    setSelectedId(id);
    requestAnimationFrame(() => panel.current?.scrollIntoView?.({ block: "start", behavior: "smooth" }));
  };
  const setDraft = (v: string) => { if (selectedId) setDrafts((d) => ({ ...d, [selectedId]: v })); };
  const setFiles = (f: File[]) => { if (selectedId) setDraftFiles((d) => ({ ...d, [selectedId]: f })); };

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader eyebrow="Sistema" title="Suporte" status={heroStatus}
        subtitle="Os chamados que os sellers abrem no painel. A resposta chega para eles na hora, com aviso, e o chamado volta para a fila quando o seller escreve de novo." />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Clock} label="Aguardando a equipe" value={n(prog?.waiting)} tone={prog && prog.waiting > 0 ? "warning" : undefined}
          sub={prog ? (prog.waiting_since ? `mais antigo ${agoLabel(prog.waiting_since)}` : "nenhum esperando") : pending} />
        <PremiumMetric icon={MailOpen} label="Mensagens sem ler" value={n(prog?.unread)} tone={prog && prog.unread > 0 ? "info" : undefined}
          sub={prog ? (prog.unread_tickets > 0 ? `em ${prog.unread_tickets.toLocaleString("pt-BR")} ${prog.unread_tickets === 1 ? "chamado" : "chamados"}` : "tudo lido") : pending} />
        <PremiumMetric icon={AlertTriangle} label="Urgentes abertos" value={n(prog?.urgent)} tone={prog && prog.urgent > 0 ? "destructive" : undefined}
          sub={prog ? (prog.urgent > 0 ? "pedem prioridade" : "nenhum urgente") : pending} />
        <PremiumMetric icon={Timer} label="Primeira resposta" value={prog ? (prog.median_first_reply_seconds === null ? "—" : durationLabel(prog.median_first_reply_seconds)) : "—"}
          sub={prog ? (prog.reply_sample > 0 ? `mediana, 30 dias` : "sem respostas em 30 dias") : pending} />
      </PremiumMetricGrid>

      <div ref={panel} className="grid scroll-mt-3 grid-cols-[minmax(0,1fr)] gap-4 lg:h-[max(560px,calc(100dvh-6.25rem))] lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
        <section aria-label="Lista de chamados" className={cn("flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-border/60 bg-card", selectedId && "hidden lg:flex")}>
          <div className="shrink-0 space-y-3 border-b border-border/60 p-3.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Buscar chamados" placeholder="Seller, assunto ou código" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
                className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
            </div>
            <div role="group" aria-label="Situação do chamado" className="flex flex-wrap gap-1.5">
              {pills.map((p) => (
                <Chip key={p.value} active={filter === p.value} onClick={() => { setFilter(p.value); setPage(1); }} className="!h-8 !px-3 !text-[12.5px]">
                  {p.label}{p.count !== null ? ` · ${p.count.toLocaleString("pt-BR")}` : ""}
                </Chip>
              ))}
            </div>
            {filtersActive && <Button type="button" variant="ghost" size="sm" className="-ml-2 h-7 gap-1 text-[12.5px]" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {q.isError && !q.isFetching ? (
              <div className="p-4"><ErrorBlock title="Não foi possível carregar os chamados." error={q.error} onRetry={() => void q.refetch()} /></div>
            ) : q.isPending ? (
              <p className="flex items-center gap-2 p-6 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando os chamados…</p>
            ) : rows.length === 0 ? (
              <PremiumEmpty icon={Inbox} title={empty.title} subtitle={empty.subtitle} />
            ) : (
              <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
                <TicketList rows={rows} selectedId={selectedId} onSelect={pick} />
              </div>
            )}
          </div>

          {total > PAGE_SIZE && (
            <div className="shrink-0 border-t border-border/60 px-3 py-2"><AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} /></div>
          )}
        </section>

        <section aria-label="Conversa" className={cn("flex h-[calc(100dvh-8rem)] min-h-[520px] min-w-0 flex-col overflow-hidden rounded-[16px] border border-border/60 bg-card lg:h-auto", !selectedId && "hidden lg:flex")}>
          {selectedId ? (
            <TicketThread key={selectedId} id={selectedId} draft={drafts[selectedId] ?? ""} files={draftFiles[selectedId] ?? []} onDraft={setDraft} onFiles={setFiles}
              typing={others.length > 0} onTyping={notifyTyping} onBack={() => setSelectedId(null)} onOpen={pick} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
              <span aria-hidden className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground"><MessageSquare className="h-5 w-5" /></span>
              <p className="text-[15px] font-semibold text-foreground">Escolha um chamado</p>
              <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground">A conversa abre aqui, com o contexto do seller e o campo para responder.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
