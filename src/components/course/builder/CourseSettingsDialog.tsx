import { useEffect, useRef, useState } from "react";
import { GraduationCap, ImagePlus, Loader2, Settings, Trash2 } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DialogHead, FieldHint, FieldLabel, dialogShell } from "@/components/seller-ui/form";
import { cn } from "@/lib/utils";
import type { BuilderCourse } from "@/components/course/builder/types";

const MAX_TITLE = 80;
const MAX_DESCRIPTION = 280;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: BuilderCourse;
  uploadingCover: boolean;
  onCoverFile: (file: File) => void;
  onRemoveCover: () => void;
  onSave: (values: { title: string; description: string }) => Promise<boolean>;
}

export function CourseSettingsDialog({ open, onOpenChange, course, uploadingCover, onCoverFile, onRemoveCover, onSave }: Props) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Cada vez que o diálogo abre, parte dos valores salvos (descarta o que ficou pela metade).
  useEffect(() => {
    if (open) {
      setTitle(course.title);
      setDescription(course.description ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const titleValid = title.trim().length >= 3;
  const changed = title.trim() !== course.title || description.trim() !== (course.description ?? "").trim();

  const submit = async () => {
    if (!titleValid || saving) return;
    if (!changed) { onOpenChange(false); return; }
    setSaving(true);
    const ok = await onSave({ title: title.trim(), description: description.trim() });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className={cn(dialogShell, "flex max-h-[94dvh] w-[calc(100vw-1rem)] max-w-[560px] flex-col")}>
        <DialogHead icon={<Settings className="h-5 w-5" strokeWidth={2.2} />} title="Configurações da área" subtitle="Nome, descrição e capa que o aluno vê." />

        <form className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-8" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div>
            <FieldLabel>Capa</FieldLabel>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onCoverFile(f); e.target.value = ""; }}
            />
            <div className="vp-r16 relative aspect-[16/9] w-full max-w-[440px] overflow-hidden border border-border bg-accent">
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt="Capa da área de membros" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center"><GraduationCap className="h-10 w-10 text-primary/30" /></span>
              )}
              {uploadingCover && (
                <span role="status" className="absolute inset-0 grid place-items-center bg-background/80">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Enviando…</span>
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => fileInput.current?.click()} disabled={uploadingCover} className="vp-ghost h-10 px-4 text-[13.5px]">
                <ImagePlus className="h-4 w-4" strokeWidth={2.2} />
                {course.thumbnail_url ? "Trocar capa" : "Enviar capa"}
              </button>
              {course.thumbnail_url && (
                <button type="button" onClick={onRemoveCover} disabled={uploadingCover} className="vp-ghost h-10 px-4 text-[13.5px] !text-destructive">
                  <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                  Remover capa
                </button>
              )}
            </div>
            <FieldHint>JPG, PNG ou WebP, até 5 MB. Proporção 16:9 fica melhor.</FieldHint>
          </div>

          <div>
            <FieldLabel htmlFor="course-title">Nome da área</FieldLabel>
            <Input
              id="course-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
              aria-invalid={!titleValid}
              autoComplete="off"
              className="vp-field"
            />
            {!titleValid && <FieldHint className="!text-destructive">Use pelo menos 3 letras.</FieldHint>}
          </div>

          <div>
            <FieldLabel htmlFor="course-description">Descrição</FieldLabel>
            <Textarea
              id="course-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
              rows={4}
              placeholder="Em uma ou duas frases, diga o que o aluno vai aprender."
              className="vp-field resize-none leading-relaxed"
            />
            <FieldHint>{description.length}/{MAX_DESCRIPTION}</FieldHint>
          </div>

          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
          <button type="button" onClick={() => onOpenChange(false)} disabled={saving} className="vp-ghost h-11 px-6">Cancelar</button>
          <button type="button" onClick={() => void submit()} disabled={!titleValid || saving || uploadingCover} className="vp-cta h-11 px-6">
            {saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
