import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Play, Clock, BookOpen, TrendingUp, ChevronRight } from "lucide-react";

type ModuleInfo = { id: string; title: string; banner_url: string | null; sort_order: number; lessonCount: number };
type CourseWithProgress = {
  id: string; title: string; description: string | null; thumbnail_url: string | null;
  category: string; totalLessons: number; completedLessons: number; lastLesson: string | null;
  modules: ModuleInfo[];
};

export default function MemberHome() {
  const { user } = useOutletContext<{ user: User }>();
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadCourses();
  }, [user]);

  const loadCourses = async () => {
    if (!user) return;
    const { data: access } = await supabase
      .from("user_access").select("course_id").eq("user_id", user.id).eq("status", "active");
    if (!access || access.length === 0) { setLoading(false); return; }

    const courseIds = access.map(a => a.course_id);
    const { data: coursesData } = await supabase
      .from("courses")
      .select("id, title, description, thumbnail_url, category, modules ( id, title, banner_url, sort_order, lessons ( id ) )")
      .in("id", courseIds).eq("is_published", true).order("sort_order");
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

  const continueWatching = courses.filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons);
  const totalCompleted = courses.reduce((a, c) => a + c.completedLessons, 0);
  const totalLessons = courses.reduce((a, c) => a + c.totalLessons, 0);
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="h-24 w-24 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
          <BookOpen className="h-12 w-12 text-zinc-700" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Nenhum conteúdo disponível</h2>
        <p className="text-sm text-zinc-500 max-w-md">Quando você adquirir um produto, seus cursos aparecerão aqui automaticamente.</p>
      </div>
    );
  }

  // Featured course = the one with most progress or first
  const featured = continueWatching[0] || courses[0];
  const featuredPct = featured.totalLessons > 0 ? Math.round((featured.completedLessons / featured.totalLessons) * 100) : 0;

  return (
    <div className="pb-16">
      {/* Hero Banner */}
      <div className="relative h-[50vh] min-h-[380px] max-h-[520px] overflow-hidden">
        {featured.thumbnail_url ? (
          <img src={featured.thumbnail_url} alt={featured.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-zinc-900" />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/80 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 max-w-7xl mx-auto">
          <div className="max-w-xl">
            <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-3">
              {continueWatching.length > 0 ? "Continuar assistindo" : "Destaque"}
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-2">{featured.title}</h1>
            {featured.description && (
              <p className="text-sm text-zinc-400 line-clamp-2 mb-4">{featured.description}</p>
            )}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 max-w-[200px]">
                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${featuredPct}%` }} />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">{featured.completedLessons}/{featured.totalLessons} aulas • {featuredPct}%</p>
              </div>
            </div>
            <Link
              to={`/membros-area/curso/${featured.id}`}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors"
            >
              <Play className="h-4 w-4 fill-current" />
              {continueWatching.length > 0 ? "Continuar" : "Assistir"}
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10 mt-8">
        {/* Overall progress */}
        {totalLessons > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/50">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400 font-medium">Progresso geral</span>
                <span className="text-xs font-bold text-emerald-500">{overallPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${overallPct}%` }} />
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">{totalCompleted} de {totalLessons} aulas concluídas</p>
            </div>
          </div>
        )}

        {/* Continue Watching Row */}
        {continueWatching.length > 1 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="h-5 w-5 text-emerald-500" /> Continue Assistindo
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
              {continueWatching.map(c => <ContinueCard key={c.id} course={c} />)}
            </div>
          </section>
        )}

        {/* All Courses - Netflix Rows */}
        {courses.map(course => (
          <section key={course.id}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">{course.title}</h2>
              <Link to={`/membros-area/curso/${course.id}`} className="text-xs text-emerald-500 hover:text-emerald-400 font-medium flex items-center gap-1 transition-colors">
                Ver tudo <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
              {course.modules.length > 0 ? course.modules.map(mod => (
                <Link
                  key={mod.id}
                  to={`/membros-area/curso/${course.id}?module=${mod.id}`}
                  className="group shrink-0 w-[220px] md:w-[260px]"
                >
                  <div className="aspect-video rounded-xl overflow-hidden relative bg-zinc-900">
                    {mod.banner_url ? (
                      <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900/30 to-zinc-900">
                        <BookOpen className="h-8 w-8 text-emerald-500/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-sm font-bold line-clamp-1">{mod.title}</p>
                      <p className="text-zinc-400 text-[10px] mt-0.5">{mod.lessonCount} aulas</p>
                    </div>
                    {/* Hover Play */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                        <Play className="h-5 w-5 text-black ml-0.5 fill-current" />
                      </div>
                    </div>
                  </div>
                </Link>
              )) : (
                <Link to={`/membros-area/curso/${course.id}`} className="shrink-0 w-[220px] md:w-[260px]">
                  <div className="aspect-video rounded-xl overflow-hidden relative bg-zinc-900">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900/30 to-zinc-900">
                        <BookOpen className="h-8 w-8 text-emerald-500/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-sm font-bold">{course.title}</p>
                      <p className="text-zinc-400 text-[10px]">{course.totalLessons} aulas</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ContinueCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  return (
    <Link to={`/membros-area/curso/${course.id}`} className="group shrink-0 w-[280px] md:w-[320px] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/50 hover:border-emerald-500/30 transition-all">
      <div className="aspect-video relative overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900/30 to-zinc-900">
            <BookOpen className="h-10 w-10 text-emerald-500/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
            <Play className="h-5 w-5 text-black ml-0.5 fill-current" />
          </div>
        </div>
        {/* Progress bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm text-white line-clamp-1">{course.title}</h3>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {pct}%</span>
          <span>{course.completedLessons}/{course.totalLessons} aulas</span>
        </div>
      </div>
    </Link>
  );
}
