import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Sparkles, Check, ChevronRight, ChevronLeft, Image as ImageIcon,
  X, BookOpen, Layers, Type, FileText, Palette, Eye,
  GraduationCap, Upload, Plus, Trash2, ArrowRight, Loader2,
  Play, Clock, Users, Star, Zap, Monitor, Smartphone,
  CheckCircle2, Flame, Trophy, BarChart3, Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

interface Product { id: string; name: string; price: number; }

interface WizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: Product[];
  editCourse?: {
    id: string; title: string; description: string | null;
    category: string | null; product_id: string | null;
    thumbnail_url: string | null;
  } | null;
  onSaved: () => void;
}

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Step = "info" | "visual" | "modules" | "review";

const STEPS: { id: Step; label: string; desc: string; icon: any }[] = [
  { id: "info", label: "Informações", desc: "Nome e detalhes", icon: Type },
  { id: "visual", label: "Visual", desc: "Capa e identidade", icon: Palette },
  { id: "modules", label: "Módulos", desc: "Estrutura do curso", icon: Layers },
  { id: "review", label: "Publicar", desc: "Revisão final", icon: Eye },
];

// ── Image Upload ──
function ImageUpload({ value, onChange, label, aspect = "aspect-video", hint }: {
  value: string; onChange: (url: string) => void; label: string; aspect?: string; hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED.includes(file.type)) { toast.error("Formato inválido"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `content/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error("Erro no upload"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    onChange(urlData.publicUrl);
    setUploading(false);
  };

  return (
    <div>
      <Label className="text-[10px] font-display font-bold text-foreground/50 uppercase tracking-[0.1em] mb-2 block">{label}</Label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className={cn("relative rounded-2xl border-2 border-dashed border-border/20 hover:border-primary/30 transition-all duration-500 cursor-pointer overflow-hidden group/img", aspect, value ? "p-0" : "flex flex-col items-center justify-center bg-muted/5")}
      >
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-background/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button type="button" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }} className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"><ImageIcon className="h-4 w-4 text-foreground" /></button>
              <button type="button" onClick={e => { e.stopPropagation(); onChange(""); }} className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center text-destructive hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
            </div>
          </>
        ) : (
          <>
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-3 border border-primary/10">
              {uploading ? <Loader2 className="h-6 w-6 text-primary/40 animate-spin" /> : <Upload className="h-6 w-6 text-primary/20" />}
            </div>
            <p className="text-xs font-display font-bold text-muted-foreground/40">{uploading ? "Enviando..." : "Clique ou arraste"}</p>
            <p className="text-[10px] text-muted-foreground/25 mt-1">PNG, JPG até 5MB</p>
          </>
        )}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/30 mt-2 font-display">{hint}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ── Cinematic Live Preview ──
function CinematicPreview({ form, modules, viewMode }: { form: any; modules: string[]; viewMode: "desktop" | "mobile" }) {
  const totalModules = modules.length;
  const isMobile = viewMode === "mobile";

  return (
    <div className={cn(
      "rounded-2xl border border-border/20 bg-background overflow-hidden shadow-2xl shadow-primary/5 transition-all duration-500 mx-auto",
      isMobile ? "max-w-[220px]" : "w-full"
    )}>
      {/* Browser chrome */}
      <div className={cn("bg-card/80 border-b border-border/15 flex items-center gap-1.5 px-3", isMobile ? "h-5" : "h-7")}>
        <div className={cn("rounded-full bg-destructive/30", isMobile ? "h-1 w-1" : "h-1.5 w-1.5")} />
        <div className={cn("rounded-full bg-warning/30", isMobile ? "h-1 w-1" : "h-1.5 w-1.5")} />
        <div className={cn("rounded-full bg-success/30", isMobile ? "h-1 w-1" : "h-1.5 w-1.5")} />
        <div className={cn("ml-2 flex-1 max-w-[140px] rounded-md bg-muted/10 flex items-center justify-center", isMobile ? "h-3" : "h-4")}>
          <span className={cn("text-muted-foreground/30 truncate px-2", isMobile ? "text-[5px]" : "text-[7px]")}>{form.title || "Área de Membros"}</span>
        </div>
      </div>

      {/* ─── Netflix-style content ─── */}
      <div className={cn("overflow-y-auto", isMobile ? "max-h-[380px]" : "max-h-[360px]")}>
        {/* Hero Billboard */}
        <div className="relative overflow-hidden" style={{ aspectRatio: isMobile ? "16/10" : "21/9" }}>
          {form.thumbnail_url ? (
            <img src={form.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/12 via-background to-background flex items-center justify-center relative">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(hsl(var(--primary)) 1px, transparent 1px)", backgroundSize: "12px 12px" }} />
              <GraduationCap className={cn("text-primary/10", isMobile ? "h-6 w-6" : "h-10 w-10")} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-2.5">
            <div className="flex items-center gap-1 mb-1">
              {form.category && (
                <span className={cn("rounded bg-foreground/10 backdrop-blur-xl text-foreground/60 font-display font-bold uppercase tracking-wider", isMobile ? "text-[4px] px-1 py-0.5" : "text-[6px] px-1.5 py-0.5")}>
                  {form.category}
                </span>
              )}
            </div>
            <p className={cn("font-display font-black text-foreground truncate leading-tight", isMobile ? "text-[8px]" : "text-[11px]")}>{form.title || "Nome do Curso"}</p>
            {form.description && <p className={cn("text-muted-foreground/40 line-clamp-1 mt-0.5 font-display", isMobile ? "text-[5px]" : "text-[7px]")}>{form.description}</p>}
            {/* Progress bar */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className={cn("rounded-full bg-foreground/10 overflow-hidden flex-1", isMobile ? "h-0.5" : "h-1")}>
                <div className="h-full w-1/3 bg-primary rounded-full" />
              </div>
              <span className={cn("text-foreground/30 font-display font-bold tabular-nums", isMobile ? "text-[4px]" : "text-[6px]")}>33%</span>
            </div>
            {/* CTA buttons */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className={cn("rounded-md bg-foreground text-background font-display font-black flex items-center gap-1", isMobile ? "text-[5px] px-2 py-0.5" : "text-[7px] px-3 py-1")}>
                <Play className={cn("fill-current", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} /> Assistir
              </div>
              <div className={cn("rounded-md bg-foreground/10 backdrop-blur-xl text-foreground/60 font-display font-bold", isMobile ? "text-[5px] px-2 py-0.5" : "text-[7px] px-2.5 py-1")}>
                Detalhes
              </div>
            </div>
          </div>
        </div>

        {/* KPI Stats */}
        <div className={cn("grid gap-1 mx-2", isMobile ? "grid-cols-2 mt-1.5" : "grid-cols-4 mt-2")}>
          {[
            { icon: BookOpen, label: "Cursos", value: "1", color: "primary" },
            { icon: BarChart3, label: "Progresso", value: "33%", color: "info" },
            ...(isMobile ? [] : [
              { icon: Flame, label: "Aulas", value: String(totalModules * 3 || "0"), color: "warning" },
              { icon: Trophy, label: "Completos", value: "0", color: "success" },
            ]),
          ].map(kpi => (
            <div key={kpi.label} className={cn("rounded-lg bg-card/60 border border-border/10 relative overflow-hidden", isMobile ? "p-1.5" : "p-2")}>
              <div className={cn("absolute left-0 top-0 bottom-0 w-[1.5px]", `bg-${kpi.color}`)} />
              <div className="flex items-center gap-1.5">
                <div className={cn("rounded flex items-center justify-center", `bg-${kpi.color}/10`, isMobile ? "h-3 w-3" : "h-4 w-4")}>
                  <kpi.icon className={cn(`text-${kpi.color}`, isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />
                </div>
                <div>
                  <span className={cn(`text-${kpi.color} font-display font-black tabular-nums block leading-none`, isMobile ? "text-[6px]" : "text-[8px]")}>{kpi.value}</span>
                  <span className={cn("text-muted-foreground/30 font-display font-bold uppercase tracking-wider", isMobile ? "text-[4px]" : "text-[5px]")}>{kpi.label}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modules Section */}
        <div className="p-2 mt-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className={cn("rounded bg-card flex items-center justify-center", isMobile ? "h-3 w-3" : "h-4 w-4")}>
              <Layers className={cn("text-foreground/40", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />
            </div>
            <span className={cn("font-display font-black text-foreground tracking-tight", isMobile ? "text-[7px]" : "text-[9px]")}>Meus Cursos</span>
          </div>

          {/* Course cards */}
          <div className={cn("flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide", isMobile ? "" : "")}>
            {/* Main course card */}
            <div className={cn("shrink-0 rounded-lg overflow-hidden bg-card ring-1 ring-border/10 relative", isMobile ? "w-[70px]" : "w-[100px]")}>
              <div className="aspect-[2/3] relative overflow-hidden">
                {form.thumbnail_url ? (
                  <img src={form.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-primary/10 via-card to-card flex items-center justify-center">
                    <GraduationCap className={cn("text-primary/10", isMobile ? "h-4 w-4" : "h-6 w-6")} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-0 left-0 right-0 p-1.5">
                  <p className={cn("font-display font-black text-foreground line-clamp-2 leading-snug", isMobile ? "text-[5px]" : "text-[7px]")}>{form.title || "Meu Curso"}</p>
                  <div className={cn("rounded-full bg-foreground/8 overflow-hidden mt-1", isMobile ? "h-[1px]" : "h-[2px]")}>
                    <div className="h-full w-1/3 bg-primary rounded-full" />
                  </div>
                </div>
              </div>
            </div>
            {/* Placeholder cards */}
            {[1, 2].map(i => (
              <div key={i} className={cn("shrink-0 rounded-lg overflow-hidden bg-card/30 ring-1 ring-border/5 opacity-30", isMobile ? "w-[70px]" : "w-[100px]")}>
                <div className="aspect-[2/3] bg-gradient-to-b from-muted/5 to-card flex items-center justify-center">
                  <GraduationCap className={cn("text-muted-foreground/5", isMobile ? "h-3 w-3" : "h-5 w-5")} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Module rows */}
        {modules.length > 0 && (
          <div className="p-2 pt-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className={cn("rounded bg-card flex items-center justify-center", isMobile ? "h-3 w-3" : "h-4 w-4")}>
                <BookOpen className={cn("text-foreground/40", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />
              </div>
              <span className={cn("font-display font-black text-foreground tracking-tight", isMobile ? "text-[7px]" : "text-[9px]")}>{form.title || "Meu Curso"}</span>
              <span className={cn("text-muted-foreground/30 font-display", isMobile ? "text-[5px]" : "text-[6px]")}>{modules.length} módulos</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {modules.map((m, i) => (
                <div key={i} className={cn("shrink-0 rounded-lg overflow-hidden bg-card ring-1 ring-border/10", isMobile ? "w-[80px]" : "w-[110px]")}>
                  <div className="aspect-video bg-gradient-to-br from-primary/5 to-card flex items-center justify-center relative">
                    <BookOpen className={cn("text-primary/8", isMobile ? "h-3 w-3" : "h-4 w-4")} />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                  </div>
                  <div className="p-1.5">
                    <p className={cn("font-display font-bold text-foreground/60 truncate", isMobile ? "text-[5px]" : "text-[7px]")}>{m}</p>
                    <p className={cn("text-muted-foreground/20 font-display tabular-nums mt-0.5", isMobile ? "text-[4px]" : "text-[5px]")}>3 aulas</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
export default function CourseCreationWizard({ open, onOpenChange, products, editCourse, onSaved }: WizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>("info");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  const [form, setForm] = useState({
    title: editCourse?.title || "",
    description: editCourse?.description || "",
    category: editCourse?.category || "geral",
    product_id: editCourse?.product_id || "",
    thumbnail_url: editCourse?.thumbnail_url || "",
  });

  const [wizardModules, setWizardModules] = useState<string[]>([]);
  const [newModuleName, setNewModuleName] = useState("");

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);

  const canNext = () => {
    if (currentStep === "info") return form.title.trim().length > 0;
    return true;
  };

  const goNext = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };

  const goPrev = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1].id);
  };

  const addModule = () => {
    if (!newModuleName.trim()) return;
    setWizardModules(prev => [...prev, newModuleName.trim()]);
    setNewModuleName("");
  };

  const removeModule = (index: number) => {
    setWizardModules(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user || !form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        category: form.category || "geral",
        product_id: form.product_id && form.product_id !== "none" ? form.product_id : null,
        thumbnail_url: form.thumbnail_url || null,
        user_id: user.id,
        is_published: false,
      };

      if (editCourse) {
        const { user_id, is_published, ...up } = payload;
        await supabase.from("courses").update(up).eq("id", editCourse.id).eq("user_id", user.id);
        toast.success("Curso atualizado!");
        onOpenChange(false);
        onSaved();
      } else {
        const { data } = await supabase.from("courses").insert(payload).select().single();
        if (data && wizardModules.length > 0) {
          const modulesPayload = wizardModules.map((title, i) => ({
            course_id: data.id,
            title,
            sort_order: i,
          }));
          await supabase.from("modules").insert(modulesPayload);
        }
        toast.success("Curso criado com sucesso!");
        onOpenChange(false);
        onSaved();
        if (data) navigate(`/vendas/conteudo/${data.id}/builder`);
      }
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setCurrentStep("info");
      setForm({
        title: editCourse?.title || "",
        description: editCourse?.description || "",
        category: editCourse?.category || "geral",
        product_id: editCourse?.product_id || "",
        thumbnail_url: editCourse?.thumbnail_url || "",
      });
      setWizardModules([]);
    }
    onOpenChange(v);
  };

  // Completion score
  const completionItems = [
    { done: !!form.title.trim(), label: "Nome" },
    { done: !!form.description.trim(), label: "Descrição" },
    { done: !!form.thumbnail_url, label: "Capa" },
    { done: wizardModules.length > 0 || !!editCourse, label: "Módulos" },
  ];
  const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[1060px] p-0 gap-0 bg-card/95 backdrop-blur-2xl border-border/20 overflow-hidden rounded-3xl max-h-[92vh]">
        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-border/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-info/[0.02] pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

          <div className="relative flex items-center justify-between mb-4">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 ring-1 ring-primary/20">
                {editCourse ? <BookOpen className="h-5 w-5 text-primary-foreground" /> : <Sparkles className="h-5 w-5 text-primary-foreground" />}
              </div>
              <div>
                <h2 className="text-lg font-display font-black tracking-[-0.02em] text-foreground">{editCourse ? "Editar Curso" : "Novo Curso"}</h2>
                <p className="text-[10px] text-muted-foreground/40 font-display mt-0.5">
                  {STEPS[stepIndex].desc} — Passo {stepIndex + 1} de {STEPS.length}
                </p>
              </div>
            </div>

            {/* Completion ring */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5">
                {completionItems.map((item, i) => (
                  <div key={i} className={cn("h-1.5 w-1.5 rounded-full transition-all", item.done ? "bg-success" : "bg-muted/15")} title={item.label} />
                ))}
              </div>
              <div className={cn(
                "h-9 px-3 rounded-lg flex items-center gap-1.5 text-[10px] font-display font-black border transition-all",
                completionPct === 100 ? "bg-success/10 text-success border-success/20" : "bg-muted/5 text-muted-foreground/40 border-border/15"
              )}>
                <span className="tabular-nums">{completionPct}%</span>
                <span className="hidden sm:inline">completo</span>
              </div>
            </div>
          </div>

          {/* Step indicators */}
          <div className="relative flex items-center gap-1">
            {STEPS.map((step, i) => {
              const isActive = currentStep === step.id;
              const isDone = i < stepIndex;
              return (
                <button
                  key={step.id}
                  onClick={() => { if (isDone || isActive) setCurrentStep(step.id); }}
                  className={cn(
                    "relative flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-display font-bold transition-all duration-300",
                    isActive ? "text-primary" : isDone ? "text-success/60 cursor-pointer hover:bg-success/5" : "text-muted-foreground/20"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="wizard-step-bg"
                      className="absolute inset-0 rounded-xl bg-primary/8 border border-primary/15"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2">
                    {isDone ? (
                      <div className="h-5 w-5 rounded-full bg-success/15 flex items-center justify-center">
                        <Check className="h-3 w-3 text-success" />
                      </div>
                    ) : (
                      <step.icon className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 bg-muted/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
              animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease }}
            />
          </div>
        </div>

        {/* ── Body: Content + Preview ── */}
        <div className="flex min-h-[440px] max-h-[calc(92vh-220px)]">
          {/* Left: Form */}
          <div className="flex-1 p-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease }}
                className="space-y-5"
              >
                {/* ─── STEP: INFO ─── */}
                {currentStep === "info" && (
                  <>
                    <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 flex items-start gap-3">
                      <Zap className="h-5 w-5 text-primary/50 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-display font-bold text-foreground/60">Comece pelo essencial</p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-relaxed">Dê um nome impactante e descreva o que o aluno vai aprender. Observe o preview em tempo real!</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] font-display font-bold text-foreground/50 uppercase tracking-[0.1em]">Nome do Curso *</Label>
                      <Input
                        value={form.title}
                        onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="Ex: Marketing Digital Avançado"
                        className="mt-2 h-12 rounded-xl text-base font-display"
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-display font-bold text-foreground/50 uppercase tracking-[0.1em]">Descrição</Label>
                      <Textarea
                        value={form.description}
                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="O que os alunos vão aprender neste curso..."
                        className="mt-2 rounded-xl text-sm font-display"
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] font-display font-bold text-foreground/50 uppercase tracking-[0.1em]">Categoria</Label>
                        <Input
                          value={form.category}
                          onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                          placeholder="Ex: Marketing"
                          className="mt-2 h-11 rounded-xl font-display"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-display font-bold text-foreground/50 uppercase tracking-[0.1em]">Produto Vinculado</Label>
                        <Select value={form.product_id} onValueChange={v => setForm(p => ({ ...p, product_id: v }))}>
                          <SelectTrigger className="mt-2 rounded-xl h-11 font-display"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}

                {/* ─── STEP: VISUAL ─── */}
                {currentStep === "visual" && (
                  <>
                    <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 flex items-start gap-3">
                      <Palette className="h-5 w-5 text-primary/50 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-display font-bold text-foreground/60">Crie uma identidade visual</p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-relaxed">Uma boa capa aumenta em até 3x o engajamento dos alunos. Veja o impacto no preview!</p>
                      </div>
                    </div>
                    <ImageUpload
                      value={form.thumbnail_url}
                      onChange={url => setForm(p => ({ ...p, thumbnail_url: url }))}
                      label="Thumbnail / Capa do Curso"
                      aspect="aspect-video"
                      hint="Recomendado: 1280x720px (16:9). Será exibida no catálogo Netflix dos seus alunos."
                    />
                  </>
                )}

                {/* ─── STEP: MODULES ─── */}
                {currentStep === "modules" && (
                  <>
                    <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 flex items-start gap-3">
                      <Layers className="h-5 w-5 text-primary/50 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-display font-bold text-foreground/60">Monte a estrutura</p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-relaxed">Organize seu conteúdo em módulos. Cada módulo aparece como uma seção no catálogo do aluno.</p>
                      </div>
                    </div>
                    {!editCourse ? (
                      <>
                        <div className="flex gap-2">
                          <Input
                            value={newModuleName}
                            onChange={e => setNewModuleName(e.target.value)}
                            placeholder="Ex: Introdução ao Marketing..."
                            className="h-11 rounded-xl font-display"
                            onKeyDown={e => { if (e.key === "Enter") addModule(); }}
                          />
                          <Button onClick={addModule} disabled={!newModuleName.trim()} className="h-11 rounded-xl px-5 font-display font-bold gap-2 shrink-0 active:scale-[0.985]">
                            <Plus className="h-4 w-4" /> Adicionar
                          </Button>
                        </div>

                        {wizardModules.length > 0 && (
                          <div className="space-y-1.5">
                            {wizardModules.map((m, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="flex items-center gap-3 p-3.5 rounded-xl bg-card/60 border border-border/15 group hover:border-primary/15 hover:bg-primary/[0.02] transition-all"
                              >
                                <div className="h-9 w-9 rounded-lg bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center text-xs font-display font-black text-primary/60 shrink-0">{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-display font-bold text-foreground/70">{m}</span>
                                  <p className="text-[10px] text-muted-foreground/30 font-display mt-0.5">Aulas serão adicionadas no editor</p>
                                </div>
                                <button onClick={() => removeModule(i)} className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/8 transition-all">
                                  <Trash2 className="h-3 w-3 text-destructive/40" />
                                </button>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {wizardModules.length === 0 && (
                          <div className="rounded-xl border-2 border-dashed border-border/15 py-10 flex flex-col items-center gap-3 text-muted-foreground/15">
                            <Layers className="h-10 w-10" />
                            <p className="text-xs font-display font-bold">Nenhum módulo adicionado</p>
                            <p className="text-[10px]">Você pode pular e adicionar depois</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl bg-info/5 border border-info/10 p-5 text-center">
                        <Layers className="h-8 w-8 text-info/30 mx-auto mb-2" />
                        <p className="text-sm font-display font-bold text-foreground/60">Gerencie módulos no editor</p>
                        <p className="text-xs text-muted-foreground/40 mt-1">Vá ao editor completo para adicionar, reordenar ou remover módulos e aulas.</p>
                      </div>
                    )}
                  </>
                )}

                {/* ─── STEP: REVIEW ─── */}
                {currentStep === "review" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-card/60 border border-border/15 overflow-hidden">
                      <div className="px-5 py-4 border-b border-border/10 bg-card/30">
                        <p className="text-xs font-display font-black text-foreground/60 uppercase tracking-wider">Resumo do Curso</p>
                      </div>
                      <div className="p-5 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="h-20 w-32 rounded-xl overflow-hidden bg-muted/5 border border-border/10 shrink-0">
                            {form.thumbnail_url ? (
                              <img src={form.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent">
                                <GraduationCap className="h-6 w-6 text-primary/10" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-display font-black text-foreground tracking-[-0.01em]">{form.title}</h3>
                            {form.description && <p className="text-xs text-muted-foreground/50 mt-1 line-clamp-2">{form.description}</p>}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {form.category && (
                                <span className="text-[10px] font-display font-bold text-muted-foreground/50 bg-muted/8 px-2 py-0.5 rounded-md">{form.category}</span>
                              )}
                              {!editCourse && wizardModules.length > 0 && (
                                <span className="text-[10px] font-display font-bold text-primary/60 bg-primary/5 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Layers className="h-2.5 w-2.5" /> {wizardModules.length} módulo{wizardModules.length !== 1 ? "s" : ""}
                                </span>
                              )}
                              {/* Completion badges */}
                              {completionItems.map((item, i) => (
                                <span key={i} className={cn(
                                  "text-[9px] font-display font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5",
                                  item.done ? "text-success/60 bg-success/5" : "text-muted-foreground/20 bg-muted/5"
                                )}>
                                  {item.done ? <CheckCircle2 className="h-2 w-2" /> : <span className="h-2 w-2 rounded-full border border-current" />}
                                  {item.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {!editCourse && wizardModules.length > 0 && (
                          <div className="pt-3 border-t border-border/10 space-y-1.5">
                            <p className="text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider mb-2">Estrutura de Módulos</p>
                            {wizardModules.map((m, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <div className="h-5 w-5 rounded-md bg-primary/8 flex items-center justify-center text-[9px] font-display font-black text-primary/50">{i + 1}</div>
                                <span className="text-foreground/60 font-display font-semibold">{m}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl bg-success/5 border border-success/10 p-4 flex items-center gap-3">
                      <Check className="h-5 w-5 text-success/50" />
                      <p className="text-xs text-foreground/60 font-display leading-relaxed">
                        {editCourse
                          ? "Suas alterações serão salvas. Você pode continuar editando no editor."
                          : "Após criar, você será direcionado ao editor para adicionar aulas e conteúdos."
                        }
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: Live Preview */}
          <div className="hidden md:flex w-[300px] border-l border-border/10 bg-muted/[0.02] p-4 flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-primary/40" />
                <span className="text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider">Preview do Aluno</span>
              </div>
              {/* Device toggle */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/10 border border-border/10">
                {[
                  { id: "desktop" as const, icon: Monitor },
                  { id: "mobile" as const, icon: Smartphone },
                ].map(v => (
                  <button
                    key={v.id}
                    onClick={() => setViewMode(v.id)}
                    className={cn(
                      "relative h-6 w-6 rounded-md flex items-center justify-center transition-all",
                      viewMode === v.id ? "text-primary bg-card shadow-sm" : "text-muted-foreground/20 hover:text-muted-foreground/40"
                    )}
                  >
                    <v.icon className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>
            <CinematicPreview form={form} modules={wizardModules} viewMode={viewMode} />
            <p className="text-[9px] text-muted-foreground/25 text-center font-display">
              {viewMode === "mobile" ? "📱 Visão mobile" : "🖥 Visão desktop"} — atualiza em tempo real
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border/10 flex items-center justify-between bg-card/50">
          <div>
            {stepIndex > 0 && (
              <Button variant="ghost" onClick={goPrev} className="gap-2 rounded-xl font-display font-bold text-xs h-10 text-muted-foreground/50 hover:text-foreground active:scale-[0.985]">
                <ChevronLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentStep !== "review" && (
              <span className="text-[10px] text-muted-foreground/25 font-display hidden sm:block">
                {currentStep === "info" ? "Preencha o nome para continuar" : currentStep === "visual" ? "Adicione uma capa impactante" : "Organize seus módulos"}
              </span>
            )}
            {currentStep === "review" ? (
              <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="gap-2 rounded-xl font-display font-bold text-sm h-10 px-6 shadow-lg shadow-primary/15 active:scale-[0.985]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editCourse ? "Salvar Alterações" : "Criar Curso"}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canNext()} className="gap-2 rounded-xl font-display font-bold text-sm h-10 px-6 shadow-lg shadow-primary/15 active:scale-[0.985]">
                Próximo <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
