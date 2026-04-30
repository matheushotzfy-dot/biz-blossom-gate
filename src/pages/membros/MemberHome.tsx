/**
 * MemberHome — Cinematic Noir
 * Hero gigante 85vh, rails horizontais com snap, certificações.
 * Sem chrome desnecessário, thumbnail é o herói.
 */
import { useEffect, useMemo, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Play, ArrowUpRight, Award, BookOpen, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
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
      // fallback: first uncompleted
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
        <div className="h-1 w-32 bg-white/5 overflow-hidden">
          <motion.div
            className="h-full w-full bg-emerald-500"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center pt-16">
        <div className="h-16 w-16 rounded-sm bg-zinc-900 border border-white/10 flex items-center justify-center mb-6">
          <BookOpen className="h-7 w-7 text-zinc-700" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-2">{greeting}, {displayName}</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-zinc-100 mb-3">Sua biblioteca está vazia</h2>
        <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">Quando você adquirir um curso, ele aparecerá aqui pronto pra ser assistido.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#050505] text-zinc-100 antialiased">
      {/* ═══ HERO CINEMATOGRÁFICO ═══ */}
      {featured && (
        <section className="relative h-[88dvh] min-h-[600px] w-full overflow-hidden -mt-16">
          {/* Background */}
          <div className="absolute inset-0">
            {featured.thumbnail_url ? (
              <img
                src={featured.thumbnail_url}
                alt=""
                className="w-full h-full object-cover opacity-50"
                style={{ maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)" }}
              />
            ) : (
              <div
                className="w-full h-full bg-gradient-to-br from-emerald-900/40 via-zinc-900 to-blue-900/30"
                style={{ maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)" }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
          </div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="relative h-full flex flex-col justify-end px-6 lg:px-12 pb-20 max-w-5xl"
          >
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-bold mb-3">{greeting}, {displayName}</p>

            <div className="flex items-center gap-2.5 mb-5">
              {featured.completedLessons > 0 && featured.completedLessons < featured.totalLessons ? (
                <span className="px-2.5 py-1 rounded-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-[0.18em] uppercase">
                  Continuar
                </span>
              ) : featured.completedLessons === 0 ? (
                <span className="px-2.5 py-1 rounded-sm bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold tracking-[0.18em] uppercase">
                  Começar agora
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold tracking-[0.18em] uppercase">
                  Concluído
                </span>
              )}
              {featured.lastModuleTitle && (
                <span className="text-zinc-500 text-sm font-medium">{featured.lastModuleTitle}</span>
              )}
            </div>

            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-semibold tracking-[-0.04em] text-balance leading-[0.92] mb-5">
              {featured.title}
            </h1>

            {featured.description && (
              <p className="max-w-xl text-zinc-400 text-base lg:text-lg leading-relaxed mb-8 line-clamp-2">
                {featured.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-5">
              <Link
                to={`/membros-area/curso/${featured.id}${featured.lastLessonId ? `?lesson=${featured.lastLessonId}` : ""}`}
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-[#050505] font-display font-semibold text-sm rounded-sm hover:bg-emerald-400 transition-all duration-300 active:scale-[0.97]"
              >
                <Play className="h-4 w-4 fill-current" />
                {featured.completedLessons > 0 && featured.completedLessons < featured.totalLessons
                  ? `Continuar: ${featured.lastLessonTitle || "Próxima aula"}`
                  : featured.completedLessons === 0
                  ? "Começar curso"
                  : "Rever curso"}
              </Link>

              {featured.totalLessons > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-40 h-[3px] bg-white/10 overflow-hidden rounded-full">
                    <motion.div
                      className="h-full bg-emerald-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round((featured.completedLessons / featured.totalLessons) * 100)}%` }}
                      transition={{ duration: 1, ease, delay: 0.3 }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                    {Math.round((featured.completedLessons / featured.totalLessons) * 100)}% · {featured.completedLessons}/{featured.totalLessons}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </section>
      )}

      {/* ═══ RAILS ═══ */}
      <main className="relative z-10 -mt-16 pb-32 space-y-14">
        {continueWatching.length > 0 && (
          <Rail title="Continue assistindo" subtitle="De onde você parou" courses={continueWatching} variant="wide" />
        )}

        {fresh.length > 0 && (
          <Rail title="Para começar" subtitle="Cursos que você ainda não abriu" courses={fresh} variant="wide" />
        )}

        {courses.length > 1 && (
          <Rail title="Toda sua biblioteca" subtitle={`${courses.length} cursos disponíveis`} courses={courses} variant="poster" />
        )}

        {certs.length > 0 && (
          <CertificationsRail certs={certs} />
        )}

        {completed.length > 0 && (
          <Rail title="Concluídos" subtitle="Seu legado de aprendizado" courses={completed} variant="wide" />
        )}

        {/* Footer stats subtle */}
        <section className="px-6 lg:px-12 pt-12 border-t border-white/5">
          <div className="flex flex-wrap gap-x-16 gap-y-6 opacity-60 hover:opacity-100 transition-opacity">
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

/* ─── Rail (horizontal scroll) ─── */
function Rail({ title, subtitle, courses, variant }: { title: string; subtitle?: string; courses: Course[]; variant: "wide" | "poster" }) {
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between px-6 lg:px-12">
        <div>
          <h2 className="font-display text-xl lg:text-2xl font-semibold tracking-[-0.02em] text-zinc-100">{title}</h2>
          {subtitle && <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600 font-bold mt-1.5">{subtitle}</p>}
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory">
        <div className="flex gap-5 px-6 lg:px-12 pb-2">
          {courses.map((c, i) => (
            <CourseCard key={c.id} course={c} variant={variant} index={i} />
          ))}
          <div className="shrink-0 w-1 lg:w-6" aria-hidden />
        </div>
      </div>
    </section>
  );
}

/* ─── Course Card ─── */
function CourseCard({ course, variant, index }: { course: Course; variant: "wide" | "poster"; index: number }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isCompleted = pct === 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease, delay: Math.min(index * 0.04, 0.3) }}
      className={cn("shrink-0 snap-start group", variant === "wide" ? "w-[340px] lg:w-[400px]" : "w-[200px] lg:w-[220px]")}
    >
      <Link to={`/membros-area/curso/${course.id}${course.lastLessonId ? `?lesson=${course.lastLessonId}` : ""}`} className="block">
        <div className={cn(
          "relative overflow-hidden bg-zinc-900 border border-white/5 group-hover:border-emerald-500/40 transition-all duration-500",
          variant === "wide" ? "aspect-video rounded-sm" : "aspect-[2/3] rounded-sm"
        )}>
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-900/50 via-zinc-900 to-blue-900/30 flex items-center justify-center p-6">
              <span className="font-display text-base font-semibold opacity-30 text-center text-balance">{course.title}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/20 to-transparent opacity-70 group-hover:opacity-90 transition-opacity" />

          {/* Status badge */}
          {isCompleted && (
            <div className="absolute top-3 right-3 h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center">
              <Award className="h-3.5 w-3.5 text-[#050505]" />
            </div>
          )}

          {/* Hover play */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="h-12 w-12 rounded-full bg-white/95 flex items-center justify-center">
              <Play className="h-5 w-5 text-[#050505] fill-current ml-0.5" />
            </div>
          </div>

          {/* Progress bar */}
          {pct > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
              <div
                className={cn("h-full transition-all", isCompleted ? "bg-emerald-400" : "bg-emerald-500")}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          {/* Title overlay for poster variant */}
          {variant === "poster" && (
            <div className="absolute bottom-0 inset-x-0 p-4">
              <h3 className="font-display font-semibold text-sm text-zinc-100 line-clamp-2 leading-snug">{course.title}</h3>
            </div>
          )}
        </div>

        {/* Meta below for wide variant */}
        {variant === "wide" && (
          <div className="mt-4 space-y-1.5">
            <h3 className="font-display font-semibold text-zinc-100 text-base group-hover:text-emerald-400 transition-colors line-clamp-1 tracking-tight">
              {course.title}
            </h3>
            <p className="text-xs text-zinc-500 line-clamp-1">
              {isCompleted
                ? "Concluído · Certificado disponível"
                : course.completedLessons > 0
                ? `${course.totalLessons - course.completedLessons} aulas restantes`
                : `${course.totalLessons} aulas`}
            </p>
          </div>
        )}
      </Link>
    </motion.div>
  );
}

/* ─── Certificações ─── */
function CertificationsRail({ certs }: { certs: Cert[] }) {
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between px-6 lg:px-12">
        <div>
          <h2 className="font-display text-xl lg:text-2xl font-semibold tracking-[-0.02em] text-zinc-100">Suas certificações</h2>
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600 font-bold mt-1.5">{certs.length} {certs.length === 1 ? "emitida" : "emitidas"}</p>
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory">
        <div className="flex gap-5 px-6 lg:px-12 pb-2">
          {certs.map((cert, i) => (
            <motion.div
              key={cert.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: Math.min(i * 0.05, 0.3) }}
              className="shrink-0 snap-start w-72 aspect-[3/4] p-7 rounded-sm bg-zinc-900/60 border border-white/5 hover:border-emerald-500/40 hover:bg-zinc-900 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                <div className="h-11 w-11 rounded-sm bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center mb-6">
                  <Award className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="text-[10px] font-bold text-emerald-400 tracking-[0.18em] uppercase mb-2.5">
                  Concluído · {new Date(cert.issued_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </p>
                <h4 className="font-display text-xl font-semibold leading-tight tracking-tight text-zinc-100 line-clamp-3">
                  {cert.course_title}
                </h4>
              </div>
              <div>
                <p className="text-[10px] font-mono text-zinc-600 tracking-wider mb-4">ID · {cert.code}</p>
                <Link
                  to={`/certificado/${cert.code}`}
                  target="_blank"
                  className="flex items-center justify-between w-full py-3 border-t border-white/10 text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-400 hover:text-emerald-400 transition-colors"
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
      <p className="font-display text-2xl font-semibold text-zinc-100 tabular-nums">{value}</p>
    </div>
  );
}
