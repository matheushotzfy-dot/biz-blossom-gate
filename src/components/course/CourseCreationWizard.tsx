import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Sparkles, Check, ChevronRight, ChevronLeft, Image as ImageIcon,
  X, BookOpen, Layers, Type, FileText, Palette, Eye,
  GraduationCap, Upload, Plus, Trash2, ArrowRight, Loader2,
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

const STEPS: { id: Step; label: string; icon: any }[] = [
  { id: "info", label: "Informações", icon: Type },
  { id: "visual", label: "Visual", icon: Palette },
  { id: "modules", label: "Módulos", icon: Layers },
  { id: "review", label: "Revisar", icon: Eye },
];

// ── Image Upload ──
function ImageUpload({ value, onChange, label, aspect = "aspect-video" }: {
  value: string; onChange: (url: string) => void; label: string; aspect?: string;
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
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ── Live Preview Mini ──
function MiniPreview({ form, modules }: { form: any; modules: string[] }) {
  return (
    <div className="rounded-2xl border border-border/20 bg-background overflow-hidden shadow-xl">
      {/* Browser chrome */}
      <div className="h-7 bg-card/80 border-b border-border/15 flex items-center gap-1.5 px-3">
        <div className="h-2 w-2 rounded-full bg-destructive/30" />
        <div className="h-2 w-2 rounded-full bg-warning/30" />
        <div className="h-2 w-2 rounded-full bg-success/30" />
        <div className="ml-3 h-4 flex-1 max-w-[140px] rounded-md bg-muted/10 flex items-center justify-center">
          <span className="text-[7px] text-muted-foreground/30 truncate px-2">{form.title || "Meu Curso"}</span>
        </div>
      </div>
      {/* Content */}
      <div className="p-3 space-y-2.5 max-h-[320px] overflow-y-auto">
        {/* Hero */}
        <div className="relative rounded-xl overflow-hidden aspect-[2.5/1] bg-gradient-to-br from-primary/8 to-muted/5">
          {form.thumbnail_url ? (
            <img src={form.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-primary/10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3">
            <p className="text-[10px] font-display font-black text-foreground truncate">{form.title || "Nome do Curso"}</p>
            {form.description && <p className="text-[7px] text-muted-foreground/50 line-clamp-1 mt-0.5">{form.description}</p>}
          </div>
        </div>

        {/* Modules preview */}
        {modules.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[8px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider">Módulos</p>
            {modules.map((m, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-card/60 border border-border/10">
                <div className="h-5 w-5 rounded-md bg-primary/8 flex items-center justify-center text-[8px] font-display font-black text-primary/50">{i + 1}</div>
                <span className="text-[9px] font-display font-bold text-foreground/60 truncate">{m || "Módulo sem nome"}</span>
              </div>
            ))}
          </div>
        )}

        {modules.length === 0 && (
          <div className="py-4 flex flex-col items-center gap-1.5 text-center">
            <Layers className="h-5 w-5 text-muted-foreground/10" />
            <p className="text-[8px] text-muted-foreground/25">Adicione módulos para ver aqui</p>
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

  // Reset on open
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[960px] p-0 gap-0 bg-card/95 backdrop-blur-2xl border-border/20 overflow-hidden rounded-3xl max-h-[90vh]">
        {/* ── Header with steps ── */}
        <div className="px-6 pt-6 pb-4 border-b border-border/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-info/[0.02] pointer-events-none" />
          <div className="relative flex items-center gap-4 mb-5">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              {editCourse ? <BookOpen className="h-5 w-5 text-primary-foreground" /> : <Sparkles className="h-5 w-5 text-primary-foreground" />}
            </div>
            <div>
              <h2 className="text-lg font-display font-black tracking-[-0.02em] text-foreground">{editCourse ? "Editar Curso" : "Criar Novo Curso"}</h2>
              <p className="text-xs text-muted-foreground/50 font-display mt-0.5">Passo {stepIndex + 1} de {STEPS.length}</p>
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
                    isActive ? "text-primary" : isDone ? "text-success/60 cursor-pointer" : "text-muted-foreground/20"
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
        <div className="flex min-h-[420px] max-h-[calc(90vh-200px)]">
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
                    <ImageUpload
                      value={form.thumbnail_url}
                      onChange={url => setForm(p => ({ ...p, thumbnail_url: url }))}
                      label="Thumbnail / Capa do Curso"
                      aspect="aspect-video"
                    />
                    <div className="rounded-xl bg-info/5 border border-info/10 p-4 flex items-start gap-3">
                      <ImageIcon className="h-5 w-5 text-info/50 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-display font-bold text-foreground/60">Dica de imagem</p>
                        <p className="text-[11px] text-muted-foreground/50 mt-1 leading-relaxed">Use uma imagem 16:9 com pelo menos 1280x720px. Ela será exibida no catálogo de cursos dos seus alunos.</p>
                      </div>
                    </div>
                  </>
                )}

                {/* ─── STEP: MODULES ─── */}
                {currentStep === "modules" && (
                  <>
                    {!editCourse && (
                      <>
                        <p className="text-xs text-muted-foreground/50 font-display leading-relaxed">
                          Já deixe a estrutura inicial pronta! Adicione os módulos do seu curso. Você poderá adicionar aulas depois no editor.
                        </p>
                        <div className="flex gap-2">
                          <Input
                            value={newModuleName}
                            onChange={e => setNewModuleName(e.target.value)}
                            placeholder="Nome do módulo..."
                            className="h-11 rounded-xl font-display"
                            onKeyDown={e => { if (e.key === "Enter") addModule(); }}
                          />
                          <Button onClick={addModule} disabled={!newModuleName.trim()} className="h-11 rounded-xl px-5 font-display font-bold gap-2 shrink-0">
                            <Plus className="h-4 w-4" /> Adicionar
                          </Button>
                        </div>

                        {wizardModules.length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            {wizardModules.map((m, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3 p-3 rounded-xl bg-card/60 border border-border/15 group hover:border-border/25 transition-all"
                              >
                                <div className="h-8 w-8 rounded-lg bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center text-xs font-display font-black text-primary/60">{i + 1}</div>
                                <span className="flex-1 text-sm font-display font-bold text-foreground/70">{m}</span>
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
                    )}
                    {editCourse && (
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
                            <div className="flex items-center gap-2 mt-2">
                              {form.category && (
                                <span className="text-[10px] font-display font-bold text-muted-foreground/50 bg-muted/8 px-2 py-0.5 rounded-md">{form.category}</span>
                              )}
                              {!editCourse && wizardModules.length > 0 && (
                                <span className="text-[10px] font-display font-bold text-primary/60 bg-primary/5 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Layers className="h-2.5 w-2.5" /> {wizardModules.length} módulo{wizardModules.length !== 1 ? "s" : ""}
                                </span>
                              )}
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
          <div className="hidden md:flex w-[280px] border-l border-border/10 bg-muted/[0.02] p-4 flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-3.5 w-3.5 text-primary/40" />
              <span className="text-[10px] font-display font-bold text-muted-foreground/40 uppercase tracking-wider">Preview do Aluno</span>
            </div>
            <MiniPreview form={form} modules={wizardModules} />
            <p className="text-[9px] text-muted-foreground/25 text-center font-display mt-1">Prévia de como o aluno verá</p>
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
