/**
 * AutoWithdrawalSettings — Configuração de Saque Automático
 * Seller define valor alvo + chave Pix; ao atingir o saldo, um saque é solicitado.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePixKeys } from "@/hooks/useQueryData";
import { toast } from "sonner";
import { Zap, Loader2, ShieldAlert, Key, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Config = {
  id: string;
  user_id: string;
  enabled: boolean;
  target_amount: number | null;
  pix_key_id: string | null;
  updated_at: string;
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
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
        .select("id, user_id, enabled, target_amount, pix_key_id, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setConfig(data as Config);
        setAmountStr(data.target_amount ? Number(data.target_amount).toFixed(2).replace(".", ",") : "");
        setPixKeyId(data.pix_key_id || "");
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const amountNum = parseBRL(amountStr);
  const amountError = amountStr && (amountNum < MIN || amountNum > MAX)
    ? `Valor deve estar entre ${fmt(MIN)} e ${fmt(MAX)}`
    : "";
  const canSave = amountNum >= MIN && amountNum <= MAX && !!pixKeyId && !saving;

  async function save(nextEnabled: boolean) {
    if (!user?.id) return;
    if (nextEnabled && !canSave) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      admin_user_id: user.id, // legacy NOT NULL column — self-reference for seller-owned config
      enabled: nextEnabled,
      target_amount: nextEnabled ? amountNum : (config?.target_amount ?? (amountNum || MIN)),
      pix_key_id: pixKeyId || null,
      max_amount: nextEnabled ? amountNum : (config?.target_amount ?? MIN), // legacy NOT NULL
    };
    const { data, error } = await supabase
      .from("seller_auto_withdraw")
      .upsert(payload, { onConflict: "user_id" })
      .select("id, user_id, enabled, target_amount, pix_key_id, updated_at")
      .maybeSingle();
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao salvar"); return; }
    setConfig(data as Config);
    setEditing(false);
    toast.success(nextEnabled ? "Saque automático ativado" : "Saque automático desativado");
  }

  async function disable() {
    setConfirmDisable(false);
    await save(false);
  }

  const selectedKey = activeKeys.find(k => k.id === (config?.pix_key_id || pixKeyId));
  const maskedKey = (k?: typeof selectedKey) => k ? (k.key_value_masked ?? k.key_value ?? "•••") : "";

  const isActive = !!config?.enabled;

  return (
    <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border/40 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Zap size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="font-black text-foreground tracking-tight leading-none uppercase flex items-center gap-2">
              Saque Automático
              {isActive && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Ativo
                </span>
              )}
            </h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Solicita saque ao atingir o valor alvo
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {!kycOk && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-amber-500/90 leading-relaxed">
              O saque automático só será processado após a aprovação do seu KYC.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          Sempre que seu <strong className="text-foreground">saldo disponível</strong> atingir o valor alvo, um saque é
          solicitado automaticamente para a chave Pix escolhida. Saques automáticos passam pela mesma aprovação dos manuais.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : isActive && !editing ? (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-muted/30 border border-border/60">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Configuração atual</p>
              <p className="text-2xl font-black text-foreground tabular-nums mt-2">
                {fmt(Number(config?.target_amount || 0))}
              </p>
              <p className="text-[11px] font-bold text-muted-foreground/80 mt-1">
                para <span className="uppercase">{selectedKey?.key_type || "chave"}</span>: {maskedKey(selectedKey)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEditing(true)}
                className="h-11 rounded-xl bg-muted/50 border border-border/60 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted transition-all"
              >
                Editar
              </button>
              <button
                onClick={() => setConfirmDisable(true)}
                className="h-11 rounded-xl border border-destructive/40 text-destructive text-[10px] font-black uppercase tracking-widest hover:bg-destructive/10 transition-all"
              >
                Desativar
              </button>
            </div>
          </div>
        ) : (
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
              {amountError && <p className="text-[10px] font-bold text-destructive">{amountError}</p>}
              <p className="text-[10px] text-muted-foreground/70">Mínimo {fmt(MIN)} · Máximo {fmt(MAX)}</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Chave Pix para recebimento
              </label>
              {activeKeys.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/60 bg-muted/20 flex items-center gap-2">
                  <Key size={14} className="text-muted-foreground" />
                  <p className="text-[11px] font-bold text-muted-foreground">
                    Cadastre uma chave Pix primeiro (na aba Chaves Pix).
                  </p>
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

            {config?.pix_key_id && pixKeyId && pixKeyId !== config.pix_key_id && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-500/90 leading-relaxed">
                  Saques já pendentes continuarão para a chave anterior até serem processados.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => save(true)}
                disabled={!canSave}
                className="h-11 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {isActive ? "Salvar alterações" : "Ativar"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  if (config) {
                    setAmountStr(config.target_amount ? Number(config.target_amount).toFixed(2).replace(".", ",") : "");
                    setPixKeyId(config.pix_key_id || "");
                  } else {
                    setAmountStr(""); setPixKeyId("");
                  }
                }}
                className="h-11 rounded-xl bg-muted/50 border border-border/60 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar saque automático?</AlertDialogTitle>
            <AlertDialogDescription>
              Nenhum novo saque será solicitado automaticamente. Você poderá reativar quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={disable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
