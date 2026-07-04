/**
 * AutoWithdrawalSettings — Tile compacto + Dialog
 * Clique no tile abre popup para ativar/desativar, valor alvo e chave Pix.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePixKeys } from "@/hooks/useQueryData";
import { toast } from "sonner";
import { Zap, Loader2, ShieldAlert, ChevronRight, CheckCircle2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  const { data: pixKeys = [] } = usePixKeys();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form state
  const [enabled, setEnabled] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [pixKeyId, setPixKeyId] = useState("");

  const kycOk = profile?.account_status === "approved";
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
  const maskedKey = (k?: typeof selectedKey) => k ? (k.key_value_masked ?? k.key_value ?? "•••") : "";

  async function handleSave() {
    if (!user?.id || !canSave) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      admin_user_id: user.id,
      enabled,
      target_amount: enabled ? amountNum : (config?.target_amount ?? MIN),
      pix_key_id: enabled ? pixKeyId : (config?.pix_key_id ?? null),
      max_amount: enabled ? amountNum : (config?.target_amount ?? MIN),
    };
    const { data, error } = await supabase
      .from("seller_auto_withdraw")
      .upsert(payload, { onConflict: "user_id" })
      .select("id, user_id, enabled, target_amount, pix_key_id")
      .maybeSingle();
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao salvar"); return; }
    setConfig(data as Config);
    setOpen(false);
    toast.success(enabled ? "Saque automático ativado" : "Saque automático desativado");
  }

  const isActive = !!config?.enabled;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="w-full group relative overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all p-5 flex items-center gap-4 text-left disabled:opacity-60"
      >
        <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Zap size={18} strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-foreground uppercase tracking-tight">Saque Automatizado</p>
            {isActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativo
              </span>
            )}
          </div>
          <p className="text-[11px] font-bold text-muted-foreground/80 mt-0.5 truncate">
            {isActive
              ? `${fmt(Number(config?.target_amount || 0))} para ${(selectedKey?.key_type || "chave").toUpperCase()} · ${maskedKey(selectedKey)}`
              : "Solicita saque sozinho ao atingir o valor alvo"}
          </p>
        </div>
        <ChevronRight size={18} className="text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-card border-border/60 p-0 overflow-hidden rounded-3xl">
          <DialogHeader className="p-6 pb-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Zap size={18} strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg font-black uppercase tracking-tight">Saque Automatizado</DialogTitle>
                <DialogDescription className="text-[11px] font-bold text-muted-foreground/80 mt-0.5">
                  Configure para solicitar saques sem intervenção
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {!kycOk && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                <ShieldAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-amber-500/90 leading-relaxed">
                  Só será processado após aprovação do seu KYC.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/60">
              <div>
                <p className="text-[11px] font-black text-foreground uppercase tracking-widest">
                  {enabled ? "Ativado" : "Desativado"}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">
                  {enabled ? "Saques serão criados automaticamente" : "Ative para começar"}
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className={enabled ? "" : "opacity-50 pointer-events-none"}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Valor alvo
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground text-sm">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value.replace(/[^\d,]/g, ""))}
                      placeholder="1.500,00"
                      className="w-full pl-11 h-12 rounded-xl bg-background border border-border/60 text-sm font-black tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  {amountError
                    ? <p className="text-[10px] font-bold text-destructive">{amountError}</p>
                    : <p className="text-[10px] text-muted-foreground/70">Mínimo {fmt(MIN)} · Máximo {fmt(MAX)}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Chave Pix
                  </label>
                  {activeKeys.length === 0 ? (
                    <div className="p-3 rounded-xl border border-dashed border-border/60 bg-muted/20 text-[11px] font-bold text-muted-foreground">
                      Cadastre uma chave Pix primeiro.
                    </div>
                  ) : (
                    <select
                      value={pixKeyId}
                      onChange={(e) => setPixKeyId(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl bg-background border border-border/60 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Selecione uma chave</option>
                      {activeKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.key_type.toUpperCase()} · {k.key_value_masked ?? k.key_value ?? "•••"}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              O saque é criado quando o <strong className="text-foreground">saldo disponível</strong> atingir o valor alvo.
              Passa pela mesma aprovação dos saques manuais.
            </p>
          </div>

          <div className="p-4 border-t border-border/40 bg-muted/20 flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 h-11 rounded-xl bg-background border border-border/60 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted transition-all flex items-center justify-center gap-1.5"
            >
              <X size={14} /> Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Salvar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
