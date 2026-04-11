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

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-28 md:pb-16">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Área de Membros</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{courses.length} curso{courses.length !== 1 && "s"} cadastrado{courses.length !== 1 && "s"}</p>
        </div>
        <button
          onClick={openNew}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Novo curso
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-0.5 border-b border-border/40 sm:border-0">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={cn(
                "px-3 py-2 text-[13px] font-medium transition-colors relative",
                filter === t.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  "ml-1.5 text-[11px] tabular-nums",
                  filter === t.value ? "text-primary font-semibold" : "text-muted-foreground/50"
                )}>{t.count}</span>
              )}
              {filter === t.value && (
                <motion.div layoutId="content-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-shadow"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground/40" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando cursos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <GraduationCap className="h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            {search || filter !== "all" ? "Nenhum resultado" : "Nenhum curso criado"}
          </p>
          {!search && filter === "all" && (
            <button
              onClick={openNew}
              className="mt-2 h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Criar primeiro curso
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_150px_110px_120px_40px] items-center px-5 py-2.5 border-b border-border/50 bg-muted/30">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Curso</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Conteúdo</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Acesso</span>
            <span />
          </div>

          <div className="divide-y divide-border/40">
            {filtered.map((c) => {
              const stats = courseStats[c.id] || { modules: 0, lessons: 0 };
              const product = products.find(p => p.id === c.product_id);

              return (
                <div
                  key={c.id}
                  className="group grid grid-cols-1 sm:grid-cols-[1fr_150px_110px_120px_40px] items-center px-5 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" loading="lazy" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                        <GraduationCap className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5 max-w-[320px]">
                        {product ? `Vinculado a ${product.name}` : c.description || "Sem descrição"}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <span className="text-[12px] text-foreground">{stats.modules} módulo{stats.modules !== 1 && "s"}</span>
                    <span className="text-[11px] text-muted-foreground/50 mx-1.5">·</span>
                    <span className="text-[12px] text-muted-foreground">{stats.lessons} aula{stats.lessons !== 1 && "s"}</span>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", statusDot(!!c.is_published))} />
                    <span className="text-[12px] text-muted-foreground">{statusLabel(!!c.is_published)}</span>
                  </div>

                  <div className="hidden sm:block" onClick={e => e.stopPropagation()}>
                    {c.is_published ? (
                      <button
                        onClick={() => copyMemberLink(c.id)}
                        className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline font-medium"
                      >
                        <AnimatePresence mode="wait">
                          {copiedId === c.id ? (
                            <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                              <CheckCircle2 className="h-3 w-3 text-success" />
                            </motion.span>
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </AnimatePresence>
                        Copiar link
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/40">—</span>
                    )}
                  </div>

                  <div className="hidden sm:flex justify-end" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-colors">
                          <MoreVertical className="h-4 w-4" />
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
                          {c.is_published ? <><EyeOff className="h-3.5 w-3.5" /> Despublicar</> : <><Eye className="h-3.5 w-3.5" /> Publicar</>}
                        </DropdownMenuItem>
                        {c.is_published && (
                          <DropdownMenuItem onClick={() => window.open(getMemberLink(c.id), "_blank")} className="gap-2 text-[12px] cursor-pointer">
                            <PlayCircle className="h-3.5 w-3.5" /> Ver área
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteCourse(c.id)} className="gap-2 text-[12px] text-destructive cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center justify-between mt-2 sm:hidden">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(!!c.is_published))} />
                        <span className="text-[11px] text-muted-foreground">{statusLabel(!!c.is_published)}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground/50 truncate">
                        {stats.modules} módulo{stats.modules !== 1 && "s"} · {stats.lessons} aula{stats.lessons !== 1 && "s"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {c.is_published && (
                        <button onClick={() => copyMemberLink(c.id)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-primary">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40">
                            <MoreVertical className="h-4 w-4" />
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
                            {c.is_published ? <><EyeOff className="h-3.5 w-3.5" /> Despublicar</> : <><Eye className="h-3.5 w-3.5" /> Publicar</>}
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
