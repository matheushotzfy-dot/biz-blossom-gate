import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Play, Clock, BookOpen, TrendingUp, ChevronRight, Award, Zap, Sparkles, GraduationCap, Flame, Layers, Star } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-xl shadow-primary/10">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm font-display font-bold tracking-tight">Carregando seus cursos...</p>
      </motion.div>
    </div>
  );

  if (courses.length === 0) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: [0.16, 1, 0.3, 1] }}>
        <div className="relative mb-10">
          <div className="absolute inset-0 rounded-full bg-primary/8 blur-[100px] w-56 h-56 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
          <div className="relative h-32 w-32 rounded-[2.5rem] bg-card border border-border/30 flex items-center justify-center shadow-2xl">
            <GraduationCap className="h-16 w-16 text-muted-foreground/15" />
          </div>
        </div>
        <h2 className="text-3xl sm:text-4xl font-display font-black text-foreground tracking-[-0.04em] mb-4">Bem-vindo à sua área</h2>
        <p className="text-base text-muted-foreground max-w-md leading-relaxed font-display">
          Quando você adquirir um produto, seus cursos e conteúdos aparecerão aqui automaticamente.
        </p>
      </motion.div>
    </div>
  );

  const featured = continueWatching[0] || courses[0];
  const featuredPct = featured.totalLessons > 0 ? Math.round((featured.completedLessons / featured.totalLessons) * 100) : 0;

  return (
    <div className="pb-24">
      {/* ═══ Cinematic Hero Banner ═══ */}
      <div className="relative h-[60vh] min-h-[460px] max-h-[640px] overflow-hidden">
        {featured.thumbnail_url ? (
          <motion.img
            initial={{ scale: 1.12, opacity: 0 }}
            animate={{ scale: 1.02, opacity: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            src={featured.thumbnail_url} alt={featured.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-background to-background" />
        )}
        {/* Cinematic overlays — premium multi-layer */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_30%,hsl(var(--background))_100%)]" />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 lg:p-16 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-display font-black uppercase tracking-[0.1em] bg-primary/12 text-primary border border-primary/15 backdrop-blur-xl">
                <Zap className="h-3.5 w-3.5" />
                {continueWatching.length > 0 ? "Continue assistindo" : "Em destaque"}
              </span>
              {featured.category && (
                <span className="px-3 py-1.5 rounded-full text-xs font-display font-bold bg-card/30 backdrop-blur-xl text-foreground/60 border border-border/15">
                  {featured.category}
                </span>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-display font-black text-foreground leading-[1.05] tracking-[-0.04em] mb-5">
              {featured.title}
            </h1>

            {featured.description && (
              <p className="text-base sm:text-lg text-muted-foreground line-clamp-2 mb-8 leading-relaxed max-w-xl font-display font-medium">{featured.description}</p>
            )}

            <div className="flex items-center gap-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-40 sm:w-52">
                  <div className="h-2 rounded-full bg-foreground/10 overflow-hidden backdrop-blur-sm">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${featuredPct}%` }}
                      transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                      style={{ boxShadow: "0 0 16px hsl(var(--primary) / 0.25)" }}
                    />
                  </div>
                </div>
                <span className="text-sm text-foreground/60 font-display font-bold tabular-nums">{featuredPct}%</span>
              </div>
              <span className="text-sm text-muted-foreground font-display font-semibold tabular-nums">{featured.completedLessons}/{featured.totalLessons} aulas</span>
            </div>

            <div className="flex items-center gap-3">
              <Link to={`/membros-area/curso/${featured.id}`}
                className="group inline-flex items-center gap-3 h-13 sm:h-14 px-8 sm:px-10 rounded-2xl bg-foreground text-background text-base font-display font-black hover:opacity-90 transition-all hover:scale-[1.02] shadow-2xl shadow-foreground/15 active:scale-[0.98]">
                <Play className="h-5 w-5 fill-current" />
                {continueWatching.length > 0 ? "Continuar" : "Começar agora"}
              </Link>
              <Link to={`/membros-area/curso/${featured.id}`}
                className="inline-flex items-center gap-2.5 h-13 sm:h-14 px-7 rounded-2xl bg-card/40 backdrop-blur-xl text-foreground/80 text-base font-display font-bold border border-border/25 hover:bg-card/60 hover:text-foreground transition-all active:scale-[0.98]">
                <BookOpen className="h-5 w-5" />
                <span className="hidden sm:inline">Detalhes</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 space-y-14 mt-12">
        {/* ═══ Premium Stats Row ═══ */}
        {totalLessons > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <PremiumStatCard icon={<BookOpen className="h-5 w-5" />} label="Cursos" value={String(courses.length)} color="primary" />
            <PremiumStatCard icon={<TrendingUp className="h-5 w-5" />} label="Progresso" value={`${overallPct}%`} color="info" />
            <PremiumStatCard icon={<Flame className="h-5 w-5" />} label="Aulas feitas" value={`${totalCompleted}`} color="warning" />
            <PremiumStatCard icon={<Award className="h-5 w-5" />} label="Concluídos" value={String(completedCourses)} color="success" />
          </motion.div>
        )}

        {/* ═══ Overall Progress ═══ */}
        {totalLessons > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl p-6 sm:p-7 bg-card/50 backdrop-blur-xl border border-border/25 shadow-xl shadow-background/30"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="text-base font-display font-black text-foreground tracking-tight">Progresso geral</span>
                  <p className="text-xs text-muted-foreground font-display mt-0.5 tabular-nums">
                    {totalCompleted} de {totalLessons} aulas · {completedCourses} {completedCourses === 1 ? "curso completo" : "cursos completos"}
                  </p>
                </div>
              </div>
              <span className="text-2xl font-display font-black text-primary tabular-nums">{overallPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted/15 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${overallPct}%` }}
                transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-gradient-to-r from-primary via-primary to-primary/60 rounded-full"
                style={{ boxShadow: "0 0 24px hsl(var(--primary) / 0.3)" }}
              />
            </div>
          </motion.div>
        )}

        {/* ═══ Continue Watching ═══ */}
        {continueWatching.length > 0 && (
          <section>
            <SectionHeader icon={<Play className="h-4.5 w-4.5 text-primary fill-primary" />} title="Continue Assistindo" subtitle={`${continueWatching.length} cursos em andamento`} />
            <div className="flex gap-5 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory">
              {continueWatching.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: 30 }}
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
          <SectionHeader icon={<Layers className="h-4.5 w-4.5 text-foreground" />} title="Meus Cursos" subtitle={`${courses.length} cursos disponíveis`} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 24 }}
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + ci * 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-display font-black text-foreground tracking-tight">{course.title}</h3>
                <p className="text-sm text-muted-foreground font-display mt-0.5">{course.modules.length} módulos</p>
              </div>
              <Link to={`/membros-area/curso/${course.id}`} className="text-sm text-primary hover:text-primary/80 font-display font-bold flex items-center gap-1.5 transition-colors group">
                Ver curso <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className="flex gap-5 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide snap-x">
              {course.modules.map((mod, mi) => (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: mi * 0.06, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link to={`/membros-area/curso/${course.id}?module=${mod.id}`} className="group shrink-0 w-[240px] md:w-[280px] snap-start block">
                    <div className="aspect-video rounded-2xl overflow-hidden relative bg-card border border-border/20 group-hover:border-primary/20 transition-all duration-500 group-hover:shadow-xl group-hover:shadow-primary/5">
                      {mod.banner_url ? (
                        <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-card">
                          <BookOpen className="h-10 w-10 text-primary/10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-foreground text-sm font-display font-bold line-clamp-1">{mod.title}</p>
                        <p className="text-muted-foreground text-xs mt-1 font-display tabular-nums">{mod.lessonCount} aulas</p>
                      </div>
                      <div className="absolute inset-0 bg-background/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-foreground/90 flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
                          <Play className="h-5 w-5 text-background ml-0.5 fill-current" />
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

/* ─── Premium Sub Components ─── */

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3.5 mb-6">
      <div className="h-10 w-10 rounded-xl bg-card border border-border/25 flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-display font-black text-foreground tracking-[-0.03em]">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground font-display mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function PremiumStatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/15", glow: "shadow-primary/5" },
    info: { bg: "bg-info/10", text: "text-info", border: "border-info/15", glow: "shadow-info/5" },
    warning: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/15", glow: "shadow-warning/5" },
    success: { bg: "bg-success/10", text: "text-success", border: "border-success/15", glow: "shadow-success/5" },
  };
  const c = colorMap[color] || colorMap.primary;
  return (
    <div className={cn(
      "flex flex-col items-center gap-3 p-5 sm:p-6 rounded-2xl bg-card/50 backdrop-blur-xl border border-border/20 hover:border-border/30 transition-all duration-300 shadow-lg",
      c.glow
    )}>
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center border", c.bg, c.border)}>
        <span className={c.text}>{icon}</span>
      </div>
      <span className="text-2xl sm:text-3xl font-display font-black text-foreground tracking-[-0.03em] tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground font-display font-bold uppercase tracking-[0.08em]">{label}</span>
    </div>
  );
}

function CourseCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isComplete = pct === 100 && course.totalLessons > 0;

  return (
    <Link to={`/membros-area/curso/${course.id}`}
      className="group rounded-2xl overflow-hidden bg-card/50 backdrop-blur-xl border border-border/20 hover:border-primary/20 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/8 active:scale-[0.985] block">
      <div className="aspect-video relative overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/8 to-card">
            <BookOpen className="h-14 w-14 text-primary/10" />
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
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-background/30 backdrop-blur-sm">
            <div className={cn("h-full transition-all duration-700 rounded-full", isComplete ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
        )}

        {/* Badges */}
        {isComplete && (
          <div className="absolute top-3 right-3 h-9 w-9 rounded-xl bg-success/90 flex items-center justify-center shadow-lg backdrop-blur-sm border border-success/30">
            <Award className="h-4.5 w-4.5 text-success-foreground" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-display font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg bg-background/60 backdrop-blur-xl text-foreground/70 border border-border/15">
            {course.category}
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <h3 className="font-display font-black text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors tracking-[-0.02em]">{course.title}</h3>
        {course.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-2 leading-relaxed font-display">{course.description}</p>}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/15">
          <div className="flex items-center gap-4 text-sm text-muted-foreground font-display font-semibold">
            <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> {course.modules.length} módulos</span>
            <span className="tabular-nums">{course.totalLessons} aulas</span>
          </div>
          {pct > 0 && <span className="text-sm font-display font-black text-primary tabular-nums">{pct}%</span>}
        </div>
      </div>
    </Link>
  );
}

function ContinueCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  return (
    <Link to={`/membros-area/curso/${course.id}`}
      className="group shrink-0 w-[320px] md:w-[360px] snap-start rounded-2xl overflow-hidden bg-card/50 backdrop-blur-xl border border-border/20 hover:border-primary/20 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/8 active:scale-[0.985] block">
      <div className="aspect-video relative overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/8 to-card">
            <BookOpen className="h-10 w-10 text-primary/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-background/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-foreground/90 flex items-center justify-center shadow-2xl">
            <Play className="h-6 w-6 text-background ml-0.5 fill-current" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-muted/20">
          <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-display font-black text-base text-foreground line-clamp-1 tracking-[-0.02em]">{course.title}</h3>
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground font-display font-semibold">
          <span className="flex items-center gap-1.5 tabular-nums"><Clock className="h-3.5 w-3.5" /> {pct}% concluído</span>
          <span className="tabular-nums">{course.completedLessons}/{course.totalLessons} aulas</span>
        </div>
      </div>
    </Link>
  );
}
