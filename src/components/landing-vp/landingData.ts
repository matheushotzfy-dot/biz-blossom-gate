/**
 * Textos e dados da landing. Tudo aqui precisa ser verdade sobre o produto:
 * nada de taxa de aprovação, prazo de saque ou "adquirência exclusiva" que o painel não prove.
 * As telas mostradas são capturas reais do painel e do checkout com dados de exemplo, e a página avisa isso.
 */
import painelVendas from "@/assets/landing/painel-vendas.webp";
import painelSaques from "@/assets/landing/painel-saques.webp";
import painelWebhooks from "@/assets/landing/painel-webhooks.webp";
import checkoutComputador from "@/assets/landing/checkout-computador.webp";
import areaDoAluno from "@/assets/landing/area-do-aluno.webp";

export const NAV_LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#painel", label: "O painel" },
  { href: "#premiacoes", label: "Premiações" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#devs", label: "Para devs" },
  { href: "#duvidas", label: "Dúvidas" },
] as const;

/**
 * Quem está por trás da plataforma. Só aparece na página quando razão social e CNPJ estiverem preenchidos:
 * enquanto estiverem vazios, a seção "Empresa" e a linha do rodapé ficam escondidas (nunca inventar dado de empresa).
 */
export const COMPANY: {
  legalName: string | null;
  cnpj: string | null;
  city: string | null;
  email: string | null;
  whatsapp: string | null;
} = {
  legalName: null,
  cnpj: null,
  city: null,
  email: null,
  whatsapp: null,
};

export const hasCompany = (c = COMPANY) => !!(c.legalName?.trim() && c.cnpj?.trim());

/** Provas que o visitante confere sozinho, sem criar conta. */
export const PROOFS = [
  { t: "Status ao vivo", d: "Veja agora se o servidor, o login e os pagamentos estão no ar.", to: "/status", cta: "Abrir o status" },
  { t: "Documentação aberta", d: "Webhooks, assinatura e eventos explicados, sem precisar de cadastro.", to: "/documentacao", cta: "Ler a documentação" },
  { t: "Regras por escrito", d: "Termos de uso e política de privacidade, escrita de acordo com a LGPD.", to: "/termos-de-uso", cta: "Ler os termos" },
] as const;

/** Do cadastro ao primeiro saque, na ordem em que acontece. */
export const STEPS = [
  { t: "Abra a conta", d: "Com CPF ou CNPJ, em poucos minutos. Depois envie os documentos para a verificação de identidade." },
  { t: "Monte o produto", d: "Com a conta aprovada, defina preço, formas de pagamento, o checkout com a sua cara e o curso. A equipe revisa antes do checkout receber." },
  { t: "Venda", d: "Mande o link do checkout ou crie um link de pagamento. O Pix aprovado entra no saldo na hora." },
  { t: "Saque por Pix", d: "Peça o saque para a sua chave, confirmando com a sua senha, ou ligue o saque automático." },
] as const;

export interface TourTab {
  id: string;
  label: string;
  title: string;
  points: readonly string[];
  image: string;
  alt: string;
}

/** As telas do "painel por dentro": capturas reais com dados de exemplo. */
export const TOUR: readonly TourTab[] = [
  {
    id: "vendas",
    label: "Vendas",
    title: "Cada pagamento com o status real.",
    points: ["Filtros por período, status e produto", "Valor cobrado e líquido de cada venda", "Exporta a lista em CSV ou Excel"],
    image: painelVendas,
    alt: "Lista de vendas com cliente, forma de pagamento, status, horário e valor líquido",
  },
  {
    id: "checkout",
    label: "Checkout",
    title: "O que o seu cliente vê na hora de pagar.",
    points: ["Pix, cartão em até 12x e boleto, ligados por produto", "Order bumps, cupom e cronômetro de oferta", "Garantia de 7 dias e conexão protegida à vista"],
    image: checkoutComputador,
    alt: "Página de checkout com dados do comprador, ofertas adicionais e resumo do pedido",
  },
  {
    id: "membros",
    label: "Área de membros",
    title: "O acesso sai quando o pagamento confirma.",
    points: ["Cursos com módulos, aulas, materiais e quiz", "O aluno continua de onde parou", "Certificado quando conclui"],
    image: areaDoAluno,
    alt: "Área do aluno com o curso para continuar e a lista de cursos comprados",
  },
  {
    id: "saques",
    label: "Saques",
    title: "Saque por Pix, com cada valor separado.",
    points: ["Disponível, em análise e aguardando liberação, cada um no seu lugar", "O dia em que cada parte cai no saldo", "Saque automático quando o saldo chega ao valor que você escolher"],
    image: painelSaques,
    alt: "Tela de saldo e saques com valor disponível, valores aguardando liberação e histórico de saques",
  },
  {
    id: "webhooks",
    label: "Webhooks",
    title: "O seu sistema fica sabendo na hora.",
    points: ["Assinatura em todo envio", "Cada entrega com a resposta do seu servidor", "Teste e reenvio pelo próprio painel"],
    image: painelWebhooks,
    alt: "Tela de webhooks com endpoints, histórico de entregas e eventos assinados",
  },
];

