import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, LayoutGrid, List, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import CourseCreationWizard from "@/components/course/CourseCreationWizard";
import { ContentCourseCard } from "@/components/course/ContentCourseCard";
import { COURSE_ROW_GRID, ContentCourseRow } from "@/components/course/ContentCourseRow";
import type { CourseMenuHandlers } from "@/components/course/CourseActionsMenu";
import {
  buildEditableCoursePayload,
  getMemberAreaLink,
  type ContentCourse,
  type ContentCourseStats,
  type ContentFilterId,
  type ContentProduct,
  type EditableCoursePayload,
} from "@/components/course/contentPresentation";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { PageHead } from "@/components/seller-ui/PageHead";
import { SearchField } from "@/components/seller-ui/SearchField";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { StatBand } from "@/components/seller-ui/StatBand";
import { Money } from "@/components/home/Money";
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCourses as useCoursesQuery, useInvalidateAll, useProducts as useProductsQuery, useProductRevenue } from "@/hooks/useQueryData";
import { ConfirmDialog } from "@/components/seller-ui/confirm";

type ViewMode = "grid" | "list";

const NO_STATS: ContentCourseStats = { modules: 0, lessons: 0 };
const nf = new Intl.NumberFormat("pt-BR");

export default function AdminConteudo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const coursesQuery = useCoursesQuery();
  const { isLoading, isError, refetch } = coursesQuery;
  // Padrões estáveis: um [] novo a cada render refaria os efeitos abaixo em loop enquanto carrega ou falha.
  const coursesRaw = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const productsQuery = useProductsQuery();
  const productsRaw = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const revenueQuery = useProductRevenue();
  const revenueByProduct = useMemo(() => revenueQuery.data ?? {}, [revenueQuery.data]);
  const invalidateAll = useInvalidateAll();

  // null = ainda carregando ou falhou; nunca mostramos "0 alunos" quando o número é desconhecido.
  const [studentCounts, setStudentCounts] = useState<Record<string, number> | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContentFilterId>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editCourseData, setEditCourseData] = useState<EditableCoursePayload | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingCourse, setDeletingCourse] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const busyRef = useRef(new Set<string>());
  const copyTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const courses = useMemo(
    () =>
      coursesRaw.map((course) => {
        const { modules: _modules, ...rest } = course;
        return { ...rest, is_published: !!rest.is_published } as ContentCourse;
      }),
    [coursesRaw],
  );

  const products = useMemo(
    () => productsRaw.map((product) => ({ id: product.id, name: product.name, price: Number(product.price) })) as ContentProduct[],
    [productsRaw],
  );
  const productNames = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);

  const courseIds = useMemo(() => courses.map((course) => course.id).filter(Boolean), [courses]);

  useEffect(() => {
    if (courseIds.length === 0) {
      setStudentCounts((prev) => (prev && Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    let cancelled = false;
    supabase
      .from("user_access")
      .select("course_id")
      .eq("status", "active")
      .in("course_id", courseIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setStudentCounts(null);
          return;
        }
        const counts: Record<string, number> = {};
        data.forEach((item) => {
          counts[item.course_id] = (counts[item.course_id] || 0) + 1;
        });
        setStudentCounts(counts);
      });
    return () => { cancelled = true; };
  }, [courseIds]);

  const courseStats = useMemo(() => {
    const stats: Record<string, ContentCourseStats> = {};
    coursesRaw.forEach((course) => {
      const modules = course.modules || [];
      stats[course.id] = {
        modules: modules.length,
        lessons: modules.reduce((acc, module) => acc + (module.lessons?.length || 0), 0),
      };
    });
    return stats;
  }, [coursesRaw]);

  const getCourseRevenue = (course: ContentCourse) => (course.product_id ? revenueByProduct[course.product_id] || 0 : 0);

  const reloadCourses = () => invalidateAll(["courses", "products", "transactions"]);

  const openNew = () => {
    setEditCourseData(null);
    setWizardOpen(true);
  };

  const openEdit = (course: ContentCourse) => {
    const sourceCourse = coursesRaw.find((item) => item.id === course.id);
    setEditCourseData(buildEditableCoursePayload(course, sourceCourse));
    setWizardOpen(true);
  };

  const togglePublish = async (id: string, current: boolean) => {
    if (!user || busyRef.current.has(id)) return;
    busyRef.current.add(id);
    try {
      const { error } = await supabase.from("courses").update({ is_published: !current }).eq("id", id).eq("user_id", user.id);
      if (error) throw error;
      reloadCourses();
      toast.success(current ? "Área despublicada." : "Área publicada.");
    } catch (e) {
      const msg = (e as { message?: string } | null)?.message;
      toast.error(msg?.startsWith("A equipe tirou") ? msg : current ? "Não foi possível despublicar a área. Tente de novo." : "Não foi possível publicar a área. Tente de novo.");
    } finally {
      busyRef.current.delete(id);
    }
  };

  const confirmDeleteCourse = async () => {
    if (!user || !deleteTarget || deletingCourse) return;
    setDeletingCourse(true);
    try {
      const { data: courseModules, error: modulesError } = await supabase.from("modules").select("id").eq("course_id", deleteTarget);
      if (modulesError) throw modulesError;

      if (courseModules && courseModules.length > 0) {
        const { error: lessonsError } = await supabase.from("lessons").delete().in("module_id", courseModules.map((module) => module.id));
        if (lessonsError) throw lessonsError;
        const { error: modError } = await supabase.from("modules").delete().eq("course_id", deleteTarget);
        if (modError) throw modError;
      }

      const { error: accessError } = await supabase.from("user_access").delete().eq("course_id", deleteTarget);
      if (accessError) throw accessError;
      const { error: courseError } = await supabase.from("courses").delete().eq("id", deleteTarget).eq("user_id", user.id);
      if (courseError) throw courseError;

      setDeleteTarget(null);
      toast.success("Área excluída.");
    } catch {
      toast.error("Não foi possível excluir a área por completo. Atualize a página e confira o que restou.");
    } finally {
      setDeletingCourse(false);
      reloadCourses();
    }
  };

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesSearch =
        query.length === 0 ||
        course.title.toLowerCase().includes(query) ||
        course.description?.toLowerCase().includes(query) ||
        course.category?.toLowerCase().includes(query) ||
        (course.product_id ? productNames.get(course.product_id)?.toLowerCase().includes(query) : false);
      const matchesFilter = filter === "all" || (filter === "published" ? course.is_published : !course.is_published);
      return !!matchesSearch && matchesFilter;
    });
  }, [courses, filter, search, productNames]);

  const publishedCount = useMemo(() => courses.filter((c) => c.is_published).length, [courses]);

  const totals = useMemo(() => {
    let modules = 0;
    let lessons = 0;
    Object.values(courseStats).forEach((s) => { modules += s.modules; lessons += s.lessons; });
    // Dois cursos no mesmo produto não contam a receita duas vezes.
    const seen = new Set<string>();
    let revenue = 0;
    courses.forEach((c) => {
      if (c.product_id && !seen.has(c.product_id)) {
        seen.add(c.product_id);
        revenue += revenueByProduct[c.product_id] || 0;
      }
    });
    const students = studentCounts ? Object.values(studentCounts).reduce((acc, n) => acc + n, 0) : null;
    return { modules, lessons, revenue, students };
  }, [courseStats, courses, revenueByProduct, studentCounts]);

  const getCourseLink = (courseId: string) => getMemberAreaLink(window.location.origin, courseId);

  const handleCopyMemberLink = async (courseId: string) => {
    try {
      await navigator.clipboard.writeText(getCourseLink(courseId));
    } catch {
      toast.error("Não foi possível copiar. Copie o link pela barra de endereço da área.");
      return;
    }
    setCopiedId(courseId);
    toast.success("Link da área copiado.");
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId((current) => (current === courseId ? null : current)), 1800);
  };

  const handlersFor = (course: ContentCourse): CourseMenuHandlers => ({
    onOpenBuilder: () => navigate(`/vendas/conteudo/${course.id}/builder`),
    onOpenEdit: () => openEdit(course),
    onOpenAnalytics: () => navigate(`/vendas/conteudo/${course.id}/analytics`),
    onTogglePublish: () => togglePublish(course.id, course.is_published),
    onCopyLink: () => handleCopyMemberLink(course.id),
    onOpenPreview: () => window.open(getCourseLink(course.id), "_blank", "noopener,noreferrer"),
    onDelete: () => setDeleteTarget(course.id),
  });

  const hasFilter = search.trim() !== "" || filter !== "all";
  const deleteCourse = courses.find((c) => c.id === deleteTarget);
  const deleteStats = deleteTarget ? courseStats[deleteTarget] ?? NO_STATS : NO_STATS;
  const deleteStudents = deleteTarget && studentCounts ? studentCounts[deleteTarget] || 0 : 0;

  const filterOptions = [
    { value: "all" as const, label: "Todas", count: courses.length || undefined },
    { value: "published" as const, label: "Publicadas", count: publishedCount || undefined },
    { value: "draft" as const, label: "Rascunhos", count: courses.length - publishedCount || undefined },
  ];

  const cardProps = (course: ContentCourse) => ({
    course,
    stats: courseStats[course.id] ?? NO_STATS,
    students: studentCounts ? studentCounts[course.id] || 0 : null,
    revenue: getCourseRevenue(course),
    productName: course.product_id ? productNames.get(course.product_id) : undefined,
    copied: copiedId === course.id,
    ...handlersFor(course),
  });

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Área de membros | Vemprapay" description="Crie e gerencie as áreas de membros dos seus produtos." path="/vendas/conteudo" noindex />

      <SectionTabs section="products" />
      <PageHead
        title="Área de membros"
        subtitle="Cursos, módulos e aulas que seus alunos acessam depois da compra."
        actions={
          <button type="button" onClick={openNew} className="vp-cta">
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
            Nova área
          </button>
        }
      />

      {courses.length > 0 && (
        <StatBand
          label="Resumo das áreas de membros"
          cells={[
            { label: "Áreas", value: nf.format(courses.length), sub: `${publishedCount} ${publishedCount === 1 ? "publicada" : "publicadas"}` },
            { label: "Aulas", value: nf.format(totals.lessons), sub: `em ${nf.format(totals.modules)} ${totals.modules === 1 ? "módulo" : "módulos"}` },
            { label: "Alunos com acesso", value: totals.students === null ? "—" : nf.format(totals.students), sub: totals.students === null ? "Não foi possível carregar" : "Acessos ativos" },
            { label: "Receita dos produtos vinculados", value: <Money value={totals.revenue} centsClassName="opacity-65" />, featured: true },
          ]}
        />
      )}

      {(courses.length > 0 || isLoading) && (
        <div className="vp-sheet flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <FilterPills<ContentFilterId> label="Filtrar áreas por situação" value={filter} options={filterOptions} onChange={setFilter} />
          <div className="flex items-center gap-3">
            <SearchField label="Buscar áreas" value={search} onChange={setSearch} placeholder="Buscar área ou produto" className="min-w-0 flex-1 lg:w-[300px] lg:flex-none" />
            <div role="group" aria-label="Forma de exibição" className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
              {([
                { mode: "grid" as const, label: "Cartões", Icon: LayoutGrid },
                { mode: "list" as const, label: "Lista", Icon: List },
              ]).map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={viewMode === mode}
                  aria-label={label}
                  title={label}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    viewMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy="true" aria-label="Carregando áreas de membros">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="vp-sheet overflow-hidden">
              <div className="vp-skel aspect-[16/10] w-full" />
              <div className="space-y-3 p-5">
                <div className="vp-skel h-5 w-3/4 rounded-full" />
                <div className="vp-skel h-4 w-1/2 rounded-full" />
                <div className="vp-skel h-8 w-1/3 rounded-full" />
                <div className="vp-skel h-10 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="vp-sheet">
          <EmptyPanel
            icon={<GraduationCap className="h-7 w-7" />}
            title="Não foi possível carregar suas áreas"
            text="Confira sua conexão e tente de novo. Nada foi alterado."
            action={<button type="button" onClick={() => refetch()} className="vp-cta"><RefreshCw className="h-[18px] w-[18px]" strokeWidth={2.2} />Tentar de novo</button>}
          />
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="vp-sheet">
          {hasFilter ? (
            <EmptyPanel
              icon={<GraduationCap className="h-7 w-7" />}
              title="Nenhuma área encontrada"
              text="Nada bate com essa busca ou filtro. Limpe os filtros para ver todas as áreas."
              action={<button type="button" className="vp-ghost" onClick={() => { setSearch(""); setFilter("all"); }}>Limpar filtros</button>}
            />
          ) : (
            <EmptyPanel
              icon={<GraduationCap className="h-7 w-7" />}
              title="Você ainda não tem uma área de membros"
              text="Crie a área, organize os módulos e vincule a um produto. Quem comprar passa a ter acesso às aulas."
              action={<button type="button" className="vp-cta" onClick={openNew}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Criar primeira área</button>}
            />
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredCourses.map((course) => (
            <ContentCourseCard key={course.id} {...cardProps(course)} />
          ))}
        </div>
      ) : (
        <div className="vp-sheet overflow-hidden">
          <div aria-hidden className={cn("hidden border-b border-border bg-muted/40 px-6 py-3 text-[13px] font-medium text-muted-foreground lg:grid", COURSE_ROW_GRID)}>
            <span>Área</span>
            <span className="text-right">Aulas</span>
            <span className="text-right">Alunos</span>
            <span className="text-right">Receita</span>
            <span />
          </div>
          <ul className="divide-y divide-border" aria-label="Áreas de membros">
            {filteredCourses.map((course) => (
              <ContentCourseRow key={course.id} {...cardProps(course)} />
            ))}
          </ul>
        </div>
      )}

      <CourseCreationWizard open={wizardOpen} onOpenChange={setWizardOpen} editCourse={editCourseData} products={products} onSaved={reloadCourses} />

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} busy={deletingCourse}
        title="Excluir esta área de membros?" confirmLabel="Excluir área" cancelLabel="Manter área"
        description={
          <div className="space-y-2">
            <span className="block break-words font-semibold text-foreground">{deleteCourse?.title}</span>
            <p>
              Somem o curso, {deleteStats.modules} {deleteStats.modules === 1 ? "módulo" : "módulos"}, {deleteStats.lessons} {deleteStats.lessons === 1 ? "aula" : "aulas"} e o acesso dos alunos. Não dá para desfazer.
            </p>
            {deleteStudents > 0 && (
              <p className="font-semibold text-foreground">
                {deleteStudents} {deleteStudents === 1 ? "aluno perde" : "alunos perdem"} o acesso agora.
              </p>
            )}
            <p>O produto vinculado e o histórico de vendas continuam como estão.</p>
          </div>
        }
        onConfirm={confirmDeleteCourse}
      />
    </div>
  );
}
