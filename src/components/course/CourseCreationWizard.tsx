import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  GraduationCap,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHead, FieldHint, FieldLabel, dialogShell } from "@/components/seller-ui/form";
import { Notice } from "@/components/seller-ui/studio";
import { COURSE_CATEGORIES, getCategoryLabel } from "@/components/course/contentPresentation";
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

const STARTER_TEMPLATES = [
  { name: "Curso completo", description: "Cinco módulos, do básico ao bônus", icon: BookOpen, modules: ["Boas-vindas", "Fundamentos", "Implementação", "Avançado", "Bônus"] },
  { name: "Curso rápido", description: "Quatro módulos, direto ao ponto", icon: Sparkles, modules: ["Comece aqui", "O método", "Aplicação", "Próximos passos"] },
  { name: "Mentoria", description: "Trilha com encontros e comunidade", icon: Layers, modules: ["Onboarding", "Trilha principal", "Lives gravadas", "Comunidade"] },
] as const;

const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const MAX_TITLE = 80;
const MAX_DESCRIPTION = 280;
const MAX_MODULE_TITLE = 80;
const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface ModuleDraft {
  id: string;
  title: string;
}

function buildModule(title: string): ModuleDraft {
  return { id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: title.trim() };
}

type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string; helper: string }[] = [
  { n: 1, label: "Informações", helper: "Nome, produto e capa" },
  { n: 2, label: "Módulos", helper: "Estrutura do conteúdo" },
  { n: 3, label: "Revisão", helper: "Confira antes de criar" },
];

const selectTriggerClass = "h-12 vp-r16 border-border bg-background px-4 text-[15px] data-[placeholder]:font-normal data-[placeholder]:text-muted-foreground";

