import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, LoaderCircle, Package, Receipt, Search, SearchX, X, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn, deriveTransactionStatus, formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { dialogBox } from "@/components/seller-ui/form";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { txStatusMeta, whenLabel } from "@/components/seller-ui/txMeta";
import { SEARCH_PAGES, filterPages, productStatusLabel, sanitizeTerm } from "./globalSearch";

interface Item {
  id: string;
  title: string;
  desc?: string;
  /** Valor à direita (preço ou valor da venda). */
  meta?: string;
  href: string;
  icon: LucideIcon;
}
interface Group { label: string; items: Item[] }

const REMOTE_MIN_CHARS = 2;
const REMOTE_LIMIT = 5;
const PAGES_WHEN_TYPING = 5;
const LIST_ID = "global-search-list";

/**
 * Busca global (Ctrl-K). Páginas respondem na hora (vêm do menu do painel); produtos e vendas
 * são buscados no servidor a partir de 2 letras, só os do próprio seller.
 */
export function GlobalSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [products, setProducts] = useState<Item[]>([]);
  const [sales, setSales] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [remoteFailed, setRemoteFailed] = useState(false);

  const term = sanitizeTerm(query);
  const typing = query.trim().length > 0;
  const remoteActive = term.length >= REMOTE_MIN_CHARS;

  useEffect(() => {
    if (!open) { setQuery(""); setSelected(0); }
  }, [open]);

  useEffect(() => {
    if (!open || !user?.id || !remoteActive) {
      requestRef.current += 1;
      setProducts([]); setSales([]); setLoading(false); setRemoteFailed(false);
      return;
    }
    const id = ++requestRef.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const pattern = `%${term}%`;
        const [prod, tx] = await Promise.all([
          supabase.from("products").select("id, name, price, status").eq("user_id", user.id).is("deleted_at", null).ilike("name", pattern).order("created_at", { ascending: false }).limit(REMOTE_LIMIT),
          supabase.from("transactions").select("id, customer_name, customer_email, amount, status, payment_method, created_at, pix_expires_at").eq("user_id", user.id).or(`customer_name.ilike.${pattern},customer_email.ilike.${pattern}`).order("created_at", { ascending: false }).limit(REMOTE_LIMIT),
        ]);
        if (id !== requestRef.current) return;

        setProducts((prod.data ?? []).map((p) => ({
          id: `product:${p.id}`,
          title: p.name,
          desc: productStatusLabel(p.status) || undefined,
          meta: formatCurrency(Number(p.price)),
          href: `/vendas/produtos?q=${encodeURIComponent(p.name)}`,
          icon: Package,
        })));
        setSales((tx.data ?? []).map((t) => {
          const who = t.customer_name || t.customer_email || "Venda sem identificação";
          const status = txStatusMeta(deriveTransactionStatus(t)).label;
          return {
            id: `sale:${t.id}`,
            title: who,
            desc: [t.customer_name ? t.customer_email : null, status, whenLabel(t.created_at)].filter(Boolean).join(" · "),
            meta: formatCurrency(Number(t.amount)),
            href: `/vendas?search=${encodeURIComponent(t.customer_email || t.customer_name || "")}`,
            icon: Receipt,
          };
        }));
        setRemoteFailed(!!prod.error || !!tx.error);
      } catch {
        if (id !== requestRef.current) return;
        setProducts([]); setSales([]); setRemoteFailed(true);
      } finally {
        if (id === requestRef.current) setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [open, user?.id, remoteActive, term]);

  const groups = useMemo<Group[]>(() => {
    if (!typing) {
      const bySection = new Map<string, Item[]>();
      for (const p of SEARCH_PAGES) {
        const list = bySection.get(p.section) ?? [];
        list.push({ id: p.id, title: p.title, desc: p.desc, href: p.href, icon: p.icon });
        bySection.set(p.section, list);
      }
      return [...bySection].map(([label, items]) => ({ label, items }));
    }
    const pages = filterPages(SEARCH_PAGES, query, PAGES_WHEN_TYPING).map((p) => ({ id: p.id, title: p.title, desc: p.desc, href: p.href, icon: p.icon }));
    return [
      { label: "Páginas", items: pages },
      { label: "Produtos", items: products },
      { label: "Vendas", items: sales },
    ].filter((g) => g.items.length > 0);
  }, [typing, query, products, sales]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const active = flat.length === 0 ? -1 : Math.min(selected, flat.length - 1);

  useEffect(() => {
    if (active < 0) return;
    if (active === 0) { listRef.current?.scrollTo?.({ top: 0 }); return; }
    document.getElementById(`global-search-opt-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const go = useCallback((href: string) => {
    onOpenChange(false);
    navigate(href);
  }, [navigate, onOpenChange]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" && flat.length > 0) { e.preventDefault(); setSelected((active + 1) % flat.length); }
    else if (e.key === "ArrowUp" && flat.length > 0) { e.preventDefault(); setSelected((active - 1 + flat.length) % flat.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); go(flat[active].href); }
  };

  const waiting = loading && remoteActive && flat.length === 0;
  const empty = typing && flat.length === 0 && !loading;
  let index = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={dialogBox("lg", "h-[min(580px,86dvh)]")}
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
      >
        <DialogTitle className="sr-only">Busca</DialogTitle>
        <DialogDescription className="sr-only">Procure páginas, produtos e vendas. Use as setas para escolher e Enter para abrir.</DialogDescription>

        <div className="shrink-0 border-b border-border py-4 pl-4 pr-14 sm:pl-5">
          <label className="relative block">
            <span className="sr-only">Buscar páginas, produtos e vendas</span>
            {loading
              ? <LoaderCircle aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 animate-spin text-primary" />
              : <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />}
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-expanded="true"
              aria-controls={LIST_ID}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `global-search-opt-${active}` : undefined}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
              onKeyDown={onKeyDown}
              placeholder="Buscar páginas, produtos e vendas"
              className="h-12 w-full rounded-full border border-border bg-background pl-11 pr-10 text-[15px] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(""); setSelected(0); inputRef.current?.focus(); }} aria-label="Limpar busca" className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        </div>

        <div ref={listRef} id={LIST_ID} role="listbox" aria-label="Resultados" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1">
          {groups.map((g) => (
            <div key={g.label} role="group" aria-label={g.label}>
              <p className="px-3 pb-1.5 pt-3.5 text-[13px] font-bold text-muted-foreground">{g.label}</p>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                const on = i === active;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`global-search-opt-${i}`}
                    type="button"
                    role="option"
                    aria-selected={on}
                    tabIndex={-1}
                    onClick={() => go(item.href)}
                    onMouseMove={() => { if (!on) setSelected(i); }}
                    className={cn(
                      "vp-r16 flex w-full items-center gap-3.5 px-3 py-2.5 text-left transition-colors duration-100",
                      on ? "bg-accent shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3)]" : "hover:bg-muted/60",
                    )}
                  >
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.1} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold tracking-[-0.01em] text-foreground">{item.title}</span>
                      {item.desc && <span className="block truncate text-[13px] text-muted-foreground">{item.desc}</span>}
                    </span>
                    {item.meta && <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-foreground">{item.meta}</span>}
                    {on && <CornerDownLeft aria-hidden className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />}
                  </button>
                );
              })}
            </div>
          ))}

          {waiting && (
            <div aria-hidden className="space-y-2 px-1 pt-4">
              {[0, 1, 2].map((n) => <div key={n} className="vp-skel h-[60px] rounded-[16px]" />)}
            </div>
          )}

          {empty && (
            <EmptyPanel
              icon={<SearchX className="h-7 w-7" strokeWidth={2} />}
              title={`Nada encontrado para “${query.trim()}”`}
              text="Procure pelo nome de um produto, pelo nome ou e-mail de um cliente, ou por uma página, como saques ou cupons."
            />
          )}

          {remoteFailed && remoteActive && !loading && (
            <p role="status" className="mx-3 mt-3 rounded-[14px] bg-warning/15 px-4 py-3 text-[13px] font-medium leading-snug text-foreground">
              Não deu para buscar produtos e vendas agora. As páginas continuam funcionando.
            </p>
          )}
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {typing && !loading ? (flat.length === 0 ? "Nenhum resultado" : `${flat.length} ${flat.length === 1 ? "resultado" : "resultados"}`) : ""}
        </p>

        <div className="hidden shrink-0 items-center gap-5 border-t border-border bg-card px-6 py-3 text-[12.5px] text-muted-foreground sm:flex">
          <Hint keys={["↑", "↓"]} label="escolher" />
          <Hint keys={["Enter"]} label="abrir" />
          <Hint keys={["Esc"]} label="fechar" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys.map((k) => (
        <kbd key={k} className="grid h-[22px] min-w-[22px] place-items-center rounded-[8px] bg-muted px-1.5 font-sans text-[11.5px] font-bold text-foreground">{k}</kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}
