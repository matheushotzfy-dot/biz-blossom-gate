import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, BookOpen, Layers, PlayCircle, Trash2, GripVertical, X,
  ChevronDown, ChevronRight, Clock, Video, FileText, Check,
  Calendar, Paperclip, ArrowLeft, Eye, EyeOff, Upload,
  Bold, Italic, Link as LinkIcon, List, Type, Image as ImageIcon,
  Globe, Lock, Save, CheckCircle2, Loader2, AlertCircle
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

  // Inline editing states
  const [editingLessonTitle, setEditingLessonTitle] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonDripDays, setLessonDripDays] = useState(0);
  const [lessonIsFree, setLessonIsFree] = useState(false);
  const [lessonDripEnabled, setLessonDripEnabled] = useState(false);

  // Module creation
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
    // Auto-expand all modules
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
    // Update local state
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
    await supabase.from("modules").insert({
      course_id: courseId, title: newModuleTitle.trim(), sort_order: modules.length
    });
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
    await supabase.from("lessons").insert({
      module_id: moduleId, title: "Nova Aula", sort_order: mod?.lessons.length || 0
    });
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
    await Promise.all(newOrder.map((l, i) =>
      supabase.from("lessons").update({ sort_order: i }).eq("id", l.id)
    ));
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

  // ─── Toggle Module Expand ─────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedModules(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // ─── Extract Video ID ─────────────────────────────────────────
  const getVideoThumbnail = (url: string) => {
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&"'>]+)/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
    return null;
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center flex-col gap-4">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-white/40 text-sm">Curso não encontrado</p>
        <Button variant="ghost" onClick={() => navigate("/vendas/conteudo")} className="text-white/50">Voltar</Button>
      </div>
    );
  }

  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);

  return (
    <div className="h-screen w-screen bg-[#050505] flex flex-col overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif" }}>
      {/* ═══ Top Bar ═══ */}
      <div className="h-14 border-b border-white/[0.06] bg-[#0A0A0A]/80 backdrop-blur-xl flex items-center justify-between px-4 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/vendas/conteudo")} className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-colors">
            <ArrowLeft className="h-4 w-4 text-white/50" />
          </button>
          <div className="h-5 w-px bg-white/[0.08]" />
          <div>
            <h1 className="text-[13px] font-semibold text-white/90 leading-tight">{course.title}</h1>
            <p className="text-[10px] text-white/30">{modules.length} módulos · {totalLessons} aulas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save Status */}
          <AnimatePresence mode="wait">
            <motion.div
              key={saveStatus}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-1.5"
            >
              {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin text-white/30" /><span className="text-[11px] text-white/30">Salvando...</span></>}
              {saveStatus === "saved" && <><CheckCircle2 className="h-3 w-3 text-emerald-400" /><span className="text-[11px] text-emerald-400">Salvo</span></>}
              {saveStatus === "error" && <><AlertCircle className="h-3 w-3 text-red-400" /><span className="text-[11px] text-red-400">Erro</span></>}
            </motion.div>
          </AnimatePresence>

          <button
            onClick={togglePublish}
            className={cn(
              "h-8 px-4 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all",
              course.is_published
                ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "bg-white/[0.06] text-white/60 border border-white/[0.08] hover:bg-white/[0.1]"
            )}
          >
            {course.is_published ? <><Eye className="h-3 w-3" /> Publicado</> : <><EyeOff className="h-3 w-3" /> Rascunho</>}
          </button>
        </div>
      </div>

      {/* ═══ Split Screen ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT: Module Sidebar (30%) ─── */}
        <div className="w-[340px] min-w-[280px] max-w-[400px] bg-[#0A0A0A] border-r border-white/[0.05] flex flex-col overflow-hidden">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/[0.04]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">Estrutura</span>
              <span className="text-[10px] text-white/20">{totalLessons} aulas</span>
            </div>
          </div>

          {/* Module List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {modules.map((mod, idx) => (
              <div key={mod.id} className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
                {/* Module Header */}
                <div
                  className="flex items-center gap-2 p-3 cursor-pointer hover:bg-white/[0.03] transition-colors group"
                  onClick={() => toggleExpand(mod.id)}
                >
                  <motion.div animate={{ rotate: expandedModules.has(mod.id) ? 90 : 0 }} transition={{ duration: 0.15 }}>
                    <ChevronRight className="h-3.5 w-3.5 text-white/25" />
                  </motion.div>
                  <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-emerald-400">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white/80 truncate">{mod.title}</p>
                    <p className="text-[9px] text-white/25">{mod.lessons.length} aulas</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteModule(mod.id); }}
                    className="h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="h-3 w-3 text-red-400/60" />
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
                      <div className="border-t border-white/[0.04] px-1.5 py-1.5">
                        <Reorder.Group
                          axis="y"
                          values={mod.lessons}
                          onReorder={(newOrder) => reorderLessons(mod.id, newOrder)}
                          className="space-y-0.5"
                        >
                          {mod.lessons.map((lesson) => (
                            <Reorder.Item
                              key={lesson.id}
                              value={lesson}
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer group/lesson transition-all",
                                selectedLesson?.id === lesson.id
                                  ? "bg-emerald-500/[0.08] border border-emerald-500/20"
                                  : "hover:bg-white/[0.04] border border-transparent"
                              )}
                              onClick={() => selectLesson(lesson)}
                            >
                              <GripVertical className="h-3 w-3 text-white/10 opacity-0 group-hover/lesson:opacity-100 transition-opacity cursor-grab shrink-0" />
                              <div className="h-6 w-6 rounded-md bg-white/[0.04] flex items-center justify-center shrink-0">
                                <PlayCircle className="h-3 w-3 text-white/30" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-[11px] truncate",
                                  selectedLesson?.id === lesson.id ? "text-emerald-300 font-semibold" : "text-white/60"
                                )}>{lesson.title}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {lesson.is_free && <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 rounded font-bold">FREE</span>}
                                  {lesson.video_url && <Video className="h-2.5 w-2.5 text-white/20" />}
                                  {(lesson.drip_days || 0) > 0 && <Clock className="h-2.5 w-2.5 text-amber-400/40" />}
                                  {/* Published / Draft indicator */}
                                  <span className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    lesson.video_url ? "bg-emerald-400" : "bg-amber-400/50"
                                  )} />
                                </div>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); deleteLesson(lesson.id); }}
                                className="h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover/lesson:opacity-100 hover:bg-red-500/10 transition-all shrink-0"
                              >
                                <Trash2 className="h-2.5 w-2.5 text-red-400/50" />
                              </button>
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>

                        {/* Add Lesson Button */}
                        <button
                          onClick={() => createLesson(mod.id)}
                          className="w-full mt-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-white/20 hover:text-emerald-400 hover:bg-emerald-500/[0.04] transition-all"
                        >
                          <Plus className="h-3 w-3" />
                          <span className="text-[10px] font-medium">Adicionar aula</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* New Module Button */}
            {showNewModule ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-white/[0.02] border border-emerald-500/20 p-3 space-y-2"
              >
                <input
                  autoFocus
                  value={newModuleTitle}
                  onChange={e => setNewModuleTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createModule(); if (e.key === "Escape") setShowNewModule(false); }}
                  placeholder="Nome do módulo..."
                  className="w-full bg-transparent text-[12px] text-white/80 placeholder:text-white/20 focus:outline-none"
                />
                <div className="flex gap-1.5">
                  <button onClick={createModule} className="h-7 px-3 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors">Criar</button>
                  <button onClick={() => setShowNewModule(false)} className="h-7 px-3 rounded-md bg-white/[0.04] text-white/30 text-[10px] hover:bg-white/[0.06] transition-colors">Cancelar</button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setShowNewModule(true)}
                className="w-full rounded-xl border-2 border-dashed border-white/[0.06] py-4 flex flex-col items-center gap-1.5 text-white/20 hover:text-emerald-400 hover:border-emerald-500/30 transition-all group"
              >
                <Plus className="h-4 w-4" />
                <span className="text-[10px] font-medium">Novo Módulo</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Lesson Canvas (70%) ─── */}
        <div className="flex-1 bg-[#050505] overflow-y-auto relative">
          {/* Subtle radial gradient for depth */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 30% at 50% 0%, rgba(99,102,241,0.03), transparent)" }} />

          {selectedLesson ? (
            <div className="relative z-10 max-w-3xl mx-auto px-8 py-10 space-y-8">
              {/* ─── Lesson Header (Inline Edit) ─── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400/50">
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
                    className="w-full bg-transparent text-3xl font-bold tracking-tight text-white focus:outline-none border-b border-emerald-500/20 pb-1"
                    autoFocus
                  />
                ) : (
                  <h2
                    onClick={() => { setEditingLessonTitle(true); setTimeout(() => titleInputRef.current?.focus(), 50); }}
                    className="text-3xl font-bold tracking-tight text-white cursor-text hover:text-white/80 transition-colors"
                  >
                    {lessonTitle || "Sem título"}
                  </h2>
                )}
              </div>

              {/* ─── Video Dropzone ─── */}
              <div className="rounded-2xl bg-[#141415] border-2 border-dashed border-white/[0.08] overflow-hidden group/video">
                {lessonVideoUrl ? (
                  <div className="relative">
                    {getVideoThumbnail(lessonVideoUrl) ? (
                      <div className="relative aspect-video">
                        <img src={getVideoThumbnail(lessonVideoUrl)!} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                            <PlayCircle className="h-8 w-8 text-white" />
                          </div>
                        </div>
                        {/* Processing indicator */}
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-[10px] text-white/70 font-medium">Vídeo pronto · 1080p</span>
                            <div className="flex-1" />
                            <button
                              onClick={() => { setLessonVideoUrl(""); autoSave("video_url", null); }}
                              className="h-6 w-6 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                              <X className="h-3 w-3 text-white/40" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Video className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-[12px] text-white/60 font-medium truncate max-w-[300px]">{lessonVideoUrl}</p>
                            <p className="text-[10px] text-emerald-400">Vídeo vinculado</p>
                          </div>
                        </div>
                        <button
                          onClick={() => { setLessonVideoUrl(""); autoSave("video_url", null); }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors"
                        >
                          <X className="h-4 w-4 text-white/30" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video flex flex-col items-center justify-center gap-3 text-white/15">
                    <div className="h-16 w-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                      <Upload className="h-7 w-7" />
                    </div>
                    <p className="text-[13px] font-medium">Adicione um vídeo</p>
                    <p className="text-[11px] text-white/10">Cole o link do YouTube ou Vimeo abaixo</p>
                  </div>
                )}
              </div>

              {/* Video URL Input */}
              <div className="relative">
                <Video className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/15" />
                <input
                  value={lessonVideoUrl}
                  onChange={e => { setLessonVideoUrl(e.target.value); debouncedSave("video_url", e.target.value || null); }}
                  placeholder="https://youtu.be/... ou https://vimeo.com/..."
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[12px] text-white/70 placeholder:text-white/15 focus:outline-none focus:border-emerald-500/30 transition-colors"
                />
              </div>

              {/* ─── Description Editor ─── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-3.5 w-3.5 text-white/20" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/20">Descrição da Aula</span>
                </div>
                {/* Floating Toolbar */}
                <div className="flex items-center gap-0.5 mb-2 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1 w-fit">
                  {[
                    { icon: Bold, label: "Bold" },
                    { icon: Italic, label: "Italic" },
                    { icon: LinkIcon, label: "Link" },
                    { icon: List, label: "List" },
                    { icon: Type, label: "Heading" },
                  ].map(btn => (
                    <button key={btn.label} className="h-7 w-7 rounded-md flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all" title={btn.label}>
                      <btn.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
                <textarea
                  value={lessonDescription}
                  onChange={e => { setLessonDescription(e.target.value); debouncedSave("description", e.target.value || null); }}
                  placeholder="Descreva o que será abordado nesta aula..."
                  rows={6}
                  className="w-full bg-transparent text-[13px] text-white/60 placeholder:text-white/10 leading-relaxed focus:outline-none resize-none"
                />
              </div>

              {/* ─── Bento Box: Drip + Attachments ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Drip Content Card */}
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-white/70">Gotejamento</p>
                      <p className="text-[9px] text-white/25">Liberação programada</p>
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
                          <span className="text-[10px] text-white/30">Liberar após</span>
                          <input
                            type="number"
                            min={0}
                            value={lessonDripDays}
                            onChange={e => { const v = parseInt(e.target.value) || 0; setLessonDripDays(v); debouncedSave("drip_days", v); }}
                            className="h-8 w-16 rounded-lg bg-white/[0.04] border border-white/[0.06] text-center text-[12px] text-white/70 focus:outline-none focus:border-amber-500/30"
                          />
                          <span className="text-[10px] text-white/30">dias da compra</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Free Lesson Card */}
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Globe className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-white/70">Aula Gratuita</p>
                      <p className="text-[9px] text-white/25">Disponível sem compra</p>
                    </div>
                    <Switch
                      checked={lessonIsFree}
                      onCheckedChange={v => { setLessonIsFree(v); autoSave("is_free", v); }}
                    />
                  </div>
                </div>

                {/* Attachments Card */}
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-4 sm:col-span-2">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Paperclip className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-white/70">Anexos da Aula</p>
                      <p className="text-[9px] text-white/25">PDFs, planilhas e materiais complementares</p>
                    </div>
                  </div>
                  <div className="rounded-lg border-2 border-dashed border-white/[0.06] py-6 flex flex-col items-center gap-2 text-white/15 hover:text-white/25 hover:border-white/[0.1] transition-all cursor-pointer">
                    <Upload className="h-5 w-5" />
                    <p className="text-[10px] font-medium">Arraste arquivos ou clique para enviar</p>
                    <p className="text-[9px] text-white/10">PDF, DOCX, XLSX — até 10MB</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State — No lesson selected */
            <div className="relative z-10 h-full flex flex-col items-center justify-center gap-4">
              <div className="h-20 w-20 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-white/10" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-medium text-white/30 mb-1">Selecione uma aula</p>
                <p className="text-[11px] text-white/15">Clique em uma aula na barra lateral para editá-la</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
