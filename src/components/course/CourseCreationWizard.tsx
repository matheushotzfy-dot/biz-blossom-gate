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
    <div className="space-y-2.5">
      <Label className="block text-[11px] font-semibold text-muted-foreground/85">Banner / Capa</Label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed border-border/50 bg-background/80 transition-all duration-200 hover:border-primary/35 hover:bg-card/80 hover:shadow-md hover:shadow-primary/5 cursor-pointer",
          value ? "aspect-video" : "flex min-h-[140px] flex-col items-center justify-center px-4 py-8"
        )}
      >
        {value ? (
          <>
            <img src={value} alt="Capa do curso" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/55 opacity-0 transition-opacity hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card text-foreground shadow-sm"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card text-destructive shadow-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary ring-1 ring-primary/15">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </div>
            <p className="text-sm font-medium text-foreground/80">Envie a capa da área de membros</p>
            <p className="mt-1 text-center text-xs text-muted-foreground">Clique ou arraste • 16:9 • até 5MB</p>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-[1280px] flex-col gap-0 overflow-hidden rounded-[1.75rem] border border-border/60 bg-background p-0 shadow-2xl shadow-black/25">
        <div className="flex items-center justify-between border-b border-border/50 bg-card/30 px-6 py-4">
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                {editCourse ? "Editar área de membros" : "Nova área de membros"}
              </h2>
              <p className="text-xs text-muted-foreground/75">Preencha rápido, revise no preview e publique com segurança.</p>
            </div>
          </div>
          <Button
            onClick={saveCourse}
            disabled={saving || !form.title.trim()}
            size="sm"
            className="rounded-2xl px-6 font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
          >
            {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
            {editCourse ? "Salvar" : "Criar curso"}
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[430px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-border/50 bg-background">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6 pb-6">
                <div className="space-y-2.5">
                  <Label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-primary/80">Nome do curso</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                    placeholder="Ex: Escala de Vendas com Conteúdo"
                    className="h-12 rounded-2xl border-primary/30 bg-card/80 text-sm font-medium shadow-[0_0_0_1px_hsl(var(--primary)/0.06)] hover:border-primary/40 focus-visible:border-primary/50 focus-visible:ring-primary/20"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/50 bg-card/30 p-4">
                  <div className="space-y-2">
                    <Label className="block text-[11px] font-semibold text-muted-foreground/85">Categoria</Label>
                    <Input
                      value={form.category}
                      onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                      placeholder="Marketing, saúde..."
                      className="h-10 rounded-xl border-border/60 bg-background text-sm shadow-sm hover:border-primary/25"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="block text-[11px] font-semibold text-muted-foreground/85">Produto</Label>
                    <Select
                      value={form.product_id || "none"}
                      onValueChange={(v) => setForm((c) => ({ ...c, product_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-border/60 bg-background text-sm shadow-sm hover:border-primary/25">
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

                <div className="space-y-2.5 rounded-2xl border border-border/50 bg-card/30 p-4">
                  <Label className="block text-[11px] font-semibold text-muted-foreground/85">Descrição / Promessa</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                    placeholder="O que o aluno vai aprender ou transformar..."
                    className="min-h-[120px] rounded-2xl border-border/60 bg-background text-sm resize-none shadow-sm hover:border-primary/25 focus-visible:border-primary/40"
                  />
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/30 p-4">
                  <ThumbnailUpload
                    value={form.thumbnail_url}
                    onChange={(v) => setForm((c) => ({ ...c, thumbnail_url: v }))}
                  />
                </div>

                <div className="space-y-3 rounded-2xl border border-border/50 bg-card/30 p-4">
                  <Label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary/80">
                    <Layers className="h-3.5 w-3.5" /> Módulos
                  </Label>

                  {editCourse ? (
                    <div className="space-y-2">
                      {(editCourse.modules ?? []).length > 0 ? (
                        (editCourse.modules ?? []).map((m, i) => (
                          <div key={`${m.title}-${i}`} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background px-3 py-3 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{m.title}</p>
                              <p className="text-[11px] text-muted-foreground">{m.lessonsCount ?? 0} aulas</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="py-4 text-center text-xs text-muted-foreground">Nenhum módulo ainda. Crie no studio após salvar.</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Input
                          value={newModuleName}
                          onChange={(e) => setNewModuleName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addModule(newModuleName);
                          }}
                          placeholder="Nome do módulo..."
                          className="h-10 flex-1 rounded-xl border-border/60 bg-background text-sm shadow-sm hover:border-primary/25"
                        />
                        <Button
                          onClick={() => addModule(newModuleName)}
                          disabled={!newModuleName.trim()}
                          size="sm"
                          className="h-10 rounded-xl px-3 shadow-md shadow-primary/20"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {["Boas-vindas", "Fundamentos", "Implementação", "Bônus"].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => addModule(s)}
                            className="rounded-xl border border-border/50 bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all duration-200 hover:border-primary/35 hover:bg-primary/5 hover:text-primary"
                          >
                            + {s}
                          </button>
                        ))}
                      </div>

                      {wizardModules.length > 0 && (
                        <div className="space-y-2">
                          {wizardModules.map((m, i) => (
                            <div key={m} className="flex items-center gap-2.5 rounded-2xl border border-border/50 bg-background px-3 py-3 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span>
                              <span className="flex-1 truncate text-sm font-medium text-foreground">{m}</span>
                              <button
                                type="button"
                                onClick={() => setWizardModules((cur) => cur.filter((x) => x !== m))}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
              </div>
            </div>

            <div className="border-t border-border/50 bg-card/40 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Tudo pronto para criar</p>
                  <p className="text-xs text-muted-foreground">O preview responde em tempo real enquanto você preenche.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl px-4">
                    Fechar
                  </Button>
                  <Button onClick={saveCourse} disabled={saving || !form.title.trim()} className="rounded-xl px-5 shadow-lg shadow-primary/25">
                    {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
                    {editCourse ? "Salvar" : "Criar curso"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto bg-gradient-to-b from-card/70 via-card/40 to-muted/20 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">Preview ao vivo</p>
                <p className="mt-1 text-base font-bold tracking-tight text-foreground">Visão do aluno</p>
                <p className="mt-1 text-xs text-muted-foreground">Mais contraste, leitura instantânea e presença premium.</p>
              </div>
              <div className="flex items-center gap-0.5 rounded-2xl border border-border/50 bg-background/90 p-1 shadow-sm">
                {([
                  { id: "desktop" as const, icon: Monitor },
                  { id: "mobile" as const, icon: Smartphone },
                ] as const).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setViewMode(item.id)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                      viewMode === item.id
                        ? "bg-card text-primary shadow-sm ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-card hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-border/60 bg-background p-3 shadow-[0_24px_60px_-30px_hsl(var(--foreground)/0.45)] ring-1 ring-white/[0.03]">
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
