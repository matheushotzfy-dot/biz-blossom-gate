/**
 * MemberHome — Netflix Premium Experience
 * Full-bleed cinematic hero, horizontal snap rails, immersive thumbnails.
 */
import { useEffect, useMemo, useState, useRef } from "react";
import { useOutletContext, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Play, ArrowUpRight, Award, BookOpen, ChevronRight, ChevronLeft, Star, Users, Trophy, Flame, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Course = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  totalLessons: number;
  completedLessons: number;
  lastLessonId: string | null;
  lastLessonTitle: string | null;
  lastModuleTitle: string | null;
  lastActivityAt: number;
  moduleCount: number;
};

type Cert = { id: string; code: string; course_title: string; issued_at: string };

const ease = [0.16, 1, 0.3, 1] as const;

export default function MemberHome() {
  const { user } = useOutletContext<{ user: User }>();
  const [courses, setCourses] = useState<Course[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  async function load() {
    if (!user) return;
    const [{ data: access }, { data: owned }] = await Promise.all([
      supabase.from("user_access").select("course_id").eq("user_id", user.id).eq("status", "active"),
      supabase.from("courses").select("id").eq("user_id", user.id),
    ]);
    const ids = [...new Set([...(access?.map(a => a.course_id) || []), ...(owned?.map(o => o.id) || [])])];
    if (ids.length === 0) { setLoading(false); return; }

    const { data: coursesData } = await supabase
      .from("courses")
      .select("id, title, description, thumbnail_url, category, modules ( id, title, sort_order, lessons ( id, title, sort_order ) )")
      .in("id", ids)
      .eq("is_published", true)
      .order("sort_order");

    const { data: progress } = await supabase
      .from("user_progress")
      .select("lesson_id, completed, updated_at")
      .eq("user_id", user.id);
    const progressMap = new Map(progress?.map(p => [p.lesson_id, p]) || []);

    const enriched: Course[] = (coursesData || []).map((c: any) => {
      const modules = (c.modules || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
      const allLessons: { id: string; title: string; moduleTitle: string }[] = [];
      modules.forEach((m: any) => {
        (m.lessons || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .forEach((l: any) => allLessons.push({ id: l.id, title: l.title, moduleTitle: m.title }));
      });
      const completed = allLessons.filter(l => progressMap.get(l.id)?.completed).length;

      let lastLesson: typeof allLessons[0] | null = null;
      let lastTime = 0;
      for (const l of allLessons) {
        const p = progressMap.get(l.id);
        if (p && new Date(p.updated_at).getTime() > lastTime && !p.completed) {
          lastTime = new Date(p.updated_at).getTime();
          lastLesson = l;
        }
      }
      if (!lastLesson) lastLesson = allLessons.find(l => !progressMap.get(l.id)?.completed) || allLessons[0] || null;

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnail_url: c.thumbnail_url,
        category: c.category || "geral",
        totalLessons: allLessons.length,
        completedLessons: completed,
        lastLessonId: lastLesson?.id || null,
        lastLessonTitle: lastLesson?.title || null,
        lastModuleTitle: lastLesson?.moduleTitle || null,
        lastActivityAt: lastTime,
        moduleCount: modules.length,
      };
    });

    setCourses(enriched);

    const { data: certData } = await supabase
      .from("certificates")
      .select("id, code, course_title, issued_at")
      .eq("user_id", user.id)
      .order("issued_at", { ascending: false })
      .limit(10);
    setCerts((certData || []) as Cert[]);

    setLoading(false);
  }

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }, []);
  const displayName = user?.email?.split("@")[0] || "Aluno";

  const continueWatching = courses
    .filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons)
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  const fresh = courses.filter(c => c.completedLessons === 0);
  const completed = courses.filter(c => c.totalLessons > 0 && c.completedLessons === c.totalLessons);
  const featured = continueWatching[0] || fresh[0] || courses[0] || null;
  const totalLessons = courses.reduce((a, c) => a + c.totalLessons, 0);
  const totalCompleted = courses.reduce((a, c) => a + c.completedLessons, 0);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Flame className="h-5 w-5 text-emerald-400" />
            </motion.div>
          </div>
          <div className="h-1 w-40 bg-white/5 overflow-hidden rounded-full">
            <motion.div
              className="h-full w-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center pt-16">
        <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-8">
          <BookOpen className="h-9 w-9 text-zinc-600" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-3">{greeting}, {displayName}</p>
        <h2 className="font-display text-4xl font-black tracking-[-0.04em] text-zinc-100 mb-4">Sua biblioteca está vazia</h2>
        <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">Quando você adquirir um curso, ele aparecerá aqui pronto pra ser assistido.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#050505] text-zinc-100 antialiased">
      {/* ═══ HERO — Netflix-style full-bleed cinematic ═══ */}
      {featured && (
        <section className="relative h-[92dvh] min-h-[600px] max-h-[900px] w-full overflow-hidden -mt-16">
          {/* Background image with subtle zoom */}
          <div className="absolute inset-0">
            {featured.thumbnail_url ? (
              <motion.img
                src={featured.thumbnail_url}
                alt=""
                className="w-full h-full object-cover"
                initial={{ scale: 1.05 }}
                animate={{ scale: 1 }}
                transition={{ duration: 8, ease: "easeOut" }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-950/80 via-zinc-950 to-blue-950/40" />
            )}
            {/* Multi-layer Netflix-style gradients */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-[#050505]/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-transparent to-transparent" />
            {/* Vignette */}
            <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_50%,rgba(5,5,5,0.8)_100%)]" />
          </div>

          {/* Content — bottom-left Netflix position */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.2 }}
            className="relative h-full flex flex-col justify-end px-6 lg:px-16 pb-28 max-w-3xl"
          >
            {/* Category pill */}
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                <Flame className="h-3 w-3" />
                {featured.completedLessons > 0 && featured.completedLessons < featured.totalLessons
                  ? "Continue assistindo"
                  : featured.completedLessons === 0
                  ? "Novo"
                  : "Concluído"}
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.16em] font-bold capitalize">
                {featured.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display text-[40px] md:text-[60px] lg:text-[80px] font-black tracking-[-0.045em] text-balance leading-[0.92] mb-5 text-white [text-shadow:0_4px_30px_rgba(0,0,0,0.5)]">
              {featured.title}
            </h1>

            {/* Meta row */}
            <div className="flex items-center gap-5 mb-5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-display font-bold text-sm text-zinc-200 tabular-nums">4.9</span>
              </div>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="text-sm text-zinc-400">{featured.totalLessons} aulas</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="text-sm text-zinc-400">{featured.moduleCount} módulos</span>
              {featured.completedLessons > 0 && (
                <>
                  <span className="h-1 w-1 rounded-full bg-zinc-700" />
                  <span className="text-sm text-emerald-400 font-semibold">
                    {Math.round((featured.completedLessons / featured.totalLessons) * 100)}% concluído
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            {featured.description && (
              <p className="max-w-xl text-zinc-300/90 text-base lg:text-[17px] leading-relaxed mb-8 line-clamp-2 [text-shadow:0_2px_10px_rgba(0,0,0,0.5)]">
                {featured.description}
              </p>
            )}

            {/* CTA buttons — Netflix style */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/membros-area/curso/${featured.id}${featured.lastLessonId ? `?lesson=${featured.lastLessonId}` : ""}`}
                className="group inline-flex items-center gap-2.5 px-8 py-3.5 bg-white text-[#050505] font-display font-black text-[15px] rounded-md hover:bg-zinc-200 transition-all duration-300 active:scale-[0.97] shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
              >
                <Play className="h-5 w-5 fill-current" />
                {featured.completedLessons > 0 && featured.completedLessons < featured.totalLessons
                  ? "Continuar"
                  : featured.completedLessons === 0
                  ? "Assistir"
                  : "Rever"}
              </Link>

              <Link
                to={`/membros-area/curso/${featured.id}`}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-zinc-700/60 text-zinc-100 font-display font-bold text-[14px] rounded-md hover:bg-zinc-700/80 transition-all duration-300 active:scale-[0.97] backdrop-blur-sm"
              >
                Mais informações
              </Link>
            </div>

            {/* Progress bar */}
            {featured.totalLessons > 0 && featured.completedLessons > 0 && (
              <div className="mt-6 max-w-md">
                <div className="h-[3px] bg-white/15 overflow-hidden rounded-full">
                  <motion.div
                    className="h-full bg-emerald-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round((featured.completedLessons / featured.totalLessons) * 100)}%` }}
                    transition={{ duration: 1.2, ease, delay: 0.5 }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </section>
      )}

      {/* ═══ RAILS — Netflix carousels ═══ */}
      <main className="relative z-10 -mt-12 pb-32 space-y-12">
        {continueWatching.length > 0 && (
          <Rail title="Continue assistindo" courses={continueWatching} variant="wide" />
        )}

        {fresh.length > 0 && (
          <Rail title="Para começar" courses={fresh} variant="wide" />
        )}

        {courses.length > 1 && (
          <Rail title="Toda sua biblioteca" subtitle={`${courses.length} cursos disponíveis`} courses={courses} variant="poster" />
        )}

        {certs.length > 0 && (
          <CertificationsRail certs={certs} />
        )}

        {completed.length > 0 && (
          <Rail title="Concluídos" courses={completed} variant="wide" />
        )}

        {/* Footer stats */}
        <section className="px-6 lg:px-16 pt-16 border-t border-white/5">
          <div className="flex flex-wrap gap-x-16 gap-y-8 opacity-50 hover:opacity-100 transition-opacity duration-500">
            <Stat label="Cursos" value={courses.length} />
            <Stat label="Aulas concluídas" value={`${totalCompleted}/${totalLessons}`} />
            <Stat label="Certificados" value={certs.length} />
            <Stat label="Em andamento" value={continueWatching.length} />
          </div>
        </section>
      </main>
    </div>
  );
}

