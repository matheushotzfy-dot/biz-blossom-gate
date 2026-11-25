import { Copy, Info, Timer } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { TransactionTimeline } from "@/components/transactions/TransactionTimeline";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { brl } from "@/features/admin-finance/types";
import { fmtDateTime } from "@/features/admin-finance/format";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { cn, deriveTransactionStatus, isApprovedTransaction } from "@/lib/utils";
import { methodLabel, type Tx } from "./transactionsModel";

const copy = (value: string, label: string) => {
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copiado`),
    () => toast.error("Não foi possível copiar. Selecione o texto e copie manualmente."),
  );
};

function Field({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-3 border-b border-border/40 py-2 last:border-b-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-start gap-1.5 text-[13px] text-foreground">
        <span className={cn("min-w-0 flex-1 break-words", mono && "font-mono text-[12px]")}>{value}</span>
        {copyable && value !== "—" && (
          <button type="button" data-no-fluid onClick={() => copy(value, label)} aria-label={`Copiar ${label}`} style={{ minHeight: 0 }} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground">
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </dd>
    </div>
  );
}

interface Props {
  tx: Tx | null;
  onClose: () => void;
  nameOf: (userId: string) => string;
  productOf: (productId: string | null) => string;
  onNavigate?: (tab: string) => void;
}

export function TransactionSheet({ tx, onClose, nameOf, productOf, onNavigate }: Props) {
  const fee = tx && Number(tx.amount) > 0 ? (Number(tx.fee_amount) / Number(tx.amount)) * 100 : 0;
  return (
    <Sheet open={!!tx} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-background p-0 sm:max-w-xl">
        {tx && (
          <>
            <SheetHeader className="border-b border-border bg-muted/30 px-5 py-4 text-left">
              <SheetTitle className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                Transação <span className="font-mono text-[12.5px] font-medium text-muted-foreground">#{tx.id.slice(0, 8)}</span>
                <StatusBadge status={deriveTransactionStatus(tx)} />
              </SheetTitle>
              <SheetDescription>{fmtDateTime(tx.created_at)} · {nameOf(tx.user_id)}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-[repeat(3,minmax(0,1fr))]">
                <div className="col-span-2 bg-card p-3 sm:col-span-1">
                  <p className="text-[12px] text-muted-foreground">Valor</p>
                  <p className="mt-1 text-[15px] font-bold tabular-nums text-foreground">{brl(tx.amount)}</p>
                  {Number(tx.discount_amount || 0) > 0 && <p className="mt-0.5 text-[11.5px] text-muted-foreground">−{brl(tx.discount_amount)} de cupom</p>}
                </div>
                <div className="bg-card p-3">
                  <p className="text-[12px] text-muted-foreground">Taxa</p>
                  <p className="mt-1 text-[15px] font-bold tabular-nums text-warning">{brl(tx.fee_amount)}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">{fee.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do valor</p>
                </div>
                <div className="bg-card p-3">
                  <p className="text-[12px] text-muted-foreground">Líquido</p>
                  <p className="mt-1 text-[15px] font-bold tabular-nums text-success">{brl(tx.net_amount)}</p>
                </div>
              </div>

              {Number(tx.retained_amount || 0) > 0 && (
                <div className={cn("flex items-start gap-2 rounded-xl border p-3 text-[13px]", tx.retention_released ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10")}>
                  <Timer className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">{tx.retention_released ? "Valor retido já liberado" : "Valor retido"}</p>
                    <p className="text-foreground/80">{brl(tx.retained_amount)}{tx.retained_until ? ` · até ${fmtDateTime(tx.retained_until)}` : ""}</p>
                  </div>
                </div>
              )}

              <PremiumPanel title="Cliente">
                <dl>
                  <Field label="Nome" value={tx.customer_name || "—"} />
                  <Field label="E-mail" value={tx.customer_email || "—"} copyable />
                  <Field label="CPF/CNPJ" value={tx.customer_document || "—"} mono copyable />
                  <Field label="Telefone" value={tx.customer_phone || "—"} />
                  <Field label="Endereço" value={tx.customer_address || "—"} />
                </dl>
              </PremiumPanel>

              <PremiumPanel title="Pagamento">
                <dl>
                  <Field label="Código" value={tx.id} mono copyable />
                  {tx.external_id && <Field label="Código externo" value={tx.external_id} mono copyable />}
                  <Field label="Método" value={methodLabel(tx.payment_method)} />
                  <Field label="Seller" value={nameOf(tx.user_id)} />
                  <Field label="Produto" value={productOf(tx.product_id)} />
                  <Field label="Origem" value={tx.source || "checkout"} />
                  {tx.api_key_id && <Field label="Chave de API" value={tx.api_key_id} mono copyable />}
                  {tx.coupon_id && <Field label="Cupom" value={`${tx.coupon_id.slice(0, 8)} · −${brl(tx.discount_amount)}`} mono />}
                  {tx.checkout_session_id && <Field label="Sessão" value={tx.checkout_session_id} mono copyable />}
                  {tx.pix_expires_at && <Field label="Pix expira" value={fmtDateTime(tx.pix_expires_at)} />}
                </dl>
              </PremiumPanel>

              <PremiumPanel title="Histórico da transação">
                <TransactionTimeline transactionId={tx.id} variant="admin" />
              </PremiumPanel>

              <Accordion type="single" collapsible>
                <AccordionItem value="raw" className="rounded-xl border border-border bg-card px-3">
                  <AccordionTrigger className="py-2.5 text-[12.5px] font-semibold text-muted-foreground hover:no-underline">Dados completos (JSON)</AccordionTrigger>
                  <AccordionContent>
                    <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/30 p-3 font-mono text-[11px] text-foreground/80">{JSON.stringify(tx, null, 2)}</pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {isApprovedTransaction(tx.status) && (
                <p role="note" className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-[12.5px] text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  Estornar pagamento fica indisponível até existir uma adquirente configurada. Pedidos de reembolso dos sellers continuam na aba Reembolsos.
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {onNavigate && (tx.status === "chargeback" || tx.status === "chargedback") && <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("chargeback")}>Abrir em Chargeback</Button>}
                {onNavigate && (isApprovedTransaction(tx.status) || tx.status === "refunded" || tx.status === "partially_refunded") && <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("refunds")}>Abrir em Reembolsos</Button>}
                <Button type="button" variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => copy(tx.id, "Código")}><Copy className="h-3.5 w-3.5" /> Copiar código</Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
