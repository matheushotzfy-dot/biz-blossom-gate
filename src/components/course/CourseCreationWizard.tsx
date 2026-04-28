import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Rocket,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
  { value: "fitness", label: "Fitness" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "programacao", label: "Programação" },
  { value: "geral", label: "Outros" },
] as const;

const STARTER_TEMPLATES = [
  { name: "Signature", modules: ["Boas-vindas", "Fundamentos", "Implementação", "Avançado", "Bônus"] },
  { name: "Express", modules: ["Comece aqui", "O método", "Aplicação", "Próximos passos"] },
  { name: "Mentoria", modules: ["Onboarding", "Trilha principal", "Lives gravadas", "Comunidade"] },
] as const;

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface ModuleDraft {
  id: string;
  title: string;
  description: string;
  beats: string[];
}

function buildModule(title: string): ModuleDraft {
  const clean = title.trim() || "Novo módulo";
  return {
    id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: clean,
    description: "",
    beats: [`Introdução a ${clean}`, `${clean} na prática`, `${clean} • Aprofundamento`],
  };
}

export default function CourseCreationWizard({ open, onOpenChange, products, editCourse, onSaved }: WizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [activeFrame, setActiveFrame] = useState(0);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "geral",
    product_id: "",
    thumbnail_url: "",
  });
  const [modules, setModules] = useState<ModuleDraft[]>([]);

  useEffect(() => {
    if (!open) return;
    setActiveFrame(0);
    setForm({
      title: editCourse?.title || "",
      description: editCourse?.description || "",
      category: editCourse?.category || "geral",
      product_id: editCourse?.product_id || "",
      thumbnail_url: editCourse?.thumbnail_url || "",
    });
    setModules(
      editCourse?.modules?.map((m, i) => ({
        id: m.id ?? `mod-${i}`,
        title: m.title,
        description: "",
        beats: Array.from({ length: m.lessonsCount ?? 3 }, (_, j) =>
          j === 0 ? `Introdução a ${m.title}` : `${m.title} • Aula ${j + 1}`
        ),
      })) ?? []
    );
  }, [open, editCourse]);

  const linkedProduct = products.find((p) => p.id === form.product_id) ?? null;

  const totalBeats = useMemo(() => modules.reduce((acc, m) => acc + m.beats.length, 0), [modules]);
  const totalRuntimeMin = totalBeats * 11;
  const runtimeHours = Math.floor(totalRuntimeMin / 60);
  const runtimeMins = totalRuntimeMin % 60;

  // Total frames = cover + modules + add-frame
  const totalFrames = 1 + modules.length + 1;

  const scrollToFrame = (idx: number) => {
    const target = stripRef.current?.children[idx] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      setActiveFrame(idx);
    }
  };

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
      setForm((c) => ({ ...c, thumbnail_url: data.publicUrl }));
      toast.success("Capa aplicada");
    } catch {
      toast.error("Erro no upload.");
    } finally {
      setUploading(false);
    }
  };

  const addModule = (title: string) => {
    const clean = title.trim();
    if (!clean) return;
    if (modules.some((m) => m.title.toLowerCase() === clean.toLowerCase())) {
      toast.info("Esse módulo já existe");
      return;
    }
    setModules((cur) => {
      const next = [...cur, buildModule(clean)];
      // Auto-scroll to new frame after render
      setTimeout(() => scrollToFrame(next.length), 100);
      return next;
    });
  };

  const updateModule = (id: string, patch: Partial<ModuleDraft>) => {
    setModules((cur) => cur.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const removeModule = (id: string) => {
    setModules((cur) => cur.filter((m) => m.id !== id));
  };

  const addBeat = (moduleId: string) => {
    setModules((cur) => cur.map((m) => (m.id === moduleId ? { ...m, beats: [...m.beats, "Nova aula"] } : m)));
  };

  const updateBeat = (moduleId: string, idx: number, value: string) => {
    setModules((cur) => cur.map((m) =>
      m.id === moduleId ? { ...m, beats: m.beats.map((b, i) => (i === idx ? value : b)) } : m
    ));
  };

  const removeBeat = (moduleId: string, idx: number) => {
    setModules((cur) => cur.map((m) =>
      m.id === moduleId ? { ...m, beats: m.beats.filter((_, i) => i !== idx) } : m
    ));
  };

  const moveModule = (from: number, to: number) => {
    if (from === to) return;
    setModules((cur) => {
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const applyTemplate = (tpl: typeof STARTER_TEMPLATES[number]) => {
    setModules(tpl.modules.map((title) => buildModule(title)));
    toast.success(`Template "${tpl.name}" aplicado · ${tpl.modules.length} módulos`);
    setTimeout(() => scrollToFrame(1), 200);
  };

  const saveCourse = async () => {
    if (!user || !form.title.trim()) {
      toast.error("Adicione um nome para o curso");
      scrollToFrame(0);
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

      if (modules.length > 0) {
        const { error: modErr } = await supabase.from("modules").insert(
          modules.map((m, i) => ({ course_id: data.id, title: m.title, sort_order: i }))
        );
        if (modErr) throw modErr;
      }

      toast.success("🎬 Curso publicado em sequência!");
      onOpenChange(false);
      onSaved();
      navigate(`/vendas/conteudo/${data.id}/builder`);
    } catch {
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const navigateFrame = (dir: "prev" | "next") => {
    const next = dir === "next" ? Math.min(activeFrame + 1, totalFrames - 1) : Math.max(activeFrame - 1, 0);
    scrollToFrame(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] flex-col gap-0 overflow-hidden border-0 bg-background p-0 rounded-none">
        {/* DIRECTOR'S BRIEF — Header */}
        <header className="shrink-0 border-b border-border bg-background px-6 lg:px-12 pt-6 pb-5">
          <div className="mx-auto max-w-[1600px] flex items-end justify-between gap-6">
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 text-[10px] font-bold tracking-widest uppercase border border-primary text-primary">
                  {editCourse ? "Em edição" : "Production phase"}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums hidden sm:inline">
                  ID · {editCourse?.id?.slice(0, 8) ?? "NEW-DRAFT"}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="ml-auto lg:hidden flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value.slice(0, 80) }))}
                placeholder="Untitled Course"
                className="block w-full bg-transparent text-3xl lg:text-5xl font-bold text-foreground tracking-tight focus:outline-none placeholder:text-border"
              />
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm pt-1">
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-0.5">Categoria</span>
                  <Select value={form.category} onValueChange={(v) => setForm((c) => ({ ...c, category: v }))}>
                    <SelectTrigger className="bg-transparent border-none p-0 h-auto text-foreground font-semibold focus:ring-0 hover:text-primary transition-colors w-auto gap-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COURSE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-0.5">Produto vinculado</span>
                  <Select value={form.product_id || "none"} onValueChange={(v) => setForm((c) => ({ ...c, product_id: v === "none" ? "" : v }))}>
                    <SelectTrigger className="bg-transparent border-none p-0 h-auto text-primary font-semibold focus:ring-0 hover:opacity-80 w-auto gap-2">
                      <SelectValue placeholder="Sem vínculo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="hidden md:flex flex-col">
                  <span className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold mb-0.5">Runtime estimado</span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {runtimeHours}h {runtimeMins.toString().padStart(2, "0")}m · {totalBeats} beats
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex flex-col items-end gap-3 shrink-0">
              <Button
                onClick={saveCourse}
                disabled={saving || !form.title.trim()}
                className="px-7 h-11 rounded-none bg-primary text-primary-foreground font-bold text-xs tracking-[0.2em] uppercase hover:bg-primary/90"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Rocket className="h-3.5 w-3.5 mr-2" />}
                {editCourse ? "Salvar alterações" : "Publicar sequência"}
              </Button>
              <p className="max-w-xs text-right text-[11px] text-muted-foreground leading-relaxed">
                {form.description || "Adicione uma promessa no Frame Cover pra dar contexto à sequência."}
              </p>
            </div>
          </div>
        </header>

        {/* STORYBOARD STRIP — Horizontal scrolling frames */}
        <div className="relative flex-1 min-h-0 bg-card-inset overflow-hidden">
          {/* Frame nav arrows */}
          <button
            type="button"
            onClick={() => navigateFrame("prev")}
            disabled={activeFrame === 0}
            className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 items-center justify-center border border-border bg-background text-foreground hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => navigateFrame("next")}
            disabled={activeFrame >= totalFrames - 1}
            className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 items-center justify-center border border-border bg-background text-foreground hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={stripRef}
            className="flex h-full gap-6 overflow-x-auto overflow-y-hidden px-6 lg:px-16 py-8 snap-x snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: "thin" }}
          >
            {/* === FRAME 00: COVER ART === */}
            <FrameWrapper index={0} label="Frame 00 · Cover Art" subLabel="Identidade visual" width="w-[340px] lg:w-[420px]" isActive={activeFrame === 0}>
              <div
                className="aspect-[4/5] bg-card border border-border overflow-hidden relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
              >
                {form.thumbnail_url ? (
                  <>
                    <img src={form.thumbnail_url} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-background/95 via-background/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="w-full py-3 border border-border bg-card text-xs font-bold tracking-widest uppercase hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                      >
                        Trocar visual
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setForm((c) => ({ ...c, thumbnail_url: "" })); }}
                        className="w-full mt-2 py-2 text-[10px] font-bold tracking-widest uppercase text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        Remover capa
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <div className="h-14 w-14 border border-border flex items-center justify-center">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <p className="text-sm font-bold text-foreground">Compose your cover</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Clique ou arraste uma imagem<br/>16:9 ou 4:5 · até 5MB
                    </p>
                    <div className="mt-3 px-3 py-1 border border-border text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                      Drop here
                    </div>
                  </div>
                )}
              </div>

              {/* Promise / Description below cover */}
              <div className="mt-6 space-y-2">
                <label className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase italic">Promessa do curso</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value.slice(0, 280) }))}
                  placeholder="Em uma frase, o que o aluno vai conquistar?"
                  className="min-h-[100px] rounded-none border-border bg-card text-sm font-medium resize-none focus-visible:border-primary"
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Aparece no header da área de membros</span>
                  <span className="tabular-nums">{form.description.length}/280</span>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </FrameWrapper>

            {/* === Empty state — show templates if no modules === */}
            {modules.length === 0 && !editCourse && (
              <FrameWrapper index={1} label="Frame 01 · Comece com um template" subLabel="Ou crie do zero" width="w-[340px] lg:w-[480px]" isActive={activeFrame === 1}>
                <div className="border border-border bg-card p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Comece em 1 clique</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Estruturas validadas. Você customiza tudo depois.</p>
                  </div>
                  <div className="space-y-2">
                    {STARTER_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.name}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="w-full p-4 border border-border bg-background hover:border-primary hover:bg-primary/5 transition-all text-left group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold text-foreground">{tpl.name}</p>
                          <span className="text-[10px] font-bold tracking-widest text-muted-foreground group-hover:text-primary uppercase">
                            {tpl.modules.length} frames →
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {tpl.modules.map((m) => (
                            <span key={m} className="bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{m}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => addModule("Módulo 1")}
                      className="w-full py-3 border border-dashed border-border text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-primary hover:border-primary transition-all"
                    >
                      + Compor do zero
                    </button>
                  </div>
                </div>
              </FrameWrapper>
            )}

            {/* === MODULE FRAMES === */}
            {modules.map((mod, i) => {
              const frameIdx = i + 1;
              return (
                <FrameWrapper
                  key={mod.id}
                  index={frameIdx}
                  label={`Frame ${String(i + 1).padStart(2, "0")} · ${mod.title || "Sem título"}`}
                  subLabel={`${mod.beats.length} beats`}
                  width="w-[340px] lg:w-[580px]"
                  isActive={activeFrame === frameIdx}
                  draggable
                  onDragStart={() => setDraggedIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIdx !== null) moveModule(draggedIdx, i);
                    setDraggedIdx(null);
                  }}
                  onDragEnd={() => setDraggedIdx(null)}
                  isDragging={draggedIdx === i}
                >
                  <div className="border border-border bg-card p-5 lg:p-7 min-h-[480px] flex flex-col">
                    <div className="mb-6 space-y-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-move" />
                        <input
                          type="text"
                          value={mod.title}
                          onChange={(e) => updateModule(mod.id, { title: e.target.value })}
                          placeholder="Nome do módulo"
                          className="flex-1 text-xl lg:text-2xl font-bold text-foreground bg-transparent border-none p-0 focus:outline-none placeholder:text-border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            removeModule(mod.id);
                            scrollToFrame(Math.max(0, frameIdx - 1));
                          }}
                          className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                          title="Remover módulo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <textarea
                        value={mod.description}
                        onChange={(e) => updateModule(mod.id, { description: e.target.value })}
                        placeholder="Descreva o objetivo temático deste módulo..."
                        className="w-full bg-transparent border-none p-0 text-muted-foreground text-sm leading-relaxed resize-none h-16 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-2 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase italic">Beats da sequência</label>
                        <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{mod.beats.length} aulas</span>
                      </div>
                      {mod.beats.map((beat, idx) => (
                        <div
                          key={idx}
                          className="group flex items-center gap-3 p-3 border border-border bg-background hover:border-primary/40 transition-colors"
                        >
                          <span className="text-[10px] font-bold text-muted-foreground tabular-nums shrink-0">
                            {String(i + 1)}.{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={beat}
                            onChange={(e) => updateBeat(mod.id, idx, e.target.value)}
                            className="flex-1 bg-transparent border-none p-0 text-sm font-medium text-foreground focus:outline-none"
                          />
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0 hidden sm:inline">VIDEO / 11:00</span>
                          <button
                            type="button"
                            onClick={() => removeBeat(mod.id, idx)}
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addBeat(mod.id)}
                        className="w-full py-2.5 border border-dashed border-border text-muted-foreground text-[10px] font-bold tracking-widest uppercase hover:text-primary hover:border-primary transition-all"
                      >
                        + Insert New Beat
                      </button>
                    </div>
                  </div>
                </FrameWrapper>
              );
            })}

            {/* === ADD FRAME === */}
            {(modules.length > 0 || editCourse) && (
              <FrameWrapper
                index={modules.length + 1}
                label="Frame final"
                subLabel="Adicionar módulo"
                width="w-[280px] lg:w-[360px]"
                isActive={activeFrame === modules.length + 1}
              >
                <AddFrameInline onAdd={addModule} />
              </FrameWrapper>
            )}
          </div>
        </div>

        {/* CONSOLE FOOTER — Floating bottom bar */}
        <footer className="shrink-0 border-t border-border bg-background">
          <div className="mx-auto max-w-[1600px] px-6 lg:px-12 py-3 flex items-center justify-between gap-4">
            {/* Frame indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="size-2 bg-success rounded-full animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground hidden sm:inline">Auto-save</span>
              </div>
              <div className="h-4 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalFrames }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => scrollToFrame(i)}
                    className={cn(
                      "h-1.5 transition-all",
                      i === activeFrame ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Center stats */}
            <div className="hidden md:flex items-center gap-6 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
              <span>
                <span className="text-foreground tabular-nums">{modules.length}</span> Frames
              </span>
              <span>
                <span className="text-foreground tabular-nums">{totalBeats}</span> Beats
              </span>
              <span>
                <span className="text-foreground tabular-nums">{runtimeHours}h{runtimeMins.toString().padStart(2, "0")}</span> Runtime
              </span>
              {linkedProduct && (
                <span className="hidden xl:inline">
                  Linked → <span className="text-primary normal-case tracking-normal">{linkedProduct.name}</span>
                </span>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="hidden lg:flex h-9 px-3 items-center text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                Discard
              </button>
              <Button
                onClick={saveCourse}
                disabled={saving || !form.title.trim()}
                className="lg:hidden h-9 px-4 rounded-none bg-primary text-primary-foreground font-bold text-[11px] tracking-widest uppercase"
              >
                {saving ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Rocket className="h-3 w-3 mr-1.5" />}
                {editCourse ? "Salvar" : "Publicar"}
              </Button>
            </div>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// FrameWrapper — each frame in the storyboard strip
// ============================================================
interface FrameWrapperProps {
  index: number;
  label: string;
  subLabel: string;
  width: string;
  isActive: boolean;
  isDragging?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  children: React.ReactNode;
}

function FrameWrapper({
  index, label, subLabel, width, isActive, isDragging,
  draggable, onDragStart, onDragOver, onDrop, onDragEnd, children
}: FrameWrapperProps) {
  return (
    <div
      className={cn("flex-shrink-0 snap-start transition-opacity", width, isDragging && "opacity-50")}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className={cn(
          "text-[10px] font-bold tracking-[0.2em] uppercase italic transition-colors",
          isActive ? "text-primary" : "text-muted-foreground"
        )}>
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">{subLabel}</span>
      </div>
      {children}
    </div>
  );
}

// ============================================================
// AddFrameInline — composer to add a new module frame
// ============================================================
function AddFrameInline({ onAdd }: { onAdd: (title: string) => void }) {
  const [name, setName] = useState("");
  const [showInput, setShowInput] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name);
    setName("");
    setShowInput(false);
  };

  if (!showInput) {
    return (
      <button
        type="button"
        onClick={() => setShowInput(true)}
        className="w-full min-h-[480px] border border-dashed border-border bg-card-inset flex flex-col items-center justify-center p-12 hover:border-primary group transition-all"
      >
        <div className="size-14 border border-border flex items-center justify-center mb-5 group-hover:border-primary group-hover:bg-primary/5 transition-all">
          <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <h3 className="text-foreground font-bold text-[11px] tracking-widest uppercase mb-2">Compose New Scene</h3>
        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          Expanda sua narrativa com<br/>um novo módulo instrucional
        </p>
      </button>
    );
  }

  return (
    <div className="w-full min-h-[480px] border border-primary bg-card flex flex-col items-center justify-center p-8 gap-4">
      <Layers className="h-6 w-6 text-primary" />
      <p className="text-[11px] font-bold tracking-widest uppercase text-foreground text-center">Nome do novo frame</p>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setShowInput(false);
        }}
        placeholder="Ex: Implementação"
        className="rounded-none border-border bg-background text-center font-bold"
      />
      <div className="flex gap-2 w-full">
        <button
          type="button"
          onClick={() => setShowInput(false)}
          className="flex-1 h-10 border border-border text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:border-foreground hover:text-foreground transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className="flex-1 h-10 bg-primary text-primary-foreground text-[10px] font-bold tracking-widest uppercase hover:bg-primary/90 disabled:opacity-40 transition-all"
        >
          Insert
        </button>
      </div>
    </div>
  );
}
