import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, Search, BookOpen, Users, Video, Eye } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tables } from "@/integrations/supabase/types";
import { GlassPanel as AdminPanel, GlassPanelTitle as PanelTitle, AdminKpi } from "./AdminOverviewTab";

interface Props {
  profiles: Tables<"profiles">[];
  products: Tables<"products">[];
}

interface CourseWithStats {
  id: string; title: string; description: string | null; is_published: boolean | null;
  user_id: string; product_id: string | null; created_at: string;
  moduleCount: number; lessonCount: number; accessCount: number;
}

export default function AdminCoursesTab({ profiles, products }: Props) {
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    const [coursesRes, modulesRes, lessonsRes, accessRes] = await Promise.all([
      supabase.from("courses").select("*").order("created_at", { ascending: false }),
      supabase.from("modules").select("id, course_id"),
      supabase.from("lessons").select("id, module_id"),
      supabase.from("user_access").select("id, course_id, status").eq("status", "active"),
    ]);

    const modulesData = modulesRes.data || [];
    const lessonsData = lessonsRes.data || [];
    const accessData = accessRes.data || [];

    const mapped: CourseWithStats[] = (coursesRes.data || []).map(c => {
      const courseModules = modulesData.filter(m => m.course_id === c.id);
      const moduleIds = new Set(courseModules.map(m => m.id));
      const courseLessons = lessonsData.filter(l => moduleIds.has(l.module_id));
      const courseAccess = accessData.filter(a => a.course_id === c.id);
      return { ...c, moduleCount: courseModules.length, lessonCount: courseLessons.length, accessCount: courseAccess.length };
    });

    setCourses(mapped);
    setLoading(false);
  };

  const getSellerName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || "—";
  const getProductName = (productId: string | null) => products.find(p => p.id === productId)?.name || "—";

  const published = courses.filter(c => c.is_published);
  const totalLessons = courses.reduce((a, c) => a + c.lessonCount, 0);
  const totalStudents = courses.reduce((a, c) => a + c.accessCount, 0);

  const filtered = courses.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.title.toLowerCase().includes(s) || getSellerName(c.user_id).toLowerCase().includes(s);
  });

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Carregando cursos...</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpi icon={<GraduationCap className="h-5 w-5" />} label="Total Cursos" value={String(courses.length)} sub="Na plataforma" gradient="from-indigo-500 to-indigo-600" glowColor="rgba(99,102,241,0.15)" />
        <AdminKpi icon={<Eye className="h-5 w-5" />} label="Publicados" value={String(published.length)} sub="Visíveis" gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<Video className="h-5 w-5" />} label="Total Aulas" value={String(totalLessons)} sub="Em todos os cursos" gradient="from-blue-500 to-blue-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<Users className="h-5 w-5" />} label="Alunos Ativos" value={String(totalStudents)} sub="Com acesso" gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input placeholder="Buscar curso ou vendedor..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
      </div>

      <AdminPanel>
        <PanelTitle color="blue" icon={<GraduationCap className="h-4 w-4" />}>Cursos ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["Curso", "Vendedor", "Produto", "Módulos", "Aulas", "Alunos", "Status", "Criado"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="p-3"><div><p className="text-xs font-bold text-foreground">{c.title}</p><p className="text-[10px] text-muted-foreground max-w-[200px] truncate">{c.description || "—"}</p></div></td>
                  <td className="p-3 text-xs text-muted-foreground">{getSellerName(c.user_id)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{c.product_id ? getProductName(c.product_id) : "Livre"}</td>
                  <td className="p-3"><span className="text-xs font-bold bg-muted/30 px-2 py-0.5 rounded">{c.moduleCount}</span></td>
                  <td className="p-3"><span className="text-xs font-bold bg-info/10 text-info px-2 py-0.5 rounded">{c.lessonCount}</span></td>
                  <td className="p-3"><span className="text-xs font-bold bg-violet-500/10 text-violet-500 px-2 py-0.5 rounded">{c.accessCount}</span></td>
                  <td className="p-3"><StatusBadge status={c.is_published ? "active" : "draft"} /></td>
                  <td className="p-3 text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground text-xs">Nenhum curso</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </div>
  );
}
