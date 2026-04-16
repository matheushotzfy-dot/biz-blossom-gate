/**
 * Perfil — Trustworthy account page
 * @module Perfil
 * @version 7.0.0 — Operational redesign
 */

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  User, Camera, Trophy, Wallet, Shield, CheckCircle2,
  Calendar, BadgeCheck, Fingerprint, Copy, Check, Zap, ArrowUp,
  Globe, MapPin, Loader2, AlertTriangle, Lock, Star, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell, PageTitle, Panel } from "@/components/PageShell";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MILESTONES = [
  { label: "Início", value: 0 },
  { label: "10K", value: 10000 },
  { label: "100K", value: 100000 },
  { label: "500K", value: 500000 },
  { label: "1M", value: 1000000 },
  { label: "5M", value: 5000000 },
];

function getCurrentMilestone(revenue: number) {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (revenue >= MILESTONES[i].value) {
      const next = MILESTONES[i + 1] || MILESTONES[i];
      const prev = MILESTONES[i];
      const pct = next.value === prev.value ? 100 : ((revenue - prev.value) / (next.value - prev.value)) * 100;
      return { current: prev, next, pct: Math.min(pct, 100), tier: i };
    }
  }
  return { current: MILESTONES[0], next: MILESTONES[1], pct: 0, tier: 0 };
}

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtCompact = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`
  : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}K`
  : fmtCurrency(v);

