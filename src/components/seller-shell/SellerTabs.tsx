import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/routePrefetch";
import { SELLER_NAV, isSectionActive, type SellerNavSection } from "./navConfig";

/** Abas horizontais estilo internet banking, com painel de atalhos ao passar o mouse. */
export function SellerTabs() {
  const { pathname } = useLocation();
  const [openId, setOpenId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = (id: string | null, delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpenId(id), delay);
  };

  const open = SELLER_NAV.find((s) => s.id === openId && s.links?.length);

  return (
    <nav aria-label="Navegação principal" className="relative" onMouseLeave={() => schedule(null, 120)}>
      <ul className="flex items-stretch gap-1">
        {SELLER_NAV.map((s) => (
          <li key={s.id}>
            <Link
              to={s.url}
              data-active={isSectionActive(pathname, s)}
              onMouseEnter={() => { prefetchRoute(s.url); schedule(s.id, 90); }}
              onFocus={() => setOpenId(s.id)}
              onClick={() => setOpenId(null)}
              className="vp-tab flex h-11 items-center px-3.5 text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
      {open && <MegaPanel section={open} onPick={() => setOpenId(null)} onEnter={() => schedule(open.id, 0)} />}
    </nav>
  );
}

function MegaPanel({ section, onPick, onEnter }: { section: SellerNavSection; onPick: () => void; onEnter: () => void }) {
  const { pathname, search } = useLocation();
  const here = pathname + search;
  return (
    <div onMouseEnter={onEnter} className="vp-mega vp-fade absolute left-0 top-full z-50 mt-1 w-[560px] rounded-2xl p-2 text-foreground">
      <div className="grid grid-cols-2 gap-1">
        {section.links!.map((l) => (
          <Link
            key={l.url}
            to={l.url}
            onClick={onPick}
            onMouseEnter={() => prefetchRoute(l.url.split("?")[0])}
            className={cn(
              "flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-accent",
              here === l.url && "bg-accent",
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent text-accent-foreground">
              <l.icon className="h-[17px] w-[17px]" strokeWidth={2.1} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold">{l.title}</span>
              <span className="block text-[12px] text-muted-foreground">{l.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
