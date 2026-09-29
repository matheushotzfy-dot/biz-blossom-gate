/**
 * AutoWithdrawalSettings — Tile compacto + Dialog
 * Clique no tile abre popup para ativar/desativar, valor alvo e chave Pix.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useKycStatus } from "@/hooks/useKycStatus";
import { usePixKeys } from "@/hooks/useQueryData";
import { toast } from "sonner";
import { Zap, Loader2, ShieldAlert, ChevronRight, CheckCircle2, X, Mail, Phone, Hash, Fingerprint, Sparkles, PlusCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReauthenticationDialog } from "@/components/security/ReauthenticationDialog";
import { friendlyError } from "@/lib/friendlyError";
import { maskSensitivePixKey } from "@/lib/financial-input";

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
  const { profile } = useProfile();
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
  const maskedKey = (k?: typeof selectedKey) => k ? maskSensitivePixKey(k.key_value_masked ?? k.key_value, k.key_type) : "";

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
        className="w-full group relative overflow-hidden rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all px-3 py-2 flex items-center gap-3 text-left disabled:opacity-60"
      >
        <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Zap size={15} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold text-foreground tracking-tight leading-none">Saque Automatizado</p>
            {isActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativo
              </span>
            )}
          </div>
          <p className="text-[9px] font-bold text-muted-foreground/80 mt-1 truncate leading-none">
            {isActive
              ? `${fmt(Number(config?.target_amount || 0))} para ${(selectedKey?.key_type || "chave").toUpperCase()} · ${maskedKey(selectedKey)}`
              : "Solicita saque sozinho ao atingir o valor alvo"}
          </p>
        </div>
        <ChevronRight size={14} className="text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border/60 p-0 overflow-hidden rounded-3xl">
          {/* Header with subtle gradient */}
          <DialogHeader className="relative p-6 pb-5 border-b border-border/40 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
                <Zap size={18} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  Saque Automatizado
                  {isActive && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ativo
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-[11px] font-bold text-muted-foreground/80 mt-0.5">
                  Solicite saques sozinho ao atingir o valor alvo
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
            {!kycOk && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                <ShieldAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-amber-500/90 leading-relaxed">
                  Só será processado após aprovação do seu KYC.
                </p>
              </div>
            )}

            {/* Master toggle */}
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/60 hover:border-primary/40 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${enabled ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground/60"}`}>
                  <Sparkles size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-foreground ">
                    {enabled ? "Automação Ativada" : "Automação Desativada"}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">
                    {enabled ? "Saques serão criados automaticamente" : "Ative para configurar"}
                  </p>
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </button>

            <div className={`space-y-5 transition-opacity ${enabled ? "" : "opacity-40 pointer-events-none"}`}>
              {/* Valor alvo */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Valor alvo
                  </label>
                  <span className="text-[10px] font-bold text-muted-foreground/60">
                    {fmt(MIN)} — {fmt(MAX)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground/70 text-sm">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value.replace(/[^\d,]/g, ""))}
                    placeholder="1.500,00"
                    className="w-full pl-12 h-14 rounded-2xl bg-background border border-border/60 text-lg font-black tabular-nums tracking-tight focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
                {/* Quick presets */}
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  {[500, 1000, 2500, 5000, 10000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAmountStr(v.toFixed(2).replace(".", ","))}
                      className={`px-3 h-8 rounded-lg text-[11px] font-semibold border transition-all ${
                        amountNum === v
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-muted/30 border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {fmt(v).replace(",00", "")}
                    </button>
                  ))}
                </div>
                {amountError && <p className="text-[10px] font-bold text-destructive pt-1">{amountError}</p>}
              </div>

              {/* Chave Pix */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    Chave Pix de recebimento
                  </label>
                  {activeKeys.length > 0 && (
                    <span className="text-[10px] font-bold text-muted-foreground/60">
                      {activeKeys.length} {activeKeys.length === 1 ? "chave" : "chaves"}
                    </span>
                  )}
                </div>
                {activeKeys.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-border/60 bg-muted/20 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                      <PlusCircle size={16} />
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground flex-1">
                      Cadastre uma chave Pix primeiro para configurar.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {activeKeys.map((k) => {
                      const selected = pixKeyId === k.id;
                      const Icon = k.key_type === "email" ? Mail
                        : k.key_type === "telefone" || k.key_type === "phone" ? Phone
                        : k.key_type === "cpf" || k.key_type === "cnpj" ? Hash
                        : Fingerprint;
                      const val = maskSensitivePixKey(k.key_value_masked ?? k.key_value, k.key_type);
                      return (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => setPixKeyId(k.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            selected
                              ? "bg-primary/8 border-primary/50 ring-2 ring-primary/15"
                              : "bg-background border-border/60 hover:border-border hover:bg-muted/30"
                          }`}
                        >
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                          }`}>
                            <Icon size={16} strokeWidth={2.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-muted-foreground/70">
                              {k.key_type}
                            </p>
                            <p className="text-sm font-black text-foreground truncate mt-0.5">
                              {val}
                            </p>
                          </div>
                          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            selected ? "border-primary bg-primary" : "border-border"
                          }`}>
                            {selected && <CheckCircle2 size={12} className="text-primary-foreground" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Summary */}
              {enabled && formValid && (
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-[11px] font-semibold text-emerald-500/90 mb-2">
                    Como vai funcionar
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Quando seu <strong className="text-foreground">saldo disponível</strong> atingir{" "}
                    <strong className="text-emerald-500 tabular-nums">{fmt(amountNum)}</strong>,
                    um saque desse valor é solicitado automaticamente para a chave selecionada.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-border/40 bg-muted/20 flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 h-11 rounded-xl bg-background border border-border/60 text-[11px] font-semibold text-foreground hover:bg-muted transition-all flex items-center justify-center gap-1.5"
            >
              <X size={14} /> Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-[1.5] h-11 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {enabled ? "Salvar configuração" : "Salvar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
