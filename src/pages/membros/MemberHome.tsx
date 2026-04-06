/**
 * MemberHome — Ultra-Premium Member Dashboard
 * @module MemberHome
 * @version 6.0.0 — Cinematic Fintech Redesign
 */

import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  Play, Clock, BookOpen, TrendingUp, ChevronRight, Award, Zap, Sparkles,
  GraduationCap, Flame, Layers, Star, Target, Trophy, BarChart3, Rocket,
  CheckCircle2, ArrowUpRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ModuleInfo = { id: string; title: string; banner_url: string | null; sort_order: number; lessonCount: number };
type CourseWithProgress = {
  id: string; title: string; description: string | null; thumbnail_url: string | null;
  category: string; totalLessons: number; completedLessons: number; lastLesson: string | null;
  modules: ModuleInfo[];
};

const ease = [0.16, 1, 0.3, 1] as const;

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
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-2xl shadow-primary/10">
            <GraduationCap className="h-7 w-7 text-primary/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm font-display font-bold tracking-tight">Carregando seus cursos...</p>
      </motion.div>
    </div>
  );

  if (courses.length === 0) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
        <div className="relative mb-10">
          <div className="absolute inset-0 rounded-full bg-primary/8 blur-[120px] w-64 h-64 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
          <div className="relative h-28 w-28 rounded-[2rem] bg-card border border-border/30 flex items-center justify-center shadow-2xl mx-auto">
            <GraduationCap className="h-14 w-14 text-muted-foreground/10" />
          </div>
        </div>
        <h2 className="text-3xl sm:text-4xl font-display font-black text-foreground tracking-[-0.04em] mb-4">Bem-vindo à sua área</h2>
        <p className="text-base text-muted-foreground max-w-md leading-relaxed font-display mx-auto">
          Quando você adquirir um produto, seus cursos e conteúdos aparecerão aqui automaticamente.
        </p>
      </motion.div>
    </div>
  );

  const featured = continueWatching[0] || courses[0];
  const featuredPct = featured.totalLessons > 0 ? Math.round((featured.completedLessons / featured.totalLessons) * 100) : 0;

  return (
    <div className="pb-24 bg-background">
      {/* ═══ Cinematic Hero ═══ */}
      <div className="relative h-[55vh] min-h-[420px] max-h-[580px] overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-[160px] animate-pulse-glow pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-info/4 blur-[120px] animate-pulse-glow pointer-events-none" style={{ animationDelay: "1.5s" }} />
        {featured.thumbnail_url ? (
          <motion.img
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1.02, opacity: 1 }}
            transition={{ duration: 1.4, ease }}
            src={featured.thumbnail_url} alt={featured.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-background">
            <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_40%,hsl(var(--background))_100%)]" />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12 max-w-[1440px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease }}
            className="max-w-xl"
          >
            <div className="flex items-center gap-2.5 mb-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-display font-black uppercase tracking-[0.12em] bg-primary/12 text-primary border border-primary/15 backdrop-blur-xl shadow-sm">
                <Zap className="h-3 w-3" />
                {continueWatching.length > 0 ? "Continue assistindo" : "Em destaque"}
              </span>
              {featured.category && (
                <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-display font-bold bg-card/20 backdrop-blur-xl text-foreground/50 border border-border/15 uppercase tracking-wider">
                  {featured.category}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-black text-foreground leading-[1.08] tracking-[-0.04em] mb-4">
              {featured.title}
            </h1>

            {featured.description && (
              <p className="text-sm sm:text-base text-muted-foreground/80 line-clamp-2 mb-6 leading-relaxed max-w-lg font-display">{featured.description}</p>
            )}

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-32 sm:w-40">
                  <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${featuredPct}%` }}
                      transition={{ duration: 1, delay: 0.5, ease }}
                      className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                      style={{ boxShadow: featuredPct > 0 ? "0 0 10px hsl(var(--primary) / 0.2)" : "none" }}
                    />
                  </div>
                </div>
                <span className="text-xs text-foreground/50 font-display font-bold tabular-nums">{featuredPct}%</span>
              </div>
              <span className="text-xs text-muted-foreground/50 font-display tabular-nums">{featured.completedLessons}/{featured.totalLessons} aulas</span>
            </div>

            <div className="flex items-center gap-2.5">
              <Link to={`/membros-area/curso/${featured.id}`}
                className="group inline-flex items-center gap-2.5 h-12 px-7 rounded-xl bg-foreground text-background text-sm font-display font-black hover:opacity-90 transition-all hover:scale-[1.02] shadow-xl shadow-foreground/15 active:scale-[0.98] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer pointer-events-none" />
                <Play className="h-4 w-4 fill-current relative z-10" />
                <span className="relative z-10">{continueWatching.length > 0 ? "Continuar" : "Começar"}</span>
              </Link>
              <Link to={`/membros-area/curso/${featured.id}`}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-card/30 backdrop-blur-xl text-foreground/70 text-sm font-display font-bold border border-border/20 hover:bg-card/50 hover:text-foreground hover:border-border/30 transition-all active:scale-[0.98] shadow-sm">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Detalhes</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10 mt-10">

        {/* ═══ Stats Strip — Premium ═══ */}
        {totalLessons > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: BookOpen, label: "Cursos", value: String(courses.length), tone: "primary" as const },
              { icon: Target, label: "Progresso", value: `${overallPct}%`, tone: "info" as const },
              { icon: Flame, label: "Aulas feitas", value: String(totalCompleted), tone: "warning" as const },
              { icon: Trophy, label: "Concluídos", value: String(completedCourses), tone: "success" as const },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease }}
                className="relative group rounded-2xl bg-card/95 ring-1 ring-border/20 p-4 sm:p-5 overflow-hidden hover:ring-border/40 transition-all duration-500 shadow-sm hover:shadow-md cursor-default"
              >
                <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full transition-all duration-500 group-hover:w-1", `bg-${kpi.tone}`)} />
                <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none", `bg-gradient-to-br from-${kpi.tone}/[0.03] to-transparent`)} />
                <div className="relative z-10 flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center ring-1 transition-all duration-500 group-hover:scale-110 group-hover:shadow-md shadow-sm", `bg-${kpi.tone}/10 ring-${kpi.tone}/15 shadow-${kpi.tone}/5 group-hover:shadow-${kpi.tone}/10`)}>
                    <kpi.icon className={cn("h-4.5 w-4.5", `text-${kpi.tone}`)} />
                  </div>
                  <div>
                    <span className={cn("text-xl font-display font-black tracking-[-0.02em] tabular-nums block leading-tight", `text-${kpi.tone}`)}>{kpi.value}</span>
                    <span className="text-[9px] text-muted-foreground/40 font-display font-bold uppercase tracking-[0.15em]">{kpi.label}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ═══ Overall Progress — Premium ═══ */}
        {totalLessons > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ease }}
            className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-6 overflow-hidden shadow-sm"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-info/[0.02] pointer-events-none" />
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-gradient-to-b from-primary to-info" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shadow-sm shadow-primary/5">
                    <BarChart3 className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <span className="text-[13px] font-display font-black text-foreground/80 block">Progresso Geral</span>
                    <p className="text-[10px] text-muted-foreground/40 font-display tabular-nums">
                      {totalCompleted}/{totalLessons} aulas · {completedCourses} concluído{completedCourses !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <span className="text-2xl font-display font-black text-primary tabular-nums">{overallPct}%</span>
              </div>
              <div className="h-3 rounded-full bg-muted/10 ring-1 ring-border/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallPct}%` }}
                  transition={{ duration: 1.2, delay: 0.5, ease }}
                  className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 rounded-full relative"
                  style={{ boxShadow: "0 0 16px hsl(var(--primary) / 0.3)" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ Continue Watching ═══ */}
        {continueWatching.length > 0 && (
          <section>
            <SectionHeader icon={<Play className="h-4 w-4 text-primary fill-primary" />} title="Continue Assistindo" count={continueWatching.length} />
            <div className="flex gap-4 overflow-x-auto pb-3 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory">
              {continueWatching.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, ease }}>
                  <ContinueCard course={c} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ═══ My Courses Grid ═══ */}
        <section>
          <SectionHeader icon={<Layers className="h-4 w-4 text-foreground" />} title="Meus Cursos" count={courses.length} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {courses.map((course, i) => (
              <motion.div key={course.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.06, ease }}>
                <CourseCard course={course} />
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══ Module Rows ═══ */}
        {courses.filter(c => c.modules.length > 1).map((course, ci) => (
          <motion.section key={course.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + ci * 0.08, ease }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-display font-black text-foreground tracking-[-0.02em]">{course.title}</h3>
                <p className="text-xs text-muted-foreground/60 font-display mt-0.5">{course.modules.length} módulos</p>
              </div>
              <Link to={`/membros-area/curso/${course.id}`} className="text-xs text-primary hover:text-primary/80 font-display font-bold flex items-center gap-1 transition-colors group">
                Ver curso <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 -mx-2 px-2 scrollbar-hide snap-x">
              {course.modules.map((mod, mi) => (
                <motion.div key={mod.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: mi * 0.05, ease }}>
                  <Link to={`/membros-area/curso/${course.id}?module=${mod.id}`} className="group shrink-0 w-[220px] md:w-[260px] snap-start block">
                    <div className="aspect-video rounded-xl overflow-hidden relative bg-card ring-1 ring-border/15 group-hover:ring-primary/20 transition-all duration-500 group-hover:shadow-lg group-hover:shadow-primary/5">
                      {mod.banner_url ? (
                        <img src={mod.banner_url} alt={mod.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-card">
                          <BookOpen className="h-8 w-8 text-primary/8" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                    <p className="text-xs font-display font-bold text-foreground/80 mt-2.5 truncate group-hover:text-foreground transition-colors">{mod.title}</p>
                    <p className="text-[10px] text-muted-foreground/40 font-display tabular-nums mt-0.5">{mod.lessonCount} aula{mod.lessonCount !== 1 ? "s" : ""}</p>
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

/* ─── Section Header ─── */
function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-9 w-9 rounded-xl bg-card ring-1 ring-border/20 flex items-center justify-center shadow-sm">{icon}</div>
      <h2 className="text-base font-display font-black text-foreground tracking-[-0.02em]">{title}</h2>
      <span className="text-[10px] font-display font-bold text-muted-foreground/40 bg-muted/10 px-2 py-0.5 rounded-lg ring-1 ring-border/10 tabular-nums">{count}</span>
    </div>
  );
}

/* ─── Continue Watching Card ─── */
function ContinueCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  return (
    <Link to={`/membros-area/curso/${course.id}`} className="group shrink-0 w-[300px] sm:w-[340px] snap-start block">
      <div className="relative rounded-2xl overflow-hidden bg-card ring-1 ring-border/15 group-hover:ring-primary/25 transition-all duration-500 shadow-md group-hover:shadow-xl group-hover:shadow-primary/8">
        <div className="aspect-[2.2/1] relative overflow-hidden">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-[900ms] ease-out" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/12 via-primary/5 to-card flex items-center justify-center relative">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
              <GraduationCap className="h-12 w-12 text-primary/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className="text-[10px] font-display font-bold text-foreground/80 bg-card/40 backdrop-blur-xl px-3 py-1.5 rounded-lg border border-border/20 shadow-sm tabular-nums">
              {pct}% · {course.completedLessons}/{course.totalLessons}
            </span>
          </div>
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="h-14 w-14 rounded-2xl bg-foreground/85 backdrop-blur-xl flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-500">
              <Play className="h-6 w-6 text-background ml-0.5 fill-current" />
            </div>
          </div>
        </div>
        {/* Progress bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-muted/10">
          <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all relative" style={{ width: `${pct}%` }}>
            {pct > 5 && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />}
          </div>
        </div>
      </div>
      <p className="text-sm font-display font-bold text-foreground mt-3 truncate group-hover:text-primary transition-colors duration-300">{course.title}</p>
    </Link>
  );
}
/* ─── Course Card ─── */
function CourseCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isFinished = pct === 100 && course.totalLessons > 0;

  return (
    <Link to={`/membros-area/curso/${course.id}`} className="group block h-full">
      <div className="rounded-2xl overflow-hidden bg-card ring-1 ring-border/15 group-hover:ring-primary/25 transition-all duration-500 shadow-sm group-hover:shadow-xl group-hover:shadow-primary/8 h-full flex flex-col">
        <div className="aspect-[16/10] relative overflow-hidden">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-[900ms] ease-out" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/8 via-card to-card flex items-center justify-center relative">
              <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              <GraduationCap className="h-12 w-12 text-primary/8" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          {/* Status badge */}
          {isFinished && (
            <div className="absolute top-3 right-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success/20 backdrop-blur-xl text-[9px] font-display font-black text-success ring-1 ring-success/25 shadow-lg shadow-success/10">
                <CheckCircle2 className="h-3 w-3" /> Concluído
              </div>
            </div>
          )}
          {/* Category */}
          {course.category && !isFinished && (
            <div className="absolute top-3 left-3">
              <span className="px-2.5 py-1.5 rounded-lg bg-card/40 backdrop-blur-xl text-[9px] font-display font-bold text-foreground/70 ring-1 ring-border/20 uppercase tracking-wider shadow-sm">{course.category}</span>
            </div>
          )}
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-foreground/85 backdrop-blur-xl flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-500">
              <Play className="h-5 w-5 text-background ml-0.5 fill-current" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 sm:p-5 flex flex-col">
          <h3 className="text-sm font-display font-black text-foreground tracking-[-0.02em] line-clamp-2 group-hover:text-primary transition-colors duration-300 leading-snug">{course.title}</h3>
          {course.description && (
            <p className="text-[11px] text-muted-foreground/50 mt-2 line-clamp-2 font-display leading-relaxed">{course.description}</p>
          )}
          <div className="mt-auto pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground/40 font-display font-semibold tabular-nums">{course.completedLessons}/{course.totalLessons} aulas</span>
              <span className={cn("text-[10px] font-display font-black tabular-nums", isFinished ? "text-success" : "text-primary")}>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/10 ring-1 ring-border/8 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: 0.2, ease }}
                className={cn("h-full rounded-full relative", isFinished ? "bg-success" : "bg-gradient-to-r from-primary to-primary/60")}
              >
                {pct > 0 && pct < 100 && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}