import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Play, Clock, BookOpen, TrendingUp, ChevronRight, Award, Zap, Sparkles, GraduationCap } from "lucide-react";

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

  useEffect(() => { if (user) loadCourses(); }, [user]);

  const loadCourses = async () => {
    if (!user) return;
    
    // Get purchased course access
    const { data: access } = await supabase.from("user_access").select("course_id").eq("user_id", user.id).eq("status", "active");
    const accessIds = access?.map(a => a.course_id) || [];
    
    // Get owned courses (seller auto-access)
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
  const completedCourses = courses.filter(c => c.totalLessons > 0 && c.completedLessons === c.totalLessons).length;

  if (loading) return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <div className="h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-zinc-600 text-xs">Carregando seus cursos...</p>
      </div>
    </div>
  );

  if (courses.length === 0) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-3xl w-40 h-40 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
        <div className="relative h-24 w-24 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          <GraduationCap className="h-12 w-12 text-zinc-700" />
        </div>
      </div>
      <h2 className="text-2xl font-extrabold text-white mb-2">Bem-vindo à sua área de membros</h2>
      <p className="text-sm text-zinc-500 max-w-md leading-relaxed">
        Quando você adquirir um produto, seus cursos e conteúdos aparecerão aqui automaticamente.
      </p>
    </div>
  );

  const featured = continueWatching[0] || courses[0];
  const featuredPct = featured.totalLessons > 0 ? Math.round((featured.completedLessons / featured.totalLessons) * 100) : 0;
  const greeting = (() => { const h = new Date().getHours(); if (h < 12) return "Bom dia"; if (h < 18) return "Boa tarde"; return "Boa noite"; })();

  return (
    <div className="pb-20">
      {/* ═══ Hero Banner ═══ */}
      <div className="relative h-[55vh] min-h-[400px] max-h-[560px] overflow-hidden">
        {featured.thumbnail_url ? (
          <img src={featured.thumbnail_url} alt={featured.title} className="absolute inset-0 w-full h-full object-cover scale-[1.02]" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-zinc-900 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/50 to-[#09090b]/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/90 via-[#09090b]/30 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 max-w-7xl mx-auto">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 backdrop-blur-sm">
                <Zap className="h-3 w-3" />
                {continueWatching.length > 0 ? "Continue de onde parou" : "Em destaque"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-[1.1] tracking-tight mb-3">
              {featured.title}
            </h1>
            {featured.description && (
              <p className="text-sm sm:text-base text-zinc-400 line-clamp-2 mb-5 leading-relaxed max-w-lg">{featured.description}</p>
            )}
            <div className="flex items-center gap-5 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-32 sm:w-44">
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${featuredPct}%` }} />
                  </div>
                </div>
                <span className="text-xs text-zinc-500 font-medium">{featuredPct}%</span>
              </div>
              <span className="text-xs text-zinc-600">{featured.completedLessons}/{featured.totalLessons} aulas</span>
            </div>
            <Link to={`/membros-area/curso/${featured.id}`}
              className="inline-flex items-center gap-2.5 h-12 px-7 rounded-xl bg-white text-black text-sm font-extrabold hover:bg-zinc-100 transition-all hover:scale-[1.02] shadow-xl shadow-black/30 active:scale-[0.98]">
              <Play className="h-4 w-4 fill-current" />
              {continueWatching.length > 0 ? "Continuar assistindo" : "Começar agora"}
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10 mt-8">
        {/* ═══ Welcome + Stats ═══ */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Greeting */}
          <div className="flex-1 p-5 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-zinc-800/40 backdrop-blur-sm">
            <p className="text-zinc-500 text-xs font-medium mb-1">{greeting} 👋</p>
            <p className="text-lg font-extrabold text-white tracking-tight">{user?.email?.split("@")[0]}</p>
            <p className="text-xs text-zinc-600 mt-1">
              {courses.length} {courses.length === 1 ? "curso disponível" : "cursos disponíveis"}
            </p>
          </div>

          {/* Stats */}
          {totalLessons > 0 && (
            <div className="flex gap-3 sm:gap-4">
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Progresso" value={`${overallPct}%`} color="emerald" />
              <StatCard icon={<BookOpen className="h-4 w-4" />} label="Aulas" value={`${totalCompleted}/${totalLessons}`} color="blue" />
              {completedCourses > 0 && <StatCard icon={<Award className="h-4 w-4" />} label="Concluídos" value={String(completedCourses)} color="amber" />}
            </div>
          )}
        </div>

        {/* ═══ Overall Progress Bar ═══ */}
        {totalLessons > 0 && (
          <div className="rounded-2xl p-5 bg-zinc-900/60 border border-zinc-800/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="text-sm font-bold text-white">Progresso geral</span>
              </div>
              <span className="text-sm font-extrabold text-emerald-500">{overallPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out" style={{ width: `${overallPct}%` }} />
            </div>
            <p className="text-[10px] text-zinc-600 mt-2">{totalCompleted} de {totalLessons} aulas concluídas • {completedCourses} {completedCourses === 1 ? "curso completo" : "cursos completos"}</p>
          </div>
        )}

        {/* ═══ Continue Watching ═══ */}
        {continueWatching.length > 0 && (
          <section>
            <SectionHeader icon={<Play className="h-4 w-4 text-emerald-500 fill-emerald-500" />} title="Continue Assistindo" />
            <div className="flex gap-4 overflow-x-auto pb-3 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory">
              {continueWatching.map(c => <ContinueCard key={c.id} course={c} />)}
            </div>
          </section>
        )}

        {/* ═══ My Courses ═══ */}
        <section>
          <SectionHeader icon={<BookOpen className="h-4 w-4 text-white" />} title="Meus Cursos" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(course => <CourseCard key={course.id} course={course} />)}
          </div>
        </section>

        {/* ═══ Module Carousels ═══ */}
        {courses.filter(c => c.modules.length > 1).map(course => (
          <section key={course.id}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">{course.title}</h3>
              <Link to={`/membros-area/curso/${course.id}`} className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold flex items-center gap-1 transition-colors">
                Ver curso <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 scrollbar-hide snap-x">
              {course.modules.map(mod => (
                <Link key={mod.id} to={`/membros-area/curso/${course.id}?module=${mod.id}`} className="group shrink-0 w-[200px] md:w-[240px] snap-start">
                  <div className="aspect-video rounded-xl overflow-hidden relative bg-zinc-900 border border-zinc-800/30 group-hover:border-emerald-500/30 transition-all">
                    {mod.banner_url ? (
                      <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900/20 to-zinc-900">
                        <BookOpen className="h-7 w-7 text-emerald-500/15" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-xs font-bold line-clamp-1">{mod.title}</p>
                      <p className="text-zinc-500 text-[10px] mt-0.5">{mod.lessonCount} aulas</p>
                    </div>
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                        <Play className="h-4 w-4 text-black ml-0.5 fill-current" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ─── Sub Components ─── */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      {icon}
      <h2 className="text-base font-extrabold text-white tracking-tight">{title}</h2>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-500",
    blue: "bg-blue-500/10 text-blue-500",
    amber: "bg-amber-500/10 text-amber-500",
  };
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/30 min-w-[100px]">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>{icon}</div>
      <span className="text-lg font-extrabold text-white tracking-tight">{value}</span>
      <span className="text-[10px] text-zinc-500 font-medium">{label}</span>
    </div>
  );
}

function CourseCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isComplete = pct === 100 && course.totalLessons > 0;

  return (
    <Link to={`/membros-area/curso/${course.id}`}
      className="group rounded-2xl overflow-hidden bg-zinc-900/60 border border-zinc-800/30 hover:border-emerald-500/20 transition-all hover:shadow-xl hover:shadow-emerald-500/5">
      <div className="aspect-video relative overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900/20 to-zinc-900">
            <BookOpen className="h-10 w-10 text-emerald-500/15" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="h-6 w-6 text-black ml-0.5 fill-current" />
          </div>
        </div>
        {/* Progress bar */}
        {pct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
            <div className={`h-full transition-all duration-700 ${isComplete ? "bg-emerald-400" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
          </div>
        )}
        {isComplete && (
          <div className="absolute top-3 right-3 h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg">
            <Award className="h-4 w-4 text-white" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-black/50 backdrop-blur-sm text-zinc-300 border border-white/5">
            {course.category}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-emerald-400 transition-colors">{course.title}</h3>
        {course.description && <p className="text-[11px] text-zinc-600 line-clamp-1 mt-1">{course.description}</p>}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {course.modules.length} módulos</span>
            <span>{course.totalLessons} aulas</span>
          </div>
          {pct > 0 && <span className="text-[11px] font-bold text-emerald-500">{pct}%</span>}
        </div>
      </div>
    </Link>
  );
}

function ContinueCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  return (
    <Link to={`/membros-area/curso/${course.id}`}
      className="group shrink-0 w-[300px] md:w-[340px] snap-start rounded-2xl overflow-hidden bg-zinc-900/60 border border-zinc-800/30 hover:border-emerald-500/20 transition-all hover:shadow-xl hover:shadow-emerald-500/5">
      <div className="aspect-video relative overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-900/20 to-zinc-900">
            <BookOpen className="h-10 w-10 text-emerald-500/15" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
            <Play className="h-5 w-5 text-black ml-0.5 fill-current" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-sm text-white line-clamp-1">{course.title}</h3>
        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {pct}% concluído</span>
          <span>{course.completedLessons}/{course.totalLessons} aulas</span>
        </div>
      </div>
    </Link>
  );
}
