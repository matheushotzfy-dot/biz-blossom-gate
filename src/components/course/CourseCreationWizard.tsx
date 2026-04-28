import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  GraduationCap,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Loader2,
  Monitor,
  Package,
  Palette,
  Plus,
  Rocket,
  Smartphone,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MemberExperiencePreview,
  type PreviewModule,
} from "@/components/course/MemberExperiencePreview";

interface Product {
  id: string;
  name: string;
  price: number;
}

interface EditModulePreview {
  id?: string;
  title: string;
  banner_url?: string | null;
  lessonsCount?: number;
}

interface WizardProps {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  products: Product[];
  editCourse?: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    product_id: string | null;
    thumbnail_url: string | null;
    modules?: EditModulePreview[];
  } | null;
  onSaved: () => void;
}

const COURSE_CATEGORIES = [
  { value: "marketing", label: "Marketing Digital" },
  { value: "vendas", label: "Vendas" },
  { value: "negocios", label: "Negócios" },
  { value: "financas", label: "Finanças" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "design", label: "Design" },
  { value: "saude", label: "Saúde & Bem-estar" },
  { value: "educacao", label: "Educação" },
  { value: "desenvolvimento-pessoal", label: "Desenvolvimento Pessoal" },
  { value: "produtividade", label: "Produtividade" },
  { value: "idiomas", label: "Idiomas" },
  { value: "direito", label: "Direito" },
  { value: "culinaria", label: "Culinária" },
  { value: "fitness", label: "Fitness" },
  { value: "musica", label: "Música" },
  { value: "fotografia", label: "Fotografia & Vídeo" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "programacao", label: "Programação" },
  { value: "geral", label: "Outros" },
] as const;

// Pre-built course templates — gives a 1-click smart start
const COURSE_TEMPLATES = [
  {
    id: "signature",
    name: "Curso Signature",
    description: "Estrutura clássica de transformação completa",
    icon: GraduationCap,
    accent: "primary" as const,
    modules: ["Boas-vindas", "Fundamentos", "Implementação", "Avançado", "Bônus"],
  },
  {
    id: "express",
    name: "Mini Curso Express",
    description: "Conteúdo rápido, foco em resultado em 7 dias",
    icon: Zap,
    accent: "warning" as const,
    modules: ["Comece aqui", "O método", "Aplicação prática", "Próximos passos"],
  },
  {
    id: "mentoria",
    name: "Mentoria / Comunidade",
    description: "Aulas + encontros + materiais de apoio",
    icon: Sparkles,
    accent: "info" as const,
    modules: ["Onboarding", "Trilha principal", "Lives gravadas", "Materiais extras", "Comunidade"],
  },
  {
    id: "blank",
    name: "Em branco",
    description: "Começar do zero, eu monto na mão",
    icon: Wand2,
    accent: "muted" as const,
    modules: [],
  },
] as const;

const STARTER_MODULES = [
  { title: "Boas-vindas", subtitle: "Primeira impressão e acesso imediato", icon: Sparkles },
  { title: "Fundamentos", subtitle: "Base para preparar o aluno", icon: BookOpen },
  { title: "Implementação", subtitle: "Parte prática e aplicação", icon: Rocket },
  { title: "Bônus", subtitle: "Materiais extras e retenção", icon: Trophy },
] as const;

// Color presets — gives instant visual identity even before uploading a banner
const COLOR_PRESETS = [
  { id: "emerald", name: "Esmeralda", from: "16 185 129", to: "5 150 105" },
  { id: "violet", name: "Violeta", from: "139 92 246", to: "109 40 217" },
  { id: "blue", name: "Oceano", from: "59 130 246", to: "29 78 216" },
  { id: "rose", name: "Rosé", from: "244 63 94", to: "190 18 60" },
  { id: "amber", name: "Âmbar", from: "245 158 11", to: "180 83 9" },
  { id: "slate", name: "Grafite", from: "71 85 105", to: "30 41 59" },
] as const;

import { Trophy } from "lucide-react";

const STEPS = [
  { id: "template", label: "Template", icon: Wand2 },
  { id: "identity", label: "Identidade", icon: GraduationCap },
  { id: "visual", label: "Capa", icon: ImageIcon },
  { id: "structure", label: "Estrutura", icon: Layers },
] as const;

