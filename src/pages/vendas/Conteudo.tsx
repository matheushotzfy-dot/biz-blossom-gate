import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, BookOpen, Layers, PlayCircle, Trash2, Edit, Eye, EyeOff, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";

export default function AdminConteudo() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [courseDialog, setCourseDialog] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" });
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [moduleDialog, setModuleDialog] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "" });
  const [lessonDialog, setLessonDialog] = useState(false);
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", video_url: "", duration_minutes: "0", is_free: false });

  useEffect(() => { loadCourses(); loadProducts(); }, [user]);

  const loadCourses = async () => { const { data } = await supabase.from("courses").select("*").order("sort_order"); if (data) setCourses(data); };
  const loadProducts = async () => { const { data } = await supabase.from("products").select("id, name").eq("status", "active"); if (data) setProducts(data); };
  const loadModules = async (courseId: string) => {
    const { data: mods } = await supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order");
    if (!mods) return;
    const moduleIds = mods.map(m => m.id);
    const { data: lessons } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");
    setModules(mods.map(m => ({ ...m, lessons: lessons?.filter(l => l.module_id === m.id) || [] })));
  };

  useEffect(() => { if (selectedCourse) loadModules(selectedCourse); }, [selectedCourse]);

  const saveCourse = async () => {
    if (!user) return;
    const payload = { ...courseForm, user_id: user.id, product_id: courseForm.product_id || null, is_published: false };
    if (editCourseId) { await supabase.from("courses").update(payload).eq("id", editCourseId); toast.success("Atualizado!"); }
    else { await supabase.from("courses").insert(payload); toast.success("Criado!"); }
    setCourseDialog(false); setCourseForm({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" }); setEditCourseId(null); loadCourses();
  };
  const togglePublish = async (id: string, cur: boolean) => { await supabase.from("courses").update({ is_published: !cur }).eq("id", id); loadCourses(); };
  const deleteCourse = async (id: string) => { await supabase.from("courses").delete().eq("id", id); if (selectedCourse === id) setSelectedCourse(null); loadCourses(); toast.success("Excluído"); };
  const saveModule = async () => { if (!selectedCourse) return; await supabase.from("modules").insert({ course_id: selectedCourse, title: moduleForm.title, description: moduleForm.description || null, sort_order: modules.length }); setModuleDialog(false); setModuleForm({ title: "", description: "" }); loadModules(selectedCourse); toast.success("Módulo criado!"); };
  const deleteModule = async (id: string) => { await supabase.from("modules").delete().eq("id", id); if (selectedCourse) loadModules(selectedCourse); toast.success("Excluído"); };
  const saveLesson = async () => { if (!lessonModuleId) return; const mod = modules.find(m => m.id === lessonModuleId); await supabase.from("lessons").insert({ module_id: lessonModuleId, title: lessonForm.title, description: lessonForm.description || null, video_url: lessonForm.video_url || null, duration_minutes: parseInt(lessonForm.duration_minutes) || 0, is_free: lessonForm.is_free, sort_order: mod?.lessons?.length || 0 }); setLessonDialog(false); setLessonForm({ title: "", description: "", video_url: "", duration_minutes: "0", is_free: false }); if (selectedCourse) loadModules(selectedCourse); toast.success("Aula criada!"); };
  const deleteLesson = async (id: string) => { await supabase.from("lessons").delete().eq("id", id); if (selectedCourse) loadModules(selectedCourse); toast.success("Excluída"); };

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <PageTitle icon={<BookOpen className="h-6 w-6" />} title="Conteúdo" subtitle="Gerencie cursos, módulos e aulas" />
        <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
          <DialogTrigger asChild><Button size="sm" className="gap-1 rounded-xl text-[13px] font-bold gradient-primary text-primary-foreground" onClick={() => { setEditCourseId(null); setCourseForm({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" }); }}><Plus className="h-4 w-4" /> Curso</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>{editCourseId ? "Editar" : "Novo"} Curso</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Título</Label><Input value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} /></div><div><Label>Descrição</Label><Textarea value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} /></div><div><Label>Categoria</Label><Input value={courseForm.category} onChange={e => setCourseForm(p => ({ ...p, category: e.target.value }))} /></div><div><Label>Thumbnail</Label><Input value={courseForm.thumbnail_url} onChange={e => setCourseForm(p => ({ ...p, thumbnail_url: e.target.value }))} placeholder="https://..." /></div><div><Label>Produto</Label><Select value={courseForm.product_id} onValueChange={v => setCourseForm(p => ({ ...p, product_id: v }))}><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{products.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div><Button onClick={saveCourse} className="w-full gradient-primary text-primary-foreground">Salvar</Button></div></DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold px-1">Cursos</p>
          {courses.length === 0 ? <p className="text-[13px] text-muted-foreground text-center py-4">Nenhum curso</p> : courses.map(c => (
            <div key={c.id} onClick={() => setSelectedCourse(c.id)} className={`rounded-xl p-3.5 cursor-pointer transition-all border ${selectedCourse === c.id ? "border-primary/20 bg-primary/5" : "border-border bg-muted/20 hover:bg-muted/40"}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-[13px] text-foreground">{c.title}</h4>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); togglePublish(c.id, c.is_published); }}>{c.is_published ? <Eye className="h-3 w-3 text-primary" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}</Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={e => { e.stopPropagation(); setEditCourseId(c.id); setCourseForm({ title: c.title, description: c.description || "", category: c.category || "geral", product_id: c.product_id || "", thumbnail_url: c.thumbnail_url || "" }); setCourseDialog(true); }}><Edit className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteCourse(c.id); }}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{c.category} • {c.is_published ? "Publicado" : "Rascunho"}</p>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-3">
          {selectedCourse ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Módulos & Aulas</p>
                <Dialog open={moduleDialog} onOpenChange={setModuleDialog}><DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1 rounded-xl text-[12px]"><Plus className="h-3 w-3" /> Módulo</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Novo Módulo</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Título</Label><Input value={moduleForm.title} onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))} /></div><div><Label>Descrição</Label><Textarea value={moduleForm.description} onChange={e => setModuleForm(p => ({ ...p, description: e.target.value }))} /></div><Button onClick={saveModule} className="w-full gradient-primary text-primary-foreground">Salvar</Button></div></DialogContent></Dialog>
              </div>
              {modules.length === 0 ? <div className="text-center py-12 text-muted-foreground text-[13px]">Adicione módulos</div> : modules.map(mod => (
                <Panel key={mod.id} className="p-0">
                  <div className="flex items-center justify-between p-3.5 border-b border-border">
                    <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /><h4 className="font-bold text-[13px] text-foreground">{mod.title}</h4><span className="text-[11px] text-muted-foreground">({mod.lessons.length})</span></div>
                    <div className="flex gap-0.5">
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px] text-muted-foreground" onClick={() => { setLessonModuleId(mod.id); setLessonForm({ title: "", description: "", video_url: "", duration_minutes: "0", is_free: false }); setLessonDialog(true); }}><Plus className="h-3 w-3" /> Aula</Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteModule(mod.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  {mod.lessons.length > 0 && mod.lessons.map((lesson: any, idx: number) => (
                    <div key={lesson.id} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/30 transition-colors border-b border-border/50">
                      <span className="text-[11px] text-muted-foreground w-5">{idx + 1}</span>
                      <PlayCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      <div className="flex-1 min-w-0"><p className="text-[13px] text-foreground/60 truncate">{lesson.title}</p><div className="flex items-center gap-2 mt-0.5">{lesson.duration_minutes > 0 && <span className="text-[10px] text-muted-foreground">{lesson.duration_minutes}min</span>}{lesson.is_free && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-primary bg-primary/10">FREE</span>}{lesson.video_url && <LinkIcon className="h-3 w-3 text-muted-foreground/30" />}</div></div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => deleteLesson(lesson.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </Panel>
              ))}
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground/40"><Layers className="h-12 w-12 mx-auto mb-4 opacity-30" /><p className="text-[13px]">Selecione um curso</p></div>
          )}
        </div>
      </div>

      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}><DialogContent><DialogHeader><DialogTitle>Nova Aula</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Título</Label><Input value={lessonForm.title} onChange={e => setLessonForm(p => ({ ...p, title: e.target.value }))} /></div><div><Label>Descrição</Label><Textarea value={lessonForm.description} onChange={e => setLessonForm(p => ({ ...p, description: e.target.value }))} /></div><div><Label>URL vídeo</Label><Input value={lessonForm.video_url} onChange={e => setLessonForm(p => ({ ...p, video_url: e.target.value }))} placeholder="https://youtu.be/..." /></div><div><Label>Duração (min)</Label><Input type="number" value={lessonForm.duration_minutes} onChange={e => setLessonForm(p => ({ ...p, duration_minutes: e.target.value }))} /></div><div className="flex items-center gap-2"><Switch checked={lessonForm.is_free} onCheckedChange={v => setLessonForm(p => ({ ...p, is_free: v }))} /><Label>Gratuita</Label></div><Button onClick={saveLesson} className="w-full gradient-primary text-primary-foreground">Salvar</Button></div></DialogContent></Dialog>
    </PageShell>
  );
}
