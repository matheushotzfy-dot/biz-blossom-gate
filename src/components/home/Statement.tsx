import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { cn, deriveTransactionStatus, isApprovedTransaction } from "@/lib/utils";
import { Money } from "./Money";
import { Avatar, MethodMark, StatusPill } from "@/components/seller-ui/tx";
import { isPixMethod, txStatusMeta, whenLabel } from "@/components/seller-ui/txMeta";

type Tx = Tables<"transactions">;
export interface StatementProps {
  items: Tx[];
  products: Record<string, string>;
  hidden: boolean;
  loading: boolean;
  onOpen: (tx: Tx) => void;
  onCreateLink: () => void;
}

const COLS = "md:grid-cols-[minmax(0,1.7fr)_110px_170px_150px_minmax(120px,0.8fr)]";

/** Extrato recente: livro-razão aberto, com colunas no desktop e duas linhas no celular. */
export function Statement({ items, products, hidden, loading, onOpen, onCreateLink }: StatementProps) {
  return (
    <section className="vp-sheet overflow-hidden" aria-label="Transações recentes">
      <header className="flex items-center justify-between gap-3 px-6 pb-4 pt-6 sm:px-7">
        <h2 className="whitespace-nowrap text-[19px] font-extrabold tracking-[-0.025em] text-foreground">Transações recentes</h2>
        <Link to="/vendas" className="vp-green-ink inline-flex items-center gap-1 text-[13.5px] font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="whitespace-nowrap"><span className="sm:hidden">Ver todas</span><span className="hidden sm:inline">Ver todas as vendas</span></span><ChevronRight className="h-4 w-4" />
        </Link>
      </header>

      {loading ? (
        <div className="space-y-3 px-6 pb-6 sm:px-7">{Array.from({ length: 5 }, (_, i) => <div key={i} className="vp-skel h-14" />)}</div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center border-t border-border px-6 py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent"><VenxpayLogo size={34} plate={false} /></span>
          <p className="mt-5 text-[17px] font-extrabold tracking-[-0.02em] text-foreground">Suas vendas aparecem aqui</p>
          <p className="mt-1 max-w-[360px] text-[14px] leading-relaxed text-muted-foreground">Crie um link de pagamento e receba o primeiro Pix ou cartão. O saldo atualiza na hora.</p>
          <button onClick={onCreateLink} className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-[14px] font-bold text-primary-foreground transition-[filter,transform] hover:brightness-105 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card">
            Criar link de pagamento
          </button>
        </div>
      ) : (
        <div role="table" aria-label="Últimas transações">
          <div role="row" className={cn("hidden border-y border-border bg-muted/50 px-7 py-2.5 text-[12.5px] font-semibold text-muted-foreground md:grid md:items-center md:gap-4", COLS)}>
            <span role="columnheader">Cliente</span>
            <span role="columnheader">Método</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Quando</span>
            <span role="columnheader" className="text-right">Valor</span>
          </div>
          <ul>
            {items.slice(0, 7).map((t) => {
              const st = deriveTransactionStatus(t);
              const ok = isApprovedTransaction(st);
              const meta = txStatusMeta(st);
              const product = t.product_id ? products[t.product_id] : undefined;
              const name = t.customer_name || product || "Cliente";
              const pix = isPixMethod(t.payment_method);
              return (
                <li key={t.id} role="row" className="border-t border-border first:border-t-0 md:first:border-t">
                  <button onClick={() => onOpen(t)} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 px-6 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-7 md:gap-4", COLS)}>
                    <span role="cell" className="flex min-w-0 items-center gap-3.5">
                      <Avatar name={name} ok={ok} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14.5px] font-bold text-foreground">{name}</span>
                          {t.is_simulated && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Simulação</span>}
                        </span>
                        <span className="block truncate text-[12.5px] text-muted-foreground md:hidden">{meta.label}, {pix ? "Pix" : "Cartão"}</span>
                        {t.customer_name && product && <span className="hidden truncate text-[12.5px] text-muted-foreground md:block">{product}</span>}
                      </span>
                    </span>

                    <span role="cell" className="hidden md:flex"><MethodMark method={t.payment_method} /></span>
                    <span role="cell" className="hidden md:flex">
                      <StatusPill label={meta.label} tone={meta.tone} />
                    </span>
                    <span role="cell" className="hidden text-[13.5px] text-muted-foreground md:block">{whenLabel(t.created_at)}</span>

                    <span role="cell" className="text-right">
                      <Money value={Number(t.amount)} hidden={hidden} signed={ok} className={cn("block text-[15px] font-extrabold tracking-[-0.02em]", ok ? "vp-green-ink" : "text-muted-foreground")} centsClassName="opacity-70" />
                      <span className="block text-[12px] text-muted-foreground md:hidden">{whenLabel(t.created_at)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
