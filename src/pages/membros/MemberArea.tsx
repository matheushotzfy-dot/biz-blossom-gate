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
import { Seo } from "@/components/Seo";

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

    type LessonLite = { id: string };
    type ModuleLite = { lessons: LessonLite[] | null };
    type CourseLite = { id: string; title: string; description: string | null; thumbnail_url: string | null; category: string | null; created_at: string; modules: ModuleLite[] | null };
    const enriched: PurchaseRow[] = (coursesData as CourseLite[]).map((c) => {
      const allLessons: string[] = c.modules?.flatMap((m) => m.lessons?.map((l) => l.id) || []) || [];
      const completed = allLessons.filter((id) => completedSet.has(id)).length;
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
          <p className="mt-5 text-lg font-bold text-foreground">Sua biblioteca está vazia</p>
          <p className="mt-2 max-w-[400px] text-sm leading-relaxed text-muted-foreground">
            Quando você adquirir um produto, ele aparecerá aqui com acesso imediato ao conteúdo.
          </p>
          <Link
            to="/marketplace"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
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
      <Seo title="Meus Cursos | Vemprapay" description="Acesse todos os cursos e produtos digitais que você adquiriu." path="/membros" noindex />
      {/* ═══ HERO CINEMATOGRÁFICO ═══ */}
      {heroCourse && !isFiltering && <HeroBanner course={heroCourse} />}

      {/* ═══ Toolbar Premium ═══ */}
      <div className="mx-auto max-w-[1800px] px-6 lg:px-16 mt-16">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between border-b border-border/40 pb-12">
          <div className="flex items-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-foreground text-background shadow-[0_0_40px_rgba(var(--foreground),0.15)] transition-transform hover:scale-110">
              <ShoppingBag className="h-9 w-9" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-display text-[42px] lg:text-[56px] font-bold tracking-[-0.05em] text-foreground leading-none">
                Biblioteca
              </h2>
              <p className="text-[11px] text-muted-foreground mt-3 font-bold uppercase tracking-[0.25em] flex items-center gap-3">
                <span className="text-primary">{stats.total} {stats.total === 1 ? "título" : "títulos"}</span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span>{formatBRL(stats.totalSpent)} investidos</span>
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative w-full sm:w-[360px] group">
              <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within:text-primary" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="O que você quer aprender hoje?"
                className="h-14 w-full rounded-2xl bg-secondary/30 border border-border/40 pl-14 pr-12 text-[13px] font-medium text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:bg-secondary/50 transition-all shadow-inner"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-secondary/20 p-1.5 rounded-2xl border border-border/30 backdrop-blur-md">
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
                    "px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-all rounded-xl",
                    statusFilter === t.key
                      ? "bg-foreground text-background shadow-xl"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
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
      <div className="relative h-[80vh] min-h-[600px] max-h-[900px] w-full">
        {/* Backdrop with motion */}
        <div className="absolute inset-0 z-0">
          {course.thumbnail_url ? (
            <motion.img
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
              src={course.thumbnail_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
          )}
        </div>

        {/* Cinematic gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-[1]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(var(--primary),0.05),transparent_50%)] z-[1]" />

        {/* Mute toggle */}
        <button
          onClick={() => setMuted(m => !m)}
          className="absolute top-8 right-8 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/20 backdrop-blur-xl text-white hover:bg-black/40 transition-all active:scale-90"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>

        {/* Content */}
        <div className="relative z-10 flex h-full items-end pb-32">
          <div className="mx-auto w-full max-w-[1800px] px-6 lg:px-16">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="max-w-4xl"
            >
              {/* Badge */}
              <div className="flex items-center gap-3 mb-8">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.8)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary-foreground">
                    {isFinished ? "Curso Concluído" : pct > 0 ? "Continue Assistindo" : "Título em Destaque"}
                  </span>
                </div>
                {course.category && (
                  <span className="text-[10px] text-muted-foreground uppercase tracking-[0.25em] font-bold">
                    {course.category}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="font-display text-[58px] md:text-[96px] lg:text-[120px] font-bold tracking-[-0.07em] leading-[0.8] mb-8 text-foreground drop-shadow-2xl">
                {course.title}
              </h1>

              {/* Description */}
              {course.description && (
                <p className="max-w-xl text-muted-foreground text-lg md:text-xl leading-relaxed mb-10 line-clamp-3 font-medium">
                  {course.description}
                </p>
              )}

              {/* Progress */}
              {course.totalLessons > 0 && pct > 0 && (
                <div className="mt-8 mb-10 max-w-md">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Seu progresso</span>
                    <span className="text-sm font-bold tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden backdrop-blur-sm">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1.5, ease: "circOut" }}
                      className={cn("h-full", isFinished ? "bg-success" : "bg-primary")}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-5">
                <Link
                  to={`/membros/curso/${course.id}`}
                  className="group relative flex items-center gap-4 px-12 py-5 bg-foreground text-background font-display font-bold text-[17px] rounded-xl transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] hover:bg-foreground/90 overflow-hidden shadow-xl"
                >
                  <Play className="h-6 w-6 fill-current" />
                  <span>{pct > 0 ? "Retomar" : "Assistir agora"}</span>
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-background/10 to-transparent" />
                </Link>

                <Link
                  to={`/membros/curso/${course.id}`}
                  className="flex items-center gap-3 px-10 py-5 bg-secondary/40 text-foreground font-display font-bold text-[16px] rounded-xl hover:bg-secondary/60 transition-all duration-300 active:scale-[0.98] backdrop-blur-xl border border-white/5"
                >
                  <Info className="h-5 w-5" />
                  Mais informações
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom shadow blend */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent z-[1]" />
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
      <div className="flex items-center justify-between mb-8 px-6 sm:px-10 lg:px-16">
        <div className="flex items-center gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-[1rem] border shadow-lg transition-transform group-hover/row:scale-110 duration-500", accentClass)}>
            {icon}
          </div>
          <div>
            <h3 className="font-display text-2xl sm:text-[32px] font-bold tracking-[-0.05em] text-foreground leading-none">
              {title}
            </h3>
            <p className="mt-2 text-[10px] font-bold text-primary uppercase tracking-[0.2em] opacity-80">
              {courses.length} {courses.length === 1 ? "conteúdo exclusivo" : "conteúdos exclusivos"}
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2.5 opacity-0 group-hover/row:opacity-100 transition-all duration-500 translate-x-4 group-hover/row:translate-x-0">
          <button
            onClick={() => scroll("left")}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/40 bg-secondary/30 text-foreground hover:bg-foreground hover:text-background transition-all active:scale-90"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/40 bg-secondary/30 text-foreground hover:bg-foreground hover:text-background transition-all active:scale-90"
            aria-label="Próximo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto px-6 sm:px-10 lg:px-16 pb-12 scrollbar-none scroll-smooth snap-x"
      >
        {courses.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="snap-start"
          >
            <NetflixCard course={c} />
          </motion.div>
        ))}
        {/* Spacer for padding at the end */}
        <div className="shrink-0 w-16 h-1" />
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
      <div className="flex items-center justify-between mb-8 px-6 sm:px-10 lg:px-16">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-warning/25 bg-warning/10 text-warning shadow-lg transition-transform group-hover/row:scale-110 duration-500">
            <Star className="h-6 w-6 fill-current" />
          </div>
          <div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.04em] text-foreground leading-none">
              {title}
            </h3>
            <p className="mt-1.5 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em]">
              Os títulos mais assistidos da sua coleção
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2.5 opacity-0 group-hover/row:opacity-100 transition-all duration-500 translate-x-4 group-hover/row:translate-x-0">
          <button onClick={() => scroll("left")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/40 bg-secondary/30 text-foreground hover:bg-foreground hover:text-background transition-all active:scale-90">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => scroll("right")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/40 bg-secondary/30 text-foreground hover:bg-foreground hover:text-background transition-all active:scale-90">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-6 sm:px-10 lg:px-16 pb-12 scrollbar-none scroll-smooth snap-x"
      >
        {courses.slice(0, 10).map((c, i) => (
          <Link
            key={c.id}
            to={`/membros/curso/${c.id}`}
            className="group/rank relative shrink-0 flex items-end snap-start pb-4"
          >
            {/* Giant rank number with premium style */}
            <span
              className="font-display font-bold text-transparent leading-[0.8] tracking-[-0.1em] select-none pointer-events-none drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-700 group-hover/rank:scale-110 group-hover/rank:translate-y-[-10px]"
              style={{ 
                fontSize: "clamp(160px, 20vw, 280px)",
                WebkitTextStroke: "2px hsl(var(--foreground) / 0.1)",
                backgroundImage: "linear-gradient(to bottom, hsl(var(--foreground)/0.15), transparent)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text"
              }}
            >
              {i + 1}
            </span>
            {/* Poster */}
            <div className="relative -ml-10 sm:-ml-14 aspect-[2/3] w-[150px] sm:w-[190px] lg:w-[220px] overflow-hidden rounded-2xl border border-border/40 bg-muted shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-700 ease-[0.16,1,0.3,1] group-hover/rank:scale-[1.08] group-hover/rank:border-primary/40 group-hover/rank:translate-y-[-15px] group-hover/rank:shadow-[0_40px_80px_-20px_rgba(var(--primary),0.3)]">
              {c.thumbnail_url ? (
                <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover transition-transform duration-1000 group-hover/rank:scale-110" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-secondary/10 to-background">
                  <BookOpen className="h-10 w-10 text-muted-foreground/20" strokeWidth={1} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-60 group-hover/rank:opacity-100 transition-opacity duration-500" />
              
              <div className="absolute inset-x-0 bottom-0 p-5 translate-y-4 opacity-0 group-hover/rank:opacity-100 group-hover/rank:translate-y-0 transition-all duration-700 ease-[0.16,1,0.3,1]">
                <p className="text-sm font-bold text-foreground line-clamp-2 drop-shadow-lg leading-tight">{c.title}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.round((c.completedLessons / (c.totalLessons || 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
        <div className="shrink-0 w-20 h-1" />
      </div>
    </section>
  );
}

function NetflixCard({ course }: { course: PurchaseRow }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isFinished = pct === 100 && course.totalLessons > 0;

  return (
    <Link
      to={`/membros/curso/${course.id}`}
      className="group/card relative block w-[320px] sm:w-[380px] lg:w-[420px]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border/40 bg-secondary/10 shadow-lg transition-all duration-700 ease-[0.16,1,0.3,1] group-hover/card:scale-[1.05] group-hover/card:border-primary/40 group-hover/card:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] group-hover/card:z-20">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="h-full w-full object-cover transition-all duration-1000 group-hover/card:scale-110 group-hover/card:brightness-110"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/5 via-secondary/10 to-background">
            <BookOpen className="h-16 w-16 text-muted-foreground/10" strokeWidth={0.8} />
          </div>
        )}

        {/* Floating status badge */}
        <div className="absolute top-4 left-4 z-10 transition-transform duration-500 group-hover/card:scale-110">
          {isFinished ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-success px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-success-foreground shadow-lg">
              <Trophy className="h-3.5 w-3.5" /> Concluído
            </div>
          ) : pct > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-warning px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-warning-foreground shadow-lg">
              <Clock className="h-3.5 w-3.5" /> {pct}%
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-lg bg-primary/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground shadow-lg">
              <Sparkles className="h-3.5 w-3.5" /> Novo
            </div>
          )}
        </div>

        {/* Hover overlay with gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80 group-hover/card:opacity-100 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700" />

        {/* Cinematic play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all duration-700 scale-75 group-hover/card:scale-100">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground text-background shadow-[0_0_50px_rgba(var(--foreground),0.3)] transition-transform hover:scale-110">
            <Play className="h-9 w-9 fill-current ml-1" />
          </div>
        </div>

        {/* Bottom progress bar — sleek */}
        {pct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 backdrop-blur-sm overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${pct}%` }}
              transition={{ duration: 1.2, ease: "circOut" }}
              className={cn("h-full", isFinished ? "bg-success shadow-[0_0_10px_rgba(var(--success),0.5)]" : "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]")}
            />
          </div>
        )}
      </div>

      {/* Info below card */}
      <div className="mt-6 px-1 transition-all duration-500 group-hover/card:translate-x-2">
        <h4 className="font-display text-lg lg:text-xl font-bold tracking-[-0.03em] text-foreground line-clamp-1 group-hover/card:text-primary transition-colors">
          {course.title}
        </h4>
        <div className="mt-2.5 flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80 bg-primary/5 px-2 py-0.5 rounded border border-primary/10 transition-colors group-hover/card:bg-primary group-hover/card:text-primary-foreground">
            {course.category}
          </span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground/60">{course.totalLessons} aulas exclusivas</span>
        </div>
        {course.description && (
          <p className="mt-3 text-xs text-muted-foreground/50 line-clamp-2 leading-relaxed font-medium transition-opacity group-hover/card:opacity-100 opacity-60">
            {course.description}
          </p>
        )}
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
          <p className="mt-4 text-base font-bold text-foreground">Nenhum resultado</p>
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
