import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, Undo2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { PremiumEmpty, PremiumPanel, PremiumSegmented } from "@/pages/admin/tabs/AdminPremium";
import { cn } from "@/lib/utils";
import { brl, rpcErrorMessage } from "./types";
import { useSensitiveConfirm } from "./useSensitiveConfirm";
import { ManualApprovalSettings } from "./ManualApprovalSettings";

export interface RefundRow {
  id: string; created_at: string; status: "pending_confirmation" | "confirmed" | "reverted";
  amount: number; debited_amount: number; reason: string; requested_role: string;
  decision_note: string | null; proof_ref: string | null; decided_at: string | null;
  transaction_id: string; tx_amount: number; payment_method: string | null;
  customer_name: string | null; customer_email: string | null; seller_name: string | null; seller_email: string | null;
}
type Status = RefundRow["status"];
type Outcome = "confirmed" | "reverted";
const PAGE = 100;

const STATUS_PILL: Record<Status, { label: string; cls: string }> = {
  pending_confirmation: { label: "Aguardando você", cls: "border-warning/40 bg-warning/10 text-warning" },
  confirmed: { label: "Devolução efetivada", cls: "border-success/40 bg-success/10 text-success" },
  reverted: { label: "Não efetivada · saldo devolvido", cls: "border-border bg-muted/40 text-muted-foreground" },
};
const ROLE_LABEL: Record<string, string> = { seller: "Seller", admin: "Suporte/Dono", manager: "Gerente", employee: "Funcionário" };
const METHOD_LABEL: Record<string, string> = { pix: "Pix", card: "Cartão", credit_card: "Cartão", boleto: "Boleto" };
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={cn("min-w-0", wide && "sm:col-span-2")}><dt className="text-[11.5px] font-medium text-muted-foreground/80">{label}</dt><dd className="mt-0.5 break-words text-[13px] text-foreground">{children}</dd></div>;
}