/* ─── Rail with scroll buttons ─── */
function Rail({ title, subtitle, courses, variant }: { title: string; subtitle?: string; courses: Course[]; variant: "wide" | "poster" }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 20);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 20);
  };

  const scroll = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <section className="space-y-4 group/rail">
      <div className="flex items-end justify-between px-6 lg:px-16">
        <div>
          <h2 className="font-display text-xl lg:text-[22px] font-bold tracking-[-0.02em] text-zinc-100">{title}</h2>
          {subtitle && <p className="text-[11px] text-zinc-600 font-medium mt-1">{subtitle}</p>}
        </div>
        <div className="hidden md:flex items-center gap-1">
          <button
            onClick={() => scroll(-1)}
            className={cn(
              "h-8 w-8 rounded-md border border-white/10 flex items-center justify-center transition-all",
              showLeft ? "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60" : "opacity-30 pointer-events-none"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            className={cn(
              "h-8 w-8 rounded-md border border-white/10 flex items-center justify-center transition-all",
              showRight ? "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60" : "opacity-30 pointer-events-none"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        {/* Gradient fades */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none transition-opacity", showLeft ? "opacity-100" : "opacity-0")} />
        <div className={cn("absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none transition-opacity", showRight ? "opacity-100" : "opacity-0")} />

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
        >
          <div className="flex gap-3 px-6 lg:px-16 pb-2">
            {courses.map((c, i) => (
              <CourseCard key={c.id} course={c} variant={variant} index={i} />
            ))}
            <div className="shrink-0 w-4 lg:w-10" aria-hidden />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Course Card — Netflix hover effect ─── */
function CourseCard({ course, variant, index }: { course: Course; variant: "wide" | "poster"; index: number }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isCompleted = pct === 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease, delay: Math.min(index * 0.04, 0.25) }}
      className={cn("shrink-0 snap-start group", variant === "wide" ? "w-[320px] lg:w-[380px]" : "w-[180px] lg:w-[200px]")}
    >
      <Link to={`/membros-area/curso/${course.id}${course.lastLessonId ? `?lesson=${course.lastLessonId}` : ""}`} className="block">
        <div className={cn(
          "relative overflow-hidden bg-zinc-900 border border-white/[0.06] rounded-md transition-all duration-500",
          "group-hover:border-emerald-500/40 group-hover:shadow-[0_8px_40px_-12px_rgba(16,185,129,0.15)] group-hover:scale-[1.03] group-hover:z-20",
          variant === "wide" ? "aspect-video" : "aspect-[2/3]"
        )}>
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-900/40 via-zinc-900 to-blue-900/20 flex items-center justify-center p-6">
              <span className="font-display text-sm font-bold opacity-25 text-center text-balance">{course.title}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/10 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

          {/* Completion badge */}
          {isCompleted && (
            <div className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
              <Award className="h-3.5 w-3.5 text-[#050505]" />
            </div>
          )}

          {/* Hover play overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="h-14 w-14 rounded-full bg-white/95 flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.3)] scale-90 group-hover:scale-100 transition-transform duration-300">
              <Play className="h-6 w-6 text-[#050505] fill-current ml-0.5" />
            </div>
          </div>

          {/* Progress bar — Netflix red bar */}
          {pct > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
              <div
                className={cn("h-full transition-all", isCompleted ? "bg-emerald-400" : "bg-emerald-500")}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          {/* Bottom info overlay for poster */}
          {variant === "poster" && (
            <div className="absolute bottom-0 inset-x-0 p-3.5">
              <h3 className="font-display font-bold text-[13px] text-zinc-100 line-clamp-2 leading-snug [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
                {course.title}
              </h3>
            </div>
          )}
        </div>

        {/* Info below for wide variant */}
        {variant === "wide" && (
          <div className="mt-3.5 space-y-1.5 px-0.5">
            <h3 className="font-display font-bold text-zinc-100 text-[15px] group-hover:text-emerald-400 transition-colors line-clamp-1 tracking-tight">
              {course.title}
            </h3>
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              {course.lastLessonTitle && pct > 0 && pct < 100 ? (
                <span className="truncate">{course.lastLessonTitle}</span>
              ) : isCompleted ? (
                <span className="text-emerald-400/80">Curso concluído</span>
              ) : (
                <span>{course.totalLessons} aulas · {course.moduleCount} módulos</span>
              )}
            </div>
          </div>
        )}
      </Link>
    </motion.div>
  );
}

/* ─── Certificações ─── */
function CertificationsRail({ certs }: { certs: Cert[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between px-6 lg:px-16">
        <div>
          <h2 className="font-display text-xl lg:text-[22px] font-bold tracking-[-0.02em] text-zinc-100">Suas certificações</h2>
          <p className="text-[11px] text-zinc-600 font-medium mt-1">{certs.length} {certs.length === 1 ? "emitida" : "emitidas"}</p>
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory">
        <div className="flex gap-4 px-6 lg:px-16 pb-2">
          {certs.map((cert, i) => (
            <motion.div
              key={cert.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: Math.min(i * 0.05, 0.3) }}
              className="shrink-0 snap-start w-72 p-6 rounded-md bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 border border-white/[0.06] hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between group min-h-[220px]"
            >
              <div>
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center mb-5">
                  <Award className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="text-[10px] font-bold text-emerald-400 tracking-[0.16em] uppercase mb-2">
                  {new Date(cert.issued_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </p>
                <h4 className="font-display text-lg font-bold leading-tight tracking-tight text-zinc-100 line-clamp-2">
                  {cert.course_title}
                </h4>
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-mono text-zinc-600 tracking-wider mb-3">ID · {cert.code}</p>
                <Link
                  to={`/certificado/${cert.code}`}
                  target="_blank"
                  className="flex items-center justify-between w-full py-2.5 border-t border-white/10 text-[10px] font-bold tracking-[0.16em] uppercase text-zinc-400 hover:text-emerald-400 transition-colors"
                >
                  Ver certificado
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Footer Stat ─── */
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 font-bold mb-1.5">{label}</p>
      <p className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{value}</p>
    </div>
  );
}
