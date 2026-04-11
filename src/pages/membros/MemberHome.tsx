import { useEffect, useState, useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  GraduationCap, Search, X, ChevronRight, CheckCircle2, Play,
} from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed" | "not_started">("all");

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

  const getStatus = (c: CourseWithProgress) => {
    if (c.totalLessons === 0) return "not_started";
    if (c.completedLessons === c.totalLessons) return "completed";
    if (c.completedLessons > 0) return "in_progress";
    return "not_started";
  };

  const inProgressCount = courses.filter(c => getStatus(c) === "in_progress").length;
  const completedCount = courses.filter(c => getStatus(c) === "completed").length;
  const notStartedCount = courses.filter(c => getStatus(c) === "not_started").length;

  const filtered = useMemo(() => {
    let result = courses;
    if (statusFilter !== "all") result = result.filter(c => getStatus(c) === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    }
    return result;
  }, [courses, search, statusFilter]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }, []);
  const displayName = user?.email?.split("@")[0] || "Aluno";

  const tabs = [
    { label: "Todos", value: "all" as const, count: courses.length },
    { label: "Em andamento", value: "in_progress" as const, count: inProgressCount },
    { label: "Concluídos", value: "completed" as const, count: completedCount },
    { label: "Não iniciados", value: "not_started" as const, count: notStartedCount },
  ];

  const statusLabel = (s: string) => s === "completed" ? "Concluído" : s === "in_progress" ? "Em andamento" : "Não iniciado";
  const statusDot = (s: string) => s === "completed" ? "bg-emerald-500" : s === "in_progress" ? "bg-primary" : "bg-muted-foreground/30";

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (courses.length === 0) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <GraduationCap className="h-10 w-10 text-muted-foreground/20 mb-4" />
      <h2 className="text-xl font-bold text-foreground mb-1">{greeting}, {displayName}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Quando você adquirir um produto, seus cursos aparecerão aqui.
      </p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-28 md:pb-16">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">{greeting}, {displayName}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{courses.length} curso{courses.length !== 1 && "s"} disponíve{courses.length !== 1 ? "is" : "l"}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-0.5 border-b border-border/40 sm:border-0">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "px-3 py-2 text-[13px] font-medium transition-colors relative",
                statusFilter === t.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  "ml-1.5 text-[11px] tabular-nums",
                  statusFilter === t.value ? "text-primary font-semibold" : "text-muted-foreground/50"
                )}>{t.count}</span>
              )}
              {statusFilter === t.value && (
                <motion.div layoutId="member-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar curso…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-shadow"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground/40" />
            </button>
          )}
        </div>
      </div>

      {/* Course List */}
      {filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <GraduationCap className="h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            {search || statusFilter !== "all" ? "Nenhum resultado" : "Nenhum curso encontrado"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_160px_100px_40px] items-center px-5 py-2.5 border-b border-border/50 bg-muted/30">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Curso</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Progresso</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/40">
            {filtered.map(c => {
              const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
              const status = getStatus(c);
              return (
                <Link
                  key={c.id}
                  to={`/membros-area/curso/${c.id}`}
                  className="group grid grid-cols-1 sm:grid-cols-[1fr_160px_100px_40px] items-center px-5 py-3.5 hover:bg-muted/20 transition-colors"
                >
                  {/* Course info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                        <GraduationCap className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5 max-w-[260px]">
                        {c.modules.length} módulo{c.modules.length !== 1 && "s"} · {c.totalLessons} aula{c.totalLessons !== 1 && "s"}
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="hidden sm:flex items-center gap-2.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[100px]">
                      <div
                        className={cn("h-full rounded-full transition-all", status === "completed" ? "bg-emerald-500" : "bg-primary")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-muted-foreground tabular-nums w-8">{pct}%</span>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", statusDot(status))} />
                    <span className="text-[12px] text-muted-foreground">{statusLabel(status)}</span>
                  </div>

                  {/* Arrow */}
                  <div className="hidden sm:flex justify-end">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                  </div>

                  {/* Mobile meta */}
                  <div className="flex items-center justify-between mt-2 sm:hidden">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(status))} />
                        <span className="text-[11px] text-muted-foreground">{statusLabel(status)}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground/50">{pct}%</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
