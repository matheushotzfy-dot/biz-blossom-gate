import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { User, Camera, Trophy, Wallet, Shield, CheckCircle2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
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
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  
  const [allTimeRevenue, setAllTimeRevenue] = useState(0);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    Promise.all([
      supabase.from("profiles").select("*").eq("user_id", uid).single(),
      supabase.from("transactions").select("net_amount").eq("user_id", uid).eq("status", "completed"),
    ]).then(([pRes, tRes]) => {
      if (pRes.data) {
        setProfile(pRes.data);
        setForm({ full_name: pRes.data.full_name || "", email: pRes.data.email || "", phone: pRes.data.phone || "" });
      }
      if (tRes.data) setAllTimeRevenue(tRes.data.reduce((a, t) => a + Number(t.net_amount), 0));
    });
  }, [user]);

  const milestone = getCurrentMilestone(allTimeRevenue);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("user_id", user.id);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Perfil atualizado!");
    setSaving(false);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload"); setUploading(false); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("user_id", user.id);
    setProfile((p) => p ? { ...p, avatar_url: data.publicUrl } : p);
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
        <Panel className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
          <div className="flex flex-col items-center text-center">
            <div className="relative group mb-4">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
              <div className="h-24 w-24 rounded-2xl overflow-hidden relative cursor-pointer bg-primary/10" onClick={() => fileRef.current?.click()}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-primary">
                    {(profile?.full_name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              {uploading && <div className="absolute inset-0 flex items-center justify-center"><div className="h-6 w-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" /></div>}
            </div>
            <h2 className="text-lg font-bold text-foreground">{profile?.full_name || "Usuário"}</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">{profile?.email || ""}</p>
            <div className={`flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[11px] font-bold border ${accStatus.cls}`}>
              <Shield className="h-3 w-3" /> {accStatus.label}
            </div>
          </div>
        </Panel>

        {/* Edit Profile */}
        <Panel>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-[15px] font-display font-bold text-foreground">Dados Pessoais</h3>
          </div>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Nome completo</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1 h-10" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-10" type="email" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 h-10" placeholder="(11) 99999-9999" />
            </div>
            <Button type="submit" className="w-full h-10 rounded-xl text-[13px] font-bold gradient-primary text-primary-foreground" disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </Panel>

        {/* Limites */}
        <Panel>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-info" />
            </div>
            <h3 className="text-[15px] font-display font-bold text-foreground">Limites</h3>
          </div>
          <div className="space-y-3">
            <InfoRow label="Limite diário PIX" value="R$ 50.000,00" cls="text-primary" />
            <InfoRow label="Limite diário Saque" value="R$ 30.000,00" cls="text-info" />
            <InfoRow label="Saques por dia" value="5 operações" cls="text-foreground" />
          </div>
        </Panel>
      </div>

      {/* Progress */}
      <Panel>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-foreground">Progresso de Faturamento</h3>
            <p className="text-[11px] text-muted-foreground">Acompanhe sua evolução</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total faturado</p>
            <p className="text-[22px] font-extrabold text-foreground mt-1">{fmtCurrency(allTimeRevenue)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Meta atual</p>
            <p className="text-[22px] font-extrabold mt-1 text-primary">{milestone.next.label}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Falta</p>
            <p className="text-[22px] font-extrabold text-foreground/60 mt-1">{fmtCurrency(Math.max(0, milestone.next.value - allTimeRevenue))}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold text-muted-foreground">{milestone.pct.toFixed(0)}%</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">{milestone.next.label}</span>
          </div>
          <div className="w-full rounded-full h-3 overflow-hidden bg-muted">
            <div className="h-full rounded-full relative transition-all duration-1000 gradient-primary" style={{ width: `${Math.max(milestone.pct, 2)}%`, boxShadow: "0 0 15px hsl(var(--primary) / 0.35)" }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent" />
            </div>
          </div>
          <div className="flex justify-between mt-3">
            {MILESTONES.slice(1).map((m) => (
              <div key={m.label} className="text-center">
                <div className="h-2 w-2 rounded-full mx-auto mb-1" style={{ background: allTimeRevenue >= m.value ? "hsl(var(--primary))" : "var(--bar-track)", boxShadow: allTimeRevenue >= m.value ? "0 0 8px hsl(var(--primary) / 0.4)" : "none" }} />
                <span className="text-[9px] text-muted-foreground font-bold">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}

function InfoRow({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={`text-[12px] font-bold ${cls}`}>{value}</span>
    </div>
  );
}
