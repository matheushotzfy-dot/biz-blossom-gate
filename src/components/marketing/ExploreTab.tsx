import { useMemo, useState } from "react";
import { Check, Link2, Loader2, Search, Store } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Money } from "@/components/home/Money";
import { DELIVERY_LABELS } from "@/components/products/productPresentation";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { SearchField } from "@/components/seller-ui/SearchField";
import { cn } from "@/lib/utils";
import { COMMISSION_DEFAULT, commissionOf, type AffiliateLink, type CatalogProduct } from "./affiliateMeta";

type Sort = "commission" | "price_desc" | "price_asc" | "recent";
const SORTS: Array<{ value: Sort; label: string }> = [
  { value: "commission", label: "Maiores comissões" },
  { value: "price_desc", label: "Maior preço" },
  { value: "price_asc", label: "Menor preço" },
  { value: "recent", label: "Mais recentes" },
];

export interface ExploreTabProps {
  loading: boolean;
  error: boolean;
  hidden: boolean;
  /** Produtos de outros vendedores que aceitam afiliados. */
  products: CatalogProduct[];
  /** Links que você já tem, por produto. */
  linkByProduct: Map<string, AffiliateLink>;
  busyProductId: string | null;
  onAffiliate: (p: CatalogProduct) => void;
  onSeeLink: (p: CatalogProduct) => void;
  onRetry: () => void;
}

const pct = (p: CatalogProduct) => Number(p.affiliate_commission ?? 0) || COMMISSION_DEFAULT;

export function ExploreTab(p: ExploreTabProps) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("commission");
  const [kind, setKind] = useState("all");

  const kinds = useMemo(() => {
    const set = new Set(p.products.map((x) => x.delivery_type).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [p.products]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = p.products.filter((x) => (kind === "all" || x.delivery_type === kind) && (!term || x.name.toLowerCase().includes(term) || (x.display_name ?? "").toLowerCase().includes(term)));
    return [...list].sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      if (sort === "recent") return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      return pct(b) - pct(a) || b.price - a.price;
    });
  }, [p.products, q, sort, kind]);

  if (p.error) {
    return <section className="vp-sheet"><EmptyPanel title="Não foi possível carregar os produtos" text="Confira sua conexão e tente de novo." action={<button type="button" className="vp-ghost" onClick={p.onRetry}>Tentar de novo</button>} /></section>;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {(p.products.length > 0 || p.loading) && <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {kinds.length > 1 ? (
          <FilterPills<string> label="Filtrar por tipo de produto" value={kind} onChange={setKind} options={[{ value: "all", label: "Todos", count: p.products.length }, ...kinds.map((k) => ({ value: k, label: DELIVERY_LABELS[k] ?? k }))]} />
        ) : <span />}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField label="Buscar produto" value={q} onChange={setQ} placeholder="Produto ou produtor" className="sm:w-[280px]" />
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger aria-label="Ordenar produtos" className="vp-r16 h-11 sm:w-[210px]"><SelectValue /></SelectTrigger>
            <SelectContent collisionPadding={16}>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>}

      {p.loading && p.products.length === 0 ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <li key={i} className="vp-skel h-[340px] !rounded-[22px]" />)}</ul>
      ) : shown.length === 0 ? (
        <section className="vp-sheet">
          <EmptyPanel
            icon={<Store className="h-7 w-7" strokeWidth={1.8} />}
            title={p.products.length === 0 ? "Ainda não há produtos para divulgar" : "Nenhum produto encontrado"}
            text={p.products.length === 0 ? "Quando outros vendedores abrirem o programa de afiliados, os produtos aparecem aqui." : "Tente outro nome ou limpe o filtro."}
            action={p.products.length > 0 ? <button type="button" className="vp-ghost" onClick={() => { setQ(""); setKind("all"); }}>Limpar filtros</button> : undefined}
          />
        </section>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Produtos para divulgar">
          {shown.map((x) => {
            const link = p.linkByProduct.get(x.id);
            const c = pct(x);
            return (
              <li key={x.id} className="vp-sheet flex flex-col overflow-hidden">
                <div className="relative aspect-[16/9] w-full bg-muted">
                  {x.image_url ? <img src={x.image_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : (
                    <span aria-hidden className="grid h-full w-full place-items-center bg-accent text-[40px] font-extrabold tracking-[-0.04em] text-accent-foreground/60">{x.name.slice(0, 2).toUpperCase()}</span>
                  )}
                  <span className="absolute left-3.5 top-3.5 inline-flex h-8 items-center rounded-full bg-card px-3.5 text-[13px] font-extrabold text-accent-foreground shadow-sm ring-1 ring-primary/30">{c}% de comissão</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="line-clamp-2 text-[16.5px] font-extrabold leading-snug tracking-[-0.02em] text-foreground">{x.name}</h3>
                  <p className="mt-1 truncate text-[13px] text-muted-foreground">{x.display_name ? `Por ${x.display_name}` : "Produtor verificado"}</p>
                  {x.delivery_type && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{DELIVERY_LABELS[x.delivery_type] ?? x.delivery_type}</p>}
                  <dl className="mt-4 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
                    <div><dt className="text-[12.5px] text-muted-foreground">Preço</dt><dd className="mt-0.5 text-[17px] font-extrabold tracking-[-0.03em] text-foreground"><Money value={x.price} centsClassName="opacity-70" /></dd></div>
                    <div><dt className="text-[12.5px] text-muted-foreground">Você ganha até</dt><dd className="mt-0.5 text-[17px] font-extrabold tracking-[-0.03em] vp-green-ink"><Money value={commissionOf(x.price, c)} centsClassName="opacity-70" /></dd></div>
                  </dl>
                  <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">Por venda, antes das taxas.</p>
                  <div className="mt-auto pt-5">
                    {link ? (
                      <button type="button" className="vp-ghost w-full justify-center" onClick={() => p.onSeeLink(x)}><Check className="h-4 w-4" />Copiar meu link</button>
                    ) : (
                      <button type="button" className={cn("vp-cta w-full justify-center")} disabled={p.busyProductId === x.id} onClick={() => p.onAffiliate(x)}>
                        {p.busyProductId === x.id ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Criando link…</> : <><Link2 className="h-4 w-4" />Quero divulgar</>}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
