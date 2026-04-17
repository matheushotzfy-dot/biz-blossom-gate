import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Search, BookOpen, CheckCircle2, X, GraduationCap,
  Play, Trophy, Clock, ShoppingBag, ArrowUpRight, Receipt, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";

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

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

const PAYMENT_LABEL: Record<string, string> = {
  pix: "PIX",
  credit_card: "Cartão",
  boleto: "Boleto",
};

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
        accessStatus: (accessRow?.status === "revoked" ? "revoked" : "active"),
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

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs text-muted-foreground">Carregando histórico…</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] pb-24 md:pb-10">
      {/* ── Header ── */}
      <div className="px-5 pt-1 sm:px-7">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-border">
            <ShoppingBag className="h-5 w-5 text-primary" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-[22px]">
              Minhas Compras
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Histórico de produtos adquiridos e acesso aos conteúdos
            </p>
          </div>
        </div>

        {/* ── Summary strip ── */}
        {rows.length > 0 && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total de compras</p>
              <p className="text-xl font-extrabold text-foreground tabular-nums mt-1.5">{stats.total}</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Investido</p>
              <p className="text-xl font-extrabold text-foreground tabular-nums mt-1.5">{formatBRL(stats.totalSpent)}</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Em andamento</p>
              <p className="text-xl font-extrabold text-warning tabular-nums mt-1.5">{stats.inProgress}</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Concluídos</p>
              <p className="text-xl font-extrabold text-success tabular-nums mt-1.5">{stats.completed}</p>
            </div>
          </div>
        )}

        {/* ── Toolbar ── */}
        {rows.length > 0 && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-0.5">
              {[
                { key: "all", label: "Todos", count: stats.total },
                { key: "in_progress", label: "Em andamento", count: stats.inProgress },
                { key: "completed", label: "Concluídos", count: stats.completed },
                { key: "not_started", label: "Não iniciados", count: stats.total - stats.completed - stats.inProgress },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setStatusFilter(t.key as typeof statusFilter)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all duration-150",
                    statusFilter === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                  <span className={cn("ml-1.5 text-[10px] tabular-nums", statusFilter === t.key ? "text-primary" : "text-muted-foreground/60")}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produto…"
                className="h-9 w-full rounded-lg border border-border bg-secondary pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 sm:w-64"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {rows.length === 0 ? (
        <div className="mx-5 sm:mx-7 mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary">
            <ShoppingBag className="h-6 w-6 text-muted-foreground" strokeWidth={1.4} />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">Nenhuma compra registrada</p>
          <p className="mt-1.5 max-w-[320px] text-xs leading-relaxed text-muted-foreground">
            Quando você adquirir um produto, ele aparecerá aqui com acesso imediato ao conteúdo.
          </p>
          <Link
            to="/marketplace"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Explorar marketplace
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="px-5 sm:px-7 mt-5">
          {/* ── Purchase Table ── */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="w-[42%]">Produto</TableHead>
                  <TableHead className="w-[14%]">Data da compra</TableHead>
                  <TableHead className="w-[12%] text-right">Valor pago</TableHead>
                  <TableHead className="w-[16%]">Progresso</TableHead>
                  <TableHead className="w-[10%]">Acesso</TableHead>
                  <TableHead className="w-[6%] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="py-16">
                      <div className="flex flex-col items-center text-center gap-2">
                        <Filter className="h-5 w-5 text-muted-foreground/50" />
                        <p className="text-sm font-semibold text-foreground">Nenhum resultado</p>
                        <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou a busca.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.map(row => {
                  const pct = row.totalLessons > 0 ? Math.round((row.completedLessons / row.totalLessons) * 100) : 0;
                  const isFinished = pct === 100 && row.totalLessons > 0;
                  return (
                    <TableRow key={row.id} className="border-border">
                      {/* Product */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-16 shrink-0 rounded-md bg-muted overflow-hidden border border-border/60">
                            {row.thumbnail_url ? (
                              <img src={row.thumbnail_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent">
                                <BookOpen className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{row.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                              {row.category} · {row.totalLessons} aula{row.totalLessons !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Date */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-foreground tabular-nums">{formatDate(row.grantedAt)}</span>
                          {row.transactionId && (
                            <span className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                              #{row.transactionId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Value */}
                      <TableCell className="text-right">
                        {row.amountPaid !== null ? (
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-foreground tabular-nums">{formatBRL(row.amountPaid)}</span>
                            {row.paymentMethod && (
                              <span className="text-[10px] text-muted-foreground mt-0.5">
                                {PAYMENT_LABEL[row.paymentMethod] || row.paymentMethod}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </TableCell>

                      {/* Progress */}
                      <TableCell>
                        {row.totalLessons > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground tabular-nums">
                                {row.completedLessons}/{row.totalLessons}
                              </span>
                              <span className={cn("font-bold tabular-nums", isFinished ? "text-success" : pct > 0 ? "text-foreground" : "text-muted-foreground")}>
                                {pct}%
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full transition-all", isFinished ? "bg-success" : "bg-primary")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/60">Sem aulas</span>
                        )}
                      </TableCell>

                      {/* Access */}
                      <TableCell>
                        {row.accessStatus === "active" ? (
                          isFinished ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-success/15 bg-success/8 px-2.5 py-1 text-[10px] font-bold text-success">
                              <Trophy className="h-3 w-3" />
                              Concluído
                            </span>
                          ) : pct > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-warning/15 bg-warning/8 px-2.5 py-1 text-[10px] font-bold text-warning">
                              <Clock className="h-3 w-3" />
                              Em curso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-info/15 bg-info/8 px-2.5 py-1 text-[10px] font-bold text-info">
                              <CheckCircle2 className="h-3 w-3" />
                              Liberado
                            </span>
                          )
                        ) : (
                          <StatusBadge status="cancelled" />
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <Link
                          to={`/membros/curso/${row.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          Acessar
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* ── Footer note ── */}
          <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Receipt className="h-3 w-3" />
              <span>
                {filtered.length} de {rows.length} compra{rows.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Link to="/suporte" className="hover:text-foreground transition-colors">
              Precisa de ajuda com uma compra?
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
