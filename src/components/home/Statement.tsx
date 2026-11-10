import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { cn, deriveTransactionStatus, isApprovedTransaction } from "@/lib/utils";
import { Money } from "./Money";

type Tx = Tables<"transactions">;
export interface StatementProps { items: Tx[]; products: Record<string, string>; hidden: boolean; loading: boolean; onOpen: (tx: Tx) => void }

const SP = "America/Sao_Paulo";

function statusText(st: string, method: string | null): string {
  const m = (method || "").toLowerCase().includes("pix") ? "Pix" : "Cartão";
  if (isApprovedTransaction(st)) return `${m} recebido`;
  if (st === "pending" || st === "processing") return `${m} aguardando`;
  if (st === "refunded" || st === "partially_refunded") return "Reembolso";
  if (st === "chargeback") return "Chargeback";
  if (["med", "mediation", "dispute", "disputed", "med_lost"].includes(st)) return "MED Pix · em análise";
  return st === "expired" ? `${m} expirado` : "Não concluída";
}

function when(iso: string): string {
  const d = new Date(iso);
  const key = d.toLocaleDateString("pt-BR", { timeZone: SP });
  const t = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: SP });
  if (key === new Date().toLocaleDateString("pt-BR", { timeZone: SP })) return `Hoje, ${t}`;
  if (key === new Date(Date.now() - 864e5).toLocaleDateString("pt-BR", { timeZone: SP })) return `Ontem, ${t}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: SP }).replace(".", "")}, ${t}`;
}

const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "V";

/** Transações recentes no padrão de app de banco. */
export function Statement({ items, products, hidden, loading, onOpen }: StatementProps) {
  return (
    <section className="vp-glass flex flex-col p-6" aria-label="Transações recentes">
      <header className="flex items-center justify-between">
        <h2 className="text-[18px] font-bold text-foreground">Transações recentes</h2>
        <Link to="/vendas" className="inline-flex items-center gap-1.5 text-[13px] font-semibold vp-glow-text hover:underline">Ver todas<ArrowRight className="h-3.5 w-3.5" /></Link>
      </header>

      {loading ? (
        <div className="mt-5 space-y-4">{Array.from({ length: 5 }, (_, i) => <div key={i} className="vp-skel h-12" />)}</div>
      ) : items.length === 0 ? (
        <div className="grid flex-1 place-items-center py-12 text-center">
          <div>
            <p className="text-[14px] font-semibold text-foreground">Nenhuma transação ainda</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Assim que você vender, aparece aqui na hora.</p>
          </div>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {items.slice(0, 6).map((t) => {
            const st = deriveTransactionStatus(t);
            const ok = isApprovedTransaction(st);
            const name = t.customer_name || (t.product_id && products[t.product_id]) || "Cliente";
            return (
              <li key={t.id}>
                <button onClick={() => onOpen(t)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3.5 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/60">
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-bold", ok ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{initials(name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-foreground">{name}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{statusText(st, t.payment_method)}{t.is_simulated && " · Simulação"}</span>
                  </span>
                  <span className="text-right">
                    <Money value={Number(t.amount)} hidden={hidden} signed={ok} className={cn("block text-[14.5px] font-bold", ok ? "vp-glow-text" : "text-muted-foreground")} centsClassName="opacity-100 text-[1em]" />
                    <span className="block text-[11.5px] text-muted-foreground">{when(t.created_at)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
