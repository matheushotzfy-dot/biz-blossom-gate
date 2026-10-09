import { useCallback, useEffect, useMemo, useState } from "react";
import { GraduationCap, Search, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumPanel, PremiumEmpty, premiumTable } from "./AdminPremium";
import type { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  profiles?: Tables<"profiles">[];
  products?: Tables<"products">[];
}

type Course = Tables<"courses">;

const PAGE_SIZE = 50;
const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function AdminCoursesTab({ profiles = [], products = [] }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(0); }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const profileMap = useMemo(() => {
    const m = new Map<string, Tables<"profiles">>();
    for (const p of profiles) m.set(p.user_id, p);
    return m;
  }, [profiles]);
  const productMap = useMemo(() => {
    const m = new Map<string, Tables<"products">>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase.from("courses").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (debouncedSearch) {
      const safe = debouncedSearch.replace(/[%,()*\\]/g, "");
      query = query.or(`title.ilike.%${safe}%,category.ilike.%${safe}%`);
    }
    const { data, error: err, count } = await query.range(from, to);
    if (err) { setError(err.message); setLoading(false); return; }
    setItems(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, debouncedSearch]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const sellerLabel = (userId: string) => {
    const p = profileMap.get(userId);
    if (p) return p.full_name || p.email || userId.slice(0, 8);
    return userId.slice(0, 8) + "…";
  };
  const productLabel = (productId: string | null) => {
    if (!productId) return "—";
    return productMap.get(productId)?.name || productId.slice(0, 8) + "…";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Educação"
        title="Cursos da plataforma"
        subtitle="Listagem de todos os cursos cadastrados pelos vendedores."
        status={{ tone: "info", label: `${total} curso(s)`, pulse: false }}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou categoria..."
          className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30"
        />
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Erro ao carregar cursos: {error}</span>
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/10">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      )}

      <PremiumPanel
        eyebrow="Cursos"
        title={`Resultados · ${total}`}
        icon={GraduationCap}
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-40 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || loading}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted/40 disabled:opacity-40 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <PremiumEmpty icon={GraduationCap} title="Nenhum curso encontrado" subtitle="Ajuste os filtros ou aguarde novos cadastros." />
        ) : (
          <div className={premiumTable.wrapper}>
            <table className={premiumTable.table}>
              <thead>
                <tr className={premiumTable.headRow}>
                  <th className={premiumTable.th}>Título</th>
                  <th className={premiumTable.th}>Categoria</th>
                  <th className={premiumTable.th}>Produto</th>
                  <th className={premiumTable.th}>Vendedor</th>
                  <th className={premiumTable.th}>Publicado</th>
                  <th className={premiumTable.th}>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className={premiumTable.row}>
                    <td className={premiumTable.td}>
                      <span className="font-semibold text-foreground">{c.title}</span>
                    </td>
                    <td className={premiumTable.td}><span className="text-muted-foreground">{c.category || "—"}</span></td>
                    <td className={premiumTable.td}><span className="text-muted-foreground">{productLabel(c.product_id)}</span></td>
                    <td className={premiumTable.td}><span className="text-foreground/80">{sellerLabel(c.user_id)}</span></td>
                    <td className={premiumTable.td}>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${c.is_published ? "border-success/20 bg-success/10 text-success" : "border-border bg-muted/30 text-muted-foreground"}`}>
                        {c.is_published ? "Publicado" : "Rascunho"}
                      </span>
                    </td>
                    <td className={premiumTable.td}><span className="text-muted-foreground">{dateFmt.format(new Date(c.created_at))}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumPanel>
    </div>
  );
}
