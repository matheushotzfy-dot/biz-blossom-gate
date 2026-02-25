import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, Clock, CheckCircle2, Lock, Search, BookOpen, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";

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
      .select(`id, title, description, thumbnail_url, category, modules ( id, title, banner_url, sort_order, lessons ( id ) )`)
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

      return { id: c.id, title: c.title, description: c.description, thumbnail_url: c.thumbnail_url, category: c.category, totalLessons: allLessons.length, completedLessons: completed.length, lastLesson, modules };
    });

    setCourses(enriched);
    setLoading(false);
  };

  const continueWatching = courses.filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons);
  const filtered = courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  const totalCompleted = courses.reduce((a, c) => a + c.completedLessons, 0);
  const totalLessons = courses.reduce((a, c) => a + c.totalLessons, 0);
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-card to-muted/30 border border-border p-6 md:p-8">
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">
            Área de Membros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Seus cursos e conteúdos exclusivos</p>

          {courses.length > 0 && (
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-primary" /> Progresso geral
                </span>
                <span className="text-xs font-bold text-primary">{overallPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${overallPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{totalCompleted} de {totalLessons} aulas concluídas</p>
            </div>
          )}
        </div>

        <div className="mt-4 relative z-10 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cursos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/50"
          />
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-20 w-20 rounded-full bg-muted/20 flex items-center justify-center mb-4">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Nenhum curso disponível</h2>
          <p className="text-muted-foreground text-sm max-w-md">
            Adquira um produto para ter acesso aos cursos e conteúdos exclusivos.
          </p>
        </div>
      ) : (
        <>
          {/* Continue Watching */}
          {continueWatching.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" /> Continue Assistindo
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
                {continueWatching.map(course => (
                  <ContinueCard key={course.id} course={course} />
                ))}
              </div>
            </section>
          )}

          {/* All Courses - Netflix Style */}
          {filtered.map(course => (
            <section key={course.id}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{course.title}</h2>
                  {course.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{course.description}</p>
                  )}
                </div>
                <Link to={`/membros/curso/${course.id}`} className="text-xs text-primary hover:underline font-medium">
                  Ver tudo →
                </Link>
              </div>

              {/* Module Banner Grid */}
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
                {course.modules.map(mod => (
                  <Link
                    key={mod.id}
                    to={`/membros/curso/${course.id}?module=${mod.id}`}
                    className="group shrink-0 w-[200px] md:w-[240px]"
                  >
                    <div className="aspect-video rounded-xl overflow-hidden bg-muted/20 relative">
                      {mod.banner_url ? (
                        <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                          <BookOpen className="h-8 w-8 text-primary/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white text-sm font-bold line-clamp-1">{mod.title}</p>
                        <p className="text-white/60 text-[10px] mt-0.5">{mod.lessonCount} aulas</p>
                      </div>
                      {/* Hover Play */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="h-10 w-10 rounded-full bg-primary/90 flex items-center justify-center">
                          <Play className="h-4 w-4 text-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                {course.modules.length === 0 && (
                  <Link to={`/membros/curso/${course.id}`} className="shrink-0 w-[200px] md:w-[240px]">
                    <div className="aspect-video rounded-xl overflow-hidden bg-muted/20 relative">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                          <BookOpen className="h-8 w-8 text-primary/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white text-sm font-bold">{course.title}</p>
                        <p className="text-white/60 text-[10px]">{course.totalLessons} aulas</p>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function ContinueCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;

  return (
    <Link
      to={`/membros/curso/${course.id}`}
      className="group shrink-0 w-[280px] md:w-[320px] rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all"
    >
      <div className="aspect-video bg-muted/20 relative overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <BookOpen className="h-10 w-10 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="h-5 w-5 text-white ml-0.5" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-1">{course.title}</h3>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {pct}%</span>
          <span>{course.completedLessons}/{course.totalLessons} aulas</span>
        </div>
      </div>
    </Link>
  );
}
