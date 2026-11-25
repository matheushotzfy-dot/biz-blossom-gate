import type { LucideIcon } from "lucide-react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { SELLER_EXTRA, SELLER_NAV } from "@/components/seller-shell/navConfig";

/**
 * Regras da busca global (Ctrl-K), sem React: as páginas vêm do mesmo menu do painel,
 * então um atalho novo no menu já aparece aqui e um removido some junto.
 */

export interface SearchPage {
  id: string;
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  /** Nome da seção do menu, usado para agrupar quando a busca está vazia. */
  section: string;
  /** Palavras que o seller usa para procurar a página, mesmo que não estejam no nome. */
  keywords: string[];
}

/** Minúsculas e sem acento: "Cobrança" casa com "cobranca". */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Tira o plural de uma palavra já normalizada ("cupons" → "cupom", "premiacoes" → "premiacao"), para "cupom" achar "Cupons". */
function singular(word: string): string {
  return word.replace(/(oes|aes|aos)$/, "ao").replace(/ns$/, "m").replace(/([^s])s$/, "$1");
}
const singularAll = (text: string) => text.split(" ").map(singular).join(" ");

/** Tira do termo os caracteres que têm significado na gramática de filtros do PostgREST (`,` `(` `)` aspas e curingas). */
export function sanitizeTerm(value: string): string {
  return value.replace(/[%,()"\\*]/g, " ").replace(/\s+/g, " ").trim();
}

const KEYWORDS: Record<string, string[]> = {
  "/vendas": ["pedidos", "extrato", "transacoes", "pagamentos", "compras"],
  "/vendas/link-pagamento": ["cobrar", "cobranca", "link"],
  "/vendas/assinaturas": ["recorrente", "planos", "mensalidade", "recorrencia"],
  "/financeiro/saques": ["saque", "sacar", "saldo", "retirar", "transferir", "dinheiro"],
  "/financeiro/taxas": ["tarifa", "tarifas", "custos", "percentual", "plano"],
  "/financeiro/config": ["pix", "chave pix", "banco", "conta bancaria", "agencia"],
  "/vendas/produtos": ["catalogo", "curso", "ebook", "infoproduto"],
  "/vendas/checkout": ["pagina de pagamento", "personalizar", "cores"],
  "/vendas/conteudo": ["membros", "aulas", "curso", "modulos"],
  "/vendas/cupons": ["desconto", "promocao", "codigo", "oferta"],
  "/vendas/afiliados": ["comissao", "indicacao", "parceiros"],
  "/vendas/coproducoes": ["socio", "parceiro", "divisao", "split"],
  "/integracoes?tab=apps": ["pixel", "facebook", "utmify", "zapier", "ferramentas", "conectar"],
  "/integracoes?tab=webhooks": ["webhook", "evento", "notificacao", "aviso"],
  "/integracoes?tab=keys": ["api", "chave", "token", "credencial", "secret"],
  "/integracoes?tab=api": ["docs", "documentacao", "guia", "desenvolvedor"],
  "/premiacoes": ["placa", "premio", "meta", "faturamento"],
  "/perfil": ["conta", "dados", "endereco", "perfil", "nome", "telefone"],
  "/perfil?tab=identidade": ["kyc", "documento", "verificacao", "selfie", "cnpj", "cpf", "rg"],
  "/perfil?tab=seguranca": ["senha", "2fa", "autenticacao", "sessao", "login"],
  "/suporte": ["ajuda", "ticket", "contato", "atendimento"],
  "/dashboard": ["inicio", "resumo", "painel", "home"],
};

const DESC: Record<string, string> = {
  "/dashboard": "Resumo do seu negócio",
  "/premiacoes": "Placas e metas de faturamento",
  "/perfil": "Dados, identidade e segurança",
  "/suporte": "Fale com a equipe",
  "/perfil?tab=identidade": "Documentos e verificação",
  "/perfil?tab=seguranca": "Senha e acesso",
};

function build(): SearchPage[] {
  const out: SearchPage[] = [];
  const seen = new Set<string>();
  const add = (p: Omit<SearchPage, "id" | "keywords" | "desc"> & { desc?: string }) => {
    if (seen.has(p.href)) return;
    seen.add(p.href);
    out.push({ ...p, id: `page:${p.href}`, desc: p.desc ?? DESC[p.href] ?? "", keywords: KEYWORDS[p.href] ?? [] });
  };

  for (const s of SELLER_NAV) {
    if (!s.links) { add({ title: s.label, href: s.url, icon: s.icon, section: s.label }); continue; }
    for (const l of s.links) if (!l.soon) add({ title: l.title, desc: l.desc, href: l.url, icon: l.icon, section: s.label });
  }
  for (const e of SELLER_EXTRA) add({ title: e.label, href: e.url, icon: e.icon, section: "Conta" });
  add({ title: "Identidade e KYC", href: "/perfil?tab=identidade", icon: BadgeCheck, section: "Conta" });
  add({ title: "Segurança", href: "/perfil?tab=seguranca", icon: ShieldCheck, section: "Conta" });
  return out;
}

export const SEARCH_PAGES: SearchPage[] = build();

/** Páginas que combinam com o texto, as que começam com ele primeiro. Sem texto, todas na ordem do menu. */
export function filterPages(pages: SearchPage[], query: string, limit = Infinity): SearchPage[] {
  const q = normalizeText(query);
  if (!q) return pages.slice(0, limit);
  const terms = q.split(/\s+/);

  const ranked: Array<{ page: SearchPage; score: number; order: number }> = [];
  pages.forEach((page, order) => {
    const title = normalizeText(page.title);
    const titleForms = [title, singularAll(title)];
    const keywords = page.keywords.map(normalizeText);
    const full = [title, normalizeText(page.desc), ...keywords].join(" ");
    const hay = `${full} ${singularAll(full)}`;
    if (!terms.every((t) => hay.includes(t))) return;
    const score = titleForms.some((f) => f.startsWith(q)) ? 0
      : titleForms.some((f) => f.includes(q)) ? 1
      : titleForms.some((f) => f.split(" ").some((w) => w.startsWith(terms[0]))) ? 2
      : keywords.some((k) => k.includes(q)) ? 3 : 4;
    ranked.push({ page, score, order });
  });
  ranked.sort((a, b) => a.score - b.score || a.order - b.order);
  return ranked.slice(0, limit).map((r) => r.page);
}

/** Rótulo do status de um produto no resultado da busca (vazio quando não há o que dizer). */
export function productStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "active": return "Ativo";
    case "draft": return "Rascunho";
    case "pending_review": case "pending": return "Em revisão";
    case "rejected": return "Recusado";
    case "inactive": case "paused": return "Inativo";
    default: return "";
  }
}
