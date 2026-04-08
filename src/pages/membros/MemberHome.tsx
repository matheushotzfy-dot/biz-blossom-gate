/**
 * MemberHome — Cinematic Netflix-Grade Member Dashboard
 * @module MemberHome
 * @version 8.0.0 — Ultra Premium Redesign
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  Play, Clock, BookOpen, ChevronRight, Zap, Sparkles,
  GraduationCap, Flame, Layers, Trophy, BarChart3,
  CheckCircle2, ArrowUpRight, ChevronLeft, Info, Search, X,
  TrendingUp, Star, Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [heroIdx, setHeroIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
  const categories = [...new Set(courses.map(c => c.category).filter(Boolean))];

  const filteredCourses = useMemo(() => {
    let result = courses;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    }
    if (activeFilter) {
      result = result.filter(c => c.category === activeFilter);
    }
    return result;
  }, [courses, searchQuery, activeFilter]);

  // Auto-rotate hero
  const heroItems = continueWatching.length > 0 ? continueWatching : courses.slice(0, 5);
  useEffect(() => {
    if (heroItems.length <= 1) return;
    const t = setInterval(() => setHeroIdx(i => (i + 1) % heroItems.length), 8000);
    return () => clearInterval(t);
  }, [heroItems.length]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Time-based greeting
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);
  const displayName = user?.email?.split("@")[0] || "Aluno";

  if (loading) return (
    <div className="min-h-[80vh] flex items-center justify-center bg-background">
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
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }}>
        <div className="relative mb-10">
          <div className="absolute inset-0 rounded-full bg-primary/8 blur-[120px] w-64 h-64 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
          <div className="relative h-28 w-28 rounded-[2rem] bg-card border border-border/30 flex items-center justify-center shadow-2xl mx-auto">
            <GraduationCap className="h-14 w-14 text-muted-foreground/10" />
          </div>
        </div>
        <h2 className="text-3xl sm:text-4xl font-display font-black text-foreground tracking-[-0.04em] mb-4">{greeting}, {displayName}!</h2>
        <p className="text-base text-muted-foreground max-w-md leading-relaxed font-display mx-auto">
          Quando você adquirir um produto, seus cursos e conteúdos aparecerão aqui automaticamente.
        </p>
      </motion.div>
    </div>
  );

  const featured = heroItems[heroIdx] || courses[0];
  const featuredPct = featured.totalLessons > 0 ? Math.round((featured.completedLessons / featured.totalLessons) * 100) : 0;

  return (
    <div className="pb-24 bg-background">
      {/* ═══ CINEMATIC HERO — Netflix Billboard ═══ */}
      <div className="relative h-[68vh] min-h-[520px] max-h-[780px] overflow-hidden">
        {/* Background image with crossfade */}
        <AnimatePresence mode="wait">
          <motion.div
            key={featured.id}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease }}
            className="absolute inset-0"
          >
            {featured.thumbnail_url ? (
              <img src={featured.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-background">
                <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Cinematic overlays — multi-layer for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_20%,hsl(var(--background))_100%)]" />
        <div className="absolute inset-0 shadow-[inset_0_-140px_140px_-60px_hsl(var(--background))]" />
        {/* Film grain for cinema feel */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")" }} />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12 xl:p-16 max-w-[1440px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={featured.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease }}
              className="max-w-2xl"
            >
              {/* Badges */}
              <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                {continueWatching.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-display font-black uppercase tracking-[0.1em] bg-primary text-primary-foreground shadow-lg shadow-primary/30 backdrop-blur-sm">
                    <Play className="h-3 w-3 fill-current" /> Continue assistindo
                  </span>
                )}
                {featured.category && (
                  <span className="px-3 py-1.5 rounded-lg text-[10px] font-display font-bold bg-foreground/10 backdrop-blur-2xl text-foreground/70 uppercase tracking-wider ring-1 ring-foreground/5">
                    {featured.category}
                  </span>
                )}
                {featuredPct === 100 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-display font-black bg-success/15 text-success uppercase tracking-wider ring-1 ring-success/20 backdrop-blur-sm">
                    <CheckCircle2 className="h-3 w-3" /> Concluído
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-black text-foreground leading-[1.02] tracking-[-0.04em] mb-3 drop-shadow-[0_4px_30px_hsl(var(--background)/0.6)]">
                {featured.title}
              </h1>

              {featured.description && (
                <p className="text-sm sm:text-base text-foreground/55 line-clamp-2 mb-6 leading-relaxed max-w-xl font-display">{featured.description}</p>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-3.5 mb-6 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-40 sm:w-52">
                    <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden backdrop-blur-sm">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${featuredPct}%` }}
                        transition={{ duration: 1.2, delay: 0.3, ease }}
                        className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                        style={{ boxShadow: featuredPct > 0 ? "0 0 16px hsl(var(--primary) / 0.5)" : "none" }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-foreground/50 font-display font-bold tabular-nums">{featuredPct}%</span>
                </div>
                <span className="text-xs text-foreground/30 font-display tabular-nums">{featured.completedLessons}/{featured.totalLessons} aulas</span>
                <span className="text-xs text-foreground/15">•</span>
                <span className="text-xs text-foreground/30 font-display tabular-nums">{featured.modules.length} módulos</span>
              </div>

              {/* CTA Buttons */}
              <div className="flex items-center gap-3">
                <Link to={`/membros-area/curso/${featured.id}`}
                  className="group inline-flex items-center gap-2.5 h-12 sm:h-14 px-8 sm:px-10 rounded-xl bg-foreground text-background text-sm sm:text-base font-display font-black hover:bg-foreground/90 transition-all active:scale-[0.97] shadow-2xl shadow-foreground/20 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Play className="h-5 w-5 fill-current relative z-10" />
                  <span className="relative z-10">{featuredPct > 0 && featuredPct < 100 ? "Continuar" : "Assistir"}</span>
                </Link>
                <Link to={`/membros-area/curso/${featured.id}`}
                  className="inline-flex items-center gap-2 h-12 sm:h-14 px-6 sm:px-8 rounded-xl bg-foreground/8 backdrop-blur-2xl text-foreground/80 text-sm font-display font-bold border border-foreground/10 hover:bg-foreground/15 hover:text-foreground hover:border-foreground/15 transition-all active:scale-[0.97]">
                  <Info className="h-4 w-4" />
                  <span>Detalhes</span>
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Hero pagination dots */}
          {heroItems.length > 1 && (
            <div className="absolute bottom-6 right-6 sm:right-8 lg:right-12 flex items-center gap-2">
              {heroItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIdx(i)}
                  className={cn(
                    "rounded-full transition-all duration-500",
                    i === heroIdx ? "h-1.5 w-10 bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]" : "h-1.5 w-1.5 bg-foreground/20 hover:bg-foreground/40"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Content Area ═══ */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 -mt-4 relative z-10">

        {/* ─── Greeting + Search Bar ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ease }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-black text-foreground tracking-[-0.03em]">
              {greeting}, <span className="text-primary">{displayName}</span>
            </h2>
            <p className="text-xs text-muted-foreground/40 font-display mt-0.5">
              {continueWatching.length > 0
                ? `Você tem ${continueWatching.length} curso${continueWatching.length > 1 ? "s" : ""} em andamento`
                : `${courses.length} curso${courses.length > 1 ? "s" : ""} disponíve${courses.length > 1 ? "is" : "l"}`}
            </p>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {searchOpen ? (
                <motion.div
                  key="search-input"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 260, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease }}
                  className="relative"
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Buscar cursos..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full h-9 pl-9 pr-8 rounded-xl bg-card/60 border border-border/20 text-sm font-display text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-all"
                  />
                  <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md flex items-center justify-center hover:bg-muted/10 transition-colors">
                    <X className="h-3 w-3 text-muted-foreground/30" />
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="search-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSearchOpen(true)}
                  className="h-9 w-9 rounded-xl bg-card/60 border border-border/15 flex items-center justify-center hover:bg-card/80 hover:border-border/30 transition-all active:scale-95"
                >
                  <Search className="h-4 w-4 text-muted-foreground/40" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ─── Category Filters ─── */}
        {categories.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, ease }}
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
          >
            <button
              onClick={() => setActiveFilter(null)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-xl text-xs font-display font-bold transition-all active:scale-95 border",
                !activeFilter
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-card/40 text-muted-foreground/60 border-border/15 hover:bg-card/60 hover:text-foreground"
              )}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                className={cn(
                  "shrink-0 px-4 py-2 rounded-xl text-xs font-display font-bold transition-all active:scale-95 border",
                  activeFilter === cat
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                    : "bg-card/40 text-muted-foreground/60 border-border/15 hover:bg-card/60 hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </motion.div>
        )}

        {/* ─── KPI Stats ─── */}
        {totalLessons > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ease }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3"
          >
            {[
              { icon: BookOpen, label: "Cursos", value: String(courses.length), color: "primary", glow: "hsl(var(--primary) / 0.15)" },
              { icon: TrendingUp, label: "Progresso", value: `${overallPct}%`, color: "info", glow: "hsl(var(--info) / 0.15)" },
              { icon: Flame, label: "Aulas Feitas", value: String(totalCompleted), color: "warning", glow: "hsl(var(--warning) / 0.15)" },
              { icon: Trophy, label: "Completos", value: String(completedCourses), color: "success", glow: "hsl(var(--success) / 0.15)" },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05, ease }}
                className={cn(
                  "rounded-2xl bg-card/80 backdrop-blur-2xl border border-border/15 p-4 sm:p-5 relative overflow-hidden group cursor-default",
                  "hover:border-border/30 transition-all duration-500 hover:shadow-xl"
                )}
                style={{ boxShadow: `0 2px 20px ${kpi.glow}` }}
              >
                <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full", `bg-${kpi.color}`)} />
                <div className={cn("absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[60px] opacity-20 transition-opacity group-hover:opacity-40", `bg-${kpi.color}`)} />
                <div className="flex items-center gap-3.5 relative z-10">
                  <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 ring-1", `bg-${kpi.color}/10 ring-${kpi.color}/10`)}>
                    <kpi.icon className={cn("h-5 w-5", `text-${kpi.color}`)} />
                  </div>
                  <div>
                    <span className={cn("text-2xl font-display font-black tabular-nums block leading-none tracking-tight", `text-${kpi.color}`)}>{kpi.value}</span>
                    <span className="text-[10px] text-muted-foreground/45 font-display font-bold uppercase tracking-wider mt-1 block">{kpi.label}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ─── Search results mode ─── */}
        {(searchQuery || activeFilter) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-display font-black text-foreground">
                {filteredCourses.length} resultado{filteredCourses.length !== 1 ? "s" : ""}
                {searchQuery && <span className="text-muted-foreground/40 font-bold"> para "{searchQuery}"</span>}
              </h2>
              {(searchQuery || activeFilter) && (
                <button
                  onClick={() => { setSearchQuery(""); setActiveFilter(null); setSearchOpen(false); }}
                  className="text-xs text-primary font-display font-bold hover:underline underline-offset-4"
                >
                  Limpar filtros
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredCourses.map((course, i) => (
                <motion.div key={course.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03, ease }}>
                  <GridCard course={course} />
                </motion.div>
              ))}
            </div>
            {filteredCourses.length === 0 && (
              <div className="py-16 text-center">
                <Search className="h-10 w-10 text-muted-foreground/10 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground/40 font-display font-bold">Nenhum curso encontrado</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Normal content rows ─── */}
        {!searchQuery && !activeFilter && (
          <>
            {/* Continue Watching Row */}
            {continueWatching.length > 0 && (
              <ContentRow title="Continue Assistindo" icon={<Play className="h-4 w-4 fill-current" />} accent="primary">
                {continueWatching.map((c, i) => (
                  <motion.div key={c.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, ease }}>
                    <WideCard course={c} />
                  </motion.div>
                ))}
              </ContentRow>
            )}

            {/* All Courses Row */}
            <ContentRow title="Meus Cursos" icon={<Layers className="h-4 w-4" />}>
              {courses.map((course, i) => (
                <motion.div key={course.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05, ease }}>
                  <PortraitCard course={course} />
                </motion.div>
              ))}
            </ContentRow>

            {/* Category Rows */}
            {categories.filter(cat => courses.filter(c => c.category === cat).length > 1).map(cat => (
              <ContentRow key={cat} title={cat} icon={<Sparkles className="h-4 w-4" />}>
                {courses.filter(c => c.category === cat).map((course, i) => (
                  <motion.div key={course.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05, ease }}>
                    <PortraitCard course={course} />
                  </motion.div>
                ))}
              </ContentRow>
            ))}

            {/* Module Rows per Course */}
            {courses.filter(c => c.modules.length > 1).map(course => (
              <ContentRow key={course.id} title={course.title} subtitle={`${course.modules.length} módulos`} icon={<BookOpen className="h-4 w-4" />}>
                {course.modules.map((mod, mi) => (
                  <motion.div key={mod.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: mi * 0.04, ease }}>
                    <ModuleCard courseId={course.id} mod={mod} />
                  </motion.div>
                ))}
              </ContentRow>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* CONTENT ROW — Netflix-style horizontal scroll                     */
/* ═══════════════════════════════════════════════════════════════════ */
function ContentRow({ title, subtitle, icon, accent, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode; accent?: string;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => { checkScroll(); }, [children]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  };

  return (
    <section className="group/row">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", accent ? `bg-${accent}/10 text-${accent}` : "bg-card text-foreground/50")}>
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-display font-black text-foreground tracking-[-0.02em]">{title}</h2>
            {subtitle && <p className="text-[10px] text-muted-foreground/40 font-display mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300">
          <button onClick={() => scroll(-1)} disabled={!canScrollLeft}
            className="h-8 w-8 rounded-lg bg-card/60 border border-border/20 flex items-center justify-center disabled:opacity-20 hover:bg-card transition-all active:scale-95">
            <ChevronLeft className="h-4 w-4 text-foreground/60" />
          </button>
          <button onClick={() => scroll(1)} disabled={!canScrollRight}
            className="h-8 w-8 rounded-lg bg-card/60 border border-border/20 flex items-center justify-center disabled:opacity-20 hover:bg-card transition-all active:scale-95">
            <ChevronRight className="h-4 w-4 text-foreground/60" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory scroll-smooth"
      >
        {children}
      </div>
    </section>
  );
}

/* ═══ Wide Card — Continue Watching ═══ */
function WideCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  return (
    <Link to={`/membros-area/curso/${course.id}`} className="group shrink-0 w-[340px] sm:w-[420px] snap-start block">
      <div className="relative rounded-2xl overflow-hidden bg-card ring-1 ring-border/10 group-hover:ring-primary/25 transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-primary/10 group-hover:scale-[1.02]">
        <div className="aspect-[2/1] relative overflow-hidden">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/15 via-background to-background flex items-center justify-center">
              <GraduationCap className="h-14 w-14 text-primary/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-card/40 to-transparent" />
          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="h-14 w-14 rounded-full bg-foreground/90 flex items-center justify-center shadow-2xl shadow-foreground/30 scale-90 group-hover:scale-100 transition-transform duration-500 ring-2 ring-foreground/20">
              <Play className="h-6 w-6 text-background ml-0.5 fill-current" />
            </div>
          </div>
          {/* Info overlay on hover */}
          <div className="absolute bottom-0 left-0 right-0 p-3.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-10">
            <div className="flex items-center gap-2 text-[10px] text-foreground/50 font-display">
              <span className="flex items-center gap-1"><Layers className="h-2.5 w-2.5" /> {course.modules.length} módulos</span>
              <span>•</span>
              <span className="flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" /> {course.totalLessons} aulas</span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-foreground/5">
          <div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-r-full relative transition-all" style={{ width: `${pct}%` }}>
            {pct > 5 && <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.6)] ring-1 ring-primary/30" />}
          </div>
        </div>
      </div>
      <div className="mt-3 px-0.5">
        <h3 className="text-sm font-display font-bold text-foreground truncate group-hover:text-primary transition-colors">{course.title}</h3>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground/40 font-display tabular-nums">
          <span>{pct}% concluído</span>
          <span className="text-border/30">•</span>
          <span>{course.completedLessons}/{course.totalLessons} aulas</span>
        </div>
      </div>
    </Link>
  );
}

/* ═══ Portrait Card — Netflix Poster Style ═══ */
function PortraitCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isFinished = pct === 100 && course.totalLessons > 0;

  return (
    <Link to={`/membros-area/curso/${course.id}`} className="group shrink-0 w-[180px] sm:w-[220px] snap-start block">
      <div className="relative rounded-xl overflow-hidden bg-card ring-1 ring-border/10 group-hover:ring-primary/20 transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-primary/10 group-hover:scale-[1.04] group-hover:z-10">
        <div className="aspect-[2/3] relative overflow-hidden">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-primary/10 via-card to-card flex items-center justify-center relative">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
              <GraduationCap className="h-12 w-12 text-primary/10" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-80" />
          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="text-xs font-display font-black text-foreground line-clamp-2 leading-snug tracking-tight mb-2">{course.title}</h3>
            {/* Progress bar */}
            <div className="h-[2px] rounded-full bg-foreground/8 overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", isFinished ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[9px] text-foreground/30 font-display tabular-nums">{course.totalLessons} aulas</span>
              {isFinished ? (
                <span className="text-[9px] text-success font-display font-bold flex items-center gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" /> 100%</span>
              ) : pct > 0 ? (
                <span className="text-[9px] text-primary font-display font-bold tabular-nums">{pct}%</span>
              ) : null}
            </div>
          </div>
          {/* Hover overlay with extra info */}
          <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 p-4">
            <div className="h-12 w-12 rounded-full bg-foreground/90 flex items-center justify-center shadow-xl">
              <Play className="h-5 w-5 text-background ml-0.5 fill-current" />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-foreground/60 font-display font-bold">{course.modules.length} módulos</p>
              <p className="text-[10px] text-foreground/40 font-display tabular-nums">{course.totalLessons} aulas</p>
            </div>
          </div>
          {/* Badges */}
          {isFinished && (
            <div className="absolute top-2 right-2">
              <div className="h-6 w-6 rounded-md bg-success/20 backdrop-blur-xl flex items-center justify-center ring-1 ring-success/30">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ═══ Grid Card — Search Results ═══ */
function GridCard({ course }: { course: CourseWithProgress }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isFinished = pct === 100 && course.totalLessons > 0;

  return (
    <Link to={`/membros-area/curso/${course.id}`} className="group block">
      <div className="relative rounded-xl overflow-hidden bg-card ring-1 ring-border/10 group-hover:ring-primary/20 transition-all duration-500 group-hover:shadow-xl group-hover:scale-[1.03]">
        <div className="aspect-[2/3] relative overflow-hidden">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-primary/10 via-card to-card flex items-center justify-center">
              <GraduationCap className="h-10 w-10 text-primary/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-80" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="text-xs font-display font-black text-foreground line-clamp-2 leading-snug mb-1.5">{course.title}</h3>
            <div className="h-[2px] rounded-full bg-foreground/8 overflow-hidden">
              <div className={cn("h-full rounded-full", isFinished ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] text-foreground/30 font-display tabular-nums">{course.totalLessons} aulas</span>
              {pct > 0 && <span className={cn("text-[9px] font-display font-bold tabular-nums", isFinished ? "text-success" : "text-primary")}>{pct}%</span>}
            </div>
          </div>
          {/* Hover play */}
          <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-foreground/90 flex items-center justify-center shadow-xl">
              <Play className="h-4 w-4 text-background ml-0.5 fill-current" />
            </div>
          </div>
          {isFinished && (
            <div className="absolute top-2 right-2 h-5 w-5 rounded-md bg-success/20 backdrop-blur-xl flex items-center justify-center ring-1 ring-success/30">
              <CheckCircle2 className="h-3 w-3 text-success" />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ═══ Module Card ═══ */
function ModuleCard({ courseId, mod }: { courseId: string; mod: ModuleInfo }) {
  return (
    <Link to={`/membros-area/curso/${courseId}?module=${mod.id}`} className="group shrink-0 w-[240px] sm:w-[280px] snap-start block">
      <div className="relative rounded-xl overflow-hidden bg-card ring-1 ring-border/10 group-hover:ring-primary/20 transition-all duration-500 group-hover:shadow-xl group-hover:scale-[1.02]">
        <div className="aspect-video relative overflow-hidden">
          {mod.banner_url ? (
            <img src={mod.banner_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-card">
              <BookOpen className="h-8 w-8 text-primary/8" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="h-10 w-10 rounded-full bg-foreground/85 flex items-center justify-center shadow-xl">
              <Play className="h-4 w-4 text-background ml-0.5 fill-current" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-display font-bold text-foreground/80 truncate group-hover:text-foreground transition-colors">{mod.title}</p>
        <p className="text-[10px] text-muted-foreground/40 font-display tabular-nums mt-0.5">{mod.lessonCount} aula{mod.lessonCount !== 1 ? "s" : ""}</p>
      </div>
    </Link>
  );
}
