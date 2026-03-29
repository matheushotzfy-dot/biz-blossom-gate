import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts as useProductsQuery, useCourses as useCoursesQuery, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Plus, BookOpen, Layers, PlayCircle, Trash2, Edit, Eye, EyeOff,
  Link as LinkIcon, Search, Copy, MoreVertical,
  Globe, Lock, FolderOpen, Image as ImageIcon, X, FileText, Check,
  Users, TrendingUp, Zap, Star, BarChart3, Clock, ArrowUpRight,
  Sparkles, GraduationCap, Video, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PageShell, PageTitle, EmptyState } from "@/components/PageShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────
interface Course {
  id: string; title: string; description: string | null; category: string | null;
  thumbnail_url: string | null; product_id: string | null; is_published: boolean;
  sort_order: number | null; user_id: string; created_at: string;
}
interface Product { id: string; name: string; }

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
      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">{label}</Label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className={cn("relative rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer overflow-hidden group/img", height, value ? "p-0" : "flex flex-col items-center justify-center")}
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
            <ImageIcon className="h-6 w-6 text-muted-foreground/40 mb-1.5" />
            <p className="text-[11px] text-muted-foreground">{uploading ? "Enviando..." : "Clique ou arraste"}</p>
            <p className="text-[10px] text-muted-foreground/60">PNG, JPG até 5MB</p>
          </>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ─── Course Card ──────────────────────────────────────────────────
