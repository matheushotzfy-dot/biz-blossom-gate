import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceChip, DialogBody, DialogError, DialogFoot, DialogHead, FieldHint, FieldLabel, dialogBox } from "@/components/seller-ui/form";
import { maskBRL, parseBRL, toMaskedBRL } from "@/components/seller-ui/money";
import { useDebouncedValue } from "@/features/admin-antifraud/antifraudModel";
import { brl } from "@/features/admin-finance/types";
import { useSensitiveConfirm } from "@/features/admin-finance/useSensitiveConfirm";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { CREATE_PRESETS, DEFAULT_REWARD, SELLER_SEARCH_MIN, checkCreate, parseSellers, type SellerHit } from "./referralsModel";

/** Registra uma indicação em nome de um seller (o seller ainda não tem tela para indicar). */
export function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const sensitive = useSensitiveConfirm("Confirme sua senha");
  const [seller, setSeller] = useState<SellerHit | null>(null);
  const [term, setTerm] = useState("");
  const [email, setEmail] = useState("");
  const [reward, setReward] = useState(toMaskedBRL(DEFAULT_REWARD));
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSeller(null); setTerm(""); setEmail(""); setReward(toMaskedBRL(DEFAULT_REWARD)); setReason(""); setTouched(false); setServerError(null);
  }, [open]);

  const debounced = useDebouncedValue(term.trim());
  const ready = debounced.length >= SELLER_SEARCH_MIN;
  const sq = useQuery({
    queryKey: ["admin-seller-search", debounced],
    enabled: open && ready && !seller,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_search_sellers" as never, { _query: debounced } as never);
      if (error) throw error;
      return parseSellers(data);
    },
  });

  const amount = parseBRL(reward);
  const problems = { ...checkCreate({ seller, email, reward: amount, reason }), ...(reward.trim() ? {} : { reward: "Informe a recompensa. Pode ser R$ 0,00." }) };
  const invalid = Object.keys(problems).length > 0;

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_create_referral" as never, { _referrer: seller!.user_id, _email: email.trim().toLowerCase(), _reward: amount, _reason: reason.trim() } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indicação registrada como pendente.");
      void qc.invalidateQueries({ queryKey: ["admin-referrals"] });
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível registrar. Nada foi salvo.")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (invalid || !seller) return;
    sensitive.confirm(`Registrar a indicação de ${email.trim().toLowerCase()} em nome de ${seller.name}, com recompensa de ${brl(amount)}.`, async () => { await create.mutateAsync().catch(() => undefined); });
  };

  const hits = sq.data ?? [];
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !create.isPending) onClose(); }}>
        <DialogContent className={dialogBox("md")}>
          <DialogHead icon={<UserPlus className="h-5 w-5" />} title="Registrar indicação" subtitle="Use quando um seller avisar que indicou alguém. Ela entra como pendente." />
          <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
            <DialogBody>
              {seller ? (
                <div>
                  <FieldLabel>Quem indicou</FieldLabel>
                  <div className="flex items-start justify-between gap-3 rounded-[16px] bg-accent/60 p-4 shadow-[inset_0_0_0_1px_hsl(var(--primary)/.35)]">
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-bold text-foreground">{seller.name}</p>
                      {seller.email && <p className="truncate text-[13px] text-muted-foreground">{seller.email}</p>}
                    </div>
                    <button type="button" onClick={() => { setSeller(null); setTerm(""); }} className="vp-ghost shrink-0 !h-9 px-3 text-[13px]">Trocar</button>
                  </div>
                </div>
              ) : (
                <div>
                  <FieldLabel htmlFor="referral-seller">Quem indicou</FieldLabel>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input id="referral-seller" className="vp-field" style={{ paddingLeft: 42 }} autoComplete="off" value={term} onChange={(e) => setTerm(e.target.value)}
                      placeholder="Nome ou e-mail do seller" aria-describedby="referral-seller-msg" aria-invalid={touched && !!problems.seller} />
                  </div>
                  <div id="referral-seller-msg" aria-live="polite">
                    {!ready && !(touched && problems.seller) && <FieldHint>Digite pelo menos {SELLER_SEARCH_MIN} letras.</FieldHint>}
                    {ready && sq.isFetching && <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Procurando…</p>}
                    {ready && sq.isError && !sq.isFetching && (
                      <p role="alert" className="mt-2 text-[13px] font-medium text-destructive">
                        {friendlyError(sq.error, "Não foi possível buscar os sellers.")} <button type="button" className="underline" onClick={() => void sq.refetch()}>Tentar de novo</button>
                      </p>
                    )}
                    {ready && !sq.isFetching && !sq.isError && sq.data && hits.length === 0 && <FieldHint>Nenhuma conta encontrada para “{debounced}”.</FieldHint>}
                    {touched && problems.seller && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problems.seller}</p>}
                  </div>
                  {hits.length > 0 && (
                    <ul className="mt-2 max-h-[220px] space-y-2 overflow-y-auto overscroll-contain pr-1">
                      {hits.map((s) => (
                        <li key={s.user_id}>
                          <button type="button" onClick={() => setSeller(s)}
                            className="vp-r16 flex w-full min-w-0 flex-col gap-0.5 bg-background px-4 py-3 text-left shadow-[inset_0_0_0_1px_hsl(var(--border))] transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <span className="truncate text-[14px] font-semibold text-foreground">{s.name}</span>
                            {s.email && <span className="truncate text-[12.5px] text-muted-foreground">{s.email}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <FieldLabel htmlFor="referral-email" hint="O e-mail que o seller indicou.">E-mail do indicado</FieldLabel>
                <input id="referral-email" type="email" className="vp-field" autoComplete="off" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !!problems.email} />
                {touched && problems.email && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problems.email}</p>}
              </div>

              <div className="max-w-[240px]">
                <FieldLabel htmlFor="referral-reward">Recompensa</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">R$</span>
                  <input id="referral-reward" className="vp-field" inputMode="numeric" style={{ paddingLeft: 44 }} value={reward} onChange={(e) => setReward(maskBRL(e.target.value))} aria-invalid={touched && !!problems.reward} />
                </div>
                {touched && problems.reward ? <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problems.reward}</p> : <FieldHint>Padrão: {brl(DEFAULT_REWARD)}. Só é paga quando você registra o pagamento.</FieldHint>}
              </div>

              <div>
                <FieldLabel htmlFor="referral-create-reason" hint="Fica no histórico da indicação.">Motivo do registro</FieldLabel>
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {CREATE_PRESETS.map((p) => <ChoiceChip key={p} active={reason === p} onClick={() => setReason(p)} className="!h-9 px-3.5 text-[13px]">{p}</ChoiceChip>)}
                </div>
                <textarea id="referral-create-reason" className="vp-field resize-none" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={touched && !!problems.reason} />
                {touched && problems.reason && <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{problems.reason}</p>}
              </div>
            </DialogBody>
            {serverError && <DialogError>{serverError}</DialogError>}
            <DialogFoot>
              <button type="button" className="vp-ghost !h-12 justify-center" onClick={onClose} disabled={create.isPending}>Cancelar</button>
              <button type="submit" className={cn("vp-cta", "!h-12 justify-center sm:min-w-[190px]")} disabled={create.isPending}>
                {create.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando…</> : "Registrar indicação"}
              </button>
            </DialogFoot>
          </form>
        </DialogContent>
      </Dialog>
      {sensitive.dialog}
    </>
  );
}
