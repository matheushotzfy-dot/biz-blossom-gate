/**
 * Perfil — Ultra-Premium Profile Page
 * @module Perfil
 * @version 6.0.0 — Immersive Premium Redesign
 */

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  User, Camera, Trophy, Wallet, Shield, CheckCircle2, Flame, Zap,
  Crown, Sparkles, Target, TrendingUp, ArrowUp, Star, Lock, Globe,
  Calendar, BadgeCheck, Fingerprint, Copy, Check, Award, Gem, Eye,
  MapPin, Loader2, AlertTriangle, Key, Building2, CreditCard, FileCheck,
  Edit3, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

const MILESTONES = [
  { label: "Início", value: 0, icon: Zap },
  { label: "10K", value: 10000, icon: Star },
  { label: "100K", value: 100000, icon: Flame },
  { label: "500K", value: 500000, icon: Crown },
  { label: "1M", value: 1000000, icon: Gem },
  { label: "5M", value: 5000000, icon: Trophy },
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
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtCompact = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1).replace(".", ",")}M`
  : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}K`
  : fmtCurrency(v);

/* ─── Animated Number ─── */
function AnimatedNumber({ value, formatter = fmtCurrency, duration = 800 }: { value: number; formatter?: (v: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{formatter(display)}</>;
}

/* ─── Copy Button ─── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="h-6 w-6 rounded-lg bg-muted/10 hover:bg-primary/10 flex items-center justify-center transition-all duration-200 group/copy">
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground/30 group-hover/copy:text-primary transition-colors" />}
    </button>
  );
}

/* ─── Section Card ─── */
function SectionCard({ children, accent, glow, delay = 0, className }: {
  children: React.ReactNode; accent: string; glow: string; delay?: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease }}
      className={cn("relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 md:p-6 overflow-hidden hover:ring-border/40 transition-all duration-300 group", className)}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", accent)} />
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-55 transition-opacity duration-500 group-hover:opacity-70", glow)} />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/* ─── Info Row ─── */
function InfoRow({ icon: Icon, label, value, color = "info", delay = 0, copyable }: {
  icon: any; label: string; value: string; color?: string; delay?: number; copyable?: boolean;
}) {
  const tones: Record<string, { iconBg: string; iconRing: string; iconColor: string }> = {
    success: { iconBg: "bg-success/5", iconRing: "ring-success/8", iconColor: "text-success/60" },
    info: { iconBg: "bg-info/5", iconRing: "ring-info/8", iconColor: "text-info/60" },
    primary: { iconBg: "bg-primary/5", iconRing: "ring-primary/8", iconColor: "text-primary/60" },
    warning: { iconBg: "bg-warning/5", iconRing: "ring-warning/8", iconColor: "text-warning/60" },
  };
  const t = tones[color] || tones.info;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, ease }}
      className="flex items-center justify-between py-3 border-b border-border/8 last:border-0 group/item hover:bg-muted/5 rounded-lg px-2 -mx-2 transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center ring-1", t.iconBg, t.iconRing)}>
          <Icon className={cn("h-3 w-3", t.iconColor)} />
        </div>
        <span className="text-[11px] text-muted-foreground/50 font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-[11px] font-display font-semibold truncate max-w-[140px]",
          value === "Ilimitado" ? "text-success font-bold" : "text-foreground/60"
        )}>
          {value}
        </span>
        {copyable && <CopyButton text={value} />}
      </div>
    </motion.div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, tone = "primary", delay = 0, sub }: {
  icon: any; label: string; value: string; tone?: string; delay?: number; sub?: string;
}) {
  const colors: Record<string, { bg: string; ring: string; text: string; accent: string; glow: string }> = {
    primary: { bg: "bg-primary/8", ring: "ring-primary/15", text: "text-primary", accent: "bg-primary", glow: "shadow-primary/10" },
    success: { bg: "bg-success/8", ring: "ring-success/15", text: "text-success", accent: "bg-success", glow: "shadow-success/10" },
    info: { bg: "bg-info/8", ring: "ring-info/15", text: "text-info", accent: "bg-info", glow: "shadow-info/10" },
    warning: { bg: "bg-warning/8", ring: "ring-warning/15", text: "text-warning", accent: "bg-warning", glow: "shadow-warning/10" },
  };
  const c = colors[tone] || colors.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: delay * 0.06, duration: 0.5, ease }}
      className={cn(
        "relative group rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 overflow-hidden",
        "hover:ring-border/40 transition-all duration-300",
        `hover:shadow-lg ${c.glow}`
      )}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", c.accent)} />
      <div className={cn("absolute -top-12 -right-12 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[40px] pointer-events-none", `${c.bg}`)} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center ring-1 transition-transform duration-300 group-hover:scale-110", c.bg, c.ring)}>
            <Icon className={cn("h-4 w-4", c.text)} />
          </div>
          <span className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">{label}</span>
        </div>
        <p className={cn("text-xl md:text-2xl font-display font-black tracking-[-0.04em]", c.text)}>{value}</p>
        {sub && <p className="text-[9px] text-muted-foreground/30 mt-1 font-display">{sub}</p>}
      </div>
    </motion.div>
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

  const isAddressLocked = !!(profile as any)?.address_locked;
  const hasAddress = !!(profile as any)?.zip_code && !!(profile as any)?.street && !!(profile as any)?.street_number && !!(profile as any)?.city && !!(profile as any)?.state;

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

  const milestone = getCurrentMilestone(allTimeRevenue);

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

  const statusLabels: Record<string, { label: string; cls: string; icon: any; ringCls: string }> = {
    approved: { label: "Verificada", cls: "text-success bg-success/8 border-success/15", icon: BadgeCheck, ringCls: "ring-success/20" },
    pending_review: { label: "Em Análise", cls: "text-warning bg-warning/8 border-warning/15", icon: Shield, ringCls: "ring-warning/20" },
    rejected: { label: "Reprovada", cls: "text-destructive bg-destructive/8 border-destructive/15", icon: Shield, ringCls: "ring-destructive/20" },
    blocked: { label: "Bloqueada", cls: "text-destructive bg-destructive/8 border-destructive/15", icon: Shield, ringCls: "ring-destructive/20" },
  };
  const accStatus = statusLabels[profile?.account_status || "pending_review"] || statusLabels.pending_review;
  const StatusIcon = accStatus.icon;

  const memberDays = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const tierLabel = milestone.tier === 0 ? "Iniciante" : milestone.tier === 1 ? "Prata" : milestone.tier === 2 ? "Ouro" : milestone.tier === 3 ? "Diamante" : milestone.tier === 4 ? "Platina" : "Lendário";

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative space-y-5">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-48 -right-48 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[200px]" />
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-info/15 rounded-full blur-[180px]" />
      </div>

      {/* ═══ HERO ═══ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 overflow-hidden"
      >
        {/* Top accent gradient bar */}
        <div className="h-1.5 bg-gradient-to-r from-primary via-info/80 to-success/60" />

        {/* Mesh gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-info/[0.03] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

        <div className="relative z-10 p-6 md:p-8">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground/40">Meu Perfil</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/5 ring-1 ring-primary/10">
                <milestone.current.icon className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-display font-bold text-primary">{tierLabel}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-success/40 animate-ping" />
                </div>
                <span className="text-[9px] font-display font-bold text-success/70 uppercase tracking-[0.15em]">Online</span>
              </div>
            </div>
          </div>

          {/* Avatar + Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease }}
            className="flex flex-col md:flex-row md:items-center gap-6"
          >
            {/* Avatar */}
            <div className="relative group shrink-0">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
              
              {/* Outer animated ring */}
              <div className="absolute -inset-1.5 rounded-[22px] bg-gradient-to-br from-primary/30 via-info/15 to-success/20 opacity-50 group-hover:opacity-100 transition-opacity duration-500 blur-[1px]" />
              
              <div
                className="relative h-[88px] w-[88px] rounded-2xl overflow-hidden cursor-pointer ring-2 ring-card group-hover:ring-primary/20 transition-all duration-300 shadow-xl active:scale-[0.97]"
                onClick={() => fileRef.current?.click()}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/15 via-primary/10 to-info/10 flex items-center justify-center">
                    <span className="text-3xl font-display font-black text-primary/60">
                      {(profile?.full_name || "U").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <Camera className="h-5 w-5 text-foreground/80" />
                </div>
              </div>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}

              {/* Status dot */}
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-card ring-2 ring-card flex items-center justify-center">
                <StatusIcon className={cn("h-3.5 w-3.5", accStatus.cls.split(" ")[0])} />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                <h2 className="text-2xl md:text-3xl font-display font-black text-foreground tracking-[-0.04em] leading-tight">
                  {profile?.full_name || "Usuário"}
                </h2>
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-display font-bold ring-1 border-0",
                  accStatus.cls, accStatus.ringCls
                )}>
                  <StatusIcon className="h-3 w-3" />
                  {accStatus.label}
                </div>
              </div>
              <p className="text-[12px] text-muted-foreground/40 font-medium mb-3 font-mono">{profile?.email || ""}</p>
              
              {/* Quick stats */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
                  <Calendar className="h-3 w-3" />
                  <span>{memberDays} dias como membro</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
                  <Fingerprint className="h-3 w-3" />
                  <span>{profile?.seller_type === "empresa" ? "Pessoa Jurídica" : "Pessoa Física"}</span>
                </div>
                {profile?.document_number && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
                    <Shield className="h-3 w-3" />
                    <span>Doc. ***{profile.document_number.slice(-4)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Revenue — desktop */}
            <div className="hidden lg:flex flex-col items-end shrink-0 gap-1">
              <p className="text-[9px] font-display font-bold text-muted-foreground/30 uppercase tracking-[0.2em]">Receita Líquida</p>
              <p className="text-3xl font-display font-black text-foreground tracking-[-0.04em] tabular-nums">
                <AnimatedNumber value={allTimeRevenue} />
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-1 w-1 rounded-full bg-success" />
                <p className="text-[10px] text-muted-foreground/40">{totalSales} vendas aprovadas</p>
              </div>
            </div>
          </motion.div>

          {/* Mobile revenue */}
          <div className="lg:hidden mt-5 p-4 rounded-xl bg-muted/5 ring-1 ring-border/10">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Receita Total</p>
              <p className="text-xl font-display font-black text-foreground tabular-nums tracking-[-0.03em]">
                <AnimatedNumber value={allTimeRevenue} />
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══ KPI Strip ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Flame} label="Faturamento" value={fmtCompact(allTimeRevenue)} tone="primary" delay={0} sub="receita líquida" />
        <StatCard icon={Target} label="Vendas" value={String(totalSales)} tone="success" delay={1} sub="aprovadas" />
        <StatCard icon={Trophy} label="Marco Atual" value={milestone.current.label} tone="warning" delay={2} sub={tierLabel} />
        <StatCard icon={TrendingUp} label="Progresso" value={`${milestone.pct.toFixed(0)}%`} tone="info" delay={3} sub={`rumo a ${milestone.next.label}`} />
      </div>

      {/* ═══ Content Grid ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* ─── Dados Pessoais ─── */}
        <SectionCard accent="bg-primary" glow="from-primary/[0.03] to-transparent" delay={0.3}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-9 w-9 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-display font-black text-foreground/70">Dados Pessoais</p>
              <p className="text-[9px] text-muted-foreground/40">Informações do cadastro</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
                {profile?.full_name ? <Lock className="h-2.5 w-2.5" /> : null} Nome completo
              </Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5 h-10 rounded-xl bg-muted/10 border-border/20 focus:border-primary/30" disabled={!!profile?.full_name} />
            </div>
            <div>
              <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
                {profile?.email ? <Lock className="h-2.5 w-2.5" /> : null} E-mail
              </Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 h-10 rounded-xl bg-muted/10 border-border/20" type="email" disabled={!!profile?.email} />
            </div>
            <div>
              <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
                {profile?.phone ? <Lock className="h-2.5 w-2.5" /> : null} Telefone
              </Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5 h-10 rounded-xl bg-muted/10 border-border/20" placeholder="(11) 99999-9999" disabled={!!profile?.phone} />
            </div>
            <Button
              type="submit"
              className="w-full h-10 rounded-xl text-[12px] font-display font-bold shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/15 transition-all active:scale-[0.985]"
              disabled={saving}
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Salvando...</span>
                </div>
              ) : (
                <span>Salvar alterações</span>
              )}
            </Button>
          </form>
        </SectionCard>

        {/* ─── Limites ─── */}
        <SectionCard accent="bg-success" glow="from-success/[0.03] to-transparent" delay={0.35}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-9 w-9 rounded-xl bg-success/8 ring-1 ring-success/15 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-[11px] font-display font-black text-foreground/70">Limites Operacionais</p>
              <p className="text-[9px] text-muted-foreground/40">Parâmetros da sua conta</p>
            </div>
          </div>

          <div className="space-y-1">
            {[
              { label: "Limite diário PIX", value: "Ilimitado", icon: Zap },
              { label: "Limite diário Saque", value: "Ilimitado", icon: ArrowUp },
              { label: "Saques simultâneos", value: "3 pendentes", icon: Wallet },
              { label: "Chaves PIX", value: "3 máximas", icon: Fingerprint },
              { label: "Chaves API", value: "5 máximas", icon: Globe },
            ].map((item, idx) => (
              <InfoRow key={item.label} icon={item.icon} label={item.label} value={item.value} color="success" delay={0.4 + idx * 0.04} />
            ))}
          </div>
        </SectionCard>

        {/* ─── Info da Conta ─── */}
        <SectionCard accent="bg-info" glow="from-info/[0.03] to-transparent" delay={0.4}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-9 w-9 rounded-xl bg-info/8 ring-1 ring-info/15 flex items-center justify-center">
              <Shield className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-[11px] font-display font-black text-foreground/70">Detalhes da Conta</p>
              <p className="text-[9px] text-muted-foreground/40">Informações e segurança</p>
            </div>
          </div>

          <div className="space-y-1">
            {[
              { label: "Tipo de Conta", value: profile?.seller_type === "empresa" ? "Empresa" : "Pessoa Física", icon: User, copyable: false },
              { label: "Documento", value: profile?.document_number ? `***${profile.document_number.slice(-4)}` : "Não informado", icon: Fingerprint, copyable: false },
              { label: "Chave PIX", value: profile?.pix_key ? `***${profile.pix_key.slice(-4)}` : "Não cadastrada", icon: Zap, copyable: false },
              { label: "Membro desde", value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—", icon: Calendar, copyable: false },
              { label: "Nickname", value: profile?.nickname || "Não definido", icon: Star, copyable: false },
            ].map((item, idx) => (
              <InfoRow key={item.label} icon={item.icon} label={item.label} value={item.value} color="info" delay={0.45 + idx * 0.04} copyable={item.copyable} />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ═══ Endereço ═══ */}
      <SectionCard accent="bg-warning" glow="from-warning/[0.03] to-transparent" delay={0.5}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-9 w-9 rounded-xl bg-warning/8 ring-1 ring-warning/15 flex items-center justify-center">
            <MapPin className="h-4 w-4 text-warning" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-display font-black text-foreground/70">Endereço do Vendedor</p>
            <p className="text-[9px] text-muted-foreground/40">
              {isAddressLocked ? "Bloqueado — contate seu gerente para alterações" : "Obrigatório para realizar saques"}
            </p>
          </div>
          {isAddressLocked && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-success/8 ring-1 ring-success/15">
              <Lock className="h-3 w-3 text-success" />
              <span className="text-[9px] font-display font-bold text-success">Salvo</span>
            </div>
          )}
        </div>

        {!hasAddress && !isAddressLocked && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/5 ring-1 ring-warning/10 mb-4">
            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
            <p className="text-[10px] text-warning/70 font-medium">
              Preencha seu endereço para poder realizar saques na plataforma.
            </p>
          </div>
        )}

        <form onSubmit={handleSaveAddress} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
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
                  className="mt-1.5 h-10 rounded-xl bg-muted/10 border-border/20 focus:border-primary/30"
                  placeholder="00000-000"
                  disabled={isAddressLocked}
                  inputMode="numeric"
                />
                {loadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/4 h-4 w-4 animate-spin text-primary" />}
              </div>
            </div>
            <div>
              <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
                {isAddressLocked && <Lock className="h-2.5 w-2.5" />} Estado
              </Label>
              <Input
                value={addressForm.state}
                onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
                className="mt-1.5 h-10 rounded-xl bg-muted/10 border-border/20 focus:border-primary/30"
                placeholder="SP"
                disabled={isAddressLocked}
              />
            </div>
          </div>
          <div>
            <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
              {isAddressLocked && <Lock className="h-2.5 w-2.5" />} Rua / Avenida
            </Label>
            <Input
              value={addressForm.street}
              onChange={(e) => setAddressForm(prev => ({ ...prev, street: e.target.value }))}
              className="mt-1.5 h-10 rounded-xl bg-muted/10 border-border/20 focus:border-primary/30"
              placeholder="Rua das Flores"
              disabled={isAddressLocked}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
                {isAddressLocked && <Lock className="h-2.5 w-2.5" />} Número
              </Label>
              <Input
                value={addressForm.street_number}
                onChange={(e) => setAddressForm(prev => ({ ...prev, street_number: e.target.value }))}
                className="mt-1.5 h-10 rounded-xl bg-muted/10 border-border/20 focus:border-primary/30"
                placeholder="123"
                disabled={isAddressLocked}
              />
            </div>
            <div>
              <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold">Complemento</Label>
              <Input
                value={addressForm.complement}
                onChange={(e) => setAddressForm(prev => ({ ...prev, complement: e.target.value }))}
                className="mt-1.5 h-10 rounded-xl bg-muted/10 border-border/20 focus:border-primary/30"
                placeholder="Apto 42"
                disabled={isAddressLocked}
              />
            </div>
            <div>
              <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
                {isAddressLocked && <Lock className="h-2.5 w-2.5" />} Bairro
              </Label>
              <Input
                value={addressForm.neighborhood}
                onChange={(e) => setAddressForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                className="mt-1.5 h-10 rounded-xl bg-muted/10 border-border/20 focus:border-primary/30"
                placeholder="Centro"
                disabled={isAddressLocked}
              />
            </div>
          </div>
          <div>
            <Label className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.15em] font-display font-bold flex items-center gap-1">
              {isAddressLocked && <Lock className="h-2.5 w-2.5" />} Cidade
            </Label>
            <Input
              value={addressForm.city}
              onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
              className="mt-1.5 h-10 rounded-xl bg-muted/10 border-border/20 focus:border-primary/30"
              placeholder="São Paulo"
              disabled={isAddressLocked}
            />
          </div>
          {!isAddressLocked && (
            <Button type="submit" className="w-full h-10 rounded-xl text-[12px] font-display font-bold shadow-lg shadow-warning/10 bg-warning text-warning-foreground hover:bg-warning/90 transition-all active:scale-[0.985]" disabled={savingAddress}>
              {savingAddress ? (
                <div className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Salvando...</span></div>
              ) : (
                <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Salvar Endereço</span>
              )}
            </Button>
          )}
          {!isAddressLocked && (
            <p className="text-[9px] text-center text-muted-foreground/30">
              Após salvar, o endereço será <span className="font-bold text-warning/60">bloqueado</span>. Para alterar, entre em contato com seu gerente.
            </p>
          )}
        </form>
      </SectionCard>

      {/* ═══ Progresso de Faturamento ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, ease }}
        className="relative rounded-2xl bg-card/95 ring-1 ring-border/20 p-5 md:p-7 overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-transparent to-warning/3 pointer-events-none opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-gradient-to-b from-primary to-warning" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.6 }}
                className="h-11 w-11 rounded-2xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center shadow-lg shadow-primary/10"
              >
                <Trophy className="h-5 w-5 text-primary" />
              </motion.div>
              <div>
                <h3 className="text-[13px] font-display font-black text-foreground tracking-[-0.02em]">Progresso de Faturamento</h3>
                <p className="text-[9px] text-muted-foreground/40">Acompanhe sua evolução rumo ao próximo marco</p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[9px] font-display font-bold text-muted-foreground/30 uppercase tracking-[0.2em]">Próxima Meta</p>
              <p className="text-lg font-display font-black text-primary tabular-nums">{milestone.next.label}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 rounded-xl bg-muted/5 ring-1 ring-border/8">
              <p className="text-[9px] text-muted-foreground/30 uppercase tracking-[0.15em] font-display font-bold mb-1">Total</p>
              <p className="text-[18px] font-display font-black text-foreground tabular-nums tracking-[-0.03em]">{fmtCompact(allTimeRevenue)}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-primary/5 ring-1 ring-primary/10">
              <p className="text-[9px] text-primary/50 uppercase tracking-[0.15em] font-display font-bold mb-1">Meta</p>
              <p className="text-[18px] font-display font-black text-primary tabular-nums tracking-[-0.03em]">{milestone.next.label}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted/5 ring-1 ring-border/8">
              <p className="text-[9px] text-muted-foreground/30 uppercase tracking-[0.15em] font-display font-bold mb-1">Falta</p>
              <p className="text-[18px] font-display font-black text-foreground/50 tabular-nums tracking-[-0.03em]">{fmtCompact(Math.max(0, milestone.next.value - allTimeRevenue))}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-display font-bold text-primary tabular-nums">{milestone.pct.toFixed(0)}%</span>
              </div>
              <span className="text-[9px] font-display font-bold text-muted-foreground/30">{milestone.next.label}</span>
            </div>
            <div className="w-full rounded-full h-3 overflow-hidden bg-muted/10 ring-1 ring-border/8">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(milestone.pct, 2)}%` }}
                transition={{ duration: 1.5, delay: 0.5, ease }}
                className="h-full rounded-full relative bg-gradient-to-r from-primary via-primary/80 to-primary/60"
                style={{ boxShadow: "0 0 20px hsl(var(--primary) / 0.35)" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </motion.div>
            </div>
          </div>

          {/* Milestone dots */}
          <div className="flex justify-between mt-5 px-1">
            {MILESTONES.slice(1).map((m, idx) => {
              const MIcon = m.icon;
              const unlocked = allTimeRevenue >= m.value;
              return (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + idx * 0.08, ease }}
                  className="flex flex-col items-center gap-1.5 group/dot cursor-default"
                >
                  <div className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center ring-1 transition-all duration-500",
                    unlocked
                      ? "bg-primary/10 ring-primary/20 shadow-sm shadow-primary/20"
                      : "bg-muted/5 ring-border/10"
                  )}>
                    <MIcon className={cn("h-3 w-3 transition-colors", unlocked ? "text-primary" : "text-muted-foreground/15")} />
                  </div>
                  <span className={cn(
                    "text-[8px] font-display font-bold tabular-nums transition-colors",
                    unlocked ? "text-primary/60" : "text-muted-foreground/20",
                    "group-hover/dot:text-foreground/60"
                  )}>
                    {m.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
