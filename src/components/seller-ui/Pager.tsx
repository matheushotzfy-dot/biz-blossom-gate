import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Paginação enxuta: resumo à esquerda, páginas à direita. */
export function Pager({ page, pageSize, total, onPage, loading }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; loading?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  if (total <= 0) return null;
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);
  const start = Math.max(1, Math.min(current - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const step = "grid h-9 min-w-9 place-items-center rounded-full px-2 text-[13px] font-bold tabular-nums transition-colors";
  return (
    <nav aria-label="Paginação" className="flex flex-col items-center justify-between gap-3 border-t border-border px-6 py-4 sm:flex-row sm:px-7">
      <p className="text-[13px] text-muted-foreground tabular-nums">Mostrando {from.toLocaleString("pt-BR")} a {to.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}</p>
      {pages > 1 && <div className={cn("flex items-center gap-1", loading && "opacity-60")}>
        <button type="button" onClick={() => onPage(current - 1)} disabled={current === 1} aria-label="Página anterior" className={cn(step, "text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-35")}><ChevronLeft className="h-4 w-4" /></button>
        {numbers.map((n) => (
          <button key={n} type="button" onClick={() => onPage(n)} aria-current={n === current ? "page" : undefined} className={cn(step, n === current ? "bg-accent text-accent-foreground ring-1 ring-primary/30" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{n}</button>
        ))}
        <button type="button" onClick={() => onPage(current + 1)} disabled={current === pages} aria-label="Próxima página" className={cn(step, "text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-35")}><ChevronRight className="h-4 w-4" /></button>
      </div>}
    </nav>
  );
}
