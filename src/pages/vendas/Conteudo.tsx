import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  DollarSign,
  GraduationCap,
  Grid3X3,
  Layers,
  List,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import CourseCreationWizard from "@/components/course/CourseCreationWizard";
import { ContentCourseCard } from "@/components/course/ContentCourseCard";
import { ContentCourseRow } from "@/components/course/ContentCourseRow";
import {
  buildEditableCoursePayload,
  formatContentCurrency,
  getMemberAreaLink,
  type ContentCourse,
  type ContentCourseStats,
  type ContentFilterId,
  type ContentProduct,
} from "@/components/course/contentPresentation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCourses as useCoursesQuery, useInvalidateAll, useProducts as useProductsQuery, useTransactions } from "@/hooks/useQueryData";

const numberAnimator = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

type ViewMode = "grid" | "list";

export default function AdminConteudo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: coursesRaw = [], isLoading } = useCoursesQuery();
  const { data: productsRaw = [] } = useProductsQuery();
  const { data: transactions = [] } = useTransactions();
  const invalidateAll = useInvalidateAll();

  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContentFilterId>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editCourseData, setEditCourseData] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingCourse, setDeletingCourse] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const courses = useMemo(
    () =>
      coursesRaw.map((course: any) => {
        const { modules: _modules, ...rest } = course;
        return {
          ...rest,
          is_published: !!rest.is_published,
        } as ContentCourse;
      }),
    [coursesRaw],
  );

  const products = useMemo(
    () => productsRaw.map((product: any) => ({ id: product.id, name: product.name, price: Number(product.price) })) as ContentProduct[],
    [productsRaw],
  );

  const courseIds = useMemo(() => courses.map((course) => course.id).filter(Boolean), [courses]);

  useEffect(() => {
    if (courseIds.length === 0) {
      setStudentCounts({});
      return;
    }

    supabase
      .from("user_access")
      .select("course_id")
      .eq("status", "active")
      .in("course_id", courseIds)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        data?.forEach((item) => {
          counts[item.course_id] = (counts[item.course_id] || 0) + 1;
        });
        setStudentCounts(counts);
      });
  }, [courseIds]);

  const courseStats = useMemo(() => {
    const stats: Record<string, ContentCourseStats> = {};

    coursesRaw.forEach((course: any) => {
      const modules = course.modules || [];
      stats[course.id] = {
        modules: modules.length,
        lessons: modules.reduce((acc: number, module: any) => acc + (module.lessons?.length || 0), 0),
      };
    });

    return stats;
  }, [coursesRaw]);

  const revenueByProduct = useMemo(() => {
    const map: Record<string, number> = {};

    transactions
      .filter((transaction) => transaction.status === "completed" && transaction.product_id)
      .forEach((transaction) => {
        map[transaction.product_id!] = (map[transaction.product_id!] || 0) + Number(transaction.net_amount);
      });

    return map;
  }, [transactions]);

  const getCourseRevenue = (course: ContentCourse) => (course.product_id ? revenueByProduct[course.product_id] || 0 : 0);

  const reloadCourses = () => invalidateAll(["courses", "products", "transactions"]);

  const openNew = () => {
    setEditCourseData(null);
    setWizardOpen(true);
  };

  const openEdit = (course: ContentCourse) => {
    const sourceCourse = coursesRaw.find((item: any) => item.id === course.id);
    setEditCourseData(buildEditableCoursePayload(course, sourceCourse));
    setWizardOpen(true);
  };

  const togglePublish = async (id: string, current: boolean) => {
    if (!user) return;

    await supabase.from("courses").update({ is_published: !current }).eq("id", id).eq("user_id", user.id);
    reloadCourses();
    toast.success(current ? "Área despublicada." : "Área publicada.");
  };

  const confirmDeleteCourse = async () => {
    if (!user || !deleteTarget) return;

    setDeletingCourse(true);

    const { data: courseModules } = await supabase.from("modules").select("id").eq("course_id", deleteTarget);

    if (courseModules && courseModules.length > 0) {
      await supabase.from("lessons").delete().in("module_id", courseModules.map((module) => module.id));
      await supabase.from("modules").delete().eq("course_id", deleteTarget);
    }

    await supabase.from("user_access").delete().eq("course_id", deleteTarget);
    await supabase.from("courses").delete().eq("id", deleteTarget).eq("user_id", user.id);

    setDeletingCourse(false);
    setDeleteTarget(null);
    reloadCourses();
    toast.success("Área excluída.");
  };

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesSearch =
        query.length === 0 ||
        course.title.toLowerCase().includes(query) ||
        course.description?.toLowerCase().includes(query) ||
        course.category?.toLowerCase().includes(query);
      const matchesFilter = filter === "all" || (filter === "published" ? course.is_published : !course.is_published);

      return !!matchesSearch && matchesFilter;
    });
  }, [courses, filter, search]);

  const tabs = useMemo(
    () => [
      { label: "Todos", value: "all" as const, count: courses.length },
      { label: "Live", value: "published" as const, count: courses.filter((course) => course.is_published).length },
      { label: "Draft", value: "draft" as const, count: courses.filter((course) => !course.is_published).length },
    ],
    [courses],
  );

  const totalStudents = useMemo(() => Object.values(studentCounts).reduce((acc, count) => acc + count, 0), [studentCounts]);
  const totalModules = useMemo(() => Object.values(courseStats).reduce((acc, item) => acc + item.modules, 0), [courseStats]);
  const totalLessons = useMemo(() => Object.values(courseStats).reduce((acc, item) => acc + item.lessons, 0), [courseStats]);
  const totalRevenue = useMemo(() => courses.reduce((acc, course) => acc + getCourseRevenue(course), 0), [courses, revenueByProduct]);

  const highlightCourse = useMemo(() => {
    const liveCourse = courses.find((course) => course.is_published);
    return liveCourse || courses[0] || null;
  }, [courses]);

  const highlightStats = highlightCourse ? courseStats[highlightCourse.id] || { modules: 0, lessons: 0 } : { modules: 0, lessons: 0 };
  const highlightStudents = highlightCourse ? studentCounts[highlightCourse.id] || 0 : 0;
  const highlightProduct = highlightCourse ? products.find((product) => product.id === highlightCourse.product_id) : undefined;
  const highlightRevenue = highlightCourse ? getCourseRevenue(highlightCourse) : 0;

  const metricCards = [
    { label: "Áreas", value: numberAnimator(courses.length), meta: `${tabs[1].count} live`, icon: GraduationCap },
    { label: "Aulas", value: numberAnimator(totalLessons), meta: `${numberAnimator(totalModules)} módulos`, icon: BookOpen },
    { label: "Alunos", value: numberAnimator(totalStudents), meta: "acesso ativo", icon: Users },
    { label: "Receita", value: formatContentCurrency(totalRevenue), meta: "vinculada", icon: DollarSign },
  ];

  const getCourseLink = (courseId: string) => getMemberAreaLink(window.location.origin, courseId);

  const handleCopyMemberLink = async (courseId: string) => {
    await navigator.clipboard.writeText(getCourseLink(courseId));
    setCopiedId(courseId);
    toast.success("Link copiado.");
    window.setTimeout(() => {
      setCopiedId((current) => (current === courseId ? null : current));
    }, 1800);
  };

  const emptyFiltered = search.trim().length > 0 || filter !== "all";

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5 px-4 pb-24 pt-3 sm:px-6 lg:px-8">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="border-b border-border/60 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-3 w-3" /> área de membros
                </div>
                <div>
                  <h1 className="font-display text-2xl font-black tracking-tight text-foreground sm:text-[2rem]">
                    Conteúdo com cara de produto grande.
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Builder, catálogo, acesso e operação numa leitura mais limpa e direta.
                  </p>
                </div>
              </div>

              <Button onClick={openNew} className="h-10 gap-2 rounded-xl px-4 text-xs font-semibold">
                <Plus className="h-3.5 w-3.5" /> Nova área
              </Button>
            </div>
          </div>

          <div className="grid gap-px bg-border/70 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-card px-5 py-4">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </div>
                  <div className="mt-2 font-numbers text-xl font-black tracking-tight text-foreground">{item.value}</div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.meta}</p>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="border-b border-border/60 px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">foco atual</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">{highlightCourse?.title || "Nenhuma área criada"}</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {highlightCourse?.description || "Crie uma nova estrutura e comece pelo catálogo do aluno."}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card-inset px-3 py-2 text-right">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">status</div>
                <div className={cn("mt-1 text-xs font-bold uppercase tracking-[0.14em]", highlightCourse?.is_published ? "text-success" : "text-muted-foreground")}>{highlightCourse?.is_published ? "Live" : "Draft"}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border/70 bg-card-inset px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">conteúdo</div>
                <div className="mt-1 font-numbers text-lg font-black text-foreground">{highlightStats.lessons}</div>
                <div className="text-[11px] text-muted-foreground">{highlightStats.modules} módulos</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-card-inset px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">alunos</div>
                <div className="mt-1 font-numbers text-lg font-black text-foreground">{highlightStudents}</div>
                <div className="text-[11px] text-muted-foreground">ativos agora</div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card-inset px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">produto vinculado</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{highlightProduct?.name || "Nenhum conectado"}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">receita</div>
                  <div className="mt-1 font-numbers text-sm font-black text-success">{formatContentCurrency(highlightRevenue)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={highlightCourse ? () => navigate(`/vendas/conteudo/${highlightCourse.id}/builder`) : openNew} className="h-9 rounded-xl text-xs font-semibold">
                Builder
              </Button>
              <Button variant="outline" onClick={highlightCourse?.is_published ? () => window.open(getCourseLink(highlightCourse.id), "_blank") : openNew} className="h-9 rounded-xl text-xs font-semibold">
                Ver área
              </Button>
            </div>
          </div>
        </aside>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="border-b border-border/60 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-card-inset p-1">
              {tabs.map((tab) => {
                const active = filter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setFilter(tab.value)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
                      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                    <span className={cn("ml-1 font-numbers text-[10px]", active ? "text-primary" : "text-muted-foreground/70")}>{tab.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar área, categoria ou descrição"
                  className="h-9 w-full rounded-xl border border-border/70 bg-card-inset pl-9 pr-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
                {search ? (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card-inset p-1 self-start">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors", viewMode === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  title="Grade"
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors", viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  title="Lista"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-card-inset text-primary">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-base font-bold text-foreground">
              {emptyFiltered ? "Nada apareceu nessa leitura" : "Sua operação de conteúdo começa aqui"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {emptyFiltered ? "Troque busca ou filtro para encontrar a área certa." : "Crie a primeira área, conecte ao produto e deixe o catálogo pronto para o aluno."}
            </p>
            {!emptyFiltered ? (
              <Button onClick={openNew} className="mt-5 h-10 rounded-xl px-4 text-xs font-semibold">
                <Plus className="mr-2 h-3.5 w-3.5" /> Criar área
              </Button>
            ) : null}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredCourses.map((course) => {
              const stats = courseStats[course.id] || { modules: 0, lessons: 0 };
              const product = products.find((item) => item.id === course.product_id);
              const revenue = getCourseRevenue(course);
              const students = studentCounts[course.id] || 0;

              return (
                <ContentCourseCard
                  key={course.id}
                  course={course}
                  stats={stats}
                  productName={product?.name}
                  students={students}
                  revenueLabel={formatContentCurrency(revenue)}
                  copied={copiedId === course.id}
                  onOpenBuilder={() => navigate(`/vendas/conteudo/${course.id}/builder`)}
                  onOpenEdit={() => openEdit(course)}
                  onTogglePublish={() => togglePublish(course.id, course.is_published)}
                  onCopyLink={() => handleCopyMemberLink(course.id)}
                  onOpenPreview={() => window.open(getCourseLink(course.id), "_blank")}
                  onDelete={() => setDeleteTarget(course.id)}
                />
              );
            })}
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(0,2.5fr)_minmax(0,1.05fr)_96px_96px_132px_112px] gap-4 border-b border-border/60 bg-card-inset px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground md:grid">
              <div>Área</div>
              <div>Produto</div>
              <div className="text-right">Aulas</div>
              <div className="text-right">Alunos</div>
              <div className="text-right">Receita</div>
              <div className="text-right">Ações</div>
            </div>
            {filteredCourses.map((course) => {
              const stats = courseStats[course.id] || { modules: 0, lessons: 0 };
              const product = products.find((item) => item.id === course.product_id);
              const revenue = getCourseRevenue(course);
              const students = studentCounts[course.id] || 0;

              return (
                <ContentCourseRow
                  key={course.id}
                  course={course}
                  stats={stats}
                  productName={product?.name}
                  students={students}
                  revenueLabel={formatContentCurrency(revenue)}
                  copied={copiedId === course.id}
                  onOpenBuilder={() => navigate(`/vendas/conteudo/${course.id}/builder`)}
                  onOpenEdit={() => openEdit(course)}
                  onTogglePublish={() => togglePublish(course.id, course.is_published)}
                  onCopyLink={() => handleCopyMemberLink(course.id)}
                  onOpenPreview={() => window.open(getCourseLink(course.id), "_blank")}
                  onDelete={() => setDeleteTarget(course.id)}
                />
              );
            })}
          </div>
        )}
      </section>

      <CourseCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        products={products}
        editCourse={editCourseData}
        onSaved={reloadCourses}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir área de membros</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">
              Curso, módulos, aulas e acessos vinculados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCourse} className="h-9 rounded-lg text-[13px]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCourse} disabled={deletingCourse} className="h-9 rounded-lg bg-destructive text-[13px] text-destructive-foreground hover:bg-destructive/90">
              {deletingCourse ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              {deletingCourse ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
