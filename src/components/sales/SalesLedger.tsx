import { FileText, Search as SearchIcon } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { cn, deriveTransactionStatus, isApprovedTransaction } from "@/lib/utils";
import { Money } from "@/components/home/Money";
import { Avatar, MethodMark, StatusPill } from "@/components/seller-ui/tx";
import { txStatusMeta, whenLabel } from "@/components/seller-ui/txMeta";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { SearchField } from "@/components/seller-ui/SearchField";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { Pager } from "@/components/seller-ui/Pager";
import type { SalesStatusKey } from "@/lib/sales-status-filter";
import { SALES_STATUS_OPTIONS } from "./salesOptions";

type Tx = Tables<"transactions">;

export interface SalesLedgerProps {
  items: Tx[];
  products: Record<string, string>;
  hidden: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpen: (tx: Tx) => void;
  search: string;
  onSearch: (v: string) => void;
  status: SalesStatusKey;
  onStatus: (s: SalesStatusKey) => void;
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onCreateLink: () => void;
}

const COLS = "lg:grid-cols-[minmax(0,1.8fr)_110px_170px_150px_minmax(130px,0.8fr)]";

/** Livro de vendas: busca, filtros por status, linhas no padrão do extrato e paginação. */
export function SalesLedger(p: SalesLedgerProps) {
  const filtering = p.status !== "all" || p.search.trim() !== "";
  return (
    <section className="vp-sheet overflow-hidden" aria-label="Lista de vendas">
      <div className="flex flex-col gap-3 px-5 pb-4 pt-5 sm:px-7 sm:pt-6 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-4">
        <FilterPills className="lg:shrink-0" label="Filtrar por status" value={p.status} options={SALES_STATUS_OPTIONS} onChange={p.onStatus} />
        <SearchField label="Buscar vendas" value={p.search} onChange={p.onSearch} placeholder="Cliente, e-mail ou ID da venda" className="lg:ml-auto lg:min-w-[260px] lg:max-w-[340px] lg:flex-1" />
      </div>

      {p.error ? (
        <div className="border-t border-border">
          <EmptyPanel
            icon={<FileText className="h-7 w-7 text-destructive" />}
            title="Não foi possível carregar as vendas"
            text="Verifique sua conexão e tente de novo. Seus dados continuam seguros."
            action={<button type="button" onClick={p.onRetry} className="vp-cta">Tentar novamente</button>}
          />
        </div>
      ) : p.loading && p.items.length === 0 ? (
        <div className="space-y-3 border-t border-border px-5 py-5 sm:px-7">{Array.from({ length: 6 }, (_, i) => <div key={i} className="vp-skel h-14" />)}</div>
      ) : p.items.length === 0 ? (
        <div className="border-t border-border">
          {filtering ? (
            <EmptyPanel
              icon={<SearchIcon className="h-7 w-7" />}
              title="Nenhuma venda encontrada"
              text="Troque o filtro, o período ou o termo da busca para ver outras vendas."
              action={<button type="button" onClick={() => { p.onStatus("all"); p.onSearch(""); }} className="vp-ghost">Limpar filtros</button>}
            />
          ) : (
            <EmptyPanel
              title="Nenhuma venda neste período"
              text="Quando alguém pagar por um link ou checkout seu, a venda aparece aqui na hora."
              action={<button type="button" onClick={p.onCreateLink} className="vp-cta">Criar link de pagamento</button>}
            />
          )}
        </div>
      ) : (
        <div role="table" aria-label="Vendas" aria-busy={p.loading} className={cn(p.loading && "opacity-70 transition-opacity")}>
          <div role="row" className={cn("hidden border-y border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground lg:grid lg:items-center lg:gap-4", COLS)}>
            <span role="columnheader">Cliente</span>
            <span role="columnheader">Método</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Quando</span>
            <span role="columnheader" className="text-right">Valor</span>
          </div>
          <ul className="border-t border-border lg:border-t-0">
            {p.items.map((t) => {
              const st = deriveTransactionStatus(t);
              const ok = isApprovedTransaction(st);
              const meta = txStatusMeta(st);
              const product = t.product_id ? p.products[t.product_id] : undefined;
              const name = t.customer_name || product || "Cliente";
              return (
                <li key={t.id} role="row" className="border-t border-border first:border-t-0">
                  <button onClick={() => p.onOpen(t)} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 px-5 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-7 lg:gap-4", COLS)}>
                    <span role="cell" className="flex min-w-0 items-center gap-3.5">
                      <Avatar name={name} ok={ok} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14.5px] font-bold text-foreground">{name}</span>
                          {t.is_simulated && <span title="Venda de teste: não entra no saldo nem nos totais" className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Simulação</span>}
                        </span>
                        <span className="block truncate text-[12.5px] text-muted-foreground">
                          <span className="lg:hidden">{meta.label}, </span>{product ?? "Sem produto"}
                        </span>
                      </span>
                    </span>

                    <span role="cell" className="hidden lg:flex"><MethodMark method={t.payment_method} /></span>
                    <span role="cell" className="hidden lg:flex"><StatusPill label={meta.label} tone={meta.tone} /></span>
                    <span role="cell" className="hidden text-[13.5px] text-muted-foreground lg:block">{whenLabel(t.created_at)}</span>

                    <span role="cell" className="text-right">
                      <Money value={Number(t.amount)} hidden={p.hidden} signed={ok} className={cn("block text-[15px] font-extrabold tracking-[-0.02em]", ok ? "vp-green-ink" : "text-muted-foreground")} centsClassName="opacity-70" />
                      <span className="block text-[12px] text-muted-foreground">
                        <span className="lg:hidden">{whenLabel(t.created_at)}</span>
                        {ok && t.net_amount != null && <span className="hidden lg:inline">{p.hidden ? "líquido ••••" : `líquido ${Number(t.net_amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!p.error && <Pager page={p.page} pageSize={p.pageSize} total={p.total} onPage={p.onPage} loading={p.loading} />}
    </section>
  );
}
