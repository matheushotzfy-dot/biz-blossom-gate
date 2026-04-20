import { useEffect, useState, useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  GraduationCap, Search, X, CheckCircle2, Play,
  BookOpen, Layers, Trophy, Flame, ArrowUpRight, Sparkles,
  Crown, Zap, Award, ChevronRight, Clock,
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

  // Featured course = curso em andamento com maior progresso, ou primeiro com thumbnail
  const featured = useMemo(() => {
    const inProgress = courses.filter(c => getStatus(c) === "in_progress").sort((a, b) => (b.completedLessons / b.totalLessons) - (a.completedLessons / a.totalLessons));
    return inProgress[0] || courses.find(c => c.thumbnail_url) || courses[0];
  }, [courses]);

  const tabs = [
    { label: "Todos", value: "all" as const, count: courses.length },
    { label: "Em andamento", value: "in_progress" as const, count: inProgressCount },
    { label: "Concluídos", value: "completed" as const, count: completedCount },
    { label: "Não iniciados", value: "not_started" as const, count: notStartedCount },
  ];

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
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="relative h-24 w-24 mb-6">
        <div className="absolute inset-0 rounded-3xl border border-border bg-gradient-to-br from-card via-card to-muted/40 flex items-center justify-center">
          <GraduationCap className="h-11 w-11 text-muted-foreground/40" />
        </div>
        <div className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
        </div>
      </div>
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground mb-2">
        {greeting}, {displayName}
      </h2>
      <p className="text-[13px] text-muted-foreground max-w-sm leading-relaxed">
        Sua jornada começa aqui. Quando você adquirir um produto, seus cursos exclusivos aparecerão neste espaço.
      </p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1340px] px-4 sm:px-6 lg:px-8 pb-28 md:pb-16">

      {/* ═════════════════ HERO CINEMATOGRÁFICO ═════════════════ */}
      {featured && (
        <section className="relative mt-6 overflow-hidden rounded-3xl border border-border/80 bg-card">
          {/* Background image with heavy cinematic overlay */}
          <div className="absolute inset-0">
            {featured.thumbnail_url ? (
              <img
                src={featured.thumbnail_url}
                alt=""
                className="h-full w-full object-cover scale-105 blur-[1px] opacity-40"
              />
            ) : (
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
            )}
            {/* Gradient layers for cinematic depth */}
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/20" />
          </div>

          {/* Content grid */}
          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-8 lg:p-10 min-h-[340px]">
            {/* LEFT — Info & CTA */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-6">
              {/* Top: greeting tag */}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary backdrop-blur-md">
                  <Crown className="h-3 w-3" strokeWidth={2.5} />
                  {greeting}, {displayName}
                </div>
                <h1 className="mt-5 font-display text-[32px] sm:text-[42px] font-black leading-[1.05] tracking-[-0.025em] text-foreground">
                  Continue sua<br />
                  <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                    jornada de excelência
                  </span>
                </h1>
                <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
                  {featured.description || `Retome o curso "${featured.title}" e mantenha o seu ritmo de progresso.`}
                </p>
              </div>

              {/* Bottom: featured course resume */}
              <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-sm p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/80">
                    <Play className="h-3 w-3 text-primary" strokeWidth={2.75} />
                    Continue de onde parou
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                    {featured.category}
                  </span>
                </div>
                <h3 className="font-display text-[18px] font-bold tracking-tight text-foreground line-clamp-1">
                  {featured.title}
                </h3>
                {featured.totalLessons > 0 && (() => {
                  const pct = Math.round((featured.completedLessons / featured.totalLessons) * 100);
                  return (
                    <>
                      <div className="mt-3 flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-muted-foreground">
                          <span className="font-mono tabular-nums text-foreground">{featured.completedLessons}</span>
                          <span className="text-muted-foreground/60">/{featured.totalLessons}</span> aulas
                        </span>
                        <span className="font-mono tabular-nums font-black text-primary">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </>
                  );
                })()}
                <Link
                  to={`/membros-area/curso/${featured.id}`}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Play className="h-3.5 w-3.5 fill-current" strokeWidth={2.5} />
                  {featured.completedLessons > 0 ? "Continuar agora" : "Começar curso"}
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.75} />
                </Link>
              </div>
            </div>

            {/* RIGHT — Stats luxuosas */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3 content-start">
              {/* Big metric card */}
              <div className="col-span-2 rounded-2xl border border-border/80 bg-gradient-to-br from-primary/[0.08] via-card to-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/80">
                      Progresso geral
                    </p>
                    <div className="mt-3 flex items-end gap-1.5">
                      <span className="font-display text-[56px] font-black leading-none tracking-[-0.04em] text-foreground tabular-nums">
                        {overallPct}
                      </span>
                      <span className="font-display text-[20px] font-bold leading-none text-muted-foreground/70 mb-2">
                        %
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                      <span className="font-mono tabular-nums text-foreground">{totalCompleted}</span>
                      <span className="text-muted-foreground/60">/{totalLessons}</span> aulas concluídas
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/25">
                    <Zap className="h-5 w-5 text-primary" strokeWidth={2.25} />
                  </div>
                </div>
                {/* Mini progress bar */}
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 transition-all duration-700"
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
              </div>

              {/* Small stat: in progress */}
              <div className="rounded-2xl border border-border/80 bg-card p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10 ring-1 ring-warning/20">
                  <Flame className="h-4 w-4 text-warning" strokeWidth={2.25} />
                </div>
                <p className="mt-3 font-display text-[24px] font-black leading-none tracking-tight text-foreground tabular-nums">
                  {inProgressCount}
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Em andamento
                </p>
              </div>

              {/* Small stat: completed */}
              <div className="rounded-2xl border border-border/80 bg-card p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 ring-1 ring-success/20">
                  <Trophy className="h-4 w-4 text-success" strokeWidth={2.25} />
                </div>
                <p className="mt-3 font-display text-[24px] font-black leading-none tracking-tight text-foreground tabular-nums">
                  {completedCount}
                </p>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Concluídos
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═════════════════ TOOLBAR ═════════════════ */}
      <div className="mt-8 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h2 className="font-display text-[18px] font-bold tracking-tight text-foreground">
            Sua biblioteca
          </h2>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            <span className="font-mono font-semibold tabular-nums text-foreground">{courses.length}</span>
            {" "}{courses.length === 1 ? "curso disponível" : "cursos disponíveis"}
          </p>
        </div>

        <div className="sm:ml-auto flex flex-col sm:flex-row sm:items-center gap-3">
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
          <div className="relative w-full sm:w-64">
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
      </div>

      {/* ═════════════════ COURSE GRID — LUXO ═════════════════ */}
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
            const isNew = status === "not_started";

            return (
              <Link
                key={c.id}
                to={`/membros-area/curso/${c.id}`}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card",
                  "shadow-[0_1px_0_0_hsl(var(--border)/0.4)_inset]",
                  "transition-all duration-300 ease-out",
                  "hover:border-border hover:shadow-[0_1px_0_0_hsl(var(--border)/0.6)_inset,0_12px_32px_-16px_hsl(var(--background))]",
                  "hover:-translate-y-1",
                )}
              >
                {/* HERO — Cinematic */}
                <div className="relative aspect-[16/10] overflow-hidden border-b border-border/80 bg-gradient-to-br from-muted/40 via-muted/20 to-background">
                  {c.thumbnail_url ? (
                    <>
                      <img
                        src={c.thumbnail_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                      />
                      {/* Cinematic dual gradient */}
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/70 via-background/20 to-transparent" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-background via-background/80 to-transparent" />
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
                        {c.totalLessons || "—"}
                      </span>
                    </div>
                  )}

                  {/* Status pill - top right */}
                  <div className="absolute right-3 top-3">
                    {isFinished ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10.5px] font-bold backdrop-blur-md ring-1 ring-success/30 text-success">
                        <Award className="h-3 w-3" strokeWidth={2.5} />
                        Concluído
                      </span>
                    ) : isInProgress ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10.5px] font-bold backdrop-blur-md ring-1 ring-warning/25 text-warning">
                        <Flame className="h-3 w-3" strokeWidth={2.5} />
                        <span className="tabular-nums">{pct}%</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10.5px] font-bold backdrop-blur-md ring-1 ring-primary/25 text-primary">
                        <Sparkles className="h-3 w-3" strokeWidth={2.5} />
                        Novo
                      </span>
                    )}
                  </div>

                  {/* Category - top left */}
                  <div className="absolute left-3 top-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-md ring-1 ring-border/60">
                      <BookOpen className="h-2.5 w-2.5" strokeWidth={2.5} />
                      {c.category}
                    </span>
                  </div>

                  {/* Title overlay - bottom left (cinematic) */}
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 font-display text-[17px] font-black leading-tight tracking-[-0.02em] text-foreground drop-shadow-[0_2px_8px_hsl(var(--background)/0.5)]">
                        {c.title}
                      </h3>
                    </div>
                    {/* Play CTA - always visible, more prominent on hover */}
                    <div className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-2 transition-all duration-300",
                      "bg-background/85 backdrop-blur-md ring-border/60 text-foreground",
                      "group-hover:bg-primary group-hover:ring-primary/40 group-hover:text-primary-foreground group-hover:scale-110",
                    )}>
                      {isFinished ? (
                        <Trophy className="h-4 w-4" strokeWidth={2.25} />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5 fill-current" strokeWidth={2.25} />
                      )}
                    </div>
                  </div>

                  {/* Progress bar - bottom edge */}
                  {pct > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-muted/40">
                      <div
                        className={cn(
                          "h-full transition-all duration-700",
                          isFinished
                            ? "bg-gradient-to-r from-success to-success/80"
                            : "bg-gradient-to-r from-primary to-primary/70",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* BODY — meta info */}
                <div className="flex flex-col gap-3 p-4">
                  {c.description && (
                    <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                      {c.description}
                    </p>
                  )}

                  {/* Meta footer */}
                  <div className="flex items-center justify-between gap-2">
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
                    <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary">
                      Acessar
                      <ChevronRight className="h-3 w-3" strokeWidth={2.75} />
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