/** Owner queue: seller/support refunds already debited from the seller, waiting for manual confirmation. */
export default function RefundApprovalsTab() {
  const [status, setStatus] = useState<Status>("pending_confirmation");
  const [rows, setRows] = useState<RefundRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const [decide, setDecide] = useState<{ row: RefundRow; outcome: Outcome } | null>(null);
  const [note, setNote] = useState("");
  const [proof, setProof] = useState("");
  const [formError, setFormError] = useState("");
  const seq = useRef(0);
  const { confirm, dialog } = useSensitiveConfirm();

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setRows(null); setLoadError(null);
    const { data, error } = await supabase.rpc("admin_list_refund_requests", { _status: status, _limit: PAGE, _offset: 0 });
    if (mine !== seq.current) return; // o filtro mudou enquanto carregava: ignora a resposta velha
    if (error) { setLoadError(rpcErrorMessage(error)); return; }
    const res = (data as unknown as { rows?: RefundRow[]; total?: number } | null) ?? {};
    const list = res.rows ?? [];
    const count = res.total ?? list.length;
    setRows(list); setTotal(count);
    if (status === "pending_confirmation") setPendingTotal(count);
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const openDecision = (row: RefundRow, outcome: Outcome) => { setDecide({ row, outcome }); setNote(""); setProof(""); setFormError(""); };
  const closeDecision = () => { setDecide(null); setFormError(""); };

  const submit = () => {
    if (!decide) return;
    if (decide.outcome === "reverted" && note.trim().length < 5) { setFormError("Explique o motivo em pelo menos 5 caracteres."); return; }
    setFormError("");
    const { row, outcome } = decide;
    const desc = outcome === "confirmed"
      ? `Confirmar que ${brl(row.amount)} foi devolvido ao comprador.`
      : `Marcar como não efetivada: ${brl(row.debited_amount)} volta ao saldo do seller.`;
    confirm(desc, async () => {
      const { error } = await supabase.rpc("admin_decide_refund", { _request_id: row.id, _outcome: outcome, _note: note.trim() || undefined, _proof: proof.trim() || undefined });
      if (error) {
        const message = rpcErrorMessage(error);
        toast.error(message);
        if (message.includes("já decidido")) { closeDecision(); void load(); } // outra aba/pessoa decidiu antes
        return;
      }
      toast.success(outcome === "confirmed" ? "Devolução confirmada" : "Saldo devolvido ao seller");
      closeDecision(); void load();
    });
  };

  const copy = (text: string) => { void navigator.clipboard?.writeText(text).then(() => toast.success("Código copiado"), () => toast.error("Não foi possível copiar")); };

  return (
    <div className="space-y-6 animate-fade-in">
      <FinanceiroHero
        eyebrow="Financeiro · Aprovações"
        title="Pendentes de aprovação"
        subtitle="O valor do reembolso já foi descontado do seller. Confirme que a devolução ao comprador foi feita, ou marque como não efetivada para devolver o saldo ao seller."
        status={pendingTotal === null ? undefined : { tone: pendingTotal > 0 ? "warning" : "success", label: pendingTotal > 0 ? `${pendingTotal} aguardando você` : "Nada aguardando você", pulse: pendingTotal > 0 }}
      />

      <PremiumSegmented<Status>
        value={status}
        onChange={setStatus}
        options={[{ value: "pending_confirmation", label: "Pendentes" }, { value: "confirmed", label: "Efetivados" }, { value: "reverted", label: "Não efetivados" }]}
      />

      {loadError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-[12px] border border-destructive/30 bg-destructive/5 px-4 py-10 text-center">
          <p className="text-[13px] font-semibold text-destructive">Não foi possível carregar os reembolsos.</p>
          <p className="max-w-md text-[12px] text-muted-foreground">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Tentar de novo</Button>
        </div>
      ) : rows === null ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" /></div>
      ) : rows.length === 0 ? (
        <PremiumPanel>
          <PremiumEmpty icon={Receipt}
            title={status === "pending_confirmation" ? "Nenhum reembolso esperando você" : status === "confirmed" ? "Nenhuma devolução efetivada ainda" : "Nenhum reembolso não efetivado"}
            subtitle={status === "pending_confirmation" ? "Quando um seller ou o suporte pedir um reembolso, ele aparece aqui." : undefined} />
        </PremiumPanel>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-[12px] border border-border/60 bg-card p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-display text-[22px] font-semibold leading-none tracking-tight tabular-nums">{brl(r.amount)}</span>
                  <span className="text-[12.5px] text-muted-foreground">de {brl(r.tx_amount)} · {METHOD_LABEL[r.payment_method ?? ""] ?? r.payment_method ?? "—"}</span>
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold", STATUS_PILL[r.status].cls)}>{STATUS_PILL[r.status].label}</span>
                </div>
                <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2.5 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
                  <Field label="Seller">{r.seller_name || r.seller_email || "—"}{r.seller_name && r.seller_email ? <span className="block text-[12px] text-muted-foreground">{r.seller_email}</span> : null}</Field>
                  <Field label="Descontado do seller"><span className="tabular-nums">{brl(r.debited_amount)}</span></Field>
                  <Field label="Comprador">{r.customer_name || "—"}{r.customer_email ? <span className="block text-[12px] text-muted-foreground">{r.customer_email}</span> : null}</Field>
                  <Field label="Pedido por">{ROLE_LABEL[r.requested_role] ?? r.requested_role} em {when(r.created_at)}</Field>
                  <Field label="Motivo" wide>{r.reason}</Field>
                  {r.decision_note && <Field label="Sua decisão" wide>{r.decision_note}</Field>}
                  {r.proof_ref && <Field label="Comprovante" wide>{r.proof_ref}</Field>}
                </dl>
                <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  Venda {r.transaction_id.slice(0, 8)}…
                  <button type="button" onClick={() => copy(r.transaction_id)} aria-label="Copiar código da venda" className="rounded p-0.5 hover:text-primary"><Copy className="h-3 w-3" /></button>
                </p>
              </div>
              {r.status === "pending_confirmation" && (
                <div className="flex flex-col gap-2 sm:flex-row md:flex-col md:justify-start">
                  <Button size="sm" onClick={() => openDecision(r, "confirmed")} className="gap-1.5"><CheckCircle2 className="h-4 w-4" />Devolução efetivada</Button>
                  <Button size="sm" variant="outline" onClick={() => openDecision(r, "reverted")} className="gap-1.5"><Undo2 className="h-4 w-4" />Não efetivada</Button>
                </div>
              )}
            </article>
          ))}
          {total > rows.length && <p className="text-center text-[12px] text-muted-foreground">Mostrando os {rows.length} mais recentes de {total}. Decida estes para ver os próximos.</p>}
        </div>
      )}

      <Dialog open={!!decide} onOpenChange={(o) => { if (!o) closeDecision(); }}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle>{decide?.outcome === "confirmed" ? "Confirmar devolução ao comprador" : "Marcar como não efetivada"}</DialogTitle>
            <DialogDescription>
              {decide && (decide.outcome === "confirmed"
                ? `${brl(decide.row.amount)} para ${decide.row.customer_name || decide.row.customer_email || "o comprador"}. Depois disso o pedido sai da fila.`
                : `${brl(decide.row.debited_amount)} volta ao saldo de ${decide.row.seller_name || decide.row.seller_email || "o seller"} e a venda deixa de constar como reembolsada.`)}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 px-5 py-4" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {decide?.outcome === "confirmed" && (
              <div className="space-y-1"><Label htmlFor="rf-proof" className="text-[12px] font-medium text-muted-foreground">Comprovante ou ID do estorno (opcional)</Label><Input id="rf-proof" maxLength={500} value={proof} onChange={(e) => setProof(e.target.value)} /></div>
            )}
            <div className="space-y-1">
              <Label htmlFor="rf-note" className="text-[12px] font-medium text-muted-foreground">{decide?.outcome === "reverted" ? "Motivo (obrigatório)" : "Observação (opcional)"}</Label>
              <Textarea id="rf-note" maxLength={1000} value={note} onChange={(e) => { setNote(e.target.value); if (formError) setFormError(""); }} aria-invalid={!!formError} />
            </div>
            {formError && <p role="alert" className="text-[12.5px] font-medium text-destructive">{formError}</p>}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={closeDecision}>Cancelar</Button>
              <Button type="submit">Continuar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ManualApprovalSettings />
      {dialog}
    </div>
  );
}
