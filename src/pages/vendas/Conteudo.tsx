import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts as useProductsQuery, useCourses as useCoursesQuery, useTransactions, useInvalidateAll } from "@/hooks/useQueryData";
import {
 Plus, BookOpen, Layers, Trash2, Edit, Eye, EyeOff,
 Link as LinkIcon, Search, Copy, MoreVertical,
 Globe, Lock, Image as ImageIcon, X,
 Video, DollarSign, PlayCircle, Sparkles,
 Users, Grid3X3, List, CheckCircle2,
 ChevronRight, GraduationCap, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import CourseCreationWizard from "@/components/course/CourseCreationWizard";

// ─── Types ────────────────────────────────────────────────────────
interface Course {
 id: string; title: string; description: string | null; category: string | null;
 thumbnail_url: string | null; product_id: string | null; is_published: boolean;
 sort_order: number | null; user_id: string; created_at: string;
}
interface Product { id: string; name: string; price: number; }

const fmt = (v: number) =>
 v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type FilterId = "all" | "published" | "draft";

// ─── Animated Number ──────────────────────────────────────────────
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
 const [display, setDisplay] = useState(value);
 const prevRef = useRef(value);
 useEffect(() => {
 const from = prevRef.current;
 const to = value;
 prevRef.current = value;
 if (from === to) { setDisplay(to); return; }
 const start = performance.now();
 const tick = (now: number) => {
 const elapsed = now - start;
 const progress = Math.min(elapsed / duration, 1);
 const eased = 1 - Math.pow(1 - progress, 3);
 setDisplay(from + (to - from) * eased);
 if (progress < 1) requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
 }, [value, duration]);
 return <>{Math.round(display)}</>;
}

// ─── Image Upload ─────────────────────────────────────────────────
function ImageUploadZone({ value, onChange, label, height = "h-44" }: {
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
 <Label className="text-xs font-display font-bold text-foreground/60 uppercase tracking-[0.08em] mb-2.5 block">{label}</Label>
 <div
 onClick={() => inputRef.current?.click()}
 onDragOver={e => e.preventDefault()}
 onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
 className={cn("relative rounded-2xl border-2 border-dashed border-border/25 hover:border-primary/30 transition-all duration-500 cursor-pointer overflow-hidden group/img", height, value ? "p-0" : "flex flex-col items-center justify-center bg-muted/5")}
 >
 {value ? (
 <>
 <img src={value} alt="" className="w-full h-full object-cover" />
 <div className="absolute inset-0 bg-background/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3">
 <button type="button" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }} className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"><ImageIcon className="h-4.5 w-4.5 text-foreground" /></button>
 <button type="button" onClick={e => { e.stopPropagation(); onChange(""); }} className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center text-destructive hover:bg-muted transition-colors"><X className="h-4.5 w-4.5" /></button>
 </div>
 </>
 ) : (
 <>
 <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 border border-primary/10">
 <ImageIcon className="h-7 w-7 text-primary/30" />
 </div>
 <p className="text-sm font-display font-bold text-muted-foreground/50">{uploading ? "Enviando..." : "Clique ou arraste uma imagem"}</p>
 <p className="text-xs text-muted-foreground/30 mt-1.5">PNG, JPG até 5MB</p>
 </>
 )}
 </div>
 <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
 </div>
 );
}

