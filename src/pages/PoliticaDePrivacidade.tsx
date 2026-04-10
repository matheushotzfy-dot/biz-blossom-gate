import { ArrowLeft, Shield, Eye, Database, Lock, UserCheck, Globe, Bell, FileText } from "lucide-react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "01 de Abril de 2026";
const COMPANY_NAME = "HOTZFY";

const sections = [
 {
 id: "introducao",
 icon: Shield,
 title: "1. Introdução",
 content: `A ${COMPANY_NAME} ("nós", "nosso") está comprometida com a proteção dos dados pessoais dos seus usuários. Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos suas informações pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e demais legislações aplicáveis.`,
 },
 {
 id: "coleta",
 icon: Database,
 title: "2. Dados que Coletamos",
 content: `2.1. **Dados de Cadastro**: Nome completo, CPF/CNPJ, e-mail, telefone (WhatsApp), tipo de documento.\n\n2.2. **Dados Financeiros**: Chaves PIX, dados bancários (banco, agência, conta), endereços de carteiras de criptomoedas.\n\n2.3. **Dados de Verificação (KYC)**: Documentos de identidade (RG, CNH, passaporte), comprovante de endereço, selfie com documento.\n\n2.4. **Dados de Transação**: Valores, métodos de pagamento, status, histórico de vendas e saques.\n\n2.5. **Dados Técnicos**: Endereço IP, navegador, sistema operacional, dados de sessão, logs de acesso.\n\n2.6. **Dados de Navegação**: Páginas visitadas, cliques, tempo de permanência, dados de pixels de rastreamento configurados pelo Vendedor.`,
 },
 {
 id: "finalidade",
 icon: Eye,
 title: "3. Finalidade do Tratamento",
 content: `Utilizamos seus dados para:\n\n• **Prestação do serviço**: Criar e gerenciar sua conta, processar transações, realizar saques e entregas.\n• **Verificação de identidade**: Cumprimento das obrigações de KYC e prevenção à lavagem de dinheiro.\n• **Segurança**: Detecção e prevenção de fraudes, análise de risco, blacklists e velocity checks.\n• **Comunicação**: Notificações de transações, alertas de segurança, atualizações da plataforma.\n• **Melhoria contínua**: Análise de métricas e comportamento para otimizar a experiência.\n• **Obrigações legais**: Cumprimento de determinações judiciais, regulatórias ou fiscais.`,
 },
 {
 id: "base-legal",
 icon: FileText,
 title: "4. Base Legal (LGPD)",
 content: `O tratamento dos seus dados é fundamentado nas seguintes bases legais:\n\n• **Execução de contrato** (Art. 7º, V): Processamento de transações e prestação do serviço.\n• **Consentimento** (Art. 7º, I): Coleta de dados de marketing e pixels de rastreamento.\n• **Obrigação legal** (Art. 7º, II): KYC, prevenção à lavagem de dinheiro, obrigações fiscais.\n• **Legítimo interesse** (Art. 7º, IX): Segurança, prevenção de fraudes, melhoria do serviço.\n• **Proteção do crédito** (Art. 7º, X): Análise de risco financeiro.`,
 },
 {
 id: "compartilhamento",
 icon: Globe,
 title: "5. Compartilhamento de Dados",
 content: `Seus dados podem ser compartilhados com:\n\n• **Processadores de pagamento**: Gateways e adquirentes para processamento de transações.\n• **Provedores de infraestrutura**: Serviços de hospedagem, CDN e banco de dados.\n• **Autoridades**: Quando exigido por lei, regulação ou ordem judicial.\n• **Parceiros de verificação**: Serviços de validação de documentos e identidade.\n\nNão vendemos, alugamos ou comercializamos dados pessoais a terceiros para fins de marketing.`,
 },
 {
 id: "seguranca",
 icon: Lock,
 title: "6. Segurança dos Dados",
 content: `Adotamos medidas técnicas e organizacionais para proteger seus dados:\n\n• **Criptografia**: Todas as comunicações utilizam SSL/TLS. Dados sensíveis são criptografados em repouso.\n• **Controle de acesso**: Autenticação robusta, políticas de segurança em nível de linha (RLS), e RBAC hierárquico.\n• **Monitoramento**: Logs de auditoria imutáveis, detecção de anomalias e alertas de segurança.\n• **Backup**: Backups automatizados com redundância geográfica.\n• **Imutabilidade**: Dados KYC (nome, documento, e-mail, telefone) tornam-se imutáveis após a primeira validação para prevenir fraude de identidade.`,
 },
 {
 id: "retencao",
 icon: Bell,
 title: "7. Retenção e Eliminação",
 content: `7.1. Dados de conta ativa são mantidos enquanto durar o relacionamento contratual.\n\n7.2. Após o encerramento da conta, dados financeiros e fiscais são mantidos por 5 (cinco) anos conforme obrigações legais.\n\n7.3. Logs de auditoria são mantidos por tempo indeterminado para fins de segurança.\n\n7.4. Dados de transação são mantidos por no mínimo 5 (cinco) anos.\n\n7.5. Dados dispensáveis são eliminados ou anonimizados quando não mais necessários.`,
 },
 {
 id: "direitos",
 icon: UserCheck,
 title: "8. Seus Direitos (LGPD)",
 content: `Conforme a LGPD, você tem direito a:\n\n• **Confirmação e acesso**: Saber se tratamos seus dados e acessá-los.\n• **Correção**: Solicitar a correção de dados incompletos ou desatualizados.\n• **Anonimização ou eliminação**: Solicitar a anonimização ou eliminação de dados desnecessários.\n• **Portabilidade**: Solicitar a transferência dos seus dados a outro fornecedor.\n• **Informação sobre compartilhamento**: Saber com quais entidades seus dados foram compartilhados.\n• **Revogação do consentimento**: Revogar o consentimento a qualquer momento.\n• **Oposição**: Opor-se ao tratamento quando baseado em legítimo interesse.\n\nPara exercer seus direitos, entre em contato: **privacidade@hotzfy.com**`,
 },
 {
 id: "cookies",
 icon: Globe,
 title: "9. Cookies e Rastreamento",
 content: `9.1. Utilizamos cookies essenciais para funcionamento da Plataforma (sessão, autenticação).\n\n9.2. Vendedores podem configurar pixels de rastreamento (Facebook, Google, TikTok, Kwai) em seus checkouts para mensuração de conversão.\n\n9.3. Os pixels de terceiros são de responsabilidade do Vendedor que os configura, devendo este obter o consentimento adequado dos Compradores.\n\n9.4. Dados de sessão e preferências são armazenados localmente no navegador.`,
 },
 {
 id: "alteracoes",
 icon: FileText,
 title: "10. Alterações nesta Política",
 content: `10.1. Esta Política pode ser atualizada periodicamente para refletir mudanças nas práticas ou na legislação.\n\n10.2. Notificaremos alterações significativas por e-mail ou através de aviso na Plataforma.\n\n10.3. O uso continuado da Plataforma após a publicação de alterações constitui aceitação da versão atualizada.\n\n10.4. Versões anteriores ficam disponíveis mediante solicitação.\n\n**Encarregado de Proteção de Dados (DPO)**: privacidade@hotzfy.com\n**Foro**: Comarca de São Paulo/SP`,
 },
];

export default function PoliticaDePrivacidade() {
 return (
 <div className="min-h-screen bg-background">
 {/* Header */}
 <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/40">
 <div className="max-w-4xl mx-auto flex items-center gap-4 px-6 py-4">
 <Link to="/" className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
 <ArrowLeft className="h-4 w-4 text-primary" />
 </Link>
 <div>
 <h1 className="text-lg font-display font-bold text-foreground tracking-[-0.03em]">Política de Privacidade</h1>
 <p className="text-xs text-muted-foreground">Última atualização: {LAST_UPDATED}</p>
 </div>
 </div>
 </header>

 {/* Content */}
 <main className="max-w-4xl mx-auto px-6 py-10">
 {/* LGPD Badge */}
 <div className="mb-10 flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/15">
 <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
 <Shield className="h-5 w-5 text-primary" />
 </div>
 <div>
 <p className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">Em conformidade com a LGPD</p>
 <p className="text-xs text-muted-foreground">Lei Geral de Proteção de Dados — Lei nº 13.709/2018</p>
 </div>
 </div>

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
 <Link to="/termos-de-uso" className="text-xs text-primary hover:underline">
 Termos de Uso
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
