import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 BookOpen,
 Check,
 CheckCircle2,
 ChevronLeft,
 ChevronRight,
 Eye,
 GraduationCap,
 Image as ImageIcon,
 Layers,
 Loader2,
 Monitor,
 Palette,
 Plus,
 Smartphone,
 Sparkles,
 Star,
 Trash2,
 Type,
 Upload,
 Users,
 X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

const ease = [0.16, 1, 0.3, 1] as const;

type StepId = "identity" | "experience" | "curriculum" | "launch";

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

const STEP_CONFIG: { id: StepId; label: string; caption: string; icon: typeof Type }[] = [
 { id: "identity", label: "Identidade", caption: "Nome, categoria e vínculo", icon: Type },
 { id: "experience", label: "Hero", caption: "Banner e promessa", icon: Palette },
 { id: "curriculum", label: "Trilhos", caption: "Módulos que aparecem no catálogo", icon: Layers },
 { id: "launch", label: "Launch", caption: "Resumo e próximo passo", icon: Eye },
];

const MODULE_SUGGESTIONS = [
 "Boas-vindas",
 "Fundamentos",
 "Implementação",
 "Escala",
 "Bônus",
];

const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function buildModuleLessons(title: string, count = 3) {
 const cleanTitle = title.trim() || "Módulo";
 const templates = [
 `Introdução a ${cleanTitle}`,
 `${cleanTitle} na prática`,
 `Checklist final de ${cleanTitle}`,
 ];

 return Array.from({ length: Math.max(count, 1) }, (_, index) => ({
 id: `${cleanTitle}-${index}`.toLowerCase().replace(/\s+/g, "-"),
 title: templates[index] ?? `${cleanTitle} • Aula ${index + 1}`,
 video_url: index === 0 ? "configured" : null,
 duration_minutes: 8 + index * 3,
 is_free: index === 0,
 completed: index === 0,
 }));
}

function buildPreviewModules(titles: string[], banner: string, seed = "Curso") {
 const source = titles.length > 0 ? titles : ["Boas-vindas", `${seed} na prática`, "Aprofundamento", "Bônus"];

 return source.map((title, index): PreviewModule => ({
 id: `preview-module-${index}`,
 title,
 banner_url: banner || undefined,
 lessonCount: 3,
 lessons: buildModuleLessons(title),
 }));
}

function ImageUploadField({
 label,
 hint,
 value,
 onChange,
}: {
 label: string;
 hint: string;
 value: string;
 onChange: (value: string) => void;
}) {
 const inputRef = useRef<HTMLInputElement>(null);
 const [uploading, setUploading] = useState(false);

 const handleFile = async (file: File) => {
 const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
 if (!allowed.includes(file.type)) {
 toast.error("Use PNG, JPG, WEBP ou GIF.");
 return;
 }
 if (file.size > 5 * 1024 * 1024) {
 toast.error("A imagem pode ter no máximo 5MB.");
 return;
 }

 setUploading(true);
 try {
 const extension = file.name.split(".").pop();
 const path = `content/${crypto.randomUUID()}.${extension}`;
 const { error } = await supabase.storage.from("product-images").upload(path, file);
 if (error) throw error;
 const { data } = supabase.storage.from("product-images").getPublicUrl(path);
 onChange(data.publicUrl);
 toast.success("Banner enviado.");
 } catch {
 toast.error("Não foi possível enviar a imagem.");
 } finally {
 setUploading(false);
 }
 };

 return (
 <div className="space-y-2.5">
 <div>
 <Label className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-foreground/55">{label}</Label>
 <p className="mt-1 text-[11px] font-display text-muted-foreground/40">{hint}</p>
 </div>

 <div
 onClick={() => inputRef.current?.click()}
 onDragOver={(event) => event.preventDefault()}
 onDrop={(event) => {
 event.preventDefault();
 const file = event.dataTransfer.files[0];
 if (file) handleFile(file);
 }}
 className={cn(
 "group relative overflow-hidden rounded-[1.75rem] border-2 border-dashed transition-all duration-500",
 value ? "border-border/15 bg-card/60" : "border-border/20 bg-muted/[0.03] hover:border-primary/25 hover:bg-primary/[0.03]",
 )}
 >
 {value ? (
 <div className="relative aspect-[16/9]">
 <img src={value} alt="Banner do curso" className="h-full w-full object-cover" />
 <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/30 to-transparent" />
 <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
 <div>
 <p className="text-xs font-display font-black text-foreground">Banner principal pronto</p>
 <p className="mt-1 text-[10px] font-display text-muted-foreground/40">Esse visual já alimenta o hero do preview.</p>
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={(event) => {
 event.stopPropagation();
 inputRef.current?.click();
 }}
 className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/15 bg-card/80 text-foreground/70 transition-colors hover:bg-card"
 >
 <ImageIcon className="h-4 w-4" />
 </button>
 <button
 type="button"
 onClick={(event) => {
 event.stopPropagation();
 onChange("");
 }}
 className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/15 bg-card/80 text-destructive transition-colors hover:bg-card"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 </div>
 </div>
 ) : (
 <div className="flex aspect-[16/9] flex-col items-center justify-center px-6 text-center">
 <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 ring-1 ring-primary/15">
 {uploading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <Upload className="h-7 w-7 text-primary" />}
 </div>
 <p className="text-sm font-display font-black text-foreground/75">Suba o banner principal da área de membros</p>
 <p className="mt-1.5 text-xs font-display text-muted-foreground/40">Arraste uma imagem 16:9 ou clique para buscar no seu computador.</p>
 </div>
 )}
 </div>

 <input
 ref={inputRef}
 type="file"
 accept="image/jpeg,image/png,image/webp,image/gif"
 className="hidden"
 onChange={(event) => {
 const file = event.target.files?.[0];
 if (file) handleFile(file);
 }}
 />
 </div>
 );
}

