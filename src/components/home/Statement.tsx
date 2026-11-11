import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { cn, deriveTransactionStatus, isApprovedTransaction } from "@/lib/utils";
import { Money } from "./Money";

type Tx = Tables<"transactions">;
export interface StatementProps { items: Tx[]; products: Record<string, string>; hidden: boolean; loading: boolean; onOpen: (tx: Tx) => void }

const SP = "America/Sao_Paulo";

function status(st: string): { text: string; tone: string } {
  if (isApprovedTransaction(st)) return { text: "Pago", tone: "vp-tag-ok" };
  if (st === "pending" || st === "processing") return { text: "Aguardando", tone: "vp-tag-wait" };
  if (st === "refunded" || st === "partially_refunded") return { text: "Reembolso", tone: "vp-tag-off" };
  if (st === "chargeback") return { text: "Chargeback", tone: "vp-tag-bad" };
  if (["med", "mediation", "dispute", "disputed", "med_lost"].includes(st)) return { text: "MED em análise", tone: "vp-tag-bad" };
  return { text: st === "expired" ? "Expirado" : "Não concluída", tone: "vp-tag-off" };
}

function when(iso: string): string {
  const d = new Date(iso);
  const key = d.toLocaleDateString("pt-BR", { timeZone: SP });
  const t = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: SP });
  if (key === new Date().toLocaleDateString("pt-BR", { timeZone: SP })) return t;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: SP })} ${t}`;
}

/** Livro de transações: linhas densas com hora, cliente, método, status e valor. */
export function Statement({ items, products, hidden, loading, onOpen }: StatementProps) {
  return (
    <section className="vp-desk flex flex-col" aria-label="Transações recentes">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="vp-label">Movimentações</h2>
        <Link to="/vendas" className="inline-flex items-center gap-1 text-[12.5px] font-semibold vp-glow-text hover:underline">Extrato completo<ArrowRight className="h-3.5 w-3.5" /></Link>
      </header>

      {loading ? (
        <div className="space-y-px p-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="vp-skel h-11" />)}</div>
      ) : items.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 py-14 text-center">
          <div>
            <p className="text-[13.5px] font-semibold text-foreground">Nenhuma movimentação ainda</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Cada venda aparece aqui assim que for registrada.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.slice(0, 8).map((t) => {
            const st = deriveTransactionStatus(t);
            const ok = isApprovedTransaction(st);
            const s = status(st);
            const pix = (t.payment_method || "").toLowerCase().includes("pix");
            const name = t.customer_name || "Cliente";
            const product = (t.product_id && products[t.product_id]) || "";
            return (
              <li key={t.id}>
                <button onClick={() => onOpen(t)} className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-muted/50">
                  <span className="text-[11.5px] text-muted-foreground vp-num">{when(t.created_at)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-foreground">{name}</span>
                    <span className="flex items-center gap-2 truncate text-[11.5px] text-muted-foreground">
                      <span className="font-semibold uppercase tracking-wider">{pix ? "Pix" : "Cartão"}</span>
                      {product && <span className="truncate">· {product}</span>}
                      {t.is_simulated && <span>· Simulação</span>}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Money value={Number(t.amount)} hidden={hidden} signed={ok} className={cn("text-[13.5px] font-semibold", ok ? "text-foreground" : "text-muted-foreground")} />
                    <span className={cn("vp-tag", s.tone)}>{s.text}</span>
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
