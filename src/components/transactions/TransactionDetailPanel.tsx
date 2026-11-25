import { useMemo, useRef, type ReactNode } from "react";
import { Copy, ExternalLink, MessageCircle, Undo2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogFoot, DialogHead, FormSection, GroupBox, dialogBox } from "@/components/seller-ui/form";
import { MethodMark, StatusPill } from "@/components/seller-ui/tx";
import { initials, txStatusMeta } from "@/components/seller-ui/txMeta";
import { copyText } from "@/components/seller-ui/copy";
import { TransactionTimeline } from "@/components/transactions/TransactionTimeline";
import type { Tables } from "@/integrations/supabase/types";
import { cn, deriveTransactionStatus, formatCurrency, isApprovedTransaction } from "@/lib/utils";
import { trackingParams } from "./detailMeta";

type Transaction = Tables<"transactions">;

interface TransactionDetailPanelProps {
  /** `null` fecha o painel (a última venda fica na tela só durante a animação de saída). */
  tx: (Transaction & { buyer_ip?: string | null }) | null;
  products: Record<string, string>;
  onClose: () => void;
  onRefund?: (tx: Transaction) => void;
  variant?: "seller" | "admin";
  seller?: { full_name?: string | null; email?: string | null; nickname?: string | null } | null;
}

const SP = "America/Sao_Paulo";
const dateTime = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: SP, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const dayOnly = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: SP, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const money = (n: number | null | undefined) => formatCurrency(Number(n ?? 0));

function Row({ label, children, tone }: { label: string; children: ReactNode; tone?: "warning" | "danger" | "ok" }) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3">
      <span className="shrink-0 pt-px text-[13.5px] text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 break-words text-right text-[14px] font-semibold text-foreground", tone === "warning" && "text-warning", tone === "danger" && "text-destructive", tone === "ok" && "text-primary")}>{children}</span>
    </div>
  );
}

function Money({ label, value, tone }: { label: string; value: string; tone?: "danger" | "ok" }) {
  return (
    <div className={cn("min-w-0 rounded-[16px] px-4 py-3.5", tone === "ok" ? "bg-accent" : "bg-muted/60")}>
      <p className={cn("text-[12.5px] font-semibold", tone === "ok" ? "text-accent-foreground" : "text-muted-foreground")}>{label}</p>
      <p className={cn("mt-1 truncate text-[17px] font-extrabold tabular-nums tracking-[-0.02em]", tone === "danger" ? "text-destructive" : tone === "ok" ? "text-accent-foreground" : "text-foreground")}>{value}</p>
    </div>
  );
}

