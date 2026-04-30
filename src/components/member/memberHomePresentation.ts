import type { Tables } from "@/integrations/supabase/types";

export type ModuleInfo = {
  id: string;
  title: string;
  banner_url: string | null;
  sort_order: number;
  lessonCount: number;
};

export type CourseWithProgress = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  totalLessons: number;
  completedLessons: number;
  lastLesson: string | null;
  lastActivityAt?: number;
  modules: ModuleInfo[];
};

export const getCourseStatus = (course: CourseWithProgress) => {
  if (course.totalLessons === 0) return "not_started" as const;
  if (course.completedLessons === course.totalLessons) return "completed" as const;
  if (course.completedLessons > 0) return "in_progress" as const;
  return "not_started" as const;
};

export const getCourseProgress = (course: CourseWithProgress) => {
  if (course.totalLessons === 0) return 0;
  return Math.round((course.completedLessons / course.totalLessons) * 100);
};

export type MemberCourseRow = Tables<"courses">;