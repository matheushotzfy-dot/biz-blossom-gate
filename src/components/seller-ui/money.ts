/** Campo de valor em reais: o usuário digita só números e a máscara vai empurrando os centavos ("1.234,56"). */
export const maskBRL = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Volta o texto mascarado para número (0 quando vazio). */
export const parseBRL = (masked: string): number => {
  const digits = masked.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
};

/** Número → texto mascarado, para preencher o campo ao editar ("297" → "297,00"). */
export const toMaskedBRL = (value: number): string => (Number.isFinite(value) && value > 0 ? maskBRL(String(Math.round(value * 100))) : "");
