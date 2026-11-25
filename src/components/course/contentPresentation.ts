export type ContentFilterId = "all" | "published" | "draft";

export interface ContentCourse {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  product_id: string | null;
  is_published: boolean;
  /** Preenchidos quando a equipe tirou a área do ar: o seller não consegue republicar sozinho. */
  admin_hold_at?: string | null;
  admin_hold_reason?: string | null;
  sort_order: number | null;
  user_id: string;
  created_at: string;
}

export interface ContentProduct {
  id: string;
  name: string;
  price: number;
}

export interface ContentCourseStats {
  modules: number;
  lessons: number;
}

export interface EditableCoursePayload {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  product_id: string | null;
  thumbnail_url: string | null;
  modules?: {
    id: string;
    title: string;
    banner_url: string | null;
    lessonsCount: number;
  }[];
}

export const formatContentCurrency = (value: number) =>
  value === 0
    ? "R$ 0,00"
    : `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export const getMemberAreaLink = (origin: string, courseId: string) => `${origin}/membros-area/curso/${courseId}`;

export const buildEditableCoursePayload = (
  course: ContentCourse,
  sourceCourse?: { modules?: Array<{ id: string; title: string; banner_url?: string | null; lessons?: Array<{ id: string }> }> },
): EditableCoursePayload => ({
  ...course,
  modules: (sourceCourse?.modules || []).map((module) => ({
    id: module.id,
    title: module.title,
    banner_url: module.banner_url ?? null,
    lessonsCount: module.lessons?.length ?? 0,
  })),
});

export const COURSE_CATEGORIES = [
  { value: "marketing", label: "Marketing digital" },
  { value: "vendas", label: "Vendas" },
  { value: "negocios", label: "Negócios" },
  { value: "financas", label: "Finanças" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "design", label: "Design" },
  { value: "saude", label: "Saúde e bem-estar" },
  { value: "educacao", label: "Educação" },
  { value: "desenvolvimento-pessoal", label: "Desenvolvimento pessoal" },
  { value: "produtividade", label: "Produtividade" },
  { value: "idiomas", label: "Idiomas" },
  { value: "fitness", label: "Fitness" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "programacao", label: "Programação" },
  { value: "geral", label: "Outros" },
] as const;

/** Nome legível da categoria; valores antigos ou livres aparecem como foram salvos. */
export const getCategoryLabel = (value: string | null | undefined) =>
  COURSE_CATEGORIES.find((c) => c.value === value)?.label ?? (value || "");
