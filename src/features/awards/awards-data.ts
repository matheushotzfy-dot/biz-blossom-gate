import { Award, Crown, Flame, Gem, Sparkles, Star, Trophy, type LucideIcon } from "lucide-react";
import braceletCard from "@/assets/awards/venx-bracelet-10k.png";
import plaque100k from "@/assets/awards/venx-plaque-100k.png";
import plaque250k from "@/assets/awards/venx-plaque-250k.png";
import plaque500k from "@/assets/awards/venx-plaque-500k.png";
import plaque1m from "@/assets/awards/venx-plaque-1m.png";
import plaque5m from "@/assets/awards/venx-plaque-5m.png";
import plaque10m from "@/assets/awards/venx-plaque-10m.png";

export interface AwardItem {
  id: string;
  value: number;
  label: string;
  tier: string;
  roman: string;
  title: string;
  description: string;
  image: string;
  rewards: string[];
  phrase: string;
  reference: string;
  icon: LucideIcon;
}

export const AWARDS: AwardItem[] = [
  { id: "10k", roman: "I", value: 10_000, label: "R$ 10K", tier: "Iniciante", title: "Kit Pulseiras Vemprapay", description: "Duas pulseiras em preto e esmeralda com fecho metálico gravado, entregues em estojo lacrado.", image: braceletCard, rewards: ["Pulseira preta", "Pulseira esmeralda"], phrase: "Toda jornada bilionária começa com a primeira venda.", reference: "VNX-001", icon: Flame },
  { id: "100k", roman: "II", value: 100_000, label: "R$ 100K", tier: "Bronze", title: "Placa 100 MIL", description: "Madeira escura, fundo esmeralda profundo e monograma Vemprapay em destaque.", image: plaque100k, rewards: ["Placa 100 MIL emoldurada"], phrase: "O primeiro marco prova que o sistema funciona.", reference: "VNX-100", icon: Award },
  { id: "250k", roman: "III", value: 250_000, label: "R$ 250K", tier: "Prata", title: "Placa 250 MIL", description: "Obsidiana técnica com iluminação esmeralda e monograma retroiluminado.", image: plaque250k, rewards: ["Placa 250 MIL iluminada"], phrase: "Constância pesa mais que sorte.", reference: "VNX-250", icon: Star },
  { id: "500k", roman: "IV", value: 500_000, label: "R$ 500K", tier: "Elite", title: "Placa 500 MIL", description: "Obsidiana com halo esmeralda para operações que dominaram seu mercado.", image: plaque500k, rewards: ["Placa 500 MIL", "Acesso ao grupo VIP"], phrase: "Meio milhão não acontece por acaso.", reference: "VNX-500", icon: Crown },
  { id: "1m", roman: "V", value: 1_000_000, label: "R$ 1M", tier: "Milionário", title: "Placa 1 MILHÃO", description: "Metal escovado esmeralda com monograma em baixo-relevo e série individual.", image: plaque1m, rewards: ["Placa 1 MILHÃO", "Vemprapay Inner Circle"], phrase: "O primeiro milhão muda o jogo.", reference: "VNX-1MM", icon: Gem },
  { id: "5m", roman: "VI", value: 5_000_000, label: "R$ 5M", tier: "Platina", title: "Placa 5 MILHÕES", description: "Platina polida e moldura esmeralda, reservada à elite da operação.", image: plaque5m, rewards: ["Placa em platina", "Encontro privado"], phrase: "Elite não é título. É hábito.", reference: "VNX-5MM", icon: Sparkles },
  { id: "10m", roman: "VII", value: 10_000_000, label: "R$ 10M", tier: "Lenda", title: "Placa 10 MILHÕES", description: "Peça numerada em ouro 24K, assinada e registrada no Hall of Fame Vemprapay.", image: plaque10m, rewards: ["Placa em ouro 24K", "Hall of Fame", "Premiação exclusiva"], phrase: "Lendas não morrem. Faturam.", reference: "VNX-10M", icon: Trophy },
];

export const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
}).format(value);