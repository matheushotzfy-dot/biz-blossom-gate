import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

/** Miniatura de produto: a capa, ou um ícone neutro quando o produto não tem imagem. */
export function Thumb({ src, className }: { src?: string | null; className?: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={cn("h-11 w-11 shrink-0 rounded-[12px] object-cover", className)} />
  ) : (
    <span aria-hidden className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-muted text-muted-foreground", className)}><Package className="h-5 w-5" strokeWidth={1.8} /></span>
  );
}

/** Selo redondo com o código do afiliado (ele não aparece com nome nem foto). */
export function CodeBadge({ code, active }: { code: string; active?: boolean }) {
  return (
    <span aria-hidden className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full text-[12.5px] font-extrabold tracking-[0.02em]", active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{code.slice(0, 3)}</span>
  );
}
