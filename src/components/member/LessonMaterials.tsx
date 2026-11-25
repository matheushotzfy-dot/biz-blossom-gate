import { Download, FileText, Paperclip } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SignedFileLink } from "@/components/course/SignedFileLink";
import { formatFileSize } from "@/components/course/builder/videoUtils";

export type LessonAttachment = { id: string; file_name: string; file_url: string; file_size: number | null; file_type: string | null };

export function useLessonAttachments(lessonId: string | null) {
  return useQuery({
    queryKey: ["lesson-attachments", lessonId],
    enabled: !!lessonId,
    staleTime: 60_000,
    queryFn: async (): Promise<LessonAttachment[]> => {
      const { data, error } = await supabase
        .from("lesson_attachments")
        .select("id, file_name, file_url, file_size, file_type")
        .eq("lesson_id", lessonId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

type Props = { attachments: LessonAttachment[]; loading: boolean; failed: boolean; onRetry: () => void };

/** Materiais da aula: cada arquivo baixa por um link assinado e temporário. */
export function LessonMaterials({ attachments, loading, failed, onRetry }: Props) {
  if (loading) {
    return <div className="space-y-3" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-[16px] bg-white/[0.05] motion-reduce:animate-none" />)}</div>;
  }
  if (failed) {
    return (
      <div role="alert" className="rounded-[16px] bg-white/[0.04] px-6 py-10 text-center">
        <p className="text-[15px] font-semibold text-foreground">Não foi possível carregar os materiais.</p>
        <button type="button" onClick={onRetry} className="mt-3 inline-flex h-10 items-center rounded-full bg-white/10 px-5 text-[14px] font-semibold text-foreground hover:bg-white/15">Tentar de novo</button>
      </div>
    );
  }
  if (attachments.length === 0) {
    return (
      <div className="rounded-[16px] bg-white/[0.04] px-6 py-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/[0.06] text-muted-foreground"><Paperclip className="h-5 w-5" /></span>
        <p className="mt-3 text-[15px] font-semibold text-foreground">Esta aula não tem materiais.</p>
        <p className="mt-1 text-[14px] text-muted-foreground">Quando o produtor anexar arquivos, eles aparecem aqui.</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {attachments.map((att) => (
        <li key={att.id}>
          <SignedFileLink
            fileUrl={att.file_url}
            fileName={att.file_name}
            label={`Baixar ${att.file_name}`}
            className="group flex w-full items-center gap-4 rounded-[16px] bg-white/[0.05] p-4 text-left transition-colors hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07] text-muted-foreground"><FileText className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-foreground">{att.file_name}</span>
              {att.file_size ? <span className="block text-[13px] text-muted-foreground">{formatFileSize(att.file_size)}</span> : null}
            </span>
            <Download className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
          </SignedFileLink>
        </li>
      ))}
    </ul>
  );
}