// ─── Course Card (Premium Redesigned) ─────────────────────────────
function CourseCard({ course, stats, product, revenue, studentCount = 0, onEdit, onNavigate, onTogglePublish, onDelete, onCopyLink, getMemberLink, index }: {
 course: Course; stats: { modules: number; lessons: number }; product?: Product;
 revenue: number; studentCount?: number; onEdit: () => void; onNavigate: () => void;
 onTogglePublish: () => void; onDelete: () => void; onCopyLink: () => void;
 getMemberLink: string; index: number;
}) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 24, scale: 0.96 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 transition={{ delay: index * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
 className="group/card relative h-full"
 >
 <div className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-xl border border-border/30 hover:border-primary/20 hover:shadow-[0_16px_48px_-12px_hsl(var(--primary)/0.1)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] h-full flex flex-col">
 {/* Accent glow on hover */}
 {/* ── Thumbnail ── */}
 <div className="relative aspect-[16/9] overflow-hidden cursor-pointer shrink-0" onClick={onNavigate}>
 {course.thumbnail_url ? (
 <img
 src={course.thumbnail_url} alt={course.title}
 className="w-full h-full object-cover group-hover/card:scale-[1.03] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
 loading="lazy"
 />
 ) : (
 <div className="w-full h-full bg-gradient-to-br from-primary/6 via-info/4 to-primary/3 flex items-center justify-center relative overflow-hidden">
 <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
 <GraduationCap className="h-14 w-14 text-primary/8 group-hover/card:scale-110 group-hover/card:text-primary/15 transition-all duration-500" />
 </div>
 )}

 <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-70" />

 {/* Status badge */}
 <div className="absolute top-3 left-3 z-10">
 <span className={cn(
 "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-display font-black uppercase tracking-[0.1em] backdrop-blur-2xl border shadow-sm",
 course.is_published
 ? "bg-success/15 text-success border-success/20 shadow-success/5"
 : "bg-card/80 text-muted-foreground/60 border-border/30"
 )}>
 <span className={cn("h-1.5 w-1.5 rounded-full", course.is_published ? "bg-success animate-pulse shadow-[0_0_8px_hsl(var(--success))]" : "bg-muted-foreground/30")} />
 {course.is_published ? "Live" : "Rascunho"}
 </span>
 </div>

 {/* Quick stats overlay */}
 <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 z-10">
 <span className="inline-flex items-center gap-1 rounded-lg bg-card/90 backdrop-blur-xl border border-border/10 px-2 py-1 text-[10px] font-display font-bold text-foreground/80">
 <Layers className="h-2.5 w-2.5 text-primary/60" /> {stats.modules}
 </span>
 <span className="inline-flex items-center gap-1 rounded-lg bg-card/90 backdrop-blur-xl border border-border/10 px-2 py-1 text-[10px] font-display font-bold text-foreground/80">
 <Video className="h-2.5 w-2.5 text-info/60" /> {stats.lessons}
 </span>
 {studentCount > 0 && (
 <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 backdrop-blur-xl border border-primary/10 px-2 py-1 text-[10px] font-display font-bold text-primary">
 <Users className="h-2.5 w-2.5" /> {studentCount}
 </span>
 )}
 </div>
 </div>

 {/* ── Content ── */}
 <div className="p-5 flex flex-col flex-1">
 <div className="flex-1">
 <h3 className="text-[15px] font-display font-black text-foreground leading-snug line-clamp-1 tracking-[-0.02em] mb-1.5">{course.title}</h3>
 <p className={cn("text-xs line-clamp-2 leading-relaxed h-[2.5rem]", course.description ? "text-muted-foreground/60" : "text-muted-foreground/25 italic")}>
 {course.description || "Sem descrição adicionada"}
 </p>
 </div>

 {/* Meta row */}
 <div className="flex flex-wrap items-center gap-1.5 mt-3 min-h-[28px]">
 {product && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/6 border border-primary/10 text-[10px] font-display font-bold text-primary truncate max-w-[130px]">
 <LinkIcon className="h-2.5 w-2.5 shrink-0" /> {product.name}
 </span>
 )}
 {revenue > 0 && (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/6 border border-success/10 text-[10px] font-display font-bold text-success tabular-nums">
 <DollarSign className="h-2.5 w-2.5" /> {fmt(revenue)}
 </span>
 )}
 {course.category && !product && revenue === 0 && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/6 border border-border/10 text-[10px] font-display font-bold text-muted-foreground/60">
 {course.category}
 </span>
 )}
 </div>

 {/* Actions */}
 <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/10">
 <span className="text-[10px] text-muted-foreground/30 tabular-nums font-display">{new Date(course.created_at).toLocaleDateString("pt-BR")}</span>
 <div className="flex items-center gap-1">
 <Button
 variant="ghost" size="sm"
 className="gap-1.5 rounded-xl text-xs h-8 px-3 font-display font-bold text-primary hover:text-primary hover:bg-primary/8 active:scale-[0.985]"
 onClick={onNavigate}
 >
 Editar <ChevronRight className="h-3 w-3" />
 </Button>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="sm" className="rounded-xl h-8 w-8 p-0 text-muted-foreground/20 hover:text-foreground hover:bg-muted/10">
 <MoreVertical className="h-3.5 w-3.5" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="min-w-[200px] rounded-xl p-1.5">
 <DropdownMenuItem onClick={onEdit} className="gap-3 text-sm cursor-pointer rounded-lg py-2.5 px-3 font-display"><Edit className="h-4 w-4" /> Configurações</DropdownMenuItem>
 <DropdownMenuItem onClick={onTogglePublish} className="gap-3 text-sm cursor-pointer rounded-lg py-2.5 px-3 font-display">
 {course.is_published ? <><EyeOff className="h-4 w-4" /> Despublicar</> : <><Eye className="h-4 w-4" /> Publicar</>}
 </DropdownMenuItem>
 {course.is_published && (
 <DropdownMenuItem onClick={() => window.open(getMemberLink, "_blank")} className="gap-3 text-sm cursor-pointer rounded-lg py-2.5 px-3 font-display"><PlayCircle className="h-4 w-4" /> Visualizar</DropdownMenuItem>
 )}
 <DropdownMenuItem onClick={onCopyLink} className="gap-3 text-sm cursor-pointer rounded-lg py-2.5 px-3 font-display"><Copy className="h-4 w-4" /> Copiar link</DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={onDelete} className="gap-3 text-sm cursor-pointer text-destructive focus:text-destructive rounded-lg py-2.5 px-3 font-display"><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </div>
 </div>
 </div>
 </motion.div>
 );
}

