import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pílula de escolha das Configurações. Não usa `ChoiceChip`: ele leva a classe `border`, e no painel do admin a regra
 * `.admin-shell button.border` pinta o fundo de branco com `!important`, apagando o destaque da opção ativa.
 * O estado ativo vem de `.vp-pill[aria-pressed="true"]`; o contorno das inativas vai em `box-shadow`.
 */
export function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn("vp-pill !h-10 justify-center px-4 text-[14px] font-semibold", !active && "shadow-[inset_0_0_0_1px_hsl(var(--border))]", className)}>
      {children}
    </button>
  );
}
