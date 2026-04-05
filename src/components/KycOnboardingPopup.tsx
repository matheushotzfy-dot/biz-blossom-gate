/**
 * KYC Onboarding Popup — shown right after account creation
 * Allows uploading documents without navigating to Identidade page.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  X as XIcon, Shield, Upload, Camera, Image, Loader2, CheckCircle2,
  AlertTriangle, ArrowRight, FileCheck, Fingerprint, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;
const ALLOWED_KYC_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

function MiniDocSlot({ type, label, icon, uploaded, uploading, onUpload }: {
  type: string; label: string; icon: React.ReactNode;
  uploaded: boolean; uploading: boolean; onUpload: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const canUpload = !uploaded && !uploading;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * (type === "front" ? 0 : type === "back" ? 1 : 2), ease }}
      whileHover={canUpload ? { scale: 1.02 } : undefined}
      onClick={() => canUpload && ref.current?.click()}
      className={cn(
        "relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all ring-1 group cursor-pointer",
        uploaded
          ? "bg-primary/5 ring-primary/15"
          : "bg-muted/5 ring-border/10 hover:ring-warning/20 hover:bg-warning/[0.03]"
      )}
    >
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      <div className={cn(
        "h-11 w-11 rounded-xl flex items-center justify-center ring-1 transition-all",
        uploaded ? "bg-primary/10 ring-primary/15 text-primary" : "bg-muted/8 ring-border/10 text-muted-foreground/30 group-hover:text-warning/50 group-hover:ring-warning/15"
      )}>
        {uploading ? <Loader2 className="h-5 w-5 animate-spin text-warning" /> : uploaded ? <CheckCircle2 className="h-5 w-5" /> : icon}
      </div>
      <p className={cn("text-[10px] font-display font-bold text-center", uploaded ? "text-primary/60" : "text-foreground/50")}>{label}</p>
      <p className={cn("text-[8px]", uploaded ? "text-primary/40" : "text-muted-foreground/25")}>
        {uploaded ? "Enviado ✓" : "Toque para enviar"}
      </p>
    </motion.div>
  );
}

export function KycOnboardingPopup() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Record<string, boolean>>({ front: false, back: false, selfie: false });
  const [uploading, setUploading] = useState<string | null>(null);

  // Show popup on first login when not approved and hasn't been dismissed yet
  useEffect(() => {
    if (!user?.id || !profile) return;
    if (profile.account_status === "approved") return;
    const key = `hotzfy_kyc_popup_dismissed_${user.id}`;
    if (localStorage.getItem(key)) return;
    // Small delay to let dashboard render first
    const timer = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(timer);
  }, [user?.id, profile?.account_status]);

  // Check existing docs
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const types = ["front", "back", "selfie"];
      const results = await Promise.all(
        types.map(t => supabase.storage.from("kyc-documents").list(`${user.id}`, { search: t }))
      );
      const d: Record<string, boolean> = {};
      types.forEach((t, i) => { d[t] = !!(results[i].data && results[i].data.length > 0); });
      setDocs(d);
    })();
  }, [user?.id]);

  const handleUpload = useCallback(async (type: string, file: File) => {
    if (!user) return;
    if (!ALLOWED_KYC_TYPES.includes(file.type)) { toast.error("Formato inválido. Use JPEG, PNG ou WebP"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB"); return; }
    setUploading(type);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${type}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload"); }
    else { toast.success("Documento enviado!"); setDocs(prev => ({ ...prev, [type]: true })); }
    setUploading(null);
  }, [user]);

  const handleDismiss = useCallback(() => {
    if (user?.id) localStorage.setItem(`hotzfy_kyc_popup_dismissed_${user.id}`, "true");
    setOpen(false);
  }, [user?.id]);

  const allDone = docs.front && docs.back && docs.selfie;

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/70 backdrop-blur-xl"
          onClick={handleDismiss}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.5, ease }}
          className="relative w-full max-w-md rounded-2xl border border-warning/20 bg-card shadow-2xl overflow-hidden"
        >
          {/* Ambient glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-warning/5 via-transparent to-primary/3 pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />

          {/* Close */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-muted/60 flex items-center justify-center hover:bg-muted z-10 transition-colors"
          >
            <XIcon className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="relative p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-warning/10 ring-1 ring-warning/20 flex items-center justify-center"
              >
                <Shield className="h-8 w-8 text-warning" />
              </motion.div>
              <h2 className="text-lg font-display font-black text-foreground tracking-[-0.03em]">
                Verifique sua Conta
              </h2>
              <p className="text-[12px] text-muted-foreground/50 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
                Envie seus documentos agora para liberar saques e acessar todas as funcionalidades da plataforma.
              </p>
            </div>

            {/* Steps info */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/5 ring-1 ring-warning/10 mb-5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
              <p className="text-[10px] text-warning/70 font-medium">
                Sua conta ficará em análise até os documentos serem verificados.
              </p>
            </div>

            {/* Upload slots */}
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              <MiniDocSlot type="front" label="Doc. Frente" icon={<Image className="h-5 w-5" />} uploaded={docs.front} uploading={uploading === "front"} onUpload={(f) => handleUpload("front", f)} />
              <MiniDocSlot type="back" label="Doc. Verso" icon={<Image className="h-5 w-5" />} uploaded={docs.back} uploading={uploading === "back"} onUpload={(f) => handleUpload("back", f)} />
              <MiniDocSlot type="selfie" label="Selfie c/ Doc" icon={<Camera className="h-5 w-5" />} uploaded={docs.selfie} uploading={uploading === "selfie"} onUpload={(f) => handleUpload("selfie", f)} />
            </div>

            {/* Progress */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-display font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Progresso</span>
                <span className="text-[10px] font-display font-bold text-foreground/50 tabular-nums">
                  {Object.values(docs).filter(Boolean).length}/3
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/10 ring-1 ring-border/8 overflow-hidden">
                <motion.div
                  animate={{ width: `${(Object.values(docs).filter(Boolean).length / 3) * 100}%` }}
                  transition={{ duration: 0.6, ease }}
                  className="h-full rounded-full bg-gradient-to-r from-warning via-warning/80 to-primary"
                  style={{ boxShadow: "0 0 8px hsl(var(--warning) / 0.3)" }}
                />
              </div>
            </div>

            {/* All done message */}
            {allDone && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-success/5 ring-1 ring-success/15 mb-5"
              >
                <Sparkles className="h-4 w-4 text-success shrink-0" />
                <p className="text-[11px] font-display font-bold text-success">
                  Documentos enviados! Sua conta será analisada em breve.
                </p>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleDismiss}
                className={cn(
                  "w-full h-11 rounded-xl font-display font-bold shadow-lg active:scale-[0.985] transition-all",
                  allDone
                    ? "gradient-primary shadow-primary/15"
                    : "bg-muted/10 hover:bg-muted/20 text-foreground/60 shadow-none"
                )}
              >
                {allDone ? "Concluir" : "Fazer depois"}
              </Button>
              {!allDone && (
                <p className="text-[9px] text-center text-muted-foreground/30">
                  Você pode enviar depois em <span className="font-bold text-muted-foreground/50">Perfil → Identidade & KYC</span>
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