export default function CourseCreationWizard({
 open,
 onOpenChange,
 products,
 editCourse,
 onSaved,
}: WizardProps) {
 const { user } = useAuth();
 const navigate = useNavigate();
 const [step, setStep] = useState<StepId>("identity");
 const [saving, setSaving] = useState(false);
 const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
 const [newModuleName, setNewModuleName] = useState("");
 const [wizardModules, setWizardModules] = useState<string[]>([]);
 const [form, setForm] = useState({
 title: editCourse?.title || "",
 description: editCourse?.description || "",
 category: editCourse?.category || "geral",
 product_id: editCourse?.product_id || "",
 thumbnail_url: editCourse?.thumbnail_url || "",
 });

 const stepIndex = STEP_CONFIG.findIndex((item) => item.id === step);
 const linkedProduct = products.find((product) => product.id === form.product_id) ?? null;

 useEffect(() => {
 if (!open) return;
 setStep("identity");
 setViewMode("desktop");
 setNewModuleName("");
 setForm({
 title: editCourse?.title || "",
 description: editCourse?.description || "",
 category: editCourse?.category || "geral",
 product_id: editCourse?.product_id || "",
 thumbnail_url: editCourse?.thumbnail_url || "",
 });
 setWizardModules(editCourse?.modules?.map((module) => module.title) ?? []);
 }, [open, editCourse]);

 const previewModules = useMemo(() => {
 const sourceModules = editCourse?.modules?.length
 ? editCourse.modules.map((module, index): PreviewModule => ({
 id: module.id ?? `existing-module-${index}`,
 title: module.title,
 banner_url: module.banner_url ?? form.thumbnail_url,
 lessonCount: module.lessonsCount ?? 3,
 lessons: buildModuleLessons(module.title, Math.max(module.lessonsCount ?? 3, 1)),
 }))
 : buildPreviewModules(wizardModules, form.thumbnail_url, form.title || "Curso");

 return sourceModules;
 }, [editCourse?.modules, form.thumbnail_url, form.title, wizardModules]);

 const checklist = [
 { label: "Nome forte", done: form.title.trim().length > 0 },
 { label: "Hero", done: Boolean(form.thumbnail_url) },
 { label: "Promessa", done: form.description.trim().length > 0 },
 { label: "Trilha", done: (editCourse?.modules?.length ?? wizardModules.length) > 0 },
 ];
 const completionPct = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);

 const canContinue = step !== "identity" || form.title.trim().length > 0;

 const addModule = (title: string) => {
 const cleanTitle = title.trim();
 if (!cleanTitle) return;
 setWizardModules((current) => (current.includes(cleanTitle) ? current : [...current, cleanTitle]));
 setNewModuleName("");
 };

 const removeModule = (title: string) => {
 setWizardModules((current) => current.filter((item) => item !== title));
 };

 const saveCourse = async () => {
 if (!user || !form.title.trim()) return;

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
 if (error || !data) throw error ?? new Error("Falha ao criar o curso.");

 if (wizardModules.length > 0) {
 const { error: modulesError } = await supabase.from("modules").insert(
 wizardModules.map((title, index) => ({
 course_id: data.id,
 title,
 sort_order: index,
 })),
 );
 if (modulesError) throw modulesError;
 }

 toast.success("Curso criado. Abrindo o studio...");
 onOpenChange(false);
 onSaved();
 navigate(`/vendas/conteudo/${data.id}/builder`);
 } catch {
 toast.error("Não foi possível salvar o curso.");
 } finally {
 setSaving(false);
 }
 };

 const nextStep = () => {
 if (!canContinue) return;
 const next = STEP_CONFIG[stepIndex + 1];
 if (next) setStep(next.id);
 };

 const previousStep = () => {
 const previous = STEP_CONFIG[stepIndex - 1];
 if (previous) setStep(previous.id);
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-h-[94vh] max-w-[1280px] overflow-hidden rounded-[2rem] border-border/20 bg-card/95 p-0 backdrop-blur-2xl">
 <div className="relative overflow-hidden border-b border-border/10 px-6 pb-5 pt-6">
 <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.05] via-transparent to-info/[0.03]" />
 <div className="relative flex flex-col gap-5">
 <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
 <div className="flex items-start gap-3.5">
 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
 {editCourse ? <BookOpen className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
 </div>
 <div>
 <p className="text-[11px] font-display font-bold uppercase tracking-[0.18em] text-primary/60">Member Area Studio</p>
 <h2 className="mt-1 text-2xl font-display font-black tracking-[-0.03em] text-foreground">
 {editCourse ? "Refinar experiência do curso" : "Montar uma área de membros que prende"}
 </h2>
 <p className="mt-1.5 max-w-2xl text-sm font-display text-muted-foreground/45">
 Agora o seller enxerga logo, hero, trilhos e a visão do aluno enquanto configura tudo — sem ficar imaginando como vai ficar.
 </p>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
 {checklist.map((item) => (
 <div key={item.label} className="rounded-2xl border border-border/10 bg-card/70 px-3 py-2.5">
 <div className="flex items-center gap-2">
 <div className={cn(
 "flex h-7 w-7 items-center justify-center rounded-xl",
 item.done ? "bg-success/10 text-success" : "bg-muted/20 text-muted-foreground/35",
 )}>
 {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
 </div>
 <div>
 <p className="text-[9px] font-display font-bold uppercase tracking-[0.14em] text-muted-foreground/35">Setup</p>
 <p className="text-xs font-display font-black text-foreground/75">{item.label}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 {STEP_CONFIG.map((item, index) => {
 const Icon = item.icon;
 const active = item.id === step;
 const done = index < stepIndex;

 return (
 <button
 key={item.id}
 type="button"
 onClick={() => {
 if (done || active) setStep(item.id);
 }}
 className={cn(
 "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-all",
 active
 ? "border-primary/20 bg-primary/10 text-primary"
 : done
 ? "border-success/15 bg-success/10 text-success"
 : "border-border/10 bg-card/60 text-muted-foreground/45",
 )}
 >
 <div className={cn(
 "flex h-8 w-8 items-center justify-center rounded-xl",
 active ? "bg-primary text-primary-foreground" : done ? "bg-success text-success-foreground" : "bg-muted/20",
 )}>
 {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
 </div>
 <div>
 <p className="text-xs font-display font-black tracking-[-0.02em]">{item.label}</p>
 <p className="text-[10px] font-display opacity-80">{item.caption}</p>
 </div>
 </button>
 );
 })}

 <div className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-border/10 bg-card/60 px-3 py-2.5">
 <div className="h-2 w-24 overflow-hidden rounded-full bg-muted/20">
 <motion.div
 className="h-full rounded-full bg-primary"
 animate={{ width: `${completionPct}%` }}
 transition={{ duration: 0.35, ease }}
 />
 </div>
 <span className="text-xs font-display font-black text-primary">{completionPct}%</span>
 </div>
 </div>
 </div>
 </div>

 <div className="grid max-h-[calc(94vh-190px)] min-h-[620px] lg:grid-cols-[minmax(0,1fr)_380px]">
 <div className="overflow-y-auto px-6 py-6">
 <AnimatePresence mode="wait">
 <motion.div
 key={step}
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -16 }}
 transition={{ duration: 0.25, ease }}
 className="space-y-5"
 >
 {step === "identity" && (
 <>
 <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
 <div className="rounded-[1.75rem] border border-border/10 bg-card/70 p-5">
 <div className="mb-5 flex items-start gap-3">
 <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
 <Type className="h-4.5 w-4.5" />
 </div>
 <div>
 <p className="text-sm font-display font-black text-foreground/80">Base da identidade</p>
 <p className="mt-1 text-xs font-display text-muted-foreground/45">Defina como o aluno reconhece o curso na home, no hero e no catálogo.</p>
 </div>
 </div>

 <div className="space-y-4">
 <div>
 <Label className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-foreground/55">Nome do curso</Label>
 <Input
 value={form.title}
 onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
 placeholder="Ex: Escala de Vendas com Conteúdo"
 className="mt-2 h-12 rounded-2xl font-display text-base"
 autoFocus
 />
 </div>

 <div className="grid gap-4 md:grid-cols-2">
 <div>
 <Label className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-foreground/55">Categoria</Label>
 <Input
 value={form.category}
 onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
 placeholder="Marketing, gestão, saúde..."
 className="mt-2 h-11 rounded-2xl font-display"
 />
 </div>
 <div>
 <Label className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-foreground/55">Produto vinculado</Label>
 <Select
 value={form.product_id || "none"}
 onValueChange={(value) => setForm((current) => ({ ...current, product_id: value === "none" ? "" : value }))}
 >
 <SelectTrigger className="mt-2 h-11 rounded-2xl font-display">
 <SelectValue placeholder="Nenhum" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Nenhum</SelectItem>
 {products.map((product) => (
 <SelectItem key={product.id} value={product.id}>
 {product.name} — {formatCurrency(product.price)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>
 </div>

 <div className="rounded-[1.75rem] border border-border/10 bg-card/70 p-5">
 <div className="mb-4 flex items-start gap-3">
 <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-info/10 text-info ring-1 ring-info/15">
 <GraduationCap className="h-4.5 w-4.5" />
 </div>
 <div>
 <p className="text-sm font-display font-black text-foreground/80">Workspace pronto para vender</p>
 <p className="mt-1 text-xs font-display text-muted-foreground/45">Seu setup gera automaticamente um logo com iniciais, hero principal e trilhos com leitura clara.</p>
 </div>
 </div>

 <div className="space-y-3">
 {[
 { icon: Sparkles, label: "Logo automático", description: "Monograma gerado do título para dar cara de marca já no preview." },
 { icon: Users, label: "Leitura rápida", description: "Nome, categoria e produto entram nos pontos mais nobres da experiência." },
 { icon: BookOpen, label: "Entrada premium", description: "O aluno já vê promessa, CTA e catálogo sem sensação de sistema cru." },
 ].map((item) => (
 <div key={item.label} className="rounded-2xl border border-border/10 bg-background/70 p-3">
 <div className="flex items-start gap-3">
 <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
 <item.icon className="h-4 w-4" />
 </div>
 <div>
 <p className="text-xs font-display font-black text-foreground/80">{item.label}</p>
 <p className="mt-1 text-[11px] font-display text-muted-foreground/40">{item.description}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </>
 )}

 {step === "experience" && (
 <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
 <div className="rounded-[1.75rem] border border-border/10 bg-card/70 p-5">
 <div className="mb-5 flex items-start gap-3">
 <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
 <Palette className="h-4.5 w-4.5" />
 </div>
 <div>
 <p className="text-sm font-display font-black text-foreground/80">Hero que segura a atenção</p>
 <p className="mt-1 text-xs font-display text-muted-foreground/45">Descrição e banner alimentam o billboard do aluno, o card principal e os trilhos internos.</p>
 </div>
 </div>

 <div className="space-y-4">
 <div>
 <Label className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-foreground/55">Promessa do curso</Label>
 <Textarea
 value={form.description}
 onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
 placeholder="O que o aluno domina depois de entrar aqui?"
 className="mt-2 min-h-[180px] rounded-[1.5rem] font-display"
 />
 </div>
 </div>
 </div>

 <div className="rounded-[1.75rem] border border-border/10 bg-card/70 p-5">
 <ImageUploadField
 label="Banner principal"
 hint="Use uma capa 16:9 forte — ela aparece como vitrine, hero e fundo dos cartões mais importantes."
 value={form.thumbnail_url}
 onChange={(value) => setForm((current) => ({ ...current, thumbnail_url: value }))}
 />
 </div>
 </div>
 )}

 {step === "curriculum" && (
 <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
 <div className="rounded-[1.75rem] border border-border/10 bg-card/70 p-5">
 <div className="mb-5 flex items-start gap-3">
 <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
 <Layers className="h-4.5 w-4.5" />
 </div>
 <div>
 <p className="text-sm font-display font-black text-foreground/80">Trilhos que guiam o aluno</p>
 <p className="mt-1 text-xs font-display text-muted-foreground/45">Organize os módulos na ordem em que eles devem aparecer no catálogo e na experiência de consumo.</p>
 </div>
 </div>

 {editCourse ? (
 <div className="space-y-3">
 {(editCourse.modules ?? []).length > 0 ? (
 (editCourse.modules ?? []).map((module, index) => (
 <div key={`${module.title}-${index}`} className="flex items-center gap-3 rounded-2xl border border-border/10 bg-background/70 p-3.5">
 <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 font-display font-black text-primary">{index + 1}</div>
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-display font-black text-foreground/80">{module.title}</p>
 <p className="mt-1 text-[11px] font-display text-muted-foreground/40">{module.lessonsCount ?? 0} aula{(module.lessonsCount ?? 0) !== 1 ? "s" : ""} configuradas</p>
 </div>
 <span className="rounded-full bg-info/10 px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-info">Studio</span>
 </div>
 ))
 ) : (
 <div className="rounded-2xl border border-dashed border-border/15 bg-background/70 p-5 text-center">
 <Layers className="mx-auto h-8 w-8 text-primary/25" />
 <p className="mt-2 text-sm font-display font-black text-foreground/70">Esse curso ainda não tem módulos</p>
 <p className="mt-1 text-xs font-display text-muted-foreground/40">Salve e entre no studio para começar sua estrutura.</p>
 </div>
 )}

 <div className="rounded-2xl border border-info/10 bg-info/5 p-4">
 <p className="text-xs font-display font-black text-foreground/75">Modo edição</p>
 <p className="mt-1 text-[11px] font-display text-muted-foreground/45">Na edição, o wizard mostra a leitura visual do catálogo e o studio completo continua sendo o lugar de arrastar, criar aulas e ajustar conteúdo fino.</p>
 </div>
 </div>
 ) : (
 <>
 <div className="flex gap-2">
 <Input
 value={newModuleName}
 onChange={(event) => setNewModuleName(event.target.value)}
 onKeyDown={(event) => {
 if (event.key === "Enter") addModule(newModuleName);
 }}
 placeholder="Ex: Método principal, onboarding, entrega..."
 className="h-12 rounded-2xl font-display"
 />
 <Button onClick={() => addModule(newModuleName)} className="h-12 rounded-2xl px-5 font-display font-bold">
 <Plus className="mr-2 h-4 w-4" /> Adicionar
 </Button>
 </div>

 <div className="flex flex-wrap gap-2 pt-1">
 {MODULE_SUGGESTIONS.map((suggestion) => (
 <button
 key={suggestion}
 type="button"
 onClick={() => addModule(suggestion)}
 className="rounded-full border border-border/10 bg-background/70 px-3 py-2 text-[11px] font-display font-bold text-foreground/70 transition-all hover:border-primary/20 hover:bg-primary/10 hover:text-primary"
 >
 + {suggestion}
 </button>
 ))}
 </div>

 <div className="space-y-2 pt-2">
 {wizardModules.length > 0 ? (
 wizardModules.map((module, index) => (
 <div key={module} className="flex items-center gap-3 rounded-2xl border border-border/10 bg-background/70 p-3.5">
 <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 font-display font-black text-primary">{index + 1}</div>
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-display font-black text-foreground/80">{module}</p>
 <p className="mt-1 text-[11px] font-display text-muted-foreground/40">Esse bloco já entra como rail no preview lateral.</p>
 </div>
 <button
 type="button"
 onClick={() => removeModule(module)}
 className="flex h-9 w-9 items-center justify-center rounded-xl text-destructive transition-colors hover:bg-destructive/10"
 >
 <Trash2 className="h-4 w-4" />
 </button>
 </div>
 ))
 ) : (
 <div className="rounded-2xl border border-dashed border-border/15 bg-background/70 p-6 text-center">
 <Layers className="mx-auto h-8 w-8 text-primary/25" />
 <p className="mt-2 text-sm font-display font-black text-foreground/70">Nenhum rail criado ainda</p>
 <p className="mt-1 text-xs font-display text-muted-foreground/40">Adicione de 3 a 5 módulos para o catálogo nascer com cara de produto premium.</p>
 </div>
 )}
 </div>
 </>
 )}
 </div>

 <div className="rounded-[1.75rem] border border-border/10 bg-card/70 p-5">
 <div className="mb-4 flex items-start gap-3">
 <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/10 text-warning ring-1 ring-warning/15">
 <BookOpen className="h-4.5 w-4.5" />
 </div>
 <div>
 <p className="text-sm font-display font-black text-foreground/80">Como isso aparece</p>
 <p className="mt-1 text-xs font-display text-muted-foreground/45">O aluno não vê “módulos soltos”: ele vê trilhos, fila e conteúdo organizado para continuar fácil.</p>
 </div>
 </div>

 <div className="space-y-3">
 {previewModules.slice(0, 4).map((module, index) => (
 <div key={module.id} className="rounded-2xl border border-border/10 bg-background/70 p-3">
 <div className="flex items-center gap-3">
 <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-warning/10 font-display font-black text-warning">{index + 1}</div>
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-display font-black text-foreground/80">{module.title}</p>
 <p className="mt-1 text-[11px] font-display text-muted-foreground/40">{module.lessonCount ?? module.lessons?.length ?? 0} aulas no rail</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {step === "launch" && (
 <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
 <div className="rounded-[1.75rem] border border-border/10 bg-card/70 p-5">
 <div className="mb-5 flex items-start gap-3">
 <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10 text-success ring-1 ring-success/15">
 <CheckCircle2 className="h-4.5 w-4.5" />
 </div>
 <div>
 <p className="text-sm font-display font-black text-foreground/80">Resumo final do launch</p>
 <p className="mt-1 text-xs font-display text-muted-foreground/45">Confira a leitura do seller e o impacto direto na experiência do aluno antes de seguir.</p>
 </div>
 </div>

 <div className="rounded-[1.75rem] border border-border/10 bg-background/70 p-4">
 <div className="flex items-start gap-4">
 <div className="h-24 w-40 overflow-hidden rounded-2xl border border-border/10 bg-card/70">
 {form.thumbnail_url ? (
 <img src={form.thumbnail_url} alt={form.title || "Banner do curso"} className="h-full w-full object-cover" />
 ) : (
 <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-card to-card">
 <GraduationCap className="h-8 w-8 text-primary/20" />
 </div>
 )}
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-lg font-display font-black tracking-[-0.03em] text-foreground">{form.title || "Curso sem nome"}</p>
 <p className="mt-1 line-clamp-2 text-sm font-display text-muted-foreground/45">{form.description || "Inclua uma promessa clara para aumentar retenção e valor percebido."}</p>
 <div className="mt-3 flex flex-wrap gap-2">
 <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-primary">{form.category || "geral"}</span>
 {linkedProduct ? <span className="rounded-full bg-info/10 px-3 py-1 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-info">{linkedProduct.name}</span> : null}
 <span className="rounded-full bg-warning/10 px-3 py-1 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-warning">{previewModules.length} trilho{previewModules.length !== 1 ? "s" : ""}</span>
 </div>
 </div>
 </div>
 </div>

 <div className="mt-4 grid gap-3 md:grid-cols-2">
 {[
 "Logo e hero já aparecem no preview do lado.",
 editCourse ? "Depois de salvar, continue refinando conteúdo e ordem direto no studio." : "Depois de criar, você cai direto no studio para montar aulas e materiais.",
 "O catálogo já nasce com rails e CTA de continuidade.",
 "A experiência mobile também já está simulada no toggle lateral.",
 ].map((item) => (
 <div key={item} className="rounded-2xl border border-border/10 bg-background/70 px-4 py-3 text-sm font-display text-foreground/75">
 <div className="flex items-start gap-2.5">
 <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
 <span>{item}</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className="rounded-[1.75rem] border border-border/10 bg-card/70 p-5">
 <div className="mb-4 flex items-start gap-3">
 <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
 <Sparkles className="h-4.5 w-4.5" />
 </div>
 <div>
 <p className="text-sm font-display font-black text-foreground/80">Próximo clique</p>
 <p className="mt-1 text-xs font-display text-muted-foreground/45">Você sai desse setup direto para o fluxo onde reordena, grava e publica.</p>
 </div>
 </div>

 <div className="space-y-3">
 <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
 <p className="text-xs font-display font-black uppercase tracking-[0.16em] text-primary/70">Seller flow</p>
 <p className="mt-2 text-sm font-display text-foreground/80">{editCourse ? "Salvar ajustes de posicionamento e seguir refinando a experiência do aluno." : "Criar o curso e entrar no studio para completar módulos, aulas, anexos e publicação."}</p>
 </div>
 <div className="rounded-2xl border border-border/10 bg-background/70 p-4">
 <p className="text-xs font-display font-black uppercase tracking-[0.16em] text-muted-foreground/45">Leitura do aluno</p>
 <p className="mt-2 text-sm font-display text-foreground/75">Hero forte, rails claros, continuidade visual e sensação de plataforma pronta desde o primeiro acesso.</p>
 </div>
 </div>
 </div>
 </div>
 )}
 </motion.div>
 </AnimatePresence>
 </div>

 <aside className="hidden border-l border-border/10 bg-muted/[0.02] px-5 py-6 lg:flex lg:flex-col">
 <div className="mb-4 flex items-center justify-between gap-3">
 <div>
 <p className="text-[11px] font-display font-bold uppercase tracking-[0.18em] text-primary/60">Preview lateral</p>
 <p className="mt-1 text-sm font-display font-black text-foreground/80">Visão real do aluno</p>
 </div>
 <div className="flex items-center gap-0.5 rounded-xl border border-border/10 bg-card/70 p-0.5">
 {[
 { id: "desktop" as const, icon: Monitor },
 { id: "mobile" as const, icon: Smartphone },
 ].map((item) => (
 <button
 key={item.id}
 type="button"
 onClick={() => setViewMode(item.id)}
 className={cn(
 "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
 viewMode === item.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground/35 hover:text-foreground/70",
 )}
 >
 <item.icon className="h-4 w-4" />
 </button>
 ))}
 </div>
 </div>

 <div className="rounded-[1.75rem] border border-border/10 bg-card/70 p-3">
 <MemberExperiencePreview
 course={{
 title: form.title || "Sua área premium",
 description: form.description,
 category: form.category,
 thumbnail_url: form.thumbnail_url,
 productName: linkedProduct?.name,
 is_published: false,
 }}
 modules={previewModules}
 viewMode={viewMode}
 />
 </div>

 <div className="mt-4 grid grid-cols-2 gap-2">
 <div className="rounded-2xl border border-border/10 bg-card/70 px-3 py-2.5">
 <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground/35">Rails</p>
 <p className="mt-1 text-sm font-display font-black text-foreground/80">{previewModules.length}</p>
 </div>
 <div className="rounded-2xl border border-border/10 bg-card/70 px-3 py-2.5">
 <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground/35">Hero</p>
 <p className="mt-1 text-sm font-display font-black text-primary">{form.thumbnail_url ? "On" : "Off"}</p>
 </div>
 </div>
 </aside>
 </div>

 <div className="flex items-center justify-between border-t border-border/10 bg-card/70 px-6 py-4">
 <div>
 {stepIndex > 0 ? (
 <Button variant="ghost" onClick={previousStep} className="rounded-2xl font-display font-bold text-foreground/70">
 <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
 </Button>
 ) : null}
 </div>

 <div className="flex items-center gap-2">
 {step !== "launch" ? (
 <Button onClick={nextStep} disabled={!canContinue} className="rounded-2xl px-6 font-display font-bold shadow-lg shadow-primary/15">
 Próximo <ChevronRight className="ml-2 h-4 w-4" />
 </Button>
 ) : (
 <Button onClick={saveCourse} disabled={saving || !form.title.trim()} className="rounded-2xl px-6 font-display font-bold shadow-lg shadow-primary/15">
 {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
 {editCourse ? "Salvar ajustes" : "Criar curso"}
 </Button>
 )}
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
}
