import { Link, useLocation } from "react-router-dom";
import { ArrowRight, LifeBuoy, Trophy, UserRound } from "lucide-react";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { prefetchRoute } from "@/lib/routePrefetch";
import { cn } from "@/lib/utils";
import { SELLER_NAV, isSectionActive } from "./navConfig";

/** Navegação lateral do painel escuro (desktop). A seção ativa expande seus atalhos. */
export function SellerRail() {
  const { pathname, search } = useLocation();
  const here = pathname + search;

  return (
    <aside className="vp-rail sticky top-0 hidden h-[100dvh] w-[244px] shrink-0 flex-col md:flex" aria-label="Menu principal">
      <Link to="/dashboard" className="flex h-[76px] items-center gap-2.5 px-6" aria-label="Vemprapay — início">
        <VenxpayLogo size={30} />
        <span className="text-[19px] font-extrabold tracking-[-0.035em] text-foreground">vempra<span className="vp-glow-text">pay</span></span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:none]">
        <ul className="space-y-1">
          {SELLER_NAV.map((s) => {
            const active = isSectionActive(pathname, s);
            return (
              <li key={s.id}>
                <Link
                  to={s.url}
                  data-active={active}
                  onMouseEnter={() => prefetchRoute(s.url)}
                  className="vp-rail-item rounded-xl flex h-11 items-center gap-3 rounded-xl px-3.5 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <s.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  {s.label}
                </Link>
                {active && s.links && (
                  <ul className="vp-fade mb-2 ml-[26px] mt-1 space-y-0.5 border-l border-border pl-3">
                    {s.links.map((l) => (
                      <li key={l.url}>
                        <Link
                          to={l.url}
                          onMouseEnter={() => prefetchRoute(l.url.split("?")[0])}
                          className={cn(
                            "block rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                            here === l.url && "text-foreground",
                          )}
                        >
                          {l.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <div className="my-4 h-px bg-border" />
        <ul className="space-y-1">
          {[
            { url: "/premiacoes", label: "Premiações", icon: Trophy },
            { url: "/perfil", label: "Minha conta", icon: UserRound },
            { url: "/suporte", label: "Suporte", icon: LifeBuoy },
          ].map((i) => (
            <li key={i.url}>
              <Link to={i.url} data-active={pathname.startsWith(i.url)} onMouseEnter={() => prefetchRoute(i.url)} className="vp-rail-item flex h-10 items-center gap-3 rounded-xl px-3.5 text-[13.5px] font-medium">
                <i.icon className="h-[17px] w-[17px]" strokeWidth={2} />{i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Link to="/vendas/link-pagamento" className="vp-promo group m-3 block p-4">
        <p className="text-[15px] font-bold leading-snug text-foreground">Cobre em segundos.</p>
        <p className="text-[15px] font-bold leading-snug vp-glow-text">Pix ou cartão.</p>
        <span className="mt-4 grid h-9 w-9 place-items-center rounded-full border border-border text-foreground transition-transform group-hover:translate-x-1">
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </aside>
  );
}
