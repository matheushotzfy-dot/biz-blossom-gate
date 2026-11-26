import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pílula de escolha dos painéis do admin. Não usa `ChoiceChip`: ele leva a classe `border`, e no painel do admin a regra
 * `.admin-shell button.border` pinta o fundo de branco com `!important`, apagando o destaque da opção ativa.
 * O estado ativo vem de `.vp-pill[aria-pressed="true"]`; o contorno das inativas vai em `box-shadow` INLINE: escrito como classe (`shadow-[…var(--border)…]`) o nome da classe tem "border" e a regra legada o anula.
 */
export function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      style={active ? undefined : { boxShadow: "inset 0 0 0 1px hsl(var(--border))" }}
      className={cn("vp-pill justify-center font-semibold", className)}>
      {children}
    </button>
  );
}
