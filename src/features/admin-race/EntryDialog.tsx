import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Pin, UserRound, UserRoundX } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceGrid, DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { maskBRL, parseBRL, toMaskedBRL } from "@/components/seller-ui/money";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import type { SellerHit } from "@/features/admin-referrals/referralsModel";
import { SellerPicker } from "@/features/admin-settings/SellerPicker";
import { friendlyError } from "@/lib/friendlyError";
import { callRpc } from "./raceApi";
import { LIMITS, brl2, entryErrors, reaisToCents, type EntryForm, type EntryItem } from "./raceModel";

const EMPTY: EntryForm = { mode: "account", name: "", revenue: "", sales: "", reason: "" };

const fromEntry = (e: EntryItem): EntryForm => ({
  mode: e.seller_id ? "account" : "fictional", name: e.display_name, revenue: toMaskedBRL(e.revenue_cents / 100), sales: String(e.sales_count), reason: "",
});

/**
 * Valor fixo no ranking. Com conta, SUBSTITUI o faturamento real do seller na corrida; sem conta, cria um participante
 * que os sellers veem como pessoa. Muda quem ganha: pede motivo (vai para a auditoria) e a senha de novo.
 */
export function EntryDialog({ entry, raceId, raceTitle, open, onClose, onDone }: {
  entry: EntryItem | null; raceId: string; raceTitle: string; open: boolean; onClose: () => void; onDone: () => void;
}) {
  const creating = entry === null;
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [f, setF] = useState<EntryForm>(EMPTY);
  const [seller, setSeller] = useState<SellerHit | null>(null);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setF(entry ? fromEntry(entry) : EMPTY); setSeller(null); setTouched(false); setServerError(null);
  }, [open, entry]);

  const errors = entryErrors(f, creating, !!seller);
  const err = (k: keyof typeof errors) => (touched ? errors[k] ?? null : null);
  const cents = reaisToCents(parseBRL(f.revenue));
  const linked = creating ? f.mode === "account" : !!entry?.seller_id;

  const save = useMutation({
    mutationFn: () => callRpc("admin_save_race_entry", {
      _id: entry?.id ?? null, _race_id: raceId, _seller_id: creating && f.mode === "account" ? seller?.user_id ?? null : null,
      _display_name: f.name.trim(), _avatar_url: entry?.avatar_url ?? null, _revenue_cents: cents, _sales_count: f.sales.trim() === "" ? 0 : Number(f.sales), _reason: f.reason.trim(),
    }),
    onSuccess: () => { toast.success(creating ? "Valor fixo adicionado ao ranking." : "Valor fixo atualizado."); onDone(); onClose(); },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível salvar. Nada mudou.")),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (Object.keys(errors).length > 0) return;
    const who = f.name.trim() || seller?.name || "o seller";
    const what = linked
      ? `Fixar ${brl2(cents)} para ${who} no ranking de “${raceTitle}”. O ranking passa a usar este valor no lugar do faturamento real dele na corrida.`
      : `Colocar “${who}” no ranking de “${raceTitle}” com ${brl2(cents)}. Os sellers vão ver essa pessoa como se fosse real, e ela entra na disputa pelos prêmios.`;
    sensitive.confirm(`${what} Isso pode mudar quem recebe os prêmios.`, async () => { await save.mutateAsync().catch(() => undefined); });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !save.isPending) onClose(); }}>
      <DialogContent className={dialogBox("lg")}>
        <DialogHead icon={<Pin className="h-5 w-5" />} title={creating ? "Novo valor fixo" : "Editar valor fixo"}
          subtitle={linked ? "O ranking usa este valor no lugar do faturamento real do seller." : "Participante sem conta: aparece no ranking como qualquer outro."} />
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
          <DialogBody>
            {creating ? (
              <ChoiceGrid<EntryForm["mode"]> label="Quem entra no ranking" value={f.mode} onChange={(mode) => setF((p) => ({ ...p, mode }))}
                options={[
                  { value: "account", label: "Um seller da plataforma", description: "Troca o faturamento real dele", icon: UserRound },
                  { value: "fictional", label: "Alguém sem conta", description: "Aparece como participante", icon: UserRoundX },
                ]} />
            ) : entry?.seller ? (
              <div className="rounded-[14px] bg-muted/40 px-4 py-3 text-[13.5px]">
                <p className="font-semibold text-foreground">{entry.seller.name ?? "Seller"}</p>
                {entry.seller.email && <p className="text-muted-foreground">{entry.seller.email}</p>}
                <p className="mt-1 text-muted-foreground">Faturamento real na corrida: {brl2(entry.real_revenue_cents)}</p>
              </div>
            ) : null}

            {creating && f.mode === "account" && <SellerPicker id="entry-seller" value={seller} onChange={setSeller} error={err("seller")} />}

            {!linked && (
              <p role="note" className="flex items-start gap-2.5 rounded-[14px] bg-warning/10 px-4 py-3 text-[13.5px] leading-relaxed text-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <span>Os sellers veem esta pessoa no ranking como se fosse real. Se ela ficar numa posição com prêmio, não existe conta para receber.</span>
              </p>
            )}

            <FormField id="entry-name" label="Nome exibido" hint={linked ? "Em branco, usa o nome do seller." : "Como aparece no ranking."} error={err("name")}>
              <input id="entry-name" className="vp-field" autoComplete="off" maxLength={LIMITS.entryName} value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} aria-invalid={err("name") ? true : undefined} />
            </FormField>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
              <FormField id="entry-revenue" label="Faturamento" hint="O valor que o ranking mostra." error={err("revenue")}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted-foreground">R$</span>
                  <input id="entry-revenue" className="vp-field tabular-nums" style={{ paddingLeft: 48 }} inputMode="numeric" autoComplete="off" placeholder="0,00" value={f.revenue}
                    onChange={(e) => setF((p) => ({ ...p, revenue: maskBRL(e.target.value) }))} aria-invalid={err("revenue") ? true : undefined} />
                </div>
              </FormField>
              <FormField id="entry-sales" label="Vendas" hint="Quantidade, só você e o próprio seller veem." error={err("sales")}>
                <input id="entry-sales" className="vp-field tabular-nums" inputMode="numeric" autoComplete="off" placeholder="0" value={f.sales} onChange={(e) => setF((p) => ({ ...p, sales: e.target.value.replace(/\D/g, "").slice(0, 8) }))} />
              </FormField>
            </div>
            <FormField id="entry-reason" label="Motivo" hint="Fica na auditoria. Quem olhar depois precisa entender por que o ranking foi mexido." error={err("reason")}>
              <textarea id="entry-reason" className="vp-field resize-none" rows={3} maxLength={LIMITS.reason} value={f.reason} onChange={(e) => setF((p) => ({ ...p, reason: e.target.value }))} aria-invalid={err("reason") ? true : undefined} />
            </FormField>
          </DialogBody>
          {serverError && <DialogError>{serverError}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={save.isPending}>Cancelar</button>
            <button type="submit" className="vp-cta !h-12 justify-center sm:min-w-[150px]" disabled={save.isPending}>
              {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : creating ? "Adicionar ao ranking" : "Salvar valor"}
            </button>
          </DialogFoot>
        </form>
        {sensitive.dialog}
      </DialogContent>
    </Dialog>
  );
}
