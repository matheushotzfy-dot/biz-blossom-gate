import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { User, Camera, Trophy, Wallet, Shield, CheckCircle2, Flame, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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

  const statusLabels: Record<string, { label: string; cls: string }> = {
    approved: { label: "Aprovada", cls: "text-success bg-success/10 border-success/15" },
    pending_review: { label: "Em análise", cls: "text-warning bg-warning/10 border-warning/15" },
    rejected: { label: "Reprovada", cls: "text-destructive bg-destructive/10 border-destructive/15" },
    blocked: { label: "Bloqueada", cls: "text-destructive bg-destructive/10 border-destructive/15" },
  };
  const accStatus = statusLabels[profile?.account_status || "pending_review"] || statusLabels.pending_review;

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
      <div className="fixed inset-0 dot-grid opacity-30 pointer-events-none z-0" />

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                            */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative mb-10 rounded-3xl p-6 sm:p-8 lg:p-10 mesh-gradient-hero noise-overlay scan-line"
      >
        <div className="absolute -inset-16 pointer-events-none">
          <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
          <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-info/6 rounded-full blur-[160px]" />
          <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[200px]" />
          <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center glow-primary">
              <User className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Meu Perfil</span>
          </div>

          {/* Avatar + name */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="flex items-center gap-6 mb-8">
            <div className="relative group shrink-0">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
              <div className="h-24 w-24 rounded-2xl overflow-hidden relative cursor-pointer border-2 border-primary/15 shadow-xl shadow-primary/10 active:scale-[0.97] transition-transform ring-4 ring-primary/5" onClick={() => fileRef.current?.click()}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center text-3xl font-display font-black text-primary">
                    {(profile?.full_name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Camera className="h-5 w-5 text-foreground" />
                </div>
              </div>
              {uploading && <div className="absolute inset-0 flex items-center justify-center"><div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-heading text-foreground leading-tight tracking-[-0.03em]">{profile?.full_name || "Usuário"}</h2>
              <p className="text-[12px] text-muted-foreground/40 mt-1 font-display">{profile?.email || ""}</p>
              <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-[9px] font-heading border ${accStatus.cls}`}>
                <Shield className="h-3 w-3" /> {accStatus.label}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CONTENT                                                         */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Edit Profile */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl glass-panel p-5 md:p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-8 rounded-xl bg-primary/8 border border-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <p className="text-[11px] font-heading uppercase tracking-[0.15em] text-muted-foreground/40">Dados Pessoais</p>
          </div>
          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-bold">Nome completo {profile?.full_name && <span className="text-primary/40 normal-case tracking-normal text-[9px]">(bloqueado)</span>}</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5 h-10 rounded-xl" disabled={!!profile?.full_name} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-bold">E-mail {profile?.email && <span className="text-primary/40 normal-case tracking-normal text-[9px]">(bloqueado)</span>}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 h-10 rounded-xl" type="email" disabled={!!profile?.email} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-bold">Telefone {profile?.phone && <span className="text-primary/40 normal-case tracking-normal text-[9px]">(bloqueado)</span>}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5 h-10 rounded-xl" placeholder="(11) 99999-9999" disabled={!!profile?.phone} />
            </div>
            <Button type="submit" className="w-full h-10 rounded-xl text-[13px] font-bold shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/20 transition-all" disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </motion.div>

        {/* Limites */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-2xl glass-panel p-5 md:p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-8 rounded-xl bg-success/8 border border-success/10 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-success" />
            </div>
            <p className="text-[11px] font-heading uppercase tracking-[0.15em] text-muted-foreground/40">Limites</p>
          </div>
          <div className="space-y-3.5">
            {[
              { label: "Limite diário PIX", value: "Ilimitado" },
              { label: "Limite diário Saque", value: "Ilimitado" },
              { label: "Saques por dia", value: "Ilimitado" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-border/10 last:border-0">
                <span className="text-[12px] text-muted-foreground/50 font-display">{item.label}</span>
                <span className="text-[13px] font-display font-bold text-success">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Account Info */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl glass-panel p-5 md:p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="h-8 w-8 rounded-xl bg-info/8 border border-info/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-info" />
            </div>
            <p className="text-[11px] font-heading uppercase tracking-[0.15em] text-muted-foreground/40">Informações da Conta</p>
          </div>
          <div className="space-y-3.5">
            {[
              { label: "Tipo", value: profile?.seller_type === "empresa" ? "Empresa" : "Pessoa Física" },
              { label: "Documento", value: profile?.document_number ? `***${profile.document_number.slice(-4)}` : "Não informado" },
              { label: "Chave PIX", value: profile?.pix_key ? `***${profile.pix_key.slice(-4)}` : "Não cadastrada" },
              { label: "Membro desde", value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-border/10 last:border-0">
                <span className="text-[12px] text-muted-foreground/50 font-display">{item.label}</span>
                <span className="text-[12px] font-display font-semibold text-foreground/70">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── Progress Section ─── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="rounded-2xl glass-panel p-5 md:p-6">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="relative h-11 w-11 rounded-2xl gradient-primary flex items-center justify-center shadow-xl shadow-primary/20">
            <Trophy className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-[15px] font-display font-bold text-foreground">Progresso de Faturamento</h3>
            <p className="text-[11px] text-muted-foreground/40">Acompanhe sua evolução</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em] font-heading">Total faturado</p>
            <p className="text-[22px] font-heading text-foreground mt-1 tabular-nums">{fmtCurrency(allTimeRevenue)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em] font-heading">Meta atual</p>
            <p className="text-[22px] font-heading mt-1 text-primary tabular-nums">{milestone.next.label}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.15em] font-heading">Falta</p>
            <p className="text-[22px] font-heading text-foreground/50 mt-1 tabular-nums">{fmtCurrency(Math.max(0, milestone.next.value - allTimeRevenue))}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-heading text-muted-foreground/40">{milestone.pct.toFixed(0)}%</span>
            </div>
            <span className="text-[10px] font-heading text-muted-foreground/40">{milestone.next.label}</span>
          </div>
          <div className="w-full rounded-full h-3.5 overflow-hidden bg-muted/20 border border-border/10">
            <div className="h-full rounded-full relative transition-all duration-1000 gradient-primary" style={{ width: `${Math.max(milestone.pct, 2)}%`, boxShadow: "0 0 20px hsl(var(--primary) / 0.4)" }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </div>
          <div className="flex justify-between mt-4">
            {MILESTONES.slice(1).map((m) => (
              <div key={m.label} className="text-center">
                <div className="h-2.5 w-2.5 rounded-full mx-auto mb-1.5 border border-border/30" style={{ background: allTimeRevenue >= m.value ? "hsl(var(--primary))" : "hsl(var(--muted))", boxShadow: allTimeRevenue >= m.value ? "0 0 10px hsl(var(--primary) / 0.5)" : "none" }} />
                <span className="text-[9px] text-muted-foreground/40 font-heading">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
