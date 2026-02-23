import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserCircle, Save, Shield, FileCheck, Key, Phone, Mail, CheckCircle2, Clock, AlertTriangle, XCircle, Upload, Camera, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  approved: { label: "Conta Aprovada", cls: "text-primary bg-primary/10 border-primary/15" },
  pending_review: { label: "Em Análise", cls: "text-warning bg-warning/10 border-warning/15" },
  rejected: { label: "Reprovada", cls: "text-destructive bg-destructive/10 border-destructive/15" },
  blocked: { label: "Bloqueada", cls: "text-destructive bg-destructive/10 border-destructive/15" },
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

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setForm({ full_name: data.full_name || "", email: data.email || "", phone: data.phone || "", document_type: data.document_type || "cpf", document_number: data.document_number || "" });
        setPixForm({ pix_key_type: data.pix_key_type || "cpf", pix_key: data.pix_key || "" });
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
    const { error } = await supabase.from("profiles").update(form).eq("user_id", user.id);
    if (error) toast.error("Erro ao salvar"); else toast.success("Dados atualizados!");
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

  return (
    <PageShell>
      <PageTitle icon={<UserCircle className="h-6 w-6" />} title="Identidade & KYC" subtitle="Dados pessoais, documentos e verificação" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel>
          <h3 className="text-[13px] font-bold text-foreground mb-3">Status da Conta</h3>
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${status.cls}`}>
            <Shield className="h-5 w-5" />
            <div>
              <p className="font-semibold text-[13px]">{status.label}</p>
              <p className="text-[10px] text-muted-foreground">{profile?.account_status === "approved" ? "Conta verificada" : "Complete seus dados"}</p>
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-foreground">Progresso</h3>
            <span className="text-[13px] font-bold text-primary">{completionPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--bar-track)" }}>
            <div className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-primary to-emerald-400" style={{ width: `${completionPct}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            {completionSteps.map((step) => (
              <div key={step.label} className="flex items-center gap-1.5 text-[10px]">
                {step.done ? <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" /> : <div className="h-3 w-3 rounded-full border border-border shrink-0" />}
                <span className={step.done ? "text-foreground/60" : "text-muted-foreground/50"}>{step.label}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <h3 className="text-[13px] font-bold text-foreground mb-3">Segurança</h3>
          <div className="space-y-2.5">
            {[{ icon: Shield, label: "Criptografia SSL", active: true }, { icon: FileCheck, label: "LGPD Compliant", active: true }, { icon: Key, label: "2FA", active: false }].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><item.icon className={`h-3.5 w-3.5 ${item.active ? "text-primary" : "text-muted-foreground/30"}`} /><span>{item.label}</span></div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.active ? "text-primary bg-primary/10" : "text-muted-foreground/30 bg-muted/50"}`}>{item.active ? "Ativo" : "Em breve"}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel>
          <h3 className="text-[13px] font-bold text-foreground mb-4">Dados Pessoais</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Nome</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1 h-10" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[10px] text-muted-foreground uppercase tracking-widest">E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-10" type="email" /></div>
              <div><Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 h-10" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Tipo Doc.</Label><Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })}><SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="cnpj">CNPJ</SelectItem></SelectContent></Select></div>
              <div><Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Nº Documento</Label><Input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} className="mt-1 h-10" /></div>
            </div>
            <Button type="submit" className="w-full h-10 rounded-xl text-[13px] font-bold gradient-primary text-primary-foreground" disabled={loading}><Save className="h-4 w-4 mr-2" />{loading ? "Salvando..." : "Salvar"}</Button>
          </form>
        </Panel>

        <div className="space-y-3">
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-foreground">Chave PIX</h3>
              {pixForm.pix_key && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-primary bg-primary/10">Configurada</span>}
            </div>
            <form onSubmit={handlePixSubmit} className="space-y-3">
              <div><Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Tipo</Label><Select value={pixForm.pix_key_type} onValueChange={(v) => setPixForm({ ...pixForm, pix_key_type: v })}><SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="cnpj">CNPJ</SelectItem><SelectItem value="email">E-mail</SelectItem><SelectItem value="phone">Telefone</SelectItem><SelectItem value="random">Aleatória</SelectItem></SelectContent></Select></div>
              <div><Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Chave</Label><Input value={pixForm.pix_key} onChange={(e) => setPixForm({ ...pixForm, pix_key: e.target.value })} className="mt-1 h-10" /></div>
              <Button type="submit" variant="outline" className="w-full h-10 rounded-xl text-[13px]" disabled={pixLoading}><Save className="h-4 w-4 mr-2" />{pixLoading ? "Salvando..." : "Salvar PIX"}</Button>
            </form>
          </Panel>

          <Panel>
            <h3 className="text-[13px] font-bold text-foreground mb-3">Verificação KYC</h3>
            <p className="text-[11px] text-muted-foreground mb-3">Envie fotos do documento e selfie para verificação.</p>
            <div className="space-y-2">
              <DocSlot type="front" label="Documento (Frente)" icon={<Image className="h-5 w-5" />} preview={kycDocs.front} uploading={uploading === "front"} onUpload={(f) => handleUpload("front", f)} />
              <DocSlot type="back" label="Documento (Verso)" icon={<Image className="h-5 w-5" />} preview={kycDocs.back} uploading={uploading === "back"} onUpload={(f) => handleUpload("back", f)} />
              <DocSlot type="selfie" label="Selfie com Documento" icon={<Camera className="h-5 w-5" />} preview={kycDocs.selfie} uploading={uploading === "selfie"} onUpload={(f) => handleUpload("selfie", f)} />
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

function DocSlot({ type, label, icon, preview, uploading, onUpload }: { type: string; label: string; icon: React.ReactNode; preview: string | null; uploading: boolean; onUpload: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div onClick={() => !uploading && ref.current?.click()} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer group transition-all border ${preview ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"}`}>
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${preview ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : preview ? <CheckCircle2 className="h-5 w-5" /> : icon}
      </div>
      <div className="flex-1"><p className="text-[13px] font-medium text-foreground/70">{label}</p><p className="text-[10px] text-muted-foreground">{preview ? "Enviado ✓" : "Clique para enviar"}</p></div>
      <Upload className={`h-4 w-4 shrink-0 ${preview ? "text-primary" : "text-muted-foreground/30"}`} />
    </div>
  );
}
