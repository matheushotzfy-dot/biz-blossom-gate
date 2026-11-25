import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { PremiumPanel } from "@/pages/admin/tabs/AdminPremium";
import { ReasonDialog } from "./ReasonDialog";
import { SETTINGS_KEY, callRpc } from "./settingsApi";
import { REASON_PRESETS, whenLabel, type SettingsData } from "./settingsModel";

export function SignupPanel({ data }: { data: SettingsData }) {
  const qc = useQueryClient();
  const on = data.signup.requireEmailVerification;
  const [target, setTarget] = useState<boolean | null>(null);
  const [last, setLast] = useState<boolean>(!on);
  const ask = (next: boolean) => { setLast(next); setTarget(next); };

  return (
    <PremiumPanel title="Cadastro" icon={MailCheck}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-[280px]">
          <label htmlFor="settings-email-verification" className="text-[14.5px] font-semibold text-foreground">Exigir confirmação de e-mail</label>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            {on ? "Quem cria conta precisa clicar no link enviado por e-mail antes de entrar." : "Quem cria conta entra na hora, sem confirmar o e-mail."}
            {data.signup.configured && data.signup.updatedAt && ` Alterado ${whenLabel(data.signup.updatedAt)}${data.signup.updatedBy ? `, por ${data.signup.updatedBy}` : ""}.`}
          </p>
        </div>
        <Switch id="settings-email-verification" checked={on} onCheckedChange={(v) => ask(v)} aria-label="Exigir confirmação de e-mail" />
      </div>

      {!on && (
        <div role="note" className="mt-4 flex items-start gap-3 rounded-xl bg-warning/10 p-4 shadow-[inset_0_0_0_1px_hsl(var(--warning)/.35)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-[13px] leading-relaxed text-foreground/90">
            Com isso desligado, qualquer pessoa pode criar uma conta com o e-mail de um comprador e receber o acesso aos cursos dele. A entrega de acesso procura contas pelo e-mail. Deixe desligado só enquanto não houver envio de e-mail funcionando.
          </p>
        </div>
      )}

      <ReasonDialog open={target !== null} onClose={() => setTarget(null)} icon={<MailCheck className="h-5 w-5" />}
        title={last ? "Ligar a confirmação de e-mail?" : "Desligar a confirmação de e-mail?"}
        confirmLabel={last ? "Ligar confirmação" : "Desligar confirmação"} danger={!last}
        reason={last ? "none" : "required"} presets={REASON_PRESETS.email}
        confirmText={last ? "Novas contas passam a precisar confirmar o e-mail antes de entrar." : "Novas contas passam a entrar sem confirmar o e-mail. Isso permite roubar o acesso de compradores."}
        onSubmit={async (reason) => {
          await callRpc("admin_set_email_verification", { _enabled: last, _reason: last ? "" : reason });
          toast.success(last ? "Confirmação de e-mail ligada." : "Confirmação de e-mail desligada.");
          await qc.invalidateQueries({ queryKey: SETTINGS_KEY });
        }}>
        <p className="text-[14px] leading-relaxed text-foreground/90">
          {last
            ? "Quem criar conta daqui para frente precisa confirmar o e-mail. Contas que já existem não mudam. Só ligue se o envio de e-mail estiver funcionando, senão ninguém novo consegue entrar."
            : "Quem criar conta daqui para frente entra sem confirmar o e-mail. Qualquer pessoa pode usar o e-mail de um comprador e receber o conteúdo dele."}
        </p>
      </ReasonDialog>
    </PremiumPanel>
  );
}
