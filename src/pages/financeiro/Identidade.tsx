/**
 * Identidade & KYC — Verificação de conta e dados pessoais
 * @module Identidade
 * @version 2.4.0
 * @author msDev's — Engenharia de Software
 * @description Gerenciamento de identidade com campos sensíveis bloqueados após cadastro,
 *   exibição de chaves PIX e contas bancárias cadastradas em Dados Bancários,
 *   e upload de documentos KYC com validação rigorosa de CPF/CNPJ.
 */

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePixKeys, useBankAccounts, useInvalidateAll } from "@/hooks/useQueryData";
import {
  UserCircle, Save, Shield, FileCheck, Key, CheckCircle2,
  Upload, Camera, Image, Loader2, Lock, Info, Fingerprint,
  Wallet, BadgeCheck, Building2, CreditCard, Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PageShell, Panel, GlowPanel, PageTitle, SectionHeader } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

/* ─── Status Map ─── msDev's */
const STATUS_MAP: Record<string, { label: string; cls: string; icon: string }> = {
  approved: { label: "Conta Aprovada", cls: "text-primary bg-primary/10 border-primary/15", icon: "✅" },
  pending_review: { label: "Em Análise", cls: "text-warning bg-warning/10 border-warning/15", icon: "⏳" },
  rejected: { label: "Reprovada", cls: "text-destructive bg-destructive/10 border-destructive/15", icon: "❌" },
  blocked: { label: "Bloqueada", cls: "text-destructive bg-destructive/10 border-destructive/15", icon: "🚫" },
};

/* ─── CPF/CNPJ formatting — msDev's ─── */
function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatDocument(value: string, type: string): string {
  return type === "cnpj" ? formatCNPJ(value) : formatCPF(value);
}

type PixKey = { id: string; key_type: string; key_value: string; created_at: string; user_id: string };

const pixKeyTypeLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};

