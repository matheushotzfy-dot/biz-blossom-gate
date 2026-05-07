/**
 * MemberHome — Netflix Premium Experience
 * Full-bleed cinematic hero, horizontal snap rails, immersive thumbnails.
 */
import { useEffect, useMemo, useState, useRef } from "react";
import { useOutletContext, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Play, ArrowUpRight, Award, BookOpen, ChevronRight, ChevronLeft, Star, Users, Trophy, Flame, Clock, Info, GraduationCap, PlayCircle, CheckCircle2 } from "lucide-react";
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
      <div className="min-h-dvh flex items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-6">
          <motion.div 
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} 
            transition={{ duration: 2, repeat: Infinity }}
            className="h-20 w-20 rounded-2xl bg-white flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.1)]"
          >
            <Play className="h-10 w-10 text-black fill-current ml-1.5" />
          </motion.div>
          <div className="h-1 w-48 bg-white/10 overflow-hidden rounded-full">
            <motion.div 
              className="h-full w-full bg-white" 
              animate={{ x: ["-100%", "100%"] }} 
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} 
            />
          </div>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center bg-[#050505] text-white">
        <div className="h-24 w-24 rounded-3xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-10 shadow-2xl">
          <BookOpen className="h-10 w-10 text-zinc-700" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-black mb-4">{greeting}, {displayName}</p>
        <h2 className="font-display text-4xl md:text-5xl font-black tracking-[-0.05em] text-white mb-6">Sua biblioteca está vazia</h2>
        <p className="text-zinc-500 max-w-sm leading-relaxed font-medium">Quando você adquirir um conteúdo, ele aparecerá aqui com acesso imediato e experiência premium.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#050505] text-zinc-100 antialiased selection:bg-emerald-500/30 overflow-x-hidden">
      {/* ═══ HERO — Cinematic 4K Experience ═══ */}
      {featured && (
        <section className="relative h-[92dvh] w-full overflow-hidden">
          {/* Main Background with Parallax-like scale */}
          <div className="absolute inset-0 z-0">
            {featured.thumbnail_url ? (
              <motion.img
                src={featured.thumbnail_url}
                alt=""
                className="w-full h-full object-cover"
                initial={{ scale: 1.15, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#0a0a0a] via-[#050505] to-[#080808]" />
            )}
            
            {/* Multi-layer Netflix-style gradients for depth */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(16,185,129,0.08),transparent_50%)]" />
            
            {/* Fine grain overlay for texture */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url('https://grainy-gradients.vercel.app/noise.svg')` }} />
          </div>

          <div className="relative h-full container mx-auto px-6 lg:px-16 flex flex-col justify-end pb-28 max-w-[1800px]">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl"
            >
              {/* Premium Label */}
              <div className="flex items-center gap-4 mb-8">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-xl">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white">
                    {featured.completedLessons > 0 ? "Retomar Experiência" : "Original Hotzfy"}
                  </span>
                </div>
                {featured.category && (
                  <span className="text-[10px] text-zinc-500 uppercase tracking-[0.25em] font-black">
                    {featured.category}
                  </span>
                )}
              </div>

              {/* Title — Ultra Display Typography */}
              <h1 className="font-display text-[52px] md:text-[84px] lg:text-[110px] font-black tracking-[-0.06em] leading-[0.82] mb-8 text-white select-none">
                {featured.title.split(' ').map((word, i) => (
                  <span key={i} className="inline-block mr-[0.2em] last:mr-0 drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                    {word}
                  </span>
                ))}
              </h1>

              {/* Description — Elegant & Legible */}
              {featured.description && (
                <p className="max-w-xl text-zinc-400 text-lg md:text-xl leading-relaxed mb-10 line-clamp-3 font-medium tracking-tight">
                  {featured.description}
                </p>
              )}

              {/* Action Suite */}
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to={`/membros-area/curso/${featured.id}${featured.lastLessonId ? `?lesson=${featured.lastLessonId}` : ""}`}
                  className="group relative flex items-center gap-4 px-12 py-5 bg-white text-[#050505] font-display font-black text-[17px] rounded-lg transition-all duration-500 active:scale-[0.96] hover:bg-zinc-100 overflow-hidden"
                >
                  <Play className="h-6 w-6 fill-current" />
                  <span>{featured.completedLessons > 0 ? "Retomar de onde parou" : "Iniciar agora"}</span>
                  
                  {/* Subtle shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-black/5 to-transparent" />
                </Link>

                <Link
                  to={`/membros-area/curso/${featured.id}`}
                  className="flex items-center gap-3 px-10 py-5 bg-zinc-800/40 text-zinc-100 font-display font-black text-[16px] rounded-lg hover:bg-zinc-800/60 transition-all duration-300 active:scale-[0.96] backdrop-blur-2xl border border-white/5"
                >
                  <Info className="h-5 w-5" />
                  Detalhes
                </Link>
              </div>
            </motion.div>
          </div>
          
          {/* Bottom shadow blend */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#050505] to-transparent z-[1]" />
        </section>
      )}

      {/* ═══ RAILS — Immersive Experience ═══ */}
      <main className="relative z-10 -mt-32 pb-40 space-y-24">
        {continueWatching.length > 0 && (
          <Rail title="Continue assistindo" courses={continueWatching} variant="wide" />
        )}

        {fresh.length > 0 && (
          <Rail title="Adicionados recentemente" courses={fresh} variant="wide" />
        )}

        {courses.length > 0 && (
          <Rail title="Sua Coleção Premium" subtitle={`${courses.length} títulos exclusivos`} courses={courses} variant="poster" />
        )}

        {certs.length > 0 && (
          <CertificationsRail certs={certs} />
        )}

        {completed.length > 0 && (
          <Rail title="Domínio Completo" courses={completed} variant="wide" />
        )}

        {/* Global Stats Hub */}
        <section className="container mx-auto px-6 lg:px-16 pt-24 border-t border-white/[0.03] max-w-[1800px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 opacity-30 hover:opacity-100 transition-all duration-1000">
            <Stat label="Conteúdos Adquiridos" value={courses.length} icon={GraduationCap} />
            <Stat label="Progresso Total" value={`${totalCompleted}/${totalLessons}`} icon={PlayCircle} />
            <Stat label="Certificações" value={certs.length} icon={Award} />
            <Stat label="Foco e Disciplina" value={`${continueWatching.length}d`} icon={Flame} />
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
    <section className="space-y-6 group/rail">
      <div className="flex items-end justify-between px-6 lg:px-16 max-w-[1800px] mx-auto">
        <div>
          <h2 className="font-display text-2xl lg:text-[28px] font-black tracking-[-0.03em] text-white/90">{title}</h2>
          {subtitle && <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-[0.2em] mt-2">{subtitle}</p>}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => scroll(-1)}
            className={cn(
              "h-10 w-10 rounded-full border border-white/5 flex items-center justify-center transition-all duration-300",
              showLeft ? "bg-zinc-900/80 text-white hover:bg-zinc-800 hover:border-white/20" : "opacity-0 pointer-events-none"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll(1)}
            className={cn(
              "h-10 w-10 rounded-full border border-white/5 flex items-center justify-center transition-all duration-300",
              showRight ? "bg-zinc-900/80 text-white hover:bg-zinc-800 hover:border-white/20" : "opacity-100"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
        >
          <div className="flex gap-4 px-6 lg:px-16 pb-8 max-w-[1800px] mx-auto">
            {courses.map((c, i) => (
              <CourseCard key={c.id} course={c} variant={variant} index={i} />
            ))}
            <div className="shrink-0 w-8 lg:w-20" aria-hidden />
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
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.05, 0.3) }}
      className={cn(
        "shrink-0 snap-start group cursor-pointer",
        variant === "wide" ? "w-[340px] md:w-[420px]" : "w-[200px] md:w-[240px]"
      )}
    >
      <Link to={`/membros-area/curso/${course.id}${course.lastLessonId ? `?lesson=${course.lastLessonId}` : ""}`} className="block">
        <div className={cn(
          "relative overflow-hidden bg-zinc-900 rounded-lg transition-all duration-700 ease-[0.16,1,0.3,1]",
          "border border-white/5",
          "group-hover:border-white/20 group-hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]",
          variant === "wide" ? "aspect-video" : "aspect-[2/3]"
        )}>
          {/* Main Thumbnail */}
          {course.thumbnail_url ? (
            <motion.img
              src={course.thumbnail_url}
              alt={course.title}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center p-6 text-center">
              <span className="font-display text-xs font-bold opacity-30 tracking-tight">{course.title}</span>
            </div>
          )}

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
          
          {/* Completion Glow */}
          {isCompleted && (
            <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <Award className="h-4 w-4 text-black" />
            </div>
          )}

          {/* Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
            <motion.div 
              initial={{ scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center"
            >
              <Play className="h-7 w-7 text-white fill-current ml-1" />
            </motion.div>
          </div>

          {/* Netflix Red Progress Bar */}
          {pct > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                className={cn("h-full transition-all duration-1000", isCompleted ? "bg-emerald-400" : "bg-emerald-500")}
              />
            </div>
          )}

          {/* Content Overlays */}
          {variant === "poster" && (
            <div className="absolute bottom-0 inset-x-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
              <h3 className="font-display font-black text-[15px] text-white leading-tight line-clamp-2 drop-shadow-lg">
                {course.title}
              </h3>
            </div>
          )}
        </div>

        {variant === "wide" && (
          <div className="mt-4 space-y-2">
            <h3 className="font-display font-black text-white text-[17px] group-hover:text-emerald-400 transition-colors tracking-tight">
              {course.title}
            </h3>
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500">
              {isCompleted ? (
                <span className="text-emerald-500/80 flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> Completo</span>
              ) : pct > 0 ? (
                <span className="text-zinc-300">Retomar {course.lastLessonTitle && `· ${course.lastLessonTitle}`}</span>
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
function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-zinc-500" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 font-bold mb-0.5">{label}</p>
        <p className="font-display text-xl font-black text-zinc-100 tabular-nums leading-none tracking-tight">{value}</p>
      </div>
    </div>
  );
}
