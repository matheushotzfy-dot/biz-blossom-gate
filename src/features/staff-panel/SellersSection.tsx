import { useEffect, useState } from "react";
import { Loader2, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminPager from "@/components/admin/AdminPager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ToneTag } from "@/features/admin-disputes/parts";
import { ACCOUNT_STATUS_LABEL } from "@/features/kyc/kycReviewModel";
import { PremiumEmpty, PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { day, int, money, type Portfolio } from "./staffPanelModel";

const toneOf = (status: string) =>
  status === "approved" ? "success" as const
    : status === "rejected" || status === "blocked" ? "destructive" as const
      : status === "pending_review" ? "warning" as const : "neutral" as const;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

/** Sellers da carteira com o desempenho do período. A busca vai para o servidor (nome, e-mail ou ID). */
export function SellersSection({ data, loading, fetching, search, page, onSearch, onPage, onOpen }: {
  data: Portfolio | null;
  loading: boolean;
  fetching: boolean;
  search: string;
  page: number;
  onSearch: (v: string) => void;
  onPage: (p: number) => void;
  onOpen: (id: string) => void;
}) {
  const [text, setText] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim() !== search) onSearch(text.trim()); }, 350);
    return () => clearTimeout(t);
  }, [text, search, onSearch]);

  const rows = data?.sellers ?? [];
  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader title="Sellers" subtitle="Quem está na sua carteira, desde quando, e quanto vendeu no período. Abra um seller para ver a ficha e o que você pode fazer por ele." />
      <PremiumPanel title={data ? `${int(data.metrics.sellers)} ${data.metrics.sellers === 1 ? "seller na carteira" : "sellers na carteira"}` : "Sellers da carteira"} icon={Users}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar sellers" placeholder="Nome, e-mail ou ID" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} style={{ paddingLeft: 40 }}
              className="h-10 w-full rounded-xl border border-border bg-muted/30 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none" />
          </div>
          {search && <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => { setText(""); onSearch(""); }}><X className="h-3.5 w-3.5" /> Limpar busca</Button>}
          {fetching && !loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Atualizando" />}
        </div>

        {loading && !data ? (
          <p className="flex items-center gap-2 py-10 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando a carteira…</p>
        ) : rows.length === 0 ? (
          <PremiumEmpty icon={Users} title={search ? "Ninguém com essa busca" : "Sua carteira está vazia"}
            subtitle={search ? "Confira o nome ou o e-mail." : "O dono é quem liga sellers a você. Quando ligar, eles aparecem aqui."} />
        ) : (
          <>
            <ul className="m-0 grid grid-cols-[minmax(0,1fr)] gap-2.5 p-0" style={{ listStyle: "none" }} aria-label="Sellers da carteira">
              <li aria-hidden className="hidden px-4 pb-1 text-[12px] font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] lg:gap-4">
                <span>Seller</span><span>Situação</span><span className="text-right">Vendas</span><span className="text-right">Volume pago</span><span className="text-right">Líquido</span>
              </li>
              {rows.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => onOpen(s.id)} aria-label={`Abrir ${s.name}`}
                    className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 rounded-[14px] px-4 py-3.5 text-left hover:bg-muted/40 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] lg:items-center"
                    style={{ border: "1px solid hsl(var(--border) / .7)" }}>
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-[13px] font-semibold text-foreground">{initials(s.name)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-foreground">{s.name}</span>
                        <span className="block truncate text-[12.5px] text-muted-foreground">{s.email ?? "Sem e-mail"}{s.since ? `, na carteira desde ${day(s.since)}` : ""}</span>
                      </span>
                    </span>
                    <span className="justify-self-end lg:justify-self-start"><ToneTag tone={toneOf(s.status)}>{ACCOUNT_STATUS_LABEL[s.status] ?? s.status}</ToneTag></span>
                    <span className="text-[13px] tabular-nums text-muted-foreground lg:text-right lg:text-[14px] lg:text-foreground"><span className="lg:hidden">Vendas </span>{int(s.sales)}</span>
                    <span className="justify-self-end text-[14px] font-semibold tabular-nums text-foreground lg:text-right">{money(s.volume)}</span>
                    <span className="hidden text-right text-[14px] tabular-nums text-muted-foreground lg:block">{money(s.net)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <AdminPager page={page} pageSize={data?.pageSize ?? 25} totalCount={data?.total ?? 0} onPageChange={onPage} loading={fetching} />
          </>
        )}
      </PremiumPanel>
    </div>
  );
}
