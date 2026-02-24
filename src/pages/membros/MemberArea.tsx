import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, Clock, CheckCircle2, Lock, Search, BookOpen, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";

type CourseWithProgress = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  totalLessons: number;
  completedLessons: number;
  lastLesson: string | null;
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
      .select(`id, title, description, thumbnail_url, category, modules ( id, lessons ( id ) )`)
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
      return { id: c.id, title: c.title, description: c.description, thumbnail_url: c.thumbnail_url, category: c.category, totalLessons: allLessons.length, completedLessons: completed.length, lastLesson };
    });

    setCourses(enriched);
    setLoading(false);
  };

  const continueWatching = courses.filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons);
  const filtered = courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  const categories = [...new Set(courses.map(c => c.category))];
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
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-primary" /> Área de Membros
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm mt-1">Seus cursos e conteúdos exclusivos</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cursos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card/60 border-border/30 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Overall progress */}
        {courses.length > 0 && (
          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Progresso geral
              </span>
              <span className="text-xs font-bold text-primary">{overallPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700" style={{ width: `${overallPct}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">{totalCompleted} de {totalLessons} aulas concluídas</p>
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-20 text-center">
          <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-muted/20 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 md:h-10 md:w-10 text-muted-foreground" />
          </div>
          <h2 className="text-lg md:text-xl font-semibold mb-2">Nenhum curso disponível</h2>
          <p className="text-muted-foreground text-xs md:text-sm max-w-md">
            Adquira um produto para ter acesso aos cursos e conteúdos exclusivos.
          </p>
        </div>
      ) : (
        <>
          {/* Continue Watching */}
          {continueWatching.length > 0 && (
            <section>
              <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
                <Play className="h-4 w-4 md:h-5 md:w-5 text-primary" /> Continue Assistindo
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {continueWatching.map(course => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </section>
          )}

          {/* By Category */}
          {categories.map(cat => {
            const catCourses = filtered.filter(c => c.category === cat);
            if (catCourses.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4 capitalize">{cat}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {catCourses.map(course => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function CourseCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;

  return (
    <Link
      to={`/membros/curso/${course.id}`}
      className="group rounded-2xl overflow-hidden bg-card/60 border border-border/30 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-muted/20 relative overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <BookOpen className="h-10 w-10 md:h-12 md:w-12 text-primary/40" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/30 scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play className="h-5 w-5 md:h-6 md:w-6 text-white ml-0.5" />
          </div>
        </div>
        {/* Progress bar */}
        {pct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="p-3 md:p-4">
        <h3 className="font-semibold text-sm line-clamp-1">{course.title}</h3>
        {course.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2.5 md:mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> {course.totalLessons} aulas
          </span>
          {pct > 0 && (
            <span className="flex items-center gap-1">
              {pct === 100 ? (
                <><CheckCircle2 className="h-3 w-3 text-primary" /> Concluído</>
              ) : (
                <><Clock className="h-3 w-3" /> {pct}%</>
              )}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
