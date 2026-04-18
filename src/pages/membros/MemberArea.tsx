import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Search, BookOpen, CheckCircle2, X, Play, Trophy, Clock,
  ShoppingBag, ArrowUpRight, ChevronLeft, ChevronRight, Sparkles, Info,
} from "lucide-react";
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

  // Hero: most recent in-progress, fallback to most recent
  const heroCourse = useMemo(() => {
    return rows.find(r => r.completedLessons > 0 && r.completedLessons < r.totalLessons) || rows[0] || null;
  }, [rows]);

  const continueRows = useMemo(
    () => rows.filter(r => r.completedLessons > 0 && r.completedLessons < r.totalLessons),
    [rows]
  );
  const newRows = useMemo(
    () => rows.filter(r => r.completedLessons === 0),
    [rows]
  );
  const completedRows = useMemo(
    () => rows.filter(r => r.totalLessons > 0 && r.completedLessons === r.totalLessons),
    [rows]
  );

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Carregando sua biblioteca…</p>
      </div>
    </div>
  );

  // Empty state
  if (rows.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-7 pb-24 md:pb-10">
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary">
            <ShoppingBag className="h-7 w-7 text-muted-foreground" strokeWidth={1.4} />
          </div>
          <p className="mt-4 text-base font-bold text-foreground">Sua biblioteca está vazia</p>
          <p className="mt-1.5 max-w-[360px] text-sm leading-relaxed text-muted-foreground">
            Quando você adquirir um produto, ele aparecerá aqui com acesso imediato ao conteúdo.
          </p>
          <Link
            to="/marketplace"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Explorar marketplace
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Search/filter mode → grid view
  const isFiltering = search.trim() !== "" || statusFilter !== "all";

  return (
    <div className="w-full pb-24 md:pb-16">
      {/* ═══ HERO ═══ */}
      {heroCourse && !isFiltering && (
        <HeroBanner course={heroCourse} />
      )}

      {/* ═══ Toolbar ═══ */}
      <div className="mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-12 mt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
              <ShoppingBag className="h-5 w-5 text-primary" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-black tracking-tight text-foreground">Minha Biblioteca</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.total} {stats.total === 1 ? "curso" : "cursos"} · {formatBRL(stats.totalSpent)} investidos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar na biblioteca…"
                className="h-11 w-full rounded-xl border border-border bg-card/60 pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none focus:bg-card transition-colors sm:w-72"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { key: "all" as const, label: "Tudo", count: stats.total },
            { key: "in_progress" as const, label: "Em andamento", count: stats.inProgress },
            { key: "not_started" as const, label: "Novos", count: newRows.length },
            { key: "completed" as const, label: "Concluídos", count: stats.completed },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn(
                "shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all",
                statusFilter === t.key
                  ? "border-primary/40 bg-primary text-primary-foreground"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              {t.label}
              <span className={cn(
                "tabular-nums text-[10px] rounded-full px-1.5 py-0.5",
                statusFilter === t.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted/50 text-muted-foreground"
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="mx-auto max-w-[1480px] mt-8">
        {isFiltering ? (
          <GridSection courses={filtered} />
        ) : (
          <div className="space-y-12">
            {continueRows.length > 0 && (
              <CarouselRow title="Continue de onde parou" icon={<Play className="h-5 w-5 fill-current" />} courses={continueRows} accent="primary" />
            )}
            {newRows.length > 0 && (
              <CarouselRow title="Comece agora" icon={<Sparkles className="h-5 w-5" />} courses={newRows} accent="info" />
            )}
            {completedRows.length > 0 && (
              <CarouselRow title="Conquistas" icon={<Trophy className="h-5 w-5" />} courses={completedRows} accent="success" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * HERO BANNER — cinematic, Netflix-style
 * ───────────────────────────────────────────────────────── */
function HeroBanner({ course }: { course: PurchaseRow }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isFinished = pct === 100 && course.totalLessons > 0;

  return (
    <section className="relative w-full overflow-hidden">
      {/* Backdrop image */}
      <div className="relative h-[58vh] min-h-[420px] max-h-[640px] w-full">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-background" />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex h-full items-end pb-16 sm:pb-20">
          <div className="mx-auto w-full max-w-[1480px] px-5 sm:px-8 lg:px-12">
            <div className="max-w-2xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {isFinished ? "Concluído" : pct > 0 ? "Continue assistindo" : "Próximo destaque"}
              </div>

              {/* Title */}
              <h1 className="mt-4 font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.035em] text-foreground leading-[1.02]">
                {course.title}
              </h1>

              {/* Meta */}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold text-foreground capitalize">{course.category}</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span className="text-muted-foreground">{course.totalLessons} aulas</span>
                {course.completedLessons > 0 && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span className="text-primary font-bold">{course.completedLessons} concluídas</span>
                  </>
                )}
              </div>

              {/* Description */}
              {course.description && (
                <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed line-clamp-3 max-w-xl">
                  {course.description}
                </p>
              )}

              {/* Progress bar */}
              {course.totalLessons > 0 && pct > 0 && (
                <div className="mt-5 max-w-md">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted-foreground font-semibold">Seu progresso</span>
                    <span className={cn("font-black tabular-nums", isFinished ? "text-success" : "text-foreground")}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-700", isFinished ? "bg-success" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={`/membros/curso/${course.id}`}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-foreground px-7 py-3 text-sm font-black text-background hover:bg-foreground/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play className="h-5 w-5 fill-current" />
                  {pct > 0 ? "Continuar" : "Assistir agora"}
                </Link>
                <Link
                  to={`/membros/curso/${course.id}`}
                  className="inline-flex items-center gap-2.5 rounded-xl border border-border bg-card/60 backdrop-blur-md px-6 py-3 text-sm font-bold text-foreground hover:bg-card transition-all"
                >
                  <Info className="h-4.5 w-4.5" />
                  Mais informações
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
 * CAROUSEL ROW — horizontal scroll with arrows
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
    primary: "text-primary bg-primary/10 border-primary/20",
    success: "text-success bg-success/10 border-success/20",
    info: "text-info bg-info/10 border-info/20",
  }[accent];

  return (
    <section className="group/row">
      <div className="flex items-center justify-between mb-4 px-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", accentClass)}>
            {icon}
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-black tracking-tight text-foreground">
            {title}
          </h3>
          <span className="text-xs font-bold text-muted-foreground tabular-nums bg-muted/30 rounded-full px-2 py-0.5">
            {courses.length}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button
            onClick={() => scroll("left")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/60 text-foreground hover:bg-card hover:border-border/80 transition-all active:scale-95"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/60 text-foreground hover:bg-card hover:border-border/80 transition-all active:scale-95"
            aria-label="Próximo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-5 sm:px-8 lg:px-12 pb-4 scrollbar-none scroll-smooth snap-x"
      >
        {courses.map(c => (
          <NetflixCard key={c.id} course={c} />
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
 * NETFLIX CARD — large, hover-zoom, info overlay
 * ───────────────────────────────────────────────────────── */
function NetflixCard({ course }: { course: PurchaseRow }) {
  const pct = course.totalLessons > 0 ? Math.round((course.completedLessons / course.totalLessons) * 100) : 0;
  const isFinished = pct === 100 && course.totalLessons > 0;

  return (
    <Link
      to={`/membros/curso/${course.id}`}
      className="group/card relative shrink-0 w-[280px] sm:w-[320px] lg:w-[340px] snap-start"
    >
      {/* Poster */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border bg-muted transition-all duration-300 group-hover/card:scale-[1.04] group-hover/card:border-primary/40 group-hover/card:z-10">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-110"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-card">
            <BookOpen className="h-12 w-12 text-muted-foreground/30" strokeWidth={1.2} />
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
              <CheckCircle2 className="h-3 w-3" /> Novo
            </span>
          ) : null}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

        {/* Center play button (hover) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all duration-300 scale-90 group-hover/card:scale-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/95 backdrop-blur-sm border-2 border-foreground/20">
            <Play className="h-6 w-6 fill-current text-background ml-0.5" />
          </div>
        </div>

        {/* Bottom progress bar (always visible if started) */}
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
      <div className="mt-3 px-1">
        <h4 className="font-display text-sm font-bold text-foreground line-clamp-1 group-hover/card:text-primary transition-colors">
          {course.title}
        </h4>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="capitalize font-semibold">{course.category}</span>
          <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/40" />
          <span className="tabular-nums">{course.totalLessons} aulas</span>
          {course.completedLessons > 0 && !isFinished && (
            <>
              <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/40" />
              <span className="text-primary font-bold tabular-nums">{course.completedLessons}/{course.totalLessons}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────
 * GRID SECTION — for filter/search results
 * ───────────────────────────────────────────────────────── */
function GridSection({ courses }: { courses: PurchaseRow[] }) {
  if (courses.length === 0) {
    return (
      <div className="px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
          <Search className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-bold text-foreground">Nenhum resultado</p>
          <p className="mt-1 text-xs text-muted-foreground">Tente ajustar os filtros ou a busca.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-8 lg:px-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {courses.map(c => (
          <NetflixCard key={c.id} course={c} />
        ))}
      </div>
    </div>
  );
}
