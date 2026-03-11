import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, BookOpen, Layers, PlayCircle, Trash2, GripVertical, X,
  ChevronDown, ChevronRight, Clock, Video, FileText, Check,
  Calendar, Paperclip, ArrowLeft, Eye, EyeOff, Upload,
  Bold, Italic, Link as LinkIcon, List, Type, Image as ImageIcon,
  Globe, Lock, Save, CheckCircle2, Loader2, AlertCircle, Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, Reorder } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────
interface Course {
  id: string; title: string; description: string | null; is_published: boolean;
  user_id: string; product_id: string | null;
}
interface Module {
  id: string; course_id: string; title: string; description: string | null;
  sort_order: number | null; lessons: Lesson[];
}
interface Lesson {
  id: string; module_id: string; title: string; description: string | null;
  video_url: string | null; duration_minutes: number | null; is_free: boolean;
  sort_order: number | null; drip_days: number | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ═══════════════════════════════════════════════════════════════════
// COURSE BUILDER — Split Screen Enterprise
// ═══════════════════════════════════════════════════════════════════
export default function CourseBuilder() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loading, setLoading] = useState(true);

  const [editingLessonTitle, setEditingLessonTitle] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonDripDays, setLessonDripDays] = useState(0);
  const [lessonIsFree, setLessonIsFree] = useState(false);
  const [lessonDripEnabled, setLessonDripEnabled] = useState(false);

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [showNewModule, setShowNewModule] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load Course & Modules ──────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!courseId) return;
    const [courseRes, modsRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).single(),
      supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order"),
    ]);
    if (courseRes.data) setCourse(courseRes.data as Course);
    const mods = modsRes.data || [];
    const moduleIds = mods.map(m => m.id);
    let lessons: Lesson[] = [];
    if (moduleIds.length > 0) {
      const { data: l } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");
      if (l) lessons = l as Lesson[];
    }
    const mapped = mods.map(m => ({ ...m, lessons: lessons.filter(l => l.module_id === m.id) })) as Module[];
    setModules(mapped);
    setExpandedModules(new Set(mods.map(m => m.id)));
    setLoading(false);
  }, [courseId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Auto-save Logic ────────────────────────────────────────────
  const autoSave = useCallback(async (field: string, value: any) => {
    if (!selectedLesson) return;
    setSaveStatus("saving");
    const { error } = await supabase.from("lessons").update({ [field]: value }).eq("id", selectedLesson.id);
    if (error) { setSaveStatus("error"); return; }
    setSaveStatus("saved");
    setModules(prev => prev.map(m => ({
      ...m,
      lessons: m.lessons.map(l => l.id === selectedLesson.id ? { ...l, [field]: value } : l)
    })));
    setSelectedLesson(prev => prev ? { ...prev, [field]: value } : prev);
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [selectedLesson]);

  const debouncedSave = useCallback((field: string, value: any) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(() => autoSave(field, value), 1200);
  }, [autoSave]);

  // ─── Select Lesson ──────────────────────────────────────────────
  const selectLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setLessonTitle(lesson.title);
    setLessonDescription(lesson.description || "");
    setLessonVideoUrl(lesson.video_url || "");
    setLessonDripDays(lesson.drip_days || 0);
    setLessonIsFree(lesson.is_free);
    setLessonDripEnabled((lesson.drip_days || 0) > 0);
    setEditingLessonTitle(false);
  };

  // ─── Module CRUD ────────────────────────────────────────────────
  const createModule = async () => {
    if (!courseId || !newModuleTitle.trim()) return;
    await supabase.from("modules").insert({ course_id: courseId, title: newModuleTitle.trim(), sort_order: modules.length });
    setNewModuleTitle(""); setShowNewModule(false);
    toast.success("Módulo criado!"); loadAll();
  };

  const deleteModule = async (id: string) => {
    await supabase.from("lessons").delete().in("module_id", [id]);
    await supabase.from("modules").delete().eq("id", id);
    if (selectedLesson && modules.find(m => m.id === id)?.lessons.some(l => l.id === selectedLesson.id)) {
      setSelectedLesson(null);
    }
    toast.success("Módulo excluído"); loadAll();
  };

  // ─── Lesson CRUD ───────────────────────────────────────────────
  const createLesson = async (moduleId: string) => {
    const mod = modules.find(m => m.id === moduleId);
    await supabase.from("lessons").insert({ module_id: moduleId, title: "Nova Aula", sort_order: mod?.lessons.length || 0 });
    toast.success("Aula criada!"); loadAll();
  };

  const deleteLesson = async (id: string) => {
    await supabase.from("lessons").delete().eq("id", id);
    if (selectedLesson?.id === id) setSelectedLesson(null);
    toast.success("Aula excluída"); loadAll();
  };

  // ─── Drag & Drop Reorder ───────────────────────────────────────
  const reorderLessons = async (moduleId: string, newOrder: Lesson[]) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, lessons: newOrder } : m));
    setSaveStatus("saving");
    await Promise.all(newOrder.map((l, i) => supabase.from("lessons").update({ sort_order: i }).eq("id", l.id)));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  // ─── Publish Toggle ────────────────────────────────────────────
  const togglePublish = async () => {
    if (!course || !user) return;
    await supabase.from("courses").update({ is_published: !course.is_published }).eq("id", course.id).eq("user_id", user.id);
    setCourse(prev => prev ? { ...prev, is_published: !prev.is_published } : prev);
    toast.success(course.is_published ? "Despublicado" : "Publicado!");
  };

  const toggleExpand = (id: string) => {
    setExpandedModules(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const getVideoThumbnail = (url: string) => {
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&"'>]+)/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
    return null;
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center flex-col gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground text-sm">Curso não encontrado</p>
        <Button variant="ghost" onClick={() => navigate("/vendas/conteudo")}>Voltar</Button>
      </div>
    );
  }

  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* ═══ Top Bar ═══ */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between px-5 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/vendas/conteudo")}
            className="h-9 w-9 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-center hover:bg-muted transition-all active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">{course.title}</h1>
            <p className="text-[11px] text-muted-foreground">{modules.length} módulos · {totalLessons} aulas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            <motion.div key={saveStatus} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="flex items-center gap-1.5">
              {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Salvando...</span></>}
              {saveStatus === "saved" && <><CheckCircle2 className="h-3 w-3 text-primary" /><span className="text-[11px] text-primary font-medium">Salvo</span></>}
              {saveStatus === "error" && <><AlertCircle className="h-3 w-3 text-destructive" /><span className="text-[11px] text-destructive">Erro</span></>}
            </motion.div>
          </AnimatePresence>

          <button
            onClick={togglePublish}
            className={cn(
              "h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95",
              course.is_published
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
                : "bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80"
            )}
          >
            {course.is_published ? <><Eye className="h-3.5 w-3.5" /> Publicado</> : <><EyeOff className="h-3.5 w-3.5" /> Rascunho</>}
          </button>
        </div>
      </header>

      {/* ═══ Split Screen ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT: Module Sidebar ─── */}
        <aside className="w-[320px] min-w-[280px] bg-card border-r border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-bold text-foreground">Estrutura</span>
              </div>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-medium">{totalLessons} aulas</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {modules.map((mod, idx) => (
              <div key={mod.id} className="rounded-xl bg-muted/30 dark:bg-muted/10 border border-border/50 overflow-hidden">
                {/* Module Header */}
                <div
                  className="flex items-center gap-2.5 px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors group"
                  onClick={() => toggleExpand(mod.id)}
                >
                  <motion.div animate={{ rotate: expandedModules.has(mod.id) ? 90 : 0 }} transition={{ duration: 0.15 }}>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </motion.div>
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-primary">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{mod.title}</p>
                    <p className="text-[10px] text-muted-foreground">{mod.lessons.length} aulas</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteModule(mod.id); }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="h-3 w-3 text-destructive/60" />
                  </button>
                </div>

                {/* Lessons */}
                <AnimatePresence>
                  {expandedModules.has(mod.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/40 px-2 py-1.5">
                        <Reorder.Group axis="y" values={mod.lessons} onReorder={(newOrder) => reorderLessons(mod.id, newOrder)} className="space-y-0.5">
                          {mod.lessons.map((lesson) => (
                            <Reorder.Item
                              key={lesson.id}
                              value={lesson}
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-2.5 rounded-lg cursor-pointer group/lesson transition-all",
                                selectedLesson?.id === lesson.id
                                  ? "bg-primary/10 border border-primary/20 shadow-sm"
                                  : "hover:bg-muted/60 border border-transparent"
                              )}
                              onClick={() => selectLesson(lesson)}
                            >
                              <GripVertical className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover/lesson:opacity-100 transition-opacity cursor-grab shrink-0" />
                              <div className={cn(
                                "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                                selectedLesson?.id === lesson.id ? "bg-primary/15" : "bg-muted/50"
                              )}>
                                <PlayCircle className={cn("h-3.5 w-3.5", selectedLesson?.id === lesson.id ? "text-primary" : "text-muted-foreground/50")} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-[12px] truncate font-medium",
                                  selectedLesson?.id === lesson.id ? "text-primary font-semibold" : "text-foreground/70"
                                )}>{lesson.title}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {lesson.is_free && <span className="text-[8px] bg-primary/10 text-primary px-1.5 rounded-md font-bold">FREE</span>}
                                  {lesson.video_url && <Video className="h-2.5 w-2.5 text-muted-foreground/40" />}
                                  {(lesson.drip_days || 0) > 0 && <Clock className="h-2.5 w-2.5 text-warning/60" />}
                                  <span className={cn("h-1.5 w-1.5 rounded-full", lesson.video_url ? "bg-primary" : "bg-warning/50")} />
                                </div>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); deleteLesson(lesson.id); }}
                                className="h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover/lesson:opacity-100 hover:bg-destructive/10 transition-all shrink-0"
                              >
                                <Trash2 className="h-2.5 w-2.5 text-destructive/50" />
                              </button>
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>

                        <button
                          onClick={() => createLesson(mod.id)}
                          className="w-full mt-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-primary/5 transition-all"
                        >
                          <Plus className="h-3 w-3" />
                          <span className="text-[11px] font-medium">Adicionar aula</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* New Module */}
            {showNewModule ? (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2.5">
                <input
                  autoFocus
                  value={newModuleTitle}
                  onChange={e => setNewModuleTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createModule(); if (e.key === "Escape") setShowNewModule(false); }}
                  placeholder="Nome do módulo..."
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                />
                <div className="flex gap-1.5">
                  <button onClick={createModule} className="h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors">Criar</button>
                  <button onClick={() => setShowNewModule(false)} className="h-7 px-3 rounded-lg bg-muted text-muted-foreground text-[11px] hover:bg-muted/80 transition-colors">Cancelar</button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setShowNewModule(true)}
                className="w-full rounded-xl border-2 border-dashed border-border/60 py-5 flex flex-col items-center gap-1.5 text-muted-foreground/40 hover:text-primary hover:border-primary/30 transition-all group"
              >
                <Plus className="h-4 w-4" />
                <span className="text-[11px] font-medium">Novo Módulo</span>
              </button>
            )}
          </div>
        </aside>

        {/* ─── RIGHT: Lesson Canvas ─── */}
        <main className="flex-1 bg-background overflow-y-auto relative">
          {selectedLesson ? (
            <div className="w-full max-w-3xl mx-auto px-6 md:px-10 py-10 space-y-8">
              {/* ─── Lesson Header ─── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Hash className="h-3 w-3 text-primary/50" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary/60">
                    {modules.find(m => m.lessons.some(l => l.id === selectedLesson.id))?.title}
                  </span>
                </div>
                {editingLessonTitle ? (
                  <input
                    ref={titleInputRef}
                    value={lessonTitle}
                    onChange={e => setLessonTitle(e.target.value)}
                    onBlur={() => { setEditingLessonTitle(false); if (lessonTitle.trim() && lessonTitle !== selectedLesson.title) autoSave("title", lessonTitle.trim()); }}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="w-full bg-transparent text-3xl font-black tracking-tight text-foreground focus:outline-none border-b-2 border-primary/30 pb-2"
                    autoFocus
                  />
                ) : (
                  <h2
                    onClick={() => { setEditingLessonTitle(true); setTimeout(() => titleInputRef.current?.focus(), 50); }}
                    className="text-3xl font-black tracking-tight text-foreground cursor-text hover:text-foreground/80 transition-colors"
                  >
                    {lessonTitle || "Sem título"}
                  </h2>
                )}
              </div>

              {/* ─── Video Section ─── */}
              <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
                {lessonVideoUrl ? (
                  <div className="relative">
                    {getVideoThumbnail(lessonVideoUrl) ? (
                      <div className="relative aspect-video bg-muted">
                        <img src={getVideoThumbnail(lessonVideoUrl)!} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-foreground/30 dark:bg-background/40 flex items-center justify-center">
                          <div className="h-16 w-16 rounded-full bg-card/80 backdrop-blur-xl border border-border flex items-center justify-center shadow-lg">
                            <PlayCircle className="h-8 w-8 text-primary" />
                          </div>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-border/60">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[11px] text-foreground/70 font-medium">Vídeo pronto · 1080p</span>
                            <div className="flex-1" />
                            <button
                              onClick={() => { setLessonVideoUrl(""); autoSave("video_url", null); }}
                              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Video className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-[13px] text-foreground font-medium truncate max-w-[300px]">{lessonVideoUrl}</p>
                            <p className="text-[11px] text-primary">Vídeo vinculado</p>
                          </div>
                        </div>
                        <button
                          onClick={() => { setLessonVideoUrl(""); autoSave("video_url", null); }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video flex flex-col items-center justify-center gap-3 text-muted-foreground/30">
                    <div className="h-16 w-16 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-center">
                      <Upload className="h-7 w-7" />
                    </div>
                    <p className="text-sm font-medium">Adicione um vídeo</p>
                    <p className="text-xs text-muted-foreground/40">Cole o link do YouTube ou Vimeo abaixo</p>
                  </div>
                )}
              </div>

              {/* Video URL Input */}
              <div className="relative">
                <Video className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <input
                  value={lessonVideoUrl}
                  onChange={e => { setLessonVideoUrl(e.target.value); debouncedSave("video_url", e.target.value || null); }}
                  placeholder="https://youtu.be/... ou https://vimeo.com/..."
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-muted/30 dark:bg-muted/10 border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                />
              </div>

              {/* ─── Description ─── */}
              <div className="rounded-2xl bg-card border border-border p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground/50" />
                  <span className="text-xs font-bold text-foreground">Descrição da Aula</span>
                </div>
                {/* Toolbar */}
                <div className="flex items-center gap-0.5 bg-muted/40 dark:bg-muted/15 border border-border/60 rounded-lg p-1 w-fit">
                  {[
                    { icon: Bold, label: "Bold" },
                    { icon: Italic, label: "Italic" },
                    { icon: LinkIcon, label: "Link" },
                    { icon: List, label: "List" },
                    { icon: Type, label: "Heading" },
                  ].map(btn => (
                    <button key={btn.label} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all" title={btn.label}>
                      <btn.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
                <textarea
                  value={lessonDescription}
                  onChange={e => { setLessonDescription(e.target.value); debouncedSave("description", e.target.value || null); }}
                  placeholder="Descreva o que será abordado nesta aula..."
                  rows={6}
                  className="w-full bg-transparent text-sm text-foreground/80 placeholder:text-muted-foreground/30 leading-relaxed focus:outline-none resize-none"
                />
              </div>

              {/* ─── Settings Bento Grid ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Drip Content */}
                <div className="rounded-2xl bg-card border border-border p-5 space-y-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
                      <Calendar className="h-4.5 w-4.5 text-warning" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Gotejamento</p>
                      <p className="text-[11px] text-muted-foreground">Liberação programada</p>
                    </div>
                    <Switch
                      checked={lessonDripEnabled}
                      onCheckedChange={v => {
                        setLessonDripEnabled(v);
                        if (!v) { setLessonDripDays(0); autoSave("drip_days", 0); }
                      }}
                    />
                  </div>
                  <AnimatePresence>
                    {lessonDripEnabled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs text-muted-foreground">Liberar após</span>
                          <input
                            type="number"
                            min={0}
                            value={lessonDripDays}
                            onChange={e => { const v = parseInt(e.target.value) || 0; setLessonDripDays(v); debouncedSave("drip_days", v); }}
                            className="h-9 w-16 rounded-lg bg-muted/30 border border-border text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-warning/20 focus:border-warning/40"
                          />
                          <span className="text-xs text-muted-foreground">dias</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Free Lesson */}
                <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Globe className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Aula Gratuita</p>
                      <p className="text-[11px] text-muted-foreground">Disponível sem compra</p>
                    </div>
                    <Switch
                      checked={lessonIsFree}
                      onCheckedChange={v => { setLessonIsFree(v); autoSave("is_free", v); }}
                    />
                  </div>
                </div>

                {/* Attachments */}
                <div className="rounded-2xl bg-card border border-border p-5 sm:col-span-2 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center">
                      <Paperclip className="h-4.5 w-4.5 text-info" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Anexos da Aula</p>
                      <p className="text-[11px] text-muted-foreground">PDFs, planilhas e materiais complementares</p>
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-dashed border-border/60 py-8 flex flex-col items-center gap-2 text-muted-foreground/30 hover:text-muted-foreground/50 hover:border-border transition-all cursor-pointer">
                    <Upload className="h-5 w-5" />
                    <p className="text-xs font-medium">Arraste arquivos ou clique para enviar</p>
                    <p className="text-[10px] text-muted-foreground/40">PDF, DOCX, XLSX — até 10MB</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center gap-5">
              <div className="h-20 w-20 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/20" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground/40 mb-1">Selecione uma aula</p>
                <p className="text-sm text-muted-foreground/40">Clique em uma aula na barra lateral para editá-la</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
