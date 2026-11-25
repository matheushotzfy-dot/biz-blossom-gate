import { useState } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { FieldHint, FieldLabel } from "@/components/seller-ui/form";
import { friendlyError } from "@/lib/friendlyError";
import { cn } from "@/lib/utils";
import { uploadRaceImage, useAssetUrl } from "./raceApi";
import { IMAGE_TYPES, imageProblem } from "./raceModel";

/** Quadrado de prévia: imagem assinada do bucket ou, sem imagem (ou se falhar), o ícone. */
export function AssetThumb({ url, alt, className, icon }: { url: string | null; alt: string; className?: string; icon?: React.ReactNode }) {
  const src = useAssetUrl(url);
  const [broken, setBroken] = useState<string | null>(null);
  const show = src && broken !== src;
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-muted/50", className)}>
      {show
        ? <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(src)} className="h-full w-full object-cover" />
        : (icon ?? <ImageIcon className="h-[40%] w-[40%] text-muted-foreground" aria-hidden />)}
    </div>
  );
}

/**
 * Envia uma imagem para a corrida e devolve o endereço por `onChange`. Só vale depois de salvar o formulário.
 * `raceId` nulo (corrida ainda por criar) desliga o envio.
 */
export function AssetField({ id, label, raceId, kind, value, onChange, hint }: {
  id: string; label: string; raceId: string | null; kind: string; value: string; onChange: (url: string) => void; hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file || !raceId) return;
    setError(null);
    const problem = imageProblem(file);
    if (problem) { setError(problem); return; }
    setBusy(true);
    try { onChange(await uploadRaceImage(raceId, kind, file)); }
    catch (e) { setError(friendlyError(e, "Não foi possível enviar a imagem.")); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <AssetThumb url={value || null} alt={`Prévia: ${label}`} className="h-16 w-24 rounded-[14px]" />
        <div className="flex flex-wrap items-center gap-2">
          <label className={cn("vp-ghost !h-10 cursor-pointer gap-1.5 !px-3.5 !text-[13.5px] focus-within:ring-2 focus-within:ring-primary", (!raceId || busy) && "pointer-events-none opacity-50")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
            {busy ? "Enviando…" : value ? "Trocar imagem" : "Enviar imagem"}
            <input id={id} type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" disabled={!raceId || busy} aria-label={`Enviar imagem: ${label}`}
              onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {value && !busy && <button type="button" className="vp-ghost !h-10 !px-3.5 !text-[13.5px]" onClick={() => onChange("")}>Remover</button>}
        </div>
      </div>
      {error ? <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-destructive">{error}</p>
        : <FieldHint>{raceId ? (hint ?? "PNG, JPG, WebP ou GIF, até 5 MB.") : "Crie a corrida primeiro; depois dá para enviar a imagem."}</FieldHint>}
    </div>
  );
}
