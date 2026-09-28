interface AdminPagerProps {
  /** 1-based current page */
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}

/**
 * Small reusable pager for admin list tabs using server-side pagination
 * (`.range()` + `{ count: "exact" }` queries). Shows "Anterior" / "Próxima"
 * buttons plus a "Página X de Y · N registros" summary.
 */
export default function AdminPager({ page, pageSize, totalCount, onPageChange, loading, className }: AdminPagerProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 pt-3 ${className || ""}`}>
      <span className="text-[11px] font-semibold text-muted-foreground">
        Página {safePage} de {totalPages} · {totalCount} registro{totalCount === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1 || !!loading}
          className="h-8 rounded-lg border border-border px-3 text-[11px] font-bold text-foreground/80 transition-colors hover:bg-muted/40 disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages || !!loading}
          className="h-8 rounded-lg border border-border px-3 text-[11px] font-bold text-foreground/80 transition-colors hover:bg-muted/40 disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
