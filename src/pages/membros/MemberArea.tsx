import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Search, BookOpen, CheckCircle2, X, Play, Trophy, Clock,
  ShoppingBag, ArrowUpRight, ChevronLeft, ChevronRight, Sparkles, Info,
  Plus, Volume2, VolumeX, Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type PurchaseRow = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  totalLessons: number;
  completedLessons: number;
  grantedAt: string;
  amountPaid: number | null;
  paymentMethod: string | null;
  accessStatus: "active" | "revoked";
  transactionId: string | null;
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default function MemberArea() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed" | "not_started">("all");

  useEffect(() => { if (user) loadPurchases(); }, [user]);

  const loadPurchases = async () => {
    if (!user) return;
    const { data: access } = await supabase
      .from("user_access")
      .select("course_id, granted_at, status, transaction_id")
      .eq("user_id", user.id);
    const accessList = access || [];
    const accessCourseIds = accessList.map(a => a.course_id);

    const { data: ownedCourses } = await supabase.from("courses").select("id").eq("user_id", user.id);
    const ownedCourseIds = ownedCourses?.map(c => c.id) || [];
    const allCourseIds = [...new Set([...accessCourseIds, ...ownedCourseIds])];
    if (allCourseIds.length === 0) { setLoading(false); return; }

    const { data: coursesData } = await supabase.from("courses")
      .select("id, title, description, thumbnail_url, category, created_at, modules ( id, lessons ( id ) )")
      .in("id", allCourseIds);
    if (!coursesData) { setLoading(false); return; }

    const txIds = accessList.map(a => a.transaction_id).filter((x): x is string => !!x);
    const txMap = new Map<string, { amount: number; payment_method: string | null }>();
    if (txIds.length) {
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, amount, payment_method")
        .in("id", txIds);
      txs?.forEach(t => txMap.set(t.id, { amount: Number(t.amount), payment_method: t.payment_method }));
    }

    const { data: progress } = await supabase
      .from("user_progress").select("lesson_id, completed").eq("user_id", user.id);
    const completedSet = new Set(progress?.filter(p => p.completed).map(p => p.lesson_id) || []);

    const enriched: PurchaseRow[] = coursesData.map((c: any) => {
      const allLessons = c.modules?.flatMap((m: any) => m.lessons?.map((l: any) => l.id) || []) || [];
      const completed = allLessons.filter((id: string) => completedSet.has(id)).length;
      const accessRow = accessList.find(a => a.course_id === c.id);
      const tx = accessRow?.transaction_id ? txMap.get(accessRow.transaction_id) : null;
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnail_url: c.thumbnail_url,
        category: c.category || "geral",
        totalLessons: allLessons.length,
        completedLessons: completed,
        grantedAt: accessRow?.granted_at || c.created_at,
        amountPaid: tx?.amount ?? null,
        paymentMethod: tx?.payment_method ?? null,
        accessStatus: (accessRow?.status === "revoked" ? "revoked" : "active") as "active" | "revoked",
        transactionId: accessRow?.transaction_id ?? null,
      };
    }).sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());

    setRows(enriched);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r => r.title.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      result = result.filter(r => {
        if (statusFilter === "completed") return r.totalLessons > 0 && r.completedLessons === r.totalLessons;
        if (statusFilter === "in_progress") return r.completedLessons > 0 && r.completedLessons < r.totalLessons;
        if (statusFilter === "not_started") return r.completedLessons === 0;
        return true;
      });
    }
    return result;
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const totalSpent = rows.reduce((a, r) => a + (r.amountPaid || 0), 0);
    const completed = rows.filter(r => r.totalLessons > 0 && r.completedLessons === r.totalLessons).length;
    const inProgress = rows.filter(r => r.completedLessons > 0 && r.completedLessons < r.totalLessons).length;
    return { totalSpent, completed, inProgress, total: rows.length };
  }, [rows]);

  const heroCourse = useMemo(() => {
    return rows.find(r => r.completedLessons > 0 && r.completedLessons < r.totalLessons) || rows[0] || null;
  }, [rows]);

  const continueRows = useMemo(
    () => rows.filter(r => r.completedLessons > 0 && r.completedLessons < r.totalLessons),
    [rows]
  );
  const newRows = useMemo(() => rows.filter(r => r.completedLessons === 0), [rows]);
  const completedRows = useMemo(
    () => rows.filter(r => r.totalLessons > 0 && r.completedLessons === r.totalLessons),
    [rows]
  );
  const trendingRows = useMemo(() => [...rows].slice(0, 10), [rows]);

  if (loading) return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-14 w-14 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-center">
            <Play className="h-6 w-6 text-primary fill-current" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-primary animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Preparando sua biblioteca…</p>
      </div>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-7 pb-24 md:pb-10">
        <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/40 px-6 py-28 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-secondary">
            <ShoppingBag className="h-9 w-9 text-muted-foreground" strokeWidth={1.4} />
          </div>
          <p className="mt-5 text-lg font-black text-foreground">Sua biblioteca está vazia</p>
          <p className="mt-2 max-w-[400px] text-sm leading-relaxed text-muted-foreground">
            Quando você adquirir um produto, ele aparecerá aqui com acesso imediato ao conteúdo.
          </p>
          <Link
            to="/marketplace"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Explorar marketplace
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const isFiltering = search.trim() !== "" || statusFilter !== "all";

  return (
    <div className="w-full pb-24 md:pb-32 bg-background text-foreground">
      {/* ═══ HERO CINEMATOGRÁFICO ═══ */}
      {heroCourse && !isFiltering && <HeroBanner course={heroCourse} />}

      {/* ═══ Toolbar Premium ═══ */}
      <div className="mx-auto max-w-[1800px] px-6 lg:px-16 mt-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <ShoppingBag className="h-8 w-8" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-display text-4xl lg:text-5xl font-black tracking-[-0.05em] text-white leading-none">
                Biblioteca
              </h2>
              <p className="text-[11px] text-zinc-500 mt-2.5 font-black uppercase tracking-[0.2em]">
                {stats.total} {stats.total === 1 ? "título" : "títulos"} · {formatBRL(stats.totalSpent)} investidos
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="O que você quer aprender hoje?"
                className="h-14 w-full rounded-xl bg-zinc-900/50 border border-white/5 pl-12 pr-12 text-sm text-white placeholder:text-zinc-600 focus:border-white/20 focus:outline-none focus:bg-zinc-900 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-zinc-900/40 p-1.5 rounded-xl border border-white/5">
              {[
                { key: "all" as const, label: "Tudo" },
                { key: "in_progress" as const, label: "Retomar" },
                { key: "not_started" as const, label: "Novos" },
                { key: "completed" as const, label: "Concluídos" },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setStatusFilter(t.key)}
                  className={cn(
                    "px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-all rounded-lg",
                    statusFilter === t.key
                      ? "bg-white text-black shadow-lg"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="mx-auto max-w-[1600px] mt-10">
        {isFiltering ? (
          <GridSection courses={filtered} />
        ) : (
          <div className="space-y-14">
            {continueRows.length > 0 && (
              <CarouselRow title="Continue de onde parou" icon={<Play className="h-6 w-6 fill-current" />} courses={continueRows} accent="primary" />
            )}
            {trendingRows.length > 2 && (
              <RankedRow title="Top 10 da sua biblioteca" courses={trendingRows} />
            )}
            {newRows.length > 0 && (
              <CarouselRow title="Comece agora" icon={<Sparkles className="h-6 w-6" />} courses={newRows} accent="info" />
            )}
            {completedRows.length > 0 && (
              <CarouselRow title="Conquistas" icon={<Trophy className="h-6 w-6" />} courses={completedRows} accent="success" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * HERO BANNER — cinematográfico 4K, Ken Burns, vinheta
 * ───────────────────────────────────────────────────────── */
function HeroBanner({ course }: { course: PurchaseRow }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isFinished = pct === 100 && course.totalLessons > 0;
  const [muted, setMuted] = useState(true);

  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative h-[72vh] min-h-[520px] max-h-[820px] w-full">
        {/* Backdrop with Ken Burns slow zoom */}
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover animate-[kenburns_22s_ease-out_infinite_alternate]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/15 to-background" />
        )}

        {/* Cinematic gradient stack */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent" />
        {/* Vignette */}
        <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background))_120%)]" />

        {/* Mute toggle (top-right) */}
        <button
          onClick={() => setMuted(m => !m)}
          className="absolute top-6 right-6 sm:right-12 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/40 backdrop-blur-md text-foreground hover:bg-background/70 transition-all"
          aria-label={muted ? "Ativar som" : "Mutar"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        {/* Content */}
        <div className="relative z-10 flex h-full items-end pb-28 md:pb-36">
          <div className="mx-auto w-full max-w-[1800px] px-6 lg:px-16">
            <div className="max-w-3xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-white">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                {isFinished ? "Concluído" : pct > 0 ? "Continue Assistindo" : "Título em Destaque"}
              </div>

              {/* Title */}
              <h1 className="mt-8 font-display text-[48px] md:text-[72px] lg:text-[100px] font-black tracking-[-0.06em] text-white leading-[0.85] [text-shadow:0_10px_40px_rgba(0,0,0,0.5)]">
                {course.title}
              </h1>

              {/* Meta Row */}
              <div className="mt-8 flex flex-wrap items-center gap-8 text-xs font-black uppercase tracking-[0.15em]">
                <span className="text-emerald-400 flex items-center gap-2">
                  <Star className="h-4 w-4 fill-current" /> 98% Relevante
                </span>
                <span className="text-zinc-500 font-medium capitalize tracking-widest">{course.category}</span>
                <span className="text-zinc-500 font-medium">{course.totalLessons} Aulas</span>
                {course.completedLessons > 0 && (
                  <span className="text-zinc-300">{course.completedLessons} Concluídas</span>
                )}
              </div>

              {/* Description */}
              {course.description && (
                <p className="mt-5 text-base sm:text-lg text-muted-foreground/95 leading-relaxed line-clamp-3 max-w-xl [text-shadow:0_1px_12px_hsl(var(--background)/0.6)]">
                  {course.description}
                </p>
              )}

              {/* Progress */}
              {course.totalLessons > 0 && pct > 0 && (
                <div className="mt-6 max-w-md">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted-foreground font-bold uppercase tracking-wider">Seu progresso</span>
                    <span className={cn("font-black tabular-nums text-sm", isFinished ? "text-success" : "text-foreground")}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-foreground/15 overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-1000", isFinished ? "bg-success" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-12 flex flex-wrap items-center gap-4">
                <Link
                  to={`/membros/curso/${course.id}`}
                  className="inline-flex items-center gap-4 rounded-lg bg-white px-12 py-5 text-lg font-black text-black hover:bg-zinc-200 transition-all hover:scale-[1.03] active:scale-[0.97] shadow-2xl"
                >
                  <Play className="h-7 w-7 fill-current" />
                  {pct > 0 ? "Retomar" : "Assistir agora"}
                </Link>
                <Link
                  to={`/membros/curso/${course.id}`}
                  className="inline-flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl px-10 py-5 text-lg font-black text-white hover:bg-white/10 transition-all hover:scale-[1.03]"
                >
                  <Info className="h-6 w-6" />
                  Detalhes
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
 * CAROUSEL ROW
 * ───────────────────────────────────────────────────────── */
function CarouselRow({
  title, icon, courses, accent,
}: {
  title: string;
  icon: React.ReactNode;
  courses: PurchaseRow[];
  accent: "primary" | "success" | "info";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.85;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const accentClass = {
    primary: "text-primary bg-primary/10 border-primary/25",
    success: "text-success bg-success/10 border-success/25",
    info: "text-info bg-info/10 border-info/25",
  }[accent];

  return (
    <section className="group/row">
      <div className="flex items-center justify-between mb-5 px-5 sm:px-10 lg:px-14">
        <div className="flex items-center gap-3.5">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl border", accentClass)}>
            {icon}
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.03em] text-foreground leading-none">
            {title}
          </h3>
          <span className="text-xs font-black text-muted-foreground tabular-nums bg-muted/40 rounded-full px-2.5 py-1 border border-border/40">
            {courses.length}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button
            onClick={() => scroll("left")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/60 text-foreground hover:bg-card hover:border-border/80 transition-all active:scale-95"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/60 text-foreground hover:bg-card hover:border-border/80 transition-all active:scale-95"
            aria-label="Próximo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-5 sm:px-10 lg:px-14 pb-6 scrollbar-none scroll-smooth snap-x"
      >
        {courses.map(c => (
          <NetflixCard key={c.id} course={c} />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
 * RANKED ROW — Top 10 com números gigantes (Netflix style)
 * ───────────────────────────────────────────────────────── */
function RankedRow({ title, courses }: { title: string; courses: PurchaseRow[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.85;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="group/row">
      <div className="flex items-center justify-between mb-5 px-5 sm:px-10 lg:px-14">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-warning/25 bg-warning/10 text-warning">
            <Star className="h-6 w-6 fill-current" />
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.03em] text-foreground leading-none">
            {title}
          </h3>
        </div>
        <div className="hidden md:flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button onClick={() => scroll("left")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/60 text-foreground hover:bg-card transition-all active:scale-95">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => scroll("right")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/60 text-foreground hover:bg-card transition-all active:scale-95">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-5 sm:px-10 lg:px-14 pb-6 scrollbar-none scroll-smooth snap-x"
      >
        {courses.slice(0, 10).map((c, i) => (
          <Link
            key={c.id}
            to={`/membros/curso/${c.id}`}
            className="group/rank relative shrink-0 flex items-end snap-start"
          >
            {/* Giant rank number */}
            <span
              className="font-display font-black text-foreground/15 leading-[0.8] tracking-[-0.08em] select-none pointer-events-none [-webkit-text-stroke:2px_hsl(var(--foreground)/0.3)]"
              style={{ fontSize: "clamp(140px, 18vw, 240px)" }}
            >
              {i + 1}
            </span>
            {/* Poster */}
            <div className="relative -ml-6 sm:-ml-8 aspect-[2/3] w-[140px] sm:w-[170px] lg:w-[190px] overflow-hidden rounded-xl border border-border bg-muted shadow-2xl transition-all duration-300 group-hover/rank:scale-[1.05] group-hover/rank:border-primary/40">
              {c.thumbnail_url ? (
                <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-card">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent opacity-0 group-hover/rank:opacity-100 transition-opacity duration-300" />
              <div className="absolute inset-x-0 bottom-0 p-3 translate-y-2 opacity-0 group-hover/rank:opacity-100 group-hover/rank:translate-y-0 transition-all duration-300">
                <p className="text-xs font-black text-foreground line-clamp-2">{c.title}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
 * NETFLIX CARD — poster com hover-zoom premium
 * ───────────────────────────────────────────────────────── */
function NetflixCard({ course }: { course: PurchaseRow }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isFinished = pct === 100 && course.totalLessons > 0;

  return (
    <Link
      to={`/membros/curso/${course.id}`}
      className="group/card relative shrink-0 w-[300px] sm:w-[340px] lg:w-[360px] snap-start"
    >
      {/* Poster */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-lg transition-all duration-500 group-hover/card:scale-[1.05] group-hover/card:border-primary/40 group-hover/card:shadow-2xl group-hover/card:z-10">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-110"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-card">
            <BookOpen className="h-14 w-14 text-muted-foreground/30" strokeWidth={1.2} />
          </div>
        )}

        {/* Top-left status badge */}
        <div className="absolute top-3 left-3 z-10">
          {isFinished ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/95 backdrop-blur-sm px-2 py-1 text-[10px] font-black uppercase tracking-wider text-success-foreground">
              <Trophy className="h-3 w-3" /> Concluído
            </span>
          ) : pct > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning/95 backdrop-blur-sm px-2 py-1 text-[10px] font-black uppercase tracking-wider text-warning-foreground">
              <Clock className="h-3 w-3" /> {pct}%
            </span>
          ) : course.accessStatus === "active" ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-info/30 bg-info/95 backdrop-blur-sm px-2 py-1 text-[10px] font-black uppercase tracking-wider text-info-foreground">
              <Sparkles className="h-3 w-3" /> Novo
            </span>
          ) : null}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

        {/* Center play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all duration-300 scale-90 group-hover/card:scale-100">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground/95 backdrop-blur-sm border-2 border-foreground/20 shadow-2xl">
            <Play className="h-7 w-7 fill-current text-background ml-0.5" />
          </div>
        </div>

        {/* Bottom progress bar */}
        {pct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/40">
            <div
              className={cn("h-full", isFinished ? "bg-success" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Card info below */}
      <div className="mt-3.5 px-1">
        <h4 className="font-display text-base font-black tracking-tight text-foreground line-clamp-1 group-hover/card:text-primary transition-colors">
          {course.title}
        </h4>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="capitalize font-bold">{course.category}</span>
          <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/40" />
          <span className="tabular-nums font-medium">{course.totalLessons} aulas</span>
          {course.completedLessons > 0 && !isFinished && (
            <>
              <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/40" />
              <span className="text-primary font-black tabular-nums">{course.completedLessons}/{course.totalLessons}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────
 * GRID SECTION — busca/filtros
 * ───────────────────────────────────────────────────────── */
function GridSection({ courses }: { courses: PurchaseRow[] }) {
  if (courses.length === 0) {
    return (
      <div className="px-5 sm:px-10 lg:px-14">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/40 px-6 py-24 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="mt-4 text-base font-black text-foreground">Nenhum resultado</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Tente ajustar os filtros ou a busca.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-10 lg:px-14">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {courses.map(c => (
          <NetflixCard key={c.id} course={c} />
        ))}
      </div>
    </div>
  );
}
