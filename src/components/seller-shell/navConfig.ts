import type { LucideIcon } from "lucide-react";
import {
  Home, Receipt, Wallet, Package, Megaphone, Blocks, Link2, TicketPercent, Users, Repeat,
  ArrowDownToLine, Landmark, Percent, FileText, BadgeDollarSign, KeyRound, Webhook, Puzzle, BookOpenText, LayoutTemplate, PlayCircle,
} from "lucide-react";

export interface SellerNavLink {
  title: string; desc: string; url: string; icon: LucideIcon;
  /** Recurso ainda desativado: aparece no menu como "Em breve" e não abre. */
  soon?: boolean;
}
export interface SellerNavSection {
  id: string;
  label: string;
  url: string;
  icon: LucideIcon;
  /** Prefixos de rota que marcam esta aba como ativa. */
  match: string[];
  links?: SellerNavLink[];
}

/** Fonte única da navegação do seller (desktop e celular). */
export const SELLER_NAV: SellerNavSection[] = [
  { id: "home", label: "Início", url: "/dashboard", icon: Home, match: ["/dashboard"] },
  {
    id: "sales", label: "Vendas", url: "/vendas", icon: Receipt, match: ["/vendas$", "/vendas/link-pagamento", "/vendas/assinaturas"],
    links: [
      { title: "Todas as vendas", desc: "Extrato de pedidos e status", url: "/vendas", icon: Receipt },
      { title: "Link de pagamento", desc: "Cobre por Pix ou cartão", url: "/vendas/link-pagamento", icon: Link2 },
      { title: "Assinaturas", desc: "Planos recorrentes", url: "/vendas/assinaturas", icon: Repeat },
    ],
  },
  {
    id: "money", label: "Financeiro", url: "/financeiro/saques", icon: Wallet, match: ["/financeiro"],
    links: [
      { title: "Saldo e saques", desc: "Transfira para sua conta", url: "/financeiro/saques", icon: ArrowDownToLine },
      { title: "Antecipação", desc: "Receba antes do prazo", url: "/financeiro/antecipacao", icon: BadgeDollarSign, soon: true },
      { title: "Taxas", desc: "Seu plano de tarifas", url: "/financeiro/taxas", icon: Percent },
      { title: "Notas fiscais", desc: "Emissão e histórico", url: "/financeiro/notas", icon: FileText, soon: true },
      { title: "Dados bancários", desc: "Chaves Pix e contas", url: "/financeiro/config", icon: Landmark },
    ],
  },
  {
    id: "products", label: "Produtos", url: "/vendas/produtos", icon: Package, match: ["/vendas/produtos", "/vendas/conteudo", "/vendas/checkout", "/membros"],
    links: [
      { title: "Meus produtos", desc: "Catálogo e aprovação", url: "/vendas/produtos", icon: Package },
      { title: "Checkouts", desc: "Aparência das páginas de pagamento", url: "/vendas/checkout", icon: LayoutTemplate },
      { title: "Área de membros", desc: "Cursos e conteúdo", url: "/vendas/conteudo", icon: PlayCircle },
    ],
  },
  {
    id: "growth", label: "Marketing", url: "/vendas/cupons", icon: Megaphone, match: ["/vendas/cupons", "/vendas/afiliados", "/vendas/coproducoes", "/marketplace"],
    links: [
      { title: "Cupons", desc: "Descontos e campanhas", url: "/vendas/cupons", icon: TicketPercent },
      { title: "Afiliados", desc: "Quem vende por você", url: "/vendas/afiliados", icon: Users },
      { title: "Coproduções", desc: "Divisão automática", url: "/vendas/coproducoes", icon: Repeat },
    ],
  },
  {
    id: "apps", label: "Integrações", url: "/integracoes", icon: Blocks, match: ["/integracoes", "/vendas/webhooks"],
    links: [
      { title: "Apps", desc: "Conecte ferramentas", url: "/integracoes?tab=apps", icon: Puzzle },
      { title: "Webhooks", desc: "Eventos em tempo real", url: "/integracoes?tab=webhooks", icon: Webhook },
      { title: "Credenciais de API", desc: "Chaves de acesso", url: "/integracoes?tab=keys", icon: KeyRound },
      { title: "Documentação", desc: "Guia de integração", url: "/integracoes?tab=api", icon: BookOpenText },
    ],
  },
];

export function isSectionActive(pathname: string, section: SellerNavSection): boolean {
  return section.match.some((m) => (m.endsWith("$") ? pathname === m.slice(0, -1) : pathname === m || pathname.startsWith(m + "/") || pathname === m));
}