type StepId = typeof STEPS[number]["id"];

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function buildModuleLessons(title: string, count = 3) {
  const clean = title.trim() || "Módulo";
  return Array.from({ length: Math.max(count, 1) }, (_, i) => ({
    id: `${clean}-${i}`.toLowerCase().replace(/\s+/g, "-"),
    title: i === 0 ? `Introdução a ${clean}` : i === 1 ? `${clean} na prática` : `${clean} • Aula ${i + 1}`,
    video_url: i === 0 ? "configured" : null,
    duration_minutes: 8 + i * 3,
    is_free: i === 0,
    completed: i === 0,
  }));
}

function buildPreviewModules(titles: string[], banner: string, seed = "Curso") {
  const source = titles.length > 0 ? titles : ["Boas-vindas", `${seed} na prática`, "Aprofundamento"];
  return source.map((title, i): PreviewModule => ({
    id: `preview-${i}`,
    title,
    banner_url: banner || undefined,
    lessonCount: 3,
    lessons: buildModuleLessons(title),
  }));
}

// Build a CSS gradient banner from a preset (used when there's no thumbnail)
function gradientFromPreset(preset: typeof COLOR_PRESETS[number]) {
  return `linear-gradient(135deg, rgb(${preset.from}) 0%, rgb(${preset.to}) 100%)`;
}

