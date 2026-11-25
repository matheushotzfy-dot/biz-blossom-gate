import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  MoreHorizontal,
  Plus,
  Settings,
  Video,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSellerSkin } from "@/hooks/useSellerSkin";
import { useInvalidateAll } from "@/hooks/useQueryData";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SellerMenuItem as BuilderMenuItem, sellerMenuContent as builderMenuContent } from "@/components/seller-ui/menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { StatusPill } from "@/components/seller-ui/tx";
import { StepEmpty } from "@/components/seller-ui/studio";
import StudentPreviewPanel from "@/components/course/StudentPreviewPanel";
import { CurriculumPanel } from "@/components/course/builder/CurriculumPanel";
import { LessonEditor } from "@/components/course/builder/LessonEditor";
import { CourseSettingsDialog } from "@/components/course/builder/CourseSettingsDialog";
import { isValidVideoLink } from "@/components/course/builder/videoUtils";
import { courseContentPathFromUrl, courseFilePath } from "@/lib/courseFiles";
import type { BuilderAttachment, BuilderCourse, BuilderLesson, BuilderModule, LessonField, SaveStatus } from "@/components/course/builder/types";
import { ConfirmDialog } from "@/components/seller-ui/confirm";

const SAVE_DELAY = 1000;
const LINK_SAVE_DELAY = 1500;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

type FieldValue = string | number | boolean | null;
type DeleteTarget =
  | { type: "module"; id: string; label: string; lessons: number }
  | { type: "lesson"; id: string; label: string }
  | { type: "attachment"; id: string; label: string; att: BuilderAttachment };

interface Draft { title: string; description: string; videoUrl: string; duration: number; isFree: boolean }
const EMPTY_DRAFT: Draft = { title: "", description: "", videoUrl: "", duration: 0, isFree: false };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const nextOrder = (items: { sort_order: number | null }[]) => items.reduce((max, i) => Math.max(max, (i.sort_order ?? -1) + 1), 0);
const draftOf = (l: BuilderLesson): Draft => ({
  title: l.title,
  description: l.description ?? "",
  videoUrl: l.video_url ?? "",
  duration: l.duration_minutes ?? 0,
  isFree: l.is_free,
});


