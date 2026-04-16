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
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Loader2,
  Monitor,
  Palette,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Users,
  X,
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
import {
  WizardEmptyState,
  WizardInfoTile,
  WizardMiniStat,
  WizardPanel,
  WizardPanelHeader,
  WizardStepButton,
} from "@/components/course/course-creation-wizard/WizardPrimitives";

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
  { id: "experience", label: "Hero", caption: "Promessa e imagem principal", icon: Palette },
  { id: "curriculum", label: "Trilha", caption: "Módulos que organizam a jornada", icon: Layers },
  { id: "launch", label: "Launch", caption: "Resumo final e próximo passo", icon: CheckCircle2 },
];

const MODULE_SUGGESTIONS = ["Boas-vindas", "Fundamentos", "Implementação", "Escala", "Bônus"];

const STEP_GUIDANCE: Record<StepId, string[]> = {
  identity: [
    "Defina um nome claro e memorável para o curso.",
    "Use a categoria para organizar a leitura do catálogo.",
    "Vincule um produto quando quiser conectar venda e entrega.",
  ],
  experience: [
    "A promessa precisa explicar o ganho real do aluno.",
    "A capa principal segura a primeira impressão da área.",
    "Banner e copy aparecem juntos no hero e nos destaques.",
  ],
  curriculum: [
    "Comece pela entrada: onboarding, visão geral ou boas-vindas.",
    "Agrupe aulas por bloco lógico para evitar catálogo confuso.",
    "Deixe de 3 a 5 módulos na primeira versão para manter clareza.",
  ],
  launch: [
    "Revise a leitura completa antes de salvar.",
    "Depois do save, continue no studio para criar aulas e anexos.",
    "A visão lateral já representa como o aluno percebe o produto.",
  ],
};

const formatCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "AM";
  return words.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

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
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</Label>
          <p className="mt-1 text-xs font-display leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        {value ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-xl px-3 font-display font-bold"
            onClick={(event) => {
              event.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Trocar
          </Button>
        ) : null}
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
          "overflow-hidden rounded-[1.5rem] border border-border bg-card transition-colors",
          value ? "cursor-pointer hover:border-primary/20" : "cursor-pointer hover:border-primary/25 hover:bg-background",
        )}
      >
        {value ? (
          <div className="relative aspect-[16/9]">
            <img src={value} alt="Banner do curso" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-display font-black text-foreground">Banner principal definido</p>
                <p className="mt-1 text-xs font-display text-muted-foreground">Essa imagem já alimenta o hero e os trilhos do preview.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl px-3 font-display font-bold"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange("");
                }}
              >
                <X className="mr-1 h-4 w-4" /> Remover
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex aspect-[16/9] flex-col items-center justify-center px-6 py-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 text-primary">
              {uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
            </div>
            <p className="text-sm font-display font-black text-foreground">Suba a capa principal da área de membros</p>
            <p className="mt-1 max-w-sm text-xs font-display leading-relaxed text-muted-foreground">
              Use uma imagem 16:9 forte, com leitura limpa, para sustentar a primeira impressão do aluno.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card px-3 py-3">
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Formato ideal</p>
          <p className="mt-1 text-sm font-display text-foreground">16:9 · JPG, PNG, WEBP ou GIF</p>
        </div>
        <div className="rounded-2xl border border-border bg-card px-3 py-3">
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Peso máximo</p>
          <p className="mt-1 text-sm font-display text-foreground">Até 5MB para upload estável</p>
        </div>
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
  const moduleCount = editCourse?.modules?.length ?? wizardModules.length;
  const previewTitle = form.title.trim() || "Sua área premium";
  const previewInitials = getInitials(previewTitle);

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
    { label: "Trilha", done: moduleCount > 0 },
  ];

  const completionPct = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);
  const totalPreviewLessons = previewModules.reduce(
    (sum, module) => sum + (module.lessonCount ?? module.lessons?.length ?? 0),
    0,
  );
  const canContinue = step !== "identity" || form.title.trim().length > 0;

  const addModule = (title: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setWizardModules((current) => {
      if (current.some((item) => item.toLowerCase() === cleanTitle.toLowerCase())) return current;
      return [...current, cleanTitle];
    });
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

  const previewSurface = (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-primary">Preview ao vivo</p>
          <p className="mt-1 text-lg font-display font-black tracking-[-0.03em] text-foreground">Visão real do aluno</p>
          <p className="mt-1 text-xs font-display leading-relaxed text-muted-foreground">
            O preview responde imediatamente ao que você preencher em cada etapa.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
          {[
            { id: "desktop" as const, icon: Monitor },
            { id: "mobile" as const, icon: Smartphone },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setViewMode(item.id)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                viewMode === item.id ? "bg-background text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border bg-card p-3">
        <MemberExperiencePreview
          className="mx-auto"
          course={{
            title: previewTitle,
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

      <div className="grid grid-cols-2 gap-2">
        <WizardMiniStat label="Rails" value={String(previewModules.length)} accent="info" />
        <WizardMiniStat label="Aulas" value={String(totalPreviewLessons)} accent="warning" />
        <WizardMiniStat label="Hero" value={form.thumbnail_url ? "Pronto" : "Falta"} accent={form.thumbnail_url ? "success" : "warning"} />
        <WizardMiniStat label="Setup" value={`${completionPct}%`} accent="primary" />
      </div>

      <div className="rounded-[1.5rem] border border-border bg-card p-4">
        <p className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Leitura desta etapa</p>
        <div className="mt-3 space-y-2">
          {STEP_GUIDANCE[step].map((note) => (
            <div key={note} className="flex items-start gap-2 rounded-2xl border border-border bg-background px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <p className="text-xs font-display leading-relaxed text-foreground">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderIdentityStep = () => (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_340px]">
      <WizardPanel className="p-5 sm:p-6">
        <WizardPanelHeader
          icon={Type}
          title="Base do curso"
          description="Defina a assinatura principal da área de membros: nome, categoria e vínculo comercial."
          accent="primary"
        />

        <div className="space-y-4">
          <div>
            <Label className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Nome do curso</Label>
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ex: Escala de Vendas com Conteúdo"
              className="mt-2 h-12 rounded-2xl border-border bg-background font-display text-base"
              autoFocus
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Categoria</Label>
              <Input
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                placeholder="Marketing, gestão, saúde..."
                className="mt-2 h-11 rounded-2xl border-border bg-background font-display"
              />
            </div>
            <div>
              <Label className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Produto vinculado</Label>
              <Select
                value={form.product_id || "none"}
                onValueChange={(value) => setForm((current) => ({ ...current, product_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger className="mt-2 h-11 rounded-2xl border-border bg-background font-display">
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

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.25rem] border border-border bg-card p-4">
              <p className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Assinatura visual</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-sm font-display font-black tracking-[0.12em] text-primary">
                  {previewInitials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-display font-black tracking-[-0.02em] text-foreground">{previewTitle}</p>
                  <p className="mt-1 truncate text-xs font-display text-muted-foreground">
                    {(form.category || "geral").trim() || "geral"} • {linkedProduct?.name ?? "Sem produto vinculado"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border bg-card p-4">
              <p className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Leitura do seller</p>
              <p className="mt-3 text-sm font-display leading-relaxed text-foreground">
                {form.title.trim()
                  ? "O curso já tem identidade clara e está pronto para receber hero, trilhos e posicionamento final."
                  : "Comece pelo nome. Ele é a âncora do catálogo, do hero e da percepção de valor do aluno."}
              </p>
            </div>
          </div>
        </div>
      </WizardPanel>

      <div className="space-y-5">
        <WizardPanel className="p-5">
          <WizardPanelHeader
            icon={Sparkles}
            title="Cara de produto"
            description="Nada de visual genérico: o setup já organiza a leitura comercial e a navegação do aluno."
            accent="info"
          />

          <div className="space-y-3">
            <WizardInfoTile
              icon={Sparkles}
              title="Marca instantânea"
              description="O monograma e o nome aparecem nos pontos mais nobres da experiência."
              accent="primary"
            />
            <WizardInfoTile
              icon={Users}
              title="Leitura imediata"
              description="Categoria e vínculo comercial evitam uma home sem contexto ou cara de sistema cru."
              accent="info"
            />
            <WizardInfoTile
              icon={BookOpen}
              title="Base pronta para retenção"
              description="Com a identidade resolvida, hero e trilhos entram com muito mais força visual."
              accent="warning"
            />
          </div>
        </WizardPanel>

        <div className="grid grid-cols-2 gap-2">
          <WizardMiniStat label="Produto" value={linkedProduct ? "Vinculado" : "Livre"} accent="primary" />
          <WizardMiniStat label="Categoria" value={(form.category || "geral").trim() || "geral"} accent="info" />
        </div>
      </div>
    </div>
  );

  const renderExperienceStep = () => (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <WizardPanel className="p-5 sm:p-6">
        <WizardPanelHeader
          icon={Palette}
          title="Promessa e copy"
          description="Aqui você define a mensagem principal que sustenta o hero e valoriza a percepção do aluno."
          accent="primary"
        />

        <div>
          <Label className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Promessa do curso</Label>
          <Textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Explique o que o aluno vai dominar, transformar ou alcançar depois de entrar nessa área."
            className="mt-2 min-h-[240px] rounded-[1.5rem] border-border bg-background font-display"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <WizardInfoTile
            icon={CheckCircle2}
            title="Promessa clara"
            description="Fale de resultado percebido, não de descrição vaga ou institucional."
            accent="success"
          />
          <WizardInfoTile
            icon={Users}
            title="Leitura objetiva"
            description="Em poucas linhas, o aluno precisa entender por que vale continuar assistindo."
            accent="info"
          />
        </div>
      </WizardPanel>

      <WizardPanel className="p-5 sm:p-6">
        <WizardPanelHeader
          icon={ImageIcon}
          title="Banner principal"
          description="A capa hero é o momento mais importante da vitrine. Ela aparece no topo e nos pontos de destaque."
          accent="warning"
        />

        <ImageUploadField
          label="Imagem do hero"
          hint="Use uma capa forte, com boa composição e pouco ruído visual para manter a leitura elegante."
          value={form.thumbnail_url}
          onChange={(value) => setForm((current) => ({ ...current, thumbnail_url: value }))}
        />
      </WizardPanel>
    </div>
  );

  const renderCurriculumStep = () => (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <WizardPanel className="p-5 sm:p-6">
        <WizardPanelHeader
          icon={Layers}
          title="Estrutura da trilha"
          description="Organize os módulos em uma sequência lógica para o catálogo nascer com leitura profissional."
          accent="primary"
        />

        {editCourse ? (
          <div className="space-y-3">
            {(editCourse.modules ?? []).length > 0 ? (
              (editCourse.modules ?? []).map((module, index) => (
                <div key={`${module.title}-${index}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-sm font-display font-black text-primary">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-display font-black text-foreground">{module.title}</p>
                    <p className="mt-1 text-xs font-display text-muted-foreground">
                      {module.lessonsCount ?? 0} aula{(module.lessonsCount ?? 0) !== 1 ? "s" : ""} configuradas
                    </p>
                  </div>
                  <span className="rounded-full border border-info/20 bg-info/10 px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-info">
                    studio
                  </span>
                </div>
              ))
            ) : (
              <WizardEmptyState
                icon={Layers}
                title="Esse curso ainda não tem módulos"
                description="Salve e continue no studio para começar a estruturar a trilha completa."
              />
            )}

            <div className="rounded-2xl border border-info/20 bg-info/10 px-4 py-4">
              <p className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-info">Modo edição</p>
              <p className="mt-2 text-sm font-display leading-relaxed text-foreground">
                O wizard ajuda no posicionamento visual; o studio continua sendo o lugar de montar aulas, ordem fina e materiais.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={newModuleName}
                onChange={(event) => setNewModuleName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addModule(newModuleName);
                }}
                placeholder="Ex: Fundamentos, método principal, aplicação prática..."
                className="h-12 rounded-2xl border-border bg-background font-display"
              />
              <Button
                onClick={() => addModule(newModuleName)}
                disabled={!newModuleName.trim()}
                className="h-12 rounded-2xl px-5 font-display font-bold"
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar módulo
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {MODULE_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addModule(suggestion)}
                  className="rounded-full border border-border bg-card px-3 py-2 text-[11px] font-display font-bold text-foreground transition-colors hover:border-primary/20 hover:text-primary"
                >
                  + {suggestion}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {wizardModules.length > 0 ? (
                wizardModules.map((module, index) => (
                  <div key={module} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-sm font-display font-black text-primary">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-display font-black text-foreground">{module}</p>
                      <p className="mt-1 text-xs font-display text-muted-foreground">Esse rail já entra na leitura do preview lateral.</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeModule(module)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <WizardEmptyState
                  icon={Layers}
                  title="Nenhum módulo criado ainda"
                  description="Adicione os primeiros blocos para o catálogo nascer com clareza e hierarquia visual."
                />
              )}
            </div>
          </>
        )}
      </WizardPanel>

      <div className="space-y-5">
        <WizardPanel className="p-5">
          <WizardPanelHeader
            icon={BookOpen}
            title="Leitura do catálogo"
            description="O aluno não enxerga módulos soltos: ele percebe uma trilha organizada, clara e pronta para continuar."
            accent="warning"
          />

          <div className="space-y-3">
            {previewModules.length > 0 ? (
              previewModules.slice(0, 4).map((module, index) => (
                <div key={module.id} className="rounded-2xl border border-border bg-card p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-warning/20 bg-warning/10 text-sm font-display font-black text-warning">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-display font-black text-foreground">{module.title}</p>
                      <p className="mt-1 text-xs font-display text-muted-foreground">
                        {module.lessonCount ?? module.lessons?.length ?? 0} aulas visíveis nesse rail
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <WizardEmptyState
                icon={BookOpen}
                title="A trilha visual aparece aqui"
                description="Os módulos adicionados entram imediatamente na leitura do catálogo do aluno."
              />
            )}
          </div>
        </WizardPanel>

        <WizardPanel className="p-5">
          <WizardPanelHeader
            icon={Users}
            title="Regra prática"
            description="Um bom catálogo prioriza clareza, sequência lógica e entrada forte."
            accent="info"
          />

          <div className="space-y-2">
            {[
              "Abra com boas-vindas, onboarding ou visão geral.",
              "Agrupe os conteúdos por assunto, e não por ordem aleatória.",
              "Se estiver começando, entregue poucos rails, mas bem organizados.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-xs font-display leading-relaxed text-foreground">{item}</p>
              </div>
            ))}
          </div>
        </WizardPanel>
      </div>
    </div>
  );

  const renderLaunchStep = () => (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <WizardPanel className="p-5 sm:p-6">
        <WizardPanelHeader
          icon={CheckCircle2}
          title="Resumo final da experiência"
          description="Revise a leitura comercial e visual antes de salvar o curso e seguir para o studio."
          accent="success"
        />

        <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card">
          <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="border-b border-border bg-background md:border-b-0 md:border-r">
              <div className="aspect-[4/3] h-full w-full overflow-hidden">
                {form.thumbnail_url ? (
                  <img src={form.thumbnail_url} alt={previewTitle} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-card">
                    <GraduationCap className="h-10 w-10 text-primary/30" />
                  </div>
                )}
              </div>
            </div>

            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-primary">
                  {(form.category || "geral").trim() || "geral"}
                </span>
                {linkedProduct ? (
                  <span className="rounded-full border border-info/20 bg-info/10 px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-info">
                    {linkedProduct.name}
                  </span>
                ) : null}
                <span className="rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-warning">
                  {previewModules.length} trilho{previewModules.length !== 1 ? "s" : ""}
                </span>
              </div>

              <h3 className="mt-4 text-[22px] font-display font-black tracking-[-0.04em] text-foreground">{previewTitle}</h3>
              <p className="mt-2 text-sm font-display leading-relaxed text-muted-foreground">
                {form.description || "Inclua uma promessa forte para aumentar retenção e valor percebido do conteúdo."}
              </p>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <WizardMiniStat label="Módulos" value={String(previewModules.length)} accent="info" />
                <WizardMiniStat label="Aulas" value={String(totalPreviewLessons)} accent="warning" />
                <WizardMiniStat label="Setup" value={`${completionPct}%`} accent="success" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Hero, copy e trilhos já aparecem juntos no preview.",
            editCourse ? "Depois de salvar, continue refinando tudo direto no studio." : "Depois de criar, você entra direto no studio para montar aulas e anexos.",
            "A visão lateral já representa desktop e mobile.",
            "A estrutura nasce organizada, sem sensação de dashboard improvisado.",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-border bg-card px-4 py-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-sm font-display leading-relaxed text-foreground">{item}</p>
              </div>
            </div>
          ))}
        </div>
      </WizardPanel>

      <WizardPanel className="p-5 sm:p-6">
        <WizardPanelHeader
          icon={Sparkles}
          title="Próximo clique"
          description="O objetivo aqui é sair do setup com uma base forte e continuar o acabamento dentro do studio."
          accent="primary"
        />

        <div className="space-y-3">
          {[
            {
              title: editCourse ? "Salvar ajustes visuais" : "Criar o curso",
              description: editCourse
                ? "Grava posicionamento, capa e identidade atualizados."
                : "Cria o curso com a base inicial e a trilha configurada aqui.",
            },
            {
              title: "Entrar no studio",
              description: "Continue com módulos, aulas, anexos, ordem fina e publicação completa.",
            },
            {
              title: "Entregar uma experiência premium",
              description: "O aluno recebe uma área com hero forte, continuidade visual e estrutura clara desde o primeiro acesso.",
            },
          ].map((item, index) => (
            <div key={item.title} className="rounded-2xl border border-border bg-card px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-sm font-display font-black text-primary">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-display font-black tracking-[-0.02em] text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs font-display leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4">
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-primary">Seller flow</p>
          <p className="mt-2 text-sm font-display leading-relaxed text-foreground">
            {editCourse
              ? "Salvar agora para consolidar a nova leitura visual e seguir refinando a entrega."
              : "Criar agora para abrir o studio e finalizar o conteúdo com a mesma base visual do preview."}
          </p>
        </div>
      </WizardPanel>
    </div>
  );

  const renderStepContent = () => {
    switch (step) {
      case "identity":
        return renderIdentityStep();
      case "experience":
        return renderExperienceStep();
      case "curriculum":
        return renderCurriculumStep();
      case "launch":
        return renderLaunchStep();
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[1400px] gap-0 overflow-hidden rounded-[1.5rem] border border-border bg-card p-0 shadow-none">
        <div className="border-b border-border bg-background px-6 py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 text-primary">
                {editCourse ? <BookOpen className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-[11px] font-display font-bold uppercase tracking-[0.18em] text-primary">Member Area Studio</p>
                <h2 className="mt-1 text-[32px] font-display font-black tracking-[-0.05em] text-foreground">
                  {editCourse ? "Refinar a área de membros" : "Criar uma área de membros premium"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm font-display leading-relaxed text-muted-foreground">
                  Estruture identidade, hero, trilhos e leitura final do aluno em um fluxo muito mais sólido e claro — sem visual lavado ou confuso.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 xl:min-w-[420px] xl:grid-cols-4">
              <WizardMiniStat label="Etapa" value={`${stepIndex + 1}/${STEP_CONFIG.length}`} accent="primary" />
              <WizardMiniStat label="Conclusão" value={`${completionPct}%`} accent="success" />
              <WizardMiniStat label="Rails" value={String(previewModules.length)} accent="info" />
              <WizardMiniStat label="Hero" value={form.thumbnail_url ? "On" : "Off"} accent={form.thumbnail_url ? "success" : "warning"} />
            </div>
          </div>
        </div>

        <div className="grid min-h-[680px] lg:grid-cols-[240px_minmax(0,1fr)_390px]">
          <aside className="border-r border-border bg-background px-4 py-5">
            <div className="space-y-2">
              {STEP_CONFIG.map((item, index) => {
                const active = item.id === step;
                const done = index < stepIndex;

                return (
                  <WizardStepButton
                    key={item.id}
                    index={index}
                    label={item.label}
                    caption={item.caption}
                    icon={item.icon}
                    active={active}
                    done={done}
                    onClick={() => {
                      if (done || active) setStep(item.id);
                    }}
                  />
                );
              })}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-border bg-card p-4">
              <p className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted-foreground">Checklist do setup</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${completionPct}%` }} />
              </div>
              <div className="mt-4 space-y-2">
                {checklist.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-border bg-background px-3 py-2.5">
                    <span className="text-xs font-display font-bold text-foreground">{item.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-[0.14em]",
                        item.done ? "bg-success/10 text-success" : "bg-card text-muted-foreground",
                      )}
                    >
                      {item.done ? "ok" : "pendente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="overflow-y-auto bg-card px-6 py-6">
            <div className="mx-auto max-w-4xl space-y-5">
              {renderStepContent()}
              <div className="lg:hidden">{previewSurface}</div>
            </div>
          </div>

          <aside className="hidden border-l border-border bg-background px-5 py-5 lg:block">{previewSurface}</aside>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-background px-6 py-4">
          <div>
            {stepIndex > 0 ? (
              <Button variant="outline" onClick={previousStep} className="rounded-2xl px-4 font-display font-bold">
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {step !== "launch" ? (
              <Button onClick={nextStep} disabled={!canContinue} className="rounded-2xl px-6 font-display font-bold">
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={saveCourse} disabled={saving || !form.title.trim()} className="rounded-2xl px-6 font-display font-bold">
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
