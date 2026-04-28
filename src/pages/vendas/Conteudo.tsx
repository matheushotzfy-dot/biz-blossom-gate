import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  FileEdit,
  GraduationCap,
  Grid3X3,
  Layers,
  List,
  Loader2,
  Plus,
  Search,
  Settings2,
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

  const tabIcon: Record<typeof filter, JSX.Element> = {
    all: <Layers className="h-3 w-3" strokeWidth={2.5} />,
    published: <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />,
    draft: <FileEdit className="h-3 w-3" strokeWidth={2.5} />,
  };

  const tabAccent: Record<typeof filter, string> = {
    all: "text-foreground",
    published: "text-success",
    draft: "text-muted-foreground",
  };

  return (
    <div className="mx-auto -mt-2 w-full max-w-[1440px] pb-24 md:-mt-3 md:pb-10">
      {/* ── Hero header ── */}
      <div className="relative flex flex-col gap-7 px-5 pt-1 sm:px-7 md:pt-1">
        {/* Subtle radial accent behind title */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 left-0 h-48 w-[520px] -z-[1] opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(60% 60% at 20% 50%, hsl(var(--primary) / 0.10), transparent 70%)",
          }}
        />

        <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="font-display text-[40px] font-black leading-[0.9] tracking-[-0.055em] text-foreground sm:text-[52px]">
              Área de membros
            </h1>
            <p className="mt-2 text-[13px] font-medium text-muted-foreground/80">
              Builder, catálogo e operação do seu conteúdo num só lugar.
            </p>
          </div>
          <button
            onClick={openNew}
            className="group inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-[13px] font-black uppercase tracking-wider text-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.5)]"
          >
            <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.75} />
            Nova área
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/50 bg-border/40 sm:grid-cols-4 animate-fade-in stagger-1">
          {metricCards.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-card px-5 py-4">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
                  <Icon className="h-3 w-3" strokeWidth={2.5} />
                  {item.label}
                </div>
                <div className="mt-2 font-display text-[22px] font-black leading-none tracking-tight text-foreground tabular-nums">
                  {item.value}
                </div>
                <p className="mt-1.5 text-[11px] font-medium text-muted-foreground/60">{item.meta}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs + Search row */}
        <div className="flex flex-col gap-3 pb-1 animate-fade-in stagger-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit items-center gap-0.5 rounded-xl border border-border/50 bg-card/60 p-1 overflow-x-auto">
            {tabs.map((tab) => {
              const active = filter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={cn(
                    "group/tab relative inline-flex shrink-0 items-center gap-2 rounded-lg h-8 px-3 text-[12px] font-bold tracking-tight transition-colors duration-200",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground/80 hover:text-foreground"
                  )}
                >
                  <span className={cn(
                    "flex h-4 w-4 items-center justify-center transition-colors",
                    active ? tabAccent[tab.value] : "text-muted-foreground/50 group-hover/tab:text-foreground/70"
                  )}>
                    {tabIcon[tab.value]}
                  </span>
                  <span className="font-display">{tab.label === "published" ? "Live" : tab.label === "draft" ? "Rascunhos" : tab.label}</span>
                  {tab.count > 0 && (
                    <span className={cn(
                      "inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-md px-1.5 text-[10px] font-black tabular-nums tracking-tight border transition-colors",
                      active
                        ? "bg-background/80 text-foreground border-border/40"
                        : "bg-muted/30 text-muted-foreground/60 border-transparent"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar área..."
                className="h-9 w-full rounded-lg border border-border/60 bg-secondary/40 pl-9 pr-8 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary/50 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/15 sm:w-72"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-card/60 p-1 self-start">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  viewMode === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground/70 hover:text-foreground"
                )}
                title="Grade"
              >
                <Grid3X3 className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground/70 hover:text-foreground"
                )}
                title="Lista"
              >
                <List className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Highlight strip (foco atual) ── */}
      {highlightCourse && (
        <div className="mx-5 mt-5 sm:mx-7 animate-fade-in stagger-2">
          <div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                highlightCourse.is_published
                  ? "border-success/30 bg-success/[0.06] text-success"
                  : "border-border/50 bg-muted/[0.06] text-muted-foreground"
              )}>
                <GraduationCap className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">Foco atual</p>
                  <span className={cn(
                    "inline-flex h-[18px] items-center rounded-md border px-1.5 text-[9.5px] font-black uppercase tracking-[0.14em]",
                    highlightCourse.is_published
                      ? "border-success/30 bg-success/[0.08] text-success"
                      : "border-border/40 bg-muted/[0.06] text-muted-foreground"
                  )}>
                    {highlightCourse.is_published ? "Live" : "Draft"}
                  </span>
                </div>
                <h2 className="mt-1 truncate font-display text-[16px] font-bold tracking-tight text-foreground">
                  {highlightCourse.title}
                </h2>
                <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground/70">
                  {highlightProduct?.name ? `${highlightProduct.name} · ` : ""}
                  {highlightStats.lessons} aulas em {highlightStats.modules} módulos · {highlightStudents} alunos · {formatContentCurrency(highlightRevenue)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate(`/vendas/conteudo/${highlightCourse.id}/builder`)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 text-[11.5px] font-bold tracking-tight text-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.10] hover:text-primary"
              >
                <Settings2 className="h-3.5 w-3.5 text-primary/80" strokeWidth={2.25} />
                <span className="font-display">Builder</span>
              </button>
              {highlightCourse.is_published && (
                <button
                  onClick={() => window.open(getCourseLink(highlightCourse.id), "_blank")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/50 bg-card px-3 text-[11.5px] font-bold tracking-tight text-muted-foreground/80 transition-colors hover:border-border hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
                  <span className="font-display">Ver área</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Workspace ── */}
      <div className="px-5 pt-5 sm:px-7">
        <section className="overflow-hidden rounded-2xl border border-border/50 bg-card animate-fade-in stagger-3">

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
      </div>

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