// ═══════════════════════════════════════════════════════════════════
export default function AdminConteudo() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const { data: coursesRaw = [], isLoading } = useCoursesQuery();
 const { data: productsRaw = [] } = useProductsQuery();
 const { data: transactions = [] } = useTransactions();
 const invalidateAll = useInvalidateAll();
 const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});

 const courses = useMemo(() => coursesRaw.map((c: any) => { const { modules: _, ...rest } = c; return rest; }) as Course[], [coursesRaw]);
 const products = useMemo(() => productsRaw.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price) })) as Product[], [productsRaw]);

 const courseIds = useMemo(() => courses.map(c => c.id).sort().join(","), [courses]);

 useEffect(() => {
 if (!courseIds) return;
 const ids = courseIds.split(",");
 supabase.from("user_access").select("course_id").eq("status", "active").in("course_id", ids)
 .then(({ data }) => {
 const counts: Record<string, number> = {};
 data?.forEach(a => { counts[a.course_id] = (counts[a.course_id] || 0) + 1; });
 setStudentCounts(counts);
 });
 }, [courseIds]);

 const courseStats = useMemo(() => {
 const stats: Record<string, { modules: number; lessons: number }> = {};
 coursesRaw.forEach((c: any) => {
 const mods = c.modules || [];
 stats[c.id] = { modules: mods.length, lessons: mods.reduce((a: number, m: any) => a + (m.lessons?.length || 0), 0) };
 });
 return stats;
 }, [coursesRaw]);

 const revenueByProduct = useMemo(() => {
 const map: Record<string, number> = {};
 transactions.filter(t => t.status === "completed" && t.product_id).forEach(t => {
 map[t.product_id!] = (map[t.product_id!] || 0) + Number(t.net_amount);
 });
 return map;
 }, [transactions]);

 const getCourseRevenue = (c: Course) => c.product_id ? (revenueByProduct[c.product_id] || 0) : 0;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editCourseData, setEditCourseData] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingCourse, setDeletingCourse] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reloadCourses = () => invalidateAll(["courses", "products"]);

  const openNew = () => {
    setEditCourseData(null);
    setWizardOpen(true);
  };

  const openEdit = (c: Course) => {
    const sourceCourse = coursesRaw.find((item: any) => item.id === c.id);
    setEditCourseData({
      ...c,
      modules: (sourceCourse?.modules || []).map((module: any) => ({
        id: module.id,
        title: module.title,
        banner_url: module.banner_url ?? null,
        lessonsCount: module.lessons?.length ?? 0,
      })),
    });
    setWizardOpen(true);
  };

  const togglePublish = async (id: string, cur: boolean) => {
    if (!user) return;
    await supabase.from("courses").update({ is_published: !cur }).eq("id", id).eq("user_id", user.id);
    reloadCourses();
    toast.success(cur ? "Despublicado" : "Publicado!");
  };

  const deleteCourse = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDeleteCourse = async () => {
    if (!user || !deleteTarget) return;
    setDeletingCourse(true);
    const { data: courseModules } = await supabase.from("modules").select("id").eq("course_id", deleteTarget);
    if (courseModules && courseModules.length > 0) {
      await supabase.from("lessons").delete().in("module_id", courseModules.map(m => m.id));
      await supabase.from("modules").delete().eq("course_id", deleteTarget);
    }
    await supabase.from("user_access").delete().eq("course_id", deleteTarget);
    await supabase.from("courses").delete().eq("id", deleteTarget).eq("user_id", user.id);
    setDeletingCourse(false);
    setDeleteTarget(null);
    reloadCourses();
    toast.success("Curso excluído!");
  };

  const filtered = useMemo(() => {
    return courses.filter(c => {
      const q = search.toLowerCase();
      const matchSearch = c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
      const matchFilter = filter === "all" || (filter === "published" ? c.is_published : !c.is_published);
      return !!matchSearch && matchFilter;
    });
  }, [courses, search, filter]);

  const getMemberLink = (courseId: string) => `${window.location.origin}/membros-area/curso/${courseId}`;

  const copyMemberLink = (courseId: string) => {
    navigator.clipboard.writeText(getMemberLink(courseId));
    setCopiedId(courseId);
    toast.success("Link copiado!");
    window.setTimeout(() => {
      setCopiedId(current => current === courseId ? null : current);
    }, 2000);
  };

  const totalCourses = courses.length;
  const publishedCourses = courses.filter(c => c.is_published).length;
  const draftCourses = totalCourses - publishedCourses;

  const tabs = [
    { label: "Todos", value: "all" as const, count: totalCourses },
    { label: "Publicados", value: "published" as const, count: publishedCourses },
    { label: "Rascunhos", value: "draft" as const, count: draftCourses },
  ];

  const statusLabel = (isPublished: boolean) => isPublished ? "Publicado" : "Rascunho";
  const statusDot = (isPublished: boolean) => isPublished ? "bg-success" : "bg-muted-foreground/30";

  const totalStudents = Object.values(studentCounts).reduce((a, c) => a + c, 0);
  const totalModules = Object.values(courseStats).reduce((a, s) => a + s.modules, 0);
  const totalLessonsCount = Object.values(courseStats).reduce((a, s) => a + s.lessons, 0);
  const totalRevenue = courses.reduce((a, c) => a + getCourseRevenue(c), 0);

   return (
    <div className="mx-auto -mt-2 w-full max-w-[1440px] pb-24 md:-mt-3 md:pb-10">
      {/* ── Header ── */}
      <div className="px-5 pt-1 sm:px-7 md:pt-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 border border-border">
                <GraduationCap className="h-5 w-5 text-primary" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                  Área de Membros
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    {courses.length} {courses.length === 1 ? "curso cadastrado" : "cursos cadastrados"}
                  </p>
                  {publishedCourses > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      {publishedCourses} publicado{publishedCourses !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={openNew}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:-translate-y-px"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Novo curso
          </button>
        </div>

        {/* ── Toolbar ── */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5">
            {tabs.map((item) => {
              const active = filter === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "relative rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all duration-150",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                  {item.count > 0 && (
                    <span className={cn(
                      "ml-1 text-[10px] tabular-nums",
                      active ? "text-primary" : "text-muted-foreground/50"
                    )}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-8 w-full rounded-lg border border-border bg-secondary pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 sm:w-52"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-5 mt-5 h-px bg-border sm:mx-7" />

      {/* ── Course List ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center px-6 py-32 text-center">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-32 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary">
            <GraduationCap className="h-7 w-7 text-muted-foreground" strokeWidth={1.4} />
          </div>
          <p className="mt-5 text-sm font-semibold text-foreground">
            {search || filter !== "all" ? "Nenhum resultado" : "Comece por aqui"}
          </p>
          <p className="mt-1.5 max-w-[260px] text-xs leading-relaxed text-muted-foreground">
            {search || filter !== "all" ? "Tente ajustar os filtros para encontrar o que procura." : "Crie seu primeiro curso e comece a entregar conteúdo."}
          </p>
          {!search && filter === "all" && (
            <button
              onClick={openNew}
              className="mt-6 inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Criar curso
            </button>
          )}
        </div>
      ) : (
        <div className="px-5 pt-5 pb-8 sm:px-7">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_100px_100px_80px_100px_36px] items-center px-4 h-9 border-b border-border bg-secondary/50">
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Curso</span>
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Conteúdo</span>
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Alunos</span>
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Status</span>
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">Receita</span>
            <span />
          </div>

          <div className="divide-y divide-border/30">
            {filtered.map((c) => {
              const stats = courseStats[c.id] || { modules: 0, lessons: 0 };
              const product = products.find(p => p.id === c.product_id);
              const revenue = getCourseRevenue(c);
              const students = studentCounts[c.id] || 0;
              const isLive = !!c.is_published;

              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                  className="group grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_100px_100px_80px_100px_36px] items-center px-4 py-3 sm:py-0 sm:h-[56px] hover:bg-muted/10 transition-colors cursor-pointer"
                >
                  {/* Course */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-md overflow-hidden shrink-0 bg-muted/30">
                      {c.thumbnail_url ? (
                        <img src={c.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <GraduationCap className="h-3.5 w-3.5 text-muted-foreground/25" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground/50 truncate">
                        {product ? product.name : c.description || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="hidden sm:block">
                    <p className="text-[12px] text-muted-foreground tabular-nums">{stats.modules}m · {stats.lessons}a</p>
                  </div>

                  {/* Alunos */}
                  <div className="hidden sm:block">
                    <p className="text-[12px] text-muted-foreground tabular-nums">{students > 0 ? students : "—"}</p>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isLive ? "bg-primary" : "bg-muted-foreground/25"
                    )} />
                    <span className="text-[12px] text-muted-foreground">{isLive ? "Live" : "Draft"}</span>
                  </div>

                  {/* Receita */}
                  <div className="hidden sm:block">
                    <p className={cn("text-[12px] tabular-nums", revenue > 0 ? "text-foreground font-medium" : "text-muted-foreground/30")}>
                      {revenue > 0 ? fmt(revenue) : "—"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="hidden sm:flex justify-end" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/25 hover:text-foreground transition-colors">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-lg">
                        <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)} className="gap-2 text-[12px] cursor-pointer">
                          <ChevronRight className="h-3.5 w-3.5" /> Gerenciar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2 text-[12px] cursor-pointer">
                          <Edit className="h-3.5 w-3.5" /> Configurações
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePublish(c.id, c.is_published ?? false)} className="gap-2 text-[12px] cursor-pointer">
                          {isLive ? <><EyeOff className="h-3.5 w-3.5" /> Despublicar</> : <><Eye className="h-3.5 w-3.5" /> Publicar</>}
                        </DropdownMenuItem>
                        {isLive && (
                          <>
                            <DropdownMenuItem onClick={() => copyMemberLink(c.id)} className="gap-2 text-[12px] cursor-pointer">
                              <Copy className="h-3.5 w-3.5" /> Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(getMemberLink(c.id), "_blank")} className="gap-2 text-[12px] cursor-pointer">
                              <PlayCircle className="h-3.5 w-3.5" /> Ver área
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteCourse(c.id)} className="gap-2 text-[12px] text-destructive cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Mobile meta */}
                  <div className="flex items-center justify-between mt-1.5 sm:hidden">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className={cn("h-1.5 w-1.5 rounded-full", isLive ? "bg-primary" : "bg-muted-foreground/25")} />
                        {isLive ? "Live" : "Draft"}
                      </span>
                      <span>{stats.modules}m · {stats.lessons}a</span>
                      {revenue > 0 && <span className="font-medium text-foreground">{fmt(revenue)}</span>}
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/30">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-lg">
                          <DropdownMenuItem onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)} className="gap-2 text-[12px] cursor-pointer">
                            <ChevronRight className="h-3.5 w-3.5" /> Gerenciar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2 text-[12px] cursor-pointer">
                            <Edit className="h-3.5 w-3.5" /> Configurações
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteCourse(c.id)} className="gap-2 text-[12px] text-destructive cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CourseCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        products={products}
        editCourse={editCourseData}
        onSaved={reloadCourses}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold text-lg">Excluir curso</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tem certeza? Módulos, aulas e acessos vinculados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCourse} className="rounded-lg">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCourse} disabled={deletingCourse} className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2">
              {deletingCourse && <Loader2 className="h-4 w-4 animate-spin" />}
              {deletingCourse ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
