import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts as useProductsQuery, useCourses as useCoursesQuery, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Plus, BookOpen, Layers, PlayCircle, Trash2, Edit, Eye, EyeOff,
  Link as LinkIcon, Search, Users, ChevronDown, ChevronUp, Upload,
  Image as ImageIcon, Video, GripVertical, X, Clock,
  Package, FileText, Check, Copy, CheckCircle2, MoreVertical,
  Globe, Lock, FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────
interface Course {
  id: string; title: string; description: string | null; category: string | null;
  thumbnail_url: string | null; product_id: string | null; is_published: boolean;
  sort_order: number | null; user_id: string; created_at: string;
}
interface Module { id: string; course_id: string; title: string; description: string | null; banner_url: string | null; sort_order: number | null; lessons: Lesson[]; }
interface Lesson { id: string; module_id: string; title: string; description: string | null; video_url: string | null; duration_minutes: number | null; is_free: boolean; sort_order: number | null; }
interface Product { id: string; name: string; }

type WizardStep = "info" | "structure";

// ─── Image Upload ─────────────────────────────────────────────────
function ImageUploadZone({ value, onChange, label, height = "h-40" }: {
  value: string; onChange: (url: string) => void; label: string; height?: string;
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
      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">{label}</Label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className={cn("relative rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer overflow-hidden group/img", height, value ? "p-0" : "flex flex-col items-center justify-center")}
      >
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-background/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button type="button" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }} className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ImageIcon className="h-4 w-4 text-foreground" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onChange(""); }} className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center text-destructive hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <ImageIcon className="h-6 w-6 text-muted-foreground/40 mb-1.5" />
            <p className="text-[11px] text-muted-foreground">{uploading ? "Enviando..." : "Clique ou arraste"}</p>
            <p className="text-[10px] text-muted-foreground/60">PNG, JPG até 5MB</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

