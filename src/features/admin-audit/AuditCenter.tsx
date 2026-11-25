import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Activity, FileDown, Loader2, Search, ShieldAlert, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { Chip } from "@/features/admin-settings/Chip";
import { friendlyError } from "@/lib/friendlyError";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { AUDIT_KEY, ExportTooBig, callRpc, downloadCsv, pageArgs, runAuditExport, useRefreshAudit } from "./auditApi";
import { AuditList } from "./AuditList";
import { AuditSheet, type AuditTarget } from "./AuditSheet";
import {
  DEFAULT_FILTERS, PAGE_SIZE, PERIODS, SOURCES, actorName, agoLabel, auditFileName, dayLabel, entityGroups, entityLabel, filtersActive, heroStatus, parseAuditPage, periodText, plural, roleLabel, toAuditCsv,
  type AuditFilters, type AuditItem, type PeriodKey, type SourceFilter,
} from "./auditModel";

/** Tudo o que administradores, equipe e vendedores fizeram de importante no sistema. Só administrador. */
export default function AuditCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={Activity} title="A auditoria é do administrador" subtitle="Peça ao administrador para consultar o histórico de ações." />;
  return <Center />;
}

interface Running { done: number; total: number }

function Center() {
  const refresh = useRefreshAudit();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditTarget | null>(null);
  const [running, setRunning] = useState<Running | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const debounced = useDebouncedValue(filters.search.trim());
  const applied: AuditFilters = useMemo(() => ({ ...filters, search: debounced }), [filters, debounced]);
  const change = (patch: Partial<AuditFilters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };
  const clear = () => { setFilters(DEFAULT_FILTERS); setPage(1); };

  const q = useQuery({
    queryKey: [...AUDIT_KEY, "page", applied.source, applied.period, applied.actor, applied.entity, applied.sensitive, applied.search, page],
    queryFn: async () => parseAuditPage(await callRpc("get_admin_audit_page", { ...pageArgs(applied), _page: page, _page_size: PAGE_SIZE })),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(timer); timer = setTimeout(refresh, 800); };
    const ch = supabase.channel(uniqueChannelName("admin-audit-center"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, bump)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_audit_log" }, bump)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, bump)
      .subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = q.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const ov = data?.overview ?? null;
  const narrowed = filtersActive(filters);
  const seed: AuditItem | null = useMemo(() => (open ? items.find((i) => i.id === open.id && i.source === open.source) ?? null : null), [items, open]);

  // a página pode ficar além do fim (novos filtros, registros recém-filtrados): volta para a primeira
  useEffect(() => { if (q.data && q.data.items.length === 0 && page > 1) setPage(1); }, [q.data, page]);

  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";
  const status = heroStatus(data, q.isError);

  const sourcePills = useMemo(() => SOURCES.map((s) => ({ value: s.value, label: data ? `${s.label} · ${data.sources[s.value].toLocaleString("pt-BR")}` : s.label })), [data]);
  const sourceNote = SOURCES.find((s) => s.value === filters.source)?.note;

  const actors = useMemo(() => {
    const list = (data?.actors ?? []).filter((a) => !!a.id);
    if (filters.actor && !list.some((a) => a.id === filters.actor)) list.push({ id: filters.actor, name: null, email: null, role: "seller", n: 0 });
    return list;
  }, [data, filters.actor]);

  // só os tipos de alvo que existem neste recorte (mais o escolhido, para ele poder ser desligado)
  const entityChips = useMemo(() => {
    const list = entityGroups(data?.entities ?? []).slice(0, 8);
    if (filters.entity && !list.some((g) => g.value === filters.entity)) list.push({ label: entityLabel(filters.entity.split(",")[0]), value: filters.entity, n: 0 });
    return list;
  }, [data, filters.entity]);

  const startExport = () => {
    setExportError(null);
    const what = `${plural(total, "registro", "registros")} (${periodText(filters.period)}${filters.source !== "all" ? `, ${SOURCES.find((s) => s.value === filters.source)?.label.toLowerCase()}` : ""})`;
    sensitive.confirm(`Exportar ${what} em CSV, no horário de Brasília e sem senhas, chaves nem documentos. A exportação fica registrada nesta auditoria.`, async () => {
      setRunning({ done: 0, total });
      try {
        const out = await runAuditExport(applied, (done, tot) => { if (alive.current) setRunning({ done, total: tot }); }, () => !alive.current);
        if (out.rows.length === 0) { toast.info("Nenhum registro para exportar neste recorte."); return; }
        downloadCsv(auditFileName(applied.period), toAuditCsv(out.rows));
        toast.success(`${plural(out.rows.length, "registro exportado", "registros exportados")}.`);
      } catch (e) {
        if (alive.current) setExportError(e instanceof ExportTooBig ? e.message : friendlyError(e, "Não foi possível exportar. Nenhum arquivo foi baixado."));
      } finally {
        if (alive.current) setRunning(null);
        refresh();
      }
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <FinanceiroHero eyebrow="Sistema" title="Auditoria" status={status}
        subtitle="O que administradores, equipe e vendedores fizeram de importante: quem fez, em quê e o que mudou. Esta tela só lê: não edita nem apaga nada. Senhas, chaves e documentos nunca aparecem." />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={Activity} label="Ações hoje" value={n(ov?.today)} tone={ov && ov.today > 0 ? "info" : undefined} sub={ov ? (ov.last_at ? `última ${agoLabel(ov.last_at)}` : "nada registrado") : pending} />
        <PremiumMetric icon={Activity} label="Últimos 7 dias" value={n(ov?.week)} sub={ov ? `${ov.total.toLocaleString("pt-BR")} no total` : pending} />
        <PremiumMetric icon={Users} label="Contas ativas" value={n(ov?.actors_week)} sub={ov ? "agiram nos últimos 7 dias" : pending} />
        <PremiumMetric icon={ShieldAlert} label="Ações sensíveis" value={n(ov?.sensitive_week)} tone={ov && ov.sensitive_week > 0 ? "warning" : undefined}
          sub={ov ? "7 dias: dinheiro, acesso e dados pessoais" : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Registros" icon={Activity}
        action={<Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={!!running || q.isPending || total === 0} onClick={startExport}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} Exportar CSV
        </Button>}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <PremiumSegmented<SourceFilter> value={filters.source} onChange={(v) => change({ source: v })} options={sourcePills} />
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar na auditoria" placeholder="Ação, nome, e-mail ou código" value={filters.search} maxLength={100}
              onChange={(e) => change({ search: e.target.value })} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            Responsável
            <select aria-label="Filtrar por responsável" value={filters.actor ?? ""} onChange={(e) => change({ actor: e.target.value || null })}
              className="h-10 max-w-[240px] rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground focus:border-primary/40 focus:outline-none">
              <option value="">Todos</option>
              {actors.map((a) => <option key={a.id as string} value={a.id as string}>{actorName(a)} ({roleLabel(a.role).toLowerCase()}{a.n ? `, ${a.n.toLocaleString("pt-BR")}` : ""})</option>)}
            </select>
          </label>
          {narrowed && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>

        <div role="group" aria-label="Período" className="mb-3 flex flex-wrap gap-2">
          {PERIODS.map((p) => <Chip key={p.value} active={filters.period === p.value} onClick={() => change({ period: p.value as PeriodKey })} className="!h-9 px-3.5 text-[13px]">{p.label}</Chip>)}
          <Chip active={filters.sensitive} onClick={() => change({ sensitive: !filters.sensitive })} className="!h-9 px-3.5 text-[13px]">Só sensíveis</Chip>
        </div>
        {entityChips.length > 0 && (
          <div role="group" aria-label="Tipo de alvo" className="mb-3 flex flex-wrap gap-2">
            <Chip active={!filters.entity} onClick={() => change({ entity: null })} className="!h-9 px-3.5 text-[13px]">Todos os alvos</Chip>
            {entityChips.map((g) => (
              <Chip key={g.value} active={filters.entity === g.value} onClick={() => change({ entity: filters.entity === g.value ? null : g.value })} className="!h-9 px-3.5 text-[13px]">
                {g.label}{g.n > 0 ? ` · ${g.n.toLocaleString("pt-BR")}` : ""}
              </Chip>
            ))}
          </div>
        )}
        {sourceNote && <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{sourceNote} Registros automáticos sem mudança real, como a troca de tema de quem é da equipe, não aparecem.</p>}

        {running && (
          <p role="status" className="mb-3 text-[13px] tabular-nums text-foreground/85">
            {running.total > 0 ? `Exportando ${running.done.toLocaleString("pt-BR")} de ${running.total.toLocaleString("pt-BR")} registros…` : "Preparando a exportação…"}
          </p>
        )}
        {exportError && <p role="alert" className="mb-3 rounded-[12px] bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{exportError}</p>}

        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar a auditoria." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando os registros…</p>
        ) : items.length === 0 ? (
          <div>
            {narrowed ? (
              <>
                <PremiumEmpty icon={Activity} title="Nada por aqui" subtitle="Nenhum registro bate com esses filtros." />
                <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>
              </>
            ) : ov && ov.total > 0 ? (
              <>
                <PremiumEmpty icon={Activity} title={`Nenhuma ação ${filters.period === "1" ? "hoje" : `nos ${periodText(filters.period)}`}`} subtitle={`A última foi ${agoLabel(ov.last_at)}${ov.last_at ? `, em ${dayLabel(ov.last_at)}` : ""}.`} />
                <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={() => change({ period: "all" })}>Ver todo o período</Button></div>
              </>
            ) : (
              <PremiumEmpty icon={Activity} title="Nenhuma ação registrada ainda" subtitle="Quando alguém da equipe ou um vendedor fizer algo importante, o registro aparece aqui." />
            )}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <AuditList rows={items} onOpen={(r) => setOpen({ source: r.source, id: r.id })} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={total} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <AuditSheet target={open} seed={seed} onClose={() => setOpen(null)} onJump={setOpen} />
      {sensitive.dialog}
    </div>
  );
}
