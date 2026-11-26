import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCheck, Clock, Loader2, Search, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useConfirm } from "@/components/seller-ui/confirm";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { Chip } from "@/features/admin-settings/Chip";
import { friendlyError } from "@/lib/friendlyError";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { DeleteDialog } from "./DeleteDialog";
import { ERRORS_KEY, callRpc, useRefreshErrors, useSetResolved } from "./errorsApi";
import { ErrorsCards, ErrorsTable } from "./ErrorsList";
import { ErrorSheet } from "./ErrorSheet";
import {
  AREAS, PAGE_SIZE, STATUS_PILLS, agoLabel, areaInfo, dayLabel, parseErrorsPage, resolveAllText, sizeLabel,
  type AreaFilter, type ErrItem, type StatusFilter,
} from "./errorsModel";

/** Erros que o site mostrou para vendedores, alunos e compradores. Só administrador. */
export default function ErrorsCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={AlertTriangle} title="Os erros do site são do administrador" subtitle="Peça ao administrador para revisar um erro." />;
  return <Center />;
}

function Center() {
  const refresh = useRefreshErrors();
  const set = useSetResolved();
  const confirm = useConfirm();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [area, setArea] = useState<AreaFilter>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resolvingAll, setResolvingAll] = useState(false);

  const q = useQuery({
    queryKey: [...ERRORS_KEY, status, area, debounced, page],
    queryFn: async () => parseErrorsPage(await callRpc("get_admin_error_logs_page", { _status: status, _area: area === "all" ? null : area, _search: debounced || null, _page: page, _page_size: PAGE_SIZE })),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const ch = supabase.channel(uniqueChannelName("admin-error-logs-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "error_logs" }, () => refresh())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const s = q.data?.summary;
  const prog = q.data?.program ?? null;
  const areaCounts = q.data?.areas ?? {};
  const seed: ErrItem | null = useMemo(() => items.find((i) => i.id === openId) ?? null, [items, openId]);

  // resolver o último erro de uma página deixa a página vazia: volta para a primeira
  useEffect(() => { if (q.data && q.data.items.length === 0 && page > 1) setPage(1); }, [q.data, page]);

  const filtersActive = status !== "open" || area !== "all" || !!debounced;
  const clear = () => { setStatus("open"); setArea("all"); setSearch(""); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";

  const heroStatus = !prog ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : prog.open > 0 ? { tone: "warning" as const, label: `${prog.open.toLocaleString("pt-BR")} ${prog.open === 1 ? "erro aberto" : "erros abertos"}`, pulse: true }
      : prog.total === 0 ? { tone: "neutral" as const, label: "Nenhum erro registrado" }
        : { tone: "success" as const, label: "Nenhum erro aberto" };

  const pills = useMemo(() => STATUS_PILLS.map((p) => ({ ...p, label: s ? `${p.label} · ${s[p.value].toLocaleString("pt-BR")}` : p.label })), [s]);
  // só as partes do site que têm erro nesta visão (mais a escolhida, para ela poder ser desligada)
  const areaChips = useMemo(() => AREAS.filter((a) => (areaCounts[a.value] ?? 0) > 0 || a.value === area), [areaCounts, area]);

  const noOpenHere = status === "open" && area !== "all" && (areaCounts[area] ?? 0) === 0;
  const canResolveAll = !!prog && prog.open > 0 && !noOpenHere;

  const resolveAll = async () => {
    const ok = await confirm.ask({
      title: resolveAllText(area, prog?.open ?? 0), tone: "warning", icon: <CheckCheck className="h-5 w-5" />, confirmLabel: "Marcar como resolvidos",
      description: "Isso só marca os erros como vistos, não corrige a causa de nenhum. Se um deles voltar a acontecer, ele reabre sozinho. Fica na auditoria.",
    });
    if (!ok) return;
    setResolvingAll(true);
    try {
      const out = (await callRpc("admin_resolve_all_errors", { _area: area === "all" ? null : area })) as { resolved?: number } | null;
      const c = Number(out?.resolved ?? 0);
      toast.success(`${c.toLocaleString("pt-BR")} ${c === 1 ? "erro marcado como resolvido" : "erros marcados como resolvidos"}.`);
      refresh();
    } catch (e) { toast.error(friendlyError(e, "Não foi possível resolver os erros. Nada mudou.")); }
    finally { setResolvingAll(false); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader eyebrow="Sistema" title="Error Logs" status={heroStatus}
        subtitle="Erros que o site mostrou para vendedores, alunos e compradores. O mesmo erro repetido vira uma linha só, com a contagem de vezes, e um erro resolvido que volta a acontecer reabre sozinho." />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={AlertTriangle} label="Abertos" value={n(prog?.open)} tone={prog && prog.open > 0 ? "warning" : prog ? "success" : undefined}
          sub={prog ? (prog.open > 0 ? `${prog.occurrences_open.toLocaleString("pt-BR")} ocorrências` : "nenhum aberto") : pending} />
        <PremiumMetric icon={Clock} label="Na última hora" value={n(prog?.seen_last_hour)} tone={prog && prog.seen_last_hour > 0 ? "info" : undefined}
          sub={prog ? `hoje: ${prog.seen_today.toLocaleString("pt-BR")}` : pending} />
        <PremiumMetric icon={Users} label="Contas afetadas" value={n(prog?.affected_users)} sub={prog ? "no mínimo" : pending} />
        <PremiumMetric icon={AlertTriangle} label="Aberto há mais tempo" value={prog ? (prog.oldest_open ? agoLabel(prog.oldest_open) : "—") : "—"}
          sub={prog ? (prog.oldest_open ? `desde ${dayLabel(prog.oldest_open)}` : "nada aberto") : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Erros registrados" icon={AlertTriangle}
        action={<Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={!canResolveAll || resolvingAll} onClick={() => void resolveAll()}>
          {resolvingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />} Resolver abertos
        </Button>}>
        <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          Só chegam aqui erros que o navegador captura (tela que quebrou, erro no código da página). Falhas de pagamento e erros das funções do servidor não são gravados nesta tela.
          Quem não estava logado aparece como visitante.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <PremiumSegmented<StatusFilter> value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={pills} />
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar erros" placeholder="Mensagem, página, nome ou e-mail" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>
        <div role="group" aria-label="Parte do site" className="mb-4 flex flex-wrap gap-2">
          <Chip active={area === "all"} onClick={() => { setArea("all"); setPage(1); }} className="!h-9 px-3.5 text-[13px]">Todas as partes</Chip>
          {areaChips.map((a) => (
            <Chip key={a.value} active={area === a.value} onClick={() => { setArea(a.value); setPage(1); }} className="!h-9 px-3.5 text-[13px]">
              {a.label} · {(areaCounts[a.value] ?? 0).toLocaleString("pt-BR")}
            </Chip>
          ))}
        </div>

        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar os erros." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando os erros…</p>
        ) : items.length === 0 ? (
          <div>
            {filtersActive ? (
              <>
                <PremiumEmpty icon={AlertTriangle} title="Nada por aqui" subtitle="Nenhum erro bate com esses filtros." />
                <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>
              </>
            ) : prog && prog.total > 0 ? (
              <>
                <PremiumEmpty icon={CheckCheck} title="Nenhum erro aberto" subtitle="Tudo o que o site registrou já foi resolvido. Se um erro voltar a acontecer, ele aparece aqui de novo." />
                <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={() => { setStatus("resolved"); setPage(1); }}>Ver resolvidos</Button></div>
              </>
            ) : (
              <PremiumEmpty icon={CheckCheck} title="Nenhum erro registrado ainda" subtitle="Quando uma tela do site quebrar para alguém, o erro aparece aqui." />
            )}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <ErrorsTable rows={items} onOpen={(r) => setOpenId(r.id)} onToggle={(r) => set.mutate({ id: r.id, resolved: !r.resolved })} busyId={set.isPending ? set.variables?.id ?? null : null} />
            <ErrorsCards rows={items} onOpen={(r) => setOpenId(r.id)} onToggle={(r) => set.mutate({ id: r.id, resolved: !r.resolved })} busyId={set.isPending ? set.variables?.id ?? null : null} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <PremiumPanel title="Limpeza" icon={Trash2}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
            {prog
              ? <>Este registro ocupa {sizeLabel(prog.size_bytes)}{prog.oldest ? ` e o mais antigo é de ${dayLabel(prog.oldest)}` : ""}. Nada é apagado sozinho: apague os já resolvidos de tempos em tempos. Erros abertos não podem ser apagados, só resolvidos.</>
              : "Os erros resolvidos podem ser apagados daqui. Os abertos não."}
          </p>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!prog || prog.resolved === 0} onClick={() => setDeleting(true)}
            title={prog && prog.resolved === 0 ? "Não há erros resolvidos para apagar." : undefined}>
            <Trash2 className="h-3.5 w-3.5" /> Apagar resolvidos
          </Button>
        </div>
      </PremiumPanel>

      <ErrorSheet id={openId} seed={seed} onClose={() => setOpenId(null)} />
      <DeleteDialog open={deleting} onClose={() => setDeleting(false)} resolved={prog?.resolved ?? 0} />
      {confirm.dialog}
    </div>
  );
}
