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
  ChevronRight, GraduationCap, Loader2, ExternalLink, Calendar,
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

  const totalStudents = Object.values(studentCounts).reduce((a, c) => a + c, 0);
  const totalModules = Object.values(courseStats).reduce((a, s) => a + s.modules, 0);
  const totalLessonsCount = Object.values(courseStats).reduce((a, s) => a + s.lessons, 0);
  const totalRevenue = courses.reduce((a, c) => a + getCourseRevenue(c), 0);

  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

   return (
    <div className="mx-auto w-full max-w-[1340px] px-5 pb-24 sm:px-7 md:pb-10">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="font-display text-[28px] font-black tracking-[-0.025em] text-foreground sm:text-[32px]">
            Áreas de Membros
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Gerencie cursos, conteúdos e acessos dos seus alunos.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[12.5px] font-bold text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Nova área
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className="mt-5 grid grid-cols-2 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-4">
        {[
          { label: "Áreas", value: String(totalCourses), sub: `${publishedCourses} publicadas` },
          { label: "Conteúdo", value: String(totalModules), sub: `${totalLessonsCount} aulas no total` },
          { label: "Alunos", value: String(totalStudents), sub: "com acesso ativo" },
          { label: "Receita vinculada", value: fmt(totalRevenue), sub: `${courses.filter(c => c.product_id).length} produtos conectados` },
        ].map((stat, i) => (
          <div key={stat.label} className={cn("px-5 py-4", i >= 2 && "md:border-l-0")}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-[22px] font-display font-black tracking-[-0.03em] text-foreground tabular-nums leading-none">
              {stat.value}
            </p>
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-[3px]">
          {tabs.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={cn(
                  "h-7 rounded-md px-3 text-[11.5px] font-semibold transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
                {item.count > 0 && (
                  <span className={cn(
                    "ml-1.5 text-[10px] tabular-nums",
                    active ? "text-foreground/60" : "text-muted-foreground/60"
                  )}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou descrição"
              className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-[3px]">
            <button
              onClick={() => setViewMode("list")}
              className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors", viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
              title="Lista"
            >
              <List className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn("flex h-7 w-7 items-center justify-center rounded-md transition-colors", viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
              title="Grade"
            >
              <Grid3X3 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Workspace ── */}
      <div className="mt-4">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted">
            <GraduationCap className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="mt-4 text-[14px] font-bold text-foreground">
            {search || filter !== "all" ? "Nenhum resultado" : "Comece por aqui"}
          </p>
          <p className="mt-1 max-w-[280px] text-[12px] text-muted-foreground">
            {search || filter !== "all" ? "Tente ajustar os filtros para encontrar o que procura." : "Crie sua primeira área de membros e entregue conteúdo."}
          </p>
          {!search && filter === "all" && (
            <button
              onClick={openNew}
              className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-4 text-[12px] font-bold text-background hover:opacity-90 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Criar área
            </button>
          )}
        </div>
      ) : viewMode === "list" ? (
        // ─── LIST VIEW (operational, default) ───────────────────
        <div className="px-5 pt-5 pb-8 sm:px-7">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Header row */}
            <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_110px_110px_140px_120px] items-center gap-4 border-b border-border bg-secondary/40 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground md:grid">
              <div>Área de membros</div>
              <div>Produto vinculado</div>
              <div className="text-right">Conteúdo</div>
              <div className="text-right">Alunos</div>
              <div className="text-right">Receita</div>
              <div className="text-right pr-1">Ações</div>
            </div>

            {filtered.map((c) => {
              const stats = courseStats[c.id] || { modules: 0, lessons: 0 };
              const product = products.find((p) => p.id === c.product_id);
              const revenue = getCourseRevenue(c);
              const students = studentCounts[c.id] || 0;
              const isLive = !!c.is_published;
              const initial = c.title.charAt(0).toUpperCase();

              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                  className="group grid cursor-pointer grid-cols-1 items-center gap-4 border-b border-border px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-accent/40 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_110px_110px_140px_120px]"
                >
                  {/* Identity */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      {c.thumbnail_url ? (
                        <img src={c.thumbnail_url} alt={c.title} loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                          <span className="font-display text-base font-black text-primary/60">{initial}</span>
                        </div>
                      )}
                      <div className="absolute bottom-0.5 right-0.5">
                        <span className={cn("flex h-2 w-2 rounded-full ring-1 ring-card", isLive ? "bg-success" : "bg-muted-foreground/40")} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[13.5px] font-bold leading-tight text-foreground">{c.title}</h3>
                        <span className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                          isLive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        )}>
                          {isLive ? "Live" : "Draft"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11.5px] leading-snug text-muted-foreground">
                        {c.description || "Sem descrição"}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" strokeWidth={2} />
                          {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="font-mono uppercase tracking-widest">#{c.id.slice(0, 6)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Product link */}
                  <div className="min-w-0">
                    {product ? (
                      <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-semibold text-primary">
                        <LinkIcon className="h-3 w-3 shrink-0" strokeWidth={2} />
                        <span className="truncate">{product.name}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-[11px] font-medium text-muted-foreground/70">
                        <Lock className="h-3 w-3" strokeWidth={2} />
                        Sem produto
                      </div>
                    )}
                  </div>

                  {/* Content count */}
                  <div className="flex items-center justify-end gap-3 text-right md:gap-1">
                    <div>
                      <div className="font-numbers text-sm font-black tabular-nums text-foreground">{stats.modules}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">mód</div>
                    </div>
                    <div className="ml-2 border-l border-border pl-2">
                      <div className="font-numbers text-sm font-black tabular-nums text-foreground">{stats.lessons}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">aulas</div>
                    </div>
                  </div>

                  {/* Students */}
                  <div className="text-right">
                    <div className={cn("font-numbers text-sm font-black tabular-nums", students > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                      {students}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">ativos</div>
                  </div>

                  {/* Revenue */}
                  <div className="text-right">
                    {revenue > 0 ? (
                      <>
                        <div className="font-numbers text-sm font-black tabular-nums text-success">{fmt(revenue)}</div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">vinculada</div>
                      </>
                    ) : (
                      <div className="text-[11px] font-medium text-muted-foreground/40">—</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {isLive && (
                      <button
                        onClick={() => copyMemberLink(c.id)}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                          copiedId === c.id
                            ? "border-success/40 bg-success/15 text-success"
                            : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                        title="Copiar link"
                      >
                        {copiedId === c.id ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />}
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent"
                    >
                      Gerenciar
                      <ChevronRight className="h-3 w-3" strokeWidth={2} />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={6} className="w-[200px] rounded-xl border border-border bg-secondary p-1.5 shadow-none">
                        <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-foreground/80 cursor-pointer">
                          <Edit className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} /> Configurações
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePublish(c.id, c.is_published ?? false)} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-foreground/80 cursor-pointer">
                          {isLive ? <EyeOff className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} /> : <Eye className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />}
                          {isLive ? "Despublicar" : "Publicar"}
                        </DropdownMenuItem>
                        {isLive && (
                          <DropdownMenuItem onClick={() => window.open(getMemberLink(c.id), "_blank")} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-foreground/80 cursor-pointer">
                            <PlayCircle className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} /> Ver área
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="mx-1 my-1 bg-border" />
                        <DropdownMenuItem onClick={() => deleteCourse(c.id)} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-destructive cursor-pointer focus:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // ─── GRID VIEW ───────────────────────────────────────────
        <div className="px-5 pt-5 pb-8 sm:px-7">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((c) => {
              const stats = courseStats[c.id] || { modules: 0, lessons: 0 };
              const product = products.find(p => p.id === c.product_id);
              const revenue = getCourseRevenue(c);
              const students = studentCounts[c.id] || 0;
              const isLive = !!c.is_published;
              const initial = c.title.charAt(0).toUpperCase();

              return (
                <article
                  key={c.id}
                  onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                  className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-primary/50 hover:-translate-y-0.5"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt={c.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                        <span className="font-display text-3xl font-black text-primary/60">{initial}</span>
                      </div>
                    )}
                    <div className="absolute left-3 top-3">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border",
                        isLive ? "bg-success/15 text-success border-success/25" : "bg-card/95 text-muted-foreground border-border"
                      )}>
                        {isLive && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                          </span>
                        )}
                        {isLive ? "Live" : "Rascunho"}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-card/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground border border-border">
                        <Layers className="h-3 w-3" strokeWidth={2} />
                        {stats.modules}m · {stats.lessons}a
                      </span>
                      {students > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-card/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground border border-border">
                          <Users className="h-3 w-3" strokeWidth={2} />
                          {students}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="truncate text-[15px] font-bold leading-6 text-foreground">{c.title}</h3>
                    <p className="mt-1 truncate text-[13px] leading-5 text-muted-foreground">{c.description || "Sem descrição"}</p>

                    <div className="mt-5 flex items-end justify-between">
                      {revenue > 0 ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-numbers text-2xl font-black tabular-nums tracking-tight text-success">{fmt(revenue)}</span>
                          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">receita</span>
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-muted-foreground/40">Sem receita</span>
                      )}
                      {product && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary truncate max-w-[120px]">
                          <LinkIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                          <span className="truncate">{product.name}</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-auto pt-4">
                      <div className="h-px bg-border mb-4" />
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          <Edit className="h-3.5 w-3.5" strokeWidth={1.8} />
                          Gerenciar
                        </button>
                        {isLive && (
                          <>
                            <button
                              onClick={() => copyMemberLink(c.id)}
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                                copiedId === c.id
                                  ? "border-success/40 bg-success/15 text-success"
                                  : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent"
                              )}
                              title="Copiar link"
                            >
                              <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </button>
                            <button
                              onClick={() => window.open(getMemberLink(c.id), "_blank")}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
                              title="Ver área de membros"
                            >
                              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </button>
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={6} className="w-[200px] rounded-xl border border-border bg-secondary p-1.5 shadow-none">
                            <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-foreground/80 cursor-pointer">
                              <Edit className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} /> Configurações
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => togglePublish(c.id, c.is_published ?? false)} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-foreground/80 cursor-pointer">
                              {isLive ? <EyeOff className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} /> : <Eye className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />}
                              {isLive ? "Despublicar" : "Publicar"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="mx-1 my-1 bg-border" />
                            <DropdownMenuItem onClick={() => deleteCourse(c.id)} className="gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-destructive cursor-pointer focus:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </article>
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
        <AlertDialogContent className="max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">Excluir curso</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-muted-foreground">Tem certeza? Módulos, aulas e acessos vinculados serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCourse} className="h-9 rounded-lg text-[13px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCourse} disabled={deletingCourse} className="h-9 gap-1.5 rounded-lg bg-destructive text-[13px] text-destructive-foreground hover:bg-destructive/90">
              {deletingCourse && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deletingCourse ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
