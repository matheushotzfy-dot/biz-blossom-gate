import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bell, Clock, Eye, Inbox, Loader2, Megaphone, Search, Send, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { agoLabel, dayLabel, sizeLabel } from "@/features/admin-errors/errorsModel";
import { Chip } from "@/features/admin-settings/Chip";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { AvisoSheet } from "./AvisoSheet";
import { CleanDialog } from "./CleanDialog";
import { ComposeDialog } from "./ComposeDialog";
import { AllList, AvisosList } from "./NotificationsList";
import { NOTIFS_KEY, callRpc, useRefreshNotifications } from "./notificationsApi";
import { BIG_TABLE_BYTES, PAGE_SIZE, VIEW_PILLS, parseNotificationsPage, readPct, typeInfo, type AvisoItem, type ViewKey } from "./notificationsModel";

/** Avisos para os sellers e tudo o que o sistema avisou a eles. Só administrador. */
export default function NotificationsCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={Bell} title="Os avisos aos sellers são do administrador" subtitle="Peça ao administrador para mandar um aviso." />;
  return <Center />;
}

function Center() {
  const refresh = useRefreshNotifications();
  const [view, setView] = useState<ViewKey>("avisos");
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: [...NOTIFS_KEY, view, view === "todas" ? type : "all", debounced, page],
    queryFn: async () => parseNotificationsPage(await callRpc("get_admin_notifications_page", {
      _view: view, _type: view === "todas" && type !== "all" ? type : null, _search: debounced || null, _page: page, _page_size: PAGE_SIZE,
    })),
    placeholderData: keepPreviousData,
  });

  // chegou venda nova, o seller leu um aviso, alguém recolheu: atualiza, mas espera a rajada passar
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase.channel(uniqueChannelName("admin-notifications-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => { clearTimeout(timer); timer = setTimeout(refresh, 1500); })
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prog = q.data?.program ?? null;
  const total = q.data?.total ?? 0;
  const typeCounts = q.data?.types ?? {};
  const rows = q.data?.view === view ? (view === "avisos" ? q.data.avisos : q.data.todas) : [];
  const seed: AvisoItem | null = useMemo(() => (q.data?.avisos ?? []).find((a) => a.batch_id === openId) ?? null, [q.data, openId]);

  useEffect(() => { if (q.data && rows.length === 0 && page > 1) setPage(1); }, [q.data, rows.length, page]);

  const filtersActive = !!debounced || (view === "todas" && type !== "all");
  const clear = () => { setSearch(""); setType("all"); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";
  const readPctAll = prog && prog.avisos_rows > 0 ? readPct(prog.avisos_read, prog.avisos_rows) : null;

  const heroStatus = !prog ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : prog.size_bytes >= BIG_TABLE_BYTES ? { tone: "warning" as const, label: `Registro grande: ${sizeLabel(prog.size_bytes)}` }
      : prog.avisos > 0 ? { tone: "info" as const, label: `${prog.avisos.toLocaleString("pt-BR")} ${prog.avisos === 1 ? "aviso enviado" : "avisos enviados"}` }
        : { tone: "neutral" as const, label: "Nenhum aviso enviado ainda" };

  const pills = useMemo(() => VIEW_PILLS.map((p) => ({
    ...p, label: prog ? `${p.label} · ${(p.value === "avisos" ? prog.avisos : prog.total).toLocaleString("pt-BR")}` : p.label,
  })), [prog]);
  // só os tipos que existem nesta busca (mais o escolhido, para ele poder ser desligado)
  const typeChips = useMemo(() => Object.entries(typeCounts).filter(([, c]) => c > 0 || false)
    .sort((a, b) => b[1] - a[1] || typeInfo(a[0]).label.localeCompare(typeInfo(b[0]).label, "pt-BR"))
    .concat(type !== "all" && !(type in typeCounts) ? [[type, 0] as [string, number]] : []), [typeCounts, type]);

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader eyebrow="Sistema" title="Notificações" status={heroStatus}
        subtitle="Os avisos que você manda aos sellers e tudo o que o sistema avisa a eles, como venda aprovada e saque pago. Tudo aparece no sino do painel de cada um."
        actions={<Button type="button" size="sm" className="gap-1.5" onClick={() => setComposing(true)}><Send className="h-3.5 w-3.5" /> Novo aviso</Button>} />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Megaphone} label="Avisos enviados" value={n(prog?.avisos)}
          sub={prog ? (prog.last_sent ? `último ${agoLabel(prog.last_sent)}` : "nenhum ainda") : pending} />
        <PremiumMetric icon={Eye} label="Leitura dos avisos" value={prog ? (readPctAll === null ? "—" : `${readPctAll}%`) : "—"}
          tone={readPctAll !== null && readPctAll < 50 ? "warning" : readPctAll !== null ? "success" : undefined}
          sub={prog ? (prog.avisos_rows > 0 ? `${prog.avisos_read.toLocaleString("pt-BR")} de ${prog.avisos_rows.toLocaleString("pt-BR")}` : "sem avisos") : pending} />
        <PremiumMetric icon={Inbox} label="Notificações guardadas" value={n(prog?.total)} tone={prog && prog.size_bytes >= BIG_TABLE_BYTES ? "warning" : undefined}
          sub={prog ? `${sizeLabel(prog.size_bytes)} no banco` : pending} />
        <PremiumMetric icon={Clock} label="Nas últimas 24 h" value={n(prog?.last_24h)} sub={prog ? `${prog.unread.toLocaleString("pt-BR")} não lidas` : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Notificações" icon={Bell}>
        <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          {view === "avisos"
            ? "Cada aviso vira uma notificação na caixa de cada seller que o recebeu. Um aviso recolhido some de todas as caixas."
            : "Aqui estão também as notificações automáticas (venda aprovada, saque, análise de cadastro, disputa) de todas as contas, só para consulta."}
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <PremiumSegmented<ViewKey> value={view} onChange={(v) => { setView(v); setType("all"); setPage(1); }} options={pills} />
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar notificações" placeholder={view === "avisos" ? "Título ou texto do aviso" : "Texto, nome ou e-mail do seller"} value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>
        {view === "todas" && (
          <div role="group" aria-label="Tipo de notificação" className="mb-4 flex flex-wrap gap-2">
            <Chip active={type === "all"} onClick={() => { setType("all"); setPage(1); }} className="!h-9 px-3.5 text-[13px]">Todos os tipos</Chip>
            {typeChips.map(([t, c]) => (
              <Chip key={t} active={type === t} onClick={() => { setType(t); setPage(1); }} className="!h-9 px-3.5 text-[13px]">{typeInfo(t).label} · {c.toLocaleString("pt-BR")}</Chip>
            ))}
          </div>
        )}

        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar as notificações." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando as notificações…</p>
        ) : rows.length === 0 ? (
          <div>
            {filtersActive ? (
              <>
                <PremiumEmpty icon={Bell} title="Nada por aqui" subtitle="Nenhuma notificação bate com esses filtros." />
                <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>
              </>
            ) : view === "avisos" ? (
              <>
                <PremiumEmpty icon={Megaphone} title="Nenhum aviso enviado ainda" subtitle="Quando você mandar um aviso aos sellers, ele aparece aqui com quem já leu." />
                <div className="-mt-8 pb-6 text-center"><Button type="button" size="sm" className="gap-1.5" onClick={() => setComposing(true)}><Send className="h-3.5 w-3.5" /> Escrever o primeiro aviso</Button></div>
              </>
            ) : (
              <PremiumEmpty icon={Inbox} title="Nenhuma notificação guardada" subtitle="As notificações automáticas e os avisos aparecem aqui assim que alguém receber a primeira." />
            )}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            {view === "avisos" ? <AvisosList rows={q.data!.avisos} onOpen={(a) => setOpenId(a.batch_id)} /> : <AllList rows={q.data!.todas} />}
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <PremiumPanel title="Limpeza" icon={Trash2}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
            {prog
              ? <>Cada venda, saque e análise vira uma notificação. Hoje são {prog.total.toLocaleString("pt-BR")}, ocupando {sizeLabel(prog.size_bytes)}{prog.oldest ? `, a mais antiga de ${dayLabel(prog.oldest)}` : ""}. Nada é apagado sozinho: {prog.read_old.toLocaleString("pt-BR")} já foram lidas há mais de 30 dias. As que o seller ainda não abriu nunca são apagadas aqui.</>
              : "As notificações já lidas podem ser apagadas daqui. As que o seller ainda não abriu ficam."}
          </p>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!prog || prog.read === 0} onClick={() => setCleaning(true)}
            title={prog && prog.read === 0 ? "Não há notificações lidas para apagar." : undefined}>
            <Trash2 className="h-3.5 w-3.5" /> Apagar lidas
          </Button>
        </div>
      </PremiumPanel>

      <AvisoSheet batchId={openId} seed={seed} onClose={() => setOpenId(null)} />
      <ComposeDialog open={composing} onClose={() => setComposing(false)} />
      <CleanDialog open={cleaning} onClose={() => setCleaning(false)} readOld={prog?.read_old ?? 0} readAll={prog?.read ?? 0} />
    </div>
  );
}
