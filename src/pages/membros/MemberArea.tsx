import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, BookOpen, ChevronRight, CheckCircle2, X, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

type ModuleInfo = {
  id: string;
  title: string;
  banner_url: string | null;
  sort_order: number;
  lessonCount: number;
};

type CourseWithProgress = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  totalLessons: number;
  completedLessons: number;
  lastLesson: string | null;
  modules: ModuleInfo[];
};

export default function MemberArea() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadCourses();
  }, [user]);

  const loadCourses = async () => {
    if (!user) return;
    const { data: access } = await supabase
      .from("user_access").select("course_id").eq("user_id", user.id).eq("status", "active");
    const accessCourseIds = access?.map(a => a.course_id) || [];
    const { data: ownedCourses } = await supabase
      .from("courses").select("id").eq("user_id", user.id);
    const ownedCourseIds = ownedCourses?.map(c => c.id) || [];
    const allCourseIds = [...new Set([...accessCourseIds, ...ownedCourseIds])];
    if (allCourseIds.length === 0) { setLoading(false); return; }

    const { data: coursesData } = await supabase
      .from("courses")
      .select("id, title, description, thumbnail_url, category, user_id, modules ( id, title, banner_url, sort_order, lessons ( id ) )")
      .in("id", allCourseIds).order("sort_order");
    if (!coursesData) { setLoading(false); return; }

    const { data: progress } = await supabase
      .from("user_progress").select("lesson_id, completed, updated_at").eq("user_id", user.id);
    const progressMap = new Map(progress?.map(p => [p.lesson_id, p]) || []);

    const enriched: CourseWithProgress[] = coursesData.map((c: any) => {
      const allLessons = c.modules?.flatMap((m: any) => m.lessons?.map((l: any) => l.id) || []) || [];
      const completed = allLessons.filter((id: string) => progressMap.get(id)?.completed);
      let lastLesson: string | null = null;
      let lastTime = 0;
      for (const lid of allLessons) {
        const p = progressMap.get(lid);
        if (p && new Date(p.updated_at).getTime() > lastTime) { lastTime = new Date(p.updated_at).getTime(); lastLesson = lid; }
      }
      const modules: ModuleInfo[] = (c.modules || []).map((m: any) => ({
        id: m.id, title: m.title, banner_url: m.banner_url, sort_order: m.sort_order,
        lessonCount: m.lessons?.length || 0,
      })).sort((a: ModuleInfo, b: ModuleInfo) => a.sort_order - b.sort_order);

      return { id: c.id, title: c.title, description: c.description, thumbnail_url: c.thumbnail_url, category: c.category || "geral", totalLessons: allLessons.length, completedLessons: completed.length, lastLesson, modules };
    });

    setCourses(enriched);
    setLoading(false);
  };

  const categories = useMemo(() => [...new Set(courses.map(c => c.category).filter(Boolean))], [courses]);

  const filtered = useMemo(() => {
    let result = courses;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.title.toLowerCase().includes(q));
    }
    if (activeFilter) result = result.filter(c => c.category === activeFilter);
    return result;
  }, [courses, search, activeFilter]);

  const totalCompleted = courses.reduce((a, c) => a + c.completedLessons, 0);
  const totalLessons = courses.reduce((a, c) => a + c.totalLessons, 0);
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;
  const continueWatching = courses.filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons);

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Área de Membros</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {courses.length} curso{courses.length !== 1 ? "s" : ""} disponíve{courses.length !== 1 ? "is" : "l"}
          </p>
        </div>
      </div>

      {/* Progress */}
      {totalLessons > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-medium text-foreground">Progresso geral</span>
              <span className="text-[13px] font-semibold text-foreground tabular-nums">{overallPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${overallPct}%` }} />
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6 pl-4 border-l border-border">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">{totalCompleted}</p>
              <p className="text-[11px] text-muted-foreground">concluídas</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">{totalLessons}</p>
              <p className="text-[11px] text-muted-foreground">total</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {categories.length > 1 && (
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border">
            <button
              onClick={() => setActiveFilter(null)}
              className={cn(
                "px-3 py-2 text-[13px] font-medium transition-colors relative shrink-0",
                !activeFilter ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todos
              {!activeFilter && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                className={cn(
                  "px-3 py-2 text-[13px] font-medium transition-colors relative shrink-0 capitalize",
                  activeFilter === cat ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cat}
                {activeFilter === cat && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
            ))}
          </div>
        )}
        <div className="sm:ml-auto relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar curso…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-shadow"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground/40" />
            </button>
          )}
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground/15 mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-1">Nenhum curso disponível</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            Adquira um produto para ter acesso aos cursos e conteúdos exclusivos.
          </p>
        </div>
      ) : (
        <>
          {/* Continue watching */}
          {continueWatching.length > 0 && !search && !activeFilter && (
            <section>
              <h2 className="text-[15px] font-semibold text-foreground mb-3">Continue assistindo</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {continueWatching.map(c => {
                  const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
                  return (
                    <Link key={c.id} to={`/membros/curso/${c.id}`}
                      className="group flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
                      <div className="h-14 w-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                        {c.thumbnail_url ? (
                          <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-muted-foreground/20" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{c.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{pct}%</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 group-hover:text-foreground transition-colors" />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* All courses - flat list */}
          <section>
            {!search && !activeFilter && (
              <h2 className="text-[15px] font-semibold text-foreground mb-3">Todos os cursos</h2>
            )}
            {search && (
              <p className="text-[13px] text-muted-foreground mb-3">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para "{search}"
              </p>
            )}

            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum curso encontrado</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border/50">
                {filtered.map(c => {
                  const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
                  const isFinished = pct === 100 && c.totalLessons > 0;
                  return (
                    <Link key={c.id} to={`/membros/curso/${c.id}`}
                      className="group flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-muted/20 transition-colors">
                      <div className="h-16 w-24 sm:h-20 sm:w-32 rounded-lg overflow-hidden shrink-0 bg-muted">
                        {c.thumbnail_url ? (
                          <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-muted-foreground/15" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-[14px] font-semibold text-foreground truncate">{c.title}</h3>
                            {c.description && (
                              <p className="text-[12px] text-muted-foreground line-clamp-1 mt-0.5 hidden sm:block">{c.description}</p>
                            )}
                          </div>
                          {isFinished && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex-1 max-w-[200px] h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", isFinished ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{pct}%</span>
                          <span className="text-[11px] text-muted-foreground/50 hidden sm:inline">
                            {c.completedLessons}/{c.totalLessons} aulas · {c.modules.length} módulo{c.modules.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 group-hover:text-foreground transition-colors hidden sm:block" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
