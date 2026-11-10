import { ArrowDownLeft, ChevronRight, CreditCard, RotateCcw, ShieldAlert, Clock3, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { cn, deriveTransactionStatus, isApprovedTransaction } from "@/lib/utils";
import { PixLogoMark } from "@/components/icons/PixLogoMark";
import { Money } from "./Money";

type Tx = Tables<"transactions">;

export interface StatementProps { items: Tx[]; products: Record<string, string>; hidden: boolean; loading: boolean; onOpen: (tx: Tx) => void }

const SP = "America/Sao_Paulo";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: SP });

function dayTitle(key: string): string {
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: SP });
  const y = new Date(Date.now() - 86400000).toLocaleDateString("pt-BR", { timeZone: SP });
  if (key === today) return "Hoje";
  if (key === y) return "Ontem";
  return key;
}

function describe(status: string): { label: string; tone: string; Icon: typeof Clock3 } {
  if (isApprovedTransaction(status)) return { label: "Venda aprovada", tone: "text-primary", Icon: ArrowDownLeft };
  if (status === "pending" || status === "processing") return { label: "Aguardando pagamento", tone: "text-warning", Icon: Clock3 };
  if (status === "refunded" || status === "partially_refunded") return { label: "Reembolso", tone: "text-muted-foreground", Icon: RotateCcw };
  if (["med", "mediation", "dispute", "disputed", "chargeback", "med_lost"].includes(status)) return { label: status === "chargeback" ? "Chargeback" : "MED Pix · em análise", tone: "text-destructive", Icon: ShieldAlert };
  return { label: status === "expired" ? "Expirada" : "Não concluída", tone: "text-muted-foreground", Icon: XCircle };
}

/** Extrato agrupado por dia, no padrão de app de banco. */
export function Statement({ items, products, hidden, loading, onOpen }: StatementProps) {
  const groups = new Map<string, Tx[]>();
  items.forEach((t) => { const k = dayKey(t.created_at); groups.set(k, [...(groups.get(k) ?? []), t]); });

  return (
    <section className="vp-panel" aria-label="Últimas movimentações">
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <h2 className="text-[15px] font-bold text-foreground">Extrato</h2>
        <Link to="/vendas" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline">Ver tudo<ChevronRight className="h-3.5 w-3.5" /></Link>
      </header>

      {loading ? (
        <div className="space-y-3 px-5 pb-5">{Array.from({ length: 5 }, (_, i) => <div key={i} className="vp-skel h-12" />)}</div>
      ) : items.length === 0 ? (
        <div className="px-5 pb-8 pt-4 text-center">
          <p className="text-[13.5px] font-semibold text-foreground">Sem movimentações ainda</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Suas vendas aparecem aqui assim que forem criadas.</p>
        </div>
      ) : (
        <div className="pb-2">
          {[...groups.entries()].map(([k, list]) => (
            <div key={k}>
              <p className="bg-muted/50 px-5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{dayTitle(k)}</p>
              <ul>
                {list.map((t) => {
                  const st = deriveTransactionStatus(t);
                  const d = describe(st);
                  const ok = isApprovedTransaction(st);
                  const isPix = (t.payment_method || "").toLowerCase().includes("pix");
                  return (
                    <li key={t.id}>
                      <button onClick={() => onOpen(t)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/60">
                        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                          {isPix ? <PixLogoMark className="h-[18px] w-[18px]" /> : <CreditCard className="h-[18px] w-[18px] text-info" />}
                          <span className={cn("absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-card", d.tone)}><d.Icon className="h-3 w-3" strokeWidth={2.6} /></span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-foreground">{d.label}</span>
                          <span className="block truncate text-[12px] text-muted-foreground">
                            {(t.product_id && products[t.product_id]) || t.customer_name || "Venda"} · {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: SP })}
                            {t.is_simulated && " · Simulação"}
                          </span>
                        </span>
                        <Money value={Number(t.amount)} hidden={hidden} signed={ok} className={cn("text-[14px] font-bold", ok ? "text-primary" : "text-muted-foreground")} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