export const FAQ = [
  {
    q: "Quanto custa para usar?",
    a: "Abrir a conta é grátis e não tem mensalidade. Você paga uma taxa por venda aprovada, que muda conforme a forma de pagamento, e uma taxa fixa por saque. Os valores ficam no seu painel, em Financeiro, na página Taxas, antes de você fazer a primeira venda.",
  },
  {
    q: "Quando o dinheiro chega ao meu saldo?",
    a: "O Pix entra no saldo assim que é aprovado. Cartão e boleto seguem o prazo mostrado na página Taxas do painel. Do saldo, você pede o saque por Pix para a chave que cadastrou, ou liga o saque automático, que pede o saque sozinho quando o saldo chega ao valor que você escolheu.",
  },
  {
    q: "Quais formas de pagamento posso aceitar?",
    a: "Pix, cartão de crédito (parcelado em até 12x) e boleto. Você liga ou desliga cada uma por produto, e a forma precisa estar liberada para a sua conta.",
  },
  {
    q: "Preciso ter CNPJ?",
    a: "Não. Você abre a conta como pessoa física, com CPF, ou como empresa, com CNPJ. Nos dois casos a conta passa por uma verificação de identidade com envio de documentos, e o saque só é processado depois que ela é aprovada.",
  },
  {
    q: "Em quanto tempo começo a vender?",
    a: "A conta abre em poucos minutos. Depois você envia os documentos pelo painel e, com a verificação de identidade aprovada, cria os produtos e pede saques. Cada produto novo ainda passa por uma revisão da equipe antes de o checkout aceitar pagamentos, e você acompanha essa revisão no painel.",
  },
  {
    q: "Como funciona a área de membros?",
    a: "Você monta o curso com módulos e aulas (vídeo, materiais para baixar e quiz) e liga o curso a um produto. Quando o pagamento é confirmado, o acesso é liberado para o e-mail da compra. O aluno acompanha o próprio progresso e pode emitir certificado.",
  },
  {
    q: "Posso dividir a venda com coprodutor e afiliado?",
    a: "Pode. Na coprodução, você define de 1% a 99% do valor líquido para o parceiro. No programa de afiliados, a comissão vai de 1% a 90%. As duas divisões caem no saldo de cada um quando a venda é aprovada, e a comissão do afiliado nunca passa do que sobra depois do coprodutor.",
  },
  {
    q: "Tem API para integrar com o meu sistema?",
    a: "Hoje você tem webhooks assinados (com reenvio e teste ao vivo pelo painel) e chaves de API. A API pública para criar cobranças ainda não está aberta; quando abrir, ela aparece na documentação.",
  },
  {
    q: "Meus dados e os dos meus clientes estão seguros?",
    a: "Credenciais de integração ficam criptografadas, o saque pede a sua senha de novo, e cada movimentação de saldo fica registrada num extrato que não se apaga. O tratamento de dados segue a nossa Política de Privacidade, escrita de acordo com a LGPD.",
  },
  {
    q: "Como falo com o suporte?",
    a: "Pelo painel, abrindo um chamado. As respostas chegam na mesma conversa e a equipe marca quando o assunto foi resolvido.",
  },
] as const;

export const SECURITY_POINTS = [
  { t: "Identidade verificada", d: "Todo vendedor envia documentos antes de sacar. Sem aprovação, o dinheiro fica no saldo." },
  { t: "Saque com a senha de novo", d: "Pedir saque, trocar chave Pix ou ligar o saque automático exigem a sua senha na hora." },
  { t: "Extrato que não se apaga", d: "Venda, taxa, divisão e saque viram lançamentos no seu livro-razão, um por movimentação." },
  { t: "Segredos guardados com cuidado", d: "Credenciais de integração ficam criptografadas, e o segredo de uma chave de API só aparece uma vez." },
  { t: "Aparelhos sob controle", d: "Você vê o último acesso da conta e desconecta todos os outros aparelhos num clique." },
  { t: "Documento travado", d: "O CPF ou CNPJ da conta fica criptografado e não muda depois do cadastro sem passar pela equipe." },
] as const;

export const SELL_FEATURES = [
  { t: "Links de pagamento", d: "Gere um link em segundos e mande pelo WhatsApp, Instagram ou e-mail, sem precisar de site." },
  { t: "Checkout com a sua cara", d: "Cor do botão, banners, cronômetro de oferta e até 5 order bumps por produto." },
  { t: "Cupons de desconto", d: "Código com limite de usos e data de validade, e o painel mostra quanto cada cupom já abateu." },
  { t: "Afiliados e coprodução", d: "Programa de afiliados por produto e convite de coprodutor, com a divisão feita sozinha." },
  { t: "Pixels por produto", d: "Meta, Google Ads e outros pixels disparam os eventos da compra só nos produtos que você escolher." },
  { t: "Apps conectados", d: "UTMify e outros apps recebem as vendas sem você mexer em código." },
  { t: "Relatórios que saem do painel", d: "Filtre as vendas por período, status e produto, e baixe em CSV ou Excel." },
  { t: "Busca em qualquer tela", d: "Ctrl+K encontra venda, produto e cliente sem sair de onde você está." },
] as const;
