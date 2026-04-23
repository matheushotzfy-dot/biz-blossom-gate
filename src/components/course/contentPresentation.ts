export type ContentFilterId = "all" | "published" | "draft";

export interface ContentCourse {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  product_id: string | null;
  is_published: boolean;
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