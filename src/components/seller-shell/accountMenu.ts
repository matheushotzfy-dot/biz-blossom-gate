import type { KycKey } from "@/components/account/accountMeta";

export type MenuIcon = "user" | "shield" | "lock" | "percent" | "bank" | "help";
export interface AccountMenuLink { key: string; title: string; hint: string; to: string; icon: MenuIcon }

const VERIFY_HINT: Record<KycKey, string> = {
  approved: "Identidade confirmada",
  pending: "Envie seus documentos",
  pending_review: "Em análise pela equipe",
  rejected: "Corrija e envie de novo",
  blocked: "Fale com o suporte",
};

/** Atalhos do menu da conta, na ordem em que aparecem (desktop e celular). */
export function accountMenuLinks(kyc: KycKey): AccountMenuLink[] {
  return [
    { key: "account", title: "Minha conta", hint: "Dados pessoais e endereço", to: "/perfil", icon: "user" },
    { key: "verify", title: "Verificação", hint: VERIFY_HINT[kyc], to: kyc === "blocked" ? "/suporte" : "/perfil?tab=identidade", icon: "shield" },
    { key: "security", title: "Segurança", hint: "Senha e aparelhos conectados", to: "/perfil?tab=seguranca", icon: "lock" },
    { key: "fees", title: "Taxas e prazos", hint: "O que você paga em cada venda", to: "/financeiro/taxas", icon: "percent" },
    { key: "bank", title: "Dados bancários", hint: "Chaves Pix e contas", to: "/financeiro/config", icon: "bank" },
    { key: "help", title: "Central de ajuda", hint: "Fale com a nossa equipe", to: "/suporte", icon: "help" },
  ];
}

/** Primeiro nome para o cumprimento; sem nome cadastrado, "Vendedor". */
export function firstNameOf(name?: string | null): string {
  return (name ?? "").trim().split(/\s+/)[0] || "Vendedor";
}

export function initialOf(name?: string | null): string {
  return firstNameOf(name).charAt(0).toUpperCase();
}
