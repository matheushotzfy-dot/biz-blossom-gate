import { ArrowLeft, Shield, FileText, Scale, AlertTriangle, CheckCircle2, Clock, Ban } from "lucide-react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "01 de Abril de 2026";
const COMPANY_NAME = "HOTZFY";

const sections = [
  {
    id: "aceitacao",
    icon: CheckCircle2,
    title: "1. Aceitação dos Termos",
    content: `Ao acessar ou utilizar a plataforma ${COMPANY_NAME} ("Plataforma"), você declara ter lido, compreendido e concordado integralmente com estes Termos de Uso. Se você não concordar com qualquer disposição, não utilize a Plataforma. O uso continuado constitui aceitação tácita de quaisquer alterações futuras.`,
  },
  {
    id: "definicoes",
    icon: FileText,
    title: "2. Definições",
    content: `• **Plataforma**: Sistema digital ${COMPANY_NAME} para gestão e venda de produtos digitais.\n• **Vendedor (Seller)**: Pessoa física ou jurídica cadastrada que comercializa produtos.\n• **Comprador**: Usuário final que adquire produtos através da Plataforma.\n• **Afiliado**: Usuário que promove produtos de terceiros em troca de comissões.\n• **Coprodutor**: Parceiro com participação financeira no faturamento de um produto.\n• **Área de Membros**: Ambiente protegido para entrega de conteúdo digital.`,
  },
  {
    id: "cadastro",
    icon: Shield,
    title: "3. Cadastro e Conta",
    content: `3.1. O cadastro é obrigatório para Vendedores e requer informações verídicas, incluindo CPF/CNPJ, e-mail válido e telefone.\n\n3.2. Cada usuário pode manter apenas uma conta ativa. Contas duplicadas serão encerradas.\n\n3.3. O Vendedor é integralmente responsável pela segurança de suas credenciais de acesso.\n\n3.4. A Plataforma reserva-se o direito de solicitar documentos adicionais para verificação de identidade (KYC) a qualquer momento.\n\n3.5. A recusa em fornecer documentos solicitados poderá resultar na suspensão da conta e bloqueio de saques.`,
  },
  {
    id: "produtos",
    icon: Scale,
    title: "4. Produtos e Conteúdo",
    content: `4.1. O Vendedor garante possuir todos os direitos de propriedade intelectual sobre os produtos comercializados.\n\n4.2. É expressamente proibido comercializar:\n  a) Conteúdo ilegal, difamatório, discriminatório ou pornográfico;\n  b) Produtos que violem direitos autorais de terceiros;\n  c) Esquemas pirâmide, jogos de azar ilegais ou fraudes;\n  d) Conteúdo que incentive violência ou atividades ilícitas.\n\n4.3. A Plataforma reserva-se o direito de reprovar, suspender ou remover qualquer produto a seu exclusivo critério.\n\n4.4. O preço mínimo por produto é de R$ 1,00 e o máximo de R$ 99.999,99.`,
  },
  {
    id: "financeiro",
    icon: Scale,
    title: "5. Transações e Financeiro",
    content: `5.1. A Plataforma atua como intermediária nas transações, cobrando taxas por transação e por saque conforme a tabela de taxas vigente.\n\n5.2. Os valores das vendas ficam disponíveis para saque após o período de retenção configurado (segurança antifraude).\n\n5.3. Saques podem ser realizados via PIX ou Criptomoedas, sujeitos às taxas e limites aplicáveis.\n\n5.4. A Plataforma não se responsabiliza por chargebacks ou contestações originadas de fraude do comprador, podendo debitar o valor do saldo do Vendedor.\n\n5.5. É vedada a prática de auto-compra ou qualquer artifício para manipulação de saldo ou métricas.`,
  },
  {
    id: "reembolso",
    icon: Clock,
    title: "6. Política de Reembolso",
    content: `6.1. Conforme o Código de Defesa do Consumidor (Art. 49), compras de produtos digitais possuem prazo de 7 (sete) dias corridos para arrependimento, contados a partir da data da compra.\n\n6.2. Solicitações de reembolso devem ser feitas pelo Comprador diretamente ao Vendedor ou via canais oficiais da Plataforma.\n\n6.3. Reembolsos aprovados são debitados automaticamente do saldo do Vendedor.\n\n6.4. A Plataforma reserva-se o direito de processar reembolsos compulsórios em casos de fraude ou violação dos termos.`,
  },
  {
    id: "suspensao",
    icon: Ban,
    title: "7. Suspensão e Encerramento",
    content: `7.1. A Plataforma poderá suspender ou encerrar contas que:\n  a) Violem estes Termos de Uso;\n  b) Apresentem atividade suspeita de fraude;\n  c) Acumulem taxa de chargeback superior a 1%;\n  d) Permaneçam inativas por mais de 12 meses;\n  e) Forneçam informações falsas no cadastro.\n\n7.2. Em caso de encerramento, o saldo remanescente será liberado após análise de compliance, descontadas eventuais pendências.\n\n7.3. O usuário pode solicitar o encerramento de sua conta a qualquer momento através do suporte.`,
  },
  {
    id: "responsabilidade",
    icon: AlertTriangle,
    title: "8. Limitação de Responsabilidade",
    content: `8.1. A Plataforma é fornecida "como está" (as is), sem garantias de disponibilidade ininterrupta.\n\n8.2. A ${COMPANY_NAME} não se responsabiliza por:\n  a) Perdas financeiras decorrentes do uso indevido da conta;\n  b) Conteúdo publicado por Vendedores;\n  c) Indisponibilidade temporária causada por manutenção ou força maior;\n  d) Ações de terceiros, incluindo gateways de pagamento.\n\n8.3. A responsabilidade total da ${COMPANY_NAME} está limitada ao valor das taxas efetivamente pagas pelo Vendedor nos últimos 12 meses.`,
  },
  {
    id: "geral",
    icon: FileText,
    title: "9. Disposições Gerais",
    content: `9.1. Estes Termos são regidos pela legislação brasileira.\n\n9.2. Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias.\n\n9.3. A ${COMPANY_NAME} reserva-se o direito de alterar estes Termos a qualquer momento, notificando os usuários através da Plataforma.\n\n9.4. A invalidade de qualquer cláusula não afeta a validade das demais.\n\n9.5. Dúvidas ou reclamações podem ser direcionadas ao e-mail: suporte@hotzfy.com`,
  },
];

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-4xl mx-auto flex items-center gap-4 px-6 py-4">
          <Link to="/" className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
            <ArrowLeft className="h-4 w-4 text-primary" />
          </Link>
          <div>
            <h1 className="text-lg font-display font-bold text-foreground tracking-[-0.03em]">Termos de Uso</h1>
            <p className="text-xs text-muted-foreground">Última atualização: {LAST_UPDATED}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="group">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/15">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-[17px] font-display font-bold text-foreground tracking-[-0.02em] pt-2">{s.title}</h2>
              </div>
              <div className="ml-14 text-[14px] text-muted-foreground leading-relaxed whitespace-pre-line">
                {s.content.split("**").map((part, i) =>
                  i % 2 === 1 ? <strong key={i} className="text-foreground font-semibold">{part}</strong> : part
                )}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border/40 text-center">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} {COMPANY_NAME}. Todos os direitos reservados.
          </p>
          <div className="flex justify-center gap-6 mt-3">
            <Link to="/politica-de-privacidade" className="text-xs text-primary hover:underline">
              Política de Privacidade
            </Link>
            <Link to="/auth" className="text-xs text-primary hover:underline">
              Criar Conta
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
