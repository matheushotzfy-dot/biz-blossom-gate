import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts as useProductsQuery, useCourses as useCoursesQuery, useTransactions, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Plus, BookOpen, Layers, Trash2, Edit, Eye, EyeOff,
  Link as LinkIcon, Search, Copy, MoreVertical,
  Globe, Lock, Image as ImageIcon, X, Check,
  Video, DollarSign, PlayCircle, Sparkles, Clock,
  TrendingUp, Users, Zap, ArrowRight, Grid3X3, List,
  BarChart3, Star, Flame, Crown, ChevronRight, GraduationCap,
  Award, Rocket, Target, Activity, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-primary/5 blur-[60px] opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 pointer-events-none" />

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

  useEffect(() => {
    if (courses.length === 0) return;
    supabase.from("user_access").select("course_id").eq("status", "active").in("course_id", courses.map(c => c.id))
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        data?.forEach(a => { counts[a.course_id] = (counts[a.course_id] || 0) + 1; });
        setStudentCounts(counts);
      });
  }, [courses]);

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" });

  const reloadCourses = () => invalidateAll(["courses", "products"]);

  const openNew = () => {
    setEditCourseId(null);
    setCourseForm({ title: "", description: "", category: "geral", product_id: "", thumbnail_url: "" });
    setSheetOpen(true);
  };

  const openEdit = (c: Course) => {
    setEditCourseId(c.id);
    setCourseForm({ title: c.title, description: c.description || "", category: c.category || "geral", product_id: c.product_id || "", thumbnail_url: c.thumbnail_url || "" });
    setSheetOpen(true);
  };

  const saveCourse = async () => {
    if (!user || !courseForm.title.trim()) { toast.error("Preencha o título"); return; }
    const payload = {
      title: courseForm.title, description: courseForm.description || null,
      category: courseForm.category || "geral",
      product_id: courseForm.product_id && courseForm.product_id !== "none" ? courseForm.product_id : null,
      thumbnail_url: courseForm.thumbnail_url || null,
      user_id: user.id, is_published: false
    };
    if (editCourseId) {
      const { user_id, is_published, ...up } = payload;
      await supabase.from("courses").update(up).eq("id", editCourseId).eq("user_id", user.id);
      toast.success("Curso atualizado!");
      setSheetOpen(false);
    } else {
      const { data } = await supabase.from("courses").insert(payload).select().single();
      toast.success("Curso criado!");
      setSheetOpen(false);
      if (data) navigate(`/vendas/conteudo/${data.id}/builder`);
    }
    reloadCourses();
  };

  const togglePublish = async (id: string, cur: boolean) => {
    if (!user) return;
    await supabase.from("courses").update({ is_published: !cur }).eq("id", id).eq("user_id", user.id);
    reloadCourses();
    toast.success(cur ? "Despublicado" : "Publicado!");
  };

  const deleteCourse = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Tem certeza que deseja excluir este curso e todo seu conteúdo?")) return;
    const { data: courseModules } = await supabase.from("modules").select("id").eq("course_id", id);
    if (courseModules && courseModules.length > 0) {
      await supabase.from("lessons").delete().in("module_id", courseModules.map(m => m.id));
      await supabase.from("modules").delete().eq("course_id", id);
    }
    await supabase.from("user_access").delete().eq("course_id", id);
    await supabase.from("courses").delete().eq("id", id).eq("user_id", user.id);
    reloadCourses();
    toast.success("Curso excluído!");
  };

  const filtered = useMemo(() => {
    return courses.filter(c => {
      const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || (filter === "published" ? c.is_published : !c.is_published);
      return matchSearch && matchFilter;
    });
  }, [courses, search, filter]);

  const getMemberLink = (courseId: string) => `${window.location.origin}/membros-area/curso/${courseId}`;

  const totalCourses = courses.length;
  const publishedCourses = courses.filter(c => c.is_published).length;
  const totalModules = Object.values(courseStats).reduce((a, s) => a + s.modules, 0);
  const totalLessons = Object.values(courseStats).reduce((a, s) => a + s.lessons, 0);
  const totalRevenue = courses.reduce((a, c) => a + getCourseRevenue(c), 0);
  const totalStudents = Object.values(studentCounts).reduce((a, c) => a + c, 0);

  const FILTERS: { id: FilterId; label: string; icon: any; count: number }[] = [
    { id: "all", label: "Todos", icon: BookOpen, count: totalCourses },
    { id: "published", label: "Publicados", icon: Globe, count: publishedCourses },
    { id: "draft", label: "Rascunhos", icon: Lock, count: totalCourses - publishedCourses },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
      <div className="fixed inset-0 dot-grid opacity-30 pointer-events-none z-0" />

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* CINEMATIC HERO                                                  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative mb-8 rounded-3xl overflow-hidden"
      >
        {/* Mesh gradient background */}
        <div className="absolute inset-0 mesh-gradient-hero noise-overlay" />
        <div className="absolute -inset-16 pointer-events-none">
          <motion.div animate={{ x: [0, 25, 0], y: [0, -15, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[160px]" />
          <motion.div animate={{ x: [0, -20, 0], y: [0, 25, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[400px] h-[400px] bg-info/6 rounded-full blur-[140px]" />
          <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/4 rounded-full blur-[180px]" />
        </div>

        <div className="relative z-10 p-6 sm:p-8 lg:p-10">
          {/* Top bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10">
            <div className="flex items-center gap-3">
              <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: 0.6, delay: 0.1, type: "spring" }}>
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
              </motion.div>
              <div>
                <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Área de Membros</span>
              </div>
              {publishedCourses > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm shadow-[0_0_16px_rgba(34,197,94,0.08)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />
                    <span className="relative h-2 w-2 rounded-full bg-success shadow-[0_0_8px_hsl(var(--success))]" />
                  </span>
                  <span className="text-[8px] font-heading uppercase tracking-[0.25em] text-success">{publishedCourses} Live</span>
                </div>
              )}
            </div>
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              onClick={openNew}
              className="h-10 px-5 rounded-xl text-sm font-display font-bold flex items-center gap-2 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97] transition-all duration-300"
            >
              <Plus className="h-4 w-4" /> Novo Curso
            </motion.button>
          </div>

          {/* Big number + tagline */}
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 max-w-[40px] bg-gradient-to-r from-primary/40 to-transparent" />
              <p className="text-[10px] font-heading uppercase tracking-[0.3em] text-gradient-premium">Seus Cursos</p>
              <div className="h-px flex-1 max-w-[40px] bg-gradient-to-l from-primary/40 to-transparent" />
            </div>
            <div className="flex items-end gap-4 mb-3">
              <span className="text-6xl sm:text-7xl lg:text-8xl font-heading tabular-nums text-foreground leading-[0.82] glow-value [text-shadow:0_0_80px_hsl(var(--primary)/0.2)]">
                <AnimatedNumber value={totalCourses} />
              </span>
              <span className="text-lg font-heading text-muted-foreground/25 mb-1.5">curso{totalCourses !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display glass-panel rounded-full px-3.5 py-1.5">
                <Flame className="h-3 w-3 text-success" /> {publishedCourses} publicados
              </motion.span>
              <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display glass-panel rounded-full px-3.5 py-1.5">
                <Layers className="h-3 w-3" /> {totalModules} módulos
              </motion.span>
              <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56 }} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display glass-panel rounded-full px-3.5 py-1.5">
                <Video className="h-3 w-3 text-info" /> {totalLessons} aulas
              </motion.span>
              {totalStudents > 0 && (
                <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.64 }} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/35 font-display glass-panel rounded-full px-3.5 py-1.5">
                  <Users className="h-3 w-3 text-primary" /> {totalStudents} alunos
                </motion.span>
              )}
            </div>
          </motion.div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Cursos", value: totalCourses, icon: BookOpen, color: "primary" },
              { label: "Publicados", value: publishedCourses, icon: Globe, color: "success" },
              { label: "Módulos", value: totalModules, icon: Layers, color: "info" },
              { label: "Aulas", value: totalLessons, icon: Video, color: "warning" },
              { label: "Alunos", value: totalStudents, icon: Users, color: "primary" },
            ].map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + idx * 0.06 }}
                className="group rounded-2xl glass-panel p-4 card-premium overflow-hidden relative"
              >
                <div className={cn("absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[40px] pointer-events-none", `bg-${item.color}/10`)} />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/30 mb-2">{item.label}</p>
                    <p className={cn("text-xl font-heading tabular-nums tracking-tight leading-none", item.color === "primary" ? "text-foreground" : `text-${item.color}`)}>
                      <AnimatedNumber value={item.value} />
                    </p>
                  </div>
                  <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110", `bg-${item.color}/8 border-${item.color}/10 text-${item.color}/50`)}>
                    <item.icon className="h-4 w-4" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Revenue highlight */}
          {totalRevenue > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-4 rounded-2xl glass-panel p-4 flex items-center justify-between card-premium">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-success/8 border border-success/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-success/60" />
                </div>
                <div>
                  <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/30">Receita Total dos Cursos</p>
                  <p className="text-lg font-heading tabular-nums text-success tracking-tight">{fmt(totalRevenue)}</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-display font-bold text-success/50 bg-success/5 px-3 py-1.5 rounded-lg border border-success/10">
                <TrendingUp className="h-3 w-3" /> Ativo
              </div>
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* ═══ Toolbar ═══ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/25 group-focus-within:text-primary/50 transition-colors" />
              <Input
                placeholder="Buscar cursos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-11 h-11 rounded-xl bg-card/50 border-border/20 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-sm font-display"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-card/40 backdrop-blur-xl border border-border/15">
              {FILTERS.map(f => {
                const isActive = filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-display font-bold transition-all duration-300 active:scale-[0.985]",
                      isActive ? "text-foreground" : "text-muted-foreground/35 hover:text-muted-foreground/55"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="content-filter-active"
                        className="absolute inset-0 rounded-lg bg-card border border-border/30 shadow-sm"
                        transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
                      />
                    )}
                    <f.icon className="h-3.5 w-3.5 relative z-10" />
                    <span className="relative z-10 hidden sm:inline">{f.label}</span>
                    {f.count > 0 && (
                      <span className={cn(
                        "relative z-10 text-[10px] font-black px-1.5 py-0.5 rounded-md transition-colors",
                        isActive ? "bg-primary/10 text-primary" : "bg-muted/10 text-muted-foreground/25"
                      )}>{f.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* View mode */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-card/40 backdrop-blur-xl border border-border/15">
            {[
              { id: "grid" as const, icon: Grid3X3 },
              { id: "list" as const, icon: List },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className={cn(
                  "relative h-8 w-8 rounded-md flex items-center justify-center transition-all duration-300",
                  viewMode === v.id ? "text-foreground" : "text-muted-foreground/25 hover:text-muted-foreground/45"
                )}
              >
                {viewMode === v.id && (
                  <motion.div
                    layoutId="content-view-mode"
                    className="absolute inset-0 rounded-md bg-card border border-border/30 shadow-sm"
                    transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
                  />
                )}
                <v.icon className="h-3.5 w-3.5 relative z-10" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ═══ Content Grid ═══ */}
      {isLoading ? (
        <div className="py-24 text-center">
          <div className="inline-flex flex-col items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center shadow-lg shadow-primary/10">
              <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-base text-muted-foreground font-display font-bold">Carregando cursos...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-24 text-center">
          <div className="inline-flex flex-col items-center gap-6 max-w-sm">
            <div className="h-28 w-28 rounded-3xl bg-gradient-to-br from-primary/8 via-info/5 to-primary/3 border border-border/15 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "12px 12px" }} />
              <GraduationCap className="h-14 w-14 text-primary/15" />
            </div>
            <div>
              <h3 className="text-xl font-display font-black text-foreground/40 mb-2">
                {search || filter !== "all" ? "Nenhum curso encontrado" : "Crie seu primeiro curso"}
              </h3>
              <p className="text-sm text-muted-foreground/60 leading-relaxed">
                {search || filter !== "all" ? "Tente alterar os filtros de busca" : "Monte aulas incríveis e entregue conteúdo premium aos seus alunos"}
              </p>
            </div>
            {!search && filter === "all" && (
              <Button onClick={openNew} className="gap-2.5 rounded-2xl font-display font-bold shadow-xl shadow-primary/20 h-12 px-7 text-base">
                <Sparkles className="h-5 w-5" /> Criar Curso
              </Button>
            )}
          </div>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${filter}-${viewMode}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((c, i) => {
                  const stats = courseStats[c.id] || { modules: 0, lessons: 0 };
                  const product = products.find(p => p.id === c.product_id);
                  const revenue = getCourseRevenue(c);
                  return (
                    <CourseCard
                      key={c.id}
                      course={c}
                      stats={stats}
                      product={product}
                      revenue={revenue}
                      studentCount={studentCounts[c.id] || 0}
                      onEdit={() => openEdit(c)}
                      onNavigate={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                      onTogglePublish={() => togglePublish(c.id, c.is_published ?? false)}
                      onDelete={() => deleteCourse(c.id)}
                      onCopyLink={() => { navigator.clipboard.writeText(getMemberLink(c.id)); toast.success("Link copiado!"); }}
                      getMemberLink={getMemberLink(c.id)}
                      index={i}
                    />
                  );
                })}
              </div>
            ) : (
              /* ── List View ── */
              <div className="rounded-2xl border border-border/15 bg-card/40 backdrop-blur-xl overflow-hidden">
                <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3.5 border-b border-border/10 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-muted-foreground/30">
                  <span>Curso</span><span>Status</span><span>Conteúdo</span><span>Produto</span><span>Receita</span><span></span>
                </div>
                {filtered.map((c, i) => {
                  const stats = courseStats[c.id] || { modules: 0, lessons: 0 };
                  const product = products.find(p => p.id === c.product_id);
                  const revenue = getCourseRevenue(c);
                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 sm:gap-4 items-center px-5 sm:px-6 py-4 sm:py-5 border-b border-border/8 hover:bg-primary/[0.015] transition-all duration-300 cursor-pointer group"
                      onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-12 w-20 rounded-xl overflow-hidden shrink-0 bg-muted/5 border border-border/10">
                          {c.thumbnail_url ? (
                            <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent">
                              <GraduationCap className="h-5 w-5 text-primary/10" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-display font-bold text-foreground truncate">{c.title}</p>
                          <p className="text-[10px] text-muted-foreground/40 truncate mt-0.5 tabular-nums">{new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                      <div>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-display font-bold border",
                          c.is_published ? "bg-success/8 text-success border-success/10" : "bg-muted/6 text-muted-foreground/40 border-border/10"
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", c.is_published ? "bg-success animate-pulse" : "bg-muted-foreground/20")} />
                          {c.is_published ? "Live" : "Rascunho"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground/50">
                        <span className="flex items-center gap-1"><Layers className="h-3 w-3 text-primary/40" /> {stats.modules}</span>
                        <span className="flex items-center gap-1"><Video className="h-3 w-3 text-info/40" /> {stats.lessons}</span>
                      </div>
                      <div>
                        {product ? (
                          <span className="text-xs font-display font-bold text-primary/80 truncate block">{product.name}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/15">—</span>
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-display font-bold text-foreground tabular-nums">{fmt(revenue)}</span>
                      </div>
                      <div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <button className="h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/15">
                              <MoreVertical className="h-4 w-4 text-muted-foreground/30" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[200px] rounded-xl p-1.5">
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(`/vendas/conteudo/${c.id}/builder`); }} className="gap-3 text-sm cursor-pointer rounded-lg py-2.5 px-3 font-display"><ArrowRight className="h-4 w-4" /> Gerenciar</DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(c); }} className="gap-3 text-sm cursor-pointer rounded-lg py-2.5 px-3 font-display"><Edit className="h-4 w-4" /> Configurações</DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); togglePublish(c.id, c.is_published ?? false); }} className="gap-3 text-sm cursor-pointer rounded-lg py-2.5 px-3 font-display">
                              {c.is_published ? <><EyeOff className="h-4 w-4" /> Despublicar</> : <><Eye className="h-4 w-4" /> Publicar</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(getMemberLink(c.id)); toast.success("Link copiado!"); }} className="gap-3 text-sm cursor-pointer rounded-lg py-2.5 px-3 font-display"><Copy className="h-4 w-4" /> Copiar link</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); deleteCourse(c.id); }} className="gap-3 text-sm cursor-pointer text-destructive focus:text-destructive rounded-lg py-2.5 px-3 font-display"><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Results footer */}
      {!isLoading && filtered.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center justify-between px-1 mt-4">
          <p className="text-xs text-muted-foreground/40 font-display font-semibold">{filtered.length} curso{filtered.length > 1 ? "s" : ""}</p>
          {totalRevenue > 0 && <p className="text-xs font-display font-bold text-primary/60 tabular-nums">{fmt(totalRevenue)} total</p>}
        </motion.div>
      )}

      {/* ═══ Course Create/Edit Sheet ═══ */}
      <Sheet open={sheetOpen} onOpenChange={v => { setSheetOpen(v); if (!v) setEditCourseId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card/95 backdrop-blur-2xl border-l border-border/15">
          <SheetHeader className="mb-10">
            <SheetTitle className="flex items-center gap-4">
              <div className="h-13 w-13 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                {editCourseId ? <Edit className="h-6 w-6 text-primary-foreground" /> : <Sparkles className="h-6 w-6 text-primary-foreground" />}
              </div>
              <div>
                <span className="text-xl font-display font-black tracking-[-0.03em]">{editCourseId ? "Editar Curso" : "Novo Curso"}</span>
                <p className="text-sm font-display text-muted-foreground mt-1">{editCourseId ? "Atualize as informações" : "Crie algo incrível"}</p>
              </div>
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={e => { e.preventDefault(); saveCourse(); }} className="space-y-7">
            <div>
              <Label className="text-xs font-display font-bold text-foreground/60 uppercase tracking-[0.08em]">Nome do Curso *</Label>
              <Input value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Marketing Digital Avançado" className="mt-2.5 h-13 rounded-xl text-base font-display" required />
            </div>

            <div>
              <Label className="text-xs font-display font-bold text-foreground/60 uppercase tracking-[0.08em]">Descrição</Label>
              <Textarea value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} placeholder="O que os alunos vão aprender..." className="mt-2.5 rounded-xl text-sm font-display" rows={4} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-display font-bold text-foreground/60 uppercase tracking-[0.08em]">Categoria</Label>
                <Input value={courseForm.category} onChange={e => setCourseForm(p => ({ ...p, category: e.target.value }))} placeholder="Ex: Marketing" className="mt-2.5 h-12 rounded-xl font-display" />
              </div>
              <div>
                <Label className="text-xs font-display font-bold text-foreground/60 uppercase tracking-[0.08em]">Produto Vinculado</Label>
                <Select value={courseForm.product_id} onValueChange={v => setCourseForm(p => ({ ...p, product_id: v }))}>
                  <SelectTrigger className="mt-2.5 rounded-xl h-12 font-display"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ImageUploadZone value={courseForm.thumbnail_url} onChange={url => setCourseForm(p => ({ ...p, thumbnail_url: url }))} label="Thumbnail do Curso" height="h-44" />

            <Button type="submit" className="w-full h-13 rounded-xl font-display font-bold text-base gap-2.5 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/25 transition-all">
              <Check className="h-5 w-5" />
              {editCourseId ? "Salvar Alterações" : "Criar Curso"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
