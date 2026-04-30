import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
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
  { name: "Curso completo", description: "Estrutura clássica com 5 módulos", modules: ["Boas-vindas", "Fundamentos", "Implementação", "Avançado", "Bônus"] },
  { name: "Curso rápido", description: "Para entregas mais diretas", modules: ["Comece aqui", "O método", "Aplicação", "Próximos passos"] },
  { name: "Mentoria", description: "Modelo para programas de acompanhamento", modules: ["Onboarding", "Trilha principal", "Lives gravadas", "Comunidade"] },
] as const;

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface ModuleDraft {
  id: string;
  title: string;
}

function buildModule(title: string): ModuleDraft {
  const clean = title.trim() || "Novo módulo";
  return {
    id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: clean,
  };
}

type Step = 1 | 2 | 3;

export default function CourseCreationWizard({ open, onOpenChange, products, editCourse, onSaved }: WizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [newModuleName, setNewModuleName] = useState("");

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
    setStep(1);
    setNewModuleName("");
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
      })) ?? []
    );
  }, [open, editCourse]);

  const isEditing = !!editCourse;
  const titleValid = form.title.trim().length >= 3;

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
      toast.success("Capa enviada");
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
    setModules((cur) => [...cur, buildModule(clean)]);
    setNewModuleName("");
  };

  const updateModule = (id: string, title: string) => {
    setModules((cur) => cur.map((m) => (m.id === id ? { ...m, title } : m)));
  };

  const removeModule = (id: string) => {
    setModules((cur) => cur.filter((m) => m.id !== id));
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
    toast.success(`Template aplicado: ${tpl.modules.length} módulos`);
  };

  const goNext = () => {
    if (step === 1) {
      if (!titleValid) {
        toast.error("O nome do curso precisa ter pelo menos 3 caracteres");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const saveCourse = async () => {
    if (!user || !titleValid) {
      toast.error("Adicione um nome para o curso");
      setStep(1);
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
        toast.success("Curso atualizado");
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

      toast.success("Curso criado com sucesso");
      onOpenChange(false);
      onSaved();
      navigate(`/vendas/conteudo/${data.id}/builder`);
    } catch {
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const STEPS: { n: Step; label: string; helper: string }[] = [
    { n: 1, label: "Informações", helper: "Nome, categoria e capa" },
    { n: 2, label: "Módulos", helper: "Estrutura do conteúdo" },
    { n: 3, label: "Revisão", helper: "Confira e publique" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] flex-col gap-0 overflow-hidden border-0 bg-background p-0 rounded-none">
        {/* HEADER */}
        <header className="shrink-0 border-b border-border bg-background">
          <div className="mx-auto max-w-[920px] px-6 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">
                {isEditing ? "Editar curso" : "Criar novo curso"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Passo {step} de 3 — {STEPS[step - 1].helper}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 flex items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stepper */}
          <div className="border-t border-border bg-card">
            <div className="mx-auto max-w-[920px] px-6 py-3 flex items-center gap-2">
              {STEPS.map((s, i) => {
                const isDone = step > s.n;
                const isCurrent = step === s.n;
                return (
                  <div key={s.n} className="flex items-center gap-2 flex-1">
                    <div
                      className={cn(
                        "flex items-center gap-2 flex-1 px-3 py-2 border transition-colors",
                        isCurrent && "border-primary bg-primary/5",
                        isDone && "border-success/40 bg-success/5",
                        !isCurrent && !isDone && "border-border bg-background"
                      )}
                    >
                      <div
                        className={cn(
                          "h-6 w-6 flex items-center justify-center text-[11px] font-bold tabular-nums border",
                          isCurrent && "border-primary bg-primary text-primary-foreground",
                          isDone && "border-success bg-success text-success-foreground",
                          !isCurrent && !isDone && "border-border bg-card text-muted-foreground"
                        )}
                      >
                        {isDone ? <Check className="h-3 w-3" /> : s.n}
                      </div>
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          isCurrent && "text-foreground",
                          !isCurrent && "text-muted-foreground"
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={cn("h-px w-3 shrink-0", isDone ? "bg-success" : "bg-border")} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        {/* BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-background">
          <div className="mx-auto max-w-[760px] px-6 py-8">
            {/* STEP 1 — Informações */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    Nome do curso <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((c) => ({ ...c, title: e.target.value.slice(0, 80) }))}
                    placeholder="Ex: Como vender no Instagram"
                    className="rounded-none border-border bg-card h-11 text-base focus-visible:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">{form.title.length}/80 caracteres</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Descrição curta</label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((c) => ({ ...c, description: e.target.value.slice(0, 280) }))}
                    placeholder="Em uma frase, o que o aluno vai aprender?"
                    className="min-h-[90px] rounded-none border-border bg-card text-sm resize-none focus-visible:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">{form.description.length}/280 caracteres</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Categoria</label>
                    <Select value={form.category} onValueChange={(v) => setForm((c) => ({ ...c, category: v }))}>
                      <SelectTrigger className="rounded-none border-border bg-card h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COURSE_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Produto vinculado</label>
                    <Select
                      value={form.product_id || "none"}
                      onValueChange={(v) => setForm((c) => ({ ...c, product_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger className="rounded-none border-border bg-card h-11">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (vincular depois)</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Quem comprar este produto terá acesso ao curso.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Capa do curso</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files[0];
                      if (f) handleFile(f);
                    }}
                    className="border border-border bg-card overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  >
                    {form.thumbnail_url ? (
                      <div className="relative aspect-video group">
                        <img src={form.thumbnail_url} alt="Capa" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="px-4 h-9 border border-border bg-card text-xs font-semibold hover:border-primary hover:text-primary transition-colors"
                          >
                            Trocar imagem
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setForm((c) => ({ ...c, thumbnail_url: "" })); }}
                            className="px-4 h-9 border border-destructive/40 bg-card text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video flex flex-col items-center justify-center gap-3 p-8 text-center">
                        <div className="h-12 w-12 border border-border flex items-center justify-center">
                          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Clique ou arraste uma imagem</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP ou GIF · até 5MB</p>
                        </div>
                      </div>
                    )}
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
                </div>
              </div>
            )}

            {/* STEP 2 — Módulos */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-foreground">Estrutura do curso</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Organize seu conteúdo em módulos. Você poderá adicionar aulas dentro de cada módulo no próximo passo.
                  </p>
                </div>

                {/* Templates — apenas se estiver vazio e não em edição */}
                {modules.length === 0 && !isEditing && (
                  <div className="border border-border bg-card p-5 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Comece com um modelo pronto</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Você pode editar tudo depois.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {STARTER_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.name}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          className="text-left p-4 border border-border bg-background hover:border-primary hover:bg-primary/5 transition-colors group"
                        >
                          <p className="text-sm font-bold text-foreground">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>
                          <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                            {tpl.modules.length} módulos
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista de módulos */}
                <div className="space-y-2">
                  {modules.length === 0 ? (
                    <div className="border border-dashed border-border bg-card p-10 text-center">
                      <p className="text-sm text-muted-foreground">Nenhum módulo adicionado ainda.</p>
                      <p className="text-xs text-muted-foreground mt-1">Use um modelo acima ou adicione um módulo abaixo.</p>
                    </div>
                  ) : (
                    modules.map((mod, i) => (
                      <div
                        key={mod.id}
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
                          "flex items-center gap-3 p-3 border border-border bg-card hover:border-primary/40 transition-colors",
                          draggedIdx === i && "opacity-50"
                        )}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground/60 cursor-move shrink-0" />
                        <span className="text-xs font-bold text-muted-foreground tabular-nums shrink-0 w-6">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <Input
                          value={mod.title}
                          onChange={(e) => updateModule(mod.id, e.target.value)}
                          placeholder="Nome do módulo"
                          className="flex-1 rounded-none border-transparent bg-transparent px-2 h-9 focus-visible:border-primary focus-visible:bg-background"
                        />
                        <button
                          type="button"
                          onClick={() => removeModule(mod.id)}
                          className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          title="Remover módulo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Adicionar módulo */}
                <div className="flex gap-2">
                  <Input
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addModule(newModuleName);
                      }
                    }}
                    placeholder="Nome do novo módulo (ex: Fundamentos)"
                    className="rounded-none border-border bg-card h-11 focus-visible:border-primary"
                  />
                  <Button
                    type="button"
                    onClick={() => addModule(newModuleName)}
                    disabled={!newModuleName.trim()}
                    className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-5"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Adicionar
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3 — Revisão */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-foreground">Revise antes de salvar</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Confira as informações. Você poderá editar tudo depois e adicionar as aulas dentro de cada módulo.
                  </p>
                </div>

                <div className="border border-border bg-card">
                  {/* Capa */}
                  {form.thumbnail_url && (
                    <div className="aspect-video bg-background overflow-hidden border-b border-border">
                      <img src={form.thumbnail_url} alt="Capa" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Nome</p>
                      <p className="text-base font-semibold text-foreground">{form.title || "—"}</p>
                    </div>
                    {form.description && (
                      <div>
                        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Descrição</p>
                        <p className="text-sm text-foreground">{form.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Categoria</p>
                        <p className="text-sm font-semibold text-foreground">
                          {COURSE_CATEGORIES.find((c) => c.value === form.category)?.label ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Produto</p>
                        <p className="text-sm font-semibold text-foreground">
                          {products.find((p) => p.id === form.product_id)?.name ?? "Nenhum"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                        Módulos ({modules.length})
                      </p>
                      {modules.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Nenhum módulo. Você pode adicionar depois.</p>
                      ) : (
                        <ul className="space-y-1">
                          {modules.map((m, i) => (
                            <li key={m.id} className="flex items-center gap-2 text-sm text-foreground">
                              <span className="text-xs font-bold text-muted-foreground tabular-nums w-6">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span>{m.title}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {!form.thumbnail_url && (
                  <div className="flex items-center gap-3 p-4 border border-warning/40 bg-warning/5">
                    <ImageIcon className="h-4 w-4 text-warning shrink-0" />
                    <p className="text-xs text-foreground">
                      Você não adicionou uma capa. O curso ficará sem imagem na área de membros — você pode adicionar depois.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <footer className="shrink-0 border-t border-border bg-card">
          <div className="mx-auto max-w-[920px] px-6 py-3 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={step === 1 ? () => onOpenChange(false) : goBack}
              className="rounded-none h-10 px-4 text-sm font-semibold"
            >
              {step === 1 ? (
                "Cancelar"
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Voltar
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={step === 1 && !titleValid}
                  className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5 text-sm font-semibold"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={saveCourse}
                  disabled={saving || !titleValid}
                  className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 text-sm font-semibold"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1.5" />
                  )}
                  {isEditing ? "Salvar alterações" : "Criar curso"}
                </Button>
              )}
            </div>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
