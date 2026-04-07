/**
 * Identidade & KYC — Ultra-Premium Verification Page
 * @module Identidade
 * @version 4.0.0 — Fintech Premium Redesign
 */

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePixKeys, useBankAccounts } from "@/hooks/useQueryData";
import {
  UserCircle, Save, Shield, FileCheck, Key, CheckCircle2,
  Upload, Camera, Image, Loader2, Lock, Info, Fingerprint,
  Wallet, BadgeCheck, Building2, CreditCard, Edit3, Zap,
  Eye, Star, TrendingUp, ArrowUp, Globe, Award, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

/* ─── Status Map ─── */
const STATUS_MAP: Record<string, { label: string; cls: string; ring: string; icon: any }> = {
  approved: { label: "Conta Verificada", cls: "text-success bg-success/8", ring: "ring-success/15", icon: BadgeCheck },
  pending_review: { label: "Em Análise", cls: "text-warning bg-warning/8", ring: "ring-warning/15", icon: Shield },
  rejected: { label: "Reprovada", cls: "text-destructive bg-destructive/8", ring: "ring-destructive/15", icon: Shield },
  blocked: { label: "Bloqueada", cls: "text-destructive bg-destructive/8", ring: "ring-destructive/15", icon: Shield },
};

/* ─── CPF/CNPJ formatting ─── */
function formatCPF(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function formatCNPJ(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
function formatDocument(value: string, type: string): string {
  return type === "cnpj" ? formatCNPJ(value) : formatCPF(value);
}

const pixKeyTypeLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};

/* ─── Live Pulse ─── */
function LivePulse() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
        <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-success/40 animate-ping" />
      </div>
      <span className="text-[9px] font-display font-bold text-success/70 uppercase tracking-[0.15em]">Seguro</span>
    </div>
  );
}