export default function CourseCreationWizard({ open, onOpenChange, products, editCourse, onSaved }: WizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const initialRef = useRef("");
  const [step, setStep] = useState<Step>(1);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [newModuleName, setNewModuleName] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const [form, setForm] = useState({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" });
  const [modules, setModules] = useState<ModuleDraft[]>([]);

  const isEditing = !!editCourse;

  useEffect(() => {
    if (!open) return;
    const next = {
      title: editCourse?.title || "",
      description: editCourse?.description || "",
      category: editCourse?.category || "geral",
      product_id: editCourse?.product_id || "",
      thumbnail_url: editCourse?.thumbnail_url || "",
    };
    setStep(1);
    setNewModuleName("");
    setConfirmDiscard(false);
    setForm(next);
    setModules([]);
    initialRef.current = JSON.stringify({ form: next, modules: [] });
  }, [open, editCourse]);

  const titleValid = form.title.trim().length >= 3;
  const dirty = JSON.stringify({ form, modules: modules.map((m) => m.title) }) !== initialRef.current;
  const busy = saving || uploading;

  // A categoria salva pode ser um valor antigo que não está na lista: mantém visível e preservado.
  const categoryIsKnown = COURSE_CATEGORIES.some((c) => c.value === form.category);

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else onOpenChange(false);
  };

  const handleFile = async (file: File) => {
    if (!user) { toast.error("Sua sessão expirou. Entre de novo para enviar a capa."); return; }
    if (!ACCEPTED_IMAGES.includes(file.type)) {
      toast.error("Use uma imagem PNG, JPG, WEBP ou GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem passa de 5 MB. Escolha uma menor.");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      // O bucket exige que o primeiro nível do caminho seja o id do usuário.
      const path = `${user.id}/thumbnails/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((c) => ({ ...c, thumbnail_url: data.publicUrl }));
      toast.success("Capa enviada.");
    } catch {
      toast.error("Não foi possível enviar a capa. Tente de novo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addModule = (title: string) => {
    const clean = title.trim();
    if (!clean) return;
    if (modules.some((m) => m.title.trim().toLowerCase() === clean.toLowerCase())) {
      toast.info("Já existe um módulo com esse nome.");
      return;
    }
    setModules((cur) => [...cur, buildModule(clean)]);
    setNewModuleName("");
  };

  const updateModule = (id: string, title: string) => setModules((cur) => cur.map((m) => (m.id === id ? { ...m, title } : m)));
  const removeModule = (id: string) => setModules((cur) => cur.filter((m) => m.id !== id));

  const moveModule = (from: number, to: number) => {
    if (from === to || to < 0 || to >= modules.length) return;
    setModules((cur) => {
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const applyTemplate = (tpl: (typeof STARTER_TEMPLATES)[number]) => {
    setModules(tpl.modules.map((title) => buildModule(title)));
  };

  const goNext = () => {
    if (step === 1) {
      if (!titleValid) {
        toast.error("O nome da área precisa ter pelo menos 3 letras.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const saveCourse = async () => {
    if (savingRef.current) return;
    if (!user || !titleValid) {
      toast.error("Dê um nome para a área, com pelo menos 3 letras.");
      setStep(1);
      return;
    }
    savingRef.current = true;
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
        const { user_id: _userId, is_published: _isPublished, ...updatePayload } = payload;
        const { error } = await supabase.from("courses").update(updatePayload).eq("id", editCourse.id).eq("user_id", user.id);
        if (error) throw error;
        toast.success("Detalhes da área salvos.");
        onOpenChange(false);
        onSaved();
        return;
      }

      const { data, error } = await supabase.from("courses").insert(payload).select().maybeSingle();
      if (error || !data) throw error ?? new Error("Falha ao criar.");

      let modulesFailed = false;
      if (modules.length > 0) {
        const { error: modErr } = await supabase.from("modules").insert(
          modules.map((m, i) => ({ course_id: data.id, title: m.title.trim() || `Módulo ${i + 1}`, sort_order: i })),
        );
        modulesFailed = !!modErr;
      }

      if (modulesFailed) toast.warning("A área foi criada, mas os módulos não foram salvos. Adicione-os no editor de conteúdo.");
      else toast.success("Área criada como rascunho. Agora adicione as aulas.");
      onOpenChange(false);
      onSaved();
      navigate(`/vendas/conteudo/${data.id}/builder`);
    } catch {
      toast.error(isEditing ? "Não foi possível salvar os detalhes. Tente de novo." : "Não foi possível criar a área. Tente de novo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const selectedProduct = useMemo(() => products.find((p) => p.id === form.product_id), [products, form.product_id]);
  const current = STEPS[step - 1];

  const infoFields = (
    <div className="space-y-6">
      <div>
        <FieldLabel htmlFor="course-title">Nome da área</FieldLabel>
        <Input
          id="course-title"
          value={form.title}
          onChange={(e) => setForm((c) => ({ ...c, title: e.target.value.slice(0, MAX_TITLE) }))}
          placeholder="Ex.: Domine o marketing digital"
          aria-invalid={form.title.length > 0 && !titleValid}
          autoComplete="off"
          className="vp-field"
        />
        <div className="mt-1.5 flex items-start justify-between gap-3 text-[12.5px] leading-snug">
          <span className={cn(form.title.length > 0 && !titleValid ? "text-destructive" : "text-muted-foreground")}>
            {form.title.length > 0 && !titleValid ? "Use pelo menos 3 letras." : "É o nome que o aluno vê ao entrar."}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{form.title.length}/{MAX_TITLE}</span>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="course-description">Descrição curta</FieldLabel>
        <Textarea
          id="course-description"
          value={form.description}
          onChange={(e) => setForm((c) => ({ ...c, description: e.target.value.slice(0, MAX_DESCRIPTION) }))}
          placeholder="Em uma frase, o que o aluno vai aprender?"
          rows={3}
          className="vp-field resize-none leading-relaxed"
        />
        <p className="mt-1.5 text-right text-[12.5px] tabular-nums text-muted-foreground">{form.description.length}/{MAX_DESCRIPTION}</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
        <div className="min-w-0">
          <FieldLabel htmlFor="course-category">Categoria</FieldLabel>
          <Select value={form.category} onValueChange={(v) => setForm((c) => ({ ...c, category: v }))}>
            <SelectTrigger id="course-category" className={selectTriggerClass}><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {!categoryIsKnown && form.category && <SelectItem value={form.category}>{form.category}</SelectItem>}
              {COURSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <FieldLabel htmlFor="course-product">Produto vinculado</FieldLabel>
          <Select value={form.product_id || "none"} onValueChange={(v) => setForm((c) => ({ ...c, product_id: v === "none" ? "" : v }))}>
            <SelectTrigger id="course-product" className={selectTriggerClass}><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none">Nenhum (vincular depois)</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}, {formatCurrency(p.price)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldHint>Quem comprar esse produto recebe acesso à área.</FieldHint>
        </div>
      </div>

      <div>
        <FieldLabel>Capa</FieldLabel>
        {form.thumbnail_url ? (
          <div className="space-y-3">
            <div className="vp-r16 aspect-video max-w-[440px] overflow-hidden border border-border bg-accent">
              <img src={form.thumbnail_url} alt="Capa da área de membros" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="vp-ghost h-10 px-4 text-[13.5px]">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" strokeWidth={2.2} />}
                {uploading ? "Enviando…" : "Trocar imagem"}
              </button>
              <button type="button" onClick={() => setForm((c) => ({ ...c, thumbnail_url: "" }))} disabled={uploading} className="vp-ghost h-10 px-4 text-[13.5px] !text-destructive">
                <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                Remover capa
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void handleFile(f);
            }}
            disabled={uploading}
            className="vp-r16 group flex w-full flex-col items-center justify-center gap-3 border border-dashed border-border bg-background px-6 py-8 text-center transition-colors hover:border-primary/60 hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" strokeWidth={2.2} />}
            </span>
            <span>
              <span className="block text-[14.5px] font-semibold text-foreground">{uploading ? "Enviando a capa…" : "Escolher imagem ou arrastar até aqui"}</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">Imagem horizontal em PNG, JPG, WEBP ou GIF, até 5 MB.</span>
            </span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGES.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (next) onOpenChange(true); else requestClose(); }}>
        <DialogContent className={cn(dialogShell, "flex max-h-[94dvh] w-[calc(100vw-1rem)] max-w-[760px] flex-col")}>
          <DialogHead
            icon={<GraduationCap className="h-5 w-5" strokeWidth={2.2} />}
            title={isEditing ? "Editar detalhes da área" : "Nova área de membros"}
            subtitle={isEditing ? editCourse?.title : <>Etapa {step} de 3<span className="hidden sm:inline">. {current.helper}</span></>}
          />

          {!isEditing && (
            <ol className="flex items-center gap-2 border-b border-border px-5 py-3.5 sm:px-8" aria-label="Etapas">
              {STEPS.map((s, i) => {
                const done = step > s.n;
                const active = step === s.n;
                return (
                  <li key={s.n} className={cn("flex min-w-0 items-center gap-2", active ? "flex-[2_1_0%] sm:flex-1" : "flex-1")} aria-current={active ? "step" : undefined}>
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold tabular-nums transition-colors",
                        active && "bg-primary text-primary-foreground",
                        done && "bg-accent text-accent-foreground",
                        !active && !done && "bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.n}
                    </span>
                    <span className={cn("truncate text-[14px] font-semibold", active ? "text-foreground" : "hidden text-muted-foreground sm:inline")}>{s.label}</span>
                    {i < STEPS.length - 1 && <span aria-hidden className={cn("ml-1 h-px min-w-3 flex-1", done ? "bg-primary/50" : "bg-border")} />}
                  </li>
                );
              })}
            </ol>
          )}

          <div className="h-[min(560px,calc(94dvh-17rem))] shrink-0 overflow-y-auto px-5 py-6 sm:px-8">
            {isEditing && (
              <div className="space-y-6">
                {infoFields}
                <Notice icon={<Settings2 className="h-[18px] w-[18px]" />} title="Módulos e aulas ficam no editor de conteúdo">
                  <p>Para mudar a ordem, renomear módulos ou subir aulas, abra o editor.</p>
                  <button
                    type="button"
                    onClick={() => { onOpenChange(false); navigate(`/vendas/conteudo/${editCourse?.id}/builder`); }}
                    disabled={busy}
                    className="mt-2.5 text-[14px] font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Abrir editor de conteúdo
                  </button>
                </Notice>
              </div>
            )}

            {!isEditing && step === 1 && infoFields}

            {!isEditing && step === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">Módulos da área</h3>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">Os módulos agrupam as aulas. Você cria as aulas de cada módulo no editor de conteúdo, e dá para mudar tudo depois.</p>
                </div>

                {modules.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-[13.5px] font-semibold text-foreground">Comece por um modelo</p>
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
                      {STARTER_TEMPLATES.map((tpl) => {
                        const Icon = tpl.icon;
                        return (
                          <button
                            key={tpl.name}
                            type="button"
                            onClick={() => applyTemplate(tpl)}
                            className="vp-r16 group flex items-start gap-3 border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:flex-col"
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="h-[18px] w-[18px]" strokeWidth={2} /></span>
                            <span className="min-w-0">
                              <span className="block text-[14.5px] font-bold leading-tight text-foreground">{tpl.name}</span>
                              <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{tpl.description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[13px] text-muted-foreground">Ou adicione os módulos um a um, logo abaixo.</p>
                  </div>
                )}

                {modules.length > 0 && (
                  <ul className="space-y-2" aria-label="Módulos">
                    {modules.map((mod, i) => (
                      <li
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
                        className={cn("vp-r16 flex items-center gap-1.5 border border-border bg-card py-2 pl-2 pr-2 transition-colors hover:border-primary/40 sm:gap-2", draggedIdx === i && "opacity-40")}
                      >
                        <GripVertical aria-hidden className="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60 sm:block" />
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[13px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                        <Input
                          value={mod.title}
                          onChange={(e) => updateModule(mod.id, e.target.value.slice(0, MAX_MODULE_TITLE))}
                          aria-label={`Nome do módulo ${i + 1}`}
                          placeholder={`Módulo ${i + 1}`}
                          className="vp-field !h-10 min-w-0 flex-1 !border-transparent !bg-transparent !px-2 font-semibold focus:!border-primary/60 focus:!bg-background"
                        />
                        <div className="flex shrink-0 items-center">
                          <button type="button" onClick={() => moveModule(i, i - 1)} disabled={i === 0} aria-label={`Subir o módulo ${i + 1}`} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-30">
                            <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                          <button type="button" onClick={() => moveModule(i, i + 1)} disabled={i === modules.length - 1} aria-label={`Descer o módulo ${i + 1}`} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-30">
                            <ArrowDown className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                          <button type="button" onClick={() => removeModule(mod.id)} aria-label={`Remover o módulo ${i + 1}`} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  className="flex gap-2"
                  onSubmit={(e) => { e.preventDefault(); addModule(newModuleName); }}
                >
                  <Input
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value.slice(0, MAX_MODULE_TITLE))}
                    aria-label="Nome do novo módulo"
                    placeholder="Nome do novo módulo, ex.: Fundamentos"
                    autoComplete="off"
                    className="vp-field min-w-0 flex-1"
                  />
                  <button type="submit" disabled={!newModuleName.trim()} className="vp-cta h-12 shrink-0 px-5">
                    <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
                    Adicionar
                  </button>
                </form>
              </div>
            )}

            {!isEditing && step === 3 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-[16px] font-bold tracking-[-0.01em] text-foreground">Confira antes de criar</h3>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">Dá para mudar tudo depois. A área nasce como rascunho e só aparece para os alunos quando você publicar.</p>
                </div>

                <div className="vp-r16 overflow-hidden border border-border bg-card">
                  <div className="space-y-4 p-5">
                    <div className="flex min-w-0 items-start gap-4">
                      {form.thumbnail_url && (
                        <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-[12px] bg-accent sm:w-36">
                          <img src={form.thumbnail_url} alt="Capa da área de membros" className="h-full w-full object-cover" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-heading text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{form.title.trim()}</p>
                        {form.description.trim() && <p className="mt-1.5 break-words text-[14.5px] leading-relaxed text-muted-foreground">{form.description.trim()}</p>}
                      </div>
                    </div>
                    <dl className="grid grid-cols-[minmax(0,1fr)] gap-4 border-t border-border pt-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="text-[13px] text-muted-foreground">Categoria</dt>
                        <dd className="mt-0.5 truncate text-[14.5px] font-semibold text-foreground">{getCategoryLabel(form.category) || "Outros"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[13px] text-muted-foreground">Produto vinculado</dt>
                        <dd className="mt-0.5 truncate text-[14.5px] font-semibold text-foreground">{selectedProduct?.name ?? "Nenhum"}</dd>
                      </div>
                    </dl>
                    <div className="border-t border-border pt-4">
                      <p className="text-[13px] text-muted-foreground">{modules.length === 0 ? "Módulos" : `${modules.length} ${modules.length === 1 ? "módulo" : "módulos"}`}</p>
                      {modules.length === 0 ? (
                        <p className="mt-1 text-[14px] text-muted-foreground">Nenhum por enquanto. Você adiciona no editor de conteúdo.</p>
                      ) : (
                        <ol className="mt-2.5 space-y-1.5">
                          {modules.map((m, i) => (
                            <li key={m.id} className="flex items-center gap-3 rounded-full bg-muted/70 py-1.5 pl-1.5 pr-4">
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-card text-[12.5px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                              <span className="truncate text-[14px] font-semibold text-foreground">{m.title.trim() || `Módulo ${i + 1}`}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                </div>

                {!selectedProduct && (
                  <Notice tone="warn" icon={<Layers className="h-[18px] w-[18px]" />} title="Sem produto vinculado">
                    Sem um produto, a compra não libera acesso à área. Você pode vincular depois, em Editar detalhes.
                  </Notice>
                )}
                {!form.thumbnail_url && (
                  <Notice icon={<ImageIcon className="h-[18px] w-[18px]" />} title="Sem capa">
                    A área aparece com a inicial do nome no lugar da imagem. Dá para enviar a capa depois.
                  </Notice>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-4 sm:px-8">
            <button type="button" onClick={step === 1 || isEditing ? requestClose : goBack} disabled={busy} className="vp-ghost h-11 px-5">
              {step === 1 || isEditing ? "Cancelar" : "Voltar"}
            </button>
            {isEditing || step === 3 ? (
              <button type="button" onClick={saveCourse} disabled={busy || !titleValid} className="vp-cta h-11 px-6">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-[18px] w-[18px]" strokeWidth={2.6} />}
                {saving ? (isEditing ? "Salvando…" : "Criando…") : isEditing ? "Salvar alterações" : "Criar área"}
              </button>
            ) : (
              <button type="button" onClick={goNext} disabled={busy || (step === 1 && !titleValid)} className="vp-cta h-11 px-6">
                Continuar
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent className="max-w-md rounded-[28px] border-border bg-card p-6 sm:p-8">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="font-heading text-[21px] font-extrabold tracking-[-0.03em]">{isEditing ? "Descartar as alterações?" : "Descartar esta área?"}</AlertDialogTitle>
            <AlertDialogDescription className="text-[14.5px] leading-relaxed">
              {isEditing ? "As mudanças que você fez nos detalhes ainda não foram salvas." : "O que você preencheu ainda não foi salvo e vai ser perdido."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel className="vp-ghost m-0 h-11 border-border">Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmDiscard(false); onOpenChange(false); }} className="vp-cta vp-cta-danger h-11">Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
