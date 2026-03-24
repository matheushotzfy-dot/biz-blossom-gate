import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts as useProductsQuery, useCourses as useCoursesQuery, useInvalidateAll } from "@/hooks/useQueryData";
import {
  Plus, BookOpen, Layers, PlayCircle, Trash2, Edit, Eye, EyeOff,
  Link as LinkIcon, Search, Copy, MoreVertical,
  Globe, Lock, FolderOpen, Image as ImageIcon, X, FileText, Check
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
import { motion } from "framer-motion";

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

  const filtered = courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));
  const getMemberLink = (courseId: string) => `${window.location.origin}/membros-area/curso/${courseId}`;

  const totalCourses = courses.length;
  const publishedCourses = courses.filter(c => c.is_published).length;
  const totalModules = Object.values(courseStats).reduce((a, s) => a + s.modules, 0);
  const totalLessons = Object.values(courseStats).reduce((a, s) => a + s.lessons, 0);

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageTitle icon={<BookOpen className="h-6 w-6" />} title="Conteúdo" subtitle="Gerencie cursos, módulos e aulas" />
        <Button onClick={openNew} className="gap-2 rounded-xl text-sm font-semibold h-10 px-5">
          <Plus className="h-4 w-4" /> Novo Curso
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Cursos", value: String(totalCourses), icon: BookOpen, bg: "bg-primary/10", color: "text-primary" },
          { label: "Publicados", value: String(publishedCourses), icon: Globe, bg: "bg-emerald-500/10", color: "text-emerald-500" },
          { label: "Módulos", value: String(totalModules), icon: Layers, bg: "bg-blue-500/10", color: "text-blue-500" },
          { label: "Aulas", value: String(totalLessons), icon: PlayCircle, bg: "bg-amber-500/10", color: "text-amber-500" },
        ].map((kpi) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-card border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">{kpi.label}</span>
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", kpi.bg)}>
                <kpi.icon className={cn("h-4 w-4", kpi.color)} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input
          placeholder="Buscar cursos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl"
        />
      </div>

      {/* Course Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-7 w-7" />}
          title="Nenhum curso criado"
          subtitle="Crie seu primeiro curso para entregar conteúdo aos seus alunos"
          action={<Button onClick={openNew} size="sm" className="gap-2 rounded-xl"><Plus className="h-3.5 w-3.5" /> Criar Curso</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const stats = courseStats[c.id] || { modules: 0, lessons: 0 };
            const product = products.find(p => p.id === c.product_id);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                className="group rounded-xl bg-card border border-border overflow-hidden flex flex-col hover:shadow-md hover:border-primary/20 transition-all duration-300"
              >
                {/* Thumbnail */}
                <div
                  className="relative h-40 overflow-hidden bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}
                >
                  {c.thumbnail_url ? (
                    <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                      <BookOpen className="h-12 w-12 text-primary/20" />
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="absolute top-3 right-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md shadow-sm",
                      c.is_published ? "bg-emerald-500/90 text-white" : "bg-card/90 text-muted-foreground border border-border/60"
                    )}>
                      {c.is_published ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {c.is_published ? "Publicado" : "Rascunho"}
                    </span>
                  </div>
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="h-12 w-12 rounded-full bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-1 flex-col">
                  <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-1 mb-1">{c.title}</h3>
                  {c.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{c.description}</p>}

                  {/* Stats */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md font-medium">
                      <Layers className="h-3 w-3" /> {stats.modules} módulos
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md font-medium">
                      <PlayCircle className="h-3 w-3" /> {stats.lessons} aulas
                    </span>
                  </div>

                  {/* Product link */}
                  {product && (
                    <div className="flex items-center gap-1.5 mb-3 text-[11px] text-primary">
                      <LinkIcon className="h-3 w-3" />
                      <span className="truncate font-medium">{product.name}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-border/50">
                    <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-medium text-muted-foreground hover:text-primary flex-1 justify-start" onClick={() => navigate(`/vendas/conteudo/${c.id}/builder`)}>
                      <FolderOpen className="h-3.5 w-3.5" /> Gerenciar
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg text-[11px] h-8 font-medium text-muted-foreground hover:text-foreground" onClick={() => openEdit(c)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[160px]">
                        <DropdownMenuItem onClick={() => togglePublish(c.id, c.is_published ?? false)} className="gap-2 text-[12px] cursor-pointer">
                          {c.is_published ? <><EyeOff className="h-3.5 w-3.5" /> Despublicar</> : <><Eye className="h-3.5 w-3.5" /> Publicar</>}
                        </DropdownMenuItem>
                        {c.is_published && (
                          <DropdownMenuItem onClick={() => window.open(getMemberLink(c.id), "_blank")} className="gap-2 text-[12px] cursor-pointer">
                            <Eye className="h-3.5 w-3.5" /> Visualizar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(getMemberLink(c.id)); toast.success("Link copiado!"); }} className="gap-2 text-[12px] cursor-pointer">
                          <Copy className="h-3.5 w-3.5" /> Copiar Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteCourse(c.id)} className="gap-2 text-[12px] cursor-pointer text-destructive focus:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

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

            <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-sm gap-2">
              <Check className="h-4 w-4" />
              {editCourseId ? "Salvar Alterações" : "Criar Curso"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