function ThumbnailUpload({
  value,
  onChange,
  presetId,
  onPresetChange,
}: {
  value: string;
  onChange: (v: string) => void;
  presetId: string;
  onPresetChange: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const activePreset = COLOR_PRESETS.find((p) => p.id === presetId) ?? COLOR_PRESETS[0];

  const handleFile = async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Use PNG, JPG, WEBP ou GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Máximo 5MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `content/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Capa aplicada");
    } catch {
      toast.error("Erro no upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Visual stage */}
      <div
        onClick={() => !value && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-border transition-all duration-200",
          value ? "aspect-video" : "flex aspect-video flex-col items-center justify-center cursor-pointer hover:border-primary/40"
        )}
        style={!value ? { background: gradientFromPreset(activePreset) } : undefined}
      >
        {value ? (
          <>
            <img src={value} alt="Capa do curso" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[11px] font-bold text-foreground hover:border-primary/40"
              >
                <Upload className="h-3 w-3" /> Trocar
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(""); }}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-destructive hover:border-destructive/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Decorative pattern */}
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.18), transparent 45%)"
            }} />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/15 text-white backdrop-blur-sm">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </div>
            <p className="relative mt-3 text-base font-bold text-white drop-shadow">Arraste sua capa aqui</p>
            <p className="relative mt-1 text-xs text-white/80">ou clique para escolher · PNG, JPG, WEBP · 16:9</p>
            <div className="relative mt-4 flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white border border-white/20">
              <Palette className="h-3 w-3" /> Usando paleta {activePreset.name}
            </div>
          </>
        )}
      </div>

      {/* Color preset row */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-1.5">
            <Palette className="h-3 w-3" /> Paleta de fundo {!value && <span className="text-primary">(ativa no preview)</span>}
          </Label>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPresetChange(p.id)}
              className={cn(
                "group/swatch relative aspect-square rounded-xl border-2 transition-all overflow-hidden",
                presetId === p.id ? "border-foreground scale-105" : "border-border hover:border-foreground/40"
              )}
              style={{ background: gradientFromPreset(p) }}
              title={p.name}
            >
              {presetId === p.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

export default function CourseCreationWizard({ open, onOpenChange, products, editCourse, onSaved }: WizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [newModuleName, setNewModuleName] = useState("");
  const [wizardModules, setWizardModules] = useState<string[]>([]);
  const [colorPreset, setColorPreset] = useState<string>("emerald");
  const [activeStep, setActiveStep] = useState<StepId>(editCourse ? "identity" : "template");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "geral",
    product_id: "",
    thumbnail_url: "",
  });

  useEffect(() => {
    if (!open) return;
    setViewMode("desktop");
    setNewModuleName("");
    setColorPreset("emerald");
    setSelectedTemplate(null);
    setActiveStep(editCourse ? "identity" : "template");
    setForm({
      title: editCourse?.title || "",
      description: editCourse?.description || "",
      category: editCourse?.category || "geral",
      product_id: editCourse?.product_id || "",
      thumbnail_url: editCourse?.thumbnail_url || "",
    });
    setWizardModules(editCourse?.modules?.map((m) => m.title) ?? []);
  }, [open, editCourse]);

  const linkedProduct = products.find((p) => p.id === form.product_id) ?? null;
  const activePreset = COLOR_PRESETS.find((p) => p.id === colorPreset) ?? COLOR_PRESETS[0];

  const previewModules = useMemo(() => {
    if (editCourse?.modules?.length) {
      return editCourse.modules.map((m, i): PreviewModule => ({
        id: m.id ?? `mod-${i}`,
        title: m.title,
        banner_url: m.banner_url ?? form.thumbnail_url,
        lessonCount: m.lessonsCount ?? 3,
        lessons: buildModuleLessons(m.title, Math.max(m.lessonsCount ?? 3, 1)),
      }));
    }
    return buildPreviewModules(wizardModules, form.thumbnail_url, form.title || "Curso");
  }, [editCourse?.modules, form.thumbnail_url, form.title, wizardModules]);

  // Live stats — evolves as user fills the wizard
  const stats = useMemo(() => {
    const moduleCount = editCourse?.modules?.length ?? wizardModules.length;
    const totalLessons = previewModules.reduce((acc, m) => acc + (m.lessons?.length ?? 0), 0);
    const totalMinutes = previewModules.reduce(
      (acc, m) => acc + (m.lessons?.reduce((a, l) => a + (l.duration_minutes ?? 0), 0) ?? 0),
      0
    );
    return {
      modules: moduleCount,
      lessons: totalLessons,
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  }, [previewModules, wizardModules, editCourse?.modules]);

  const addModule = (title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setWizardModules((cur) => {
      if (cur.some((m) => m.toLowerCase() === clean.toLowerCase())) {
        toast.info("Esse módulo já existe");
        return cur;
      }
      return [...cur, clean];
    });
    setNewModuleName("");
  };

  const moveModule = (from: number, to: number) => {
    if (from === to) return;
    setWizardModules((cur) => {
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const applyTemplate = (template: typeof COURSE_TEMPLATES[number]) => {
    setSelectedTemplate(template.id);
    setWizardModules([...template.modules]);
    if (template.modules.length > 0) {
      toast.success(`Template "${template.name}" aplicado · ${template.modules.length} módulos`);
    }
    // Auto-advance to next step
    setTimeout(() => setActiveStep("identity"), 300);
  };

  const saveCourse = async () => {
    if (!user || !form.title.trim()) {
      toast.error("Adicione um nome para o curso");
      setActiveStep("identity");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || "geral",
        product_id: form.product_id || null,
        thumbnail_url: form.thumbnail_url || null,
        user_id: user.id,
        is_published: false,
      };

      if (editCourse) {
        const { user_id, is_published, ...updatePayload } = payload;
        const { error } = await supabase
          .from("courses")
          .update(updatePayload)
          .eq("id", editCourse.id)
          .eq("user_id", user.id);
        if (error) throw error;
        toast.success("Curso atualizado.");
        onOpenChange(false);
        onSaved();
        return;
      }

      const { data, error } = await supabase.from("courses").insert(payload).select().single();
      if (error || !data) throw error ?? new Error("Falha ao criar.");

      if (wizardModules.length > 0) {
        const { error: modErr } = await supabase.from("modules").insert(
          wizardModules.map((title, i) => ({ course_id: data.id, title, sort_order: i }))
        );
        if (modErr) throw modErr;
      }

      toast.success("🎉 Curso criado com sucesso!");
      onOpenChange(false);
      onSaved();
      navigate(`/vendas/conteudo/${data.id}/builder`);
    } catch {
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const previewTitle = form.title.trim() || "Sua área premium";

  // Per-step completion checks for inline validation chips
  const checks = useMemo(() => ({
    template: selectedTemplate !== null || (editCourse?.modules?.length ?? 0) > 0,
    identity: Boolean(form.title.trim()),
    visual: Boolean(form.thumbnail_url) || colorPreset !== "emerald",
    structure: (editCourse?.modules?.length ?? wizardModules.length) > 0,
  }), [selectedTemplate, form.title, form.thumbnail_url, colorPreset, wizardModules, editCourse?.modules]);

  const completion = useMemo(() => {
    const items = [
      Boolean(form.title.trim()),
      Boolean(form.description.trim()),
      Boolean(form.thumbnail_url) || colorPreset !== "emerald",
      Boolean(form.product_id),
      (editCourse?.modules?.length ?? wizardModules.length) > 0,
    ];
    const done = items.filter(Boolean).length;
    return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
  }, [form, wizardModules, editCourse?.modules, colorPreset]);

  const visibleSteps = editCourse ? STEPS.filter((s) => s.id !== "template") : STEPS;
  const stepIndex = visibleSteps.findIndex((s) => s.id === activeStep);
  const isLastStep = stepIndex === visibleSteps.length - 1;
  const isFirstStep = stepIndex === 0;

  const goNext = () => {
    if (isLastStep) {
      saveCourse();
      return;
    }
    setActiveStep(visibleSteps[stepIndex + 1].id);
  };

  const goPrev = () => {
    if (isFirstStep) return;
    setActiveStep(visibleSteps[stepIndex - 1].id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] max-h-[94vh] max-w-[1440px] flex-col gap-0 overflow-hidden rounded-[1.5rem] border border-border bg-card p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: gradientFromPreset(activePreset) }}
            >
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  {editCourse ? "Editar área de membros" : "Criar nova área de membros"}
                </h2>
                {completion.pct === 100 && (
                  <span className="hidden sm:flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success animate-fade-in">
                    <CheckCircle2 className="h-3 w-3" /> Pronto pra publicar
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                {previewTitle} · {stats.modules} módulos · {stats.lessons} aulas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Compact circular progress */}
            <div className="hidden md:flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-1.5">
              <div className="relative h-8 w-8">
                <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                  <circle
                    cx="16" cy="16" r="13" fill="none"
                    stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${(completion.pct / 100) * 81.68} 81.68`}
                    className="transition-all duration-500"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground tabular-nums">
                  {completion.pct}
                </span>
              </div>
              <div className="leading-tight">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Setup</p>
                <p className="text-[11px] font-bold text-foreground tabular-nums">{completion.done}/{completion.total}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Step tabs */}
        <div className="flex items-center gap-1 border-b border-border bg-card px-6 py-2 overflow-x-auto">
          {visibleSteps.map((step, i) => {
            const Icon = step.icon;
            const isActive = step.id === activeStep;
            const isComplete = checks[step.id as keyof typeof checks];
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all whitespace-nowrap",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md text-[10px]",
                  isActive ? "bg-primary text-primary-foreground" : isComplete ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                )}>
                  {isComplete && !isActive ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <Icon className="h-3.5 w-3.5" />
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body — left form, right preview */}
        <div className={cn(
          "grid min-h-0 flex-1",
          previewCollapsed ? "lg:grid-cols-1" : "lg:grid-cols-[480px_minmax(0,1fr)]"
        )}>
          {/* LEFT: Step content */}
          <div className="flex min-h-0 flex-col border-r border-border bg-background">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">

              {/* STEP: Template */}
              {activeStep === "template" && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Comece com um template</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Estruturas testadas em centenas de cursos. Você customiza tudo depois.</p>
                  </div>
                  <div className="space-y-2.5">
                    {COURSE_TEMPLATES.map((tpl) => {
                      const Icon = tpl.icon;
                      const isSelected = selectedTemplate === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          className={cn(
                            "group w-full rounded-xl border p-4 text-left transition-all duration-200",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary/40 hover:bg-card-inset"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all",
                              isSelected
                                ? "border-primary/30 bg-primary text-primary-foreground"
                                : "border-border bg-background text-foreground group-hover:border-primary/30"
                            )}>
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-foreground">{tpl.name}</p>
                                {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{tpl.description}</p>
                              {tpl.modules.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap gap-1">
                                  {tpl.modules.map((m) => (
                                    <span key={m} className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP: Identity */}
              {activeStep === "identity" && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Identidade do curso</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Como o aluno vai reconhecer e desejar a sua área.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-foreground">
                        <span>Nome do curso *</span>
                        <span className="text-[10px] font-medium normal-case tracking-normal text-muted-foreground tabular-nums">
                          {form.title.length}/60
                        </span>
                      </Label>
                      <Input
                        value={form.title}
                        onChange={(e) => setForm((c) => ({ ...c, title: e.target.value.slice(0, 60) }))}
                        placeholder="Ex: Escala de Vendas com Conteúdo"
                        className="h-12 rounded-xl border-border bg-background text-base font-bold focus-visible:border-primary"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Categoria</Label>
                        <Select value={form.category} onValueChange={(v) => setForm((c) => ({ ...c, category: v }))}>
                          <SelectTrigger className="h-11 rounded-xl border-border bg-background text-sm font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {COURSE_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                          <Package className="h-3 w-3" /> Produto
                        </Label>
                        <Select value={form.product_id || "none"} onValueChange={(v) => setForm((c) => ({ ...c, product_id: v === "none" ? "" : v }))}>
                          <SelectTrigger className="h-11 rounded-xl border-border bg-background text-sm font-semibold">
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem vínculo</SelectItem>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} — {formatCurrency(p.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        <span>Promessa / descrição</span>
                        <span className="text-[10px] font-medium normal-case tracking-normal tabular-nums">
                          {form.description.length}/280
                        </span>
                      </Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) => setForm((c) => ({ ...c, description: e.target.value.slice(0, 280) }))}
                        placeholder="Em uma frase, o que o aluno vai conquistar com esse curso?"
                        className="min-h-[110px] rounded-xl border-border bg-background text-sm font-medium resize-none"
                      />
                      {/* Quick suggestions */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          "Domine do zero ao avançado",
                          "Resultados em 30 dias",
                          "Método validado por +1000 alunos",
                        ].map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setForm((c) => ({ ...c, description: sug }))}
                            className="rounded-md border border-border bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP: Visual */}
              {activeStep === "visual" && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Capa & paleta</h3>
                    <p className="mt-1 text-xs text-muted-foreground">A primeira coisa que o aluno vê. Quanto mais marca, maior a percepção de valor.</p>
                  </div>
                  <ThumbnailUpload
                    value={form.thumbnail_url}
                    onChange={(v) => setForm((c) => ({ ...c, thumbnail_url: v }))}
                    presetId={colorPreset}
                    onPresetChange={setColorPreset}
                  />
                </div>
              )}

              {/* STEP: Structure */}
              {activeStep === "structure" && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Estrutura de módulos</h3>
                      <p className="mt-1 text-xs text-muted-foreground">A trilha que o aluno vai percorrer. Arraste pra reordenar.</p>
                    </div>
                    {wizardModules.length > 0 && (
                      <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary tabular-nums">
                        {wizardModules.length} módulos
                      </span>
                    )}
                  </div>

                  {editCourse ? (
                    <div className="space-y-2">
                      {(editCourse.modules ?? []).length > 0 ? (
                        (editCourse.modules ?? []).map((m, i) => (
                          <div key={`${m.title}-${i}`} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-xs font-bold text-primary tabular-nums">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-foreground">{m.title}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{m.lessonsCount ?? 0} aulas</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-border bg-card-inset px-4 py-6 text-center">
                          <Layers className="mx-auto h-6 w-6 text-muted-foreground/60" />
                          <p className="mt-2 text-xs font-semibold text-muted-foreground">Nenhum módulo ainda</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">Crie no studio após salvar.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Quick add input */}
                      <div className="flex gap-2">
                        <Input
                          value={newModuleName}
                          onChange={(e) => setNewModuleName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addModule(newModuleName); }}
                          placeholder="Digite o nome do módulo..."
                          className="h-11 flex-1 rounded-xl border-border bg-background text-sm font-semibold"
                        />
                        <Button
                          onClick={() => addModule(newModuleName)}
                          disabled={!newModuleName.trim()}
                          className="h-11 rounded-xl px-4 font-bold"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>

                      {/* Quick suggestions */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">Sugestões rápidas</p>
                        <div className="grid grid-cols-2 gap-2">
                          {STARTER_MODULES.map((item) => {
                            const Icon = item.icon;
                            const already = wizardModules.some((m) => m.toLowerCase() === item.title.toLowerCase());
                            return (
                              <button
                                key={item.title}
                                type="button"
                                disabled={already}
                                onClick={() => addModule(item.title)}
                                className={cn(
                                  "group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                                  already
                                    ? "border-success/30 bg-success/5 cursor-not-allowed opacity-60"
                                    : "border-border bg-card hover:border-primary/40 hover:bg-card-inset"
                                )}
                              >
                                <div className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                  already ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
                                )}>
                                  {already ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Icon className="h-3.5 w-3.5" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-foreground truncate">{item.title}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Active modules — draggable */}
                      {wizardModules.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Sua trilha</p>
                            <button
                              type="button"
                              onClick={() => setWizardModules([])}
                              className="text-[10px] font-semibold text-muted-foreground hover:text-destructive transition-colors"
                            >
                              Limpar tudo
                            </button>
                          </div>
                          {wizardModules.map((m, i) => (
                            <div
                              key={m}
                              draggable
                              onDragStart={() => setDraggedIdx(i)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedIdx !== null) moveModule(draggedIdx, i);
                                setDraggedIdx(null);
                              }}
                              onDragEnd={() => setDraggedIdx(null)}
                              className={cn(
                                "group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all cursor-move",
                                draggedIdx === i
                                  ? "border-primary bg-primary/10 opacity-50"
                                  : "border-border bg-card hover:border-primary/30"
                              )}
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary tabular-nums">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span className="flex-1 truncate text-sm font-bold text-foreground">{m}</span>
                              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">3 aulas</span>
                              <button
                                type="button"
                                onClick={() => setWizardModules((cur) => cur.filter((x) => x !== m))}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {wizardModules.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border bg-card-inset px-4 py-8 text-center">
                          <Layers className="mx-auto h-7 w-7 text-muted-foreground/40" />
                          <p className="mt-2 text-xs font-bold text-foreground">Nenhum módulo adicionado</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Use as sugestões ou digite o seu acima.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer with step navigation */}
            <div className="border-t border-border bg-card px-6 py-3">
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={goPrev}
                  disabled={isFirstStep}
                  className="h-10 rounded-xl px-3 font-semibold"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Voltar
                </Button>

                <div className="flex items-center gap-1">
                  {visibleSteps.map((s) => (
                    <span
                      key={s.id}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        s.id === activeStep ? "w-6 bg-primary" : checks[s.id as keyof typeof checks] ? "w-1.5 bg-success" : "w-1.5 bg-border"
                      )}
                    />
                  ))}
                </div>

                <Button
                  onClick={goNext}
                  disabled={saving || (isLastStep && !form.title.trim())}
                  className="h-10 rounded-xl px-4 font-bold"
                  style={isLastStep ? { background: gradientFromPreset(activePreset) } : undefined}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : isLastStep ? <Rocket className="h-3.5 w-3.5 mr-1.5" /> : null}
                  {isLastStep ? (editCourse ? "Salvar alterações" : "Criar curso") : "Próximo"}
                  {!isLastStep && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT: Preview */}
          {!previewCollapsed && (
            <div className="hidden lg:flex min-h-0 flex-col bg-card-inset">
              {/* Toolbar */}
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card-inset/95 backdrop-blur-md px-6 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Live
                  </span>
                  {/* Live stats */}
                  <div className="hidden xl:flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 rounded-md bg-card px-2 py-1 border border-border">
                      <Layers className="h-3 w-3" />
                      <span className="font-bold tabular-nums text-foreground">{stats.modules}</span> módulos
                    </span>
                    <span className="flex items-center gap-1 rounded-md bg-card px-2 py-1 border border-border">
                      <BookOpen className="h-3 w-3" />
                      <span className="font-bold tabular-nums text-foreground">{stats.lessons}</span> aulas
                    </span>
                    <span className="flex items-center gap-1 rounded-md bg-card px-2 py-1 border border-border">
                      <Clock className="h-3 w-3" />
                      <span className="font-bold tabular-nums text-foreground">{stats.hours}h{stats.minutes > 0 && `${stats.minutes}m`}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
                    {([
                      { id: "desktop" as const, icon: Monitor },
                      { id: "mobile" as const, icon: Smartphone },
                    ]).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setViewMode(item.id)}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md text-xs transition-all",
                          viewMode === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewCollapsed(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                    title="Esconder preview"
                  >
                    <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                </div>
              </div>

              {/* Preview canvas */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div
                  className="relative overflow-hidden rounded-2xl border border-border bg-background p-5 sm:p-6"
                  style={{
                    backgroundImage: `radial-gradient(circle at 30% 0%, rgb(${activePreset.from} / 0.08), transparent 55%), radial-gradient(circle at 80% 100%, rgb(${activePreset.to} / 0.06), transparent 60%)`,
                  }}
                >
                  <MemberExperiencePreview
                    className="mx-auto"
                    course={{
                      title: previewTitle,
                      description: form.description,
                      category: form.category,
                      thumbnail_url: form.thumbnail_url || `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='rgb(${activePreset.from})'/><stop offset='100%' stop-color='rgb(${activePreset.to})'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g)'/></svg>`)}`,
                      productName: linkedProduct?.name,
                      is_published: false,
                    }}
                    modules={previewModules}
                    viewMode={viewMode}
                  />
                </div>
              </div>
            </div>
          )}

          {previewCollapsed && (
            <div className="hidden lg:flex absolute right-4 top-24 z-20">
              <button
                type="button"
                onClick={() => setPreviewCollapsed(false)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:border-primary/40 transition-colors shadow-sm"
              >
                <Monitor className="h-3.5 w-3.5" /> Mostrar preview
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
