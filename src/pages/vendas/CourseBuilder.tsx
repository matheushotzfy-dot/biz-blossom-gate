import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { TablesUpdate } from "@/integrations/supabase/types";
import {
 Plus, BookOpen, Layers, Play, PlayCircle, Trash2, GripVertical, X,
 ChevronRight, Clock, Video, FileText,
 Calendar, Paperclip, ArrowLeft, Eye, EyeOff, Upload,
 Globe, Lock, CheckCircle2, Loader2, AlertCircle, Hash,
 Download, File, Sparkles, ChevronDown, MoreHorizontal,
 Zap, Settings, Star, PanelLeftClose, PanelLeft,
 GraduationCap, Flame, Shield, Copy, ExternalLink, Users,
 Activity, Award, Target, CopyPlus, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import StudentPreviewPanel from "@/components/course/StudentPreviewPanel";

// ─── Types ────────────────────────────────────────────────────────
interface Course {
 id: string; title: string; description: string | null; is_published: boolean;
 user_id: string; product_id: string | null; thumbnail_url: string | null;
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
interface Attachment {
 id: string; lesson_id: string; user_id: string; file_name: string;
 file_url: string; file_size: number; file_type: string; created_at: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ─── Helpers ──────────────────────────────────────────────────────
function formatFileSize(bytes: number) {
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getVideoEmbed(url: string) {
 const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&"'>]+)/);
 if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
 const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
 if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
 return null;
}

function getVideoThumbnail(url: string) {
 const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^?&"'>]+)/);
 if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
 return null;
}

function isDirectVideoUrl(url: string) {
 return url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i);
}

const ease = [0.16, 1, 0.3, 1] as const;

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
  const [lessonDuration, setLessonDuration] = useState(0);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [showNewModule, setShowNewModule] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<"video" | "content" | "settings">("video");
  const [studentCount, setStudentCount] = useState(0);
  const [lessonStats, setLessonStats] = useState<Map<string, number>>(new Map());
  const [deleteTarget, setDeleteTarget] = useState<{ type: "module" | "lesson"; id: string; label: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const [courseSettingsOpen, setCourseSettingsOpen] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseCategory, setCourseCategory] = useState("");
  const [courseThumbnail, setCourseThumbnail] = useState("");
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

 // ─── Load All ───────────────────────────────────────────────────
 const loadAll = useCallback(async () => {
 if (!courseId) return;
 const [courseRes, modsRes, accessRes] = await Promise.all([
 supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
 supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order"),
 supabase.from("user_access").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("status", "active"),
 ]);
 if (courseRes.data) setCourse(courseRes.data as Course);
 setStudentCount(accessRes.count || 0);
 const mods = modsRes.data || [];
 const moduleIds = mods.map(m => m.id);
 let lessons: Lesson[] = [];
 if (moduleIds.length > 0) {
 const { data: l } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");
 if (l) lessons = l as Lesson[];
 const lessonIds = lessons.map(le => le.id);
 if (lessonIds.length > 0) {
 const { data: progressData } = await supabase.from("user_progress").select("lesson_id").eq("completed", true).in("lesson_id", lessonIds);
 const statsMap = new Map<string, number>();
 progressData?.forEach(p => statsMap.set(p.lesson_id, (statsMap.get(p.lesson_id) || 0) + 1));
 setLessonStats(statsMap);
 }
 }
  const mapped = mods.map(m => ({ ...m, lessons: lessons.filter(l => l.module_id === m.id) })) as Module[];
  setModules(mapped);
  setExpandedModules(new Set(mods.map(m => m.id)));
  // Auto-select first lesson if none selected
  setSelectedLesson(prev => {
    if (!prev && lessons.length > 0) {
      const firstLesson = mapped.flatMap(m => m.lessons)[0];
      if (firstLesson) {
        setLessonTitle(firstLesson.title);
        setLessonDescription(firstLesson.description || "");
        setLessonVideoUrl(firstLesson.video_url || "");
        setLessonDripDays(firstLesson.drip_days || 0);
        setLessonIsFree(firstLesson.is_free);
        setLessonDripEnabled((firstLesson.drip_days || 0) > 0);
        setLessonDuration(firstLesson.duration_minutes || 0);
        setActiveEditorTab("video");
        // Load attachments for auto-selected lesson
        supabase
          .from("lesson_attachments").select("*")
          .eq("lesson_id", firstLesson.id).order("created_at", { ascending: false })
          .then(({ data }) => setAttachments((data || []) as unknown as Attachment[]));
        return firstLesson;
      }
    }
    return prev;
  });
  setLoading(false);
  }, [courseId]);

 useEffect(() => { loadAll(); }, [loadAll]);

 // Auto-select fallback: if no lesson is selected but lessons exist, pick the first
 useEffect(() => {
   if (selectedLesson) return;
   const firstLesson = modules.flatMap(m => m.lessons)[0];
   if (firstLesson) {
     selectLesson(firstLesson);
   }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [modules, selectedLesson]);

 const loadAttachments = useCallback(async (lessonId: string) => {
 const { data } = await supabase
 .from("lesson_attachments").select("*")
 .eq("lesson_id", lessonId).order("created_at", { ascending: false });
 setAttachments((data || []) as unknown as Attachment[]);
 }, []);

 // ─── Auto-save ──────────────────────────────────────────────────
 const autoSave = useCallback(async (field: string, value: unknown) => {
 if (!selectedLesson) return;
 setSaveStatus("saving");
 const { error } = await supabase.from("lessons").update({ [field]: value } as never).eq("id", selectedLesson.id);
 if (error) { setSaveStatus("error"); return; }
 setSaveStatus("saved");
 setModules(prev => prev.map(m => ({
 ...m, lessons: m.lessons.map(l => l.id === selectedLesson.id ? { ...l, [field]: value } : l)
 })));
 setSelectedLesson(prev => prev ? { ...prev, [field]: value } : prev);
 setTimeout(() => setSaveStatus("idle"), 2000);
 }, [selectedLesson]);

 const debouncedSave = useCallback((field: string, value: unknown) => {
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
 setLessonDuration(lesson.duration_minutes || 0);
 setEditingLessonTitle(false);
 setActiveEditorTab("video");
 loadAttachments(lesson.id);
 };

 // ─── Video Upload ───────────────────────────────────────────────
 const handleVideoUpload = async (file: File) => {
 if (!user || !selectedLesson) return;
 const ALLOWED = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
 if (!ALLOWED.includes(file.type)) { toast.error("Formato inválido. Use MP4, WebM ou OGG."); return; }
 if (file.size > 500 * 1024 * 1024) { toast.error("Máximo 500MB."); return; }
 setUploadingVideo(true); setVideoUploadProgress(0);
 const ext = file.name.split(".").pop();
 const path = `${user.id}/videos/${crypto.randomUUID()}.${ext}`;
 const progressInterval = setInterval(() => {
 setVideoUploadProgress(prev => Math.min(prev + Math.random() * 15, 90));
 }, 500);
 const { error } = await supabase.storage.from("course-content").upload(path, file);
 clearInterval(progressInterval);
 if (error) { toast.error("Erro no upload"); setUploadingVideo(false); setVideoUploadProgress(0); return; }
 setVideoUploadProgress(100);
 const { data: urlData } = supabase.storage.from("course-content").getPublicUrl(path);
 setLessonVideoUrl(urlData.publicUrl);
 await autoSave("video_url", urlData.publicUrl);
 setUploadingVideo(false); setVideoUploadProgress(0);
 toast.success("Vídeo enviado!");
 };

 // ─── Attachment Upload ──────────────────────────────────────────
 const handleAttachmentUpload = async (file: File) => {
 if (!user || !selectedLesson) return;
 if (file.size > 50 * 1024 * 1024) { toast.error("Máximo 50MB."); return; }
 setUploadingAttachment(true);
 const ext = file.name.split(".").pop();
 const path = `${user.id}/attachments/${crypto.randomUUID()}.${ext}`;
 const { error: uploadError } = await supabase.storage.from("course-content").upload(path, file);
 if (uploadError) { toast.error("Erro no upload"); setUploadingAttachment(false); return; }
 const { data: urlData } = supabase.storage.from("course-content").getPublicUrl(path);
 const { error: dbError } = await supabase.from("lesson_attachments").insert({
 lesson_id: selectedLesson.id, user_id: user.id,
 file_name: file.name, file_url: urlData.publicUrl, file_size: file.size, file_type: file.type,
 });
 if (dbError) { toast.error("Erro ao salvar"); setUploadingAttachment(false); return; }
 await loadAttachments(selectedLesson.id);
 setUploadingAttachment(false); toast.success("Anexo adicionado!");
 };

 const deleteAttachment = async (att: Attachment) => {
 await supabase.from("lesson_attachments").delete().eq("id", att.id);
 setAttachments(prev => prev.filter(a => a.id !== att.id));
 toast.success("Anexo removido");
 };

 // ─── Module CRUD ────────────────────────────────────────────────
 const createModule = async () => {
 if (!courseId || !newModuleTitle.trim()) return;
 await supabase.from("modules").insert({ course_id: courseId, title: newModuleTitle.trim(), sort_order: modules.length });
 setNewModuleTitle(""); setShowNewModule(false);
 toast.success("Módulo criado!"); loadAll();
 };

 const renameModule = async (id: string, title: string) => {
 if (!title.trim()) return;
 await supabase.from("modules").update({ title: title.trim() }).eq("id", id);
 setEditingModuleId(null); loadAll();
 };

 const deleteModule = async (id: string) => {
 const mod = modules.find(m => m.id === id);
 setDeleteTarget({ type: "module", id, label: mod?.title || "Módulo" });
 };

 const confirmDelete = async () => {
 if (!deleteTarget) return;
 setDeletingItem(true);
 if (deleteTarget.type === "module") {
 await supabase.from("lessons").delete().in("module_id", [deleteTarget.id]);
 await supabase.from("modules").delete().eq("id", deleteTarget.id);
 if (selectedLesson && modules.find(m => m.id === deleteTarget.id)?.lessons.some(l => l.id === selectedLesson.id)) {
 setSelectedLesson(null);
 }
 toast.success("Módulo excluído");
 } else {
 await supabase.from("lesson_attachments").delete().eq("lesson_id", deleteTarget.id);
 await supabase.from("lessons").delete().eq("id", deleteTarget.id);
 if (selectedLesson?.id === deleteTarget.id) setSelectedLesson(null);
 toast.success("Aula excluída");
 }
 setDeletingItem(false);
 setDeleteTarget(null);
 loadAll();
 };

 // ─── Lesson CRUD ───────────────────────────────────────────────
 const createLesson = async (moduleId: string) => {
 const mod = modules.find(m => m.id === moduleId);
 const { data, error } = await supabase.from("lessons").insert({
 module_id: moduleId, title: "Nova Aula", sort_order: mod?.lessons.length || 0
 }).select().maybeSingle();
 if (error || !data) { toast.error("Erro ao criar aula"); return; }
 toast.success("Aula criada!");
 await loadAll();
 selectLesson(data as Lesson);
 };

 const deleteLesson = async (id: string) => {
 const lesson = modules.flatMap(m => m.lessons).find(l => l.id === id);
 setDeleteTarget({ type: "lesson", id, label: lesson?.title || "Aula" });
 };

 const duplicateLesson = async (lesson: Lesson) => {
 const mod = modules.find(m => m.lessons.some(l => l.id === lesson.id));
 if (!mod) return;
 const { data, error } = await supabase.from("lessons").insert({
 module_id: lesson.module_id,
 title: `${lesson.title} (cópia)`,
 description: lesson.description,
 video_url: lesson.video_url,
 duration_minutes: lesson.duration_minutes,
 is_free: lesson.is_free,
 drip_days: lesson.drip_days,
 sort_order: mod.lessons.length,
 }).select().maybeSingle();
 if (error || !data) { toast.error("Erro ao duplicar aula"); return; }
 toast.success("Aula duplicada!");
 await loadAll();
 selectLesson(data as Lesson);
 };

 // ─── Course Settings ───────────────────────────────────────────
 const openCourseSettings = () => {
 if (!course) return;
 setCourseTitle(course.title);
 setCourseDescription(course.description || "");
 setCourseCategory("");
 setCourseThumbnail("");
 setCourseSettingsOpen(true);
 };

 const saveCourseSettings = async () => {
 if (!course || !user) return;
 const updates: TablesUpdate<"courses"> = {};
 if (courseTitle.trim() && courseTitle !== course.title) updates.title = courseTitle.trim();
 if (courseDescription !== (course.description || "")) updates.description = courseDescription || null;
 if (Object.keys(updates).length === 0) { setCourseSettingsOpen(false); return; }
 await supabase.from("courses").update(updates).eq("id", course.id).eq("user_id", user.id);
 setCourse(prev => prev ? { ...prev, ...updates } : prev);
 setCourseSettingsOpen(false);
 toast.success("Configurações salvas!");
 };

 const handleThumbnailUpload = async (file: File) => {
 if (!user || !course) return;
 const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
 if (!ALLOWED.includes(file.type)) { toast.error("Use JPG, PNG ou WebP"); return; }
 if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
 setUploadingThumbnail(true);
 const ext = file.name.split(".").pop();
 const path = `${user.id}/thumbnails/${crypto.randomUUID()}.${ext}`;
 const { error } = await supabase.storage.from("product-images").upload(path, file);
 if (error) { toast.error("Erro no upload"); setUploadingThumbnail(false); return; }
 const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
 await supabase.from("courses").update({ thumbnail_url: urlData.publicUrl }).eq("id", course.id);
 setCourse(prev => prev ? { ...prev, thumbnail_url: urlData.publicUrl } : prev);
 setUploadingThumbnail(false);
 toast.success("Thumbnail atualizada!");
 };

 // ─── Drag & Drop ───────────────────────────────────────────────
 const reorderLessons = async (moduleId: string, newOrder: Lesson[]) => {
 setModules(prev => prev.map(m => m.id === moduleId ? { ...m, lessons: newOrder } : m));
 setSaveStatus("saving");
 await Promise.all(newOrder.map((l, i) => supabase.from("lessons").update({ sort_order: i }).eq("id", l.id)));
 setSaveStatus("saved");
 setTimeout(() => setSaveStatus("idle"), 2000);
 };

 // ─── Publish ───────────────────────────────────────────────────
 const togglePublish = async () => {
 if (!course || !user) return;
 await supabase.from("courses").update({ is_published: !course.is_published }).eq("id", course.id).eq("user_id", user.id);
 setCourse(prev => prev ? { ...prev, is_published: !prev.is_published } : prev);
 toast.success(course.is_published ? "Despublicado" : "Publicado!");
 };

 const toggleExpand = (id: string) => {
 setExpandedModules(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
 };

 // ─── Loading / Error ───────────────────────────────────────────
 if (loading) return (
 <div className="h-screen w-screen bg-background flex items-center justify-center">
 <div className="flex flex-col items-center gap-5">
 <div className="h-16 w-16 border border-border bg-card flex items-center justify-center">
 <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
 </div>
 <div className="text-center">
 <p className="text-[11px] font-display font-bold uppercase tracking-[0.2em] text-foreground">Carregando curso</p>
 <p className="text-[10px] text-muted-foreground mt-1.5 font-display uppercase tracking-widest">Preparando o editor</p>
 </div>
 </div>
 </div>
 );

 if (!course) return (
 <div className="h-screen w-screen bg-background flex items-center justify-center flex-col gap-6">
 <div className="h-20 w-20 border border-destructive bg-destructive/10 flex items-center justify-center">
 <AlertCircle className="h-8 w-8 text-destructive" />
 </div>
 <div className="text-center">
 <p className="text-foreground text-base font-display font-black tracking-tight">Curso não encontrado</p>
 <p className="text-xs text-muted-foreground mt-1.5 uppercase tracking-widest font-bold">O curso pode ter sido excluído</p>
 </div>
 <Button variant="ghost" onClick={() => navigate("/vendas/conteudo")} className="rounded-none border border-border bg-card font-display font-bold gap-2 text-[11px] uppercase tracking-[0.16em] hover:border-primary hover:text-primary">
 <ArrowLeft className="h-4 w-4" /> Voltar
 </Button>
 </div>
 );

 const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);
 const completedLessons = modules.reduce((a, m) => a + m.lessons.filter(l => l.video_url).length, 0);
 const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const editorTabs = [
    { id: "video" as const, label: "Conteúdo", icon: PlayCircle },
    { id: "content" as const, label: "Configuração", icon: Settings },
    { id: "settings" as const, label: "Avançado", icon: Zap },
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-[#050505] text-zinc-100 flex flex-col overflow-hidden selection:bg-blue-500/30 font-sans">
      {/* ═══ PREMIUM TOP BAR ═══ */}
      <header className="h-16 border-b border-white/[0.04] bg-[#050505]/80 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 shrink-0 z-50 relative">
        <div className="relative flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate("/vendas/conteudo")}
            className="group h-10 w-10 rounded-xl border border-white/[0.05] bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-400 group-hover:text-white transition-colors" />
          </button>

          {/* Brand Logo/Icon */}
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600  shrink-0 overflow-hidden relative group">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Sparkles className="h-5 w-5 text-white relative z-10" />
          </div>

          <div className="hidden sm:flex flex-col min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500/80">Builder</span>
              {course.is_published ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                  <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> Live
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-white/[0.05] text-[9px] font-black uppercase tracking-wider text-zinc-500">
                  Rascunho
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="font-display font-black text-white leading-none truncate max-w-[220px] lg:max-w-[400px] tracking-[-0.03em] text-[16px]">
                {course.title}
              </h1>
              <div className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
                {modules.length} Módulos · {totalLessons} Aulas
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Indicators */}
          <AnimatePresence mode="wait">
            <motion.div 
              key={saveStatus} 
              initial={{ opacity: 0, y: 5 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -5 }} 
              className="hidden md:flex items-center gap-2 h-9 px-3 rounded-lg border border-white/[0.05] bg-white/[0.02]"
            >
              {saveStatus === "idle" && <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Aguardando</span>}
              {saveStatus === "saving" && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Salvando...</span>
                </div>
              )}
              {saveStatus === "saved" && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Sincronizado</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="h-8 w-px bg-white/[0.05] mx-2 hidden sm:block" />

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(`/vendas/conteudo/${courseId}/analytics`)}
              className="group h-10 w-10 rounded-xl border border-white/[0.05] bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] hover:border-emerald-500/30 hover:text-emerald-400 transition-all text-zinc-400"
              title="Estatísticas"
            >
              <Activity className="h-4 w-4" />
            </button>

            <button
              onClick={openCourseSettings}
              className="group h-10 w-10 rounded-xl border border-white/[0.05] bg-white/[0.02] flex items-center justify-center hover:bg-white/[0.05] hover:border-white/[0.1] hover:text-white transition-all text-zinc-400"
              title="Configurações"
            >
              <Settings className="h-4 w-4" />
            </button>

            {course.is_published && (
              <button
                onClick={() => window.open(`/membros-area/curso/${courseId}`, "_blank")}
                className="hidden lg:flex h-10 px-5 rounded-xl border border-white/[0.05] bg-white/[0.02] text-[11px] font-black uppercase tracking-widest text-zinc-300 items-center gap-2 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all"
              >
                <Eye className="h-4 w-4" /> Visualizar
              </button>
            )}

            <button
              onClick={togglePublish}
              className={cn(
 "h-10 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2.5 transition-all duration-300 ",
                course.is_published
                  ? "bg-white text-black hover:bg-zinc-200"
                  : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20"
              )}
            >
              {course.is_published ? (
                <>
                  <EyeOff className="h-4 w-4" /> 
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4" /> 
                  <span>Publicar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div className="flex-1 flex overflow-hidden relative bg-[#050505]">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-blue-500/[0.03] blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-indigo-500/[0.03] blur-[150px] rounded-full pointer-events-none" />

        {/* ─── LEFT: Curriculum Sidebar ─── */}
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[#050505]/40 backdrop-blur-xl border-r border-white/[0.04] flex flex-col overflow-hidden shrink-0 z-20"
            >
              {/* Sidebar Header */}
              <div className="px-6 py-5 border-b border-white/[0.04] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Layers className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[13px] font-display font-black uppercase tracking-widest text-white block leading-tight">Conteúdo</h2>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      {totalLessons} Aulas no total
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNewModule(true)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-500 text-white hover:bg-emerald-400  shadow-emerald-500/10 transition-all"
                    title="Adicionar Módulo"
                  >
                    <Plus className="h-4 w-4" strokeWidth={3} />
                  </button>
                  <button
                    onClick={() => setSidebarCollapsed(true)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center border border-white/[0.05] bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Modules list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ WebkitOverflowScrolling: "touch" }}>
                {modules.map((mod, idx) => {
                  const lessonsWithVideo = mod.lessons.filter(l => l.video_url).length;
                  const modPct = mod.lessons.length > 0 ? Math.round((lessonsWithVideo / mod.lessons.length) * 100) : 0;
                  const isExpanded = expandedModules.has(mod.id);
                  const containsActive = mod.lessons.some(l => l.id === selectedLesson?.id);

                  return (
                    <div
                      key={mod.id}
                      className={cn(
 "group/mod overflow-hidden rounded-[12px] border transition-all duration-300",
                        containsActive 
                          ? "border-emerald-500/40 bg-emerald-500/[0.03] " 
                          : "border-white/[0.03] bg-white/[0.01] hover:border-white/[0.1] hover:bg-white/[0.02]"
                      )}
                    >
                      {/* Module Header */}
                      <div
                        className={cn(
 "flex items-center gap-3 px-4 py-4 cursor-pointer relative",
                          isExpanded ? "bg-white/[0.02]" : ""
                        )}
                        onClick={() => toggleExpand(mod.id)}
                      >
                        {containsActive && <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-emerald-500" />}
                        
                        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronRight className="h-4 w-4 text-zinc-600" />
                        </motion.div>

                        <div className={cn(
 "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-black border tabular-nums transition-all duration-300",
                          containsActive 
                            ? "bg-emerald-500 text-white border-emerald-400  shadow-emerald-500/20"
                            : isExpanded 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-zinc-900 text-zinc-600 border-white/[0.05]"
                        )}>
                          {idx + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          {editingModuleId === mod.id ? (
                            <input
                              autoFocus
                              value={editingModuleTitle}
                              onChange={e => setEditingModuleTitle(e.target.value)}
                              onBlur={() => renameModule(mod.id, editingModuleTitle)}
                              onKeyDown={e => { 
                                if (e.key === "Enter") renameModule(mod.id, editingModuleTitle); 
                                if (e.key === "Escape") setEditingModuleId(null); 
                              }}
                              onClick={e => e.stopPropagation()}
                              className="w-full text-[14px] font-bold text-white bg-transparent focus:outline-none border-b border-emerald-500/50 pb-0.5"
                            />
                          ) : (
                            <p className="text-[14px] font-bold text-zinc-100 truncate tracking-tight group-hover/mod:text-white transition-colors">
                              {mod.title}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest tabular-nums">
                              {mod.lessons.length} {mod.lessons.length === 1 ? "aula" : "aulas"}
                            </span>
                            {mod.lessons.length > 0 && (
                              <div className="flex items-center gap-2 flex-1 max-w-[80px]">
                                <div className="h-1 flex-1 bg-white/[0.03] rounded-full overflow-hidden">
                                  <motion.div
                                    className={cn("h-full transition-all duration-500", modPct === 100 ? "bg-emerald-500" : "bg-zinc-700")}
                                    animate={{ width: `${modPct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover/mod:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); setEditingModuleId(mod.id); setEditingModuleTitle(mod.title); }}
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/[0.05] text-zinc-500 hover:text-white transition-all"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); deleteModule(mod.id); }}
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Lessons List */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <div className="px-2 pb-3 bg-black/20">
                              <Reorder.Group 
                                axis="y" 
                                values={mod.lessons} 
                                onReorder={newOrder => reorderLessons(mod.id, newOrder)} 
                                className="space-y-1"
                              >
                                {mod.lessons.map((lesson, li) => {
                                  const isActive = selectedLesson?.id === lesson.id;
                                  const hasVideo = !!lesson.video_url;
                                  return (
                                    <Reorder.Item
                                      key={lesson.id}
                                      value={lesson}
                                      className={cn(
 "group/lesson flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-300",
                                        isActive
                                          ? "bg-white/[0.08] border border-white/[0.1] "
                                          : "hover:bg-white/[0.03] border border-transparent"
                                      )}
                                      onClick={() => selectLesson(lesson)}
                                    >
                                      <GripVertical className="h-3.5 w-3.5 text-zinc-700 group-hover/lesson:text-zinc-500 opacity-0 group-hover/lesson:opacity-100 transition-all shrink-0" />
                                      
                                      <div className={cn(
 "h-6 w-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black border transition-all duration-300",
                                        isActive
                                          ? "bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20"
                                          : hasVideo
                                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                          : "bg-zinc-900 text-zinc-600 border-white/[0.03]"
                                      )}>
                                        {hasVideo ? <Play className="h-2.5 w-2.5 fill-current" /> : li + 1}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <p className={cn(
 "text-[13px] font-bold truncate tracking-tight transition-colors",
                                          isActive ? "text-white" : "text-zinc-400 group-hover/lesson:text-zinc-200"
                                        )}>
                                          {lesson.title}
                                        </p>
                                        <div className="flex items-center gap-2.5 mt-1">
                                          {lesson.is_free && (
                                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">FREE</span>
                                          )}
                                          <div className="flex items-center gap-1.5">
                                            <div className={cn("h-1 w-1 rounded-full", hasVideo ? "bg-emerald-500 " : "bg-zinc-700")} />
                                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                                              {hasVideo ? "Pronta" : "Vazia"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 opacity-0 group-hover/lesson:opacity-100 transition-all">
                                        <button
                                          onClick={e => { e.stopPropagation(); duplicateLesson(lesson); }}
                                          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/[0.05] text-zinc-600 hover:text-white transition-all"
                                        >
                                          <Copy className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={e => { e.stopPropagation(); deleteLesson(lesson.id); }}
                                          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-all"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </Reorder.Item>
                                  );
                                })}
                              </Reorder.Group>

                              <button
                                onClick={() => createLesson(mod.id)}
                                className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/[0.05] bg-white/[0.01] text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all group/add"
                              >
                                <Plus className="h-4 w-4 group-hover/add:scale-110 transition-transform" />
                                <span className="text-[11px] font-black uppercase tracking-widest">Nova Aula</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

 {/* New Module */}
 {showNewModule ? (
 <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-primary p-3 space-y-2.5">
   <div className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Novo módulo</div>
 <input
 autoFocus value={newModuleTitle}
 onChange={e => setNewModuleTitle(e.target.value)}
 onKeyDown={e => { if (e.key === "Enter") createModule(); if (e.key === "Escape") setShowNewModule(false); }}
 placeholder="Ex: Introdução ao curso"
 className="w-full bg-card-elevated border border-border px-2.5 py-2 text-[13px] font-display font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
 />
 <div className="flex gap-1.5">
 <button onClick={createModule} className="flex-1 h-9 bg-primary text-primary-foreground text-[10px] font-display font-black uppercase tracking-[0.14em] hover:bg-primary/90 transition-colors">Criar módulo</button>
 <button onClick={() => { setShowNewModule(false); setNewModuleTitle(""); }} className="h-9 px-3 bg-card-elevated border border-border text-muted-foreground text-[10px] font-display font-black uppercase tracking-[0.14em] hover:text-foreground transition-colors">Cancelar</button>
 </div>
 </motion.div>
 ) : (
 <button
 onClick={() => setShowNewModule(true)}
 className="w-full border border-dashed border-border py-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/[0.06] transition-colors"
 >
 <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
 <span className="text-[10.5px] font-display font-black uppercase tracking-[0.14em]">Novo módulo</span>
 </button>
 )}
 </div>
 </motion.aside>
 )}
 </AnimatePresence>

 {/* Sidebar toggle */}
 <AnimatePresence>
 {sidebarCollapsed && (
 <motion.button
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 exit={{ opacity: 0, x: -10 }}
 onClick={() => setSidebarCollapsed(false)}
 className="absolute left-3 top-3 z-40 h-9 w-9 bg-card border border-border flex items-center justify-center hover:bg-card-elevated hover:border-foreground/40 transition-colors"
 >
 <PanelLeft className="h-4 w-4 text-muted-foreground/40" />
 </motion.button>
 )}
 </AnimatePresence>

        {/* ─── RIGHT: Lesson Editor ─── */}
        <main className="flex-1 bg-[#030303] overflow-y-auto z-10" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/[0.03] blur-[150px] rounded-full pointer-events-none" />
          
          {selectedLesson ? (
            <div className="w-full max-w-4xl mx-auto px-6 sm:px-12 py-10 sm:py-16 space-y-12 relative z-10">
              {/* Lesson Header */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
                      {modules.find(m => m.lessons.some(l => l.id === selectedLesson.id))?.title}
                    </span>
                  </div>
                  <div className="h-1 w-1 rounded-full bg-zinc-800" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500/80">Aula Atual</span>
                </div>

                {editingLessonTitle ? (
                  <input
                    ref={titleInputRef}
                    value={lessonTitle}
                    onChange={e => setLessonTitle(e.target.value)}
                    onBlur={() => { 
                      setEditingLessonTitle(false); 
                      if (lessonTitle.trim() && lessonTitle !== selectedLesson.title) autoSave("title", lessonTitle.trim()); 
                    }}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="w-full bg-transparent text-[44px] sm:text-[64px] font-display font-black tracking-[-0.05em] leading-[0.9] text-white focus:outline-none border-b-2 border-emerald-500/50 pb-4 "
                    autoFocus
                  />
                ) : (
                  <h2
                    onClick={() => { setEditingLessonTitle(true); setTimeout(() => titleInputRef.current?.focus(), 50); }}
                    className="text-[44px] sm:text-[64px] font-display font-black tracking-[-0.05em] leading-[0.9] text-white cursor-text hover:text-white/80 transition-all duration-300 drop-"
                  >
                    {lessonTitle || "Sem título"}
                  </h2>
                )}
              </motion.div>

              {/* ── Editor Tabs ── */}
              <div className="flex items-center gap-1 p-1 rounded-[12px] bg-white/[0.02] border border-white/[0.05] w-fit">
                {editorTabs.map(tab => {
                  const isActive = activeEditorTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveEditorTab(tab.id)}
                      className={cn(
 "relative flex items-center gap-2.5 px-6 h-11 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300",
                        isActive
                          ? "bg-white text-black "
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

 {/* ── Tab Content ── */}
 <AnimatePresence mode="wait">
 <motion.div
 key={activeEditorTab}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 transition={{ duration: 0.2, ease }}
 className="space-y-5"
 >
                {/* ─── VIDEO TAB ─── */}
                {activeEditorTab === "video" && (
                  <div className="space-y-6">
                    <div className="rounded-[14px] border border-white/[0.04] bg-white/[0.01] overflow-hidden group/player">
                      {uploadingVideo ? (
                        <div className="aspect-video flex flex-col items-center justify-center gap-8 p-12 bg-white/[0.02]">
                          <div className="relative">
                            <div className="h-20 w-20 rounded-[12px] border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                            </div>
                            <div className="absolute -inset-2 rounded-[12px] border border-emerald-500/20 animate-pulse" />
                          </div>
                          <div className="w-full max-w-sm">
                            <div className="flex justify-between text-[12px] mb-3">
                              <span className="font-black uppercase tracking-widest text-white">Processando Vídeo</span>
                              <span className="font-black text-emerald-400 tabular-nums">{Math.round(videoUploadProgress)}%</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.05]">
                              <motion.div className="h-full bg-emerald-500 " animate={{ width: `${videoUploadProgress}%` }} transition={{ ease: "easeOut" }} />
                            </div>
                          </div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Otimizando para 4K • Não feche a aba</p>
                        </div>
                      ) : lessonVideoUrl ? (
                        <div className="relative aspect-video bg-black  overflow-hidden group">
                          {isDirectVideoUrl(lessonVideoUrl) ? (
                            <video controls className="w-full h-full" src={lessonVideoUrl} />
                          ) : getVideoEmbed(lessonVideoUrl) ? (
                            <iframe
                              src={getVideoEmbed(lessonVideoUrl)!}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-white/[0.02] gap-4">
                              <Video className="h-12 w-12 text-emerald-500/40" />
                              <p className="text-zinc-500 font-bold text-sm tracking-widest uppercase">Streaming Ativo</p>
                            </div>
                          )}
                          
                          <button
                            onClick={() => { setLessonVideoUrl(""); autoSave("video_url", null); }}
                            className="absolute top-4 right-4 h-11 w-11 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="aspect-video flex flex-col items-center justify-center gap-6 cursor-pointer hover:bg-white/[0.03] transition-all duration-500 group/upload relative overflow-hidden"
                          onClick={() => videoInputRef.current?.click()}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleVideoUpload(f); }}
                        >
                          <div className="relative">
                            <div className="h-24 w-24 rounded-[14px] border border-dashed border-white/[0.1] flex items-center justify-center group-hover/upload:border-emerald-500/40 group-hover/upload:bg-emerald-500/[0.03] transition-all duration-500">
                              <Upload className="h-8 w-8 text-zinc-600 group-hover/upload:text-emerald-400 group-hover/upload:scale-110 transition-all duration-500" />
                            </div>
                            <div className="absolute -inset-4 rounded-[14px] border border-emerald-500/0 group-hover/upload:border-emerald-500/10 transition-all duration-700 animate-[ping_3s_infinite_alternate]" />
                          </div>
                          <div className="text-center relative z-10">
                            <h3 className="text-[14px] font-black uppercase tracking-[0.25em] text-white">Upload de Vídeo</h3>
                            <p className="text-[11px] text-zinc-500 mt-2 font-bold uppercase tracking-widest">Arraste arquivos 4K (MP4, MKV, MOV) • Máx 500MB</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative group">
                      <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <Globe className="h-4 w-4 text-zinc-600 group-focus-within:text-emerald-400 transition-colors" />
                      </div>
                      <input
                        value={lessonVideoUrl}
                        onChange={e => { setLessonVideoUrl(e.target.value); debouncedSave("video_url", e.target.value || null); }}
                        placeholder="Importar via Link (Youtube, Vimeo, Wistia...)"
                        className="w-full h-14 pl-14 pr-6 rounded-[12px] bg-white/[0.02] border border-white/[0.05] text-[14px] font-medium text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.04] transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* ─── CONTENT TAB ─── */}
                {activeEditorTab === "content" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-8 space-y-6">
                      <div className="rounded-[14px] border border-white/[0.04] bg-white/[0.01] overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.04] bg-white/[0.02]">
                          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="text-[12px] font-black uppercase tracking-widest text-white">Resumo da Aula</h3>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 block">Explique os pontos chave</span>
                          </div>
                        </div>
                        <textarea
                          value={lessonDescription}
                          onChange={e => { setLessonDescription(e.target.value); debouncedSave("description", e.target.value || null); }}
                          placeholder="Digite aqui as notas da aula, referências e links importantes..."
                          rows={12}
                          className="w-full bg-transparent p-8 text-[16px] text-zinc-300 placeholder:text-zinc-700 leading-relaxed focus:outline-none resize-none font-medium"
                        />
                      </div>
                    </div>

                    <div className="lg:col-span-4 space-y-6">
                      <div className="rounded-[14px] border border-white/[0.04] bg-white/[0.01] overflow-hidden">
                        <div className="px-6 py-5 border-b border-white/[0.04] bg-white/[0.02] flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                              <Paperclip className="h-4 w-4 text-blue-400" />
                            </div>
                            <h3 className="text-[12px] font-black uppercase tracking-widest text-white">Materiais</h3>
                          </div>
                          <button
                            onClick={() => attachmentInputRef.current?.click()}
                            disabled={uploadingAttachment}
                            className="h-8 w-8 rounded-lg bg-white/[0.05] border border-white/[0.1] text-zinc-400 hover:text-white hover:bg-white/[0.1] transition-all flex items-center justify-center"
                          >
                            {uploadingAttachment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
                          </button>
                        </div>
                        
                        <div className="p-4">
                          {attachments.length > 0 ? (
                            <div className="space-y-2">
                              {attachments.map(att => (
                                <div key={att.id} className="group/att flex items-center gap-3 p-3 rounded-[12px] border border-white/[0.03] bg-white/[0.01] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all">
                                  <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/[0.05] flex items-center justify-center shrink-0">
                                    <File className="h-4 w-4 text-zinc-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-zinc-200 truncate tracking-tight">{att.file_name}</p>
                                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">{formatFileSize(att.file_size)}</p>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover/att:opacity-100 transition-all">
                                    <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="h-7 w-7 rounded-md bg-white/[0.05] flex items-center justify-center hover:bg-white/[0.1] transition-all">
                                      <Download className="h-3.5 w-3.5 text-zinc-400" />
                                    </a>
                                    <button onClick={() => deleteAttachment(att)} className="h-7 w-7 rounded-md bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-all">
                                      <Trash2 className="h-3.5 w-3.5 text-red-400/80" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div
                              className="border border-dashed border-white/[0.05] rounded-[12px] py-12 flex flex-col items-center gap-4 text-zinc-600 hover:text-zinc-400 hover:border-white/[0.1] hover:bg-white/[0.01] transition-all cursor-pointer"
                              onClick={() => attachmentInputRef.current?.click()}
                            >
                              <div className="h-12 w-12 rounded-[12px] bg-zinc-900 border border-white/[0.05] flex items-center justify-center">
                                <Plus className="h-5 w-5" />
                              </div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Adicionar Anexos</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

 {/* ─── SETTINGS TAB ─── */}
                {activeEditorTab === "settings" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Duration */}
                    <div className="rounded-[14px] border border-white/[0.04] bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-all group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-[12px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Clock className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-[12px] font-black uppercase tracking-widest text-white leading-none">Duração Estimada</p>
                            <p className="text-[10px] text-zinc-500 mt-1.5 font-bold uppercase tracking-widest">Informação visual para o aluno</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="number" min={0} value={lessonDuration}
                            onChange={e => { const v = parseInt(e.target.value) || 0; setLessonDuration(v); debouncedSave("duration_minutes", v); }}
                            className="h-12 w-20 rounded-xl bg-[#080808] border border-white/[0.05] text-center text-[15px] font-black tabular-nums text-white focus:outline-none focus:border-blue-500/40 transition-all"
                          />
                          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">min</span>
                        </div>
                      </div>
                    </div>

                    {/* Free Lesson */}
                    <div className="rounded-[14px] border border-white/[0.04] bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-all group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Globe className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-[12px] font-black uppercase tracking-widest text-white leading-none">Aula de Degustação</p>
                            <p className="text-[10px] text-zinc-500 mt-1.5 font-bold uppercase tracking-widest">Disponível sem compra ativa</p>
                          </div>
                        </div>
                        <Switch checked={lessonIsFree} onCheckedChange={v => { setLessonIsFree(v); autoSave("is_free", v); }} />
                      </div>
                    </div>

                    {/* Drip */}
                    <div className="rounded-[14px] border border-white/[0.04] bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-all group md:col-span-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-[12px] bg-orange-500/10 border border-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Calendar className="h-5 w-5 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-[12px] font-black uppercase tracking-widest text-white leading-none">Liberação Programada (Drip)</p>
                            <p className="text-[10px] text-zinc-500 mt-1.5 font-bold uppercase tracking-widest">Gotejamento por dias após a compra</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={lessonDripEnabled}
                            onCheckedChange={v => {
                              setLessonDripEnabled(v);
                              if (!v) { setLessonDripDays(0); autoSave("drip_days", 0); }
                            }}
                          />
                          <AnimatePresence>
                            {lessonDripEnabled && (
                              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="flex items-center gap-3 overflow-hidden">
                                <input
                                  type="number" min={0} value={lessonDripDays}
                                  onChange={e => { const v = parseInt(e.target.value) || 0; setLessonDripDays(v); debouncedSave("drip_days", v); }}
                                  className="h-12 w-20 rounded-xl bg-[#080808] border border-white/[0.05] text-center text-[15px] font-black tabular-nums text-white focus:outline-none focus:border-orange-500/40 transition-all"
                                />
                                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest whitespace-nowrap">dias</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="rounded-[14px] border border-red-500/10 bg-red-500/[0.02] p-6 hover:bg-red-500/[0.04] transition-all group md:col-span-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-[12px] bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Trash2 className="h-5 w-5 text-red-400" />
                          </div>
                          <div>
                            <p className="text-[12px] font-black uppercase tracking-widest text-red-400 leading-none">Zona Crítica</p>
                            <p className="text-[10px] text-zinc-500 mt-1.5 font-bold uppercase tracking-widest">Esta ação removerá permanentemente a aula</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => deleteLesson(selectedLesson.id)}
                          className="h-12 px-6 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-[11px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir Aula
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
 </motion.div>
 </AnimatePresence>
 </div>
  ) : (
   /* ── Builder CTA — never dead, always actionable ── */
   <div className="h-full flex items-center justify-center px-6 py-10 relative overflow-hidden">
     {/* subtle grid backdrop to feel like a "stage" */}
     <div
       className="absolute inset-0 opacity-[0.04] pointer-events-none"
       style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
     />
     <motion.div
       initial={{ opacity: 0, y: 16 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.4, ease }}
       className="relative w-full max-w-xl"
     >
        {modules.length === 0 ? (
          <div className="border border-border bg-card p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-11 w-11 border border-primary bg-primary/10 flex items-center justify-center">
                <Layers className="h-5 w-5 text-primary" strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary tabular-nums">Passo 01 / 02</div>
                <h3 className="font-display text-lg font-black tracking-tight text-foreground">Crie o primeiro módulo</h3>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground mb-6">
              Módulos são as <span className="text-foreground font-semibold">seções</span> do seu curso. Cada módulo agrupa várias aulas em vídeo, anexos e configurações de acesso.
            </p>
            <div className="flex items-center gap-2">
              <Button onClick={() => { setSidebarCollapsed(false); setShowNewModule(true); }} className="gap-2 rounded-none bg-primary text-primary-foreground font-display font-bold text-[11px] uppercase tracking-[0.16em] h-11 px-6 hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Criar módulo
              </Button>
              <Button variant="ghost" onClick={openCourseSettings} className="gap-2 rounded-none border border-border bg-card font-display font-bold text-[11px] uppercase tracking-[0.16em] h-11 px-4 text-muted-foreground hover:border-primary hover:text-primary">
                <Settings className="h-4 w-4" /> Configurar curso
              </Button>
            </div>
            <div className="mt-6 pt-5 border-t border-border grid grid-cols-3 gap-3">
              {[
                { icon: Layers, label: "Módulos", value: "00" },
                { icon: PlayCircle, label: "Aulas", value: "00" },
                { icon: Users, label: "Alunos", value: String(studentCount).padStart(2, "0") },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <s.icon className="h-3.5 w-3.5 mx-auto text-muted-foreground" strokeWidth={1.8} />
                  <div className="mt-1 font-numbers text-base font-black tabular-nums text-foreground">{s.value}</div>
                  <div className="text-[9px] uppercase tracking-[0.16em] font-bold text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : totalLessons === 0 ? (
          <div className="border border-border bg-card p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-11 w-11 border border-primary bg-primary/10 flex items-center justify-center">
                <PlayCircle className="h-5 w-5 text-primary" strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary tabular-nums">Passo 02 / 02</div>
                <h3 className="font-display text-lg font-black tracking-tight text-foreground">Adicione a primeira aula</h3>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground mb-5">
              Você tem <span className="text-foreground font-semibold tabular-nums">{modules.length}</span> módulo{modules.length !== 1 ? "s" : ""}. Escolha onde criar a primeira aula:
            </p>
            <div className="space-y-1.5 mb-6 max-h-[200px] overflow-y-auto">
              {modules.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => createLesson(m.id)}
                  className="group w-full flex items-center gap-3 px-3 py-2.5 border border-border bg-card-elevated hover:border-primary hover:bg-primary/5 transition-colors text-left"
                >
                  <span className="h-7 w-7 bg-card border border-border flex items-center justify-center text-[11px] font-display font-black tabular-nums text-muted-foreground group-hover:text-primary group-hover:border-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 truncate text-sm font-semibold text-foreground">{m.title}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground group-hover:text-primary">+ Aula</span>
                </button>
              ))}
            </div>
            <Button onClick={() => createLesson(modules[0].id)} className="gap-2 rounded-none bg-primary text-primary-foreground font-display font-bold text-[11px] uppercase tracking-[0.16em] h-11 px-6 w-full hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Criar aula no primeiro módulo
            </Button>
          </div>
        ) : (
          <div className="border border-border bg-card p-8 sm:p-10 text-center">
            <div className="h-14 w-14 mx-auto border border-primary bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6 text-primary" strokeWidth={1.8} />
            </div>
            <h3 className="font-display text-lg font-black tracking-tight text-foreground mb-2">Continue editando</h3>
            <p className="text-sm leading-relaxed text-muted-foreground mb-6">
              Selecione uma aula para continuar de onde parou ou crie uma nova.
           </p>
           <div className="flex items-center justify-center gap-2">
             {(() => {
               const firstLesson = modules.flatMap(m => m.lessons)[0];
               return firstLesson ? (
                  <Button onClick={() => selectLesson(firstLesson)} className="gap-2 rounded-none bg-primary text-primary-foreground font-display font-bold text-[11px] uppercase tracking-[0.16em] h-11 px-6 hover:bg-primary/90">
                    <PlayCircle className="h-4 w-4" /> Abrir "{firstLesson.title.length > 24 ? firstLesson.title.slice(0, 24) + "…" : firstLesson.title}"
                  </Button>
                ) : null;
              })()}
              <Button variant="ghost" onClick={() => createLesson(modules[0].id)} className="gap-2 rounded-none border border-border bg-card font-display font-bold text-[11px] uppercase tracking-[0.16em] h-11 px-4 text-muted-foreground hover:border-primary hover:text-primary">
                <Plus className="h-4 w-4" /> Nova aula
              </Button>
           </div>
         </div>
       )}
     </motion.div>
   </div>
  )}
 </main>
 {/* ─── RIGHT: Student Preview Panel ─── */}
 <StudentPreviewPanel
 course={course}
 modules={modules.map(m => ({
 ...m,
 lessons: m.lessons.map(l => ({
 id: l.id, title: l.title, video_url: l.video_url,
 is_free: l.is_free, duration_minutes: l.duration_minutes,
 }))
 }))}
 selectedLessonId={selectedLesson?.id || null}
 />
 </div>

 {/* ═══ Delete Confirmation Dialog ═══ */}
 <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
 <AlertDialogContent className="rounded-none border-border bg-card max-w-md">
 <AlertDialogHeader>
 <AlertDialogTitle className="font-display font-black text-lg tracking-tight">
 Excluir {deleteTarget?.type === "module" ? "módulo" : "aula"}
 </AlertDialogTitle>
 <AlertDialogDescription className="text-muted-foreground font-display text-sm">
 {deleteTarget?.type === "module"
 ? `Tem certeza que deseja excluir o módulo "${deleteTarget.label}" e todas as suas aulas? Esta ação não pode ser desfeita.`
 : `Tem certeza que deseja excluir a aula "${deleteTarget?.label}"? Esta ação não pode ser desfeita.`}
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel disabled={deletingItem} className="rounded-none border border-border bg-card font-display font-bold text-[11px] uppercase tracking-[0.16em] hover:border-primary hover:text-primary">Cancelar</AlertDialogCancel>
 <AlertDialogAction
 onClick={confirmDelete}
 disabled={deletingItem}
 className="rounded-none font-display font-bold text-[11px] uppercase tracking-[0.16em] bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
 >
 {deletingItem && <Loader2 className="h-4 w-4 animate-spin" />}
 {deletingItem ? "Excluindo..." : "Excluir"}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>

  {/* ═══ Course Settings Sheet ═══ */}
  <Sheet open={courseSettingsOpen} onOpenChange={setCourseSettingsOpen}>
  <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-[#050505] border-white/[0.05] text-white">
  <SheetHeader className="mb-8">
  <SheetTitle className="font-display font-black text-2xl tracking-tight flex items-center gap-4">
  <div className="h-12 w-12 rounded-[12px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
  <Settings className="h-6 w-6 text-blue-400" />
  </div>
  Ajustes da Área
  </SheetTitle>
  </SheetHeader>

 <div className="space-y-6">
 {/* Thumbnail */}
 <div>
 <Label className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-[0.18em] mb-2.5 block">Thumbnail</Label>
 <div
 onClick={() => thumbnailInputRef.current?.click()}
 className="relative border border-dashed border-border hover:border-primary transition-colors cursor-pointer overflow-hidden h-44 group bg-card-elevated"
 >
 {course?.thumbnail_url ? (
 <>
 <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
 <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
 <ImageIcon className="h-8 w-8 text-foreground" />
 </div>
 </>
 ) : (
 <div className="w-full h-full flex flex-col items-center justify-center">
 <ImageIcon className="h-9 w-9 text-primary mb-3" />
 <p className="text-[11px] font-display font-bold uppercase tracking-[0.16em] text-foreground">
 {uploadingThumbnail ? "Enviando..." : "Clique para enviar"}
 </p>
 <p className="text-[10px] text-muted-foreground mt-1.5 font-display font-bold uppercase tracking-widest">JPG, PNG até 5MB</p>
 </div>
 )}
 </div>
 <input ref={thumbnailInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbnailUpload(f); }} />
 </div>

  {/* Title */}
  <div className="space-y-3">
  <Label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Título da Área</Label>
  <input
  value={courseTitle}
  onChange={e => setCourseTitle(e.target.value)}
  className="w-full h-14 px-5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[15px] font-bold text-white focus:outline-none focus:border-blue-500/40 transition-all"
  />
  </div>

 {/* Description */}
 <div>
 <Label className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-[0.18em] mb-2.5 block">Descrição</Label>
 <textarea
 value={courseDescription}
 onChange={e => setCourseDescription(e.target.value)}
 rows={4}
 className="w-full px-4 py-3 rounded-none bg-card-elevated border border-border text-sm font-display text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
 placeholder="Descreva o conteúdo deste curso..."
 />
 </div>

 {/* Stats */}
 <div className="border border-border bg-card-elevated p-4">
 <p className="text-[10px] font-display font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">Informações</p>
 <div className="grid grid-cols-3 gap-3">
 <div className="text-center">
 <p className="text-lg font-display font-black text-foreground tabular-nums">{String(modules.length).padStart(2, "0")}</p>
 <p className="text-[10px] text-muted-foreground font-display font-bold uppercase tracking-widest mt-1">Módulos</p>
 </div>
 <div className="text-center">
 <p className="text-lg font-display font-black text-foreground tabular-nums">{String(totalLessons).padStart(2, "0")}</p>
 <p className="text-[10px] text-muted-foreground font-display font-bold uppercase tracking-widest mt-1">Aulas</p>
 </div>
 <div className="text-center">
 <p className="text-lg font-display font-black text-primary tabular-nums">{String(studentCount).padStart(2, "0")}</p>
 <p className="text-[10px] text-muted-foreground font-display font-bold uppercase tracking-widest mt-1">Alunos</p>
 </div>
 </div>
 </div>

 {/* Save */}
 <Button onClick={saveCourseSettings} className="w-full h-11 rounded-none bg-primary text-primary-foreground font-display font-bold text-[11px] uppercase tracking-[0.16em] gap-2 hover:bg-primary/90">
 <CheckCircle2 className="h-4 w-4" /> Salvar Configurações
 </Button>
 </div>
 </SheetContent>
 </Sheet>
 </div>
 );
}
