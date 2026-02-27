import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserCircle, Save, Shield, FileCheck, Key, CheckCircle2, Upload, Camera, Image, Loader2, Lock, Info, Fingerprint, Wallet, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_MAP: Record<string, { label: string; cls: string; icon: string }> = {
  approved: { label: "Conta Aprovada", cls: "text-primary bg-primary/10 border-primary/15", icon: "✅" },
  pending_review: { label: "Em Análise", cls: "text-warning bg-warning/10 border-warning/15", icon: "⏳" },
  rejected: { label: "Reprovada", cls: "text-destructive bg-destructive/10 border-destructive/15", icon: "❌" },
  blocked: { label: "Bloqueada", cls: "text-destructive bg-destructive/10 border-destructive/15", icon: "🚫" },
};

export default function Identidade() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", document_type: "cpf", document_number: "" });
  const [pixForm, setPixForm] = useState({ pix_key_type: "cpf", pix_key: "" });
  const [loading, setLoading] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);
  const [kycDocs, setKycDocs] = useState<Record<string, string | null>>({ front: null, back: null, selfie: null });
  const [uploading, setUploading] = useState<string | null>(null);
  const [lockedFields, setLockedFields] = useState({ email: false, phone: false, document_number: false, document_type: false });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setForm({ full_name: data.full_name || "", email: data.email || "", phone: data.phone || "", document_type: data.document_type || "cpf", document_number: data.document_number || "" });
        setPixForm({ pix_key_type: data.pix_key_type || "cpf", pix_key: data.pix_key || "" });
        setLockedFields({
          email: !!data.email,
          phone: !!data.phone,
          document_number: !!data.document_number,
          document_type: !!data.document_number,
        });
      }
    });
    loadKycDocs();
  }, [user]);

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
    setUploading(type);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${type}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true });
    if (error) toast.error("Erro no upload"); else { toast.success("Documento enviado!"); await loadKycDocs(); }
    setUploading(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const updateData: Record<string, string> = { full_name: form.full_name };
    if (!lockedFields.email) updateData.email = form.email;
    if (!lockedFields.phone) updateData.phone = form.phone;
    if (!lockedFields.document_number) {
      updateData.document_number = form.document_number;
      updateData.document_type = form.document_type;
    }
    const { error } = await supabase.from("profiles").update(updateData).eq("user_id", user.id);
    if (error) toast.error("Erro ao salvar");
    else {
      toast.success("Dados atualizados!");
      setLockedFields({
        email: !!form.email || lockedFields.email,
        phone: !!form.phone || lockedFields.phone,
        document_number: !!form.document_number || lockedFields.document_number,
        document_type: !!form.document_number || lockedFields.document_type,
      });
    }
    setLoading(false);
  };

  const handlePixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPixLoading(true);
    const { error } = await supabase.from("profiles").update(pixForm).eq("user_id", user.id);
    if (error) toast.error("Erro ao salvar chave PIX"); else toast.success("Chave PIX atualizada!");
    setPixLoading(false);
  };

  const status = STATUS_MAP[profile?.account_status || "pending_review"] || STATUS_MAP.pending_review;
  const completionSteps = [
    { label: "Dados pessoais", done: !!(form.full_name && form.email) },
    { label: "Documento", done: !!form.document_number },
    { label: "Telefone", done: !!form.phone },
    { label: "Chave PIX", done: !!pixForm.pix_key },
    { label: "Doc. frente", done: !!kycDocs.front },
    { label: "Doc. verso", done: !!kycDocs.back },
    { label: "Selfie com doc", done: !!kycDocs.selfie },
  ];
  const completionPct = Math.round((completionSteps.filter((s) => s.done).length / completionSteps.length) * 100);
  const isApproved = profile?.account_status === "approved";

  return (
    <PageShell>
      <PageTitle icon={<Fingerprint className="h-6 w-6" />} title="Identidade & KYC" subtitle="Dados pessoais, documentos e verificação de conta" />

      {/* Status Banner */}
      {isApproved && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/[0.02] p-5 flex items-center gap-4 animate-fade-in">
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

      {/* Top cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Status */}
        <Panel className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
          <div className="relative">
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
          </div>
        </Panel>

        {/* Progress */}
        <Panel className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Progresso</h3>
              </div>
              <span className="text-lg font-display font-black text-primary">{completionPct}%</span>
            </div>
            {/* Progress bar */}
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
          </div>
        </Panel>

        {/* Security */}
        <Panel className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
          <div className="relative">
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
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Personal Data */}
        <Panel className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-5">
              <UserCircle className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Dados Pessoais</h3>
            </div>
            {lockedFields.document_number && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-info/5 border border-info/15 text-info">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <p className="text-[11px] font-medium">Campos sensíveis bloqueados após envio. Contate o suporte para correções.</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Nome completo</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5 h-11 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1">
                    E-mail {lockedFields.email && <Lock className="h-2.5 w-2.5" />}
                  </Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 h-11 rounded-xl" type="email" disabled={lockedFields.email} />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1">
                    Telefone {lockedFields.phone && <Lock className="h-2.5 w-2.5" />}
                  </Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5 h-11 rounded-xl" disabled={lockedFields.phone} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1">
                    Tipo Doc. {lockedFields.document_type && <Lock className="h-2.5 w-2.5" />}
                  </Label>
                  <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })} disabled={lockedFields.document_type}>
                    <SelectTrigger className="mt-1.5 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="cnpj">CNPJ</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1">
                    Nº Documento {lockedFields.document_number && <Lock className="h-2.5 w-2.5" />}
                  </Label>
                  <Input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} className="mt-1.5 h-11 rounded-xl" disabled={lockedFields.document_number} />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl text-[13px] font-bold gradient-primary text-primary-foreground shadow-lg shadow-primary/15" disabled={loading}>
                <Save className="h-4 w-4 mr-2" />{loading ? "Salvando..." : "Salvar dados"}
              </Button>
            </form>
          </div>
        </Panel>

        <div className="space-y-3">
          {/* PIX Key */}
          <Panel className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Chave PIX</h3>
                </div>
                {pixForm.pix_key && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-primary bg-primary/10">Configurada</span>}
              </div>
              <form onSubmit={handlePixSubmit} className="space-y-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Tipo da chave</Label>
                  <Select value={pixForm.pix_key_type} onValueChange={(v) => setPixForm({ ...pixForm, pix_key_type: v })}>
                    <SelectTrigger className="mt-1.5 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="random">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Chave PIX</Label>
                  <Input value={pixForm.pix_key} onChange={(e) => setPixForm({ ...pixForm, pix_key: e.target.value })} className="mt-1.5 h-11 rounded-xl" placeholder="Insira sua chave PIX" />
                </div>
                <Button type="submit" variant="outline" className="w-full h-11 rounded-xl text-[13px] font-bold border-primary/20 hover:bg-primary/5" disabled={pixLoading}>
                  <Save className="h-4 w-4 mr-2" />{pixLoading ? "Salvando..." : "Salvar PIX"}
                </Button>
              </form>
            </div>
          </Panel>

          {/* KYC Documents */}
          <Panel className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent pointer-events-none" />
            <div className="relative">
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
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

function DocSlot({ type, label, icon, preview, uploading, onUpload, locked }: { type: string; label: string; icon: React.ReactNode; preview: string | null; uploading: boolean; onUpload: (file: File) => void; locked: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const canUpload = !locked && !uploading;
  return (
    <div
      onClick={() => canUpload && ref.current?.click()}
      className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all border ${
        locked
          ? "border-primary/20 bg-primary/[0.03] cursor-default"
          : preview
          ? "border-primary/20 bg-primary/[0.03] cursor-pointer hover:bg-primary/[0.06]"
          : "border-border bg-muted/20 cursor-pointer hover:border-primary/20 hover:bg-muted/30"
      }`}
    >
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${preview ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"}`}>
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : preview ? <CheckCircle2 className="h-5 w-5" /> : icon}
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-foreground/80">{label}</p>
        <p className="text-[10px] text-muted-foreground">
          {locked ? "Enviado ✓ — bloqueado" : preview ? "Enviado ✓" : "Clique para enviar"}
        </p>
      </div>
      {locked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground/40" /> : <Upload className={`h-4 w-4 shrink-0 ${preview ? "text-primary" : "text-muted-foreground/30"}`} />}
    </div>
  );
}
