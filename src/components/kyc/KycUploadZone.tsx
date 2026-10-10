import { useEffect, useRef, useState, type DragEvent } from "react";
import { Camera, CheckCircle2, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KycStep } from "./kycSteps";

export interface KycUploadZoneProps {
  step: KycStep;
  done: boolean;
  uploading: boolean;
  onFile: (file: File) => void;
}

/** Área de envio com arrastar/soltar, prévia local e câmera no celular. */
export function KycUploadZone({ step, done, uploading, onFile }: KycUploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Libera a URL de prévia ao trocar de etapa/arquivo.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { setPreview(null); }, [step.type]);

  const pick = (file?: File) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onFile(file);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Enviar ${step.label}`}
        onClick={() => !uploading && fileRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex aspect-[16/10] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          done ? "border-success/50 bg-success/5" : dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/60",
        )}
      >
        {preview && <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />}
        {(uploading || done) && preview && <div className="absolute inset-0 bg-background/60" />}
        <div className="relative flex flex-col items-center px-6">
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          ) : done ? (
            <CheckCircle2 className="h-7 w-7 text-success" />
          ) : (
            <step.icon className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
          )}
          <p className="mt-3 text-sm font-semibold text-foreground">
            {uploading ? "Enviando com segurança…" : done ? "Documento recebido" : "Arraste a foto aqui"}
          </p>
          {!uploading && !done && <p className="mt-1 text-xs text-muted-foreground">ou clique para escolher · JPG, PNG ou WebP até 10 MB</p>}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex-1">
          {done ? <><RefreshCw className="mr-2 h-3.5 w-3.5" /> Trocar foto</> : <><Upload className="mr-2 h-3.5 w-3.5" /> Escolher arquivo</>}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => camRef.current?.click()} className="flex-1 sm:hidden">
          <Camera className="mr-2 h-3.5 w-3.5" /> Usar câmera
        </Button>
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camRef} type="file" accept="image/*" capture={step.type === "selfie" ? "user" : "environment"} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
