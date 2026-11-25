export interface BuilderCourse {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  is_published: boolean;
  user_id: string;
  product_id: string | null;
  thumbnail_url: string | null;
}

export interface BuilderLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  is_free: boolean;
  sort_order: number | null;
  drip_days: number | null;
}

export interface BuilderModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  banner_url?: string | null;
  sort_order: number | null;
  lessons: BuilderLesson[];
}

export interface BuilderAttachment {
  id: string;
  lesson_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Campos da aula que o editor salva sozinho. */
export type LessonField = "title" | "description" | "video_url" | "duration_minutes" | "is_free";
