import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts as useProductsQuery, useCourses as useCoursesQuery, useTransactions, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Plus, BookOpen, Layers, Trash2, Edit, Eye, EyeOff,
  Link as LinkIcon, Search, Copy, MoreVertical,
  Globe, Lock, FolderOpen, Image as ImageIcon, X, Check,
  Users, TrendingUp, Clock,
  GraduationCap, Video, DollarSign, BarChart3,
  ArrowUpRight, PlayCircle, Settings, ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────
interface Course {
  id: string; title: string; description: string | null; category: string | null;
  thumbnail_url: string | null; product_id: string | null; is_published: boolean;
  sort_order: number | null; user_id: string; created_at: string;
}
interface Product { id: string; name: string; price: number; }

const fmt = (v: number) =>
  v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// ─── Premium Section Card ─────────────────────────────────────────
function SectionCard({ children, accentColor = "primary", className }: {
  children: React.ReactNode; accentColor?: string; className?: string;
}) {
  return (
    <div className={cn(
      "relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 overflow-hidden shadow-sm",
      className
    )}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", `bg-${accentColor}`)} />
      {children}
    </div>
  );
}

// ─── Image Upload ─────────────────────────────────────────────────
function ImageUploadZone({ value, onChange, label, height = "h-40" }: {
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
      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em] mb-2 block">{label}</Label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className={cn("relative rounded-xl border-2 border-dashed border-border/50 hover:border-primary/40 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer overflow-hidden group/img", height, value ? "p-0" : "flex flex-col items-center justify-center bg-muted/10")}
      >
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-background/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button type="button" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }} className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ImageIcon className="h-4 w-4 text-foreground" />
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); onChange(""); }} className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center text-destructive hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="h-12 w-12 rounded-xl bg-muted/30 flex items-center justify-center mb-2">
              <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground/60">{uploading ? "Enviando..." : "Clique ou arraste"}</p>
            <p className="text-[10px] text-muted-foreground/40">PNG, JPG até 5MB</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ─── Premium KPI Card ─────────────────────────────────────────────
function ContentKpi({ icon, label, value, accentBg, accentText }: {
  icon: React.ReactNode; label: string; value: string; accentBg: string; accentText: string;
}) {
  return (
    <div className="relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 p-5 overflow-hidden hover:border-primary/20 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] group">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `hsl(var(--${accentText === 'text-primary' ? 'primary' : accentText === 'text-success' ? 'success' : accentText === 'text-info' ? 'info' : 'warning'}))` }} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">{label}</span>
        <div className={cn("h-9 w-9 rounded-xl ring-1 flex items-center justify-center", accentBg, `ring-${accentText.replace('text-', '')}/20`)}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-display font-black text-foreground tracking-tight">{value}</p>
    </div>
  );
}

