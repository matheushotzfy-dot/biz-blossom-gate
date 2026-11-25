import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { prefetchRoute } from "@/lib/routePrefetch";
import { useSupportUnread } from "@/hooks/useSupportUnread";
import { cn } from "@/lib/utils";
import { SELLER_EXTRA, SELLER_NAV, isSectionActive } from "./navConfig";


/**
 * Navegação lateral do painel (desktop), na identidade do cadastro.
 * A seção ativa vira um mini-logo (quadrado verde, ícone branco) e abre seus atalhos.
 * Clicar na seção aberta recolhe os atalhos (sem sair da página); clicar de novo abre. Ir para outra seção
 * (pelo menu ou por um botão de página) abre a de destino e fecha a anterior.
 */
export function SellerRail() {
  const { pathname, search } = useLocation();
  const here = pathname + search;
  const supportUnread = useSupportUnread();

  const activeId = SELLER_NAV.find((s) => isSectionActive(pathname, s))?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(activeId);
  useEffect(() => { setOpenId(activeId); }, [activeId]);

  return (
    <aside className="vp-rail sticky top-0 hidden h-[100dvh] w-[272px] shrink-0 flex-col md:flex" aria-label="Menu principal">
      <Link to="/dashboard" className="flex h-[84px] shrink-0 items-center gap-3 px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Vemprapay — início">
        <VenxpayLogo size={36} />
        <span className="font-heading text-[21px] font-extrabold tracking-[-0.04em] text-foreground">
          vempra<span className="text-primary">pay</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3.5 pb-4 [scrollbar-width:none]" aria-label="Seções">
        <ul className="space-y-1">
          {SELLER_NAV.map((s) => {
            const active = isSectionActive(pathname, s);
            const expanded = !!s.links && openId === s.id;
            const chevron = s.links && <ChevronRight aria-hidden className={cn("h-4 w-4 opacity-40 transition-transform duration-200", expanded && "rotate-90 opacity-70")} />;
            const inner = (
              <>
                <span className="vp-nav-chip"><s.icon className="h-[18px] w-[18px]" strokeWidth={2.1} /></span>
                <span className="flex-1 truncate">{s.label}</span>
                {chevron}
              </>
            );
            return (
              <li key={s.id}>
                {s.links && active ? (
                  <button type="button" data-active={active} aria-expanded={expanded} aria-controls={`nav-${s.id}`} onClick={() => setOpenId(expanded ? null : s.id)} className="vp-nav w-full text-left">
                    {inner}
                  </button>
                ) : (
                  <Link to={s.url} data-active={active} aria-current={active ? "page" : undefined} onMouseEnter={() => prefetchRoute(s.url)} onClick={() => setOpenId(s.id)} className="vp-nav">
                    {inner}
                  </Link>
                )}

                {expanded && s.links && (
                  <ul id={`nav-${s.id}`} className="vp-fade mb-2 ml-[29px] mt-1 space-y-0.5 border-l-2 border-border pl-4">
                    {s.links.map((l) => {
                      const current = here === l.url;
                      if (l.soon) {
                        return (
                          <li key={l.url} className="relative">
                            <span aria-hidden className="absolute left-[-21px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-border ring-4 ring-card" />
                            <span aria-disabled="true" className="flex cursor-not-allowed items-center gap-2 py-1.5 pr-2 text-[13px] font-medium text-muted-foreground/60">
                              {l.title}
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Em breve</span>
                            </span>
                          </li>
                        );
                      }
                      return (
                        <li key={l.url} className="relative">
                          <span aria-hidden className={cn("absolute left-[-21px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full ring-4 ring-card transition-colors", current ? "bg-primary" : "bg-border")} />
                          <Link
                            to={l.url}
                            onMouseEnter={() => prefetchRoute(l.url.split("?")[0])}
                            aria-current={current ? "page" : undefined}
                            className={cn(
                              "block rounded-lg py-1.5 pr-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                              current ? "font-bold text-foreground" : "font-medium text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {l.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <div className="my-4 h-px bg-border" />
        <ul className="space-y-0.5">
          {SELLER_EXTRA.map((i) => (
            <li key={i.url}>
              <Link to={i.url} data-active={pathname.startsWith(i.url)} onMouseEnter={() => prefetchRoute(i.url)} className="vp-nav vp-nav-sm">
                <span className="vp-nav-chip"><i.icon className="h-[16px] w-[16px]" strokeWidth={2.1} /></span>
                <span className="flex-1">{i.label}</span>
                {i.url === "/suporte" && supportUnread > 0 && (
                  <span aria-label={`${supportUnread} ${supportUnread === 1 ? "resposta nova" : "respostas novas"}`} className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">{supportUnread}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Em tela baixa o card some: com uma seção aberta ele cobriria Premiações/Minha conta/Suporte. */}
      <div className="shrink-0 p-3.5 pt-0 [@media(max-height:820px)]:hidden">
        <Link to="/vendas/link-pagamento" className="vp-promo group block p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card">
          <p className="font-heading text-[18px] font-extrabold leading-[1.15] tracking-[-0.03em]">Cobre em segundos.</p>
          <p className="mt-1.5 text-[13px] leading-snug text-white/80">Pix ou cartão, direto de um link.</p>
          <span className="mt-4 inline-flex h-9 items-center rounded-full bg-white px-4 text-[13px] font-bold text-[hsl(157_100%_21%)] transition-transform group-hover:-translate-y-0.5">
            Criar link de pagamento
          </span>
        </Link>
      </div>
    </aside>
  );
}
