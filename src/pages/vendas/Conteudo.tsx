import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, BookOpen, Layers, PlayCircle, Trash2, Edit, Eye, EyeOff,
  Link as LinkIcon, Search, Users, ChevronDown, ChevronUp, Upload,
  Image as ImageIcon, Video, GripVertical, X, Clock, ArrowLeft,
  Sparkles, Package, FileText, Check, TrendingUp, ShoppingCart, DollarSign, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PageShell, Panel, GlowPanel, PageTitle, EmptyState } from "@/components/PageShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────
interface Course {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  product_id: string | null;
  is_published: boolean;
  sort_order: number | null;
  user_id: string;
  created_at: string;
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  sort_order: number | null;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  is_free: boolean;
  sort_order: number | null;
}

interface Product {
  id: string;
  name: string;
}

// ─── Wizard Steps ─────────────────────────────────────────────────
type WizardStep = "info" | "structure";

// ─── Image Upload Helper ──────────────────────────────────────────
function ImageUploadZone({ value, onChange, label, aspect = "16:9" }: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Apenas imagens"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `content/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error("Erro no upload"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    onChange(urlData.publicUrl);
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-semibold text-foreground">{label}</Label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className={`relative rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 transition-all cursor-pointer overflow-hidden group ${value ? "p-0" : "p-8"}`}
        style={{ aspectRatio: aspect === "2:3" ? "2/3" : "16/9", maxHeight: aspect === "2:3" ? 280 : 200 }}
      >
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-[12px] font-semibold">Trocar imagem</span>
            </div>
            <button onClick={e => { e.stopPropagation(); onChange(""); }} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-12 w-12 rounded-xl bg-muted/40 flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-[12px] text-center">
              {uploading ? "Enviando..." : "Arraste uma imagem ou clique para selecionar"}
            </p>
            <Button type="button" variant="outline" size="sm" className="rounded-xl text-[11px] gap-1.5 mt-1" disabled={uploading}>
              <Upload className="h-3 w-3" /> Selecionar Arquivo
            </Button>
            <p className="text-[10px] text-muted-foreground/50">PNG, JPG, GIF até 5MB</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ─── Duration options ─────────────────────────────────────────────
const DURATION_OPTIONS = [
  { value: "0", label: "Selecionar duração" },
  { value: "5", label: "5 minutos" },
  { value: "10", label: "10 minutos" },
  { value: "15", label: "15 minutos" },
  { value: "20", label: "20 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "45", label: "45 minutos" },
  { value: "60", label: "1 hora" },
  { value: "90", label: "1h 30min" },
  { value: "120", label: "2 horas" },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function AdminConteudo() {
  const { user } = useAuth();

  // ── Data state ──
  const [courses, setCourses] = useState<Course[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState<{ product_id: string | null; status: string; amount: number }[]>([]);
  const [courseStats, setCourseStats] = useState<Record<string, { modules: number; lessons: number }>>({});

  // ── Wizard state ──
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("info");
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({
    title: "", description: "", category: "geral", product_id: "", thumbnail_url: ""
  });

  // ── Course editor state ──
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // ── Module dialog ──
  const [moduleDialog, setModuleDialog] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: "", banner_url: "" });

  // ── Lesson sheet ──
  const [lessonSheet, setLessonSheet] = useState(false);
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null);
  const [editLessonId, setEditLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: "", description: "", video_url: "", duration_minutes: "0", is_free: false
  });

  const loadModules = useCallback(async (courseId: string) => {
    const { data: mods } = await supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order");
    if (!mods) return;
    const moduleIds = mods.map(m => m.id);
    let lessons: Lesson[] = [];
    if (moduleIds.length > 0) {
      const { data: l } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");
      if (l) lessons = l as Lesson[];
    }
    setModules(mods.map(m => ({ ...m, lessons: lessons.filter(l => l.module_id === m.id) })) as Module[]);
  }, []);

  useEffect(() => { if (selectedCourse) loadModules(selectedCourse); }, [selectedCourse, loadModules]);

  // ── Course stats ──
  const getCourseStats = (courseId: string) => {
    if (selectedCourse === courseId && modules.length > 0) {
      const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);
      return { modules: modules.length, lessons: totalLessons };
    }
    return { modules: 0, lessons: 0 };
  };

  // ── Course CRUD ──
  const openWizardNew = () => {
    setEditCourseId(null);
    setCourseForm({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" });
    setWizardStep("info");
    setWizardOpen(true);
  };

  const openWizardEdit = (c: Course) => {
    setEditCourseId(c.id);
    setCourseForm({
      title: c.title,
      description: c.description || "",
      category: c.category || "geral",
      product_id: c.product_id || "",
      thumbnail_url: c.thumbnail_url || ""
    });
    setWizardStep("info");
    setWizardOpen(true);
  };

  const saveCourse = async () => {
    if (!user || !courseForm.title.trim()) { toast.error("Preencha o título"); return; }
    const payload = {
      title: courseForm.title,
      description: courseForm.description || null,
      category: courseForm.category || "geral",
      product_id: courseForm.product_id && courseForm.product_id !== "none" ? courseForm.product_id : null,
      thumbnail_url: courseForm.thumbnail_url || null,
      user_id: user.id,
      is_published: false
    };
    if (editCourseId) {
      const { user_id, is_published, ...updatePayload } = payload;
      await supabase.from("courses").update(updatePayload).eq("id", editCourseId);
      toast.success("Curso atualizado!");
    } else {
      const { data } = await supabase.from("courses").insert(payload).select().single();
      if (data) {
        setSelectedCourse(data.id);
        setEditCourseId(data.id);
      }
      toast.success("Curso criado!");
    }
    loadCourses();
    setWizardStep("structure");
  };

  const togglePublish = async (id: string, cur: boolean) => {
    await supabase.from("courses").update({ is_published: !cur }).eq("id", id);
    loadCourses();
    toast.success(cur ? "Despublicado" : "Publicado!");
  };

  const deleteCourse = async (id: string) => {
    // Must cascade: lessons → modules → user_access → course (FK constraints)
    const { data: courseModules } = await supabase.from("modules").select("id").eq("course_id", id);
    if (courseModules && courseModules.length > 0) {
      const moduleIds = courseModules.map(m => m.id);
      await supabase.from("lessons").delete().in("module_id", moduleIds);
      await supabase.from("modules").delete().eq("course_id", id);
    }
    await supabase.from("user_access").delete().eq("course_id", id);
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir curso"); return; }
    if (selectedCourse === id) { setSelectedCourse(null); setModules([]); }
    loadCourses();
    toast.success("Curso excluído com sucesso!");
  };

  // ── Module CRUD ──
  const saveModule = async () => {
    const cid = editCourseId || selectedCourse;
    if (!cid || !moduleForm.title.trim()) { toast.error("Preencha o título do módulo"); return; }
    await supabase.from("modules").insert({
      course_id: cid,
      title: moduleForm.title,
      banner_url: moduleForm.banner_url || null,
      sort_order: modules.length
    });
    setModuleDialog(false);
    setModuleForm({ title: "", banner_url: "" });
    loadModules(cid);
    toast.success("Módulo criado!");
  };

  const deleteModule = async (id: string) => {
    await supabase.from("modules").delete().eq("id", id);
    const cid = editCourseId || selectedCourse;
    if (cid) loadModules(cid);
    toast.success("Módulo excluído");
  };

  const toggleModuleExpand = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Lesson CRUD ──
  const openLessonNew = (moduleId: string) => {
    setLessonModuleId(moduleId);
    setEditLessonId(null);
    setLessonForm({ title: "", description: "", video_url: "", duration_minutes: "0", is_free: false });
    setLessonSheet(true);
  };

  const openLessonEdit = (lesson: Lesson) => {
    setLessonModuleId(lesson.module_id);
    setEditLessonId(lesson.id);
    setLessonForm({
      title: lesson.title,
      description: lesson.description || "",
      video_url: lesson.video_url || "",
      duration_minutes: String(lesson.duration_minutes || 0),
      is_free: lesson.is_free || false
    });
    setLessonSheet(true);
  };

  const saveLesson = async () => {
    if (!lessonModuleId || !lessonForm.title.trim()) { toast.error("Preencha o título da aula"); return; }
    const mod = modules.find(m => m.id === lessonModuleId);
    const payload = {
      module_id: lessonModuleId,
      title: lessonForm.title,
      description: lessonForm.description || null,
      video_url: lessonForm.video_url || null,
      duration_minutes: parseInt(lessonForm.duration_minutes) || 0,
      is_free: lessonForm.is_free,
      sort_order: editLessonId ? undefined : (mod?.lessons?.length || 0)
    };
    if (editLessonId) {
      const { module_id, sort_order, ...up } = payload;
      await supabase.from("lessons").update(up).eq("id", editLessonId);
      toast.success("Aula atualizada!");
    } else {
      await supabase.from("lessons").insert(payload);
      toast.success("Aula criada!");
    }
    setLessonSheet(false);
    const cid = editCourseId || selectedCourse;
    if (cid) loadModules(cid);
  };

  const deleteLesson = async (id: string) => {
    await supabase.from("lessons").delete().eq("id", id);
    const cid = editCourseId || selectedCourse;
    if (cid) loadModules(cid);
    toast.success("Aula excluída");
  };

  // ── Filtered courses ──
  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const activeCourse = editCourseId || selectedCourse;

  // ═════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <PageShell>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageTitle icon={<BookOpen className="h-6 w-6" />} title="Conteúdo" subtitle="Gerencie cursos, módulos e aulas da sua área de membros" />
        <Button onClick={openWizardNew} className="gap-2 rounded-xl text-[13px] font-bold gradient-primary text-primary-foreground px-5 h-10 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-[1px] transition-all">
          <Sparkles className="h-4 w-4" /> Novo Conteúdo
        </Button>
      </div>

      {/* ── Search Bar ── */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
        <Input
          placeholder="Buscar por nome do curso..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-card/80 backdrop-blur-sm border-border/50 text-[13px] focus:bg-background focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
        />
      </div>

      {/* ── Top Products Table ── */}
      {products.length > 0 && (
        <div className="panel-enterprise p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-display font-bold text-foreground">Produtos Mais Vendidos</h3>
              <p className="text-[11px] text-muted-foreground">Pedidos gerados, pagos e taxa de conversão</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  {["#", "Produto", "Pedidos Gerados", "Pagos", "Conversão", "Faturamento"].map(h => (
                    <th key={h} className="text-left p-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const productStats = products.map(p => {
                    const allTx = transactions.filter(t => t.product_id === p.id);
                    const paidTx = allTx.filter(t => t.status === "completed" || t.status === "approved");
                    const gross = paidTx.reduce((a, t) => a + Number(t.amount), 0);
                    return { ...p, total: allTx.length, paid: paidTx.length, conversion: allTx.length > 0 ? (paidTx.length / allTx.length) * 100 : 0, gross };
                  }).sort((a, b) => b.paid - a.paid);

                  if (productStats.every(p => p.total === 0)) {
                    return (
                      <tr><td colSpan={6} className="p-8 text-center text-muted-foreground/50 text-xs">Nenhum pedido registrado ainda</td></tr>
                    );
                  }

                  return productStats.filter(p => p.total > 0).map((p, i) => (
                    <tr key={p.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                      <td className="p-2.5">
                        <span className={`text-xs font-black ${i === 0 ? "text-primary" : i === 1 ? "text-blue-400" : i === 2 ? "text-violet-400" : "text-muted-foreground/40"}`}>#{i + 1}</span>
                      </td>
                      <td className="p-2.5">
                        <p className="text-xs font-bold text-foreground truncate max-w-[200px]">{p.name}</p>
                      </td>
                      <td className="p-2.5">
                        <span className="text-xs font-bold bg-muted/50 px-2 py-0.5 rounded text-muted-foreground">{p.total}</span>
                      </td>
                      <td className="p-2.5">
                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{p.paid}</span>
                      </td>
                      <td className="p-2.5">
                        <span className={`text-xs font-bold ${p.conversion >= 50 ? "text-primary" : p.conversion >= 20 ? "text-amber-500" : "text-destructive"}`}>
                          {p.conversion.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className="text-xs font-black text-primary">R$ {p.gross.toFixed(2)}</span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Course List ── */}
      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<BookOpen className="h-8 w-8" />}
            title="Nenhum curso criado"
            subtitle="Crie seu primeiro curso para começar a entregar conteúdo"
            action={
              <Button onClick={openWizardNew} className="gap-2 rounded-xl gradient-primary text-primary-foreground shadow-lg shadow-primary/15">
                <Plus className="h-4 w-4" /> Criar Primeiro Curso
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <CourseCard
              key={c.id}
              course={c}
              onEdit={() => openWizardEdit(c)}
              onTogglePublish={() => togglePublish(c.id, c.is_published ?? false)}
              onDelete={() => deleteCourse(c.id)}
              onManage={() => { setSelectedCourse(c.id); setEditCourseId(c.id); setWizardStep("structure"); setWizardOpen(true); }}
              stats={getCourseStats(c.id)}
              products={products}
            />
          ))}
        </div>
      )}

      {/* ═══ Course Creation / Edit Wizard ═══ */}
      <Dialog open={wizardOpen} onOpenChange={v => { if (!v) { setWizardOpen(false); setEditCourseId(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {/* Wizard header */}
          <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-[18px] font-bold">
                {editCourseId ? "Editar Curso" : "Criar Novo Curso"}
              </DialogTitle>
              <p className="text-[13px] text-muted-foreground">Configure seu curso seguindo os passos abaixo</p>
            </DialogHeader>
            {/* Step indicators */}
            <div className="flex gap-2 mt-4">
              {[
                { key: "info" as WizardStep, label: "Informações", icon: FileText },
                { key: "structure" as WizardStep, label: "Estrutura e Conteúdo", icon: Layers }
              ].map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => { if (s.key === "structure" && !editCourseId) return; setWizardStep(s.key); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                    wizardStep === s.key
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-muted/40"
                  } ${s.key === "structure" && !editCourseId ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <s.icon className="h-3.5 w-3.5" />
                  <span>{i + 1}. {s.label}</span>
                  {wizardStep === s.key && <Check className="h-3 w-3 text-primary ml-1" />}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {wizardStep === "info" ? (
              <WizardInfoStep
                form={courseForm}
                setForm={setCourseForm}
                products={products}
                onSave={saveCourse}
                isEdit={!!editCourseId}
              />
            ) : (
              <WizardStructureStep
                modules={modules}
                expandedModules={expandedModules}
                toggleModuleExpand={toggleModuleExpand}
                onAddModule={() => { setModuleForm({ title: "", banner_url: "" }); setModuleDialog(true); }}
                onDeleteModule={deleteModule}
                onAddLesson={openLessonNew}
                onEditLesson={openLessonEdit}
                onDeleteLesson={deleteLesson}
                onFinish={() => { setWizardOpen(false); setEditCourseId(null); loadCourses(); }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Module Dialog ═══ */}
      <Dialog open={moduleDialog} onOpenChange={setModuleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold">Novo Módulo</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label className="text-[13px] font-semibold">Nome do Módulo *</Label>
              <Input
                value={moduleForm.title}
                onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Introdução ao Curso"
                className="mt-1.5 rounded-xl h-11"
              />
            </div>
            <ImageUploadZone
              value={moduleForm.banner_url}
              onChange={url => setModuleForm(p => ({ ...p, banner_url: url }))}
              label="Imagem de Capa"
              aspect="2:3"
            />
            <p className="text-[11px] text-muted-foreground/60">Opcional: Faça upload de uma imagem para a capa do módulo</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setModuleDialog(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={saveModule} className="rounded-xl gradient-primary text-primary-foreground px-6">Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Lesson Sheet (Right Drawer) ═══ */}
      <Sheet open={lessonSheet} onOpenChange={setLessonSheet}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[16px] font-bold">
              {editLessonId ? "Editar Aula" : "Nova Aula"}
            </SheetTitle>
            <p className="text-[12px] text-muted-foreground">Configure o conteúdo da aula</p>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Informações da Aula */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary mb-3">
                <PlayCircle className="h-4 w-4" />
                <span className="text-[13px] font-bold">Informações da Aula</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                <div>
                  <Label className="text-[12px] font-semibold">Nome da Aula *</Label>
                  <Input
                    value={lessonForm.title}
                    onChange={e => setLessonForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Ex: Introdução ao Curso"
                    className="mt-1 rounded-xl h-10"
                  />
                </div>
                <div>
                  <Label className="text-[12px] font-semibold">Duração estimada</Label>
                  <Select value={lessonForm.duration_minutes} onValueChange={v => setLessonForm(p => ({ ...p, duration_minutes: v }))}>
                    <SelectTrigger className="mt-1 rounded-xl h-10 w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <Label className="text-[12px] font-semibold">Descrição</Label>
              <Textarea
                value={lessonForm.description}
                onChange={e => setLessonForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Descreva o que será abordado nesta aula..."
                className="mt-1 rounded-xl min-h-[100px]"
              />
              <p className="text-[10px] text-muted-foreground/50 mt-1">Uma boa descrição ajuda os alunos a entender o conteúdo</p>
            </div>

            {/* Vídeo da Aula */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Video className="h-4 w-4" />
                <span className="text-[13px] font-bold">Vídeo da Aula</span>
              </div>
              <div>
                <Label className="text-[12px] font-semibold">Link do YouTube</Label>
                <Input
                  value={lessonForm.video_url}
                  onChange={e => setLessonForm(p => ({ ...p, video_url: e.target.value }))}
                  placeholder="https://youtu.be/... ou https://youtube.com/watch?v=..."
                  className="mt-1 rounded-xl h-10"
                />
                <p className="text-[10px] text-muted-foreground/50 mt-1">Cole o link de um vídeo do YouTube (não listado recomendado)</p>
              </div>
            </div>

            {/* Config */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Package className="h-4 w-4" />
                <span className="text-[13px] font-bold">Configuração de Liberação</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">Aula Gratuita</p>
                  <p className="text-[11px] text-muted-foreground">Disponível sem compra do curso</p>
                </div>
                <Switch checked={lessonForm.is_free} onCheckedChange={v => setLessonForm(p => ({ ...p, is_free: v }))} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {editLessonId && (
                <Button variant="destructive" size="sm" className="rounded-xl gap-1" onClick={() => { deleteLesson(editLessonId); setLessonSheet(false); }}>
                  <Trash2 className="h-3 w-3" /> Excluir
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setLessonSheet(false)} className="rounded-xl">Cancelar</Button>
              <Button onClick={saveLesson} className="rounded-xl gradient-primary text-primary-foreground px-6 gap-1.5">
                <Check className="h-3.5 w-3.5" /> Salvar Alterações
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

// ── Course Card ───────────────────────────────────────────────────
function CourseCard({ course, onEdit, onTogglePublish, onDelete, onManage, stats, products }: {
  course: Course;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  onManage: () => void;
  stats: { modules: number; lessons: number };
  products: Product[];
}) {
  const product = products.find(p => p.id === course.product_id);
  const [copiedLink, setCopiedLink] = useState(false);

  const getMemberLink = () => {
    const base = window.location.origin;
    return `${base}/membros-area/curso/${course.id}`;
  };

  const copyMemberLink = () => {
    navigator.clipboard.writeText(getMemberLink());
    setCopiedLink(true);
    toast.success("Link da área de membros copiado!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <GlowPanel className="p-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail */}
        <div className="sm:w-[200px] h-[140px] sm:h-auto bg-gradient-to-br from-muted/20 to-muted/5 relative overflow-hidden shrink-0">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/15" />
            </div>
          )}
          <div className="absolute top-2.5 left-2.5">
            <Badge variant={course.is_published ? "default" : "secondary"} className="text-[10px] font-bold rounded-lg px-2.5 py-1 backdrop-blur-sm">
              {course.is_published ? "Publicado" : "Rascunho"}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between min-w-0">
          <div>
            <h3 className="text-[16px] font-display font-bold text-foreground truncate">{course.title}</h3>
            <p className="text-[12px] text-muted-foreground/50 mt-0.5">{course.category || "Geral"}</p>
            <div className="flex items-center gap-4 mt-2.5 text-[11px] text-muted-foreground/60">
              <span className="flex items-center gap-1.5 bg-muted/20 border border-border/20 px-2 py-0.5 rounded-md"><Layers className="h-3 w-3" />{stats.modules} módulos</span>
              <span className="flex items-center gap-1.5 bg-muted/20 border border-border/20 px-2 py-0.5 rounded-md"><PlayCircle className="h-3 w-3" />{stats.lessons} aulas</span>
            </div>
            {course.product_id && (
              <div className="flex items-center gap-1.5 mt-2.5">
                <LinkIcon className={`h-3 w-3 ${product ? "text-primary" : "text-destructive"}`} />
                <span className={`text-[11px] font-semibold ${product ? "text-primary" : "text-destructive"}`}>
                  {product ? `Produto: ${product.name}` : "Produto removido"}
                </span>
              </div>
            )}

            {/* Member area link */}
            {course.is_published && (
              <div className="flex items-center gap-2 mt-2.5 p-2 rounded-lg bg-primary/[0.04] border border-primary/10">
                <LinkIcon className="h-3 w-3 text-primary shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate flex-1 font-mono">{getMemberLink()}</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 rounded-md text-primary hover:bg-primary/10 shrink-0" onClick={copyMemberLink}>
                  {copiedLink ? <Check className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
                  {copiedLink ? "Copiado" : "Copiar"}
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button variant="outline" size="sm" className="rounded-xl text-[11px] gap-1.5 h-8 border-border/40 hover:border-primary/20 hover:bg-primary/[0.02]" onClick={onTogglePublish}>
              {course.is_published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {course.is_published ? "Despublicar" : "Publicar"}
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl text-[11px] gap-1.5 h-8 border-border/40 hover:border-primary/20 hover:bg-primary/[0.02]" onClick={onEdit}>
              <Edit className="h-3 w-3" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl text-[11px] gap-1.5 h-8 border-border/40 hover:border-primary/20 hover:bg-primary/[0.02]" onClick={onManage}>
              <Layers className="h-3 w-3" /> Gerenciar Conteúdo
            </Button>
            {course.is_published && (
              <Button variant="outline" size="sm" className="rounded-xl text-[11px] gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/5" onClick={() => window.open(getMemberLink(), "_blank")}>
                <Eye className="h-3 w-3" /> Visualizar
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/50 hover:text-destructive hover:bg-destructive/5 rounded-xl" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </GlowPanel>
  );
}

// ── Wizard Step 1: Info ───────────────────────────────────────────
function WizardInfoStep({ form, setForm, products, onSave, isEdit }: {
  form: typeof import("react").useState extends never ? never : any;
  setForm: (fn: (prev: any) => any) => void;
  products: Product[];
  onSave: () => void;
  isEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Associate product */}
      {!isEdit && (
        <Panel className="p-5 text-center space-y-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-foreground">Associar Produto (Opcional)</p>
            <p className="text-[12px] text-muted-foreground">Selecione um produto para vincular ao curso</p>
          </div>
          <Select value={form.product_id} onValueChange={v => setForm((p: any) => ({ ...p, product_id: v }))}>
            <SelectTrigger className="mx-auto max-w-xs rounded-xl border-primary/20 text-primary">
              <SelectValue placeholder="Selecionar Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Panel>
      )}

      {/* Basic info */}
      <Panel className="p-5 space-y-5">
        <div className="flex items-center gap-2 text-primary">
          <FileText className="h-4 w-4" />
          <span className="text-[14px] font-bold">Informações Básicas</span>
        </div>
        <p className="text-[12px] text-muted-foreground -mt-3">Configure as informações principais do seu curso</p>

        <div>
          <Label className="text-[13px] font-semibold">Nome do Curso *</Label>
          <Input
            value={form.title}
            onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))}
            placeholder="Ex: React Avançado"
            className="mt-1.5 rounded-xl h-11"
          />
          <p className="text-[10px] text-muted-foreground/60 mt-1">Este será o nome principal exibido no curso</p>
        </div>

        <div>
          <Label className="text-[13px] font-semibold">Descrição</Label>
          <Textarea
            value={form.description}
            onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))}
            placeholder="Descreva brevemente o que os alunos aprenderão neste curso..."
            className="mt-1.5 rounded-xl min-h-[100px]"
          />
          <p className="text-[10px] text-muted-foreground/60 mt-1">Uma descrição atrativa ajuda os alunos a entenderem o conteúdo</p>
        </div>

        <div>
          <Label className="text-[13px] font-semibold">Categoria</Label>
          <Input
            value={form.category}
            onChange={e => setForm((p: any) => ({ ...p, category: e.target.value }))}
            placeholder="Ex: Programação, Marketing, Design..."
            className="mt-1.5 rounded-xl h-11"
          />
        </div>

        {isEdit && (
          <div>
            <Label className="text-[13px] font-semibold">Produto Associado</Label>
            <Select value={form.product_id} onValueChange={v => setForm((p: any) => ({ ...p, product_id: v }))}>
              <SelectTrigger className="mt-1.5 rounded-xl h-11">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <ImageUploadZone
          value={form.thumbnail_url}
          onChange={url => setForm((p: any) => ({ ...p, thumbnail_url: url }))}
          label="Logo / Thumbnail do Curso"
        />
      </Panel>

      {/* Navigation */}
      <div className="flex justify-end gap-3">
        <Button onClick={onSave} className="rounded-xl gradient-primary text-primary-foreground px-8 h-11 gap-2">
          {isEdit ? "Salvar e Continuar" : "Criar e Avançar"} <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
        </Button>
      </div>
    </div>
  );
}

// ── Wizard Step 2: Structure ──────────────────────────────────────
function WizardStructureStep({ modules, expandedModules, toggleModuleExpand, onAddModule, onDeleteModule, onAddLesson, onEditLesson, onDeleteLesson, onFinish }: {
  modules: Module[];
  expandedModules: Set<string>;
  toggleModuleExpand: (id: string) => void;
  onAddModule: () => void;
  onDeleteModule: (id: string) => void;
  onAddLesson: (moduleId: string) => void;
  onEditLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Layers className="h-4 w-4" />
            <span className="text-[14px] font-bold">Estrutura e Conteúdo do Curso</span>
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5">Organize seus módulos, aulas e faça upload de materiais</p>
        </div>
        <Button onClick={onAddModule} className="rounded-xl gradient-primary text-primary-foreground gap-1.5 h-9 text-[12px] px-4">
          <Plus className="h-3.5 w-3.5" /> Adicionar Módulo
        </Button>
      </div>

      {/* Modules */}
      {modules.length === 0 ? (
        <Panel className="py-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/40 flex items-center justify-center">
              <BookOpen className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-[14px] font-semibold text-foreground/80">Nenhum módulo criado</p>
            <p className="text-[12px] text-muted-foreground">Comece criando módulos para estruturar seu curso</p>
            <Button onClick={onAddModule} variant="outline" className="rounded-xl gap-1.5 mt-1">
              <Plus className="h-3.5 w-3.5" /> Criar Primeiro Módulo
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="space-y-3">
          {modules.map((mod, idx) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              index={idx}
              isExpanded={expandedModules.has(mod.id)}
              onToggle={() => toggleModuleExpand(mod.id)}
              onDelete={() => onDeleteModule(mod.id)}
              onAddLesson={() => onAddLesson(mod.id)}
              onEditLesson={onEditLesson}
              onDeleteLesson={onDeleteLesson}
            />
          ))}
        </div>
      )}

      {/* Finish */}
      <div className="flex justify-end gap-3 pt-2">
        <Button onClick={onFinish} className="rounded-xl gradient-primary text-primary-foreground px-8 h-11 gap-2">
          <Check className="h-4 w-4" /> Concluir
        </Button>
      </div>
    </div>
  );
}

// ── Module Card ───────────────────────────────────────────────────
function ModuleCard({ module: mod, index, isExpanded, onToggle, onDelete, onAddLesson, onEditLesson, onDeleteLesson }: {
  module: Module;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAddLesson: () => void;
  onEditLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
}) {
  return (
    <Panel className="p-0 overflow-hidden">
      {/* Module header */}
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-2 shrink-0">
          <GripVertical className="h-4 w-4 text-muted-foreground/30" />
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-[12px] font-bold text-primary">{index + 1}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-bold text-foreground truncate">{mod.title}</h4>
          <div className="flex items-center gap-3 mt-0.5">
            <Badge variant="secondary" className="text-[10px] rounded-md px-2 py-0">{mod.lessons.length} aulas</Badge>
            {mod.banner_url && <Badge variant="outline" className="text-[10px] rounded-md px-2 py-0">Com imagem</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); onToggle(); }}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px] gap-1" onClick={e => { e.stopPropagation(); onAddLesson(); }}>
            <Plus className="h-3 w-3" /> Adicionar aula
          </Button>
        </div>
      </div>

      {/* Expanded: Lessons */}
      {isExpanded && (
        <div className="border-t border-border">
          <div className="px-4 py-2">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Aulas do Módulo</p>
          </div>
          {mod.lessons.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Video className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-[12px] text-muted-foreground">Nenhuma aula criada ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {mod.lessons.map((lesson, lIdx) => (
                <div
                  key={lesson.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer group"
                  onClick={() => onEditLesson(lesson)}
                >
                  <span className="text-[11px] text-muted-foreground/50 font-mono w-5 text-right">{lIdx + 1}</span>
                  <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                    <PlayCircle className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground truncate">{lesson.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(lesson.duration_minutes ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> {lesson.duration_minutes}min
                        </span>
                      )}
                      {lesson.is_free && (
                        <Badge className="text-[9px] px-1.5 py-0 rounded-md bg-primary/10 text-primary border-0">FREE</Badge>
                      )}
                      {lesson.video_url && <LinkIcon className="h-2.5 w-2.5 text-muted-foreground/30" />}
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={e => { e.stopPropagation(); onDeleteLesson(lesson.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
