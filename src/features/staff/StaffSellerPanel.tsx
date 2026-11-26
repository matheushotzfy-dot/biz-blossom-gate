import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { IdCard, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogBody, DialogHead, dialogBox } from "@/components/seller-ui/form";
import { KycReviewPanel, type Decision } from "@/features/kyc/KycReviewPanel";
import { kycReviewKey } from "@/features/kyc/useKycReview";
import { reviewActionError } from "@/features/kyc/kycReviewModel";
import { isKycPending, type StaffActionFlags } from "./staffActions";

export interface StaffPanelSeller { seller_user_id: string; full_name: string | null; email: string | null; account_status: string | null }

const errMsg = (m: string) =>
  /below owner minimum/i.test(m) ? "Taxa abaixo do mínimo definido pelo dono"
  : /not pending/i.test(m) ? "Este seller não está aguardando análise"
  : /reason required/i.test(m) ? "Informe um motivo com no mínimo 5 caracteres"
  : /invalid fees/i.test(m) ? "Valores de taxa inválidos"
  : "Ação não permitida para sua conta";

/** Seller actions for staff; every action is re-validated server-side (permission + active assignment). */
export function StaffSellerPanel({ seller, flags, onClose, onChanged }: { seller: StaffPanelSeller; flags: StaffActionFlags; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const id = seller.seller_user_id;
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [fees, setFees] = useState({ p: "", f: "", w: "" });
  const [note, setNote] = useState("");

  const limits = useQuery({ queryKey: ["my-fee-limits"], enabled: flags.editFees, queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    return (await supabase.from("staff_fee_limits").select("min_transaction_percentage,min_transaction_fixed,min_withdrawal_fee").eq("user_id", u.user?.id ?? "").maybeSingle()).data;
  } });
  const notes = useQuery({ queryKey: ["staff-notes", id], enabled: flags.editNotes, queryFn: async () =>
    (await supabase.from("seller_notes").select("id,content,created_at").eq("seller_user_id", id).order("created_at", { ascending: false }).limit(50)).data ?? [] });

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) { toast.error(errMsg(error.message)); return false; } toast.success(ok); return true; }
    finally { setBusy(false); }
  };

  // A decisão sai da ficha de análise (documentos + cadastro); o servidor confere permissão, carteira e status.
  const decide = async (kind: Decision, why: string): Promise<string | null> => {
    const approve = kind === "approve";
    const { error } = await supabase.rpc("staff_review_kyc", { _seller: id, _approve: approve, _reason: approve ? undefined : why });
    if (error) return reviewActionError(error);
    toast.success(approve ? "Verificação aprovada. O seller foi avisado." : "Verificação reprovada. O seller recebeu o motivo.");
    setReviewing(false);
    void qc.invalidateQueries({ queryKey: kycReviewKey(id), refetchType: "none" });
    onChanged();
    return null;
  };
  const saveFees = async () => {
    const [p, f, w] = [fees.p, fees.f, fees.w].map((v) => Number(v.replace(",", ".")));
    if (![p, f, w].every((v) => Number.isFinite(v) && v >= 0) || p > 100 || f > 1_000_000 || w > 1_000_000 || [fees.p, fees.f, fees.w].some((v) => v.trim() === "")) { toast.error("Valores de taxa inválidos"); return; }
    if (await run(() => supabase.rpc("set_staff_seller_fees", { _seller: id, _percentage: p, _fixed: f, _withdrawal: w }), "Taxas atualizadas")) setFees({ p: "", f: "", w: "" });
  };
  const addNote = async () => {
    const content = note.trim();
    if (content.length < 2 || content.length > 2000) { toast.error("Observação deve ter entre 2 e 2000 caracteres"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (await run(() => supabase.from("seller_notes").insert({ seller_user_id: id, author_user_id: u.user?.id ?? "", content }), "Observação salva")) { setNote(""); void qc.invalidateQueries({ queryKey: ["staff-notes", id] }); }
  };

  const pending = isKycPending(seller.account_status);
  const none = !flags.approveKyc && !flags.rejectKyc && !flags.editFees && !flags.editNotes;

  return (
    <div className="space-y-4 border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{seller.full_name || "Sem nome"}</h3><p className="truncate text-xs text-muted-foreground">{seller.email || id}</p><p className="mt-1 text-xs">Status: {seller.account_status ?? "—"}</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar ficha"><X className="h-4 w-4" /></Button></div>
      {none && <p className="text-xs text-muted-foreground">Sua conta não tem permissões de ação para sellers.</p>}
      {(flags.approveKyc || flags.rejectKyc) && (
        <section className="space-y-2 border-t border-border pt-3"><h4 className="text-xs font-semibold uppercase text-muted-foreground">KYC</h4>
          {pending ? (
            <Button size="sm" className="gap-1.5" onClick={() => setReviewing(true)}><IdCard className="h-3.5 w-3.5" />Analisar documentos</Button>
          ) : (
            <p className="text-xs text-muted-foreground">{seller.account_status === "pending" ? "O seller ainda não enviou os documentos para análise." : "Nenhuma análise pendente."}</p>
          )}
          <Dialog open={reviewing} onOpenChange={setReviewing}>
            <DialogContent className={dialogBox("wide")}>
              <DialogHead icon={<IdCard className="h-5 w-5" />} title={seller.full_name || "Verificação"} subtitle={seller.email || "Verificação de identidade"} />
              <DialogBody>{reviewing && <KycReviewPanel sellerId={id} onDecide={decide} stickyDecision />}</DialogBody>
            </DialogContent>
          </Dialog>
        </section>)}
      {flags.editFees && (
        <section className="space-y-2 border-t border-border pt-3"><h4 className="text-xs font-semibold uppercase text-muted-foreground">Taxas</h4>
          {limits.data ? <p className="text-xs text-muted-foreground">Mínimo: {limits.data.min_transaction_percentage}% + R$ {limits.data.min_transaction_fixed} · saque R$ {limits.data.min_withdrawal_fee}</p> : <p className="text-xs text-muted-foreground">Mínimo não configurado pelo dono — alterações serão recusadas.</p>}
          <div className="grid grid-cols-3 gap-2">
            {([["p", "%"], ["f", "Fixa R$"], ["w", "Saque R$"]] as const).map(([k, l]) => <div key={k} className="space-y-1"><Label htmlFor={`fee-${k}`} className="text-xs">{l}</Label><Input id={`fee-${k}`} inputMode="decimal" value={fees[k]} onChange={(e) => setFees((s) => ({ ...s, [k]: e.target.value }))} /></div>)}
          </div>
          <Button size="sm" disabled={busy} onClick={() => void saveFees()}>Salvar taxas</Button>
        </section>)}
      {flags.editNotes && (
        <section className="space-y-2 border-t border-border pt-3"><h4 className="text-xs font-semibold uppercase text-muted-foreground">Observações</h4>
          <Textarea aria-label="Nova observação" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" disabled={busy} onClick={() => void addNote()}>Adicionar</Button>
          <div className="max-h-56 space-y-2 overflow-y-auto">{(notes.data ?? []).map((n) => <div key={n.id} className="border border-border p-2 text-xs"><p className="whitespace-pre-wrap break-words">{n.content}</p><p className="mt-1 text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p></div>)}</div>
        </section>)}
    </div>
  );
}
