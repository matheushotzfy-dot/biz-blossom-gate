import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { User, Camera, Trophy, Wallet, Shield, CheckCircle2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PageShell, Panel, GlowPanel, PageTitle, SectionHeader } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

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
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Perfil() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [allTimeRevenue, setAllTimeRevenue] = useState(0);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [formInit, setFormInit] = useState(false);

  // Sync form with profile (only once or when profile loads)
  useEffect(() => {
    if (profile && !formInit) {
      setForm({ full_name: profile.full_name || "", email: profile.email || "", phone: profile.phone || "" });
      setFormInit(true);
    }
  }, [profile, formInit]);

  useEffect(() => {
    if (!user) return;
    supabase.from("transactions").select("net_amount").eq("user_id", user.id).eq("status", "completed")
      .then(({ data }) => {
        if (data) setAllTimeRevenue(data.reduce((a, t) => a + Number(t.net_amount), 0));
      });
  }, [user]);

  const milestone = getCurrentMilestone(allTimeRevenue);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("user_id", user.id);
    if (error) toast.error("Erro ao salvar");
    else {
      updateProfile(form);
      toast.success("Perfil atualizado!");
    }
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

  const statusLabels: Record<string, { label: string; cls: string }> = {
    approved: { label: "Aprovada", cls: "text-primary bg-primary/10 border-primary/15" },
    pending_review: { label: "Em análise", cls: "text-warning bg-warning/10 border-warning/15" },
    rejected: { label: "Reprovada", cls: "text-destructive bg-destructive/10 border-destructive/15" },
    blocked: { label: "Bloqueada", cls: "text-destructive bg-destructive/10 border-destructive/15" },
  };
  const accStatus = statusLabels[profile?.account_status || "pending_review"] || statusLabels.pending_review;

  return (
    <PageShell>
      <PageTitle icon={<User className="h-6 w-6" />} title="Meu Perfil" subtitle="Gerencie suas informações pessoais" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Avatar + Info Card */}
        <GlowPanel className="relative">
          <div className="flex flex-col items-center text-center">
            <div className="relative group mb-4">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
              <div className="h-24 w-24 rounded-2xl overflow-hidden relative cursor-pointer border-2 border-primary/20 shadow-xl shadow-primary/10" onClick={() => fileRef.current?.click()}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl font-display font-black text-primary">
                    {(profile?.full_name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              {uploading && <div className="absolute inset-0 flex items-center justify-center"><div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}
            </div>
            <h2 className="text-lg font-display font-black text-foreground">{profile?.full_name || "Usuário"}</h2>
            <p className="text-[12px] text-muted-foreground/50 mt-0.5">{profile?.email || ""}</p>
            <div className={`flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-[11px] font-bold border ${accStatus.cls}`}>
              <Shield className="h-3 w-3" /> {accStatus.label}
            </div>
          </div>
        </GlowPanel>

        {/* Edit Profile */}
        <GlowPanel>
          <SectionHeader icon={<User className="h-4.5 w-4.5" />} title="Dados Pessoais" />
          <form onSubmit={handleSave} className="space-y-3.5 mt-5">
            <div>
              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Nome completo {profile?.full_name && <span className="text-primary/50 normal-case tracking-normal">(KYC bloqueado)</span>}</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5 h-10 rounded-xl border-border/50" disabled={!!profile?.full_name} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">E-mail {profile?.email && <span className="text-primary/50 normal-case tracking-normal">(KYC bloqueado)</span>}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 h-10 rounded-xl border-border/50" type="email" disabled={!!profile?.email} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Telefone {profile?.phone && <span className="text-primary/50 normal-case tracking-normal">(KYC bloqueado)</span>}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5 h-10 rounded-xl border-border/50" placeholder="(11) 99999-9999" disabled={!!profile?.phone} />
            </div>
            <Button type="submit" className="w-full h-10 rounded-xl text-[13px] font-bold gradient-primary text-primary-foreground shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/25 transition-all" disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </GlowPanel>

        {/* Limites */}
        <GlowPanel glow="success">
          <SectionHeader icon={<Wallet className="h-4.5 w-4.5" />} title="Limites" />
          <div className="space-y-3.5 mt-5">
            <InfoRow label="Limite diário PIX" value="Ilimitado" cls="text-success" />
            <InfoRow label="Limite diário Saque" value="Ilimitado" cls="text-success" />
            <InfoRow label="Saques por dia" value="Ilimitado" cls="text-success" />
          </div>
        </GlowPanel>
      </div>

      {/* Progress */}
      <GlowPanel>
        <div className="flex items-center gap-3.5 mb-6">
          <div className="relative h-11 w-11 rounded-2xl gradient-primary flex items-center justify-center shadow-xl shadow-primary/20">
            <Trophy className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-[15px] font-display font-bold text-foreground">Progresso de Faturamento</h3>
            <p className="text-[11px] text-muted-foreground/60">Acompanhe sua evolução</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Total faturado</p>
            <p className="text-[22px] font-display font-black text-foreground mt-1">{fmtCurrency(allTimeRevenue)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Meta atual</p>
            <p className="text-[22px] font-display font-black mt-1 text-primary">{milestone.next.label}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em] font-bold">Falta</p>
            <p className="text-[22px] font-display font-black text-foreground/50 mt-1">{fmtCurrency(Math.max(0, milestone.next.value - allTimeRevenue))}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold text-muted-foreground/60">{milestone.pct.toFixed(0)}%</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground/60">{milestone.next.label}</span>
          </div>
          <div className="w-full rounded-full h-3.5 overflow-hidden bg-muted/30 border border-border/20">
            <div className="h-full rounded-full relative transition-all duration-1000 gradient-primary" style={{ width: `${Math.max(milestone.pct, 2)}%`, boxShadow: "0 0 20px hsl(var(--primary) / 0.4)" }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </div>
          <div className="flex justify-between mt-4">
            {MILESTONES.slice(1).map((m) => (
              <div key={m.label} className="text-center">
                <div className="h-2.5 w-2.5 rounded-full mx-auto mb-1.5 border border-border/30" style={{ background: allTimeRevenue >= m.value ? "hsl(var(--primary))" : "hsl(var(--muted))", boxShadow: allTimeRevenue >= m.value ? "0 0 10px hsl(var(--primary) / 0.5)" : "none" }} />
                <span className="text-[9px] text-muted-foreground/50 font-bold">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </GlowPanel>
    </PageShell>
  );
}

function InfoRow({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/15 last:border-0">
      <span className="text-[12px] text-muted-foreground/60">{label}</span>
      <span className={`text-[13px] font-display font-bold ${cls}`}>{value}</span>
    </div>
  );
}