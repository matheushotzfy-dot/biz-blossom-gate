import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldBan } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceGrid, DialogBody, DialogError, DialogFoot, DialogHead, FormField, dialogBox } from "@/components/seller-ui/form";
import { friendlyError } from "@/lib/friendlyError";
import { DURATIONS, checkBlockReason, durationLabel, shortHash } from "./abuseModel";

/** Quarentena manual de um IP (pelo código). Vale para o login de vendedores e alunos, a única rota que consulta a quarentena. */
export function BlockIpDialog({ ipHash, onClose }: { ipHash: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [duration, setDuration] = useState("60");
  const minutes = Number(duration);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => { if (ipHash) { setDuration("60"); setReason(""); setTouched(false); setServerError(null); } }, [ipHash]);

  const block = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_abuse_block_ip" as never, { _ip_hash: ipHash, _minutes: minutes, _reason: reason } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`IP em quarentena por ${durationLabel(minutes)}.`);
      for (const k of ["admin-abuse-waiting", "admin-abuse-ips", "admin-abuse-overview"]) void qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e) => setServerError(friendlyError(e, "Não foi possível bloquear. Nada mudou.")),
  });

  const problem = checkBlockReason(reason);
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setServerError(null);
    if (problem) return;
    block.mutate();
  };

  return (
    <Dialog open={!!ipHash} onOpenChange={(next) => { if (!next && !block.isPending) onClose(); }}>
      <DialogContent className={dialogBox("md")}>
        <DialogHead icon={<ShieldBan className="h-5 w-5" />} title="Colocar este IP em quarentena" subtitle={`IP ${shortHash(ipHash ?? "")}`} />
        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <DialogBody>
            <div className="space-y-5">
              <ChoiceGrid<string> label="Por quanto tempo" columns={2} value={duration} onChange={setDuration} options={DURATIONS.map((d) => ({ value: String(d.value), label: d.label }))} />
              <FormField id="ab-reason" label="Motivo" hint="Fica registrado com seu nome. Mínimo de 3 caracteres." error={touched ? problem : null}>
                <textarea id="ab-reason" className="vp-field resize-none" rows={3} maxLength={300} autoFocus value={reason} placeholder="Ex.: tentando senhas de várias contas"
                  onChange={(e) => setReason(e.target.value)} aria-invalid={touched && problem ? true : undefined} aria-describedby="ab-reason-msg" />
              </FormField>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Vale para o login de vendedores e alunos. Quem usa a mesma rede (operadora, escritório, Wi-Fi público) também fica sem conseguir entrar até o fim do prazo.
              </p>
            </div>
          </DialogBody>
          {serverError && <DialogError>{serverError}</DialogError>}
          <DialogFoot>
            <button type="button" className="vp-ghost !h-12 justify-center" disabled={block.isPending} onClick={onClose}>Cancelar</button>
            <button type="submit" className="vp-cta vp-cta-danger !h-12 justify-center sm:min-w-[150px]" disabled={block.isPending}>
              {block.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Bloqueando…</> : "Bloquear IP"}
            </button>
          </DialogFoot>
        </form>
      </DialogContent>
    </Dialog>
  );
}
