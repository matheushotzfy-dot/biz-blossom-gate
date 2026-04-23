import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { GraduationCap, Search, X } from "lucide-react";
import { motion } from "framer-motion";

import { MemberCourseShelf } from "@/components/member/MemberCourseShelf";
import { MemberHomeHero } from "@/components/member/MemberHomeHero";
import { type CourseWithProgress, type ModuleInfo, getCourseStatus } from "@/components/member/memberHomePresentation";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

export default function MemberHome() {
  const { user } = useOutletContext<{ user: User }>();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed" | "not_started">("all");

  useEffect(() => {
    if (user) loadCourses();
  }, [user]);

  const loadCourses = async () => {
    if (!user) return;

    const { data: access } = await supabase.from("user_access").select("course_id").eq("user_id", user.id).eq("status", "active");
    const accessIds = access?.map((item) => item.course_id) || [];

    const { data: owned } = await supabase.from("courses").select("id").eq("user_id", user.id);
    const ownedIds = owned?.map((item) => item.id) || [];
    const allIds = [...new Set([...accessIds, ...ownedIds])];

    if (allIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data: coursesData } = await supabase
      .from("courses")
      .select("id, title, description, thumbnail_url, category, modules ( id, title, banner_url, sort_order, lessons ( id ) )")
      .in("id", allIds)
      .order("sort_order");

    if (!coursesData) {
      setLoading(false);
      return;
    }

    const { data: progress } = await supabase.from("user_progress").select("lesson_id, completed, updated_at").eq("user_id", user.id);
    const progressMap = new Map(progress?.map((item) => [item.lesson_id, item]) || []);

    const enriched: CourseWithProgress[] = coursesData.map((course: any) => {
      const allLessons = course.modules?.flatMap((module: any) => module.lessons?.map((lesson: any) => lesson.id) || []) || [];
      const completed = allLessons.filter((id: string) => progressMap.get(id)?.completed);
      let lastLesson: string | null = null;
      let lastTime = 0;

      for (const lessonId of allLessons) {
        const item = progressMap.get(lessonId);
        if (item && new Date(item.updated_at).getTime() > lastTime) {
          lastTime = new Date(item.updated_at).getTime();
          lastLesson = lessonId;
        }
      }

      const modules: ModuleInfo[] = (course.modules || [])
        .map((module: any) => ({
          id: module.id,
          title: module.title,
          banner_url: module.banner_url,
          sort_order: module.sort_order,
          lessonCount: module.lessons?.length || 0,
        }))
        .sort((a, b) => a.sort_order - b.sort_order);

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        category: course.category || "geral",
        totalLessons: allLessons.length,
        completedLessons: completed.length,
        lastLesson,
        modules,
      };
    });

    setCourses(enriched);
    setLoading(false);
  };

  const inProgressCount = courses.filter((course) => getCourseStatus(course) === "in_progress").length;
  const completedCount = courses.filter((course) => getCourseStatus(course) === "completed").length;
  const notStartedCount = courses.filter((course) => getCourseStatus(course) === "not_started").length;
  const totalCompleted = courses.reduce((acc, course) => acc + course.completedLessons, 0);
  const totalLessons = courses.reduce((acc, course) => acc + course.totalLessons, 0);
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  const filtered = useMemo(() => {
    let result = courses;
    if (statusFilter !== "all") result = result.filter((course) => getCourseStatus(course) === statusFilter);
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter((course) => course.title.toLowerCase().includes(query) || course.description?.toLowerCase().includes(query));
    }
    return result;
  }, [courses, search, statusFilter]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  }, []);

  const displayName = user?.email?.split("@")[0] || "Aluno";
  const tabs = [
    { label: "Todos", value: "all" as const, count: courses.length },
    { label: "Em andamento", value: "in_progress" as const, count: inProgressCount },
    { label: "Concluídos", value: "completed" as const, count: completedCount },
    { label: "Não iniciados", value: "not_started" as const, count: notStartedCount },
  ];
  const continueWatching = courses.filter((course) => course.completedLessons > 0 && course.completedLessons < course.totalLessons);
  const freshCourses = courses.filter((course) => getCourseStatus(course) === "not_started");
  const completedCourses = courses.filter((course) => getCourseStatus(course) === "completed");
  const featuredCourse = continueWatching[0] || courses[0] || null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
              <GraduationCap className="h-6 w-6 text-primary/60" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-border flex items-center justify-center mb-5">
          <GraduationCap className="h-9 w-9 text-muted-foreground/20" />
        </div>
        <h2 className="text-xl font-extrabold text-foreground mb-1">{greeting}, {displayName}</h2>
        <p className="text-sm text-muted-foreground max-w-sm">Quando você adquirir um produto, seus cursos aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-28 pt-5 sm:px-6 lg:px-8 md:pb-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
        <MemberHomeHero
          greeting={greeting}
          displayName={displayName}
          coursesCount={courses.length}
          overallPct={overallPct}
          totalCompleted={totalCompleted}
          totalLessons={totalLessons}
          inProgressCount={inProgressCount}
          featuredCourse={featuredCourse}
        />
      </motion.div>

      <section id="member-catalog" className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all duration-150",
                  statusFilter === tab.value ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.count > 0 && <span className={cn("ml-1 text-[10px] tabular-nums", statusFilter === tab.value ? "text-primary" : "text-muted-foreground/50")}>{tab.count}</span>}
              </button>
            ))}
          </div>

          <div className="sm:ml-auto relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar curso…"
              className="h-9 w-full rounded-lg border border-border bg-secondary pl-8 pr-8 text-xs placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3 text-muted-foreground/40" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-8">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card-inset/40 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary">
                <GraduationCap className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">{search || statusFilter !== "all" ? "Nenhum resultado" : "Nenhum curso encontrado"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Tente ajustar os filtros.</p>
            </div>
          ) : search || statusFilter !== "all" ? (
            <MemberCourseShelf title="Resultado da busca" subtitle="Lista direta para entrar no conteúdo certo." courses={filtered} />
          ) : (
            <>
              <MemberCourseShelf title="Continue de onde parou" subtitle="Os cursos com progresso recente aparecem primeiro." courses={continueWatching.slice(0, 6)} />
              <MemberCourseShelf title="Novos para começar" subtitle="Tudo que ainda está zerado, pronto para abrir." courses={freshCourses.slice(0, 6)} />
              <MemberCourseShelf title="Concluídos" subtitle="Seu histórico finalizado fica organizado aqui." courses={completedCourses.slice(0, 6)} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