function CourseCard({ course, stats, product, index, onEdit, onNavigate, onTogglePublish, onDelete, onCopyLink, getMemberLink }: {
  course: Course; stats: { modules: number; lessons: number }; product?: Product;
  index: number; onEdit: () => void; onNavigate: () => void;
  onTogglePublish: () => void; onDelete: () => void; onCopyLink: () => void;
  getMemberLink: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.3) }}
      className="group relative rounded-2xl bg-card/60 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] overflow-hidden flex flex-col hover:border-primary/25 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500"
    >
      {/* Thumbnail with overlay */}
      <div className="relative h-44 overflow-hidden cursor-pointer" onClick={onNavigate}>
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/8 via-primary/4 to-transparent">
            <div className="relative">
              <BookOpen className="h-16 w-16 text-primary/15" />
              <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-primary/30 animate-pulse" />
            </div>
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent opacity-60" />
        
        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold backdrop-blur-xl shadow-lg",
            course.is_published
              ? "bg-success/20 text-success border border-success/20"
              : "bg-card/80 text-muted-foreground border border-border/40"
          )}>
            {course.is_published ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {course.is_published ? "Publicado" : "Rascunho"}
          </span>
        </div>

        {/* Category badge */}
        {course.category && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest bg-card/70 backdrop-blur-xl text-muted-foreground border border-border/30">
              {course.category}
            </span>
          </div>
        )}

        {/* Hover play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="h-14 w-14 rounded-2xl bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-2xl shadow-primary/30 group-hover:scale-110 transition-transform duration-300">
            <FolderOpen className="h-6 w-6 text-primary-foreground" />
          </div>
        </div>

        {/* Stats overlay at bottom */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-card/80 backdrop-blur-xl border border-border/20 px-2.5 py-1.5 text-[11px] font-bold text-foreground shadow-sm">
            <Layers className="h-3 w-3 text-primary" /> {stats.modules}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-card/80 backdrop-blur-xl border border-border/20 px-2.5 py-1.5 text-[11px] font-bold text-foreground shadow-sm">
            <Video className="h-3 w-3 text-info" /> {stats.lessons}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-1 flex-col">
        <h3 className="text-[15px] font-bold text-foreground leading-snug line-clamp-1 mb-1 group-hover:text-primary transition-colors duration-300">{course.title}</h3>
        {course.description ? (
          <p className="text-[12px] text-muted-foreground/70 line-clamp-2 mb-4 leading-relaxed">{course.description}</p>
        ) : (
          <p className="text-[12px] text-muted-foreground/30 italic mb-4">Adicione uma descrição...</p>
        )}

        {/* Product link */}
        {product && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <LinkIcon className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[11px] font-semibold text-primary truncate">{product.name}</span>
            <ArrowUpRight className="h-3 w-3 text-primary/50 ml-auto shrink-0" />
          </div>
        )}

        {/* Date */}
        <div className="flex items-center gap-1.5 mb-4">
          <Clock className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground/50">
            Criado em {new Date(course.created_at).toLocaleDateString("pt-BR")}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-xl text-[11px] h-9 font-semibold text-primary hover:text-primary hover:bg-primary/10 flex-1 justify-center"
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
                  <Eye className="h-3.5 w-3.5" /> Visualizar
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
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
export default function AdminConteudo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: coursesRaw = [] } = useCoursesQuery();
  const { data: productsRaw = [] } = useProductsQuery();
  const invalidateAll = useInvalidateAll();

  const courses = useMemo(() => coursesRaw.map((c: any) => { const { modules: _, ...rest } = c; return rest; }) as Course[], [coursesRaw]);
  const products = useMemo(() => productsRaw.map(p => ({ id: p.id, name: p.name })) as Product[], [productsRaw]);

  const courseStats = useMemo(() => {
    const stats: Record<string, { modules: number; lessons: number }> = {};
    coursesRaw.forEach((c: any) => {
      const mods = c.modules || [];
      stats[c.id] = { modules: mods.length, lessons: mods.reduce((a: number, m: any) => a + (m.lessons?.length || 0), 0) };
    });
    return stats;
  }, [coursesRaw]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
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

  const filtered = courses.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "published" ? c.is_published : !c.is_published);
    return matchSearch && matchFilter;
  });

  const getMemberLink = (courseId: string) => `${window.location.origin}/membros-area/curso/${courseId}`;

  const totalCourses = courses.length;
  const publishedCourses = courses.filter(c => c.is_published).length;
  const totalModules = Object.values(courseStats).reduce((a, s) => a + s.modules, 0);
  const totalLessons = Object.values(courseStats).reduce((a, s) => a + s.lessons, 0);

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<BookOpen className="h-6 w-6" />} title="Conteúdo" subtitle="Gerencie cursos, módulos e aulas da sua área de membros" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <Button onClick={openNew} className="gap-2 rounded-xl text-sm font-semibold h-10 px-5 shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Novo Curso
          </Button>
        </motion.div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Cursos", value: String(totalCourses), icon: GraduationCap, bg: "bg-primary/10", color: "text-primary", sub: "criados" },
          { label: "Publicados", value: String(publishedCourses), icon: Globe, bg: "bg-success/10", color: "text-success", sub: `de ${totalCourses}` },
          { label: "Módulos", value: String(totalModules), icon: Layers, bg: "bg-info/10", color: "text-info", sub: "organizados" },
          { label: "Aulas", value: String(totalLessons), icon: Video, bg: "bg-warning/10", color: "text-warning", sub: "gravadas" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="group relative rounded-2xl bg-card/60 dark:bg-foreground/[0.02] backdrop-blur-xl border border-border/40 dark:border-foreground/[0.05] p-5 overflow-hidden hover:border-primary/20 transition-all duration-300"
          >
            <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle, hsl(var(--primary) / 0.08), transparent)` }} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.14em]">{kpi.label}</span>
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", kpi.bg)}>
                <kpi.icon className={cn("h-4 w-4", kpi.color)} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-display font-black text-foreground tracking-tight">{kpi.value}</p>
            <p className="text-[11px] text-muted-foreground/50 mt-1">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar cursos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/40 w-fit">
          {([
            { id: "all" as const, label: "Todos", count: totalCourses },
            { id: "published" as const, label: "Publicados", count: publishedCourses },
            { id: "draft" as const, label: "Rascunhos", count: totalCourses - publishedCourses },
          ]).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                filter === f.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
              {f.count > 0 && <span className="h-4 min-w-[16px] px-1 rounded-full bg-muted text-[9px] font-bold flex items-center justify-center">{f.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Course Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-7 w-7" />}
          title={search || filter !== "all" ? "Nenhum curso encontrado" : "Nenhum curso criado"}
          subtitle={search || filter !== "all" ? "Tente alterar os filtros de busca" : "Crie seu primeiro curso para entregar conteúdo aos seus alunos"}
          action={!search && filter === "all" ? <Button onClick={openNew} size="sm" className="gap-2 rounded-xl shadow-lg shadow-primary/20"><Plus className="h-3.5 w-3.5" /> Criar Curso</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((c, i) => {
            const stats = courseStats[c.id] || { modules: 0, lessons: 0 };
            const product = products.find(p => p.id === c.product_id);
            return (
              <CourseCard
                key={c.id}
                course={c}
                stats={stats}
                product={product}
                index={i}
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
      )}

      {/* Quick tips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Sparkles, title: "Dica: Thumbnail", desc: "Cursos com thumbnail convertem 3x mais", color: "text-primary", bg: "bg-primary/10" },
          { icon: Award, title: "Dica: Módulos", desc: "Organize em módulos curtos para melhor retenção", color: "text-info", bg: "bg-info/10" },
          { icon: TrendingUp, title: "Dica: Publicação", desc: "Vincule a um produto para vender automaticamente", color: "text-success", bg: "bg-success/10" },
        ].map(tip => (
          <motion.div
            key={tip.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl bg-card/30 dark:bg-foreground/[0.01] border border-border/30 dark:border-foreground/[0.04] p-4 flex items-start gap-3"
          >
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", tip.bg)}>
              <tip.icon className={cn("h-4 w-4", tip.color)} />
            </div>
            <div>
              <p className="text-[12px] font-bold text-foreground">{tip.title}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">{tip.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══ Course Create/Edit Sheet ═══ */}
      <Sheet open={sheetOpen} onOpenChange={v => { setSheetOpen(v); if (!v) setEditCourseId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-3 text-lg">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                {editCourseId ? <Edit className="h-4.5 w-4.5 text-primary" /> : <Plus className="h-4.5 w-4.5 text-primary" />}
              </div>
              {editCourseId ? "Editar Curso" : "Novo Curso"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={e => { e.preventDefault(); saveCourse(); }} className="space-y-5">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do Curso *</Label>
              <Input value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Marketing Digital Avançado" className="mt-1.5 h-11 rounded-xl" required />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</Label>
              <Textarea value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} placeholder="O que os alunos vão aprender..." className="mt-1.5 rounded-xl" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoria</Label>
                <Input value={courseForm.category} onChange={e => setCourseForm(p => ({ ...p, category: e.target.value }))} placeholder="Ex: Marketing" className="mt-1.5 h-11 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produto Vinculado</Label>
                <Select value={courseForm.product_id} onValueChange={v => setCourseForm(p => ({ ...p, product_id: v }))}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ImageUploadZone value={courseForm.thumbnail_url} onChange={url => setCourseForm(p => ({ ...p, thumbnail_url: url }))} label="Thumbnail do Curso" height="h-36" />

            <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-sm gap-2 shadow-lg shadow-primary/20">
              <Check className="h-4 w-4" />
              {editCourseId ? "Salvar Alterações" : "Criar Curso"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