// ─── Course Card ──────────────────────────────────────────────────
function CourseCard({ course, stats, product, revenue, onEdit, onNavigate, onTogglePublish, onDelete, onCopyLink, getMemberLink }: {
  course: Course; stats: { modules: number; lessons: number }; product?: Product;
  revenue: number; onEdit: () => void; onNavigate: () => void;
  onTogglePublish: () => void; onDelete: () => void; onCopyLink: () => void;
  getMemberLink: string;
}) {
  return (
    <div className="group relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 overflow-hidden flex flex-col hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
      {/* Accent bar */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px] rounded-full z-10 transition-opacity",
        course.is_published ? "bg-success opacity-100" : "bg-muted-foreground/20 opacity-50"
      )} />

      {/* Thumbnail */}
      <div className="relative h-44 overflow-hidden cursor-pointer" onClick={onNavigate}>
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/8 via-primary/4 to-transparent">
            <BookOpen className="h-14 w-14 text-primary/15" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-70" />

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-xl",
            course.is_published
              ? "bg-success/20 text-success border border-success/20"
              : "bg-card/80 text-muted-foreground border border-border/40"
          )}>
            {course.is_published ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {course.is_published ? "Publicado" : "Rascunho"}
          </span>
        </div>

        {/* Category */}
        {course.category && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest bg-card/70 backdrop-blur-xl text-muted-foreground border border-border/30">
              {course.category}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="h-12 w-12 rounded-2xl bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-xl shadow-primary/20">
            <FolderOpen className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>

        {/* Stats at bottom */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-card/80 backdrop-blur-xl border border-border/20 px-2.5 py-1 text-[10px] font-bold text-foreground">
            <Layers className="h-3 w-3 text-primary" /> {stats.modules} módulos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-card/80 backdrop-blur-xl border border-border/20 px-2.5 py-1 text-[10px] font-bold text-foreground">
            <Video className="h-3 w-3 text-info" /> {stats.lessons} aulas
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-1 flex-col">
        <h3 className="text-[15px] font-display font-black text-foreground leading-snug line-clamp-1 mb-1 tracking-tight">{course.title}</h3>
        {course.description ? (
          <p className="text-[12px] text-muted-foreground/70 line-clamp-2 mb-3 leading-relaxed">{course.description}</p>
        ) : (
          <p className="text-[12px] text-muted-foreground/30 italic mb-3">Sem descrição</p>
        )}

        {/* Product + Revenue */}
        <div className="space-y-2 mb-4">
          {product && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
              <LinkIcon className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[11px] font-semibold text-primary truncate flex-1">{product.name}</span>
              <span className="text-[10px] font-numbers font-bold text-primary/70">{fmt(product.price)}</span>
            </div>
          )}
          {revenue > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/5 border border-success/10">
              <DollarSign className="h-3 w-3 text-success shrink-0" />
              <span className="text-[11px] font-numbers font-semibold text-success">{fmt(revenue)} em vendas</span>
            </div>
          )}
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 mb-3">
          <Clock className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground/50">
            {new Date(course.created_at).toLocaleDateString("pt-BR")}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border/30">
          <Button
            variant="ghost" size="sm"
            className="gap-1.5 rounded-xl text-[11px] h-9 font-bold text-primary hover:text-primary hover:bg-primary/10 flex-1 justify-center"
            onClick={onNavigate}
          >
            <FolderOpen className="h-3.5 w-3.5" /> Gerenciar
          </Button>
          <Button variant="ghost" size="sm" className="rounded-xl h-9 w-9 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={onEdit}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="rounded-xl h-9 w-9 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onClick={onTogglePublish} className="gap-2 text-[12px] cursor-pointer">
                {course.is_published ? <><EyeOff className="h-3.5 w-3.5" /> Despublicar</> : <><Eye className="h-3.5 w-3.5" /> Publicar</>}
              </DropdownMenuItem>
              {course.is_published && (
                <DropdownMenuItem onClick={() => window.open(getMemberLink, "_blank")} className="gap-2 text-[12px] cursor-pointer">
                  <ExternalLink className="h-3.5 w-3.5" /> Visualizar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onCopyLink} className="gap-2 text-[12px] cursor-pointer">
                <Copy className="h-3.5 w-3.5" /> Copiar Link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="gap-2 text-[12px] cursor-pointer text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// ─── List Row View ────────────────────────────────────────────────
function CourseRow({ course, stats, product, revenue, onEdit, onNavigate, onTogglePublish, onDelete, onCopyLink }: {
  course: Course; stats: { modules: number; lessons: number }; product?: Product;
  revenue: number; onEdit: () => void; onNavigate: () => void;
  onTogglePublish: () => void; onDelete: () => void; onCopyLink: () => void;
}) {
  return (
    <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer group" onClick={onNavigate}>
      <td className="p-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-20 rounded-lg overflow-hidden shrink-0 bg-muted/30 border border-border/30">
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-muted-foreground/20" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-display font-bold text-foreground truncate max-w-[220px]">{course.title}</p>
            {course.description && <p className="text-[11px] text-muted-foreground/60 truncate max-w-[220px]">{course.description}</p>}
          </div>
        </div>
      </td>
      <td className="p-4">
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
          course.is_published
            ? "bg-success/10 text-success"
            : "bg-muted text-muted-foreground"
        )}>
          {course.is_published ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {course.is_published ? "Publicado" : "Rascunho"}
        </span>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> {stats.modules}</span>
          <span className="flex items-center gap-1"><Video className="h-3 w-3" /> {stats.lessons}</span>
        </div>
      </td>
      <td className="p-4">
        {product ? (
          <span className="text-[11px] font-medium text-primary truncate max-w-[140px] block">{product.name}</span>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="p-4">
        <span className="text-[13px] font-numbers font-bold text-foreground tabular-nums">{fmt(revenue)}</span>
      </td>
      <td className="p-4">
        <span className="text-[11px] text-muted-foreground">{new Date(course.created_at).toLocaleDateString("pt-BR")}</span>
      </td>
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <button className="h-8 w-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onClick={e => { e.stopPropagation(); onNavigate(); }} className="gap-2 text-[12px] cursor-pointer">
              <FolderOpen className="h-3.5 w-3.5" /> Gerenciar Conteúdo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(); }} className="gap-2 text-[12px] cursor-pointer">
              <Settings className="h-3.5 w-3.5" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={e => { e.stopPropagation(); onTogglePublish(); }} className="gap-2 text-[12px] cursor-pointer">
              {course.is_published ? <><EyeOff className="h-3.5 w-3.5" /> Despublicar</> : <><Eye className="h-3.5 w-3.5" /> Publicar</>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={e => { e.stopPropagation(); onCopyLink(); }} className="gap-2 text-[12px] cursor-pointer">
              <Copy className="h-3.5 w-3.5" /> Copiar Link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={e => { e.stopPropagation(); onDelete(); }} className="gap-2 text-[12px] cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
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

  const courses = useMemo(() => coursesRaw.map((c: any) => { const { modules: _, ...rest } = c; return rest; }) as Course[], [coursesRaw]);
  const products = useMemo(() => productsRaw.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price) })) as Product[], [productsRaw]);

  const courseStats = useMemo(() => {
    const stats: Record<string, { modules: number; lessons: number }> = {};
    coursesRaw.forEach((c: any) => {
      const mods = c.modules || [];
      stats[c.id] = { modules: mods.length, lessons: mods.reduce((a: number, m: any) => a + (m.lessons?.length || 0), 0) };
    });
    return stats;
  }, [coursesRaw]);

  // Revenue per product (linked to course)
  const revenueByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.status === "completed" && t.product_id).forEach(t => {
      map[t.product_id!] = (map[t.product_id!] || 0) + Number(t.net_amount);
    });
    return map;
  }, [transactions]);

  const getCourseRevenue = (c: Course) => c.product_id ? (revenueByProduct[c.product_id] || 0) : 0;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
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

  const duplicateCourse = async (c: Course) => {
    if (!user) return;
    const { data } = await supabase.from("courses").insert({
      title: `${c.title} (cópia)`,
      description: c.description,
      category: c.category,
      thumbnail_url: c.thumbnail_url,
      product_id: null,
      user_id: user.id,
      is_published: false,
    }).select().single();
    if (data) {
      toast.success("Curso duplicado!");
      reloadCourses();
    }
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

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<BookOpen className="h-6 w-6" />} title="Conteúdo" subtitle="Gerencie cursos, módulos e aulas da sua área de membros" />
        <Button onClick={openNew} className="gap-2 rounded-xl text-sm font-bold h-10 px-5 shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" /> Novo Curso
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <ContentKpi icon={<GraduationCap className="h-4 w-4 text-primary" />} label="Total Cursos" value={String(totalCourses)} accentBg="bg-primary/10" accentText="text-primary" />
        <ContentKpi icon={<Globe className="h-4 w-4 text-success" />} label="Publicados" value={String(publishedCourses)} accentBg="bg-success/10" accentText="text-success" />
        <ContentKpi icon={<Layers className="h-4 w-4 text-info" />} label="Módulos" value={String(totalModules)} accentBg="bg-info/10" accentText="text-info" />
        <ContentKpi icon={<Video className="h-4 w-4 text-warning" />} label="Aulas" value={String(totalLessons)} accentBg="bg-warning/10" accentText="text-warning" />
        <ContentKpi icon={<DollarSign className="h-4 w-4 text-primary" />} label="Receita Cursos" value={fmt(totalRevenue)} accentBg="bg-primary/10" accentText="text-primary" />
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder="Buscar cursos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl bg-card/80"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-card/60 backdrop-blur-sm border border-border/40 w-fit">
            {([
              { id: "all" as const, label: "Todos", count: totalCourses },
              { id: "published" as const, label: "Publicados", count: publishedCourses },
              { id: "draft" as const, label: "Rascunhos", count: totalCourses - publishedCourses },
            ]).map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                  filter === f.id ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
                {f.count > 0 && <span className="h-4 min-w-[16px] px-1 rounded-full bg-muted text-[9px] font-bold flex items-center justify-center">{f.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-card/60 backdrop-blur-sm border border-border/40">
          <button onClick={() => setViewMode("grid")} className={cn("h-8 w-8 rounded-md flex items-center justify-center transition-all", viewMode === "grid" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <BarChart3 className="h-3.5 w-3.5 rotate-90" />
          </button>
          <button onClick={() => setViewMode("list")} className={cn("h-8 w-8 rounded-md flex items-center justify-center transition-all", viewMode === "list" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <PlayCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="p-16 text-center">
          <div className="h-7 w-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground">Carregando cursos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-7 w-7" />}
          title={search || filter !== "all" ? "Nenhum curso encontrado" : "Nenhum curso criado"}
          subtitle={search || filter !== "all" ? "Tente alterar os filtros de busca" : "Crie seu primeiro curso para entregar conteúdo aos seus alunos"}
          action={!search && filter === "all" ? <Button onClick={openNew} size="sm" className="gap-2 rounded-xl shadow-lg shadow-primary/20"><Plus className="h-3.5 w-3.5" /> Criar Curso</Button> : undefined}
        />
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(c => {
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
                onEdit={() => openEdit(c)}
                onNavigate={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                onTogglePublish={() => togglePublish(c.id, c.is_published ?? false)}
                onDelete={() => deleteCourse(c.id)}
                onCopyLink={() => { navigator.clipboard.writeText(getMemberLink(c.id)); toast.success("Link copiado!"); }}
                getMemberLink={getMemberLink(c.id)}
              />
            );
          })}
        </div>
      ) : (
        /* List View */
        <SectionCard accentColor="primary">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/5">
                  {["Curso", "Status", "Conteúdo", "Produto", "Receita", "Criado", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.14em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const stats = courseStats[c.id] || { modules: 0, lessons: 0 };
                  const product = products.find(p => p.id === c.product_id);
                  const revenue = getCourseRevenue(c);
                  return (
                    <CourseRow
                      key={c.id}
                      course={c}
                      stats={stats}
                      product={product}
                      revenue={revenue}
                      onEdit={() => openEdit(c)}
                      onNavigate={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                      onTogglePublish={() => togglePublish(c.id, c.is_published ?? false)}
                      onDelete={() => deleteCourse(c.id)}
                      onCopyLink={() => { navigator.clipboard.writeText(getMemberLink(c.id)); toast.success("Link copiado!"); }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Results count */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-[12px] text-muted-foreground/60">{filtered.length} curso{filtered.length > 1 ? "s" : ""} encontrado{filtered.length > 1 ? "s" : ""}</p>
          {totalRevenue > 0 && <p className="text-[12px] font-numbers text-primary font-bold">{fmt(totalRevenue)} de receita total</p>}
        </div>
      )}

      {/* ═══ Course Create/Edit Sheet ═══ */}
      <Sheet open={sheetOpen} onOpenChange={v => { setSheetOpen(v); if (!v) setEditCourseId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card/95 backdrop-blur-xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-3 text-lg font-display font-black tracking-tight">
              <div className="h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                {editCourseId ? <Edit className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}
              </div>
              {editCourseId ? "Editar Curso" : "Novo Curso"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={e => { e.preventDefault(); saveCourse(); }} className="space-y-5">
            {/* Title field with accent card */}
            <div className="relative rounded-xl bg-muted/10 border border-border/40 p-4 overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary" />
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Nome do Curso *</Label>
              <Input value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Marketing Digital Avançado" className="mt-1.5 h-11 rounded-xl bg-card/80 border-border/40" required />
            </div>

            <div className="relative rounded-xl bg-muted/10 border border-border/40 p-4 overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-info" />
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Descrição</Label>
              <Textarea value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} placeholder="O que os alunos vão aprender..." className="mt-1.5 rounded-xl bg-card/80 border-border/40" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="relative rounded-xl bg-muted/10 border border-border/40 p-4 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-warning" />
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Categoria</Label>
                <Input value={courseForm.category} onChange={e => setCourseForm(p => ({ ...p, category: e.target.value }))} placeholder="Ex: Marketing" className="mt-1.5 h-11 rounded-xl bg-card/80 border-border/40" />
              </div>
              <div className="relative rounded-xl bg-muted/10 border border-border/40 p-4 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-success" />
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">Produto Vinculado</Label>
                <Select value={courseForm.product_id} onValueChange={v => setCourseForm(p => ({ ...p, product_id: v }))}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-11 bg-card/80 border-border/40"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ImageUploadZone value={courseForm.thumbnail_url} onChange={url => setCourseForm(p => ({ ...p, thumbnail_url: url }))} label="Thumbnail do Curso" height="h-36" />

            <Button type="submit" className="w-full h-11 rounded-xl font-bold text-sm gap-2 shadow-lg shadow-primary/20">
              <Check className="h-4 w-4" />
              {editCourseId ? "Salvar Alterações" : "Criar Curso"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
