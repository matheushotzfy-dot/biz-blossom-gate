import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  UserCircle, Save, Shield, FileCheck, Key, Phone, Mail,
  CheckCircle2, Clock, AlertTriangle, XCircle, Upload, Camera, Image,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  approved: { label: "Conta Aprovada", icon: <CheckCircle2 className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10" },
  pending_review: { label: "Em Análise", icon: <Clock className="h-5 w-5" />, color: "text-amber-500", bg: "bg-amber-500/10" },
  rejected: { label: "Reprovada", icon: <XCircle className="h-5 w-5" />, color: "text-red-500", bg: "bg-red-500/10" },
  blocked: { label: "Bloqueada", icon: <AlertTriangle className="h-5 w-5" />, color: "text-red-500", bg: "bg-red-500/10" },
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
    // Load existing KYC docs
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
      } else {
        docs[type] = null;
      }
    }
    setKycDocs(docs);
  };

  const handleUpload = async (type: string, file: File) => {
    if (!user) return;
    setUploading(type);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${type}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload"); } else { toast.success("Documento enviado!"); await loadKycDocs(); }
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserCircle className="h-6 w-6 text-primary" /> Identidade & KYC
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Dados pessoais, documentos e verificação de identidade</p>
      </div>

      {/* Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
          <SectionTitle>Status da Conta</SectionTitle>
          <div className={`flex items-center gap-3 p-4 rounded-xl mt-4 ${status.bg} border border-border/30`}>
            <span className={status.color}>{status.icon}</span>
            <div>
              <p className={`font-semibold text-sm ${status.color}`}>{status.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {profile?.account_status === "approved" ? "Conta verificada e ativa" : "Complete seus dados para aprovação"}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <SectionTitle>Progresso do Cadastro</SectionTitle>
            <span className="text-sm font-bold text-primary">{completionPct}%</span>
          </div>
          <div className="w-full h-2.5 bg-muted/50 rounded-full mt-4 mb-4 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700 shadow-[0_0_8px_hsl(152,60%,45%,0.4)]" style={{ width: `${completionPct}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {completionSteps.map((step) => (
              <div key={step.label} className="flex items-center gap-1.5 text-[10px]">
                {step.done ? <CheckCircle2 className="h-3 w-3 text-primary shrink-0" /> : <div className="h-3 w-3 rounded-full border border-muted-foreground/30 shrink-0" />}
                <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
          <SectionTitle>Segurança</SectionTitle>
          <div className="space-y-3 mt-4">
            {[
              { icon: Shield, label: "Criptografia SSL", active: true },
              { icon: FileCheck, label: "LGPD Compliant", active: true },
              { icon: Key, label: "2FA", active: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <item.icon className={`h-3.5 w-3.5 ${item.active ? "text-primary" : "text-muted-foreground"}`} />
                  <span>{item.label}</span>
                </div>
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${item.active ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted/50"}`}>
                  {item.active ? "Ativo" : "Em breve"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Forms + KYC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal data */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
          <SectionTitle>Dados Pessoais</SectionTitle>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nome Completo</Label>
              <div className="relative mt-1.5"><UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="pl-10 bg-muted/30 border-border/50 h-11" placeholder="Seu nome completo" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">E-mail</Label>
                <div className="relative mt-1.5"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="pl-10 bg-muted/30 border-border/50 h-11" type="email" /></div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Telefone</Label>
                <div className="relative mt-1.5"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="pl-10 bg-muted/30 border-border/50 h-11" placeholder="(11) 99999-9999" /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo Documento</Label>
                <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })}>
                  <SelectTrigger className="mt-1.5 bg-muted/30 border-border/50 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="cnpj">CNPJ</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Nº Documento</Label>
                <div className="relative mt-1.5"><FileCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} className="pl-10 bg-muted/30 border-border/50 h-11" placeholder="000.000.000-00" /></div>
              </div>
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground gap-2 h-11 rounded-xl shadow-lg shadow-primary/20" disabled={loading}>
              <Save className="h-4 w-4" /> {loading ? "Salvando..." : "Salvar Dados"}
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          {/* PIX */}
          <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <SectionTitle>Chave PIX</SectionTitle>
              {pixForm.pix_key && <span className="text-[9px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Configurada</span>}
            </div>
            <form onSubmit={handlePixSubmit} className="space-y-4 mt-4">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo da Chave</Label>
                <Select value={pixForm.pix_key_type} onValueChange={(v) => setPixForm({ ...pixForm, pix_key_type: v })}>
                  <SelectTrigger className="mt-1.5 bg-muted/30 border-border/50 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="cnpj">CNPJ</SelectItem><SelectItem value="email">E-mail</SelectItem><SelectItem value="phone">Telefone</SelectItem><SelectItem value="random">Chave Aleatória</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Chave PIX</Label>
                <div className="relative mt-1.5"><Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={pixForm.pix_key} onChange={(e) => setPixForm({ ...pixForm, pix_key: e.target.value })} className="pl-10 bg-muted/30 border-border/50 h-11" placeholder="Sua chave PIX" /></div>
              </div>
              <Button type="submit" variant="outline" className="w-full gap-2 h-11 rounded-xl border-primary/30 text-primary hover:bg-primary/10" disabled={pixLoading}>
                <Save className="h-4 w-4" /> {pixLoading ? "Salvando..." : "Salvar Chave PIX"}
              </Button>
            </form>
          </div>

          {/* KYC Upload */}
          <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm">
            <SectionTitle>Verificação KYC</SectionTitle>
            <p className="text-[10px] text-muted-foreground mt-2 mb-4">Envie fotos do seu documento e uma selfie segurando-o para verificação.</p>
            <div className="space-y-3">
              <DocUploadSlot type="front" label="Documento (Frente)" description="RG, CNH ou Passaporte" icon={<Image className="h-5 w-5" />} preview={kycDocs.front} uploading={uploading === "front"} onUpload={(f) => handleUpload("front", f)} />
              <DocUploadSlot type="back" label="Documento (Verso)" description="Verso do documento" icon={<Image className="h-5 w-5" />} preview={kycDocs.back} uploading={uploading === "back"} onUpload={(f) => handleUpload("back", f)} />
              <DocUploadSlot type="selfie" label="Selfie com Documento" description="Foto do rosto segurando o documento" icon={<Camera className="h-5 w-5" />} preview={kycDocs.selfie} uploading={uploading === "selfie"} onUpload={(f) => handleUpload("selfie", f)} />
            </div>
            <p className="text-[9px] text-muted-foreground mt-4">Formatos aceitos: JPG, PNG, PDF. Tamanho máximo: 5MB por arquivo.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold flex items-center gap-2">
      <span className="w-1 h-5 bg-gradient-to-b from-primary to-emerald-400 rounded-full" />
      {children}
    </h3>
  );
}

function DocUploadSlot({ type, label, description, icon, preview, uploading, onUpload }: {
  type: string; label: string; description: string; icon: React.ReactNode; preview: string | null; uploading: boolean; onUpload: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => !uploading && ref.current?.click()}
      className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer group
        ${preview ? "border-primary/30 bg-primary/5" : "border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-primary/5"}`}
    >
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${preview ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : preview ? <CheckCircle2 className="h-5 w-5" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{preview ? "Documento enviado ✓" : description}</p>
      </div>
      <Upload className={`h-4 w-4 shrink-0 transition-colors ${preview ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
    </div>
  );
}
