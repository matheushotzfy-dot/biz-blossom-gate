import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { safeNavigationUrl } from "@/lib/safeUrl";
import type { Tone } from "./disputesModel";

export const ToneTag = ({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) => (
  <span className={cn("ax-tag", className)} data-tone={tone}>{children}</span>
);

/** Um dado com rótulo em cima (venda, seller, comprador…). */
export const Info = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <div className={cn("min-w-0", className)}>
    <dt className="text-[12px] font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 break-words text-[14px] font-semibold text-foreground">{children}</dd>
  </div>
);

/** Links de prova que o seller colou na defesa: só http(s) abre; o resto aparece como texto, sem link. */
export function EvidenceLinks({ urls }: { urls: string[] }) {
  if (urls.length === 0) return <p className="text-[13px] text-muted-foreground">O seller não anexou links de prova.</p>;
  return (
    <ul className="space-y-1.5">
      {urls.map((u, i) => {
        const safe = safeNavigationUrl(u);
        if (!safe) return <li key={i} className="break-all text-[13px] text-muted-foreground">Link não aberto por segurança: {u.slice(0, 120)}</li>;
        const host = new URL(safe).host;
        return (
          <li key={i} className="min-w-0">
            <a href={safe} target="_blank" rel="noopener noreferrer" className="break-all text-[13.5px] font-semibold text-primary underline-offset-2 hover:underline">{host}</a>
            <span className="ml-2 break-all text-[12px] text-muted-foreground">{safe.length > 70 ? `${safe.slice(0, 70)}…` : safe}</span>
          </li>
        );
      })}
    </ul>
  );
}