/* ─── Completion Ring ─── */
function CompletionRing({ pct }: { pct: number }) {
  const circ = 2 * Math.PI * 20;
  const offset = circ - (pct / 100) * circ;
  const color = pct === 100 ? "hsl(var(--success))" : pct >= 60 ? "hsl(var(--primary))" : "hsl(var(--warning))";
  return (
    <div className="relative h-16 w-16">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--border) / 0.1)" strokeWidth="3" />
        <motion.circle
          cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, delay: 0.3, ease }}
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[13px] font-display font-black tabular-nums" style={{ color }}>{pct}%</span>
      </div>
    </div>
  );
}

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
  const [searchParams] = useSearchParams();
  const kycSectionRef = useRef<HTMLDivElement>(null);
  const hasScrolledToKyc = useRef(false);

  // Auto-scroll to KYC docs section when coming from verification banner
  useEffect(() => {
    const scrollTo = searchParams.get("scrollTo");
    if (scrollTo === "kyc" && kycSectionRef.current && !hasScrolledToKyc.current) {
      hasScrolledToKyc.current = true;
      setTimeout(() => {
        kycSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 600);
    }
  }, [searchParams]);

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
    const results = await Promise.all(
      types.map(type => supabase.storage.from("kyc-documents").list(`${user.id}`, { search: type }))
    );
    const docs: Record<string, string | null> = {};
    types.forEach((type, i) => {
      const data = results[i].data;
      if (data && data.length > 0) {
        const { data: urlData } = supabase.storage.from("kyc-documents").getPublicUrl(`${user.id}/${data[0].name}`);
        docs[type] = urlData?.publicUrl || null;
      } else {
        docs[type] = null;
      }
    });
    setKycDocs(docs);
  };

  const handleUpload = async (type: string, file: File) => {
    if (!user) return;
    const ALLOWED_KYC_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!ALLOWED_KYC_TYPES.includes(file.type)) { toast.error("Formato inválido. Use JPEG, PNG, WebP ou HEIC"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB"); return; }
    setUploading(type);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${type}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
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
  const StatusIcon = status.icon;
  const completionSteps = [
    { label: "Dados pessoais", done: !!(profile?.full_name && profile?.email), icon: UserCircle },
    { label: "Documento", done: !!profile?.document_number, icon: Fingerprint },
    { label: "Telefone", done: !!profile?.phone, icon: Zap },
    { label: "Chave PIX", done: pixKeys.length > 0, icon: Wallet },
    { label: "Doc. frente", done: !!kycDocs.front, icon: Image },
    { label: "Doc. verso", done: !!kycDocs.back, icon: Image },
    { label: "Selfie c/ doc", done: !!kycDocs.selfie, icon: Camera },
  ];
  const completionPct = Math.round((completionSteps.filter((s) => s.done).length / completionSteps.length) * 100);
  const isApproved = profile?.account_status === "approved";
  const formattedDoc = profile?.document_number
    ? formatDocument(profile.document_number, profile.document_type || "cpf")
    : "Não informado";

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative space-y-5">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.18, 0.1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-48 -right-48 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[200px]" />
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.06, 0.12, 0.06] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-info/15 rounded-full blur-[180px]" />
      </div>

      {/* ═══ HERO ═══ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-info/3 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

        <div className="relative z-10 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
                <Fingerprint className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground/40">Identidade & KYC</span>
            </div>
            <LivePulse />
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ease }} className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Completion ring */}
            <CompletionRing pct={completionPct} />

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-display font-black tracking-[-0.04em] text-foreground">Verificação de Conta</h1>
                <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-display font-bold ring-1", status.cls, status.ring)}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/40 font-medium">Complete todos os passos para liberar saques e funcionalidades premium</p>
            </div>

            {/* Steps counter */}
            <div className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted/5 ring-1 ring-border/10 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-display font-bold text-foreground/60 tabular-nums">
                {completionSteps.filter(s => s.done).length}/{completionSteps.length}
              </span>
              <span className="text-[10px] text-muted-foreground/30">etapas</span>
            </div>
          </motion.div>

          {/* Approved Banner */}
          {isApproved && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }} className="mt-5 rounded-xl bg-success/5 ring-1 ring-success/15 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-success/10 ring-1 ring-success/20 flex items-center justify-center shrink-0">
                <BadgeCheck className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-[12px] font-display font-bold text-success">Conta Verificada com Sucesso</p>
                <p className="text-[10px] text-success/60">Todas as funcionalidades estão liberadas. Saques habilitados.</p>
              </div>
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* ═══ Steps Checklist ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, ease }}
        className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-8 w-8 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[11px] font-display font-black text-foreground/70">Progresso da Verificação</span>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 rounded-full bg-muted/10 ring-1 ring-border/8 overflow-hidden mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 1.2, delay: 0.3, ease }}
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 relative"
              style={{ boxShadow: "0 0 12px hsl(var(--primary) / 0.3)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </motion.div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {completionSteps.map((step, idx) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + idx * 0.04, ease }}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-xl ring-1 transition-all duration-300",
                  step.done ? "bg-primary/5 ring-primary/10" : "bg-muted/3 ring-border/8"
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full ring-1 ring-border/20 shrink-0" />
                )}
                <span className={cn(
                  "text-[9px] font-display font-bold truncate",
                  step.done ? "text-primary/60" : "text-muted-foreground/30"
                )}>{step.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ═══ Main Content Grid ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── Dados Pessoais ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, ease }}
          className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 md:p-6 overflow-hidden hover:ring-border/40 transition-all duration-300"
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-info" />
          <div className="absolute inset-0 bg-gradient-to-br from-info/[0.02] to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-9 w-9 rounded-xl bg-info/8 ring-1 ring-info/15 flex items-center justify-center">
                <UserCircle className="h-4 w-4 text-info" />
              </div>
              <div>
                <p className="text-[11px] font-display font-black text-foreground/70">Dados Pessoais</p>
                <p className="text-[9px] text-muted-foreground/40">Informações imutáveis após cadastro</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-info/5 ring-1 ring-info/10">
              <Lock className="h-3.5 w-3.5 shrink-0 text-info/60" />
              <p className="text-[10px] font-medium text-info/60">Campos travados por segurança KYC. Apenas o apelido é editável.</p>
            </div>

            <div className="space-y-3">
              <LockedField label="Nome completo" value={profile?.full_name || "—"} />
              <div className="grid grid-cols-2 gap-3">
                <LockedField label="E-mail" value={profile?.email || "—"} />
                <LockedField label="Telefone" value={profile?.phone || "—"} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LockedField label={profile?.document_type === "cnpj" ? "CNPJ" : "CPF"} value={formattedDoc} />
                <LockedField label="Tipo Doc." value={(profile?.document_type || "cpf").toUpperCase()} />
              </div>

              <div className="pt-4 border-t border-border/10">
                <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
                  <Edit3 className="h-2.5 w-2.5" /> Apelido (editável)
                </Label>
                <div className="flex gap-2 mt-1.5">
                  <Input value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-10 rounded-xl flex-1 bg-muted/10 border-border/20" placeholder="Como quer ser chamado?" />
                  <Button onClick={handleSaveNickname} className="rounded-xl font-display font-bold h-10 px-5 shrink-0 shadow-lg shadow-primary/10 active:scale-[0.985]" disabled={saving}>
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── Right Column ─── */}
        <div className="space-y-4">
          {/* Chaves PIX */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, ease }}
            className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 overflow-hidden hover:ring-border/40 transition-all duration-300"
          >
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-[11px] font-display font-black text-foreground/70">Chaves PIX</span>
                </div>
                <span className="text-[9px] font-display font-bold px-2.5 py-1 rounded-lg bg-primary/8 ring-1 ring-primary/15 text-primary tabular-nums">{pixKeys.length}/3</span>
              </div>

              {pixKeys.length === 0 ? (
                <div className="text-center py-6 rounded-xl bg-muted/3 ring-1 ring-border/5">
                  <Wallet className="h-7 w-7 mx-auto mb-2 text-muted-foreground/15" />
                  <p className="text-[11px] text-muted-foreground/30 font-medium">Nenhuma chave cadastrada</p>
                  <p className="text-[9px] text-muted-foreground/20 mt-0.5">Cadastre em Financeiro → Dados Bancários</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pixKeys.map((pk, idx) => (
                    <motion.div
                      key={pk.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + idx * 0.05, ease }}
                      className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-border/10 bg-muted/3 hover:ring-border/20 transition-all"
                    >
                      <div className="h-8 w-8 rounded-lg bg-primary/8 ring-1 ring-primary/12 flex items-center justify-center shrink-0">
                        <Fingerprint className="h-3.5 w-3.5 text-primary/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-primary/50 font-display font-bold uppercase tracking-[0.15em]">{pixKeyTypeLabels[pk.key_type] || pk.key_type}</p>
                        <p className="font-mono text-[12px] text-foreground/70 truncate font-medium">{pk.key_value}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Contas Bancárias */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ease }}
            className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 overflow-hidden hover:ring-border/40 transition-all duration-300"
          >
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-info" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-info/8 ring-1 ring-info/15 flex items-center justify-center">
                    <Building2 className="h-3.5 w-3.5 text-info" />
                  </div>
                  <span className="text-[11px] font-display font-black text-foreground/70">Contas Bancárias</span>
                </div>
                <span className="text-[9px] font-display font-bold px-2.5 py-1 rounded-lg bg-info/8 ring-1 ring-info/15 text-info tabular-nums">{bankAccounts.length}</span>
              </div>

              {bankAccounts.length === 0 ? (
                <div className="text-center py-6 rounded-xl bg-muted/3 ring-1 ring-border/5">
                  <Building2 className="h-7 w-7 mx-auto mb-2 text-muted-foreground/15" />
                  <p className="text-[11px] text-muted-foreground/30 font-medium">Nenhuma conta cadastrada</p>
                  <p className="text-[9px] text-muted-foreground/20 mt-0.5">Cadastre em Financeiro → Dados Bancários</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bankAccounts.map((acc, idx) => (
                    <motion.div
                      key={acc.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 + idx * 0.05, ease }}
                      className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-border/10 bg-muted/3 hover:ring-border/20 transition-all"
                    >
                      <div className="h-8 w-8 rounded-lg bg-info/8 ring-1 ring-info/12 flex items-center justify-center shrink-0">
                        <CreditCard className="h-3.5 w-3.5 text-info/70" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-display font-bold text-foreground/70">{acc.bank_name}</p>
                        <p className="text-[9px] text-muted-foreground/40 font-mono">Ag. {acc.agency} • Cc. {acc.account_number}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Segurança */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, ease }}
            className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 overflow-hidden hover:ring-border/40 transition-all duration-300"
          >
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />

            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-xl bg-success/8 ring-1 ring-success/15 flex items-center justify-center">
                  <Key className="h-3.5 w-3.5 text-success" />
                </div>
                <span className="text-[11px] font-display font-black text-foreground/70">Segurança</span>
              </div>

              <div className="space-y-2">
                {[
                  { icon: Shield, label: "Criptografia SSL", active: true },
                  { icon: FileCheck, label: "LGPD Compliant", active: true },
                  { icon: Key, label: "2FA (Em breve)", active: false },
                ].map((item, idx) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + idx * 0.04, ease }}
                    className="flex items-center justify-between p-3 rounded-xl ring-1 ring-border/8 bg-muted/3 hover:ring-border/15 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center ring-1", item.active ? "bg-success/8 ring-success/12" : "bg-muted/5 ring-border/8")}>
                        <item.icon className={cn("h-3 w-3", item.active ? "text-success/70" : "text-muted-foreground/20")} />
                      </div>
                      <span className="text-[11px] text-foreground/60 font-medium">{item.label}</span>
                    </div>
                    <span className={cn(
                      "text-[8px] font-display font-bold px-2 py-0.5 rounded-lg ring-1",
                      item.active ? "text-success bg-success/8 ring-success/12" : "text-muted-foreground/20 bg-muted/3 ring-border/5"
                    )}>
                      {item.active ? "Ativo" : "Em breve"}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ KYC Documents ═══ */}
      <motion.div
        ref={kycSectionRef}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, ease }}
        className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 md:p-6 overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-warning" />
        <div className="absolute inset-0 bg-gradient-to-br from-warning/[0.02] to-transparent pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-9 w-9 rounded-xl bg-warning/8 ring-1 ring-warning/15 flex items-center justify-center">
              <FileCheck className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-[11px] font-display font-black text-foreground/70">Verificação KYC</p>
              <p className="text-[9px] text-muted-foreground/40">Envie seus documentos para liberar saques</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DocSlot type="front" label="Documento (Frente)" icon={<Image className="h-5 w-5" />} preview={kycDocs.front} uploading={uploading === "front"} onUpload={(f) => handleUpload("front", f)} locked={!!kycDocs.front} />
            <DocSlot type="back" label="Documento (Verso)" icon={<Image className="h-5 w-5" />} preview={kycDocs.back} uploading={uploading === "back"} onUpload={(f) => handleUpload("back", f)} locked={!!kycDocs.back} />
            <DocSlot type="selfie" label="Selfie com Documento" icon={<Camera className="h-5 w-5" />} preview={kycDocs.selfie} uploading={uploading === "selfie"} onUpload={(f) => handleUpload("selfie", f)} locked={!!kycDocs.selfie} />
          </div>

          {kycDocs.front && kycDocs.back && kycDocs.selfie && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-2 text-[10px] text-info p-3 rounded-xl bg-info/5 ring-1 ring-info/10">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">Todos os documentos enviados. Aguarde aprovação ou contate o suporte.</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Sub-components ─── */

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
        <Lock className="h-2.5 w-2.5" /> {label}
      </Label>
      <div className="mt-1.5 h-10 rounded-xl ring-1 ring-border/10 bg-muted/5 flex items-center px-3 text-[13px] text-foreground/60 font-medium">
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
    <motion.div
      whileHover={canUpload ? { scale: 1.01 } : undefined}
      onClick={() => canUpload && ref.current?.click()}
      className={cn(
        "relative flex flex-col items-center gap-3 p-5 rounded-2xl transition-all ring-1 group",
        locked
          ? "bg-primary/3 ring-primary/15 cursor-default"
          : "bg-muted/3 ring-border/10 cursor-pointer hover:ring-primary/20 hover:bg-primary/[0.02]"
      )}
    >
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      
      <div className={cn(
        "h-14 w-14 rounded-2xl flex items-center justify-center ring-1 transition-all duration-300",
        locked ? "bg-primary/10 ring-primary/15 text-primary" : "bg-muted/10 ring-border/10 text-muted-foreground/30 group-hover:ring-primary/15 group-hover:text-primary/50"
      )}>
        {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : locked ? <CheckCircle2 className="h-6 w-6" /> : icon}
      </div>
      
      <div className="text-center">
        <p className={cn("text-[12px] font-display font-bold", locked ? "text-foreground/70" : "text-foreground/50")}>{label}</p>
        <p className={cn("text-[9px] mt-0.5", locked ? "text-primary/50" : "text-muted-foreground/30")}>
          {locked ? "Enviado ✓" : "Clique para enviar"}
        </p>
      </div>

      {locked && (
        <div className="absolute top-3 right-3">
          <Lock className="h-3.5 w-3.5 text-primary/30" />
        </div>
      )}
    </motion.div>
  );
}
