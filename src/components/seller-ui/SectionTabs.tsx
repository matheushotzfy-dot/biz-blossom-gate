import { Link, useLocation } from "react-router-dom";
import { SELLER_NAV } from "@/components/seller-shell/navConfig";

/**
 * Abas da seção atual (Vendas, Financeiro…). No computador esse papel é da barra lateral;
 * abaixo de 1280 px (celular e tablet) não há barra lateral, então a navegação entre as telas da seção vive aqui.
 */
export function SectionTabs({ section }: { section: string }) {
  const { pathname, search } = useLocation();
  const nav = SELLER_NAV.find((s) => s.id === section);
  if (!nav?.links) return null;
  const here = pathname + search;
  return (
    <nav aria-label={nav.label} className="-mx-1 flex gap-1 overflow-x-auto px-1 py-1 scrollbar-none xl:hidden">
      {nav.links.map((l) =>
        l.soon ? (
          <span key={l.url} className="vp-pill" aria-disabled="true">
            {l.title}
            <span className="rounded-full bg-foreground/[0.07] px-2 text-[11px] font-semibold">Em breve</span>
          </span>
        ) : (
          <Link key={l.url} to={l.url} className="vp-pill" aria-current={here === l.url ? "page" : undefined}>{l.title}</Link>
        ),
      )}
    </nav>
  );
}
