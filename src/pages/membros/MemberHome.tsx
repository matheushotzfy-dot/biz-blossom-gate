import { useEffect, useState, useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  GraduationCap, Search, X, ChevronRight, CheckCircle2, Play,
  BookOpen, Layers, Trophy, Flame, BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ModuleInfo = { id: string; title: string; banner_url: string | null; sort_order: number; lessonCount: number };
type CourseWithProgress = {
  id: string; title: string; description: string | null; thumbnail_url: string | null;
  category: string; totalLessons: number; completedLessons: number; lastLesson: string | null; modules: ModuleInfo[];
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function MemberHome() {
  const { user } = useOutletContext<{ user: User }>();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed" | "not_started">("all");

  useEffect(() => { if (user) loadCourses(); }, [user]);

  const loadCourses = async () => {
    if (!user) return;
    const { data: access } = await supabase.from("user_access").select("course_id").eq("user_id", user.id).eq("status", "active");
    const accessIds = access?.map(a => a.course_id) || [];
    const { data: owned } = await supabase.from("courses").select("id").eq("user_id", user.id);
    const ownedIds = owned?.map(c => c.id) || [];
    const allIds = [...new Set([...accessIds, ...ownedIds])];
    if (allIds.length === 0) { setLoading(false); return; }
    const { data: coursesData } = await supabase.from("courses")
      .select("id, title, description, thumbnail_url, category, modules ( id, title, banner_url, sort_order, lessons ( id ) )")
      .in("id", allIds).order("sort_order");
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

  const getStatus = (c: CourseWithProgress) => {
    if (c.totalLessons === 0) return "not_started";
    if (c.completedLessons === c.totalLessons) return "completed";
    if (c.completedLessons > 0) return "in_progress";
    return "not_started";
  };

  const inProgressCount = courses.filter(c => getStatus(c) === "in_progress").length;
  const completedCount = courses.filter(c => getStatus(c) === "completed").length;
  const notStartedCount = courses.filter(c => getStatus(c) === "not_started").length;
  const totalCompleted = courses.reduce((a, c) => a + c.completedLessons, 0);
  const totalLessons = courses.reduce((a, c) => a + c.totalLessons, 0);
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  const filtered = useMemo(() => {
    let result = courses;
    if (statusFilter !== "all") result = result.filter(c => getStatus(c) === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    }
    return result;
  }, [courses, search, statusFilter]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }, []);
  const displayName = user?.email?.split("@")[0] || "Aluno";

  const tabs = [
    { label: "Todos", value: "all" as const, count: courses.length },
    { label: "Em andamento", value: "in_progress" as const, count: inProgressCount },
    { label: "Concluídos", value: "completed" as const, count: completedCount },
    { label: "Não iniciados", value: "not_started" as const, count: notStartedCount },
  ];

  const continueWatching = courses.filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons);

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

  if (courses.length === 0) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-border flex items-center justify-center mb-5">
        <GraduationCap className="h-9 w-9 text-muted-foreground/20" />
      </div>
      <h2 className="text-xl font-extrabold text-foreground mb-1">{greeting}, {displayName}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Quando você adquirir um produto, seus cursos aparecerão aqui.
      </p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 pb-28 md:pb-16">
      {/* ── Hero Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="pt-6 pb-2"
      >
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          {greeting}, <span className="text-primary">{displayName}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{courses.length} curso{courses.length !== 1 && "s"} disponíve{courses.length !== 1 ? "is" : "l"}</p>
      </motion.div>

      {/* ── Stats Row ── */}
      {totalLessons > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease }}
          className="grid grid-cols-3 gap-3 mt-4 mb-6"
        >
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-foreground tabular-nums">{overallPct}%</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Progresso</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-foreground tabular-nums">{totalCompleted}<span className="text-sm text-muted-foreground font-normal">/{totalLessons}</span></p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Aulas</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <Flame className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-foreground tabular-nums">{inProgressCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Em andamento</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Continue Watching ── */}
      {continueWatching.length > 0 && statusFilter === "all" && !search && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-3">
            <Play className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Continue assistindo</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {continueWatching.slice(0, 3).map(c => {
              const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
              return (
                <Link key={c.id} to={`/membros-area/curso/${c.id}`}
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
        </motion.section>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "relative rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all duration-150",
                statusFilter === t.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn("ml-1 text-[10px] tabular-nums", statusFilter === t.value ? "text-primary" : "text-muted-foreground/50")}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar curso…"
            className="h-8 w-full rounded-lg border border-border bg-secondary pl-8 pr-8 text-xs placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-shadow"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground/40" />
            </button>
          )}
        </div>
      </div>

      {/* ── Course Grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary">
            <GraduationCap className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">
            {search || statusFilter !== "all" ? "Nenhum resultado" : "Nenhum curso encontrado"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Tente ajustar os filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c, i) => {
            const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
            const status = getStatus(c);
            const isFinished = status === "completed";
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05, ease }}
              >
                <Link to={`/membros-area/curso/${c.id}`}
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
                    {isFinished ? (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-success/20 backdrop-blur-sm border border-success/20">
                        <Trophy className="h-3 w-3 text-success" />
                        <span className="text-[10px] font-bold text-success">Concluído</span>
                      </div>
                    ) : pct > 0 ? (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-background/70 backdrop-blur-sm border border-border/20">
                        <span className="text-[10px] font-bold text-foreground tabular-nums">{pct}%</span>
                      </div>
                    ) : null}
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
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
