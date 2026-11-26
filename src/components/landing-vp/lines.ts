import type { CSSProperties } from "react";

/** Linhas finas da landing. Vão em --lp-shadow (ver landing.css): box-shadow direto é zerado por uma regra global antiga. */
export const RULE_BELOW = "0 1px 0 hsl(var(--border))";
export const RULE_ABOVE = "0 -1px 0 hsl(var(--border))";
export const RULE_BOTH = `${RULE_BELOW}, ${RULE_ABOVE}`;

/** `style` para um elemento com a classe `lp-line`. */
export const line = (shadow: string): CSSProperties => ({ "--lp-shadow": shadow } as CSSProperties);
