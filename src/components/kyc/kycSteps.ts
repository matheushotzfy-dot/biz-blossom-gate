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
  { type: "front", label: "Documento (frente)", short: "Frente", desc: "Frente do RG ou CNH, inteira e legível.", tip: "Use uma superfície lisa e boa iluminação, sem reflexos.", icon: IdCard },
  { type: "back", label: "Documento (verso)", short: "Verso", desc: "Verso do mesmo documento.", tip: "Confira se todos os números estão nítidos.", icon: CreditCard },
  { type: "selfie", label: "Selfie com documento", short: "Selfie", desc: "Seu rosto e o documento ao lado, ambos visíveis.", tip: "Sem óculos escuros, boné ou filtros.", icon: Camera },
];

export const CNPJ_STEP: KycStep = {
  type: "cnpj_card", label: "Cartão CNPJ", short: "CNPJ", desc: "Comprovante de inscrição e situação cadastral.", tip: "Gere o cartão atualizado no site da Receita Federal.", icon: Building2,
};
