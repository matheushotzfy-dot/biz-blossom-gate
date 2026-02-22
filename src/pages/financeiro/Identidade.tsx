import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  UserCircle, Save, Shield, FileCheck, Key, Phone, Mail,
  CheckCircle2, Clock, AlertTriangle, XCircle, Upload, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  approved: { label: "Conta Aprovada", icon: <CheckCircle2 className="h-5 w-5" />, color: "text-primary", bg: "bg-primary/10" },
  pending_review: { label: "Em Análise", icon: <Clock className="h-5 w-5" />, color: "text-warning", bg: "bg-warning/10" },
  rejected: { label: "Reprovada", icon: <XCircle className="h-5 w-5" />, color: "text-destructive", bg: "bg-destructive/10" },
  blocked: { label: "Bloqueada", icon: <AlertTriangle className="h-5 w-5" />, color: "text-destructive", bg: "bg-destructive/10" },
};

export default function Identidade() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", document_type: "cpf", document_number: "" });
  const [pixForm, setPixForm] = useState({ pix_key_type: "cpf", pix_key: "" });
  const [loading, setLoading] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setForm({
          full_name: data.full_name || "",
          email: data.email || "",
          phone: data.phone || "",
          document_type: data.document_type || "cpf",
          document_number: data.document_number || "",
        });
        setPixForm({
          pix_key_type: data.pix_key_type || "cpf",
          pix_key: data.pix_key || "",
        });
      }
    });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update(form).eq("user_id", user.id);
    if (error) { toast.error("Erro ao salvar"); } else { toast.success("Dados atualizados!"); }
    setLoading(false);
  };

  const handlePixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPixLoading(true);
    const { error } = await supabase.from("profiles").update(pixForm).eq("user_id", user.id);
    if (error) { toast.error("Erro ao salvar chave PIX"); } else { toast.success("Chave PIX atualizada!"); }
    setPixLoading(false);
  };

  const status = STATUS_MAP[profile?.account_status || "pending_review"] || STATUS_MAP.pending_review;

  const completionSteps = [
    { label: "Dados pessoais", done: !!(form.full_name && form.email) },
    { label: "Documento", done: !!form.document_number },
    { label: "Telefone", done: !!form.phone },
    { label: "Chave PIX", done: !!pixForm.pix_key },
  ];
  const completionPct = Math.round((completionSteps.filter((s) => s.done).length / completionSteps.length) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserCircle className="h-6 w-6 text-primary" /> Identidade
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Dados pessoais, documentos e verificação</p>
      </div>

      {/* Status + Completion Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Account Status */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="text-sm font-semibold">Status da Conta</h3>
          </div>
          <div className={`flex items-center gap-3 p-4 rounded-lg ${status.bg}`}>
            <span className={status.color}>{status.icon}</span>
            <div>
              <p className={`font-semibold text-sm ${status.color}`}>{status.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile?.account_status === "approved"
                  ? "Sua conta está verificada e ativa"
                  : "Complete seus dados para aprovação"}
              </p>
            </div>
          </div>
        </div>

        {/* Completion Progress */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="text-sm font-semibold">Progresso do Cadastro</h3>
            <span className="ml-auto text-xs font-bold text-primary">{completionPct}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full mb-4">
            <div
              className="h-2 rounded-full gradient-primary transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {completionSteps.map((step) => (
              <div key={step.label} className="flex items-center gap-2 text-xs">
                {step.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                )}
                <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="text-sm font-semibold">Segurança</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>Criptografia SSL</span>
              </div>
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Ativo</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <FileCheck className="h-3.5 w-3.5 text-primary" />
                <span>LGPD Compliant</span>
              </div>
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Ativo</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                <span>2FA</span>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Em breve</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal Data Form */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="text-sm font-semibold">Dados Pessoais</h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nome Completo</Label>
              <div className="relative mt-1.5">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="pl-10 bg-muted/50 border-border/50" placeholder="Seu nome completo" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="pl-10 bg-muted/50 border-border/50" type="email" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="pl-10 bg-muted/50 border-border/50" placeholder="(11) 99999-9999" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Tipo de Documento</Label>
                <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })}>
                  <SelectTrigger className="mt-1.5 bg-muted/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Número do Documento</Label>
                <div className="relative mt-1.5">
                  <FileCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} className="pl-10 bg-muted/50 border-border/50" placeholder="000.000.000-00" />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground gap-2 h-10" disabled={loading}>
              <Save className="h-4 w-4" /> {loading ? "Salvando..." : "Salvar Dados Pessoais"}
            </Button>
          </form>
        </div>

        {/* PIX + Documents */}
        <div className="space-y-4">
          {/* PIX Key */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-1 h-5 bg-primary rounded-full" />
              <h3 className="text-sm font-semibold">Chave PIX</h3>
              {pixForm.pix_key && (
                <span className="ml-auto text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Configurada</span>
              )}
            </div>
            <form onSubmit={handlePixSubmit} className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Tipo da Chave</Label>
                <Select value={pixForm.pix_key_type} onValueChange={(v) => setPixForm({ ...pixForm, pix_key_type: v })}>
                  <SelectTrigger className="mt-1.5 bg-muted/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Chave PIX</Label>
                <div className="relative mt-1.5">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={pixForm.pix_key} onChange={(e) => setPixForm({ ...pixForm, pix_key: e.target.value })} className="pl-10 bg-muted/50 border-border/50" placeholder="Sua chave PIX" />
                </div>
              </div>
              <Button type="submit" variant="outline" className="w-full gap-2 h-10 border-primary/30 text-primary hover:bg-primary/10" disabled={pixLoading}>
                <Save className="h-4 w-4" /> {pixLoading ? "Salvando..." : "Salvar Chave PIX"}
              </Button>
            </form>
          </div>

          {/* Document Upload */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-1 h-5 bg-primary rounded-full" />
              <h3 className="text-sm font-semibold">Documentos (KYC)</h3>
            </div>
            <div className="space-y-3">
              <DocumentUploadSlot label="Documento com foto (frente)" />
              <DocumentUploadSlot label="Documento com foto (verso)" />
              <DocumentUploadSlot label="Selfie segurando documento" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-4">
              Envie documentos legíveis em formato JPG, PNG ou PDF. Tamanho máximo: 5MB.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentUploadSlot({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors group cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
          <Camera className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div>
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">Clique para enviar</p>
        </div>
      </div>
      <Upload className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </div>
  );
}
