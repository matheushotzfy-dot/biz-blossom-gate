import { Building2, Camera, CreditCard, IdCard, type LucideIcon } from "lucide-react";

export type KycDocType = "front" | "back" | "selfie" | "cnpj_card";

export interface KycStep {
  type: KycDocType;
  label: string;
  short: string;
  desc: string;
  tip: string;
  icon: LucideIcon;
}

export const BASE_STEPS: readonly KycStep[] = [
  { type: "front", label: "Documento — frente", short: "Frente", desc: "Frente do RG ou CNH, inteira e legível.", tip: "Use uma superfície lisa e boa iluminação, sem reflexos.", icon: IdCard },
  { type: "back", label: "Documento — verso", short: "Verso", desc: "Verso do mesmo documento.", tip: "Confira se todos os números estão nítidos.", icon: CreditCard },
  { type: "selfie", label: "Selfie com documento", short: "Selfie", desc: "Seu rosto e o documento ao lado, ambos visíveis.", tip: "Sem óculos escuros, boné ou filtros.", icon: Camera },
];

export const CNPJ_STEP: KycStep = {
  type: "cnpj_card", label: "Cartão CNPJ", short: "CNPJ", desc: "Comprovante de inscrição e situação cadastral.", tip: "Gere o cartão atualizado no site da Receita Federal.", icon: Building2,
};

export const ALLOWED_KYC_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_KYC_BYTES = 10 * 1024 * 1024;

/** Valida o arquivo antes do envio; retorna mensagem de erro ou null. */
export function validateKycFile(file: Pick<File, "type" | "size">): string | null {
  if (!(ALLOWED_KYC_TYPES as readonly string[]).includes(file.type)) return "Formato não aceito. Envie JPG, PNG ou WebP.";
  if (file.size > MAX_KYC_BYTES) return "Arquivo maior que 10 MB. Reduza a foto e tente de novo.";
  if (file.size < 10 * 1024) return "Imagem muito pequena. Envie uma foto mais nítida.";
  return null;
}