export default function CourseBuilder() {
  useSellerSkin();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const invalidate = useInvalidateAll();

  const [course, setCourse] = useState<BuilderCourse | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [modules, setModules] = useState<BuilderModule[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [attachments, setAttachments] = useState<BuilderAttachment[]>([]);
  const [mobilePane, setMobilePane] = useState<"list" | "lesson">("list");
  const [creatingModule, setCreatingModule] = useState(false);

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [uploadingVideo, setUploadingVideo] = useState<{ lessonId: string; name: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Espelhos em ref: os salvamentos com atraso e os uploads precisam do valor mais novo, não do que existia quando foram agendados.
  const modulesRef = useRef<BuilderModule[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const statusRef = useRef<SaveStatus>("idle");
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingRef = useRef<Record<string, { lessonId: string; field: LessonField; value: FieldValue }>>({});
  const failedRef = useRef<Record<string, { lessonId: string; field: LessonField; value: FieldValue }>>({});
  const inflightRef = useRef(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachmentRequestRef = useRef(0);
  const savedVideoRef = useRef<Record<string, string | null>>({});
  const persistedOrderRef = useRef<Record<string, string>>({});
  const uploadingVideoRef = useRef(false);
  const initialSelectDone = useRef(false);

  modulesRef.current = modules;
  selectedIdRef.current = selectedId;

  const allLessons = useMemo(() => modules.flatMap((m) => m.lessons), [modules]);
  const selectedLesson = useMemo(() => allLessons.find((l) => l.id === selectedId) ?? null, [allLessons, selectedId]);
  const selectedModule = useMemo(() => modules.find((m) => m.lessons.some((l) => l.id === selectedId)) ?? null, [modules, selectedId]);
  const totalLessons = allLessons.length;
  const lessonsWithVideo = allLessons.filter((l) => l.video_url).length;

  // ─── Status de salvamento ────────────────────────────────────────
  const changeStatus = useCallback((next: SaveStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const settle = useCallback(() => {
    if (inflightRef.current > 0 || Object.keys(pendingRef.current).length > 0) return;
    if (Object.keys(failedRef.current).length > 0) { changeStatus("error"); return; }
    changeStatus("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => { if (statusRef.current === "saved") changeStatus("idle"); }, 2500);
  }, [changeStatus]);

  const markSaving = useCallback(() => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    if (statusRef.current !== "error") changeStatus("saving");
  }, [changeStatus]);

  const reportFailure = useCallback((message: string) => {
    const already = statusRef.current === "error";
    changeStatus("error");
    if (!already) toast.error(message);
  }, [changeStatus]);

  // ─── Arquivos do storage ─────────────────────────────────────────
  const removeStorageFiles = useCallback(async (paths: (string | null | undefined)[]) => {
    const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
    if (unique.length === 0) return;
    const { error } = await supabase.storage.from("course-content").remove(unique);
    if (error) console.error("Falha ao remover arquivos do storage course-content:", error);
  }, []);

  /** Apaga o arquivo de vídeo só se nenhuma outra aula (por exemplo uma cópia) ainda usa o mesmo endereço. */
  const releaseVideoFiles = useCallback((urls: (string | null | undefined)[], ignoreLessonIds: Set<string>) => {
    const inUse = new Set(modulesRef.current.flatMap((m) => m.lessons).filter((l) => !ignoreLessonIds.has(l.id)).map((l) => l.video_url));
    const paths = urls.filter((u) => u && !inUse.has(u)).map((u) => courseContentPathFromUrl(u));
    void removeStorageFiles(paths);
  }, [removeStorageFiles]);

  // ─── Carregamento ────────────────────────────────────────────────
  const loadAttachments = useCallback(async (lessonId: string) => {
    const request = ++attachmentRequestRef.current;
    setAttachments([]);
    const { data, error } = await supabase.from("lesson_attachments").select("*").eq("lesson_id", lessonId).order("created_at", { ascending: false });
    if (request !== attachmentRequestRef.current) return;
    if (error) { toast.error("Não foi possível carregar os materiais desta aula."); return; }
    setAttachments((data ?? []) as unknown as BuilderAttachment[]);
  }, []);

  const applySelection = useCallback((lesson: BuilderLesson) => {
    setSelectedId(lesson.id);
    selectedIdRef.current = lesson.id;
    setDraft(draftOf(lesson));
    void loadAttachments(lesson.id);
  }, [loadAttachments]);

  const fetchAll = useCallback(async (opts?: { keepView?: boolean }) => {
    if (!courseId) return;
    const [courseRes, modsRes, accessRes] = await Promise.all([
      supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
      supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order"),
      supabase.from("user_access").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("status", "active"),
    ]);
    if (courseRes.error || modsRes.error) { setLoadError(true); setLoading(false); return; }
    setLoadError(false);
    setCourse((courseRes.data as unknown as BuilderCourse | null) ?? null);
    setStudentCount(accessRes.count ?? 0);

    const mods = (modsRes.data ?? []) as unknown as Omit<BuilderModule, "lessons">[];
    const moduleIds = mods.map((m) => m.id);
    let lessons: BuilderLesson[] = [];
    if (moduleIds.length > 0) {
      const { data, error } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");
      if (error) { setLoadError(true); setLoading(false); return; }
      lessons = (data ?? []) as unknown as BuilderLesson[];
    }
    const mapped: BuilderModule[] = mods.map((m) => ({ ...m, lessons: lessons.filter((l) => l.module_id === m.id) }));
    setModules(mapped);
    modulesRef.current = mapped;
    savedVideoRef.current = Object.fromEntries(lessons.map((l) => [l.id, l.video_url]));
    persistedOrderRef.current = Object.fromEntries(mapped.map((m) => [m.id, m.lessons.map((l) => l.id).join(",")]));
    if (!opts?.keepView) setExpanded(new Set(mods.map((m) => m.id)));

    const productId = (courseRes.data as { product_id?: string | null } | null)?.product_id;
    if (productId) {
      const { data: product } = await supabase.from("products").select("name").eq("id", productId).maybeSingle();
      setProductName((product as { name?: string } | null)?.name ?? null);
    } else {
      setProductName(null);
    }

    // Na primeira carga abre a primeira aula (no computador o editor já aparece preenchido). Depois só confere se a aula aberta ainda existe.
    const current = selectedIdRef.current;
    if (!initialSelectDone.current) {
      initialSelectDone.current = true;
      if (lessons[0]) applySelection(mapped.flatMap((m) => m.lessons)[0]);
    } else if (current && !lessons.some((l) => l.id === current)) {
      setSelectedId(null);
      selectedIdRef.current = null;
      setMobilePane("list");
    }
    setLoading(false);
  }, [courseId, applySelection]);

  const loadAll = useCallback(async (opts?: { keepView?: boolean }) => {
    try {
      await fetchAll(opts);
    } catch (error) {
      console.error("Falha ao carregar a área de membros:", error);
      setLoadError(true);
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // ─── Salvamento por campo ────────────────────────────────────────
  const applyLocal = useCallback((lessonId: string, field: LessonField, value: FieldValue) => {
    setModules((prev) => prev.map((m) => (m.lessons.some((l) => l.id === lessonId)
      ? { ...m, lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, [field]: value } : l)) }
      : m)));
  }, []);

  const persistField = useCallback(async (lessonId: string, field: LessonField, value: FieldValue): Promise<boolean> => {
    const key = `${lessonId}:${field}`;
    inflightRef.current += 1;
    markSaving();
    const { error } = await supabase.from("lessons").update({ [field]: value } as never).eq("id", lessonId);
    inflightRef.current -= 1;
    if (error) {
      failedRef.current[key] = { lessonId, field, value };
      reportFailure("Não foi possível salvar a aula. Confira a conexão e tente de novo.");
      return false;
    }
    delete failedRef.current[key];
    applyLocal(lessonId, field, value);
    if (field === "video_url") {
      const previous = savedVideoRef.current[lessonId];
      savedVideoRef.current[lessonId] = value as string | null;
      if (previous && previous !== value) releaseVideoFiles([previous], new Set([lessonId]));
    }
    settle();
    return true;
  }, [applyLocal, markSaving, releaseVideoFiles, reportFailure, settle]);

  const runPending = useCallback(async (field: string) => {
    const item = pendingRef.current[field];
    clearTimeout(timersRef.current[field]);
    delete timersRef.current[field];
    if (!item) return;
    delete pendingRef.current[field];
    await persistField(item.lessonId, item.field, item.value);
  }, [persistField]);

  const flushAll = useCallback(async () => {
    await Promise.all(Object.keys(pendingRef.current).map((field) => runPending(field)));
  }, [runPending]);

  const queueSave = useCallback((field: LessonField, value: FieldValue, delay = SAVE_DELAY) => {
    const lessonId = selectedIdRef.current;
    if (!lessonId) return;
    pendingRef.current[field] = { lessonId, field, value };
    clearTimeout(timersRef.current[field]);
    markSaving();
    timersRef.current[field] = setTimeout(() => { void runPending(field); }, delay);
  }, [markSaving, runPending]);

  const dropPendingFor = useCallback((lessonIds: Set<string>) => {
    Object.entries(pendingRef.current).forEach(([field, item]) => {
      if (lessonIds.has(item.lessonId)) {
        clearTimeout(timersRef.current[field]);
        delete timersRef.current[field];
        delete pendingRef.current[field];
      }
    });
    Object.keys(failedRef.current).forEach((k) => { if (lessonIds.has(k.split(":")[0])) delete failedRef.current[k]; });
  }, []);

  const retryFailed = useCallback(async () => {
    const items = Object.values(failedRef.current);
    changeStatus("saving");
    await Promise.all(items.map((i) => persistField(i.lessonId, i.field, i.value)));
    settle();
  }, [changeStatus, persistField, settle]);

  // Ao sair da tela (ou fechar a aba) manda o que ainda estava esperando o tempo de salvar.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingRef.current).length > 0 || inflightRef.current > 0 || uploadingVideoRef.current) {
        void flushAll();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flushAll();
    };
  }, [flushAll]);

  // ─── Seleção ─────────────────────────────────────────────────────
  const selectLesson = useCallback((lesson: BuilderLesson) => {
    void flushAll();
    const fresh = modulesRef.current.flatMap((m) => m.lessons).find((l) => l.id === lesson.id) ?? lesson;
    applySelection(fresh);
    setMobilePane("lesson");
  }, [applySelection, flushAll]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const focusTitle = () => {
    window.setTimeout(() => {
      const el = document.getElementById("lesson-title") as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }, 80);
  };

  // ─── Campos da aula ──────────────────────────────────────────────
  const onTitle = (value: string) => {
    setDraft((d) => ({ ...d, title: value }));
    if (value.trim() === "" || !selectedIdRef.current) return;
    applyLocal(selectedIdRef.current, "title", value);
    queueSave("title", value);
  };

  const onTitleBlur = () => {
    if (draft.title.trim() === "" && selectedLesson) setDraft((d) => ({ ...d, title: selectedLesson.title }));
    void runPending("title");
  };

  const onDescription = (value: string) => {
    setDraft((d) => ({ ...d, description: value }));
    queueSave("description", value.trim() === "" ? null : value);
  };

  const onVideoUrl = (value: string) => {
    setDraft((d) => ({ ...d, videoUrl: value }));
    if (!isValidVideoLink(value)) return;
    queueSave("video_url", value.trim() === "" ? null : value.trim(), LINK_SAVE_DELAY);
  };

  const onRemoveVideo = () => {
    const lessonId = selectedIdRef.current;
    if (!lessonId) return;
    clearTimeout(timersRef.current.video_url);
    delete timersRef.current.video_url;
    delete pendingRef.current.video_url;
    setDraft((d) => ({ ...d, videoUrl: "" }));
    void persistField(lessonId, "video_url", null).then((ok) => { if (ok) toast.success("Vídeo removido."); });
  };

  const onDuration = (value: number) => {
    setDraft((d) => ({ ...d, duration: value }));
    if (!selectedIdRef.current) return;
    applyLocal(selectedIdRef.current, "duration_minutes", value);
    queueSave("duration_minutes", value);
  };

  const onIsFree = (value: boolean) => {
    const lessonId = selectedIdRef.current;
    if (!lessonId) return;
    setDraft((d) => ({ ...d, isFree: value }));
    applyLocal(lessonId, "is_free", value);
    void persistField(lessonId, "is_free", value);
  };

  // ─── Uploads ─────────────────────────────────────────────────────
  const handleVideoFile = async (file: File) => {
    const lessonId = selectedIdRef.current;
    if (!user || !lessonId || !courseId) return;
    if (uploadingVideoRef.current) { toast.info("Espere o envio do vídeo atual terminar."); return; }
    if (!VIDEO_TYPES.includes(file.type)) { toast.error("Formato não aceito. Envie MP4, WebM, OGG ou MOV."); return; }
    if (file.size > MAX_VIDEO_BYTES) { toast.error("O vídeo passa de 500 MB. Comprima o arquivo ou cole o link de um vídeo hospedado."); return; }
    uploadingVideoRef.current = true;
    setUploadingVideo({ lessonId, name: file.name });
    // {dono}/{curso}/…: é o que a política do storage exige para gravar e para o aluno matriculado ler.
    const path = courseFilePath(user.id, courseId, "videos", file.name.split(".").pop() || "mp4");
    const { error } = await supabase.storage.from("course-content").upload(path, file);
    if (error) {
      uploadingVideoRef.current = false;
      setUploadingVideo(null);
      toast.error("Não foi possível enviar o vídeo. Confira a conexão e tente de novo.");
      return;
    }
    const { data: urlData } = supabase.storage.from("course-content").getPublicUrl(path);
    // O vídeo novo vale mais do que um link que estava esperando para ser salvo.
    clearTimeout(timersRef.current.video_url);
    delete timersRef.current.video_url;
    delete pendingRef.current.video_url;
    const ok = await persistField(lessonId, "video_url", urlData.publicUrl);
    uploadingVideoRef.current = false;
    setUploadingVideo(null);
    if (!ok) {
      void removeStorageFiles([path]);
      return;
    }
    if (selectedIdRef.current === lessonId) setDraft((d) => ({ ...d, videoUrl: urlData.publicUrl }));
    toast.success("Vídeo enviado.");
  };

  const handleAttachmentFile = async (file: File) => {
    const lessonId = selectedIdRef.current;
    if (!user || !lessonId || !courseId) return;
    if (file.size > MAX_ATTACHMENT_BYTES) { toast.error("O arquivo passa de 50 MB."); return; }
    setUploadingAttachment(true);
    const path = courseFilePath(user.id, courseId, "attachments", file.name.split(".").pop() || "bin");
    const { error: uploadError } = await supabase.storage.from("course-content").upload(path, file);
    if (uploadError) {
      setUploadingAttachment(false);
      toast.error("Não foi possível enviar o arquivo. Confira a conexão e tente de novo.");
      return;
    }
    const { data: urlData } = supabase.storage.from("course-content").getPublicUrl(path);
    const { error: dbError } = await supabase.from("lesson_attachments").insert({
      lesson_id: lessonId, user_id: user.id, file_name: file.name, file_url: urlData.publicUrl, file_size: file.size, file_type: file.type,
    });
    if (dbError) {
      void removeStorageFiles([path]);
      setUploadingAttachment(false);
      toast.error("O arquivo foi enviado, mas não foi possível ligá-lo à aula. Tente de novo.");
      return;
    }
    if (selectedIdRef.current === lessonId) await loadAttachments(lessonId);
    setUploadingAttachment(false);
    toast.success("Material adicionado.");
  };

  // ─── Módulos e aulas ─────────────────────────────────────────────
  const createModule = async (title: string): Promise<boolean> => {
    if (!courseId) return false;
    const { data, error } = await supabase.from("modules")
      .insert({ course_id: courseId, title, sort_order: nextOrder(modulesRef.current) }).select().maybeSingle();
    if (error || !data) { toast.error("Não foi possível criar o módulo. Tente de novo."); return false; }
    const created = { ...(data as unknown as Omit<BuilderModule, "lessons">), lessons: [] } as BuilderModule;
    setModules((prev) => [...prev, created]);
    persistedOrderRef.current[created.id] = "";
    setExpanded((prev) => new Set(prev).add(created.id));
    invalidate(["courses"]);
    toast.success("Módulo criado.");
    return true;
  };

  const renameModule = async (id: string, title: string) => {
    const previous = modulesRef.current.find((m) => m.id === id)?.title;
    if (!title.trim() || title.trim() === previous) return;
    const { error } = await supabase.from("modules").update({ title: title.trim() }).eq("id", id);
    if (error) { toast.error("Não foi possível renomear o módulo."); return; }
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, title: title.trim() } : m)));
    toast.success("Módulo renomeado.");
  };

  const persistModuleOrder = useCallback(async (order: BuilderModule[]) => {
    inflightRef.current += 1;
    markSaving();
    const results = await Promise.all(order.map((m, i) => supabase.from("modules").update({ sort_order: i }).eq("id", m.id)));
    inflightRef.current -= 1;
    if (results.some((r) => r.error)) {
      toast.error("Não foi possível salvar a nova ordem dos módulos. Recarreguei a lista.");
      settle();
      await loadAll({ keepView: true });
      return;
    }
    setModules((prev) => prev.map((m) => ({ ...m, sort_order: order.findIndex((o) => o.id === m.id) })));
    settle();
  }, [loadAll, markSaving, settle]);

  const moveModule = (id: string, dir: -1 | 1) => {
    const list = [...modulesRef.current];
    const from = list.findIndex((m) => m.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    setModules(list);
    void persistModuleOrder(list);
  };

  const persistLessonOrder = useCallback(async (moduleId: string, order?: BuilderLesson[]) => {
    const lessons = order ?? modulesRef.current.find((m) => m.id === moduleId)?.lessons ?? [];
    const signature = lessons.map((l) => l.id).join(",");
    if (persistedOrderRef.current[moduleId] === signature) return;
    inflightRef.current += 1;
    markSaving();
    const results = await Promise.all(lessons.map((l, i) => supabase.from("lessons").update({ sort_order: i }).eq("id", l.id)));
    inflightRef.current -= 1;
    if (results.some((r) => r.error)) {
      toast.error("Não foi possível salvar a nova ordem das aulas. Recarreguei a lista.");
      settle();
      await loadAll({ keepView: true });
      return;
    }
    persistedOrderRef.current[moduleId] = signature;
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, lessons: m.lessons.map((l) => ({ ...l, sort_order: lessons.findIndex((o) => o.id === l.id) })) } : m)));
    settle();
  }, [loadAll, markSaving, settle]);

  const onReorderLessons = (moduleId: string, order: BuilderLesson[]) => {
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, lessons: order } : m)));
  };

  const moveLesson = (moduleId: string, lessonId: string, dir: -1 | 1) => {
    const mod = modulesRef.current.find((m) => m.id === moduleId);
    if (!mod) return;
    const list = [...mod.lessons];
    const from = list.findIndex((l) => l.id === lessonId);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    onReorderLessons(moduleId, list);
    void persistLessonOrder(moduleId, list);
  };

  const createLesson = async (moduleId: string) => {
    const mod = modulesRef.current.find((m) => m.id === moduleId);
    if (!mod) return;
    const { data, error } = await supabase.from("lessons")
      .insert({ module_id: moduleId, title: "Nova aula", sort_order: nextOrder(mod.lessons) }).select().maybeSingle();
    if (error || !data) { toast.error("Não foi possível criar a aula. Tente de novo."); return; }
    const lesson = data as unknown as BuilderLesson;
    void flushAll();
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, lessons: [...m.lessons, lesson] } : m)));
    savedVideoRef.current[lesson.id] = lesson.video_url;
    persistedOrderRef.current[moduleId] = [...mod.lessons, lesson].map((l) => l.id).join(",");
    setExpanded((prev) => new Set(prev).add(moduleId));
    applySelection(lesson);
    setMobilePane("lesson");
    invalidate(["courses"]);
    toast.success("Aula criada.");
    focusTitle();
  };

  const duplicateLesson = async (lesson: BuilderLesson) => {
    const mod = modulesRef.current.find((m) => m.id === lesson.module_id);
    if (!mod) return;
    const source = mod.lessons.find((l) => l.id === lesson.id) ?? lesson;
    const { data, error } = await supabase.from("lessons").insert({
      module_id: source.module_id,
      title: `${source.title} (cópia)`,
      description: source.description,
      video_url: source.video_url,
      duration_minutes: source.duration_minutes,
      is_free: source.is_free,
      drip_days: source.drip_days,
      sort_order: nextOrder(mod.lessons),
    }).select().maybeSingle();
    if (error || !data) { toast.error("Não foi possível duplicar a aula. Tente de novo."); return; }
    const copy = data as unknown as BuilderLesson;
    void flushAll();
    setModules((prev) => prev.map((m) => (m.id === copy.module_id ? { ...m, lessons: [...m.lessons, copy] } : m)));
    savedVideoRef.current[copy.id] = copy.video_url;
    persistedOrderRef.current[mod.id] = [...mod.lessons, copy].map((l) => l.id).join(",");
    applySelection(copy);
    setMobilePane("lesson");
    invalidate(["courses"]);
    toast.success("Aula duplicada.");
  };

  // ─── Exclusão ────────────────────────────────────────────────────
  const askDeleteModule = (id: string) => {
    const mod = modulesRef.current.find((m) => m.id === id);
    if (mod) setDeleteTarget({ type: "module", id, label: mod.title, lessons: mod.lessons.length });
  };
  const askDeleteLesson = (id: string) => {
    const lesson = modulesRef.current.flatMap((m) => m.lessons).find((l) => l.id === id);
    if (lesson) setDeleteTarget({ type: "lesson", id, label: lesson.title || "Aula sem título" });
  };
  const askDeleteAttachment = (att: BuilderAttachment) => setDeleteTarget({ type: "attachment", id: att.id, label: att.file_name, att });

  const afterRemoval = (removedLessonIds: Set<string>) => {
    const current = selectedIdRef.current;
    if (!current || !removedLessonIds.has(current)) return;
    const next = modulesRef.current.flatMap((m) => m.lessons).find((l) => !removedLessonIds.has(l.id));
    if (next) applySelection(next);
    else { setSelectedId(null); selectedIdRef.current = null; setAttachments([]); }
    setMobilePane("list");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "attachment") {
        const { att } = deleteTarget;
        const { error } = await supabase.from("lesson_attachments").delete().eq("id", att.id);
        if (error) { toast.error("Não foi possível remover o material."); return; }
        setAttachments((prev) => prev.filter((a) => a.id !== att.id));
        void removeStorageFiles([courseContentPathFromUrl(att.file_url)]);
        toast.success("Material removido.");
        return;
      }

      const isModule = deleteTarget.type === "module";
      const mod = isModule ? modulesRef.current.find((m) => m.id === deleteTarget.id) : null;
      const lessons = isModule ? (mod?.lessons ?? []) : modulesRef.current.flatMap((m) => m.lessons).filter((l) => l.id === deleteTarget.id);
      const lessonIds = new Set(lessons.map((l) => l.id));
      const ids = Array.from(lessonIds);
      dropPendingFor(lessonIds);

      const failure = () => {
        toast.error(`Não foi possível excluir ${isModule ? "o módulo" : "a aula"}. Recarreguei o conteúdo para mostrar o que ficou.`);
        void loadAll({ keepView: true });
      };

      let attachmentPaths: (string | null)[] = [];
      if (ids.length > 0) {
        const { data: rows, error: readError } = await supabase.from("lesson_attachments").select("file_url").in("lesson_id", ids);
        if (readError) { failure(); return; }
        attachmentPaths = (rows ?? []).map((r) => courseContentPathFromUrl(r.file_url));
        const { error: attError } = await supabase.from("lesson_attachments").delete().in("lesson_id", ids);
        if (attError) { failure(); return; }
        const { error: lessonError } = isModule
          ? await supabase.from("lessons").delete().eq("module_id", deleteTarget.id)
          : await supabase.from("lessons").delete().eq("id", deleteTarget.id);
        if (lessonError) { failure(); return; }
      }
      if (isModule) {
        const { error: moduleError } = await supabase.from("modules").delete().eq("id", deleteTarget.id);
        if (moduleError) { failure(); return; }
      }

      // Só depois que o banco confirmou é que os arquivos saem do storage.
      const videoPaths = lessons.map((l) => l.video_url).filter((u): u is string => !!u);
      const stillUsed = new Set(modulesRef.current.flatMap((m) => m.lessons).filter((l) => !lessonIds.has(l.id)).map((l) => l.video_url));
      void removeStorageFiles([...attachmentPaths, ...videoPaths.filter((u) => !stillUsed.has(u)).map((u) => courseContentPathFromUrl(u))]);

      const remaining = modulesRef.current
        .filter((m) => !(isModule && m.id === deleteTarget.id))
        .map((m) => ({ ...m, lessons: m.lessons.filter((l) => !lessonIds.has(l.id)) }));
      afterRemoval(lessonIds);
      setModules(remaining);
      modulesRef.current = remaining;
      invalidate(["courses"]);
      toast.success(isModule ? "Módulo excluído." : "Aula excluída.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ─── Área de membros ─────────────────────────────────────────────
  const saveCourseSettings = async (values: { title: string; description: string }): Promise<boolean> => {
    if (!course || !user) return false;
    const updates = { title: values.title, description: values.description || null };
    const { error } = await supabase.from("courses").update(updates).eq("id", course.id).eq("user_id", user.id);
    if (error) { toast.error("Não foi possível salvar as configurações."); return false; }
    setCourse((prev) => (prev ? { ...prev, ...updates } : prev));
    invalidate(["courses"]);
    toast.success("Configurações salvas.");
    return true;
  };

  const handleCoverFile = async (file: File) => {
    if (!user || !course) return;
    if (!COVER_TYPES.includes(file.type)) { toast.error("Use uma imagem JPG, PNG ou WebP."); return; }
    if (file.size > MAX_COVER_BYTES) { toast.error("A imagem passa de 5 MB."); return; }
    setUploadingCover(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/thumbnails/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { setUploadingCover(false); toast.error("Não foi possível enviar a capa. Tente de novo."); return; }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    const { error: dbError } = await supabase.from("courses").update({ thumbnail_url: urlData.publicUrl }).eq("id", course.id).eq("user_id", user.id);
    setUploadingCover(false);
    if (dbError) {
      void supabase.storage.from("product-images").remove([path]);
      toast.error("Não foi possível salvar a capa. Tente de novo.");
      return;
    }
    setCourse((prev) => (prev ? { ...prev, thumbnail_url: urlData.publicUrl } : prev));
    invalidate(["courses"]);
    toast.success("Capa atualizada.");
  };

  const handleRemoveCover = async () => {
    if (!user || !course) return;
    const { error } = await supabase.from("courses").update({ thumbnail_url: null }).eq("id", course.id).eq("user_id", user.id);
    if (error) { toast.error("Não foi possível remover a capa."); return; }
    setCourse((prev) => (prev ? { ...prev, thumbnail_url: null } : prev));
    invalidate(["courses"]);
    toast.success("Capa removida.");
  };

  const togglePublish = async () => {
    if (!course || !user || publishing) return;
    setPublishing(true);
    const next = !course.is_published;
    const { error } = await supabase.from("courses").update({ is_published: next }).eq("id", course.id).eq("user_id", user.id);
    setPublishing(false);
    if (error) {
      toast.error(error.message?.startsWith("A equipe tirou") ? error.message : next ? "Não foi possível publicar a área." : "Não foi possível despublicar a área.");
      return;
    }
    setCourse((prev) => (prev ? { ...prev, is_published: next } : prev));
    invalidate(["courses"]);
    if (next) toast.success("Área publicada.", totalLessons === 0 ? { description: "Ela ainda não tem aulas. Adicione módulos e aulas para o aluno ver conteúdo." } : undefined);
    else toast.success("Área despublicada.");
  };

  const openAsStudent = () => window.open(`/membros-area/curso/${courseId}`, "_blank", "noopener");
  const goBack = () => navigate("/vendas/conteudo");

  // ─── Estados de tela cheia ───────────────────────────────────────
  if (loading) {
    return (
      <div className="vp-seller-shell vp-stage flex h-[100dvh] flex-col" aria-busy="true">
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <span className="vp-skel h-11 w-11 rounded-full" />
          <span className="vp-skel h-6 w-56 rounded-full" />
        </div>
        <div className="min-h-0 flex-1 space-y-3 p-4 sm:p-5 lg:max-w-[380px]">
          <span className="vp-skel block h-20 w-full rounded-[22px]" />
          <span className="vp-skel block h-20 w-full rounded-[22px]" />
          <span className="vp-skel block h-20 w-full rounded-[22px]" />
        </div>
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="vp-seller-shell vp-stage grid h-[100dvh] place-items-center px-4">
        <div className="w-full max-w-[460px]">
          <StepEmpty
            icon={<AlertCircle className="h-7 w-7" />}
            title={loadError ? "Não foi possível abrir esta área" : "Área de membros não encontrada"}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {loadError && <button type="button" onClick={() => { setLoading(true); void loadAll(); }} className="vp-cta h-11 px-6">Tentar de novo</button>}
                <button type="button" onClick={goBack} className="vp-ghost h-11 px-6"><ArrowLeft className="h-4 w-4" />Voltar para a lista</button>
              </div>
            }
          >
            {loadError ? "Confira a conexão e tente de novo." : "Ela pode ter sido excluída ou não pertencer a esta conta."}
          </StepEmpty>
        </div>
      </div>
    );
  }

  const subtitleParts = [plural(modules.length, "módulo", "módulos"), plural(totalLessons, "aula", "aulas")];
  if (studentCount > 0) subtitleParts.push(plural(studentCount, "aluno", "alunos"));
  const videoPercent = totalLessons > 0 ? Math.round((lessonsWithVideo / totalLessons) * 100) : 0;
  const lessonIndex = selectedModule && selectedLesson ? selectedModule.lessons.findIndex((l) => l.id === selectedLesson.id) : 0;
  const uploadingHere = uploadingVideo && uploadingVideo.lessonId === selectedId ? uploadingVideo : null;
  const deleteBody = (() => {
    if (!deleteTarget) return null;
    if (deleteTarget.type === "module") {
      return deleteTarget.lessons === 0
        ? <>Este módulo não tem aulas. Não dá para desfazer.</>
        : <>{deleteTarget.lessons === 1 ? "A aula dele some" : `As ${deleteTarget.lessons} aulas dele somem`}, com os vídeos enviados e os materiais. Não dá para desfazer.</>;
    }
    if (deleteTarget.type === "lesson") return <>O vídeo enviado e os materiais desta aula também são apagados. Não dá para desfazer.</>;
    return <>O arquivo deixa de aparecer para os alunos e é apagado. Não dá para desfazer.</>;
  })();
  const deleteCopy = deleteTarget?.type === "module"
    ? { title: "Excluir este módulo?", keep: "Manter módulo", confirm: "Excluir módulo" }
    : deleteTarget?.type === "attachment"
      ? { title: "Remover este material?", keep: "Manter material", confirm: "Remover material" }
      : { title: "Excluir esta aula?", keep: "Manter aula", confirm: "Excluir aula" };

  const publishButton = (
    <button
      type="button"
      onClick={() => void togglePublish()}
      disabled={publishing}
      className={cn("px-5 sm:px-6", course.is_published ? "vp-ghost" : "vp-cta")}
    >
      {publishing ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : course.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      {course.is_published ? "Despublicar" : "Publicar"}
    </button>
  );

  return (
    <div className="vp-seller-shell vp-stage flex h-[100dvh] flex-col overflow-hidden">
      <header className="z-30 shrink-0 border-b border-border bg-background">
        <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={goBack} aria-label="Voltar para as áreas de membros" className="vp-orb shrink-0"><ArrowLeft className="h-[18px] w-[18px]" /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate font-heading text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-foreground">{course.title}</h1>
              <StatusPill label={course.admin_hold_at ? "Tirada do ar" : course.is_published ? "Publicada" : "Rascunho"} tone={course.admin_hold_at ? "alert" : course.is_published ? "ok" : "idle"} className="hidden shrink-0 sm:inline-flex" />
            </div>
            <p className="truncate text-[13px] text-muted-foreground">{subtitleParts.join(", ")}</p>
          </div>

          <div role="status" aria-live="polite" className="hidden shrink-0 items-center md:flex">
            {status === "saving" && <span className="inline-flex items-center gap-2 text-[13.5px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Salvando…</span>}
            {status === "saved" && <span className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-primary"><Check className="h-4 w-4" strokeWidth={3} />Salvo</span>}
            {status === "idle" && <span className="text-[13.5px] text-muted-foreground">Salva sozinho</span>}
            {status === "error" && (
              <button type="button" onClick={() => void retryFailed()} className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3.5 py-1.5 text-[13.5px] font-semibold text-destructive hover:bg-destructive/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive">
                <AlertCircle className="h-4 w-4" />Falhou. Tentar de novo
              </button>
            )}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <button type="button" onClick={() => setPreviewOpen(true)} className="vp-ghost"><Eye className="h-4 w-4" />Prévia</button>
            <button type="button" onClick={() => navigate(`/vendas/conteudo/${courseId}/analytics`)} aria-label="Ver estatísticas" title="Estatísticas" className="vp-orb"><Activity className="h-[18px] w-[18px]" /></button>
            <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Configurações da área" title="Configurações" className="vp-orb"><Settings className="h-[18px] w-[18px]" /></button>
            {course.is_published && (
              <button type="button" onClick={openAsStudent} aria-label="Ver como aluno" title="Ver como aluno" className="vp-orb hidden lg:grid"><ExternalLink className="h-[18px] w-[18px]" /></button>
            )}
          </div>

          <div className="md:hidden">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Mais ações" className="vp-orb"><MoreHorizontal className="h-[18px] w-[18px]" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" collisionPadding={16} sideOffset={6} className={builderMenuContent}>
                <BuilderMenuItem icon={Eye} label="Prévia do aluno" onSelect={() => setPreviewOpen(true)} />
                <BuilderMenuItem icon={Activity} label="Estatísticas" onSelect={() => navigate(`/vendas/conteudo/${courseId}/analytics`)} />
                <BuilderMenuItem icon={Settings} label="Configurações" onSelect={() => setSettingsOpen(true)} />
                {course.is_published && (
                  <>
                    <DropdownMenuSeparator className="my-1 bg-border" />
                    <BuilderMenuItem icon={ExternalLink} label="Ver como aluno" onSelect={openAsStudent} />
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="hidden shrink-0 md:block">{publishButton}</div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 md:hidden">
          <div role="status" aria-live="polite" className="min-w-0">
            {status === "saving" && <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />Salvando…</span>}
            {status === "saved" && <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary"><Check className="h-3.5 w-3.5" strokeWidth={3} />Salvo</span>}
            {status === "idle" && <span className="text-[13px] text-muted-foreground">Salva sozinho</span>}
            {status === "error" && (
              <button type="button" onClick={() => void retryFailed()} className="inline-flex items-center gap-2 text-[13px] font-semibold text-destructive"><AlertCircle className="h-3.5 w-3.5" />Falhou. Tentar de novo</button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <StatusPill label={course.admin_hold_at ? "Tirada do ar" : course.is_published ? "Publicada" : "Rascunho"} tone={course.admin_hold_at ? "alert" : course.is_published ? "ok" : "idle"} className="!h-6 !text-[12px]" />
            <div className="[&_button]:!h-10 [&_button]:!px-4">{publishButton}</div>
          </div>
        </div>
      </header>

      {course.admin_hold_at && (
        <div role="alert" className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-4 py-3 sm:px-6">
          <p className="text-[14px] font-semibold text-destructive">A equipe tirou esta área do ar{course.admin_hold_reason ? `. Motivo: ${course.admin_hold_reason}` : "."}</p>
          <p className="mt-0.5 text-[13.5px] text-destructive/90">Você pode continuar editando. Para voltar a publicar, fale com o suporte.</p>
        </div>
      )}

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[400px_minmax(0,1fr)]">
        <aside
          aria-label="Módulos e aulas"
          className={cn("h-full min-h-0 overflow-y-auto overscroll-contain bg-background lg:border-r lg:border-border", mobilePane === "lesson" ? "hidden lg:block" : "block")}
        >
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-heading text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">Módulos e aulas</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {totalLessons === 0 ? "Nenhuma aula criada ainda." : `${lessonsWithVideo} de ${plural(totalLessons, "aula", "aulas")} com vídeo.`}
            </p>
            {totalLessons > 0 && (
              <div role="progressbar" aria-label="Aulas com vídeo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={videoPercent} className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${videoPercent}%` }} />
              </div>
            )}
          </div>
          <CurriculumPanel
            modules={modules}
            selectedLessonId={selectedId}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            onSelectLesson={selectLesson}
            onCreateModule={createModule}
            onRenameModule={(id, title) => void renameModule(id, title)}
            onDeleteModule={askDeleteModule}
            onMoveModule={moveModule}
            onCreateLesson={(id) => void createLesson(id)}
            onDuplicateLesson={(l) => void duplicateLesson(l)}
            onDeleteLesson={askDeleteLesson}
            onMoveLesson={moveLesson}
            onReorderLessons={onReorderLessons}
            onCommitLessonOrder={(id) => void persistLessonOrder(id)}
            creatingModule={creatingModule}
            setCreatingModule={setCreatingModule}
          />
        </aside>

        <main className={cn("h-full min-h-0 overflow-y-auto overscroll-contain bg-muted/40 !pb-0", mobilePane === "list" ? "hidden lg:block" : "block")}>
          {selectedLesson && selectedModule ? (
            <LessonEditor
              key={selectedLesson.id}
              moduleTitle={selectedModule.title}
              lessonNumber={lessonIndex + 1}
              lessonTotal={selectedModule.lessons.length}
              title={draft.title}
              onTitle={onTitle}
              onTitleBlur={onTitleBlur}
              description={draft.description}
              onDescription={onDescription}
              videoUrl={draft.videoUrl}
              savedVideoUrl={selectedLesson.video_url ?? ""}
              onVideoUrl={onVideoUrl}
              onRemoveVideo={onRemoveVideo}
              uploadingVideo={!!uploadingHere}
              uploadingVideoName={uploadingHere?.name ?? ""}
              onVideoFile={(f) => void handleVideoFile(f)}
              duration={draft.duration}
              onDuration={onDuration}
              isFree={draft.isFree}
              onIsFree={onIsFree}
              attachments={attachments}
              uploadingAttachment={uploadingAttachment}
              onAttachmentFile={(f) => void handleAttachmentFile(f)}
              onDeleteAttachment={askDeleteAttachment}
              onDeleteLesson={() => askDeleteLesson(selectedLesson.id)}
              onBack={() => setMobilePane("list")}
            />
          ) : (
            <div className="mx-auto grid min-h-full w-full max-w-[560px] place-items-center px-4 py-10">
              <StepEmpty
                icon={totalLessons === 0 ? <Layers className="h-7 w-7" /> : <Video className="h-7 w-7" />}
                title={totalLessons === 0 ? "Crie a primeira aula" : "Escolha uma aula para editar"}
                action={
                  <button type="button" onClick={() => setMobilePane("list")} className="vp-ghost h-11 px-6 lg:hidden"><ArrowLeft className="h-4 w-4" />Voltar para as aulas</button>
                }
              >
                {totalLessons === 0
                  ? "Crie um módulo e adicione aulas dentro dele. Aqui você manda o vídeo, escreve a descrição e anexa materiais."
                  : "Toque em uma aula na lista ao lado para mexer no vídeo, na descrição e nos materiais."}
              </StepEmpty>
            </div>
          )}
        </main>
      </div>

      <CourseSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        course={course}
        uploadingCover={uploadingCover}
        onCoverFile={(f) => void handleCoverFile(f)}
        onRemoveCover={() => void handleRemoveCover()}
        onSave={saveCourseSettings}
      />

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent className="flex w-full flex-col gap-0 border-border bg-background p-0 sm:max-w-[460px]">
          <SheetTitle className="sr-only">Prévia do aluno</SheetTitle>
          <SheetDescription className="sr-only">Como o aluno enxerga esta área de membros.</SheetDescription>
          <StudentPreviewPanel
            course={{ id: course.id, title: course.title, description: course.description, is_published: course.is_published, thumbnail_url: course.thumbnail_url, category: course.category }}
            modules={modules.map((m) => ({ id: m.id, title: m.title, banner_url: m.banner_url, lessons: m.lessons }))}
            selectedLessonId={selectedId}
            productName={productName}
          />
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} busy={deleting}
        title={deleteCopy.title} confirmLabel={deleteCopy.confirm} cancelLabel={deleteCopy.keep}
        description={
          <div className="space-y-2">
            <span className="block break-words font-semibold text-foreground">{deleteTarget?.label}</span>
            <p>{deleteBody}</p>
          </div>
        }
        onConfirm={confirmDelete}
      />
    </div>
  );
}
