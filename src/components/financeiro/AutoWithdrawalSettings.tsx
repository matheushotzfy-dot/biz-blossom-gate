/**
 * AutoWithdrawalSettings — cartão compacto + diálogo
 * Clique no tile abre popup para ativar/desativar, valor alvo e chave Pix.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useKycStatus } from "@/hooks/useKycStatus";
import { usePixKeys } from "@/hooks/useQueryData";
import { toast } from "sonner";
import { Zap, Loader2, ShieldAlert, ChevronRight, Mail, Phone, Hash, Fingerprint, PlusCircle } from "lucide-react";
import { getPixKeyMeta } from "@/components/financeiro/WithdrawDestinationPicker";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChoiceChip, ChoiceGrid, chipTone, DialogBody, DialogFoot, DialogHead, FieldHint, FieldLabel, ToggleRow, dialogBox } from "@/components/seller-ui/form";
import { maskBRL, parseBRL, toMaskedBRL } from "@/components/seller-ui/money";
import { ReauthenticationDialog } from "@/components/security/ReauthenticationDialog";
import { friendlyError } from "@/lib/friendlyError";
import { displayPixKey } from "@/lib/financial-input";

type Config = {
  id: string;
  user_id: string;
  enabled: boolean;
  target_amount: number | null;
  pix_key_id: string | null;
};

const MIN = 50;
const MAX = 10000;
const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function AutoWithdrawalSettings() {
  const { user } = useAuth();
  const kyc = useKycStatus();
  const { data: pixKeys = [] } = usePixKeys();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);

  // form state
  const [enabled, setEnabled] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [pixKeyId, setPixKeyId] = useState("");

  const kycOk = kyc.approved;
  const activeKeys = useMemo(
    () => (pixKeys as Array<{ id: string; key_type: string; key_value?: string | null; key_value_masked?: string | null }>),
    [pixKeys]
  );

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("seller_auto_withdraw")
        .select("id, user_id, enabled, target_amount, pix_key_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setConfig(data as Config);
      setLoading(false);
    })();
  }, [user?.id]);

  // hydrate form when opening
  useEffect(() => {
    if (!open) return;
    setEnabled(config?.enabled ?? false);
    setAmountStr(toMaskedBRL(Number(config?.target_amount ?? 0)));
    setPixKeyId(config?.pix_key_id || (activeKeys.length === 1 ? activeKeys[0].id : ""));
  }, [open, config, activeKeys]);

  const amountNum = parseBRL(amountStr);
  const amountError = amountStr && (amountNum < MIN || amountNum > MAX)
    ? `Entre ${fmt(MIN)} e ${fmt(MAX)}`
    : "";
  const formValid = amountNum >= MIN && amountNum <= MAX && !!pixKeyId;
  const canSave = !saving && (enabled ? formValid : true);

  const selectedKey = activeKeys.find(k => k.id === (config?.pix_key_id || ""));
  const visibleKey = (k?: typeof selectedKey) => k ? displayPixKey(k.key_value, k.key_type, k.key_value_masked) : "";

  function handleSave() {
    if (!user?.id || !canSave) return;
    setReauthOpen(true);
  }

  async function confirmSave(password: string) {
    if (!user?.id || !canSave) return;
    setSaving(true);
    const payload = {
      enabled,
      target_amount: enabled ? amountNum : (config?.target_amount ?? MIN),
      pix_key_id: enabled ? pixKeyId : (config?.pix_key_id ?? null),
    };
    const { data, error } = await supabase.functions.invoke("sensitive-financial-action", {
      body: { action: "configure_auto_withdraw", password, payload },
    });
    setSaving(false);
    if (error || !data?.success) {
      toast.error(data?.error || friendlyError(error, "Não foi possível salvar a configuração"));
      return;
    }
    setConfig((current) => ({
      id: current?.id ?? "pending-refresh",
      user_id: user.id,
      enabled: payload.enabled,
      target_amount: payload.target_amount,
      pix_key_id: payload.pix_key_id,
    }));
    setReauthOpen(false);
    setOpen(false);
    toast.success(enabled ? "Saque automático ativado" : "Saque automático desativado");
  }

  const isActive = !!config?.enabled;

  return (
    <>
      <ReauthenticationDialog
        open={reauthOpen}
        busy={saving}
        title="Autorizar saque automático"
        description="Digite sua senha atual para confirmar esta configuração financeira."
        onOpenChange={setReauthOpen}
        onConfirm={confirmSave}
      />
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="vp-sheet group flex w-full min-w-0 items-center gap-3.5 p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <Zap className="h-5 w-5" strokeWidth={2.3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-foreground">Saque automático</span>
            {isActive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[12px] font-bold text-accent-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Ativo
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[13.5px] text-muted-foreground">
            {isActive
              ? `${fmt(Number(config?.target_amount || 0))} na chave ${selectedKey ? getPixKeyMeta(selectedKey.key_type).label : ""} ${visibleKey(selectedKey)}`.replace(/\s+/g, " ").trim()
              : "Saca sozinho ao atingir o valor alvo"}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
        <DialogContent className={dialogBox("md")}>
          <DialogHead
            icon={<Zap className="h-5 w-5" strokeWidth={2.4} />}
            title="Saque automático"
            subtitle="Pede o saque sozinho quando o saldo chega no valor alvo."
            aside={isActive ? <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[12px] font-bold text-accent-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Ativo</span> : undefined}
          />
          <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <DialogBody>
              {!kycOk && (
                <div className="vp-r16 flex items-start gap-3 bg-warning/15 p-3.5">
                  <ShieldAlert className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning" />
                  <p className="text-[14px] leading-relaxed text-foreground">O saque só é processado depois que o seu KYC for aprovado.</p>
                </div>
              )}

              <ToggleRow
                icon={<Zap className="h-[18px] w-[18px]" />}
                title={enabled ? "Automação ligada" : "Automação desligada"}
                description={enabled ? "Os saques serão criados sozinhos." : "Ligue para escolher o valor e a chave."}
              >
                <Switch id="auto-withdraw-enabled" checked={enabled} onCheckedChange={setEnabled} aria-label="Ligar o saque automático" />
              </ToggleRow>

              {enabled && (
                <>
                  <div>
                    <FieldLabel htmlFor="auto-withdraw-amount" hint={`de ${fmt(MIN)} a ${fmt(MAX)}`}>Valor alvo</FieldLabel>
                    <div className="relative">
                      <span aria-hidden className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">R$</span>
                      <input
                        id="auto-withdraw-amount" type="text" inputMode="numeric" autoComplete="off" autoFocus
                        value={amountStr} onChange={(e) => setAmountStr(maskBRL(e.target.value))}
                        placeholder="1.500,00" aria-invalid={!!amountError} aria-describedby="auto-withdraw-amount-msg"
                        className="vp-field vp-field-lg"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                      {[500, 1000, 2500, 5000, 10000].map((v) => (
                        <ChoiceChip key={v} active={amountNum === v} onClick={() => setAmountStr(toMaskedBRL(v))} className={chipTone(amountNum === v)}>
                          {fmt(v).replace(",00", "")}
                        </ChoiceChip>
                      ))}
                    </div>
                    {amountError
                      ? <p id="auto-withdraw-amount-msg" role="alert" className="mt-2 text-center text-[13px] font-semibold text-destructive">{amountError}</p>
                      : <span id="auto-withdraw-amount-msg" className="sr-only">Valor entre {fmt(MIN)} e {fmt(MAX)}</span>}
                  </div>

                  <div>
                    <FieldLabel hint={activeKeys.length > 0 ? `${activeKeys.length} ${activeKeys.length === 1 ? "chave" : "chaves"}` : undefined}>Chave Pix que recebe</FieldLabel>
                    {activeKeys.length === 0 ? (
                      <div className="vp-r16 flex items-center gap-3 bg-muted/60 p-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><PlusCircle className="h-[18px] w-[18px]" /></span>
                        <p className="flex-1 text-[14px] leading-snug text-muted-foreground">Cadastre uma chave Pix em Dados bancários para ligar o saque automático.</p>
                      </div>
                    ) : (
                      <ChoiceGrid
                        label="Chave Pix que recebe" columns={1} value={pixKeyId} onChange={setPixKeyId}
                        options={activeKeys.map((k) => ({
                          value: k.id,
                          label: displayPixKey(k.key_value, k.key_type, k.key_value_masked),
                          description: getPixKeyMeta(k.key_type).label,
                          icon: k.key_type === "email" ? Mail : k.key_type === "telefone" || k.key_type === "phone" ? Phone : k.key_type === "cpf" || k.key_type === "cnpj" ? Hash : Fingerprint,
                        }))}
                      />
                    )}
                    {formValid
                      ? <p className="vp-r16 mt-4 bg-accent p-4 text-[14px] leading-relaxed text-accent-foreground">Quando o seu saldo disponível chegar a <strong className="font-extrabold tabular-nums">{fmt(amountNum)}</strong>, um saque desse valor é pedido sozinho para a chave escolhida.</p>
                      : activeKeys.length > 0 && <FieldHint>Escolha a chave e informe o valor para salvar.</FieldHint>}
                  </div>
                </>
              )}
            </DialogBody>

            <DialogFoot>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="vp-ghost !h-12 justify-center">Cancelar</button>
              <button type="submit" disabled={!canSave} className="vp-cta !h-12 justify-center sm:min-w-[180px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
                {enabled ? "Salvar configuração" : "Salvar"}
              </button>
            </DialogFoot>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