const DURATION_OPTIONS = [
  { value: "0", label: "Selecionar" }, { value: "5", label: "5 min" }, { value: "10", label: "10 min" },
  { value: "15", label: "15 min" }, { value: "20", label: "20 min" }, { value: "30", label: "30 min" },
  { value: "45", label: "45 min" }, { value: "60", label: "1h" }, { value: "90", label: "1h30" }, { value: "120", label: "2h" },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
export default function AdminConteudo() {
  const { user } = useAuth();
  const { data: coursesRaw = [] } = useCoursesQuery();
  const { data: productsRaw = [] } = useProductsQuery();
  const invalidateAll = useInvalidateAll();

  const courses = useMemo(() => coursesRaw.map((c: any) => { const { modules: _, ...rest } = c; return rest; }) as Course[], [coursesRaw]);
  const products = useMemo(() => productsRaw.map(p => ({ id: p.id, name: p.name })) as Product[], [productsRaw]);

  const courseStats = useMemo(() => {
    const stats: Record<string, { modules: number; lessons: number }> = {};
    coursesRaw.forEach((c: any) => {
      const mods = c.modules || [];
      stats[c.id] = { modules: mods.length, lessons: mods.reduce((a: number, m: any) => a + (m.lessons?.length || 0), 0) };
    });
    return stats;
  }, [coursesRaw]);

  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("info");
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" });
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [moduleDialog, setModuleDialog] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: "", banner_url: "" });
  const [lessonSheet, setLessonSheet] = useState(false);
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null);
  const [editLessonId, setEditLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", video_url: "", duration_minutes: "0", is_free: false });

  const reloadCourses = () => invalidateAll(["courses", "products"]);

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

  // Course CRUD
  const openWizardNew = () => { setEditCourseId(null); setCourseForm({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" }); setWizardStep("info"); setWizardOpen(true); };
  const openWizardEdit = (c: Course) => { setEditCourseId(c.id); setCourseForm({ title: c.title, description: c.description || "", category: c.category || "geral", product_id: c.product_id || "", thumbnail_url: c.thumbnail_url || "" }); setWizardStep("info"); setWizardOpen(true); };

  const saveCourse = async () => {
    if (!user || !courseForm.title.trim()) { toast.error("Preencha o título"); return; }
    const payload = { title: courseForm.title, description: courseForm.description || null, category: courseForm.category || "geral", product_id: courseForm.product_id && courseForm.product_id !== "none" ? courseForm.product_id : null, thumbnail_url: courseForm.thumbnail_url || null, user_id: user.id, is_published: false };
    if (editCourseId) {
      const { user_id, is_published, ...up } = payload;
      await supabase.from("courses").update(up).eq("id", editCourseId).eq("user_id", user.id);
      toast.success("Curso atualizado!");
    } else {
      const { data } = await supabase.from("courses").insert(payload).select().single();
      if (data) { setSelectedCourse(data.id); setEditCourseId(data.id); }
      toast.success("Curso criado!");
    }
    reloadCourses(); setWizardStep("structure");
  };

  const togglePublish = async (id: string, cur: boolean) => {
    if (!user) return;
    await supabase.from("courses").update({ is_published: !cur }).eq("id", id).eq("user_id", user.id);
    reloadCourses(); toast.success(cur ? "Despublicado" : "Publicado!");
  };

  const deleteCourse = async (id: string) => {
    if (!user) return;
    const { data: courseModules } = await supabase.from("modules").select("id").eq("course_id", id);
    if (courseModules && courseModules.length > 0) {
      await supabase.from("lessons").delete().in("module_id", courseModules.map(m => m.id));
      await supabase.from("modules").delete().eq("course_id", id);
    }
    await supabase.from("user_access").delete().eq("course_id", id);
    await supabase.from("courses").delete().eq("id", id).eq("user_id", user.id);
    if (selectedCourse === id) { setSelectedCourse(null); setModules([]); }
    reloadCourses(); toast.success("Curso excluído!");
  };

  // Module CRUD
  const saveModule = async () => {
    const cid = editCourseId || selectedCourse;
    if (!cid || !moduleForm.title.trim()) { toast.error("Preencha o título do módulo"); return; }
    await supabase.from("modules").insert({ course_id: cid, title: moduleForm.title, banner_url: moduleForm.banner_url || null, sort_order: modules.length });
    setModuleDialog(false); setModuleForm({ title: "", banner_url: "" }); loadModules(cid); toast.success("Módulo criado!");
  };

  const deleteModule = async (id: string) => {
    await supabase.from("lessons").delete().in("module_id", [id]);
    await supabase.from("modules").delete().eq("id", id);
    const cid = editCourseId || selectedCourse;
    if (cid) loadModules(cid); toast.success("Módulo excluído");
  };

  const toggleModuleExpand = (id: string) => { setExpandedModules(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  // Lesson CRUD
  const openLessonNew = (moduleId: string) => { setLessonModuleId(moduleId); setEditLessonId(null); setLessonForm({ title: "", description: "", video_url: "", duration_minutes: "0", is_free: false }); setLessonSheet(true); };
  const openLessonEdit = (lesson: Lesson) => { setLessonModuleId(lesson.module_id); setEditLessonId(lesson.id); setLessonForm({ title: lesson.title, description: lesson.description || "", video_url: lesson.video_url || "", duration_minutes: String(lesson.duration_minutes || 0), is_free: lesson.is_free || false }); setLessonSheet(true); };

  const saveLesson = async () => {
    if (!lessonModuleId || !lessonForm.title.trim()) { toast.error("Preencha o título da aula"); return; }
    const mod = modules.find(m => m.id === lessonModuleId);
    const payload = { module_id: lessonModuleId, title: lessonForm.title, description: lessonForm.description || null, video_url: lessonForm.video_url || null, duration_minutes: parseInt(lessonForm.duration_minutes) || 0, is_free: lessonForm.is_free, sort_order: editLessonId ? undefined : (mod?.lessons?.length || 0) };
    if (editLessonId) {
      const { module_id, sort_order, ...up } = payload;
      await supabase.from("lessons").update(up).eq("id", editLessonId).eq("module_id", lessonModuleId);
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
    if (cid) loadModules(cid); toast.success("Aula excluída");
  };

  const filtered = courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  const getMemberLink = (courseId: string) => `${window.location.origin}/membros-area/curso/${courseId}`;

  // ─── KPI Stats ───
  const totalCourses = courses.length;
  const publishedCourses = courses.filter(c => c.is_published).length;
  const totalModules = Object.values(courseStats).reduce((a, s) => a + s.modules, 0);
  const totalLessons = Object.values(courseStats).reduce((a, s) => a + s.lessons, 0);

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<BookOpen className="h-6 w-6" />} title="Conteúdo" subtitle="Gerencie cursos, módulos e aulas" />
        <Button onClick={openWizardNew} className="gap-2 rounded-lg text-sm font-semibold h-9 px-4">
          <Plus className="h-4 w-4" /> Novo Conteúdo
        </Button>
      </div>

      {/* KPIs — Glass */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Cursos", value: String(totalCourses), icon: BookOpen, bg: "bg-primary/10", color: "text-primary" },
          { label: "Publicados", value: String(publishedCourses), icon: Globe, bg: "bg-success/10", color: "text-success" },
          { label: "Módulos", value: String(totalModules), icon: Layers, bg: "bg-info/10", color: "text-info" },
          { label: "Aulas", value: String(totalLessons), icon: PlayCircle, bg: "bg-warning/10", color: "text-warning" },
        ].map((kpi) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground tracking-wide">{kpi.label}</span>
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", kpi.bg)}>
                <kpi.icon className={cn("h-3.5 w-3.5", kpi.color)} />
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <input
          placeholder="Buscar cursos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-9 pl-10 pr-4 rounded-lg bg-muted/30 dark:bg-foreground/[0.03] border border-border/40 dark:border-foreground/[0.05] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
        />
      </div>

      {/* Course List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-7 w-7" />}
          title="Nenhum curso criado"
          subtitle="Crie seu primeiro curso para entregar conteúdo"
          action={<Button onClick={openWizardNew} size="sm" className="gap-2 rounded-lg"><Plus className="h-3.5 w-3.5" /> Criar Curso</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c, i) => {
            const stats = courseStats[c.id] || { modules: 0, lessons: 0 };
            const product = products.find(p => p.id === c.product_id);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.3) }}
                className="group rounded-xl bg-card/40 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] overflow-hidden flex flex-col hover:border-primary/15 transition-colors"
              >
                {/* Thumbnail */}
                <div className="relative h-36 overflow-hidden bg-muted/20">
                  {c.thumbnail_url ? (
                    <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="h-10 w-10 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute top-2.5 right-2.5">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm",
                      c.is_published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    )}>
                      {c.is_published ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {c.is_published ? "Publicado" : "Rascunho"}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-1 flex-col">
                  <h3 className="text-[14px] font-semibold text-foreground leading-snug line-clamp-1 mb-1">{c.title}</h3>
                  <p className="text-[11px] text-muted-foreground mb-2">{c.category || "Geral"}</p>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 mb-3">
                     <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 bg-muted/30 px-2 py-0.5 rounded">
                      <Layers className="h-3 w-3" /> {stats.modules} módulos
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 bg-muted/30 px-2 py-0.5 rounded">
                      <PlayCircle className="h-3 w-3" /> {stats.lessons} aulas
                    </span>
                  </div>

                  {/* Linked product */}
                  {product && (
                    <div className="flex items-center gap-1.5 mb-3 text-[11px] text-primary">
                      <LinkIcon className="h-3 w-3" />
                      <span className="truncate font-medium">{product.name}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-auto pt-1">
                    <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-medium text-muted-foreground hover:text-foreground" onClick={() => { setSelectedCourse(c.id); setEditCourseId(c.id); setWizardStep("structure"); setWizardOpen(true); }}>
                      <FolderOpen className="h-3 w-3" /> Gerenciar
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-medium text-muted-foreground hover:text-foreground" onClick={() => openWizardEdit(c)}>
                      <Edit className="h-3 w-3" /> Editar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 text-muted-foreground hover:text-foreground ml-auto">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => togglePublish(c.id, c.is_published ?? false)} className="gap-2 text-[12px] cursor-pointer">
                          {c.is_published ? <><EyeOff className="h-3.5 w-3.5" /> Despublicar</> : <><Eye className="h-3.5 w-3.5" /> Publicar</>}
                        </DropdownMenuItem>
                        {c.is_published && (
                          <DropdownMenuItem onClick={() => window.open(getMemberLink(c.id), "_blank")} className="gap-2 text-[12px] cursor-pointer">
                            <Eye className="h-3.5 w-3.5" /> Visualizar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(getMemberLink(c.id)); toast.success("Link copiado!"); }} className="gap-2 text-[12px] cursor-pointer">
                          <Copy className="h-3.5 w-3.5" /> Copiar Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteCourse(c.id)} className="gap-2 text-[12px] cursor-pointer text-destructive focus:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══ Course Creation / Edit Wizard ═══ */}
      <Sheet open={wizardOpen} onOpenChange={v => { if (!v) { setWizardOpen(false); setEditCourseId(null); } else setWizardOpen(v); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-3 text-lg">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                {editCourseId ? <Edit className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
              </div>
              {editCourseId ? "Editar Curso" : "Novo Curso"}
            </SheetTitle>
          </SheetHeader>

          {/* Step tabs */}
          <div className="flex gap-2 mb-5">
            {[
              { key: "info" as WizardStep, label: "Informações", icon: FileText },
              { key: "structure" as WizardStep, label: "Conteúdo", icon: Layers },
            ].map((s, i) => (
              <button
                key={s.key}
                onClick={() => { if (s.key === "structure" && !editCourseId) return; setWizardStep(s.key); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border",
                  wizardStep === s.key ? "bg-primary/10 text-primary border-primary/25" : "text-muted-foreground border-border hover:text-foreground",
                  s.key === "structure" && !editCourseId && "opacity-40 cursor-not-allowed"
                )}
              >
                <s.icon className="h-3.5 w-3.5" />
                {i + 1}. {s.label}
              </button>
            ))}
          </div>

          {wizardStep === "info" ? (
            <form onSubmit={(e) => { e.preventDefault(); saveCourse(); }} className="space-y-4">
              {/* Product association */}
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Produto Vinculado</Label>
                <Select value={courseForm.product_id} onValueChange={v => setCourseForm(p => ({ ...p, product_id: v }))}>
                  <SelectTrigger className="mt-1.5 rounded-lg h-10"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">Vincule a um produto para liberar acesso automático</p>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nome do Curso *</Label>
                <Input value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: React Avançado" className="mt-1.5 h-10 rounded-lg" required />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição</Label>
                <Textarea value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} placeholder="Descreva o que os alunos aprenderão..." className="mt-1.5 rounded-lg" rows={3} />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Categoria</Label>
                <Input value={courseForm.category} onChange={e => setCourseForm(p => ({ ...p, category: e.target.value }))} placeholder="Ex: Programação, Marketing..." className="mt-1.5 h-10 rounded-lg" />
              </div>

              <ImageUploadZone value={courseForm.thumbnail_url} onChange={url => setCourseForm(p => ({ ...p, thumbnail_url: url }))} label="Thumbnail" height="h-32" />

              <Button type="submit" className="w-full h-10 rounded-lg font-semibold text-sm">
                {editCourseId ? "Salvar e Avançar" : "Criar e Avançar"}
              </Button>
            </form>
          ) : (
            /* Structure Step */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-foreground">Módulos e Aulas</p>
                <Button onClick={() => { setModuleForm({ title: "", banner_url: "" }); setModuleDialog(true); }} size="sm" variant="outline" className="gap-1.5 rounded-lg h-8 text-[11px]">
                  <Plus className="h-3 w-3" /> Módulo
                </Button>
              </div>

              {modules.length === 0 ? (
                <div className="rounded-lg border border-border bg-muted/20 p-10 text-center">
                  <Layers className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[13px] font-medium text-foreground/70">Nenhum módulo</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Crie módulos para estruturar seu curso</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {modules.map((mod, idx) => (
                    <div key={mod.id} className="rounded-lg border border-border bg-card overflow-hidden">
                      {/* Module header */}
                      <div className="flex items-center gap-2.5 p-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleModuleExpand(mod.id)}>
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold text-primary">{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-semibold text-foreground truncate">{mod.title}</h4>
                          <p className="text-[10px] text-muted-foreground">{mod.lessons.length} aulas</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1 rounded" onClick={e => { e.stopPropagation(); openLessonNew(mod.id); }}>
                          <Plus className="h-3 w-3" /> Aula
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={e => { e.stopPropagation(); deleteModule(mod.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        {expandedModules.has(mod.id) ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </div>

                      {/* Lessons */}
                      {expandedModules.has(mod.id) && (
                        <div className="border-t border-border">
                          {mod.lessons.length === 0 ? (
                            <div className="px-3 py-6 text-center">
                              <p className="text-[11px] text-muted-foreground">Nenhuma aula</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-border/50">
                              {mod.lessons.map((lesson, lIdx) => (
                                <div key={lesson.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer group" onClick={() => openLessonEdit(lesson)}>
                                  <span className="text-[10px] text-muted-foreground font-mono w-4 text-right">{lIdx + 1}</span>
                                  <div className="h-7 w-7 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                                    <PlayCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] text-foreground truncate">{lesson.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {(lesson.duration_minutes ?? 0) > 0 && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {lesson.duration_minutes}min</span>}
                                      {lesson.is_free && <span className="text-[9px] text-primary bg-primary/10 px-1.5 rounded">FREE</span>}
                                      {lesson.video_url && <Video className="h-2.5 w-2.5 text-muted-foreground/40" />}
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => { e.stopPropagation(); deleteLesson(lesson.id); }}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={() => { setWizardOpen(false); setEditCourseId(null); reloadCourses(); }} className="w-full h-10 rounded-lg font-semibold text-sm mt-4">
                <Check className="h-4 w-4 mr-2" /> Concluir
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ Module Dialog ═══ */}
      <Dialog open={moduleDialog} onOpenChange={setModuleDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-semibold">Novo Módulo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nome *</Label>
              <Input value={moduleForm.title} onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Introdução" className="mt-1.5 h-10 rounded-lg" />
            </div>
            <ImageUploadZone value={moduleForm.banner_url} onChange={url => setModuleForm(p => ({ ...p, banner_url: url }))} label="Capa (opcional)" height="h-28" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setModuleDialog(false)} size="sm" className="rounded-lg">Cancelar</Button>
              <Button onClick={saveModule} size="sm" className="rounded-lg">Criar Módulo</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Lesson Sheet ═══ */}
      <Sheet open={lessonSheet} onOpenChange={setLessonSheet}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-3 text-lg">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <PlayCircle className="h-4 w-4 text-primary" />
              </div>
              {editLessonId ? "Editar Aula" : "Nova Aula"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={(e) => { e.preventDefault(); saveLesson(); }} className="space-y-4">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Nome da Aula *</Label>
                <Input value={lessonForm.title} onChange={e => setLessonForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Introdução" className="mt-1.5 h-10 rounded-lg" required />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Duração</Label>
                <Select value={lessonForm.duration_minutes} onValueChange={v => setLessonForm(p => ({ ...p, duration_minutes: v }))}>
                  <SelectTrigger className="mt-1.5 h-10 rounded-lg w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição</Label>
              <Textarea value={lessonForm.description} onChange={e => setLessonForm(p => ({ ...p, description: e.target.value }))} placeholder="O que será abordado..." className="mt-1.5 rounded-lg" rows={3} />
            </div>

            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Video className="h-3 w-3" /> Link do Vídeo
              </Label>
              <Input value={lessonForm.video_url} onChange={e => setLessonForm(p => ({ ...p, video_url: e.target.value }))} placeholder="https://youtu.be/..." className="mt-1.5 h-10 rounded-lg" />
              <p className="text-[10px] text-muted-foreground mt-1">YouTube ou Vimeo (não listado recomendado)</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-[12px] font-medium text-foreground">Aula Gratuita</p>
                <p className="text-[10px] text-muted-foreground">Disponível sem compra</p>
              </div>
              <Switch checked={lessonForm.is_free} onCheckedChange={v => setLessonForm(p => ({ ...p, is_free: v }))} />
            </div>

            <div className="flex gap-2 pt-1">
              {editLessonId && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => { deleteLesson(editLessonId); setLessonSheet(false); }}>
                  <Trash2 className="h-3 w-3" /> Excluir
                </Button>
              )}
              <div className="flex-1" />
              <Button type="submit" className="rounded-lg font-semibold">
                <Check className="h-4 w-4 mr-1.5" /> Salvar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
