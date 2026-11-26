/**
 * Textos e dados de exemplo da landing. Tudo aqui precisa ser verdade sobre o produto:
 * nada de taxa de aprovação, prazo de saque ou "adquirência exclusiva" que o painel não prove.
 * Valores e nomes de vendas são exemplos e a página sempre avisa isso.
 */

export const NAV_LINKS = [
  { href: "#venda", label: "Como funciona" },
  { href: "#vender", label: "Vender" },
  { href: "#premiacoes", label: "Premiações" },
  { href: "#integracao", label: "Para devs" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#duvidas", label: "Dúvidas" },
] as const;

export interface ExampleSale {
  who: string;
  what: string;
  method: "Pix" | "Cartão 3x" | "Boleto";
  cents: number;
  /** Paga desde o começo da cena. */
  paid: boolean;
  /** Boleto que é pago durante a cena (o status muda na frente de quem olha). */
  paysLater?: boolean;
}

/**
 * O dia de exemplo do topo, do mais antigo para o mais novo. As `HERO_ROWS` primeiras já estão na tela;
 * as outras chegam uma a uma por cima, e o boleto `paysLater` muda para pago no fim.
 */
export const EXAMPLE_SALES: ExampleSale[] = [
  { who: "Ana T.", what: "Mentoria em grupo", method: "Pix", cents: 29700, paid: true },
  { who: "Camila R.", what: "E-book Receitas Fit", method: "Pix", cents: 4700, paid: true },
  { who: "Lucas A.", what: "Curso Marketing do Zero", method: "Boleto", cents: 19700, paid: false, paysLater: true },
  { who: "João P.", what: "Mentoria em grupo", method: "Cartão 3x", cents: 49700, paid: true },
  { who: "Bruna M.", what: "E-book Receitas Fit", method: "Pix", cents: 4700, paid: true },
  { who: "Maria S.", what: "Curso Marketing do Zero", method: "Pix", cents: 19700, paid: true },
  { who: "Rafael C.", what: "Comunidade VIP, mensal", method: "Cartão 3x", cents: 9700, paid: true },
];

/** Quantas vendas cabem no cartão do topo. */
export const HERO_ROWS = 5;

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
    a: "A conta abre em poucos minutos e você já pode montar o produto. Cada produto novo passa por uma revisão da equipe antes de o checkout aceitar pagamentos, e você acompanha essa revisão no painel. O saque só é processado depois que a verificação de identidade for aprovada.",
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
] as const;

export const SELL_FEATURES = [
  { t: "Links de pagamento", d: "Gere um link em segundos e mande pelo WhatsApp, Instagram ou e-mail, sem precisar de site." },
  { t: "Checkout com a sua cara", d: "Cor do botão, banners, cronômetro de oferta e até 5 order bumps por produto." },
  { t: "Cupons de desconto", d: "Código com limite de usos e data de validade, e o painel mostra quanto cada cupom já abateu." },
  { t: "Pixels por produto", d: "Meta, Google Ads e outros pixels disparam os eventos da compra só nos produtos que você escolher." },
  { t: "Relatórios que saem do painel", d: "Filtre as vendas por período, status e produto, e baixe em CSV ou Excel." },
  { t: "Busca em qualquer tela", d: "Ctrl+K encontra venda, produto e cliente sem sair de onde você está." },
] as const;
