import { useEffect, useMemo, useState, useRef } from "react";
import { useOutletContext, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { 
  Play, 
  Award, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  Trophy, 
  Flame, 
  GraduationCap, 
  PlayCircle, 
  Clock, 
  Sparkles,
  ArrowRight,
  Bookmark,
  TrendingUp,
  LayoutGrid,
  List,
} from "lucide-react";
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
  moduleCount: number;
};

type Cert = { id: string; code: string; course_title: string; issued_at: string };

export default function MemberHome() {
  const { user } = useOutletContext<{ user: User }>();
  const [courses, setCourses] = useState<Course[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => { if (user) load(); }, [user]);

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
        category: c.category || "Geral",
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
      .limit(5);
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
  const featured = continueWatching[0] || fresh[0] || null;

  const totalLessons = courses.reduce((a, c) => a + c.totalLessons, 0);
  const totalCompleted = courses.reduce((a, c) => a + c.completedLessons, 0);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-center animate-pulse">
            <PlayCircle className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-black text-zinc-500 uppercase tracking-widest">Preparando seu dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto py-10 space-y-12">
      {/* ═══ Header Section ═══ */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2 flex items-center gap-2">
              <Sparkles className="h-3 w-3" />
              Bem-vindo de volta
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
              {greeting}, <span className="text-zinc-400">{displayName}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 p-2 rounded-2xl">
            <button 
              onClick={() => setViewMode("grid")}
              aria-label="Visualizar em grade"
              aria-pressed={viewMode === "grid"}
              className={cn("p-2 rounded-xl transition-all", viewMode === "grid" ? "bg-primary text-primary-foreground shadow-lg" : "text-zinc-500 hover:text-white")}
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              aria-label="Visualizar em lista"
              aria-pressed={viewMode === "list"}
              className={cn("p-2 rounded-xl transition-all", viewMode === "list" ? "bg-primary text-primary-foreground shadow-lg" : "text-zinc-500 hover:text-white")}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          <StatCard label="Cursos Ativos" value={courses.length} icon={BookOpen} color="text-primary" />
          <StatCard label="Aulas Concluídas" value={totalCompleted} subValue={`de ${totalLessons}`} icon={PlayCircle} color="text-emerald-400" />
          <StatCard label="Certificados" value={certs.length} icon={Award} color="text-orange-400" />
          <StatCard label="Nível de Foco" value="Pro" icon={Trophy} color="text-purple-400" />
        </div>
      </section>

      {/* ═══ Featured / Continue Watching ═══ */}
      {featured && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-white flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              Continue de onde parou
            </h2>
            <Link to="/membros-area/cursos" className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-primary transition-colors flex items-center gap-2">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-[#0a0a0a] group">
            <div className="flex flex-col lg:flex-row min-h-[400px]">
              {/* Image Side */}
              <div className="lg:w-1/2 relative h-64 lg:h-auto overflow-hidden">
                <img 
                  src={featured.thumbnail_url || ""} 
                  alt={featured.title} 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-transparent to-transparent hidden lg:block" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent lg:hidden" />
              </div>
              
              {/* Content Side */}
              <div className="lg:w-1/2 p-8 lg:p-14 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-6">
                  <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-widest text-primary">
                    {featured.category}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                    {featured.moduleCount} Módulos
                  </span>
                </div>
                
                <h3 className="text-3xl md:text-5xl font-black tracking-tighter text-white mb-6">
                  {featured.title}
                </h3>
                
                <p className="text-zinc-500 text-lg mb-8 line-clamp-2 max-w-xl">
                  {featured.description || "Continue sua jornada de aprendizado e alcance seus objetivos com este curso exclusivo."}
                </p>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-zinc-500">
                      <span>Seu progresso</span>
                      <span className="text-emerald-400">{Math.round((featured.completedLessons / featured.totalLessons) * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-1000" 
                        style={{ width: `${(featured.completedLessons / featured.totalLessons) * 100}%` }} 
                      />
                    </div>
                  </div>

                  <Link 
                    to={`/membros-area/curso/${featured.id}${featured.lastLessonId ? `?lesson=${featured.lastLessonId}` : ""}`}
                    className="inline-flex items-center gap-4 px-10 py-5 bg-white text-black rounded-2xl font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
                  >
                    <Play className="h-6 w-6 fill-current" />
                    Continuar Aula
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ Main Library ═══ */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Minha Biblioteca
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-zinc-600">{courses.length} cursos</span>
          </div>
        </div>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {courses.map((course, idx) => (
              <CourseCard key={course.id} course={course} index={idx} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course, idx) => (
              <CourseListRow key={course.id} course={course} index={idx} />
            ))}
          </div>
        )}
      </section>

      {/* ═══ Certifications ═══ */}
      {certs.length > 0 && (
        <section className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 lg:p-12">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl font-black text-white">Certificações</h2>
              <p className="text-zinc-500 text-sm mt-1">Seu histórico de conquistas e domínio de habilidades</p>
            </div>
            <Award className="h-10 w-10 text-orange-400 opacity-20" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {certs.map((cert) => (
              <div key={cert.id} className="bg-white/[0.03] border border-white/5 p-6 rounded-2xl flex items-center justify-between group hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-5">
                  <div className="h-14 w-14 rounded-xl bg-orange-400/10 text-orange-400 flex items-center justify-center">
                    <Award className="h-7 w-7" />
                  </div>
                  <div>
                    <h4 className="font-black text-white tracking-tight">{cert.course_title}</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mt-1">Concedido em {new Date(cert.issued_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                <button aria-label={`Ver certificado de ${cert.course_title}`} className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, subValue, icon: Icon, color }: { label: string; value: string | number; subValue?: string; icon: any; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 p-6 rounded-2xl hover:bg-white/[0.05] transition-all group">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 transition-colors">{label}</p>
        <Icon className={cn("h-5 w-5 opacity-40 group-hover:opacity-100 transition-all", color)} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-white tracking-tighter">{value}</span>
        {subValue && <span className="text-xs font-bold text-zinc-600">{subValue}</span>}
      </div>
    </div>
  );
}

function CourseCard({ course, index }: { course: Course; index: number }) {
  const pct = Math.round((course.completedLessons / course.totalLessons) * 100) || 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative flex flex-col bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden hover:border-primary/50 transition-all hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)]"
    >
      <Link to={`/membros-area/curso/${course.id}`} className="block">
        <div className="aspect-[16/10] relative overflow-hidden">
          <img 
            src={course.thumbnail_url || ""} 
            alt={course.title} 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {pct > 0 && (
            <div className="absolute bottom-4 left-4 right-4 z-10">
               <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
               </div>
            </div>
          )}
          
          <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
            <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
              <Play className="h-5 w-5 fill-current" />
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col flex-1">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">{course.category}</span>
            <div className="flex items-center gap-1 text-[10px] font-black text-zinc-600">
               <Clock className="h-3 w-3" />
               {course.totalLessons} Aulas
            </div>
          </div>
          
          <h3 className="text-lg font-black text-white tracking-tight leading-snug line-clamp-2 mb-4 group-hover:text-primary transition-colors">
            {course.title}
          </h3>

          <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-6 w-6 rounded-full border-2 border-black bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500">
                  {i}
                </div>
              ))}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {pct === 100 ? "Concluído" : pct > 0 ? `${pct}%` : "Começar"}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function CourseListRow({ course, index }: { course: Course; index: number }) {
  const pct = Math.round((course.completedLessons / course.totalLessons) * 100) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex items-center gap-6 hover:border-primary/50 transition-all"
    >
      <div className="h-16 w-24 rounded-lg overflow-hidden shrink-0">
        <img src={course.thumbnail_url || ""} alt="" className="h-full w-full object-cover" />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-black tracking-tight truncate group-hover:text-primary transition-colors">{course.title}</h4>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">{course.category}</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{course.totalLessons} Aulas</span>
        </div>
      </div>

      <div className="w-48 hidden md:block">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">
          <span>Progresso</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Link 
        to={`/membros-area/curso/${course.id}`}
        className="h-12 w-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-zinc-500 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all group-hover:scale-105"
      >
        <ArrowRight className="h-5 w-5" />
      </Link>
    </motion.div>
  );
}
