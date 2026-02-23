import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { User, Camera, Trophy, Percent, Wallet, Shield, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
  const [fees, setFees] = useState<Tables<"fees">[]>([]);
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
      supabase.from("fees").select("*"),
      supabase.from("transactions").select("amount").eq("user_id", uid).eq("status", "completed"),
    ]).then(([pRes, fRes, tRes]) => {
      if (pRes.data) {
        setProfile(pRes.data);
        setForm({ full_name: pRes.data.full_name || "", email: pRes.data.email || "", phone: pRes.data.phone || "" });
      }
      if (fRes.data) setFees(fRes.data);
      if (tRes.data) setAllTimeRevenue(tRes.data.reduce((a, t) => a + Number(t.amount), 0));
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

  const statusLabels: Record<string, { label: string; color: string }> = {
    approved: { label: "Aprovada", color: "#00FFA3" },
    pending_review: { label: "Em análise", color: "#FFAA00" },
    rejected: { label: "Reprovada", color: "#FF4D6A" },
    blocked: { label: "Bloqueada", color: "#FF4D6A" },
  };
  const accStatus = statusLabels[profile?.account_status || "pending_review"] || statusLabels.pending_review;

  return (
    <div className="space-y-5 relative pb-8 min-h-screen animate-fade-in" style={{ background: "linear-gradient(165deg, #080c18 0%, #0d1225 30%, #0a0f1e 60%, #0c1029 100%)" }}>
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute w-[600px] h-[600px] -top-[200px] -right-[100px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, #7C3AED, transparent 70%)" }} />
        <div className="absolute w-[500px] h-[500px] bottom-[-100px] left-[-100px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #00FFA3, transparent 70%)" }} />
      </div>

      <h1 className="text-[26px] font-extrabold text-white tracking-tight">Meu Perfil</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Avatar + Info Card */}
        <Panel>
          <div className="flex flex-col items-center text-center">
            <div className="relative group mb-4">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
              <div className="h-24 w-24 rounded-2xl overflow-hidden relative cursor-pointer" onClick={() => fileRef.current?.click()} style={{ background: "linear-gradient(135deg, rgba(0,255,163,0.15), rgba(0,148,255,0.1))", boxShadow: "0 0 30px rgba(0,255,163,0.1)" }}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold" style={{ color: "#00FFA3" }}>
                    {(profile?.full_name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              {uploading && <div className="absolute inset-0 flex items-center justify-center"><div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>}
            </div>
            <h2 className="text-lg font-bold text-white">{profile?.full_name || "Usuário"}</h2>
            <p className="text-[12px] text-white/30 mt-0.5">{profile?.email || ""}</p>
            <div className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[11px] font-bold" style={{ color: accStatus.color, background: `${accStatus.color}10`, border: `1px solid ${accStatus.color}15` }}>
              <Shield className="h-3 w-3" /> {accStatus.label}
            </div>
          </div>
        </Panel>

        {/* Edit Profile */}
        <Panel>
          <h3 className="text-[14px] font-bold text-white mb-4">Dados Pessoais</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <Label className="text-[10px] text-white/30 uppercase tracking-widest">Nome completo</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white h-10" />
            </div>
            <div>
              <Label className="text-[10px] text-white/30 uppercase tracking-widest">E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white h-10" type="email" />
            </div>
            <div>
              <Label className="text-[10px] text-white/30 uppercase tracking-widest">Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white h-10" placeholder="(11) 99999-9999" />
            </div>
            <Button type="submit" className="w-full h-10 rounded-xl text-[13px] font-bold" style={{ background: "linear-gradient(135deg, #00FFA3, #00D48B)", color: "#080c18" }} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </Panel>

        {/* Limites + Taxas */}
        <Panel>
          <h3 className="text-[14px] font-bold text-white mb-4">Limites & Taxas</h3>
          <div className="space-y-3">
            <InfoRow label="Limite diário PIX" value="R$ 50.000,00" color="#00FFA3" />
            <InfoRow label="Limite diário Saque" value="R$ 30.000,00" color="#0094FF" />
            <InfoRow label="Saques por dia" value="5 operações" color="#A855F7" />
            <div className="pt-3 mt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-2">Suas Taxas</p>
              {fees.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-1.5">
                  <span className="text-[12px] text-white/40">{f.name}</span>
                  <span className="text-[12px] font-bold text-white">{f.fee_type === "percentage" ? `${f.value}%` : `R$ ${Number(f.value).toFixed(2)}`}</span>
                </div>
              ))}
              {fees.length === 0 && <p className="text-[11px] text-white/20">Nenhuma taxa configurada</p>}
            </div>
          </div>
        </Panel>
      </div>

      {/* Progress */}
      <Panel>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(0,255,163,0.15), rgba(0,255,163,0.05))", boxShadow: "0 0 25px rgba(0,255,163,0.1)" }}>
            <Trophy className="h-5 w-5" style={{ color: "#00FFA3" }} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-white">Progresso de Faturamento</h3>
            <p className="text-[11px] text-white/25">Acompanhe sua evolução</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Total faturado</p>
            <p className="text-[22px] font-extrabold text-white mt-1" style={{ textShadow: "0 0 20px rgba(0,255,163,0.1)" }}>{fmtCurrency(allTimeRevenue)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Meta atual</p>
            <p className="text-[22px] font-extrabold mt-1" style={{ color: "#00FFA3" }}>{milestone.next.label}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Falta</p>
            <p className="text-[22px] font-extrabold text-white/60 mt-1">{fmtCurrency(Math.max(0, milestone.next.value - allTimeRevenue))}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#00FFA3" }} />
              <span className="text-[10px] font-bold text-white/40">{milestone.pct.toFixed(0)}%</span>
            </div>
            <span className="text-[10px] font-bold text-white/25">{milestone.next.label}</span>
          </div>
          <div className="w-full rounded-full h-3 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h-full rounded-full relative transition-all duration-1000" style={{ width: `${Math.max(milestone.pct, 2)}%`, background: "linear-gradient(90deg, #00FFA3, #00D48B)", boxShadow: "0 0 15px rgba(0,255,163,0.35), 0 0 40px rgba(0,255,163,0.1)" }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 animate-shimmer" />
            </div>
          </div>
          <div className="flex justify-between mt-3">
            {MILESTONES.slice(1).map((m, i) => (
              <div key={m.label} className="text-center">
                <div className="h-2 w-2 rounded-full mx-auto mb-1" style={{ background: allTimeRevenue >= m.value ? "#00FFA3" : "rgba(255,255,255,0.08)", boxShadow: allTimeRevenue >= m.value ? "0 0 8px rgba(0,255,163,0.4)" : "none" }} />
                <span className="text-[9px] text-white/25 font-bold">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden transition-all duration-500" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}>
      <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
      <div className="relative">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] text-white/40">{label}</span>
      <span className="text-[12px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}
