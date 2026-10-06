/** Dados fixos e ilustrativos para as notificações de venda simuladas. */
export interface FakeSale {
  id: string;
  product: string;
  method: "PIX" | "Cartão";
  amount: number;
  buyer: string;
}

export const FAKE_SALES: readonly FakeSale[] = [
  { id: "s1", product: "Mentoria Escala 10x", method: "PIX", amount: 497, buyer: "Mariana S." },
  { id: "s2", product: "Curso Tráfego Pro", method: "Cartão", amount: 297, buyer: "Rafael M." },
  { id: "s3", product: "Comunidade Elite", method: "PIX", amount: 97, buyer: "Juliana P." },
  { id: "s4", product: "Ebook Funil Perfeito", method: "PIX", amount: 47, buyer: "Lucas A." },
  { id: "s5", product: "Imersão Presencial", method: "Cartão", amount: 1997, buyer: "Camila R." },
  { id: "s6", product: "Plano Anual Premium", method: "Cartão", amount: 697, buyer: "Bruno T." },
  { id: "s7", product: "Workshop Copy", method: "PIX", amount: 197, buyer: "Fernanda L." },
  { id: "s8", product: "Kit Templates", method: "PIX", amount: 67, buyer: "Diego C." },
];
