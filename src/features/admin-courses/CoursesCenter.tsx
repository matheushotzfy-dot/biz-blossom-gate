import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileEdit, GraduationCap, Loader2, Search, ShieldOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorBlock } from "@/features/admin-antifraud/BlacklistPanel";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { uniqueChannelName } from "@/lib/realtime";
import { PremiumEmpty, PremiumMetric, PremiumMetricGrid, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { CourseSheet } from "./CourseSheet";
import { CoursesCards, CoursesTable } from "./CoursesList";
import { PAGE_SIZE, STATUS_PILLS, parseCoursesPage, type CourseItem, type StatusFilter } from "./coursesModel";

/** Cursos da área de membros de todos os sellers: o que está no ar, o que tem problema e a ação de tirar do ar. Só administrador. */
export default function CoursesCenter({ isAdmin = true }: { isAdmin?: boolean }) {
  if (!isAdmin) return <PremiumEmpty icon={GraduationCap} title="A curadoria de cursos é do administrador" subtitle="Peça ao administrador para revisar ou tirar um curso do ar." />;
  return <Center />;
}

function Center() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-courses", status, debounced, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_courses_page" as never, { _status: status, _search: debounced || null, _page: page, _page_size: PAGE_SIZE } as never);
      if (error) throw error;
      return parseCoursesPage(data);
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const ch = supabase.channel(uniqueChannelName("admin-courses-center"))
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => { void qc.invalidateQueries({ queryKey: ["admin-courses"] }); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const items = q.data?.items ?? [];
  const s = q.data?.summary;
  const seed: CourseItem | null = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);
  const attention = s ? s.published_empty + s.published_product_off : undefined;

  const filtersActive = status !== "all" || !!debounced;
  const clear = () => { setStatus("all"); setSearch(""); setPage(1); };
  const n = (v?: number) => (v === undefined ? "—" : v.toLocaleString("pt-BR"));
  const pending = q.isError ? "Indisponível" : "Carregando…";

  const heroStatus = !s ? (q.isError ? { tone: "destructive" as const, label: "Não foi possível carregar" } : { tone: "neutral" as const, label: "Carregando…" })
    : attention && attention > 0 ? { tone: "warning" as const, label: `${attention} no ar com problema`, pulse: true }
      : { tone: "success" as const, label: `${s.published} no ar, sem problemas` };

  const pills = useMemo(() => STATUS_PILLS.map((p) => ({ ...p, label: s ? `${p.label} · ${s[p.value].toLocaleString("pt-BR")}` : p.label })), [s]);

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader eyebrow="Conteúdo" title="Cursos" subtitle="Os cursos das áreas de membros dos sellers. Veja o que está no ar e tire do ar o que não deveria estar." status={heroStatus} />

      <PremiumMetricGrid cols={4}>
        <PremiumMetric icon={CheckCircle2} label="No ar" value={n(s?.published)} tone="success" sub={s ? "visíveis aos alunos" : pending} />
        <PremiumMetric icon={FileEdit} label="Rascunhos" value={n(s?.draft)} sub={s ? "ainda não publicados" : pending} />
        <PremiumMetric icon={ShieldOff} label="Tirados do ar" value={n(s?.held)} tone={s && s.held > 0 ? "destructive" : "neutral"} sub={s ? (s.held > 0 ? "seller não republica" : "nenhum") : pending} />
        <PremiumMetric icon={AlertTriangle} label="No ar com problema" value={n(attention)} tone={attention && attention > 0 ? "warning" : "neutral"}
          sub={s ? (attention ? "marcados na lista" : "nenhum") : pending} />
      </PremiumMetricGrid>

      <PremiumPanel title="Cursos" icon={GraduationCap}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <PremiumSegmented<StatusFilter> value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={pills} />
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar cursos" placeholder="Curso, categoria, produto, seller ou e-mail" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {filtersActive && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={clear}><X className="h-3.5 w-3.5" /> Limpar filtros</Button>}
        </div>

        {q.isError && !q.isFetching ? (
          <ErrorBlock title="Não foi possível carregar os cursos." error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isPending ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando os cursos…</p>
        ) : items.length === 0 ? (
          <div>
            <PremiumEmpty icon={GraduationCap} title={filtersActive ? "Nada por aqui" : "Nenhum curso criado ainda"}
              subtitle={filtersActive ? "Nenhum curso bate com esses filtros." : "Quando um seller criar um curso na área de membros, ele aparece aqui."} />
            {filtersActive && <div className="-mt-8 pb-6 text-center"><Button type="button" variant="outline" size="sm" onClick={clear}>Limpar filtros</Button></div>}
          </div>
        ) : (
          <div aria-busy={q.isPlaceholderData} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <CoursesTable rows={items} onOpen={(c) => setSelectedId(c.id)} />
            <CoursesCards rows={items} onOpen={(c) => setSelectedId(c.id)} />
            <AdminPager page={page} pageSize={PAGE_SIZE} totalCount={q.data?.total ?? 0} onPageChange={setPage} loading={q.isFetching} />
          </div>
        )}
      </PremiumPanel>

      <CourseSheet id={selectedId} seed={seed} onClose={() => setSelectedId(null)} />
    </div>
  );
}
