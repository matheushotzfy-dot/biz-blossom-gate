import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Play, Clock, CheckCircle2, Lock, Search, BookOpen, TrendingUp, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { PageShell, PageTitle, GlowPanel, Panel } from "@/components/PageShell";

// ── Types ──
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

// ── Main Component ──
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
    const accessCourseIds = access?.map(a => a.course_id) || [];
    const { data: ownedCourses } = await supabase
      .from("courses").select("id").eq("user_id", user.id);
    const ownedCourseIds = ownedCourses?.map(c => c.id) || [];
    const allCourseIds = [...new Set([...accessCourseIds, ...ownedCourseIds])];
    if (allCourseIds.length === 0) { setLoading(false); return; }

    const { data: coursesData } = await supabase
      .from("courses")
      .select(`id, title, description, thumbnail_url, category, user_id, modules ( id, title, banner_url, sort_order, lessons ( id ) )`)
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
    <PageShell>
      <PageTitle icon={<ShoppingBag className="h-6 w-6" />} title="Minhas Compras" subtitle="Cursos e conteúdos que você adquiriu" />

      {/* Progress Bar */}
      {courses.length > 0 && (
        <GlowPanel>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-primary" /> Progresso geral
            </span>
            <span className="text-sm font-display font-black text-primary font-numbers">{overallPct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted/20 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full bg-primary"
              style={{ boxShadow: "0 0 12px hsl(var(--primary) / 0.3)" }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-2 font-numbers">
            {totalCompleted} de {totalLessons} aulas concluídas
          </p>
        </GlowPanel>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
        <Input
          placeholder="Buscar cursos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 rounded-xl h-10 bg-muted/10 border-border/20"
        />
      </div>

      {courses.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-20 w-20 rounded-2xl bg-muted/10 border border-border/20 flex items-center justify-center mb-5">
            <Lock className="h-10 w-10 text-muted-foreground/15" />
          </div>
          <h2 className="text-lg font-display font-bold text-foreground/70 mb-1">Nenhum curso disponível</h2>
          <p className="text-muted-foreground/40 text-sm max-w-md">
            Adquira um produto para ter acesso aos cursos e conteúdos exclusivos.
          </p>
        </Panel>
      ) : (
        <>
          {/* Continue Watching */}
          {continueWatching.length > 0 && (
            <section>
              <h2 className="text-sm font-display font-bold text-foreground tracking-[-0.02em] mb-3 flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" /> Continue Assistindo
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
                {continueWatching.map((course, i) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <ContinueCard course={course} />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* All Courses */}
          {filtered.map((course, ci) => (
            <motion.section
              key={course.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">{course.title}</h2>
                  {course.description && (
                    <p className="text-[11px] text-muted-foreground/40 mt-0.5 line-clamp-1">{course.description}</p>
                  )}
                </div>
                <Link to={`/membros/curso/${course.id}`} className="text-[11px] text-primary hover:text-primary/80 font-bold transition-colors">
                  Ver tudo →
                </Link>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
                {course.modules.map((mod, mi) => (
                  <motion.div
                    key={mod.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: mi * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <ModuleCard courseId={course.id} mod={mod} />
                  </motion.div>
                ))}
                {course.modules.length === 0 && (
                  <Link to={`/membros/curso/${course.id}`} className="shrink-0 w-[200px] md:w-[240px]">
                    <div className="aspect-video rounded-xl overflow-hidden bg-muted/10 relative border border-border/20">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/[0.05] to-muted/10">
                          <BookOpen className="h-8 w-8 text-primary/15" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-foreground text-xs font-display font-bold">{course.title}</p>
                        <p className="text-muted-foreground/50 text-[10px] font-numbers">{course.totalLessons} aulas</p>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </motion.section>
          ))}
        </>
      )}
    </PageShell>
  );
}

// ── Module Card ──
function ModuleCard({ courseId, mod }: { courseId: string; mod: ModuleInfo }) {
  return (
    <Link
      to={`/membros/curso/${courseId}?module=${mod.id}`}
      className="group shrink-0 w-[200px] md:w-[240px] block"
    >
      <div className="aspect-video rounded-xl overflow-hidden bg-muted/10 relative border border-border/20 group-hover:border-primary/20 transition-all duration-300">
        {mod.banner_url ? (
          <img src={mod.banner_url} alt={mod.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/[0.05] to-muted/10">
            <BookOpen className="h-8 w-8 text-primary/15" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-foreground text-xs font-display font-bold line-clamp-1 tracking-[-0.01em]">{mod.title}</p>
          <p className="text-muted-foreground/50 text-[10px] mt-0.5 font-numbers">{mod.lessonCount} aulas</p>
        </div>
        <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-primary/90 flex items-center justify-center shadow-xl shadow-primary/30">
            <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Continue Watching Card ──
function ContinueCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;

  return (
    <Link
      to={`/membros/curso/${course.id}`}
      className="group shrink-0 w-[280px] md:w-[320px] rounded-2xl overflow-hidden bg-card/80 backdrop-blur-xl border border-border/30 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/[0.05] transition-all duration-300 active:scale-[0.985]"
    >
      <div className="aspect-video bg-muted/10 relative overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/[0.05] to-muted/10">
            <BookOpen className="h-10 w-10 text-primary/15" />
          </div>
        )}
        <div className="absolute inset-0 bg-background/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-primary/90 flex items-center justify-center shadow-xl shadow-primary/30">
            <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-display font-bold text-sm text-foreground line-clamp-1 tracking-[-0.01em]">{course.title}</h3>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground/50">
          <span className="flex items-center gap-1 font-numbers"><Clock className="h-3 w-3" /> {pct}%</span>
          <span className="font-numbers">{course.completedLessons}/{course.totalLessons} aulas</span>
        </div>
      </div>
    </Link>
  );
}
