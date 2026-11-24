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
import { Zap, Loader2, ShieldAlert, ChevronRight, Check, Mail, Phone, Hash, Fingerprint, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPixKeyMeta } from "@/components/financeiro/WithdrawDestinationPicker";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
const parseBRL = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

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
    setAmountStr(config?.target_amount ? Number(config.target_amount).toFixed(2).replace(".", ",") : "");
    setPixKeyId(config?.pix_key_id || "");
  }, [open, config]);

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-lg gap-0 overflow-hidden rounded-[28px] border-border bg-card p-0">
          <DialogHeader className="border-b border-border p-6 text-left">
            <div className="flex items-center gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Zap className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2 font-heading text-[22px] font-extrabold tracking-[-0.03em]">
                  Saque automático
                  {isActive && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[12px] font-bold text-accent-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Ativo
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-[14px] text-muted-foreground">
                  Pede o saque sozinho quando o saldo chega no valor alvo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[62dvh] space-y-5 overflow-y-auto p-6">
            {!kycOk && (
              <div className="flex items-start gap-3 rounded-2xl bg-warning/15 p-3.5">
                <ShieldAlert className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning" />
                <p className="text-[14px] leading-relaxed text-foreground">O saque só é processado depois que o seu KYC for aprovado.</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/60 p-4">
              <label htmlFor="auto-withdraw-enabled" className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-[15px] font-bold text-foreground">{enabled ? "Automação ligada" : "Automação desligada"}</span>
                <span className="mt-0.5 block text-[13.5px] text-muted-foreground">{enabled ? "Os saques serão criados sozinhos." : "Ligue para configurar o valor e a chave."}</span>
              </label>
              <Switch id="auto-withdraw-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className={cn("space-y-5 transition-opacity", enabled ? "" : "pointer-events-none opacity-40")} aria-disabled={!enabled}>
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="auto-withdraw-amount" className="text-[13.5px] font-semibold text-foreground">Valor alvo</label>
                  <span className="text-[13px] tabular-nums text-muted-foreground">de {fmt(MIN)} a {fmt(MAX)}</span>
                </div>
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[20px] font-bold text-muted-foreground">R$</span>
                  <input
                    id="auto-withdraw-amount"
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value.replace(/[^\d,]/g, ""))}
                    placeholder="1.500,00"
                    aria-invalid={!!amountError}
                    className="vp-field vp-field-lg"
                  />
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[500, 1000, 2500, 5000, 10000].map((v) => (
                    <button key={v} type="button" onClick={() => setAmountStr(v.toFixed(2).replace(".", ","))} aria-pressed={amountNum === v} className="vp-pill border border-border">
                      {fmt(v).replace(",00", "")}
                    </button>
                  ))}
                </div>
                {amountError && <p role="alert" className="text-[13px] font-semibold text-destructive">{amountError}</p>}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span id="auto-withdraw-key" className="text-[13.5px] font-semibold text-foreground">Chave Pix que recebe</span>
                  {activeKeys.length > 0 && (
                    <span className="text-[13px] text-muted-foreground">{activeKeys.length} {activeKeys.length === 1 ? "chave" : "chaves"}</span>
                  )}
                </div>
                {activeKeys.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><PlusCircle className="h-[18px] w-[18px]" /></span>
                    <p className="flex-1 text-[14px] text-muted-foreground">Cadastre uma chave Pix em Dados bancários para ligar o saque automático.</p>
                  </div>
                ) : (
                  <div role="radiogroup" aria-labelledby="auto-withdraw-key" className="space-y-2">
                    {activeKeys.map((k) => {
                      const selected = pixKeyId === k.id;
                      const Icon = k.key_type === "email" ? Mail
                        : k.key_type === "telefone" || k.key_type === "phone" ? Phone
                        : k.key_type === "cpf" || k.key_type === "cnpj" ? Hash
                        : Fingerprint;
                      const val = displayPixKey(k.key_value, k.key_type, k.key_value_masked);
                      return (
                        <button
                          key={k.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setPixKeyId(k.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            selected ? "border-primary bg-accent" : "border-border bg-background hover:border-primary/40",
                          )}
                        >
                          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                            <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold text-muted-foreground">{getPixKeyMeta(k.key_type).label}</span>
                            <span className="block truncate text-[15px] font-bold text-foreground">{val}</span>
                          </span>
                          <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                            {selected && <Check className="h-3 w-3" strokeWidth={3.5} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {enabled && formValid && (
                <p className="rounded-2xl bg-accent p-4 text-[14px] leading-relaxed text-accent-foreground">
                  Quando o seu saldo disponível chegar a <strong className="font-extrabold tabular-nums">{fmt(amountNum)}</strong>, um saque desse valor é pedido sozinho para a chave escolhida.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2.5 border-t border-border bg-muted/40 p-4">
            <button type="button" onClick={() => setOpen(false)} className="vp-ghost h-12 flex-1">Cancelar</button>
            <button type="button" onClick={handleSave} disabled={!canSave} className="vp-cta h-12 flex-[1.5]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {enabled ? "Salvar configuração" : "Salvar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
