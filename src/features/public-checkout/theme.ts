import type { CSSProperties } from "react";
import type { CheckoutThemeMode } from "./types";

export const DEFAULT_ACCENT = "#10b981";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "#abc" → "#aabbcc"; qualquer coisa que não seja cor hex vira null (o valor vem do banco e vai para o CSS). */
export function normalizeHex(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!HEX_RE.test(v)) return null;
  const body = v.slice(1).toLowerCase();
  return `#${body.length === 3 ? body.split("").map((c) => c + c).join("") : body}`;
}

type Rgb = [number, number, number];
const toRgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")).join("")}`;

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Texto que fica legível em cima da cor do botão. */
export function readableOn(background: string): "#ffffff" | "#0b1220" {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#0b1220") ? "#ffffff" : "#0b1220";
}

/** A cor do vendedor usada como TEXTO (preço, links): escurece (ou clareia no tema escuro) até ter contraste mínimo com o fundo. */
export function inkOn(accent: string, surface: string, minimum = 4.5): string {
  if (contrastRatio(accent, surface) >= minimum) return accent;
  const target: Rgb = luminance(surface) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  const base = toRgb(accent);
  for (let step = 1; step <= 20; step += 1) {
    const mixed = toHex(base.map((channel, i) => channel + (target[i] - channel) * (step / 20)) as Rgb);
    if (contrastRatio(mixed, surface) >= minimum) return mixed;
  }
  return toHex(target);
}

export const SURFACES: Record<CheckoutThemeMode, string> = { gray: "#ffffff", white: "#ffffff", dark: "#1a1f2b" };

export function resolveThemeMode(value: string | null | undefined): CheckoutThemeMode {
  return value === "dark" ? "dark" : value === "white" ? "white" : "gray";
}

export function themeVars(mode: CheckoutThemeMode, buttonColor: string | null | undefined): CSSProperties {
  const accent = normalizeHex(buttonColor) ?? DEFAULT_ACCENT;
  return {
    "--ck-accent": accent,
    "--ck-on-accent": readableOn(accent),
    "--ck-ink": inkOn(accent, SURFACES[mode]),
  } as CSSProperties;
}
