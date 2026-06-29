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
import { GridSkeleton } from "@/components/PageShell";
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
  type EditableCoursePayload,
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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCourses as useCoursesQuery, useInvalidateAll, useProducts as useProductsQuery, useTransactions } from "@/hooks/useQueryData";

const numberAnimator = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

type ViewMode = "grid" | "list";

export default function AdminConteudo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: coursesRaw = [], isLoading, isError, refetch } = useCoursesQuery();
  const { data: productsRaw = [] } = useProductsQuery();
  const { data: transactions = [] } = useTransactions();
  const invalidateAll = useInvalidateAll();

  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContentFilterId>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editCourseData, setEditCourseData] = useState<EditableCoursePayload | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingCourse, setDeletingCourse] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const courses = useMemo(
    () =>
      coursesRaw.map((course) => {
        const { modules: _modules, ...rest } = course;
        return {
          ...rest,
          is_published: !!rest.is_published,
        } as ContentCourse;
      }),
    [coursesRaw],
  );

  const products = useMemo(
    () => productsRaw.map((product) => ({ id: product.id, name: product.name, price: Number(product.price) })) as ContentProduct[],
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
  return (
    <div className="mx-auto -mt-2 w-full max-w-[1600px] pb-24 md:-mt-3 md:pb-10 bg-background min-h-screen text-foreground selection:bg-primary/30">
      {/* ── Hero header ── */}
      <div className="relative flex flex-col gap-10 px-6 pt-12 sm:px-10">
        {/* Decorative background effects */}
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-40 left-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex flex-wrap items-end justify-between gap-8 animate-fade-in relative z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-primary mb-4">
              <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shadow-[0_0_20px_rgba(var(--primary),0.1)]">H</div>
              HOTZFY STUDIO
            </div>
            <h1 className="font-display text-[48px] font-bold leading-[0.9] tracking-[-0.05em] text-foreground sm:text-[72px]">
              Gestão de <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/40">Conteúdo</span>
            </h1>
            <p className="mt-4 text-[16px] font-medium text-muted-foreground max-w-xl leading-relaxed">
              Sua central criativa. Organize módulos, aulas e acompanhe o engajamento dos seus alunos em tempo real.
            </p>
          </div>
          <button
            onClick={openNew}
            className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-md bg-primary px-8 text-[12px] font-bold uppercase tracking-[0.18em] text-primary-foreground transition-all duration-300 hover:bg-primary/90 active:scale-[0.97] shadow-[0_4px_20px_rgba(var(--primary),0.2)]"
          >
            <Plus className="h-4.5 w-4.5" strokeWidth={3} />
            Novo curso
          </button>
        </div>

        {/* KPIs — Styled like screenshot */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 animate-fade-in stagger-1">
          {metricCards.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="relative overflow-hidden rounded-xl border border-border/40 bg-card p-6 transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                  <div className="h-7 w-7 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </div>
                  {item.label}
                </div>
                <div className="mt-4 font-display text-[32px] font-bold leading-none tracking-[-0.03em] text-foreground tabular-nums">
                  {item.value}
                </div>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">{item.meta}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs + Search row — Styled like screenshot */}
        <div className="flex flex-col gap-4 pt-4 animate-fade-in stagger-2 sm:flex-row sm:items-center sm:justify-between border-t border-white/[0.05]">
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted/50 p-1 border border-border/40">
            {tabs.map((tab) => {
              const active = filter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={cn(
                    "relative flex items-center gap-2.5 h-10 px-5 text-[11px] font-bold uppercase tracking-[0.16em] rounded-md transition-all duration-200",
                    active
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <span className="flex items-center justify-center">
                    {tabIcon[tab.value]}
                  </span>
                  <span className="font-display">{tab.label === "published" ? "Live" : tab.label === "draft" ? "Draft" : tab.label}</span>
                  {tab.count > 0 && (
                    <span className={cn(
                      "inline-flex h-[20px] min-w-[22px] items-center justify-center px-1.5 text-[10px] font-bold tabular-nums tracking-tight rounded",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground/60"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within:text-primary" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar curso..."
                className="h-12 w-full rounded-xl border border-border/40 bg-card pl-11 pr-10 text-[13px] font-medium text-foreground placeholder:text-muted-foreground/40 transition-all focus:border-primary/50 focus:outline-none sm:w-80"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/40 hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1 border border-border/40">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-all",
                  viewMode === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                title="Grade"
              >
                <Grid3X3 className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg transition-all",
                  viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                title="Lista"
              >
                <List className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Workspace ── */}
      <div className="px-6 sm:px-10 mt-10 pb-20">
        {isLoading ? (
          <GridSkeleton items={6} cols={4} />
        ) : isError ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center animate-fade-in">
            <div className="h-20 w-20 rounded-[24px] bg-destructive/10 border border-destructive/30 flex items-center justify-center mb-6">
              <GraduationCap className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-foreground mb-2">Falha ao carregar conteúdos</h3>
            <p className="max-w-sm text-[13px] text-muted-foreground mb-6">Não foi possível buscar suas áreas. Verifique a conexão e tente novamente.</p>
            <button onClick={() => refetch()} className="h-11 px-8 rounded-md bg-primary text-primary-foreground text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-primary/90 transition-all">Tentar novamente</button>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="flex min-h-[500px] flex-col items-center justify-center px-6 text-center animate-fade-in">
            <div className="h-24 w-24 rounded-[32px] bg-card border border-border/40 flex items-center justify-center mb-8 shadow-xl relative group">
              <div className="absolute inset-0 bg-primary/5 rounded-[32px] blur-2xl group-hover:bg-primary/10 transition-all" />
              <GraduationCap className="h-10 w-10 text-muted-foreground/30 relative z-10" />
            </div>
            <h3 className="font-display text-2xl font-bold tracking-tight text-foreground mb-3">
              {emptyFiltered ? "Nenhum resultado encontrado" : "Sua operação de conteúdo começa aqui"}
            </h3>
            <p className="max-w-sm text-[14px] text-muted-foreground leading-relaxed mb-10">
              {emptyFiltered ? "Troque a busca ou o filtro para encontrar a área certa." : "Crie a primeira área, conecte ao produto e deixe o catálogo pronto para o aluno."}
            </p>
            {!emptyFiltered && (
              <button
                onClick={openNew}
                className="inline-flex h-12 items-center gap-3 rounded-md bg-primary px-10 text-[12px] font-bold uppercase tracking-[0.2em] text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.97] shadow-xl shadow-primary/20"
              >
                <Plus className="h-5 w-5" strokeWidth={3} />
                Criar área
              </button>
            )}
          </div>
        ) : (
          <div className="animate-fade-in stagger-3">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredCourses.map((course) => (
                  <ContentCourseCard
                    key={course.id}
                    course={course}
                    stats={courseStats[course.id] || { modules: 0, lessons: 0 }}
                    students={studentCounts[course.id] || 0}
                    revenueLabel={formatContentCurrency(getCourseRevenue(course))}
                    productName={products.find(p => p.id === course.product_id)?.name}
                    onOpenEdit={() => openEdit(course)}
                    onDelete={() => setDeleteTarget(course.id)}
                    onTogglePublish={() => togglePublish(course.id, course.is_published)}
                    onCopyLink={() => handleCopyMemberLink(course.id)}
                    copied={copiedId === course.id}
                    onOpenBuilder={() => navigate(`/vendas/conteudo/${course.id}/builder`)}
                    onOpenPreview={() => window.open(getCourseLink(course.id), "_blank")}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/10 backdrop-blur-md overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-zinc-900/30">
                      <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">Área de Membros</th>
                      <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">Status</th>
                      <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500 text-right">Configurações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredCourses.map((course) => (
                      <ContentCourseRow
                        key={course.id}
                        course={course}
                        stats={courseStats[course.id] || { modules: 0, lessons: 0 }}
                        students={studentCounts[course.id] || 0}
                        revenueLabel={formatContentCurrency(getCourseRevenue(course))}
                        productName={products.find(p => p.id === course.product_id)?.name}
                        onOpenEdit={() => openEdit(course)}
                        onDelete={() => setDeleteTarget(course.id)}
                        onTogglePublish={() => togglePublish(course.id, course.is_published)}
                        onCopyLink={() => handleCopyMemberLink(course.id)}
                        copied={copiedId === course.id}
                        onOpenBuilder={() => navigate(`/vendas/conteudo/${course.id}/builder`)}
                        onOpenPreview={() => window.open(getCourseLink(course.id), "_blank")}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <CourseCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        editCourse={editCourseData}
        products={products}
        onSaved={reloadCourses}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl bg-zinc-950 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold text-white">Excluir área de membros</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-zinc-400">
              Curso, módulos, aulas e acessos vinculados serão removidos. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCourse} className="h-10 rounded-lg text-[13px] bg-transparent text-zinc-400 border-white/10 hover:bg-white/5">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCourse} disabled={deletingCourse} className="h-10 rounded-lg bg-red-600 text-[13px] text-white hover:bg-red-500">
              {deletingCourse ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {deletingCourse ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
