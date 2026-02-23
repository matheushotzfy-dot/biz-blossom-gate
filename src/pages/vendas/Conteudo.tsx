import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, BookOpen, Layers, PlayCircle, Trash2, Edit, Eye, EyeOff, GripVertical, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function AdminConteudo() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [modules, setModules] = useState<any[]>([]);

  // Course form
  const [courseDialog, setCourseDialog] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" });
  const [editCourseId, setEditCourseId] = useState<string | null>(null);

  // Module form
  const [moduleDialog, setModuleDialog] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "" });

  // Lesson form
  const [lessonDialog, setLessonDialog] = useState(false);
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", video_url: "", duration_minutes: "0", is_free: false });

  useEffect(() => {
    loadCourses();
    loadProducts();
  }, [user]);

  const loadCourses = async () => {
    const { data } = await supabase.from("courses").select("*").order("sort_order");
    if (data) setCourses(data);
  };

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("id, name").eq("status", "active");
    if (data) setProducts(data);
  };

  const loadModules = async (courseId: string) => {
    const { data: mods } = await supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order");
    if (!mods) return;

    const moduleIds = mods.map(m => m.id);
    const { data: lessons } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");

    const enriched = mods.map(m => ({
      ...m,
      lessons: lessons?.filter(l => l.module_id === m.id) || [],
    }));

    setModules(enriched);
  };

  useEffect(() => {
    if (selectedCourse) loadModules(selectedCourse);
  }, [selectedCourse]);

  const saveCourse = async () => {
    if (!user) return;
    const payload = {
      ...courseForm,
      user_id: user.id,
      product_id: courseForm.product_id || null,
      is_published: false,
    };

    if (editCourseId) {
      await supabase.from("courses").update(payload).eq("id", editCourseId);
      toast.success("Curso atualizado!");
    } else {
      await supabase.from("courses").insert(payload);
      toast.success("Curso criado!");
    }

    setCourseDialog(false);
    setCourseForm({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" });
    setEditCourseId(null);
    loadCourses();
  };

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from("courses").update({ is_published: !current }).eq("id", id);
    loadCourses();
    toast.success(!current ? "Curso publicado!" : "Curso despublicado");
  };

  const deleteCourse = async (id: string) => {
    await supabase.from("courses").delete().eq("id", id);
    if (selectedCourse === id) setSelectedCourse(null);
    loadCourses();
    toast.success("Curso excluído");
  };

  const saveModule = async () => {
    if (!selectedCourse) return;
    await supabase.from("modules").insert({
      course_id: selectedCourse,
      title: moduleForm.title,
      description: moduleForm.description || null,
      sort_order: modules.length,
    });
    setModuleDialog(false);
    setModuleForm({ title: "", description: "" });
    loadModules(selectedCourse);
    toast.success("Módulo criado!");
  };

  const deleteModule = async (id: string) => {
    await supabase.from("modules").delete().eq("id", id);
    if (selectedCourse) loadModules(selectedCourse);
    toast.success("Módulo excluído");
  };

  const saveLesson = async () => {
    if (!lessonModuleId) return;
    const mod = modules.find(m => m.id === lessonModuleId);
    await supabase.from("lessons").insert({
      module_id: lessonModuleId,
      title: lessonForm.title,
      description: lessonForm.description || null,
      video_url: lessonForm.video_url || null,
      duration_minutes: parseInt(lessonForm.duration_minutes) || 0,
      is_free: lessonForm.is_free,
      sort_order: mod?.lessons?.length || 0,
    });
    setLessonDialog(false);
    setLessonForm({ title: "", description: "", video_url: "", duration_minutes: "0", is_free: false });
    if (selectedCourse) loadModules(selectedCourse);
    toast.success("Aula criada!");
  };

  const deleteLesson = async (id: string) => {
    await supabase.from("lessons").delete().eq("id", id);
    if (selectedCourse) loadModules(selectedCourse);
    toast.success("Aula excluída");
  };

  return (
    <div className="space-y-6 dark">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Conteúdo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie cursos, módulos e aulas</p>
        </div>

        <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={() => { setEditCourseId(null); setCourseForm({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" }); }}>
              <Plus className="h-4 w-4" /> Novo Curso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editCourseId ? "Editar Curso" : "Novo Curso"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={courseForm.category} onChange={e => setCourseForm(p => ({ ...p, category: e.target.value }))} />
              </div>
              <div>
                <Label>Thumbnail URL</Label>
                <Input value={courseForm.thumbnail_url} onChange={e => setCourseForm(p => ({ ...p, thumbnail_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <Label>Produto vinculado (para acesso por compra)</Label>
                <Select value={courseForm.product_id} onValueChange={v => setCourseForm(p => ({ ...p, product_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum (curso gratuito)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (curso gratuito)</SelectItem>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveCourse} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course list */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cursos</h3>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Nenhum curso criado</p>
          ) : courses.map(c => (
            <div
              key={c.id}
              onClick={() => setSelectedCourse(c.id)}
              className={`rounded-xl p-4 cursor-pointer transition-all border ${
                selectedCourse === c.id
                  ? "bg-primary/10 border-primary/30"
                  : "bg-card/60 border-border/30 hover:border-primary/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{c.title}</h4>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); togglePublish(c.id, c.is_published); }}>
                    {c.is_published ? <Eye className="h-3 w-3 text-primary" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => {
                    e.stopPropagation();
                    setEditCourseId(c.id);
                    setCourseForm({ title: c.title, description: c.description || "", category: c.category || "geral", product_id: c.product_id || "", thumbnail_url: c.thumbnail_url || "" });
                    setCourseDialog(true);
                  }}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteCourse(c.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{c.category} • {c.is_published ? "Publicado" : "Rascunho"}</p>
            </div>
          ))}
        </div>

        {/* Modules + Lessons */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCourse ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Módulos & Aulas</h3>
                <Dialog open={moduleDialog} onOpenChange={setModuleDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1">
                      <Plus className="h-3 w-3" /> Módulo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Novo Módulo</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>Título</Label><Input value={moduleForm.title} onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))} /></div>
                      <div><Label>Descrição</Label><Textarea value={moduleForm.description} onChange={e => setModuleForm(p => ({ ...p, description: e.target.value }))} /></div>
                      <Button onClick={saveModule} className="w-full">Salvar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {modules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Adicione módulos a este curso</div>
              ) : modules.map(mod => (
                <div key={mod.id} className="rounded-xl bg-card/60 border border-border/30 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-border/20">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm">{mod.title}</h4>
                      <span className="text-xs text-muted-foreground">({mod.lessons.length} aulas)</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { setLessonModuleId(mod.id); setLessonForm({ title: "", description: "", video_url: "", duration_minutes: "0", is_free: false }); setLessonDialog(true); }}>
                        <Plus className="h-3 w-3" /> Aula
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteModule(mod.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {mod.lessons.length > 0 && (
                    <div className="divide-y divide-border/20">
                      {mod.lessons.map((lesson: any, idx: number) => (
                        <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors">
                          <span className="text-xs text-muted-foreground w-6">{idx + 1}</span>
                          <PlayCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{lesson.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {lesson.duration_minutes > 0 && <span className="text-xs text-muted-foreground">{lesson.duration_minutes} min</span>}
                              {lesson.is_free && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">FREE</span>}
                              {lesson.video_url && <LinkIcon className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => deleteLesson(lesson.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Selecione um curso para gerenciar módulos e aulas</p>
            </div>
          )}
        </div>
      </div>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Aula</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={lessonForm.title} onChange={e => setLessonForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea value={lessonForm.description} onChange={e => setLessonForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>URL do vídeo (YouTube)</Label><Input value={lessonForm.video_url} onChange={e => setLessonForm(p => ({ ...p, video_url: e.target.value }))} placeholder="https://youtu.be/..." /></div>
            <div><Label>Duração (min)</Label><Input type="number" value={lessonForm.duration_minutes} onChange={e => setLessonForm(p => ({ ...p, duration_minutes: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={lessonForm.is_free} onCheckedChange={v => setLessonForm(p => ({ ...p, is_free: v }))} />
              <Label>Aula gratuita (preview)</Label>
            </div>
            <Button onClick={saveLesson} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
