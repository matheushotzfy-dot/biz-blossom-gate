/**
 * KYC Onboarding Popup — Interactive multi-step verification
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useKycStatus } from "@/hooks/useKycStatus";
import {
 X as XIcon, Shield, Upload, Camera, Image, Loader2, CheckCircle2,
 AlertTriangle, ArrowRight, ArrowLeft, FileCheck, Fingerprint, Sparkles,
 Rocket, PartyPopper, Eye, Lock, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;
const ALLOWED_KYC_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const BASE_STEPS = [
 { type: "front", label: "Documento — Frente", desc: "Foto nítida da frente do seu RG ou CNH", icon: Image, tip: "Posicione o documento em superfície plana e com boa iluminação" },
 { type: "back", label: "Documento — Verso", desc: "Foto nítida do verso do seu RG ou CNH", icon: Image, tip: "Garanta que todos os dados estejam legíveis" },
 { type: "selfie", label: "Selfie com Documento", desc: "Tire uma selfie segurando seu documento ao lado do rosto", icon: Camera, tip: "Seu rosto e o documento devem estar visíveis e sem obstruções" },
];

const CNPJ_STEP = { type: "cnpj_card", label: "Cartão CNPJ", desc: "Envie o comprovante de inscrição e situação cadastral do CNPJ", icon: Building2, tip: "Acesse o site da Receita Federal para gerar o cartão atualizado" };

export function KycOnboardingPopup() {
 const { user } = useAuth();
 const { profile } = useProfile();
 const [open, setOpen] = useState(false);
 const isCnpj = profile?.document_type === "cnpj";
 const STEPS = isCnpj ? [...BASE_STEPS, CNPJ_STEP] : BASE_STEPS;
 const [docs, setDocs] = useState<Record<string, boolean>>({ front: false, back: false, selfie: false, cnpj_card: false });
 const [uploading, setUploading] = useState<string | null>(null);
 const [currentStep, setCurrentStep] = useState(0);
 const [completed, setCompleted] = useState(false);
 const fileRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 if (!user?.id || !profile) return;
 if (kyc.approved || !kyc.resolved) return;
 const key = `venxpay_kyc_popup_dismissed_${user.id}`;
 if (localStorage.getItem(key)) return;
 const timer = setTimeout(() => setOpen(true), 800);
 return () => clearTimeout(timer);
 }, [user?.id, kyc.approved, kyc.resolved, profile?.document_type]);

 useEffect(() => {
 if (!user?.id || kyc.approved || !kyc.resolved) return;
 (async () => {
 const types = isCnpj ? ["front", "back", "selfie", "cnpj_card"] : ["front", "back", "selfie"];
 const results = await Promise.all(
 types.map(t => supabase.storage.from("kyc-documents").list(`${user.id}`, { search: t }))
 );
 const d: Record<string, boolean> = { front: false, back: false, selfie: false, cnpj_card: false };
 let firstMissing = -1;
 types.forEach((t, i) => {
 d[t] = !!(results[i].data && results[i].data.length > 0);
 if (!d[t] && firstMissing === -1) firstMissing = i;
 });
 setDocs(d);
 if (firstMissing >= 0) setCurrentStep(firstMissing);
 })();
 }, [user?.id, isCnpj, kyc.approved, kyc.resolved]);

  const handleUpload = useCallback(async (type: string, file: File) => {
    if (!user) return;
    if (!ALLOWED_KYC_TYPES.includes(file.type)) { toast.error("Formato inválido. Use JPEG, PNG ou WebP"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB"); return; }
    setUploading(type);
    const mimeExt: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const ext = mimeExt[file.type] || (file.name.split(".").pop() ?? "jpg");
    const path = `${user.id}/${type}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error("Erro no upload"); }
 else {
 toast.success("Documento enviado!");
 setDocs(prev => {
 const next = { ...prev, [type]: true };
 const requiredKeys = isCnpj ? ["front", "back", "selfie", "cnpj_card"] : ["front", "back", "selfie"];
 const allComplete = requiredKeys.every(k => next[k]);
 if (allComplete) {
 setTimeout(() => setCompleted(true), 600);
 } else {
 const stepIdx = STEPS.findIndex(s => s.type === type);
 if (stepIdx < STEPS.length - 1) setTimeout(() => setCurrentStep(stepIdx + 1), 500);
 }
 return next;
 });
 }
 setUploading(null);
 }, [user]);

 const handleDismiss = useCallback(() => {
 if (user?.id) localStorage.setItem(`venxpay_kyc_popup_dismissed_${user.id}`, "true");
 setOpen(false);
 }, [user?.id]);

 const requiredKeys = isCnpj ? ["front", "back", "selfie", "cnpj_card"] : ["front", "back", "selfie"];
 const allDone = requiredKeys.every(k => docs[k]);
 const uploadedCount = Object.values(docs).filter(Boolean).length;
 const step = STEPS[currentStep];

 if (!open) return null;

 return (
 <AnimatePresence>
 <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4">
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="absolute inset-0 bg-background/80 backdrop-blur-2xl"
 onClick={handleDismiss}
 />

 <motion.div
 initial={{ opacity: 0, scale: 0.9, y: 32 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 12 }}
 transition={{ duration: 0.5, ease }}
 className="relative w-full max-w-lg rounded-3xl border border-border/20 bg-card shadow-[0_40px_120px_rgba(0,0,0,0.2)] overflow-hidden"
 >
 {/* Top accent */}
 <div className="h-1 bg-gradient-to-r from-warning via-primary to-success" />

 {/* Ambient */}
 <div className="absolute inset-0 bg-gradient-to-b from-warning/5 via-transparent to-primary/3 pointer-events-none" />
 <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />

 {/* Close */}
 <button
 onClick={handleDismiss}
 className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/40 flex items-center justify-center hover:bg-muted/60 z-10 transition-colors"
 >
 <XIcon className="h-4 w-4 text-muted-foreground" />
 </button>

 <div className="relative p-5 sm:p-8">
 <AnimatePresence mode="wait">
 {completed ? (
 /* ═══ SUCCESS SCREEN ═══ */
 <motion.div
 key="success"
 initial={{ opacity: 0, scale: 0.9 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0 }}
 className="text-center py-4"
 >
 <motion.div
 initial={{ scale: 0, rotate: -180 }}
 animate={{ scale: 1, rotate: 0 }}
 transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
 className="mx-auto mb-6 h-20 w-20 rounded-3xl bg-success/10 ring-2 ring-success/20 flex items-center justify-center"
 >
 <PartyPopper className="h-10 w-10 text-success" />
 </motion.div>
 <h2 className="text-2xl font-display font-black text-foreground tracking-[-0.03em] mb-2">
 Documentos Enviados!
 </h2>
 <p className="text-sm text-muted-foreground/50 max-w-xs mx-auto mb-8 leading-relaxed">
 Sua conta será analisada pela nossa equipe. Você receberá uma notificação quando for aprovada.
 </p>
 <div className="flex items-center justify-center gap-3 mb-6">
 {STEPS.map((s, i) => (
 <motion.div
 key={s.type}
 initial={{ opacity: 0, y: 12 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.4 + i * 0.1 }}
 className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/5 ring-1 ring-success/15"
 >
 <CheckCircle2 className="h-4 w-4 text-success" />
 <span className="text-[11px] font-display font-bold text-success/70">{s.label.split("—")[0].trim()}</span>
 </motion.div>
 ))}
 </div>
 <Button onClick={handleDismiss} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm shadow-lg shadow-primary/20">
 <Rocket className="h-4 w-4 mr-2" /> Ir para o Dashboard
 </Button>
 </motion.div>
 ) : (
 /* ═══ STEP-BY-STEP ═══ */
 <motion.div key={`step-${currentStep}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
 {/* Header */}
 <div className="text-center mb-6">
 <motion.div
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
 className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-warning/10 ring-1 ring-warning/20 flex items-center justify-center"
 >
 <Shield className="h-8 w-8 text-warning" />
 </motion.div>
 <h2 className="text-xl font-display font-black text-foreground tracking-[-0.03em]">
 Verifique sua Conta
 </h2>
 <p className="text-[12px] text-muted-foreground/50 mt-1.5 max-w-[320px] mx-auto leading-relaxed">
 Envie seus documentos para liberar saques e todas as funcionalidades.
 </p>
 </div>

 {/* Step indicators */}
 <div className="flex items-center justify-center gap-2 mb-6">
 {STEPS.map((s, i) => (
 <button key={s.type} onClick={() => setCurrentStep(i)} className="flex items-center gap-1.5 group">
 <div className={cn(
 "h-8 w-8 rounded-xl flex items-center justify-center ring-1 transition-all duration-300 text-[11px] font-display font-bold",
 docs[s.type]
 ? "bg-success/10 ring-success/20 text-success"
 : i === currentStep
 ? "bg-warning/10 ring-warning/20 text-warning scale-110"
 : "bg-muted/10 ring-border/15 text-muted-foreground/30"
 )}>
 {docs[s.type] ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
 </div>
 {i < STEPS.length - 1 && (
 <div className={cn("w-8 h-0.5 rounded-full transition-colors", docs[s.type] ? "bg-success/30" : "bg-border/15")} />
 )}
 </button>
 ))}
 </div>

 {/* Current step content */}
 <div className="mb-6">
 <div className={cn(
 "relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 cursor-pointer group",
 docs[step.type]
 ? "border-success/30 bg-success/5"
 : uploading === step.type
 ? "border-warning/30 bg-warning/5"
 : "border-border/20 bg-muted/5 hover:border-warning/30 hover:bg-warning/[0.03]"
 )} onClick={() => !docs[step.type] && !uploading && fileRef.current?.click()}>
 <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(step.type, e.target.files[0])} />

 <div className={cn(
 "mx-auto mb-4 h-16 w-16 rounded-2xl flex items-center justify-center ring-1 transition-all",
 docs[step.type]
 ? "bg-success/10 ring-success/20"
 : uploading === step.type
 ? "bg-warning/10 ring-warning/20"
 : "bg-muted/10 ring-border/15 group-hover:ring-warning/20 group-hover:bg-warning/10"
 )}>
 {uploading === step.type ? (
 <Loader2 className="h-7 w-7 animate-spin text-warning" />
 ) : docs[step.type] ? (
 <CheckCircle2 className="h-7 w-7 text-success" />
 ) : (
 <step.icon className="h-7 w-7 text-muted-foreground/30 group-hover:text-warning transition-colors" />
 )}
 </div>

 <h3 className="text-base font-display font-bold text-foreground mb-1">{step.label}</h3>
 <p className="text-[12px] text-muted-foreground/50 mb-3">{step.desc}</p>

 {docs[step.type] ? (
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-[11px] font-display font-bold">
 <CheckCircle2 className="h-3.5 w-3.5" /> Enviado com sucesso
 </span>
 ) : uploading === step.type ? (
 <span className="text-[11px] text-warning font-display font-bold">Enviando...</span>
 ) : (
 <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-warning/10 text-warning text-[11px] font-display font-bold group-hover:bg-warning/15 transition-colors">
 <Upload className="h-3.5 w-3.5" /> Clique para enviar
 </span>
 )}
 </div>

 {/* Tip */}
 <div className="flex items-start gap-2.5 mt-3 p-3 rounded-xl bg-info/5 ring-1 ring-info/10">
 <Eye className="h-4 w-4 text-info shrink-0 mt-0.5" />
 <p className="text-[10px] text-info/60 font-medium leading-relaxed">{step.tip}</p>
 </div>
 </div>

 {/* Progress bar */}
 <div className="mb-5">
  <div className="flex items-center justify-between mb-2">
  <span className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Progresso</span>
  <span className="text-[11px] font-display font-bold text-foreground/50 tabular-nums">{uploadedCount}/{STEPS.length}</span>
  </div>
  <div className="h-2.5 rounded-full bg-muted/10 ring-1 ring-border/8 overflow-hidden">
  <motion.div
  animate={{ width: `${Math.min(100, (uploadedCount / STEPS.length) * 100)}%` }}
  transition={{ duration: 0.6, ease }}
  className="h-full rounded-full bg-gradient-to-r from-warning via-primary to-success"
  style={{ boxShadow: "0 0 12px hsl(var(--primary) / 0.3)" }}
  />
  </div>
  </div>

 {/* Navigation */}
 <div className="flex items-center gap-3">
 {currentStep > 0 && (
 <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="h-11 px-4 rounded-xl text-muted-foreground/50 hover:text-foreground">
 <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
 </Button>
 )}
 <div className="flex-1" />
 {allDone ? (
 <Button onClick={() => setCompleted(true)} className="h-11 px-6 rounded-xl gradient-primary text-primary-foreground font-display font-bold shadow-lg shadow-primary/15">
 <Sparkles className="h-4 w-4 mr-2" /> Concluir
 </Button>
 ) : currentStep < STEPS.length - 1 ? (
 <Button variant="ghost" onClick={() => setCurrentStep(currentStep + 1)} className="h-11 px-4 rounded-xl text-muted-foreground/50 hover:text-foreground">
 Próximo <ArrowRight className="h-4 w-4 ml-1" />
 </Button>
 ) : null}
 </div>

 {/* Skip */}
 <div className="text-center mt-4">
 <button onClick={handleDismiss} className="text-[11px] text-muted-foreground/30 hover:text-muted-foreground/50 font-display font-medium transition-colors">
 Fazer depois — <span className="font-bold text-muted-foreground/40">Perfil → Identidade & KYC</span>
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </motion.div>
 </div>
 </AnimatePresence>
 );
}
