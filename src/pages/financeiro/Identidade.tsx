/**
 * Identidade & KYC — alinhada ao padrão Saques
 * @module Identidade
 * @version 6.0.0 — Clean, no orbs, no blur, no gradients
 */

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePixKeys, useBankAccounts } from "@/hooks/useQueryData";
import {
  UserCircle, Save, Shield, FileCheck, CheckCircle2,
  Upload, Camera, Image as ImageIcon, Loader2, Lock, Info, Fingerprint,
  Wallet, BadgeCheck, Building2, CreditCard, Edit3,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  approved:       { label: "Conta Verificada", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: BadgeCheck },
  pending_review: { label: "Em Análise",       color: "text-amber-500",   bg: "bg-amber-500/10",   icon: Shield },
  rejected:       { label: "Reprovada",        color: "text-red-500",     bg: "bg-red-500/10",     icon: Shield },
  blocked:        { label: "Bloqueada",        color: "text-red-500",     bg: "bg-red-500/10",     icon: Shield },
};

function formatCPF(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}
function formatCNPJ(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}
const formatDoc = (v: string, t: string) => t === "cnpj" ? formatCNPJ(v) : formatCPF(v);

const pixKeyLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};

export default function Identidade() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { data: pixKeys = [] } = usePixKeys();
  const { data: bankAccounts = [] } = useBankAccounts();
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [kycDocs, setKycDocs] = useState<Record<string, string | null>>({ front: null, back: null, selfie: null, cnpj_card: null });
  const [uploading, setUploading] = useState<string | null>(null);
  const [nicknameInit, setNicknameInit] = useState(false);
  const [searchParams] = useSearchParams();
  const kycRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (searchParams.get("scrollTo") === "kyc" && kycRef.current && !scrolled.current) {
      scrolled.current = true;
      setTimeout(() => kycRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
    }
  }, [searchParams]);

  useEffect(() => {
    if (profile && !nicknameInit) {
      setNickname(profile.nickname || "");
      setNicknameInit(true);
    }
  }, [profile, nicknameInit]);

  useEffect(() => { loadKycDocs(); }, [user, profile?.document_type]);

  const loadKycDocs = async () => {
    if (!user) return;
    const isCnpj = profile?.document_type === "cnpj";
    const types = isCnpj ? ["front", "back", "selfie", "cnpj_card"] : ["front", "back", "selfie"];
    const results = await Promise.all(
      types.map(t => supabase.storage.from("kyc-documents").list(`${user.id}`, { search: t }))
    );
    const docs: Record<string, string | null> = { front: null, back: null, selfie: null, cnpj_card: null };
    // KYC bucket é privado — usar signed URLs (1h) em vez de getPublicUrl
    await Promise.all(types.map(async (t, i) => {
      const data = results[i].data;
      if (data && data.length > 0) {
        const { data: signed } = await supabase.storage
          .from("kyc-documents")
          .createSignedUrl(`${user.id}/${data[0].name}`, 3600);
        docs[t] = signed?.signedUrl || null;
      }
    }));
    setKycDocs(docs);
  };

  const handleUpload = async (type: string, file: File) => {
    if (!user) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(file.type)) { toast.error("Formato inválido"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB"); return; }
    setUploading(type);
    const mimeExt: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
    const ext = mimeExt[file.type] || "bin";
    const path = `${user.id}/${type}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true });
    if (error) toast.error("Erro no upload"); else { toast.success("Documento enviado"); await loadKycDocs(); }
    setUploading(null);
  };

  const handleSaveNickname = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ nickname }).eq("user_id", user.id);
    if (error) toast.error("Erro ao salvar"); else toast.success("Apelido atualizado");
    setSaving(false);
  };

  const isCnpj = profile?.document_type === "cnpj";
  const status = STATUS_MAP[profile?.account_status || "pending_review"] || STATUS_MAP.pending_review;
  const StatusIcon = status.icon;
  const completionSteps = [
    { label: "Dados pessoais", done: !!(profile?.full_name && profile?.email) },
    { label: "Documento",      done: !!profile?.document_number },
    { label: "Telefone",       done: !!profile?.phone },
    { label: "Chave PIX",      done: pixKeys.length > 0 },
    { label: "Doc. frente",    done: !!kycDocs.front },
    { label: "Doc. verso",     done: !!kycDocs.back },
    { label: "Selfie c/ doc",  done: !!kycDocs.selfie },
    ...(isCnpj ? [{ label: "Cartão CNPJ", done: !!kycDocs.cnpj_card }] : []),
  ];
  const doneCount = completionSteps.filter(s => s.done).length;
  const pct = Math.round((doneCount / completionSteps.length) * 100);
  const isApproved = profile?.account_status === "approved";
  const formattedDoc = profile?.document_number
    ? formatDoc(profile.document_number, profile.document_type || "cpf")
    : "Não informado";

  const KPIS = [
    { icon: Fingerprint, label: "Verificação",  value: `${pct}%`,             sub: `${doneCount}/${completionSteps.length} etapas` },
    { icon: Wallet,      label: "Chaves PIX",   value: `${pixKeys.length}/3`, sub: pixKeys.length ? "Cadastradas" : "Nenhuma" },
    { icon: Building2,   label: "Contas Bancárias", value: bankAccounts.length, sub: bankAccounts.length ? "Vinculadas" : "Nenhuma" },
    { icon: Shield,      label: "Status",       value: status.label,          sub: isApproved ? "Saques liberados" : "Aguardando aprovação" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">Identidade & KYC</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <Fingerprint className="h-3.5 w-3.5 text-primary" />
            Verifique sua conta para liberar saques
          </p>
        </div>
        <div className={cn(
          "inline-flex items-center gap-2 px-4 h-11 rounded-xl border border-current/15",
          status.bg, status.color
        )}>
          <StatusIcon className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-[11px] font-black uppercase tracking-widest">{status.label}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-card p-8 rounded-[24px] border border-border/60 shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-3">
                  <Icon size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em]">{k.label}</span>
                </div>
                <p className="text-3xl font-black text-foreground tabular-nums tracking-tighter">{k.value}</p>
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase mt-2 truncate tracking-widest">{k.sub}</p>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
                <Icon size={160} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar + steps */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <CheckCircle2 size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Progresso</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{doneCount}/{completionSteps.length} etapas concluídas</p>
            </div>
          </div>
          <span className="text-3xl font-black text-foreground tabular-nums tracking-tighter">{pct}%</span>
        </div>
        <div className="p-6">
          <div className="h-2 rounded-full bg-muted/40 border border-border/40 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-[width] duration-700"
              style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
            {completionSteps.map(step => (
              <div key={step.label} className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-xl border",
                step.done ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/20 border-border/40"
              )}>
                {step.done
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  : <div className="h-3.5 w-3.5 rounded-full border border-border/60 shrink-0" />}
                <span className={cn("text-[10px] font-black uppercase tracking-widest truncate",
                  step.done ? "text-emerald-500" : "text-muted-foreground/60")}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dados Pessoais + PIX/Bancos */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border/40 flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <UserCircle size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Dados Pessoais</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Imutáveis após cadastro</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/40">
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Campos travados por segurança KYC · Apenas o apelido é editável
              </p>
            </div>
            <LockedField label="Nome completo" value={profile?.full_name || "—"} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LockedField label="E-mail" value={profile?.email || "—"} />
              <LockedField label="Telefone" value={profile?.phone || "—"} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LockedField label={isCnpj ? "CNPJ" : "CPF"} value={formattedDoc} mono />
              <LockedField label="Tipo Documento" value={(profile?.document_type || "cpf").toUpperCase()} />
            </div>

            <div className="pt-4 border-t border-border/40">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                <Edit3 className="h-3 w-3" /> Apelido (editável)
              </label>
              <div className="flex gap-2">
                <Input value={nickname} onChange={(e) => setNickname(e.target.value)}
                  className="h-11 rounded-xl flex-1 bg-muted/20 border-border/60 font-bold"
                  placeholder="Como quer ser chamado?" />
                <button onClick={handleSaveNickname} disabled={saving}
                  className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-90 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={3} />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* PIX */}
          <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Wallet size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Chaves PIX</h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Cadastre em Saques</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-muted/30 border border-border/60 tabular-nums">
                {pixKeys.length}/3
              </span>
            </div>
            <div className="p-4">
              {pixKeys.length === 0 ? (
                <div className="text-center py-6 opacity-40">
                  <Wallet className="h-7 w-7 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma chave</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pixKeys.map(pk => (
                    <div key={pk.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/10">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
                        <Fingerprint className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">{pixKeyLabels[pk.key_type] || pk.key_type}</p>
                        <p className="font-mono text-[11px] text-foreground truncate font-bold">{pk.key_value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bancos */}
          <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Building2 size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Contas Bancárias</h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Cadastre em Saques</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-muted/30 border border-border/60 tabular-nums">
                {bankAccounts.length}
              </span>
            </div>
            <div className="p-4">
              {bankAccounts.length === 0 ? (
                <div className="text-center py-6 opacity-40">
                  <Building2 className="h-7 w-7 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma conta</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bankAccounts.map(acc => (
                    <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/10">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-black text-foreground tracking-tight">{acc.bank_name}</p>
                        <p className="text-[10px] font-bold font-mono text-muted-foreground/70">Ag. {acc.agency} · Cc. {acc.account_number}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KYC Documentos */}
      <div ref={kycRef} className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
            <FileCheck size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="font-black text-foreground tracking-tight leading-none uppercase">Documentos KYC</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Envie para liberar saques</p>
          </div>
        </div>

        <div className="p-6">
          {(!kycDocs.front || !kycDocs.back || !kycDocs.selfie || (isCnpj && !kycDocs.cnpj_card)) && !isApproved && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                Envie todos os documentos abaixo para completar a verificação.
                {isCnpj && " Como seu cadastro é CNPJ, o Cartão CNPJ também é obrigatório."}
              </p>
            </div>
          )}

          <div className={cn("grid grid-cols-1 gap-3", isCnpj ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3")}>
            <DocSlot type="front"     label="Documento (Frente)" desc="RG, CNH ou doc. com foto"   icon={ImageIcon}  preview={kycDocs.front}     uploading={uploading === "front"}     onUpload={(f) => handleUpload("front", f)} />
            <DocSlot type="back"      label="Documento (Verso)"  desc="Verso do mesmo documento"   icon={ImageIcon}  preview={kycDocs.back}      uploading={uploading === "back"}      onUpload={(f) => handleUpload("back", f)} />
            <DocSlot type="selfie"    label="Selfie c/ Documento" desc="Doc. ao lado do rosto"     icon={Camera}     preview={kycDocs.selfie}    uploading={uploading === "selfie"}    onUpload={(f) => handleUpload("selfie", f)} />
            {isCnpj && (
              <DocSlot type="cnpj_card" label="Cartão CNPJ"        desc="Comprovante de inscrição" icon={Building2}  preview={kycDocs.cnpj_card} uploading={uploading === "cnpj_card"} onUpload={(f) => handleUpload("cnpj_card", f)} />
            )}
          </div>

          {kycDocs.front && kycDocs.back && kycDocs.selfie && (!isCnpj || kycDocs.cnpj_card) && (
            <div className="mt-5 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <Info className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Todos os documentos enviados — aguarde aprovação ou contate o suporte.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LockedField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
        <Lock className="h-3 w-3" /> {label}
      </label>
      <div className={cn(
        "h-11 rounded-xl border border-border/60 bg-muted/20 flex items-center px-3.5 text-sm text-foreground/80 font-bold",
        mono && "font-mono"
      )}>
        {value}
      </div>
    </div>
  );
}

function DocSlot({ type, label, desc, icon: Icon, preview, uploading, onUpload }: {
  type: string; label: string; desc: string; icon: any; preview: string | null;
  uploading: boolean; onUpload: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const locked = !!preview;
  const canUpload = !locked && !uploading;
  return (
    <div
      onClick={() => canUpload && ref.current?.click()}
      className={cn(
        "relative flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all group",
        locked
          ? "bg-emerald-500/5 border-emerald-500/20 cursor-default"
          : "bg-muted/20 border-border/60 cursor-pointer hover:border-primary/40 hover:bg-muted/30"
      )}
    >
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />

      <div className={cn(
        "h-14 w-14 rounded-2xl border flex items-center justify-center",
        locked
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
          : "bg-card border-border/60 text-muted-foreground/60 group-hover:text-primary group-hover:border-primary/40"
      )}>
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" />
                   : locked ? <CheckCircle2 className="h-6 w-6" strokeWidth={2.5} />
                            : <Icon className="h-5 w-5" />}
      </div>

      <div className="text-center">
        <p className={cn("text-[12px] font-black tracking-tight",
          locked ? "text-emerald-500" : "text-foreground")}>{label}</p>
        <p className="text-[10px] font-bold text-muted-foreground/70 mt-1 uppercase tracking-widest leading-tight max-w-[180px]">
          {locked ? "Enviado" : desc}
        </p>
      </div>

      {!locked && !uploading && (
        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          <Upload className="h-3 w-3" />
          <span>Clique para enviar</span>
        </div>
      )}

      {locked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-3.5 w-3.5 text-emerald-500/60" />
        </div>
      )}
    </div>
  );
}
