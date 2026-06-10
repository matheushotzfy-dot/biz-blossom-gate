/**
 * Perfil — Billion-Dollar SaaS account page
 * @module Perfil
 * @version 8.0.0 — Premium redesign aligned with Minhas Vendas standard
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  User, Camera, Trophy, Wallet, Shield, BadgeCheck,
  Calendar, Fingerprint, Copy, Check, MapPin, Loader2,
  AlertTriangle, Lock, Activity, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FinanceiroHero } from "@/components/financeiro/FinanceiroHero";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─────────── Constants & helpers ─────────── */
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

const fmtCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtCompact = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`
  : v >= 1_000 ? `R$ ${(v / 1_000).toFixed(0)}K`
  : fmtCurrency(v);

const TIER_LABELS = ["Iniciante", "Prata", "Ouro", "Diamante", "Platina", "Lendário"];

/* ─────────── Subcomponents ─────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="h-6 w-6 rounded-md hover:bg-secondary flex items-center justify-center transition-colors shrink-0"
      title="Copiar"
      type="button"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground/60" />}
    </button>
  );
}

function InfoRow({ label, value, copyable, locked, valueClass }: {
  label: string; value: React.ReactNode; copyable?: string; locked?: boolean; valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {locked && <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
        <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn("text-sm font-bold text-foreground tabular-nums truncate", valueClass)}>
          {value}
        </span>
        {copyable && <CopyButton text={copyable} />}
      </div>
    </div>
  );
}

function Panel({
  icon: Icon, title, subtitle, action, children, className,
}: {
  icon: any; title: string; subtitle?: string; action?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/50 bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-black text-foreground tracking-[-0.01em]">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children, locked }: { children: React.ReactNode; locked?: boolean }) {
  return (
    <Label className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.14em] flex items-center gap-1.5">
      {locked && <Lock className="h-2.5 w-2.5" />}
      {children}
    </Label>
  );
}

/* ─────────── Page ─────────── */
export default function Perfil() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [allTimeRevenue, setAllTimeRevenue] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [last30Sales, setLast30Sales] = useState(0);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [addressForm, setAddressForm] = useState({
    zip_code: "", street: "", street_number: "", complement: "",
    neighborhood: "", city: "", state: "",
  });
  const [savingAddress, setSavingAddress] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLDivElement>(null);
  const [formInit, setFormInit] = useState(false);
  const [addressInit, setAddressInit] = useState(false);
  const [addressHighlight, setAddressHighlight] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("focus") === "address") {
      setTimeout(() => {
        addressRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setAddressHighlight(true);
        setTimeout(() => setAddressHighlight(false), 4000);
        const next = new URLSearchParams(searchParams);
        next.delete("focus");
        setSearchParams(next, { replace: true });
      }, 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    supabase.from("transactions")
      .select("net_amount, created_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .then(({ data }) => {
        if (!data) return;
        setAllTimeRevenue(data.reduce((a, t) => a + Number(t.net_amount), 0));
        setTotalSales(data.length);
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        setLast30Sales(data.filter(t => new Date(t.created_at).getTime() >= cutoff).length);
      });
   }, [user]);

  const [maxTicket, setMaxTicket] = useState<number | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_max_ticket" as any).then(({ data }) => {
      if (typeof data === "number") setMaxTicket(data);
    });
  }, [user]);

  const isAddressLocked = !!(profile as any)?.address_locked;
  const hasAddress = !!(profile as any)?.zip_code && !!(profile as any)?.street
    && !!(profile as any)?.street_number && !!(profile as any)?.city && !!(profile as any)?.state;
  const milestone = useMemo(() => getCurrentMilestone(allTimeRevenue), [allTimeRevenue]);

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
    if (Object.keys(updates).length === 0) {
      toast.info("Todos os campos estão bloqueados por KYC");
      setSaving(false);
      return;
    }
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

  const statusMap: Record<string, { label: string; tone: "success" | "warning" | "destructive" | "info" }> = {
    approved: { label: "Verificada", tone: "success" },
    pending_review: { label: "Em análise", tone: "warning" },
    rejected: { label: "Reprovada", tone: "destructive" },
    blocked: { label: "Bloqueada", tone: "destructive" },
  };
  const accStatus = statusMap[profile?.account_status || "pending_review"] || statusMap.pending_review;

  const memberDays = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const tierLabel = TIER_LABELS[milestone.tier] || "Iniciante";

  const initials = (profile?.full_name || "U").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  return (
    <div className="container mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* HERO */}
      <FinanceiroHero
        eyebrow="MEU PERFIL"
        title="Identidade & Conta"
        subtitle="Dados cadastrais, limites operacionais, progresso de faturamento e endereço fiscal."
        status={{ tone: accStatus.tone === "destructive" ? "destructive" : accStatus.tone, label: `Conta ${accStatus.label}`, pulse: accStatus.tone === "warning" }}
      />

      {/* Quick info strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Membro há</p>
          <p className="text-lg font-display font-black text-foreground tabular-nums mt-1">{memberDays}d</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Vendas</p>
          <p className="text-lg font-display font-black text-foreground tabular-nums mt-1">{totalSales.toLocaleString("pt-BR")}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{last30Sales} nos últimos 30d</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Tier</p>
          <p className="text-lg font-display font-black text-foreground mt-1">{tierLabel}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{milestone.pct.toFixed(0)}% até {milestone.next.label}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Status</p>
          <p className={cn("text-lg font-display font-black mt-1",
            accStatus.tone === "success" && "text-success",
            accStatus.tone === "warning" && "text-warning",
            accStatus.tone === "destructive" && "text-destructive",
          )}>{accStatus.label}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">Conta verificada via KYC</p>
        </div>
      </div>

      {/* IDENTITY CARD */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden animate-fade-in stagger-2">
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
              className="relative h-[88px] w-[88px] rounded-xl overflow-hidden cursor-pointer border border-border/60 hover:border-primary/60 transition-colors group bg-secondary"
              onClick={() => fileRef.current?.click()}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-2xl font-display font-black text-muted-foreground/70 tracking-tight">
                    {initials}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-4 w-4 text-foreground" />
              </div>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <h2 className="text-2xl md:text-[28px] font-display font-black text-foreground tracking-[-0.025em] leading-tight truncate">
                {profile?.full_name || "Usuário"}
              </h2>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border",
                accStatus.tone === "success" && "text-success bg-success/10 border-success/20",
                accStatus.tone === "warning" && "text-warning bg-warning/10 border-warning/20",
                accStatus.tone === "destructive" && "text-destructive bg-destructive/10 border-destructive/20",
              )}>
                <BadgeCheck className="h-3 w-3" />
                {accStatus.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums truncate mb-2.5">
              {profile?.email || "—"}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
                <Fingerprint className="h-3 w-3" />
                {profile?.seller_type === "empresa" ? "Pessoa Jurídica" : "Pessoa Física"}
              </span>
              {profile?.document_number && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border/40 text-[10px] font-bold text-muted-foreground tabular-nums">
                  <Shield className="h-3 w-3" /> ***{profile.document_number.slice(-4)}
                </span>
              )}
              {profile?.nickname && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border border-border/40 text-[10px] font-bold text-muted-foreground">
                  <User className="h-3 w-3" /> @{profile.nickname}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GRID: Dados / Detalhes / Limites / Progresso */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in stagger-3">
        {/* DADOS PESSOAIS */}
        <Panel icon={User} title="Dados pessoais" subtitle="Informações verificadas pelo KYC">
          <form onSubmit={handleSave} className="p-5 space-y-4">
            <div>
              <FieldLabel locked={!!profile?.full_name}>Nome completo</FieldLabel>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="mt-1.5 h-10 rounded-lg"
                disabled={!!profile?.full_name}
              />
            </div>
            <div>
              <FieldLabel locked={!!profile?.email}>E-mail</FieldLabel>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1.5 h-10 rounded-lg"
                type="email"
                disabled={!!profile?.email}
              />
            </div>
            <div>
              <FieldLabel locked={!!profile?.phone}>Telefone</FieldLabel>
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
              className="w-full h-10 rounded-lg text-sm font-bold"
              disabled={saving}
            >
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Salvar alterações"}
            </Button>
          </form>
        </Panel>

        {/* DETALHES DA CONTA */}
        <Panel icon={Shield} title="Detalhes da conta" subtitle="Identificação e segurança">
          <div className="px-5 pb-5">
            <InfoRow
              label="Tipo de conta"
              value={profile?.seller_type === "empresa" ? "Empresa" : "Pessoa Física"}
            />
            <InfoRow
              label="Documento"
              value={profile?.document_number ? `***${profile.document_number.slice(-4)}` : <span className="text-muted-foreground/50 font-medium">Não informado</span>}
            />
            <InfoRow
              label="Chave PIX"
              value={profile?.pix_key ? `***${profile.pix_key.slice(-4)}` : <span className="text-muted-foreground/50 font-medium">Não cadastrada</span>}
            />
            <InfoRow
              label="Membro desde"
              value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"}
            />
            <InfoRow
              label="Nickname"
              value={profile?.nickname || <span className="text-muted-foreground/50 font-medium">Não definido</span>}
            />
            {user?.id && (
              <InfoRow
                label="ID da conta"
                value={<span className="font-mono text-[11px]">{user.id}</span>}
                copyable={user.id}
              />
            )}
          </div>
        </Panel>

        {/* LIMITES OPERACIONAIS */}
        <Panel icon={Wallet} title="Limites operacionais" subtitle="Parâmetros vigentes da sua conta">
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
        <Panel
          icon={Trophy}
          title="Progresso de faturamento"
          subtitle={`Próxima meta: ${milestone.next.label}`}
          action={
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-[0.1em]">
              <Sparkles className="h-3 w-3" /> {tierLabel}
            </span>
          }
        >
          <div className="p-5">
            <div className="grid grid-cols-3 gap-px bg-border/40 rounded-lg overflow-hidden border border-border/40 mb-5">
              <div className="bg-card px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground mb-1">Total</p>
                <p className="text-base font-display font-black text-foreground tabular-nums tracking-tight">
                  {fmtCompact(allTimeRevenue)}
                </p>
              </div>
              <div className="bg-card px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground mb-1">Meta</p>
                <p className="text-base font-display font-black text-primary tabular-nums tracking-tight">
                  {milestone.next.label}
                </p>
              </div>
              <div className="bg-card px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground mb-1">Falta</p>
                <p className="text-base font-display font-black text-foreground/70 tabular-nums tracking-tight">
                  {fmtCompact(Math.max(0, milestone.next.value - allTimeRevenue))}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-foreground tabular-nums">{milestone.pct.toFixed(0)}%</span>
                <span className="text-[10px] text-muted-foreground tabular-nums font-bold uppercase tracking-[0.12em]">
                  até {milestone.next.label}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden border border-border/40">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${Math.max(milestone.pct, 2)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/40">
              {MILESTONES.slice(1).map((m) => {
                const unlocked = allTimeRevenue >= m.value;
                return (
                  <div key={m.label} className="flex flex-col items-center gap-1.5">
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full transition-colors border",
                      unlocked ? "bg-primary border-primary" : "bg-secondary border-border/60"
                    )} />
                    <span className={cn(
                      "text-[10px] font-bold tabular-nums",
                      unlocked ? "text-primary" : "text-muted-foreground/50"
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

      {/* ENDEREÇO */}
      <div
        ref={addressRef}
        className={cn(
          "rounded-xl transition-all duration-500",
          addressHighlight && "ring-4 ring-warning/60 ring-offset-2 ring-offset-background animate-pulse"
        )}
      >
        {addressHighlight && !isAddressLocked && (
          <div className="mb-3 p-4 rounded-xl bg-warning text-warning-foreground border-2 border-warning shadow-lg flex items-start gap-3 animate-fade-in">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black uppercase tracking-wide">Atenção!</p>
              <p className="text-xs font-medium mt-1">Para realizar saques, preencha seu endereço corretamente abaixo.</p>
            </div>
          </div>
        )}
      <Panel
        icon={MapPin}
        title="Endereço do vendedor"
        subtitle={isAddressLocked ? "Bloqueado — contate seu gerente para alterações" : "Obrigatório para realizar saques"}
        action={isAddressLocked ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-success/10 border border-success/20 text-success uppercase tracking-[0.1em]">
            <Lock className="h-3 w-3" /> Bloqueado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-warning/10 border border-warning/20 text-warning uppercase tracking-[0.1em]">
            <Activity className="h-3 w-3" /> Editável
          </span>
        )}
        className="animate-fade-in stagger-4"
      >
        <div className="p-5">
          {!hasAddress && !isAddressLocked && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-warning/10 border border-warning/20 mb-5">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning font-bold">
                Preencha seu endereço para realizar saques na plataforma.
              </p>
            </div>
          )}

          <form onSubmit={handleSaveAddress} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <FieldLabel locked={isAddressLocked}>CEP</FieldLabel>
                <div className="relative">
                  <Input
                    value={addressForm.zip_code}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                      setAddressForm(prev => ({ ...prev, zip_code: formatted }));
                      if (v.length === 8) handleCepLookup(v);
                    }}
                    className="mt-1.5 h-10 rounded-lg tabular-nums"
                    placeholder="00000-000"
                    disabled={isAddressLocked}
                    inputMode="numeric"
                  />
                  {loadingCep && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 animate-spin text-primary" />}
                </div>
              </div>
              <div className="md:col-span-2">
                <FieldLabel locked={isAddressLocked}>Rua / Avenida</FieldLabel>
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
                <FieldLabel locked={isAddressLocked}>Número</FieldLabel>
                <Input
                  value={addressForm.street_number}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, street_number: e.target.value }))}
                  className="mt-1.5 h-10 rounded-lg tabular-nums"
                  placeholder="123"
                  disabled={isAddressLocked}
                />
              </div>
              <div>
                <FieldLabel>Complemento</FieldLabel>
                <Input
                  value={addressForm.complement}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, complement: e.target.value }))}
                  className="mt-1.5 h-10 rounded-lg"
                  placeholder="Apto 42"
                  disabled={isAddressLocked}
                />
              </div>
              <div>
                <FieldLabel locked={isAddressLocked}>Bairro</FieldLabel>
                <Input
                  value={addressForm.neighborhood}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                  className="mt-1.5 h-10 rounded-lg"
                  placeholder="Centro"
                  disabled={isAddressLocked}
                />
              </div>
              <div>
                <FieldLabel locked={isAddressLocked}>Estado</FieldLabel>
                <Input
                  value={addressForm.state}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
                  className="mt-1.5 h-10 rounded-lg uppercase tabular-nums"
                  placeholder="SP"
                  disabled={isAddressLocked}
                />
              </div>
            </div>

            <div>
              <FieldLabel locked={isAddressLocked}>Cidade</FieldLabel>
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
                  className="w-full h-10 rounded-lg text-sm font-bold"
                  disabled={savingAddress}
                >
                  {savingAddress ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    <><MapPin className="h-4 w-4 mr-2" /> Salvar endereço</>
                  )}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground/70 font-medium">
                  Após salvar, o endereço será <span className="font-bold text-warning">bloqueado</span>. Para alterar, contate seu gerente.
                </p>
              </>
            )}
          </form>
        </div>
      </Panel>
      </div>
    </div>
  );
}
