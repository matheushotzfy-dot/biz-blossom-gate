import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Search, BookOpen, ChevronRight, CheckCircle2, X, GraduationCap,
  Play, Layers, Trophy, Flame, Clock, BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ModuleInfo = { id: string; title: string; banner_url: string | null; sort_order: number; lessonCount: number };
type CourseWithProgress = {
  id: string; title: string; description: string | null; thumbnail_url: string | null;
  category: string; totalLessons: number; completedLessons: number; lastLesson: string | null; modules: ModuleInfo[];
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function MemberArea() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => { if (user) loadCourses(); }, [user]);

  const loadCourses = async () => {
    if (!user) return;
    const { data: access } = await supabase.from("user_access").select("course_id").eq("user_id", user.id).eq("status", "active");
    const accessCourseIds = access?.map(a => a.course_id) || [];
    const { data: ownedCourses } = await supabase.from("courses").select("id").eq("user_id", user.id);
    const ownedCourseIds = ownedCourses?.map(c => c.id) || [];
    const allCourseIds = [...new Set([...accessCourseIds, ...ownedCourseIds])];
    if (allCourseIds.length === 0) { setLoading(false); return; }
    const { data: coursesData } = await supabase.from("courses")
      .select("id, title, description, thumbnail_url, category, user_id, modules ( id, title, banner_url, sort_order, lessons ( id ) )")
      .in("id", allCourseIds).order("sort_order");
    if (!coursesData) { setLoading(false); return; }
    const { data: progress } = await supabase.from("user_progress").select("lesson_id, completed, updated_at").eq("user_id", user.id);
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
        id: m.id, title: m.title, banner_url: m.banner_url, sort_order: m.sort_order, lessonCount: m.lessons?.length || 0,
      })).sort((a: ModuleInfo, b: ModuleInfo) => a.sort_order - b.sort_order);
      return { id: c.id, title: c.title, description: c.description, thumbnail_url: c.thumbnail_url, category: c.category || "geral", totalLessons: allLessons.length, completedLessons: completed.length, lastLesson, modules };
    });
    setCourses(enriched);
    setLoading(false);
  };

  const categories = useMemo(() => [...new Set(courses.map(c => c.category).filter(Boolean))], [courses]);
  const filtered = useMemo(() => {
    let result = courses;
    if (search.trim()) { const q = search.toLowerCase(); result = result.filter(c => c.title.toLowerCase().includes(q)); }
    if (activeFilter) result = result.filter(c => c.category === activeFilter);
    return result;
  }, [courses, search, activeFilter]);

  const totalCompleted = courses.reduce((a, c) => a + c.completedLessons, 0);
  const totalLessons = courses.reduce((a, c) => a + c.totalLessons, 0);
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;
  const continueWatching = courses.filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons);
  const completedCourses = courses.filter(c => c.totalLessons > 0 && c.completedLessons === c.totalLessons).length;

  if (loading) return (
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

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-24 md:pb-10">
      {/* ── Header ── */}
      <div className="px-5 pt-1 sm:px-7 md:pt-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 border border-border">
              <GraduationCap className="h-5 w-5 text-primary" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                Área de Membros
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">
                  {courses.length} curso{courses.length !== 1 ? "s" : ""} disponíve{courses.length !== 1 ? "is" : "l"}
                </p>
                {completedCourses > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success/70">
                    <Trophy className="h-3 w-3" />
                    {completedCourses} concluído{completedCourses !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        {totalLessons > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Progresso</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-extrabold text-foreground tabular-nums">{overallPct}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallPct}%` }}
                  transition={{ duration: 1, delay: 0.3, ease }}
                  className={cn("h-full rounded-full", overallPct === 100 ? "bg-success" : "bg-primary")}
                />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Concluídas</span>
              </div>
              <span className="text-2xl font-extrabold text-foreground tabular-nums">{totalCompleted}</span>
              <p className="text-[10px] text-muted-foreground mt-1">de {totalLessons} aulas</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Flame className="h-3.5 w-3.5 text-warning" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Em andamento</span>
              </div>
              <span className="text-2xl font-extrabold text-foreground tabular-nums">{continueWatching.length}</span>
              <p className="text-[10px] text-muted-foreground mt-1">curso{continueWatching.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-info/10 flex items-center justify-center">
                  <Layers className="h-3.5 w-3.5 text-info" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Módulos</span>
              </div>
              <span className="text-2xl font-extrabold text-foreground tabular-nums">
                {courses.reduce((a, c) => a + c.modules.length, 0)}
              </span>
              <p className="text-[10px] text-muted-foreground mt-1">no total</p>
            </div>
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5">
            <button
              onClick={() => setActiveFilter(null)}
              className={cn(
                "relative rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all duration-150",
                !activeFilter ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todos
              <span className={cn("ml-1 text-[10px] tabular-nums", !activeFilter ? "text-primary" : "text-muted-foreground/50")}>{courses.length}</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all duration-150 capitalize",
                  activeFilter === cat ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar curso…"
              className="h-8 w-full rounded-lg border border-border bg-secondary pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 sm:w-52"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-5 mt-5 h-px bg-border sm:mx-7" />

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-32 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary">
            <GraduationCap className="h-7 w-7 text-muted-foreground" strokeWidth={1.4} />
          </div>
          <p className="mt-5 text-sm font-semibold text-foreground">Nenhum curso disponível</p>
          <p className="mt-1.5 max-w-[280px] text-xs leading-relaxed text-muted-foreground">
            Adquira um produto para ter acesso aos cursos e conteúdos exclusivos.
          </p>
        </div>
      ) : (
        <div className="px-5 pt-5 pb-8 sm:px-7 space-y-6">
          {/* Continue watching */}
          {continueWatching.length > 0 && !search && !activeFilter && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Play className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Continue assistindo</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {continueWatching.map(c => {
                  const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
                  return (
                    <Link key={c.id} to={`/membros/curso/${c.id}`}
                      className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                      <div className="aspect-video bg-muted relative overflow-hidden">
                        {c.thumbnail_url ? (
                          <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent">
                            <BookOpen className="h-8 w-8 text-muted-foreground/15" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
                          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-background/70 backdrop-blur-sm border border-border/20">
                          <Flame className="h-3 w-3 text-warning" />
                          <span className="text-[10px] font-bold text-foreground tabular-nums">{pct}%</span>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="h-12 w-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-xl shadow-primary/30">
                            <Play className="h-5 w-5 text-primary-foreground ml-0.5 fill-current" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3.5">
                        <p className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{c.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{c.completedLessons}/{c.totalLessons} aulas · {c.modules.length} módulo{c.modules.length !== 1 ? "s" : ""}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* All Courses */}
          <section>
            {!search && !activeFilter && continueWatching.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-sm font-bold text-foreground">Todos os cursos</h2>
              </div>
            )}
            {search && (
              <p className="text-xs text-muted-foreground mb-3">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para "<span className="text-foreground font-medium">{search}</span>"
              </p>
            )}

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary">
                  <Search className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">Nenhum resultado</p>
                <p className="mt-1 text-xs text-muted-foreground">Tente ajustar os filtros.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((c, i) => {
                  const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
                  const isFinished = pct === 100 && c.totalLessons > 0;
                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.05, ease }}
                    >
                      <Link to={`/membros/curso/${c.id}`}
                        className="group block rounded-xl border border-border bg-card overflow-hidden hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                        <div className="aspect-video bg-muted relative overflow-hidden">
                          {c.thumbnail_url ? (
                            <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent">
                              <BookOpen className="h-10 w-10 text-muted-foreground/10" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                          {isFinished && (
                            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-success/20 backdrop-blur-sm border border-success/20">
                              <Trophy className="h-3 w-3 text-success" />
                              <span className="text-[10px] font-bold text-success">Concluído</span>
                            </div>
                          )}
                          {!isFinished && pct > 0 && (
                            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-background/70 backdrop-blur-sm border border-border/20">
                              <span className="text-[10px] font-bold text-foreground tabular-nums">{pct}%</span>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
                            <div className={cn("h-full transition-all", isFinished ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="h-12 w-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-xl shadow-primary/30">
                              <Play className="h-5 w-5 text-primary-foreground ml-0.5 fill-current" />
                            </div>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{c.title}</h3>
                          {c.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">{c.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {c.totalLessons} aula{c.totalLessons !== 1 ? "s" : ""}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              {c.modules.length} módulo{c.modules.length !== 1 ? "s" : ""}
                            </span>
                            {c.category && (
                              <span className="ml-auto text-[9px] font-medium text-muted-foreground/60 px-2 py-0.5 rounded-full bg-secondary capitalize">
                                {c.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