/* ─── Copy Button ─── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="h-6 w-6 rounded-md hover:bg-muted/30 flex items-center justify-center transition-colors"
      title="Copiar"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground/40" />}
    </button>
  );
}

/* ─── Info Row — ledger-style ─── */
function InfoRow({ label, value, copyable, locked, valueClass }: {
  label: string; value: React.ReactNode; copyable?: string; locked?: boolean; valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/15 last:border-0">
      <div className="flex items-center gap-2">
        {locked && <Lock className="h-3 w-3 text-muted-foreground/40" />}
        <span className="text-xs text-muted-foreground/70 font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn("text-sm font-semibold text-foreground font-numbers", valueClass)}>
          {value}
        </span>
        {copyable && <CopyButton text={copyable} />}
      </div>
    </div>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ icon: Icon, title, subtitle, action }: {
  icon: any; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/20">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-muted-foreground/70" />
        <div>
          <h3 className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground/50 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function Perfil() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [allTimeRevenue, setAllTimeRevenue] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [addressForm, setAddressForm] = useState({ zip_code: "", street: "", street_number: "", complement: "", neighborhood: "", city: "", state: "" });
  const [savingAddress, setSavingAddress] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [formInit, setFormInit] = useState(false);
  const [addressInit, setAddressInit] = useState(false);

  useEffect(() => {
    if (profile && !formInit) {
      setForm({ full_name: profile.full_name || "", email: profile.email || "", phone: profile.phone || "" });
      setFormInit(true);
    }
  }, [profile, formInit]);

  useEffect(() => {
    if (profile && !addressInit) {
      setAddressForm({
        zip_code: (profile as any).zip_code || "",
        street: (profile as any).street || "",
        street_number: (profile as any).street_number || "",
        complement: (profile as any).complement || "",
        neighborhood: (profile as any).neighborhood || "",
        city: (profile as any).city || "",
        state: (profile as any).state || "",
      });
      setAddressInit(true);
    }
  }, [profile, addressInit]);

  useEffect(() => {
    if (!user) return;
    supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed")
      .then(({ data }) => {
        if (data) {
          setAllTimeRevenue(data.reduce((a, t) => a + Number(t.net_amount), 0));
          setTotalSales(data.length);
        }
      });
  }, [user]);

  const isAddressLocked = !!(profile as any)?.address_locked;
  const hasAddress = !!(profile as any)?.zip_code && !!(profile as any)?.street && !!(profile as any)?.street_number && !!(profile as any)?.city && !!(profile as any)?.state;
  const milestone = getCurrentMilestone(allTimeRevenue);

  const handleCepLookup = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddressForm(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch {}
    setLoadingCep(false);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isAddressLocked) return;
    if (!addressForm.zip_code || !addressForm.street || !addressForm.street_number || !addressForm.city || !addressForm.state) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSavingAddress(true);
    const updates = { ...addressForm, address_locked: true };
    const { error } = await supabase.from("profiles").update(updates).eq("user_id", user.id);
    if (error) toast.error("Erro ao salvar endereço");
    else {
      updateProfile(updates as any);
      toast.success("Endereço salvo! Agora você pode realizar saques normalmente.");
    }
    setSavingAddress(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const updates: Record<string, string> = {};
    if (!profile?.full_name) updates.full_name = form.full_name;
    if (!profile?.email) updates.email = form.email;
    if (!profile?.phone) updates.phone = form.phone;
    if (Object.keys(updates).length === 0) { toast.info("Todos os campos estão bloqueados por KYC"); setSaving(false); return; }
    const { error } = await supabase.from("profiles").update(updates).eq("user_id", user.id);
    if (error) toast.error("Erro ao salvar");
    else { updateProfile(updates); toast.success("Perfil atualizado!"); }
    setSaving(false);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) { toast.error("Formato inválido. Use JPEG, PNG ou WebP"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload"); setUploading(false); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("user_id", user.id);
    updateProfile({ avatar_url: data.publicUrl });
    toast.success("Foto atualizada!");
    setUploading(false);
  };

  const statusLabels: Record<string, { label: string; cls: string; icon: any }> = {
    approved: { label: "Verificada", cls: "text-success bg-success/10", icon: BadgeCheck },
    pending_review: { label: "Em análise", cls: "text-warning bg-warning/10", icon: Shield },
    rejected: { label: "Reprovada", cls: "text-destructive bg-destructive/10", icon: Shield },
    blocked: { label: "Bloqueada", cls: "text-destructive bg-destructive/10", icon: Shield },
  };
  const accStatus = statusLabels[profile?.account_status || "pending_review"] || statusLabels.pending_review;
  const StatusIcon = accStatus.icon;

  const memberDays = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const tierLabel = milestone.tier === 0 ? "Iniciante" : milestone.tier === 1 ? "Prata" : milestone.tier === 2 ? "Ouro" : milestone.tier === 3 ? "Diamante" : milestone.tier === 4 ? "Platina" : "Lendário";

  return (
    <PageShell>
      <PageTitle
        icon={<User className="h-6 w-6" />}
        title="Meu Perfil"
        subtitle="Dados cadastrais, limites operacionais e detalhes da conta"
      />

      {/* ═══ ACCOUNT HEADER — sober identification card ═══ */}
      <Panel>
        <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
            />
            <div
              className="relative h-[80px] w-[80px] rounded-xl overflow-hidden cursor-pointer ring-1 ring-border/40 hover:ring-primary/40 transition-all duration-200 group"
              onClick={() => fileRef.current?.click()}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                  <span className="text-2xl font-display font-bold text-muted-foreground/60">
                    {(profile?.full_name || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-4 w-4 text-foreground" />
              </div>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h2 className="text-xl md:text-2xl font-display font-black text-foreground tracking-[-0.02em] leading-tight">
                {profile?.full_name || "Usuário"}
              </h2>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold",
                accStatus.cls
              )}>
                <StatusIcon className="h-3 w-3" />
                {accStatus.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/60 font-numbers truncate">
              {profile?.email || ""}
            </p>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <Calendar className="h-3 w-3" /> Membro há {memberDays} dias
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <Fingerprint className="h-3 w-3" />
                {profile?.seller_type === "empresa" ? "Pessoa Jurídica" : "Pessoa Física"}
              </span>
              {profile?.document_number && (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 font-numbers">
                  <Shield className="h-3 w-3" /> ***{profile.document_number.slice(-4)}
                </span>
              )}
            </div>
          </div>

          {/* Revenue summary */}
          <div className="md:text-right md:pl-6 md:border-l border-border/20 md:min-w-[200px]">
            <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground/60 mb-1">
              Receita líquida total
            </p>
            <p className="text-2xl md:text-3xl font-display font-black text-foreground font-numbers tracking-tight">
              {fmtCurrency(allTimeRevenue)}
            </p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">
              {totalSales} vendas aprovadas · Tier {tierLabel}
            </p>
          </div>
        </div>
      </Panel>

      {/* ═══ Content Grid — 2 columns ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* DADOS PESSOAIS */}
        <Panel>
          <SectionHeader
            icon={User}
            title="Dados pessoais"
            subtitle="Informações verificadas pelo KYC"
          />
          <form onSubmit={handleSave} className="p-5 space-y-4">
            <div>
              <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold flex items-center gap-1.5">
                {profile?.full_name && <Lock className="h-2.5 w-2.5" />} Nome completo
              </Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="mt-1.5 h-10 rounded-lg"
                disabled={!!profile?.full_name}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold flex items-center gap-1.5">
                {profile?.email && <Lock className="h-2.5 w-2.5" />} E-mail
              </Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1.5 h-10 rounded-lg"
                type="email"
                disabled={!!profile?.email}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold flex items-center gap-1.5">
                {profile?.phone && <Lock className="h-2.5 w-2.5" />} Telefone
              </Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1.5 h-10 rounded-lg"
                placeholder="(11) 99999-9999"
                disabled={!!profile?.phone}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-10 rounded-lg text-sm font-bold shadow-md shadow-primary/15"
              disabled={saving}
            >
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar alterações"}
            </Button>
          </form>
        </Panel>

        {/* DETALHES DA CONTA */}
        <Panel>
          <SectionHeader
            icon={Shield}
            title="Detalhes da conta"
            subtitle="Identificação e segurança"
          />
          <div className="px-5 pb-5">
            <InfoRow
              label="Tipo de conta"
              value={profile?.seller_type === "empresa" ? "Empresa" : "Pessoa Física"}
            />
            <InfoRow
              label="Documento"
              value={profile?.document_number ? `***${profile.document_number.slice(-4)}` : <span className="text-muted-foreground/40">Não informado</span>}
            />
            <InfoRow
              label="Chave PIX"
              value={profile?.pix_key ? `***${profile.pix_key.slice(-4)}` : <span className="text-muted-foreground/40">Não cadastrada</span>}
            />
            <InfoRow
              label="Membro desde"
              value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"}
            />
            <InfoRow
              label="Nickname"
              value={profile?.nickname || <span className="text-muted-foreground/40">Não definido</span>}
            />
            {user?.id && (
              <InfoRow
                label="ID da conta"
                value={`${user.id.slice(0, 8)}...`}
                copyable={user.id}
              />
            )}
          </div>
        </Panel>

        {/* LIMITES OPERACIONAIS */}
        <Panel>
          <SectionHeader
            icon={Wallet}
            title="Limites operacionais"
            subtitle="Parâmetros vigentes da sua conta"
          />
          <div className="px-5 pb-5">
            {[
              { label: "Limite diário PIX", value: "Ilimitado", success: true },
              { label: "Limite diário de saque", value: "Ilimitado", success: true },
              { label: "Saques simultâneos", value: "3 pendentes" },
              { label: "Chaves PIX cadastradas", value: "Até 3" },
              { label: "Chaves API", value: "Até 5" },
            ].map((item) => (
              <InfoRow
                key={item.label}
                label={item.label}
                value={item.value}
                valueClass={item.success ? "text-success" : ""}
              />
            ))}
          </div>
        </Panel>

        {/* PROGRESSO DE FATURAMENTO */}
        <Panel>
          <SectionHeader
            icon={Trophy}
            title="Progresso de faturamento"
            subtitle={`Próxima meta: ${milestone.next.label}`}
          />
          <div className="p-5">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted-foreground/60 mb-1">Total</p>
                <p className="text-base font-display font-black text-foreground font-numbers tracking-tight">
                  {fmtCompact(allTimeRevenue)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted-foreground/60 mb-1">Meta</p>
                <p className="text-base font-display font-black text-primary font-numbers tracking-tight">
                  {milestone.next.label}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-muted-foreground/60 mb-1">Falta</p>
                <p className="text-base font-display font-black text-foreground/60 font-numbers tracking-tight">
                  {fmtCompact(Math.max(0, milestone.next.value - allTimeRevenue))}
                </p>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-foreground font-numbers">{milestone.pct.toFixed(0)}%</span>
                <span className="text-[10px] text-muted-foreground/50 font-numbers">{milestone.next.label}</span>
              </div>
              <div className="h-2 rounded-full bg-muted/25 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${Math.max(milestone.pct, 2)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/20">
              {MILESTONES.slice(1).map((m) => {
                const unlocked = allTimeRevenue >= m.value;
                return (
                  <div key={m.label} className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      unlocked ? "bg-primary" : "bg-muted/30"
                    )} />
                    <span className={cn(
                      "text-[10px] font-bold font-numbers",
                      unlocked ? "text-primary" : "text-muted-foreground/40"
                    )}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      </div>

      {/* ═══ ENDEREÇO ═══ */}
      <Panel>
        <SectionHeader
          icon={MapPin}
          title="Endereço do vendedor"
          subtitle={isAddressLocked ? "Bloqueado — contate seu gerente para alterações" : "Obrigatório para realizar saques"}
          action={isAddressLocked ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-success/10 text-success">
              <Lock className="h-3 w-3" /> Bloqueado
            </span>
          ) : null}
        />

        <div className="p-5">
          {!hasAddress && !isAddressLocked && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-warning/8 border border-warning/15 mb-4">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning/90 font-medium">
                Preencha seu endereço para realizar saques na plataforma.
              </p>
            </div>
          )}

          <form onSubmit={handleSaveAddress} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold flex items-center gap-1.5">
                  {isAddressLocked && <Lock className="h-2.5 w-2.5" />} CEP
                </Label>
                <div className="relative">
                  <Input
                    value={addressForm.zip_code}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                      setAddressForm(prev => ({ ...prev, zip_code: formatted }));
                      if (v.length === 8) handleCepLookup(v);
                    }}
                    className="mt-1.5 h-10 rounded-lg"
                    placeholder="00000-000"
                    disabled={isAddressLocked}
                    inputMode="numeric"
                  />
                  {loadingCep && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 animate-spin text-primary" />}
                </div>
              </div>
              <div className="md:col-span-2">
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold flex items-center gap-1.5">
                  {isAddressLocked && <Lock className="h-2.5 w-2.5" />} Rua / Avenida
                </Label>
                <Input
                  value={addressForm.street}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, street: e.target.value }))}
                  className="mt-1.5 h-10 rounded-lg"
                  placeholder="Rua das Flores"
                  disabled={isAddressLocked}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold flex items-center gap-1.5">
                  {isAddressLocked && <Lock className="h-2.5 w-2.5" />} Número
                </Label>
                <Input
                  value={addressForm.street_number}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, street_number: e.target.value }))}
                  className="mt-1.5 h-10 rounded-lg"
                  placeholder="123"
                  disabled={isAddressLocked}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold">
                  Complemento
                </Label>
                <Input
                  value={addressForm.complement}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, complement: e.target.value }))}
                  className="mt-1.5 h-10 rounded-lg"
                  placeholder="Apto 42"
                  disabled={isAddressLocked}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold flex items-center gap-1.5">
                  {isAddressLocked && <Lock className="h-2.5 w-2.5" />} Bairro
                </Label>
                <Input
                  value={addressForm.neighborhood}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                  className="mt-1.5 h-10 rounded-lg"
                  placeholder="Centro"
                  disabled={isAddressLocked}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold flex items-center gap-1.5">
                  {isAddressLocked && <Lock className="h-2.5 w-2.5" />} Estado
                </Label>
                <Input
                  value={addressForm.state}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
                  className="mt-1.5 h-10 rounded-lg"
                  placeholder="SP"
                  disabled={isAddressLocked}
                />
              </div>
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-bold flex items-center gap-1.5">
                {isAddressLocked && <Lock className="h-2.5 w-2.5" />} Cidade
              </Label>
              <Input
                value={addressForm.city}
                onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                className="mt-1.5 h-10 rounded-lg"
                placeholder="São Paulo"
                disabled={isAddressLocked}
              />
            </div>

            {!isAddressLocked && (
              <>
                <Button
                  type="submit"
                  className="w-full h-10 rounded-lg text-sm font-bold shadow-md shadow-primary/15"
                  disabled={savingAddress}
                >
                  {savingAddress ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    <><MapPin className="h-4 w-4 mr-2" /> Salvar endereço</>
                  )}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground/50">
                  Após salvar, o endereço será <span className="font-bold text-warning/80">bloqueado</span>. Para alterar, contate seu gerente.
                </p>
              </>
            )}
          </form>
        </div>
      </Panel>
    </PageShell>
  );
}
