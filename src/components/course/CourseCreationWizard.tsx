import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Check,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  Loader2,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
  Upload,
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

const STARTER_MODULES = [
  { title: "Boas-vindas", subtitle: "Primeira impressão e acesso imediato" },
  { title: "Fundamentos", subtitle: "Base para preparar o aluno" },
  { title: "Implementação", subtitle: "Parte prática e aplicação" },
  { title: "Bônus", subtitle: "Materiais extras e retenção" },
] as const;

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

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  step,
  children,
}: {
  icon: typeof GraduationCap;
  title: string;
  subtitle: string;
  step?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3.5">
      <div className="flex items-start gap-3">
        {step !== undefined ? (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-[11px] font-bold text-primary">
            {step}
          </div>
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-[13px] font-bold tracking-tight text-foreground">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="pl-10">{children}</div>
    </section>
  );
}

function ThumbnailUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
    } catch {
      toast.error("Erro no upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Banner / Capa</Label>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
          16:9 recomendado
        </span>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-[1.4rem] border border-border bg-card-inset transition-all duration-200 hover:border-primary/35 hover:bg-card",
          value ? "aspect-video" : "flex min-h-[220px] flex-col items-center justify-center px-5 py-10"
        )}
      >
        {value ? (
          <>
            <img src={value} alt="Capa do curso" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Capa aplicada</p>
                <p className="mt-1 text-xs text-muted-foreground">Troque ou remova para testar novas identidades.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:border-primary/25"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-destructive hover:border-destructive/25"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              {uploading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Upload className="h-4.5 w-4.5" />}
            </div>
            <p className="text-base font-bold text-foreground">Envie a identidade visual do curso</p>
            <p className="mt-2 max-w-[19rem] text-center text-xs leading-relaxed text-muted-foreground">
              A capa define a primeira impressão do aluno e deixa o preview com cara de produto real.
            </p>
            <div className="mt-4 rounded-full border border-border bg-background px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              Clique ou arraste a imagem
            </div>
          </>
        )}
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

  const addModule = (title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setWizardModules((cur) => {
      if (cur.some((m) => m.toLowerCase() === clean.toLowerCase())) return cur;
      return [...cur, clean];
    });
    setNewModuleName("");
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
      if (error || !data) throw error ?? new Error("Falha ao criar.");

      if (wizardModules.length > 0) {
        const { error: modErr } = await supabase.from("modules").insert(
          wizardModules.map((title, i) => ({ course_id: data.id, title, sort_order: i }))
        );
        if (modErr) throw modErr;
      }

      toast.success("Curso criado!");
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

  // Completion progress (drives left column hierarchy + footer/header confidence)
  const completion = useMemo(() => {
    const checks = [
      Boolean(form.title.trim()),
      Boolean(form.description.trim()),
      Boolean(form.thumbnail_url),
      Boolean(form.product_id),
      (editCourse?.modules?.length ?? wizardModules.length) > 0,
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
  }, [form, wizardModules, editCourse?.modules]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-[1380px] flex-col gap-0 overflow-hidden rounded-[2rem] border border-border bg-card p-0">
        <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4">
          <div className="flex min-w-0 items-center gap-3 pr-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <GraduationCap className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  {editCourse ? "Editar área de membros" : "Nova área de membros"}
                </h2>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Setup guiado
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Preencha o essencial à esquerda e acompanhe uma prévia real da experiência do aluno.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Completion progress */}
            <div className="hidden md:flex items-center gap-2.5">
              <div className="text-right leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Progresso</p>
                <p className="text-xs font-bold text-foreground tabular-nums">{completion.done}/{completion.total} <span className="text-muted-foreground font-medium">· {completion.pct}%</span></p>
              </div>
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${completion.pct}%` }}
                />
              </div>
            </div>

            <Button
              onClick={saveCourse}
              disabled={saving || !form.title.trim()}
              className="rounded-2xl px-7 h-11 text-sm font-bold shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.45)] hover:shadow-[0_6px_24px_-4px_hsl(var(--primary)/0.55)]"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {editCourse ? "Salvar alterações" : "Criar área de membros"}
            </Button>
          </div>
        </div>


        <div className="grid min-h-0 flex-1 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-border bg-background">

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-7 pb-6">
                <SectionCard
                  icon={GraduationCap}
                  step={1}
                  title="Base do curso"
                  subtitle="Nome, categoria e vínculo com produto para dar contexto imediato ao aluno."
                >
                  <div className="space-y-4">
                    <div className="space-y-2.5">
                      <Label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Nome do curso</Label>
                      <Input
                        value={form.title}
                        onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                        placeholder="Ex: Escala de Vendas com Conteúdo"
                        className="h-13 rounded-2xl border-primary/25 bg-background text-sm font-semibold hover:border-primary/45 focus-visible:border-primary/45"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Categoria</Label>
                        <Select
                          value={form.category}
                          onValueChange={(v) => setForm((c) => ({ ...c, category: v }))}
                        >
                          <SelectTrigger className="h-11 rounded-xl border-border bg-background text-sm font-medium hover:border-primary/25">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {COURSE_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Produto</Label>
                        <Select
                          value={form.product_id || "none"}
                          onValueChange={(v) => setForm((c) => ({ ...c, product_id: v === "none" ? "" : v }))}
                        >
                          <SelectTrigger className="h-11 rounded-xl border-border bg-background text-sm font-medium hover:border-primary/25">
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} — {formatCurrency(p.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <Label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Descrição / Promessa</Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                        placeholder="O que o aluno vai aprender ou transformar?"
                        className="min-h-[132px] rounded-2xl border-border bg-background text-sm resize-none font-medium hover:border-primary/25 focus-visible:border-primary/35"
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={ImageIcon}
                  step={2}
                  title="Identidade visual"
                  subtitle="A capa transforma o preview de genérico para produto real e aumenta a percepção premium."
                >
                  <ThumbnailUpload
                    value={form.thumbnail_url}
                    onChange={(v) => setForm((c) => ({ ...c, thumbnail_url: v }))}
                  />
                </SectionCard>

                <SectionCard
                  icon={Layers}
                  step={3}
                  title="Estrutura de módulos"
                  subtitle="Adicione rapidamente a espinha dorsal da jornada para o aluno já entender a trilha."
                >
                  <div className="space-y-4">
                    {editCourse ? (
                      <div className="space-y-2.5">
                        {(editCourse.modules ?? []).length > 0 ? (
                          (editCourse.modules ?? []).map((m, i) => (
                            <div key={`${m.title}-${i}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card-inset px-3.5 py-3.5 hover:border-primary/20">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{m.title}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{m.lessonsCount ?? 0} aulas</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-2xl border border-dashed border-border bg-card-inset px-4 py-5 text-center text-xs text-muted-foreground">Nenhum módulo ainda. Crie no studio após salvar.</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="rounded-[1.35rem] border border-border bg-card-inset p-3">
                          <div className="flex gap-2">
                            <Input
                              value={newModuleName}
                              onChange={(e) => setNewModuleName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") addModule(newModuleName);
                              }}
                              placeholder="Nome do módulo..."
                              className="h-11 flex-1 rounded-xl border-border bg-background text-sm font-medium hover:border-primary/25"
                            />
                            <Button
                              onClick={() => addModule(newModuleName)}
                              disabled={!newModuleName.trim()}
                              size="sm"
                              className="h-11 rounded-xl px-4"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {STARTER_MODULES.map((item) => (
                            <button
                              key={item.title}
                              type="button"
                              onClick={() => addModule(item.title)}
                              className="rounded-[1.25rem] border border-border bg-card-inset px-3.5 py-3.5 text-left hover:border-primary/35 hover:bg-card"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.subtitle}</p>
                                </div>
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                                  <Plus className="h-3.5 w-3.5" />
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>

                        {wizardModules.length > 0 && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sequência montada</p>
                              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-primary">
                                {wizardModules.length} módulos
                              </span>
                            </div>

                            {wizardModules.map((m, i) => (
                              <div key={m} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3.5 hover:border-primary/20">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                                <span className="flex-1 truncate text-sm font-semibold text-foreground">{m}</span>
                                <button
                                  type="button"
                                  onClick={() => setWizardModules((cur) => cur.filter((x) => x !== m))}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-muted-foreground hover:border-destructive/15 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </SectionCard>
              </div>
            </div>

            <div className="border-t border-border bg-card px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">Tudo pronto para criar</p>
                  <p className="mt-1 text-xs text-muted-foreground">Você ajusta à esquerda e acompanha o impacto visual na hora.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl px-4">
                    Fechar
                  </Button>
                  <Button onClick={saveCourse} disabled={saving || !form.title.trim()} className="rounded-xl px-5 font-bold">
                    {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
                    {editCourse ? "Salvar" : "Criar curso"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto border-l border-border bg-card-inset p-6">
            <div className="mb-5 rounded-[1.5rem] border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Preview ao vivo</p>
                  <p className="mt-1 text-xl font-bold tracking-tight text-foreground">Visão do aluno</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Uma prévia com mais presença, leitura e cara de produto final.</p>
                </div>
                <div className="flex items-center gap-1 rounded-2xl border border-border bg-card-inset p-1">
                  {([
                    { id: "desktop" as const, icon: Monitor },
                    { id: "mobile" as const, icon: Smartphone },
                  ] as const).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setViewMode(item.id)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200",
                        viewMode === item.id
                          ? "border-primary/20 bg-card text-primary"
                          : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-border bg-card-inset px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Curso</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{previewTitle}</p>
                </div>
                <div className="rounded-xl border border-border bg-card-inset px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Produto</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{linkedProduct?.name || "Sem vínculo"}</p>
                </div>
                <div className="rounded-xl border border-border bg-card-inset px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Módulos</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{previewModules.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-border bg-background p-4">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