/** Detalhe de uma venda: valores, cliente, origem e linha do tempo. Serve o painel do seller e o do admin (`variant`). */
export function TransactionDetailPanel({ tx, products, onClose, onRefund, variant = "seller", seller }: TransactionDetailPanelProps) {
  // guarda a última venda para o conteúdo não sumir enquanto o diálogo fecha
  const last = useRef(tx);
  if (tx) last.current = tx;
  const t = tx ?? last.current;
  const tracking = useMemo(() => trackingParams(t?.checkout_session_id), [t?.checkout_session_id]);
  if (!t) return null;

  const admin = variant === "admin";
  const name = t.customer_name || "Cliente";
  const product = t.product_id ? products[t.product_id] || "Produto removido" : "Venda avulsa";
  const status = deriveTransactionStatus(t);
  const meta = txStatusMeta(status);
  const phoneDigits = (t.customer_phone ?? "").replace(/\D/g, "");
  const whatsapp = phoneDigits.length >= 10 ? `https://wa.me/${phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`}` : null;
  const origin = t.checkout_session_id?.startsWith("http") ? t.checkout_session_id : null;
  const canRefund = !!onRefund && !admin && isApprovedTransaction(status);
  const refunded = Number(t.refunded_amount ?? 0);
  const retained = Number(t.retained_amount ?? 0);
  const feePercent = Number(t.fee_percent_amount ?? 0);
  const feeFixed = Number(t.fee_fixed_amount ?? 0);
  const acquirerCost = Number(t.acquirer_fee_amount ?? 0);
  const hasFooter = canRefund || !!whatsapp || !!origin;

  return (
    <Dialog open={!!tx} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={dialogBox("xl")}>
        <DialogHead
          icon={<span className="text-[15px] font-extrabold">{initials(name)}</span>}
          title={name}
          subtitle={[t.customer_email, dateTime(t.created_at)].filter(Boolean).join(" · ")}
          aside={<StatusPill label={meta.label} tone={meta.tone} />}
        />
        <DialogBody>
          <div aria-hidden className="sm:hidden"><StatusPill label={meta.label} tone={meta.tone} /></div>

          <section aria-label="Valores" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <p className="text-[13.5px] font-semibold text-muted-foreground">Valor da venda</p>
                <p className="mt-0.5 text-[34px] font-extrabold leading-none tabular-nums tracking-[-0.04em] text-foreground sm:text-[40px]">{money(t.amount)}</p>
              </div>
              <MethodMark method={t.payment_method} />
            </div>
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5">
              <Money label="Taxa" value={`− ${money(t.fee_amount)}`} tone="danger" />
              <Money label="Você recebe" value={money(t.net_amount)} tone="ok" />
            </div>
          </section>

          <FormSection title="Venda">
            <GroupBox>
              <Row label="Produto">{product}</Row>
              <Row label="Data">{dateTime(t.created_at)}</Row>
              {feePercent > 0 && <Row label="Taxa percentual">{money(feePercent)}</Row>}
              {feeFixed > 0 && <Row label="Taxa fixa">{money(feeFixed)}</Row>}
              {Number(t.discount_amount ?? 0) > 0 && <Row label="Desconto do cupom">{`− ${money(t.discount_amount)}`}</Row>}
              {refunded > 0 && <Row label="Já reembolsado" tone="warning">{`− ${money(refunded)}`}</Row>}
              {retained > 0 && !t.retention_released && (
                <Row label="Retido" tone="warning">{money(retained)}{t.retained_until ? ` · libera em ${dayOnly(t.retained_until)}` : ""}</Row>
              )}
              {admin && <Row label="Custo da adquirente">{money(acquirerCost)}</Row>}
              {admin && <Row label="Margem da taxa" tone="ok">{money(Number(t.fee_amount ?? 0) - acquirerCost)}</Row>}
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] text-muted-foreground">Código da venda</p>
                  <p className="mt-0.5 break-all font-mono text-[12.5px] text-foreground">{t.id}</p>
                </div>
                <button
                  type="button" onClick={() => { void copyText(t.id, "Código copiado"); }} aria-label="Copiar código da venda"
                  className="vp-r12 grid h-9 w-9 shrink-0 place-items-center rounded-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </GroupBox>
          </FormSection>

          <FormSection title="Cliente">
            <GroupBox>
              <Row label="Nome">{t.customer_name || "—"}</Row>
              <Row label="E-mail">{t.customer_email || "—"}</Row>
              <Row label="Telefone">{t.customer_phone || "—"}</Row>
              {t.customer_document && <Row label="CPF/CNPJ">{t.customer_document}</Row>}
              {admin && t.buyer_ip && <Row label="IP"><span className="font-mono text-[13px]">{t.buyer_ip}</span></Row>}
            </GroupBox>
          </FormSection>

          {admin && seller && (
            <FormSection title="Seller">
              <GroupBox>
                <Row label="Nome">{seller.full_name || seller.nickname || "—"}</Row>
                <Row label="E-mail">{seller.email || "—"}</Row>
                <Row label="ID"><span className="break-all font-mono text-[12px]">{t.user_id}</span></Row>
              </GroupBox>
            </FormSection>
          )}

          {tracking.length > 0 && (
            <FormSection title="Origem da venda" subtitle="Parâmetros de campanha guardados no link do checkout.">
              <GroupBox>
                {tracking.map(([key, value]) => <Row key={key} label={key}>{value}</Row>)}
              </GroupBox>
            </FormSection>
          )}

          <FormSection title={admin ? "Auditoria" : "Histórico da venda"}>
            <TransactionTimeline transactionId={t.id} variant={variant} />
          </FormSection>
        </DialogBody>

        {hasFooter && (
          <DialogFoot>
            {origin && (
              <a href={origin} target="_blank" rel="noopener noreferrer" className="vp-ghost !h-12 justify-center"><ExternalLink className="h-4 w-4" />Ver origem</a>
            )}
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="vp-ghost !h-12 justify-center"><MessageCircle className="h-4 w-4" />WhatsApp</a>
            )}
            {canRefund && (
              <button type="button" onClick={() => onRefund?.(t)} className="vp-cta vp-cta-danger !h-12 justify-center"><Undo2 className="h-4 w-4" />Reembolsar</button>
            )}
          </DialogFoot>
        )}
      </DialogContent>
    </Dialog>
  );
}
