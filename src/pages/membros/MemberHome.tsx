import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Play, Clock, BookOpen, TrendingUp, ChevronRight, Award, Zap, Sparkles, GraduationCap, Flame } from "lucide-react";
import { motion } from "framer-motion";

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
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-muted-foreground/40 text-xs font-display font-bold">Carregando seus cursos...</p>
      </motion.div>
    </div>
  );

  if (courses.length === 0) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: [0.16, 1, 0.3, 1] }}>
        <div className="relative mb-8">
          <div className="absolute inset-0 rounded-full bg-primary/8 blur-[80px] w-48 h-48 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
          <div className="relative h-28 w-28 rounded-[2rem] bg-card border border-border/30 flex items-center justify-center shadow-2xl">
            <GraduationCap className="h-14 w-14 text-muted-foreground/15" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-black text-foreground tracking-tight mb-3">Bem-vindo à sua área</h2>
        <p className="text-sm text-muted-foreground/50 max-w-md leading-relaxed">
          Quando você adquirir um produto, seus cursos e conteúdos aparecerão aqui automaticamente.
        </p>
      </motion.div>
    </div>
  );

  const featured = continueWatching[0] || courses[0];
  const featuredPct = featured.totalLessons > 0 ? Math.round((featured.completedLessons / featured.totalLessons) * 100) : 0;

  return (
    <div className="pb-20">
      {/* ═══ Cinematic Hero Banner ═══ */}
      <div className="relative h-[56vh] min-h-[420px] max-h-[600px] overflow-hidden">
        {featured.thumbnail_url ? (
          <motion.img
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1.02, opacity: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            src={featured.thumbnail_url} alt={featured.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-background" />
        )}
        {/* Cinematic overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_40%,hsl(var(--background))_100%)]" />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 lg:p-14 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl"
          >
            <div className="flex items-center gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-display font-black uppercase tracking-[0.12em] bg-primary/12 text-primary border border-primary/15 backdrop-blur-xl">
                <Zap className="h-3 w-3" />
                {continueWatching.length > 0 ? "Continue assistindo" : "Em destaque"}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[3.2rem] font-display font-black text-foreground leading-[1.05] tracking-[-0.03em] mb-4">
              {featured.title}
            </h1>

            {featured.description && (
              <p className="text-sm sm:text-[15px] text-muted-foreground/60 line-clamp-2 mb-6 leading-relaxed max-w-lg">{featured.description}</p>
            )}

            <div className="flex items-center gap-5 mb-7">
              <div className="flex items-center gap-3">
                <div className="w-36 sm:w-48">
                  <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden backdrop-blur-sm">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${featuredPct}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground/40 font-display font-bold tabular-nums">{featuredPct}%</span>
              </div>
              <span className="text-xs text-muted-foreground/30 font-display font-bold tabular-nums">{featured.completedLessons}/{featured.totalLessons} aulas</span>
            </div>

            <div className="flex items-center gap-3">
              <Link to={`/membros-area/curso/${featured.id}`}
                className="group inline-flex items-center gap-2.5 h-12 sm:h-[52px] px-7 sm:px-8 rounded-2xl bg-foreground text-background text-sm font-display font-black hover:opacity-90 transition-all hover:scale-[1.02] shadow-2xl shadow-foreground/10 active:scale-[0.98]">
                <Play className="h-4 w-4 fill-current" />
                {continueWatching.length > 0 ? "Continuar" : "Começar agora"}
              </Link>
              <Link to={`/membros-area/curso/${featured.id}`}
                className="inline-flex items-center gap-2 h-12 sm:h-[52px] px-6 rounded-2xl bg-card/40 backdrop-blur-xl text-foreground/70 text-sm font-display font-bold border border-border/20 hover:bg-card/60 hover:text-foreground transition-all active:scale-[0.98]">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Detalhes</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 mt-10">
        {/* ═══ Stats Row ═══ */}
        {totalLessons > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            <StatCard icon={<BookOpen className="h-4 w-4" />} label="Cursos" value={String(courses.length)} tone="primary" />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Progresso" value={`${overallPct}%`} tone="info" />
            <StatCard icon={<Flame className="h-4 w-4" />} label="Aulas feitas" value={`${totalCompleted}`} tone="warning" />
            <StatCard icon={<Award className="h-4 w-4" />} label="Concluídos" value={String(completedCourses)} tone="success" />
          </motion.div>
        )}

        {/* ═══ Overall Progress ═══ */}
        {totalLessons > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl p-5 bg-card/40 backdrop-blur-xl border border-border/20"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-display font-bold text-foreground">Progresso geral</span>
              </div>
              <span className="text-sm font-display font-black text-primary tabular-nums">{overallPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted/15 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${overallPct}%` }}
                transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-gradient-to-r from-primary via-primary to-primary/60 rounded-full"
                style={{ boxShadow: "0 0 20px hsl(var(--primary) / 0.3)" }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-2.5 font-display font-bold tabular-nums">
              {totalCompleted} de {totalLessons} aulas concluídas · {completedCourses} {completedCourses === 1 ? "curso completo" : "cursos completos"}
            </p>
          </motion.div>
        )}

        {/* ═══ Continue Watching ═══ */}
        {continueWatching.length > 0 && (
          <section>
            <SectionHeader icon={<Play className="h-4 w-4 text-primary fill-primary" />} title="Continue Assistindo" />
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory">
              {continueWatching.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ContinueCard course={c} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ═══ My Courses Grid ═══ */}
        <section>
          <SectionHeader icon={<BookOpen className="h-4 w-4 text-foreground" />} title="Meus Cursos" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <CourseCard course={course} />
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══ Module Carousels ═══ */}
        {courses.filter(c => c.modules.length > 1).map((course, ci) => (
          <motion.section
            key={course.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + ci * 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-display font-bold text-foreground">{course.title}</h3>
              <Link to={`/membros-area/curso/${course.id}`} className="text-xs text-primary hover:text-primary/80 font-display font-bold flex items-center gap-1 transition-colors">
                Ver curso <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide snap-x">
              {course.modules.map((mod, mi) => (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: mi * 0.06, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link to={`/membros-area/curso/${course.id}?module=${mod.id}`} className="group shrink-0 w-[220px] md:w-[260px] snap-start block">
                    <div className="aspect-video rounded-2xl overflow-hidden relative bg-card border border-border/20 group-hover:border-primary/20 transition-all duration-500 group-hover:shadow-xl group-hover:shadow-primary/5">
                      {mod.banner_url ? (
                        <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-card">
                          <BookOpen className="h-8 w-8 text-primary/10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3.5">
                        <p className="text-foreground text-xs font-display font-bold line-clamp-1">{mod.title}</p>
                        <p className="text-muted-foreground/40 text-[10px] mt-0.5 font-display font-bold tabular-nums">{mod.lessonCount} aulas</p>
                      </div>
                      <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="h-11 w-11 rounded-full bg-foreground/90 flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
                          <Play className="h-4 w-4 text-background ml-0.5 fill-current" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}

/* ─── Sub Components ─── */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-8 w-8 rounded-xl bg-card border border-border/20 flex items-center justify-center">
        {icon}
      </div>
      <h2 className="text-base font-display font-black text-foreground tracking-tight">{title}</h2>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/8 text-primary border-primary/10",
    info: "bg-info/8 text-info border-info/10",
    warning: "bg-warning/8 text-warning border-warning/10",
    success: "bg-success/8 text-success border-success/10",
  };
  return (
    <div className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-card/40 backdrop-blur-xl border border-border/15 hover:border-border/30 transition-all duration-300">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${toneMap[tone]}`}>{icon}</div>
      <span className="text-xl font-display font-black text-foreground tracking-tight tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground/40 font-display font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}

function CourseCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isComplete = pct === 100 && course.totalLessons > 0;

  return (
    <Link to={`/membros-area/curso/${course.id}`}
      className="group rounded-2xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/15 hover:border-primary/15 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.985]">
      <div className="aspect-video relative overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/8 to-card">
            <BookOpen className="h-12 w-12 text-primary/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="h-14 w-14 rounded-full bg-foreground/90 flex items-center justify-center shadow-2xl transform scale-85 group-hover:scale-100 transition-transform duration-300">
            <Play className="h-6 w-6 text-background ml-0.5 fill-current" />
          </div>
        </div>

        {/* Progress bar */}
        {pct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/30 backdrop-blur-sm">
            <div className={`h-full transition-all duration-700 ${isComplete ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
        )}

        {/* Badges */}
        {isComplete && (
          <div className="absolute top-3 right-3 h-8 w-8 rounded-xl bg-success/90 flex items-center justify-center shadow-lg backdrop-blur-sm">
            <Award className="h-4 w-4 text-success-foreground" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="text-[9px] font-display font-black uppercase tracking-[0.12em] px-2.5 py-1 rounded-lg bg-background/50 backdrop-blur-xl text-foreground/60 border border-border/10">
            {course.category}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <h3 className="font-display font-bold text-[14px] text-foreground line-clamp-1 group-hover:text-primary transition-colors tracking-tight">{course.title}</h3>
        {course.description && <p className="text-[11px] text-muted-foreground/40 line-clamp-1 mt-1.5">{course.description}</p>}
        <div className="flex items-center justify-between mt-3.5">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/40 font-display font-bold">
            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {course.modules.length} módulos</span>
            <span className="tabular-nums">{course.totalLessons} aulas</span>
          </div>
          {pct > 0 && <span className="text-[11px] font-display font-black text-primary tabular-nums">{pct}%</span>}
        </div>
      </div>
    </Link>
  );
}

function ContinueCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  return (
    <Link to={`/membros-area/curso/${course.id}`}
      className="group shrink-0 w-[300px] md:w-[340px] snap-start rounded-2xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/15 hover:border-primary/15 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 active:scale-[0.985]">
      <div className="aspect-video relative overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/8 to-card">
            <BookOpen className="h-10 w-10 text-primary/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-background/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-foreground/90 flex items-center justify-center shadow-2xl">
            <Play className="h-5 w-5 text-background ml-0.5 fill-current" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/20">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-display font-bold text-sm text-foreground line-clamp-1 tracking-tight">{course.title}</h3>
        <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted-foreground/40 font-display font-bold">
          <span className="flex items-center gap-1 tabular-nums"><Clock className="h-3 w-3" /> {pct}% concluído</span>
          <span className="tabular-nums">{course.completedLessons}/{course.totalLessons} aulas</span>
        </div>
      </div>
    </Link>
  );
}