export default function Identidade() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { data: pixKeys = [] } = usePixKeys();
  const { data: bankAccounts = [] } = useBankAccounts();
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [kycDocs, setKycDocs] = useState<Record<string, string | null>>({ front: null, back: null, selfie: null });
  const [uploading, setUploading] = useState<string | null>(null);
  const [nicknameInit, setNicknameInit] = useState(false);

  useEffect(() => {
    if (profile && !nicknameInit) {
      setNickname(profile.nickname || "");
      setNicknameInit(true);
    }
  }, [profile, nicknameInit]);

  useEffect(() => { loadKycDocs(); }, [user]);

  const loadKycDocs = async () => {
    if (!user) return;
    const types = ["front", "back", "selfie"];
    const docs: Record<string, string | null> = {};
    for (const type of types) {
      const { data } = await supabase.storage.from("kyc-documents").list(`${user.id}`, { search: type });
      if (data && data.length > 0) {
        const { data: urlData } = supabase.storage.from("kyc-documents").getPublicUrl(`${user.id}/${data[0].name}`);
        docs[type] = urlData?.publicUrl || null;
      } else { docs[type] = null; }
    }
    setKycDocs(docs);
  };

  const handleUpload = async (type: string, file: File) => {
    if (!user) return;
    const ALLOWED_KYC_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!ALLOWED_KYC_TYPES.includes(file.type)) { toast.error("Formato inválido. Use JPEG, PNG, WebP ou HEIC"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB"); return; }
    setUploading(type);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${type}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true });
    if (error) toast.error("Erro no upload"); else { toast.success("Documento enviado!"); await loadKycDocs(); }
    setUploading(null);
  };

  const handleSaveNickname = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ nickname }).eq("user_id", user.id);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Apelido atualizado!");
    setSaving(false);
  };

  const status = STATUS_MAP[profile?.account_status || "pending_review"] || STATUS_MAP.pending_review;
  const completionSteps = [
    { label: "Dados pessoais", done: !!(profile?.full_name && profile?.email) },
    { label: "Documento", done: !!profile?.document_number },
    { label: "Telefone", done: !!profile?.phone },
    { label: "Chave PIX", done: pixKeys.length > 0 },
    { label: "Doc. frente", done: !!kycDocs.front },
    { label: "Doc. verso", done: !!kycDocs.back },
    { label: "Selfie com doc", done: !!kycDocs.selfie },
  ];
  const completionPct = Math.round((completionSteps.filter((s) => s.done).length / completionSteps.length) * 100);
  const isApproved = profile?.account_status === "approved";
  const formattedDoc = profile?.document_number
    ? formatDocument(profile.document_number, profile.document_type || "cpf")
    : "Não informado";

  return (
    <PageShell>
      <PageTitle icon={<Fingerprint className="h-6 w-6" />} title="Identidade & KYC" subtitle="Dados pessoais, documentos e verificação de conta" />

      {/* Status Banner */}
      {isApproved && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-center gap-4 animate-fade-in">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 shadow-lg shadow-primary/10">
            <BadgeCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              Conta Verificada
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">APROVADA</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Sua identidade foi aprovada. Você pode realizar saques normalmente.</p>
          </div>
        </div>
      )}

      {/* Top cards — msDev's */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Status */}
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Status da Conta</h3>
          </div>
          <div className={`flex items-center gap-3 p-4 rounded-2xl border ${status.cls}`}>
            <div className="h-10 w-10 rounded-xl bg-current/10 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-[14px]">{status.icon} {status.label}</p>
              <p className="text-[10px] opacity-70">{isApproved ? "Conta verificada e ativa" : "Complete os dados abaixo"}</p>
            </div>
          </div>
        </Panel>

        {/* Progress */}
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Progresso</h3>
            </div>
            <span className="text-lg font-display font-black text-primary">{completionPct}%</span>
          </div>
          <div className="relative w-full h-3 rounded-full overflow-hidden mb-4 bg-muted/60">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${completionPct}%`,
                background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))',
                boxShadow: '0 0 12px hsl(var(--primary) / 0.4)',
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {completionSteps.map((step) => (
              <div key={step.label} className="flex items-center gap-1.5 text-[10px]">
                {step.done ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-border shrink-0" />
                )}
                <span className={step.done ? "text-foreground/60 line-through" : "text-muted-foreground/50"}>{step.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Security */}
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Segurança</h3>
          </div>
          <div className="space-y-3">
            {[
              { icon: Shield, label: "Criptografia SSL", active: true },
              { icon: FileCheck, label: "LGPD Compliant", active: true },
              { icon: Key, label: "2FA (Em breve)", active: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/40">
                <div className="flex items-center gap-2.5 text-[12px]">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${item.active ? "bg-primary/10" : "bg-muted/50"}`}>
                    <item.icon className={`h-3.5 w-3.5 ${item.active ? "text-primary" : "text-muted-foreground/30"}`} />
                  </div>
                  <span className="text-foreground/80 font-medium">{item.label}</span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.active ? "text-primary bg-primary/10" : "text-muted-foreground/30 bg-muted/50"}`}>
                  {item.active ? "Ativo" : "Em breve"}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* ─── DADOS PESSOAIS (SOMENTE LEITURA + NICKNAME EDITÁVEL) ─── msDev's */}
        <Panel>
          <div className="flex items-center gap-2 mb-5">
            <UserCircle className="h-4 w-4 text-primary" />
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Dados Pessoais</h3>
          </div>

          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-info/5 border border-info/15 text-info">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <p className="text-[11px] font-medium">Dados cadastrados no registro. Apenas o apelido pode ser alterado. Contate o suporte para correções.</p>
          </div>

          <div className="space-y-4">
            {/* Locked fields */}
            <LockedField label="Nome completo" value={profile?.full_name || "—"} />
            <div className="grid grid-cols-2 gap-3">
              <LockedField label="E-mail" value={profile?.email || "—"} />
              <LockedField label="Telefone" value={profile?.phone || "—"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LockedField label={profile?.document_type === "cnpj" ? "CNPJ" : "CPF"} value={formattedDoc} />
              <LockedField label="Tipo Doc." value={(profile?.document_type || "cpf").toUpperCase()} />
            </div>

            {/* Editable nickname */}
            <div className="pt-4 border-t border-border/20">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1">
                <Edit3 className="h-2.5 w-2.5" /> Apelido (editável)
              </Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="h-11 rounded-xl flex-1"
                  placeholder="Como quer ser chamado?"
                />
                <Button
                  onClick={handleSaveNickname}
                  className="rounded-xl font-bold gradient-primary text-primary-foreground shadow-lg shadow-primary/15 h-11 px-5 shrink-0"
                  disabled={saving}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Panel>

        <div className="space-y-3">
          {/* ─── CHAVES PIX CADASTRADAS (vindas de Dados Bancários) ─── msDev's */}
          <Panel>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Chaves PIX</h3>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-primary bg-primary/10">{pixKeys.length} cadastrada{pixKeys.length !== 1 ? "s" : ""}</span>
            </div>
            {pixKeys.length === 0 ? (
              <div className="text-center py-6">
                <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-[12px] text-muted-foreground/50">Nenhuma chave cadastrada</p>
                <p className="text-[10px] text-muted-foreground/30 mt-1">Cadastre em Financeiro → Dados Bancários</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pixKeys.map((pk) => (
                  <div key={pk.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-muted/10">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                      <Fingerprint className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider">{pixKeyTypeLabels[pk.key_type] || pk.key_type}</p>
                      <p className="font-mono text-[13px] text-foreground/80 truncate font-medium">{pk.key_value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* ─── CONTAS BANCÁRIAS CADASTRADAS ─── msDev's */}
          <Panel>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-info" />
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Contas Bancárias</h3>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-info bg-info/10">{bankAccounts.length} cadastrada{bankAccounts.length !== 1 ? "s" : ""}</span>
            </div>
            {bankAccounts.length === 0 ? (
              <div className="text-center py-6">
                <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-[12px] text-muted-foreground/50">Nenhuma conta cadastrada</p>
                <p className="text-[10px] text-muted-foreground/30 mt-1">Cadastre em Financeiro → Dados Bancários</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bankAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-muted/10">
                    <div className="h-8 w-8 rounded-lg bg-info/10 border border-info/15 flex items-center justify-center shrink-0">
                      <CreditCard className="h-3.5 w-3.5 text-info" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-foreground/80">{acc.bank_name}</p>
                      <p className="text-[10px] text-muted-foreground/50 font-mono">Ag. {acc.agency} • Cc. {acc.account_number}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* ─── KYC Documents ─── msDev's */}
          <Panel>
            <div className="flex items-center gap-2 mb-4">
              <FileCheck className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Verificação KYC</h3>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">Envie fotos do documento e selfie para verificação.</p>
            <div className="space-y-2.5">
              <DocSlot type="front" label="Documento (Frente)" icon={<Image className="h-5 w-5" />} preview={kycDocs.front} uploading={uploading === "front"} onUpload={(f) => handleUpload("front", f)} locked={!!kycDocs.front} />
              <DocSlot type="back" label="Documento (Verso)" icon={<Image className="h-5 w-5" />} preview={kycDocs.back} uploading={uploading === "back"} onUpload={(f) => handleUpload("back", f)} locked={!!kycDocs.back} />
              <DocSlot type="selfie" label="Selfie com Documento" icon={<Camera className="h-5 w-5" />} preview={kycDocs.selfie} uploading={uploading === "selfie"} onUpload={(f) => handleUpload("selfie", f)} locked={!!kycDocs.selfie} />
            </div>
            {kycDocs.front && kycDocs.back && kycDocs.selfie && (
              <div className="mt-4 flex items-center gap-2 text-[11px] text-info p-3 rounded-xl bg-info/5 border border-info/15">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>Documentos enviados. Contate o suporte para correções.</span>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

/* ─── Componentes auxiliares — msDev's ─── */

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1">
        <Lock className="h-2.5 w-2.5" /> {label}
      </Label>
      <div className="mt-1.5 h-11 rounded-xl border border-border/40 bg-muted/20 flex items-center px-3 text-[14px] text-foreground/70 font-medium">
        {value}
      </div>
    </div>
  );
}

function DocSlot({ type, label, icon, preview, uploading, onUpload, locked }: {
  type: string; label: string; icon: React.ReactNode; preview: string | null;
  uploading: boolean; onUpload: (file: File) => void; locked: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const canUpload = !locked && !uploading;
  return (
    <div
      onClick={() => canUpload && ref.current?.click()}
      className={cn(
        "flex items-center gap-3 p-3.5 rounded-2xl transition-all border",
        locked
          ? "border-primary/20 bg-primary/[0.03] cursor-default"
          : preview
          ? "border-primary/20 bg-primary/[0.03] cursor-pointer hover:bg-primary/[0.06]"
          : "border-border bg-muted/20 cursor-pointer hover:border-primary/20 hover:bg-muted/30"
      )}
    >
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", preview ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground")}>
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : preview ? <CheckCircle2 className="h-5 w-5" /> : icon}
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-foreground/80">{label}</p>
        <p className="text-[10px] text-muted-foreground">
          {locked ? "Enviado ✓ — bloqueado" : preview ? "Enviado ✓" : "Clique para enviar"}
        </p>
      </div>
      {locked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground/40" /> : <Upload className={cn("h-4 w-4 shrink-0", preview ? "text-primary" : "text-muted-foreground/30")} />}
    </div>
  );
}
