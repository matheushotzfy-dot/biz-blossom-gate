import { useEffect, useState, useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  GraduationCap, Search, X, CheckCircle2, Play,
  BookOpen, Layers, Trophy, Flame, BarChart3, ArrowUpRight, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ModuleInfo = { id: string; title: string; banner_url: string | null; sort_order: number; lessonCount: number };
type CourseWithProgress = {
  id: string; title: string; description: string | null; thumbnail_url: string | null;
  category: string; totalLessons: number; completedLessons: number; lastLesson: string | null; modules: ModuleInfo[];
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
        id: m.id, title: m.title, banner_url: m.banner_url, sort_order: m.sort_order, lessonCount: m.lessons?.length || 0,
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
  const totalCompleted = courses.reduce((a, c) => a + c.completedLessons, 0);
  const totalLessons = courses.reduce((a, c) => a + c.totalLessons, 0);
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

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

  const continueWatching = courses.filter(c => c.completedLessons > 0 && c.completedLessons < c.totalLessons);

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-14 w-14 rounded-2xl border border-border bg-card flex items-center justify-center">
            <GraduationCap className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-primary animate-spin" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Carregando</p>
      </div>
    </div>
  );

  if (courses.length === 0) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="h-20 w-20 rounded-2xl border border-border bg-card flex items-center justify-center mb-5">
        <GraduationCap className="h-9 w-9 text-muted-foreground/30" />
      </div>
      <h2 className="font-display text-xl font-bold tracking-tight text-foreground mb-1">{greeting}, {displayName}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Quando você adquirir um produto, seus cursos aparecerão aqui.
      </p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1340px] px-4 sm:px-6 lg:px-8 pb-28 md:pb-16">
      {/* ── Hero Header ── */}
      <header className="pt-6 pb-1">
        <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
          <Sparkles className="h-3 w-3 text-primary" strokeWidth={2.5} />
          Área de Membros
        </div>
        <h1 className="mt-2 font-display text-[28px] sm:text-[32px] font-bold leading-tight tracking-[-0.02em] text-foreground">
          {greeting}, <span className="text-primary">{displayName}</span>
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {courses.length} curso{courses.length !== 1 && "s"} disponíve{courses.length !== 1 ? "is" : "l"}
          {totalLessons > 0 && (
            <>
              {" · "}
              <span className="font-mono font-semibold tabular-nums text-foreground">{totalCompleted}</span>
              <span className="text-muted-foreground/60">/{totalLessons}</span> aulas concluídas
            </>
          )}
        </p>
      </header>

      {/* ── Stats Row ── */}
      {totalLessons > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-5 mb-7">
          {[
            { icon: BarChart3, label: "Progresso", value: `${overallPct}%`, sub: "geral", tone: "primary" as const },
            { icon: CheckCircle2, label: "Aulas", value: totalCompleted, sub: `de ${totalLessons}`, tone: "success" as const },
            { icon: Flame, label: "Em andamento", value: inProgressCount, sub: inProgressCount === 1 ? "curso" : "cursos", tone: "warning" as const },
          ].map((s, i) => {
            const Icon = s.icon;
            const toneMap = {
              primary: { bg: "bg-primary/10", ring: "ring-primary/20", text: "text-primary" },
              success: { bg: "bg-success/10", ring: "ring-success/20", text: "text-success" },
              warning: { bg: "bg-warning/10", ring: "ring-warning/20", text: "text-warning" },
            };
            const tone = toneMap[s.tone];
            return (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-border hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
                      {s.label}
                    </p>
                    <p className="mt-2 font-display text-[26px] font-black leading-none tracking-tight text-foreground tabular-nums">
                      {s.value}
                    </p>
                    <p className="mt-1.5 text-[10.5px] font-semibold text-muted-foreground/80">
                      {s.sub}
                    </p>
                  </div>
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1", tone.bg, tone.ring)}>
                    <Icon className={cn("h-4 w-4", tone.text)} strokeWidth={2.25} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Continue Watching ── */}
      {continueWatching.length > 0 && statusFilter === "all" && !search && (
        <section className="mb-8">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
                <Play className="h-3 w-3 text-primary" strokeWidth={2.5} />
                Continue assistindo
              </div>
              <h2 className="mt-1 font-display text-[15px] font-bold tracking-tight text-foreground">
                Retomar de onde parou
              </h2>
            </div>
            <span className="text-[10.5px] font-semibold text-muted-foreground/70 tabular-nums">
              {continueWatching.length} {continueWatching.length === 1 ? "curso" : "cursos"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {continueWatching.slice(0, 3).map(c => {
              const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
              return (
                <Link
                  key={c.id}
                  to={`/membros-area/curso/${c.id}`}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card",
                    "transition-all duration-300 ease-out hover:border-border hover:-translate-y-0.5",
                  )}
                >
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-border/80 bg-gradient-to-br from-muted/40 via-muted/20 to-background">
                    {c.thumbnail_url ? (
                      <>
                        <img
                          src={c.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                        />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background/60 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/60 to-transparent" />
                      </>
                    ) : (
                      <div className="relative flex h-full w-full items-center justify-center">
                        <div
                          className="absolute inset-0 opacity-[0.05]"
                          style={{
                            backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
                            backgroundSize: "16px 16px",
                          }}
                        />
                        <span className="relative font-display text-[88px] font-black leading-none tracking-tighter text-foreground/[0.08] tabular-nums select-none">
                          {pct}
                        </span>
                      </div>
                    )}

                    {/* Progress pill - top right */}
                    <div className="absolute right-3 top-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10.5px] font-bold backdrop-blur-md ring-1 ring-warning/25 text-warning">
                        <Flame className="h-3 w-3" strokeWidth={2.5} />
                        <span className="tabular-nums">{pct}%</span>
                      </span>
                    </div>

                    {/* Module count - top left */}
                    <div className="absolute left-3 top-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-md ring-1 ring-border/60">
                        <Layers className="h-2.5 w-2.5" strokeWidth={2.5} />
                        {c.modules.length} {c.modules.length === 1 ? "módulo" : "módulos"}
                      </span>
                    </div>

                    {/* Play button - bottom right */}
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-primary/30">
                        <Play className="h-4 w-4 ml-0.5 fill-current" />
                      </div>
                    </div>

                    {/* Progress bar - bottom edge */}
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-muted/40">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <h3 className="line-clamp-1 font-display text-[15px] font-bold leading-tight tracking-[-0.015em] text-foreground group-hover:text-primary transition-colors">
                      {c.title}
                    </h3>
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground">
                        <BookOpen className="h-3 w-3" strokeWidth={2.25} />
                        <span className="font-mono tabular-nums">{c.completedLessons}/{c.totalLessons}</span>
                        aulas
                      </span>
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10.5px] font-black tabular-nums text-primary ring-1 ring-primary/20">
                        {pct}%
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex items-center gap-0.5 rounded-xl border border-border/80 bg-card p-1">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all duration-150",
                statusFilter === t.value
                  ? "bg-muted text-foreground shadow-[0_1px_0_0_hsl(var(--border)/0.5)_inset]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  "rounded-md px-1.5 py-0.5 text-[9.5px] font-black tabular-nums",
                  statusFilter === t.value
                    ? "bg-primary/15 text-primary ring-1 ring-primary/20"
                    : "bg-muted/60 text-muted-foreground/70",
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={2.25} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar curso…"
            className="h-9 w-full rounded-xl border border-border/80 bg-card pl-9 pr-9 text-[12.5px] placeholder:text-muted-foreground/60 focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/50 hover:bg-muted/60 hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* ── Course Grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-border/60 bg-card/40">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
            <GraduationCap className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="mt-4 font-display text-[14px] font-bold tracking-tight text-foreground">
            {search || statusFilter !== "all" ? "Nenhum resultado" : "Nenhum curso encontrado"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">Tente ajustar os filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const pct = c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0;
            const status = getStatus(c);
            const isFinished = status === "completed";
            const isInProgress = status === "in_progress";

            const statusMeta = isFinished
              ? { label: "Concluído", icon: Trophy, ring: "ring-success/25", text: "text-success", dot: "bg-success" }
              : isInProgress
              ? { label: "Em andamento", icon: Flame, ring: "ring-warning/25", text: "text-warning", dot: "bg-warning" }
              : { label: "Não iniciado", icon: Sparkles, ring: "ring-border/60", text: "text-muted-foreground", dot: "bg-muted-foreground/50" };
            const StatusIcon = statusMeta.icon;

            return (
              <Link
                key={c.id}
                to={`/membros-area/curso/${c.id}`}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card",
                  "shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset]",
                  "transition-all duration-300 ease-out",
                  "hover:border-border hover:shadow-[0_1px_0_0_hsl(var(--border)/0.6)_inset,0_8px_24px_-12px_hsl(var(--background)/0.8)]",
                  "hover:-translate-y-0.5",
                )}
              >
                {/* Hero */}
                <div className="relative aspect-[16/10] overflow-hidden border-b border-border/80 bg-gradient-to-br from-muted/40 via-muted/20 to-background">
                  {c.thumbnail_url ? (
                    <>
                      <img
                        src={c.thumbnail_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                      />
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background/60 to-transparent" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    </>
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center">
                      <div
                        className="absolute inset-0 opacity-[0.05]"
                        style={{
                          backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
                          backgroundSize: "16px 16px",
                        }}
                      />
                      <BookOpen className="absolute h-12 w-12 text-foreground/[0.08]" strokeWidth={1.5} />
                      <span className="relative font-display text-[80px] font-black leading-none tracking-tighter text-foreground/[0.08] tabular-nums select-none">
                        {c.totalLessons || "—"}
                      </span>
                    </div>
                  )}

                  {/* Status pill - top right */}
                  <div className="absolute right-3 top-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10.5px] font-bold backdrop-blur-md ring-1",
                      statusMeta.ring,
                      statusMeta.text,
                    )}>
                      <StatusIcon className="h-3 w-3" strokeWidth={2.5} />
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Category - top left */}
                  <div className="absolute left-3 top-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-md ring-1 ring-border/60">
                      <BookOpen className="h-2.5 w-2.5" strokeWidth={2.5} />
                      {c.category}
                    </span>
                  </div>

                  {/* Mega progress - bottom left */}
                  {pct > 0 && (
                    <div className="absolute bottom-3.5 left-4 flex items-end gap-1.5">
                      <span className="font-display text-[26px] font-black leading-none tracking-tight text-foreground tabular-nums">
                        {pct}
                      </span>
                      <span className="font-display text-[12px] font-bold text-muted-foreground/80 mb-0.5">
                        %
                      </span>
                    </div>
                  )}

                  {/* Play hover overlay */}
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full ring-2",
                      isFinished ? "bg-success text-success-foreground ring-success/30" : "bg-primary text-primary-foreground ring-primary/30",
                    )}>
                      {isFinished ? <Trophy className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
                    </div>
                  </div>

                  {/* Progress bar - bottom edge */}
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-muted/40">
                    <div
                      className={cn("h-full transition-all", isFinished ? "bg-success" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 font-display text-[16px] font-bold leading-tight tracking-[-0.015em] text-foreground group-hover:text-primary transition-colors">
                      {c.title}
                    </h3>
                    <p className={cn(
                      "mt-1 line-clamp-2 text-[12px] leading-snug",
                      c.description ? "text-muted-foreground" : "italic text-muted-foreground/50",
                    )}>
                      {c.description || "Sem descrição"}
                    </p>
                  </div>

                  {/* Meta footer */}
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground">
                        <BookOpen className="h-3 w-3" strokeWidth={2.25} />
                        <span className="font-mono tabular-nums text-foreground">{c.totalLessons}</span>
                        {c.totalLessons === 1 ? "aula" : "aulas"}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground">
                        <Layers className="h-3 w-3" strokeWidth={2.25} />
                        <span className="font-mono tabular-nums text-foreground">{c.modules.length}</span>
                        {c.modules.length === 1 ? "módulo" : "módulos"}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary">
                      Acessar
                      <ArrowUpRight className="h-2.5 w-2.5" strokeWidth={2.75} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="mt-5 flex items-center justify-between px-1 text-[11.5px] text-muted-foreground/70">
          <span>
            Exibindo{" "}
            <span className="font-mono font-semibold text-foreground tabular-nums">{filtered.length}</span>{" "}
            {filtered.length === 1 ? "curso" : "cursos"}
          </span>
        </div>
      )}
    </div>
  );
}
