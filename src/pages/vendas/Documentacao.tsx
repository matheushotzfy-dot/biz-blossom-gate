import { useState, useRef, useEffect, useCallback } from "react";
import { BookOpen, Copy, Check, Zap, Shield, Terminal, Globe, Lock, AlertTriangle, Server, Code2, Hash, ChevronRight, ExternalLink, Radio } from "lucide-react";
import { PageShell, PageTitle } from "@/components/PageShell";
import { cn } from "@/lib/utils";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/* ─── Reusable Components ─── */
function CopyBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-3">
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100 z-10"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <div className="rounded-xl overflow-hidden border border-border/30 bg-[hsl(var(--background))]">
        {language && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/20 bg-muted/5">
            <div className="h-2 w-2 rounded-full bg-destructive/30" />
            <div className="h-2 w-2 rounded-full bg-warning/30" />
            <div className="h-2 w-2 rounded-full bg-success/30" />
            <span className="ml-2 text-[10px] font-mono text-muted-foreground/40">{language}</span>
          </div>
        )}
        <pre className="p-4 overflow-x-auto text-[11px] font-mono text-foreground/70 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "post" | "get" | "delete" | "success" | "error" | "warn" }) {
  const styles: Record<string, string> = {
    default: "bg-primary/10 text-primary border-primary/20",
    post: "bg-warning/10 text-warning border-warning/20",
    get: "bg-success/10 text-success border-success/20",
    delete: "bg-destructive/10 text-destructive border-destructive/20",
    success: "bg-success/10 text-success border-success/20",
    error: "bg-destructive/10 text-destructive border-destructive/20",
    warn: "bg-warning/10 text-warning border-warning/20",
  };
  return <span className={cn("inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", styles[variant])}>{children}</span>;
}

function ParamTable({ params }: { params: { name: string; type: string; required: boolean; desc: string }[] }) {
  return (
    <div className="rounded-xl border border-border/30 overflow-hidden my-3">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-muted/20 border-b border-border/20">
            <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Parâmetro</th>
            <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Tipo</th>
            <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Obrig.</th>
            <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-t border-border/10 hover:bg-muted/5 transition-colors">
              <td className="p-3 font-mono text-primary font-semibold text-[11px]">{p.name}</td>
              <td className="p-3 font-mono text-muted-foreground text-[11px]">{p.type}</td>
              <td className="p-3">{p.required ? <Badge variant="error">Sim</Badge> : <Badge>Não</Badge>}</td>
              <td className="p-3 text-muted-foreground/80">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Callout({ variant = "info", icon: Icon, children }: { variant?: "info" | "warn" | "error" | "success"; icon?: React.ElementType; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    info: "border-primary/15 bg-primary/5",
    warn: "border-warning/15 bg-warning/5",
    error: "border-destructive/15 bg-destructive/5",
    success: "border-success/15 bg-success/5",
  };
  const iconColor: Record<string, string> = { info: "text-primary", warn: "text-warning", error: "text-destructive", success: "text-success" };
  const DefaultIcon = variant === "warn" || variant === "error" ? AlertTriangle : variant === "success" ? Check : Shield;
  const FinalIcon = Icon || DefaultIcon;
  return (
    <div className={cn("p-4 rounded-xl border my-3", styles[variant])}>
      <div className="flex items-start gap-2.5">
        <FinalIcon className={cn("h-4 w-4 shrink-0 mt-0.5", iconColor[variant])} />
        <div className="text-[12px] text-muted-foreground leading-relaxed [&>strong]:text-foreground">{children}</div>
      </div>
    </div>
  );
}

/* ─── TOC Sections ─── */
const TOC = [
  { id: "intro", label: "Introdução", icon: Globe },
  { id: "auth", label: "Autenticação", icon: Lock },
  { id: "pix-cashin", label: "PIX Cash-In", icon: Terminal },
  { id: "pix-cashout", label: "PIX Cash-Out", icon: Terminal },
  { id: "webhooks", label: "Webhooks", icon: Zap },
  { id: "status", label: "Status", icon: Server },
  { id: "errors", label: "Erros HTTP", icon: AlertTriangle },
  { id: "integration", label: "Guia de Integração", icon: Code2 },
  { id: "fees", label: "Taxas", icon: Hash },
  { id: "security", label: "Segurança", icon: Shield },
];

export default function Documentacao() {
  const [activeSection, setActiveSection] = useState("intro");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const registerRef = useCallback((id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0.1 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <PageShell>
      <PageTitle icon={<BookOpen className="h-6 w-6" />} title="Documentação da API" subtitle="Referência completa para integração com a gateway Hotzfy" />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Globe, label: "Protocolo", value: "REST / JSON", color: "text-primary" },
          { icon: Lock, label: "Autenticação", value: "Bearer Token", color: "text-success" },
          { icon: Zap, label: "Webhooks", value: "HMAC-SHA256", color: "text-warning" },
          { icon: Shield, label: "SSL", value: "Obrigatório", color: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="panel-enterprise p-4 flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center bg-muted/20 border border-border/20", s.color)}>
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider">{s.label}</p>
              <p className="text-[13px] font-bold text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Layout: Sidebar + Content */}
      <div className="flex gap-6 relative">
        {/* Fixed Sidebar TOC */}
        <aside className="hidden lg:block w-[220px] shrink-0">
          <div className="sticky top-24 space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 px-3 mb-2">Navegação</p>
            {TOC.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all text-left",
                    active
                      ? "bg-primary/10 text-primary border border-primary/15"
                      : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/10 border border-transparent"
                  )}
                >
                  <item.icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground/30")} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* 1. INTRODUÇÃO */}
          <section id="intro" ref={registerRef("intro")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="1" title="Introdução" />
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              A API Hotzfy permite integrar sua aplicação com nossa gateway de pagamentos, possibilitando a criação de cobranças PIX, processamento de saques e recebimento de notificações em tempo real via webhooks.
            </p>
            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-foreground">Base URL</p>
              <CopyBlock code={BASE_URL} language="url" />
            </div>
            <p className="text-[12px] text-muted-foreground">
              Todas as respostas são em <code className="mono-inline">JSON</code>. Envie <code className="mono-inline">Content-Type: application/json</code> em todas as requisições.
            </p>
          </section>

          {/* 2. AUTENTICAÇÃO */}
          <section id="auth" ref={registerRef("auth")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="2" title="Autenticação" />
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Todas as requisições devem incluir o header <code className="mono-inline">Authorization</code> com seu token de acesso:
            </p>
            <CopyBlock code="Authorization: Bearer SEU_TOKEN_AQUI" language="header" />

            <Callout variant="warn" icon={AlertTriangle}>
              <strong>Importante:</strong> Nunca exponha seu token no frontend ou repositórios públicos. Todas as chamadas devem ser feitas server-to-server (backend-to-backend).
            </Callout>
          </section>

          {/* 3. PIX CASH-IN */}
          <section id="pix-cashin" ref={registerRef("pix-cashin")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="3" title="PIX Cash-In — Criar Cobrança" />
            <div className="flex items-center gap-2.5 mb-1">
              <Badge variant="post">POST</Badge>
              <code className="text-[12px] font-mono text-foreground/70">{BASE_URL}/podpay-create-transaction</code>
            </div>
            <p className="text-[13px] text-muted-foreground">Cria uma cobrança PIX e retorna QR Code + código copia-e-cola.</p>

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Request Body</h4>
            <ParamTable params={[
              { name: "productId", type: "string (UUID)", required: true, desc: "ID do produto cadastrado na plataforma" },
              { name: "paymentMethod", type: "string", required: true, desc: 'Deve ser "pix"' },
              { name: "customerName", type: "string", required: true, desc: "Nome completo do comprador" },
              { name: "customerEmail", type: "string", required: true, desc: "E-mail do comprador" },
              { name: "customerDocument", type: "string", required: true, desc: "CPF ou CNPJ (apenas números ou formatado)" },
              { name: "customerPhone", type: "string", required: false, desc: "Telefone com DDD" },
              { name: "checkoutSessionId", type: "string", required: false, desc: "ID de sessão para idempotência" },
              { name: "ip", type: "string", required: false, desc: "IP do pagador (antifraude)" },
            ]} />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Exemplo cURL</h4>
            <CopyBlock code={`curl -X POST ${BASE_URL}/podpay-create-transaction \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "productId": "uuid-do-produto",
    "paymentMethod": "pix",
    "customerName": "João Silva",
    "customerEmail": "joao@email.com",
    "customerDocument": "123.456.789-00",
    "customerPhone": "11999998888"
  }'`} language="bash" />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Response — Sucesso (200)</h4>
            <CopyBlock code={`{
  "success": true,
  "data": {
    "transactionId": "uuid-da-transacao",
    "podpayId": "id-podpay",
    "status": "waiting_payment",
    "pix": {
      "qrCode": "data:image/png;base64,...",
      "qrCodeText": "00020126580014br.gov.bcb.pix...",
      "expiresAt": "2026-03-03T12:30:00Z"
    }
  }
}`} language="json" />

            <Callout variant="info">
              <strong>PIX expira em 30 minutos.</strong> O campo <code className="mono-inline">pix.qrCode</code> é uma imagem Base64 pronta para exibir. O campo <code className="mono-inline">pix.qrCodeText</code> é o código copia-e-cola.
            </Callout>

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Idempotência</h4>
            <p className="text-[12px] text-muted-foreground">
              Se <code className="mono-inline">checkoutSessionId</code> já tiver uma transação pendente, a API retorna os dados existentes (campo <code className="mono-inline">"resumed": true</code>) sem criar duplicidade.
            </p>
          </section>

          {/* 4. PIX CASH-OUT */}
          <section id="pix-cashout" ref={registerRef("pix-cashout")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="4" title="PIX Cash-Out — Saques" />
            <div className="flex items-center gap-2.5 mb-1">
              <Badge variant="post">POST</Badge>
              <code className="text-[12px] font-mono text-foreground/70">{BASE_URL}/podpay-cashout</code>
            </div>

            <Callout variant="error" icon={Lock}>
              <strong>Apenas Administradores.</strong> Esta rota exige token de um usuário com role <code className="mono-inline">admin</code>. Tokens de usuários comuns retornam 403.
            </Callout>

            <h4 className="text-[13px] font-semibold text-foreground">Request Body</h4>
            <ParamTable params={[
              { name: "withdrawalId", type: "string (UUID)", required: true, desc: "ID do saque previamente criado" },
            ]} />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Exemplo cURL</h4>
            <CopyBlock code={`curl -X POST ${BASE_URL}/podpay-cashout \\
  -H "Authorization: Bearer TOKEN_ADMIN" \\
  -H "Content-Type: application/json" \\
  -d '{ "withdrawalId": "uuid-do-saque" }'`} language="bash" />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Response (200)</h4>
            <CopyBlock code={`{
  "success": true,
  "data": {
    "id": "transfer-id",
    "status": "processing",
    "amount": 10000,
    "method": "pix"
  }
}`} language="json" />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Fluxo de Cash-Out</h4>
            <div className="space-y-2 ml-1">
              {[
                "Vendedor solicita saque → registro em withdrawals com status pending",
                "Admin aprova → chama POST /podpay-cashout",
                "API busca chave PIX do vendedor no perfil",
                "Transferência PIX enviada para a chave configurada",
                "Status atualizado para approved",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed pt-0.5">{step}</p>
                </div>
              ))}
            </div>

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Tipos de Chave PIX</h4>
            <ParamTable params={[
              { name: "cpf", type: "string", required: false, desc: "CPF do recebedor" },
              { name: "cnpj", type: "string", required: false, desc: "CNPJ do recebedor" },
              { name: "email", type: "string", required: false, desc: "E-mail cadastrado como chave PIX" },
              { name: "phone", type: "string", required: false, desc: "Telefone com DDD" },
              { name: "random", type: "string", required: false, desc: "Chave aleatória EVP" },
            ]} />
          </section>

          {/* 5. WEBHOOKS */}
          <section id="webhooks" ref={registerRef("webhooks")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="5" title="Webhooks — Notificações em Tempo Real" />
            <p className="text-[13px] text-muted-foreground">
              Quando o status de um pagamento muda, a plataforma envia um <Badge variant="post">POST</Badge> para a URL configurada no seu painel de webhooks.
            </p>

            <h4 className="text-[13px] font-semibold text-foreground mt-4">Configuração</h4>
            <div className="space-y-2 ml-1">
              {[
                "Acesse Vendas → Webhooks no painel",
                "Adicione a URL do seu servidor (HTTPS obrigatório)",
                "Selecione os eventos que deseja receber",
                "Copie o Secret gerado para validar assinaturas",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground pt-0.5">{step}</p>
                </div>
              ))}
            </div>

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Eventos Disponíveis</h4>
            <ParamTable params={[
              { name: "payment.completed", type: "event", required: false, desc: "Pagamento aprovado / confirmado" },
              { name: "payment.pending", type: "event", required: false, desc: "Pagamento pendente (aguardando)" },
              { name: "payment.failed", type: "event", required: false, desc: "Pagamento recusado" },
              { name: "payment.cancelled", type: "event", required: false, desc: "Pagamento cancelado" },
              { name: "payment.refunded", type: "event", required: false, desc: "Reembolso processado" },
              { name: "payment.chargeback", type: "event", required: false, desc: "Chargeback recebido" },
              { name: "payment.dispute", type: "event", required: false, desc: "Disputa / mediação aberta" },
            ]} />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Payload do Webhook</h4>
            <CopyBlock code={`{
  "event": "payment.completed",
  "data": {
    "transaction_id": "uuid-da-transacao",
    "podpay_payment_id": "id-podpay",
    "status": "completed",
    "product_id": "uuid-do-produto"
  },
  "timestamp": "2026-03-03T10:30:00.000Z"
}`} language="json" />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Verificação de Assinatura (HMAC-SHA256)</h4>
            <p className="text-[12px] text-muted-foreground mb-3">
              Cada webhook inclui o header <code className="mono-inline">x-podpay-signature</code> com a assinatura HMAC-SHA256 do body.
            </p>

            <WebhookCodeExamples />

            <Callout variant="error" icon={AlertTriangle}>
              <strong>OBRIGATÓRIO:</strong> Sempre valide a assinatura antes de processar o webhook. Webhooks sem assinatura válida devem ser rejeitados com HTTP 401. Utilize comparação em tempo constante para evitar timing attacks.
            </Callout>

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Boas Práticas</h4>
            <ul className="space-y-1.5 ml-1">
              {[
                { label: "Idempotência", desc: "Use transaction_id para evitar processar o mesmo evento duas vezes" },
                { label: "Resposta rápida", desc: "Retorne 200 em até 10s. Processe webhooks de forma assíncrona" },
                { label: "HTTPS obrigatório", desc: "Sua URL de webhook deve usar HTTPS em produção" },
                { label: "Retry automático", desc: "Se seu endpoint retornar 5xx, haverá tentativas de re-envio" },
              ].map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-[12px]">
                  <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground"><strong className="text-foreground">{item.label}:</strong> {item.desc}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 6. STATUS */}
          <section id="status" ref={registerRef("status")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="6" title="Mapeamento de Status" />
            <p className="text-[13px] text-muted-foreground">A API utiliza os seguintes status internos:</p>
            <div className="rounded-xl border border-border/30 overflow-hidden my-3">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-muted/20 border-b border-border/20">
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Status Gateway</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Status Interno</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["waiting_payment", "pending", "Aguardando pagamento do PIX", "warn"],
                    ["pending", "pending", "Processando", "warn"],
                    ["authorized", "pending", "Autorizado, aguardando captura", "warn"],
                    ["approved / paid", "completed", "Pagamento confirmado", "success"],
                    ["refused / failed", "failed", "Pagamento recusado", "error"],
                    ["cancelled", "cancelled", "Cancelado", "error"],
                    ["refunded", "refunded", "Reembolsado", "error"],
                    ["chargeback", "chargeback", "Chargeback recebido", "error"],
                    ["in_protest", "dispute", "Disputa / mediação", "warn"],
                  ].map(([gw, internal, desc, variant]) => (
                    <tr key={gw} className="border-t border-border/10 hover:bg-muted/5 transition-colors">
                      <td className="p-3 font-mono text-muted-foreground text-[11px]">{gw}</td>
                      <td className="p-3"><Badge variant={variant as "success" | "error" | "warn"}>{internal}</Badge></td>
                      <td className="p-3 text-muted-foreground/80">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout variant="info">
              <strong>Proteção contra downgrade:</strong> Uma vez que a transação atinge um status final (<code className="mono-inline">completed</code>, <code className="mono-inline">refunded</code>, <code className="mono-inline">chargeback</code>), ela não pode voltar para um status anterior. Webhooks com status inferior são ignorados automaticamente.
            </Callout>
          </section>

          {/* 7. ERROS */}
          <section id="errors" ref={registerRef("errors")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="7" title="Códigos de Erro HTTP" />
            <div className="rounded-xl border border-border/30 overflow-hidden my-3">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-muted/20 border-b border-border/20">
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Código</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Significado</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["200", "Sucesso", "Processar resposta normalmente"],
                    ["400", "Campos obrigatórios faltando", "Verificar body da request"],
                    ["401", "Token ausente ou assinatura inválida", "Verificar Authorization ou secret"],
                    ["403", "Acesso negado", "Usar token de admin para rotas restritas"],
                    ["404", "Recurso não encontrado", "Verificar ID enviado"],
                    ["409", "Transação duplicada", "Usar checkoutSessionId para recuperar"],
                    ["500", "Erro interno", "Tentar novamente. Se persistir, contate suporte"],
                  ].map(([code, meaning, action]) => (
                    <tr key={code} className="border-t border-border/10 hover:bg-muted/5 transition-colors">
                      <td className="p-3"><Badge variant={Number(code) >= 400 ? "error" : "success"}>{code}</Badge></td>
                      <td className="p-3 font-medium text-foreground/80">{meaning}</td>
                      <td className="p-3 text-muted-foreground/80">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="text-[13px] font-semibold text-foreground">Formato de Erro</h4>
            <CopyBlock code={`{
  "success": false,
  "error": "Missing required fields"
}`} language="json" />
          </section>

          {/* 8. GUIA DE INTEGRAÇÃO */}
          <section id="integration" ref={registerRef("integration")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="8" title="Guia de Integração Completo" />
            <p className="text-[13px] text-muted-foreground">Passo a passo para integrar PIX no seu site, app ou plataforma.</p>

            <StepBlock step={1} title="Criar produto na plataforma">
              <p className="text-[12px] text-muted-foreground">
                Cadastre seu produto/plano no painel Hotzfy. Anote o <code className="mono-inline">productId</code> (UUID).
              </p>
            </StepBlock>

            <StepBlock step={2} title="Gerar cobrança PIX">
              <p className="text-[12px] text-muted-foreground mb-2">Quando o usuário clicar em "Depositar" ou "Pagar":</p>
              <CopyBlock code={`const response = await fetch('${BASE_URL}/podpay-create-transaction', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer SEU_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    productId: 'uuid-do-produto',
    paymentMethod: 'pix',
    customerName: 'Nome do Cliente',
    customerEmail: 'cliente@email.com',
    customerDocument: '12345678900',
    checkoutSessionId: 'session-unica-123',
  }),
});

const { data } = await response.json();
// data.pix.qrCode → imagem QR Code (base64)
// data.pix.qrCodeText → código copia-e-cola`} language="javascript" />
            </StepBlock>

            <StepBlock step={3} title="Exibir QR Code para o usuário">
              <CopyBlock code={`<img src="{data.pix.qrCode}" alt="QR Code PIX" />
<input value="{data.pix.qrCodeText}" readonly />
<button onclick="navigator.clipboard.writeText(qrCodeText)">
  Copiar código PIX
</button>`} language="html" />
            </StepBlock>

            <StepBlock step={4} title="Configurar Webhook de confirmação">
              <p className="text-[12px] text-muted-foreground mb-2">Configure sua URL em <strong>Vendas → Webhooks</strong>:</p>
              <CopyBlock code={`app.post('/webhook/hotzfy', (req, res) => {
  // 1. Validar assinatura HMAC
  // 2. Verificar evento
  if (req.body.event === 'payment.completed') {
    const { transaction_id } = req.body.data;
    // 3. Creditar saldo / liberar acesso
    creditUserBalance(transaction_id);
  }
  res.json({ received: true });
});`} language="javascript" />
            </StepBlock>

            <StepBlock step={5} title="Polling (alternativa ao webhook)">
              <p className="text-[12px] text-muted-foreground">
                Se preferir, faça polling no status da transação após receber o <code className="mono-inline">transactionId</code>.
              </p>
            </StepBlock>

            <Callout variant="success" icon={Check}>
              <strong>Recomendação:</strong> Use webhooks como método principal e polling como fallback. Webhooks são mais rápidos e eficientes.
            </Callout>
          </section>

          {/* 9. TAXAS */}
          <section id="fees" ref={registerRef("fees")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="9" title="Taxas" />
            <div className="rounded-xl border border-border/30 overflow-hidden my-3">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-muted/20 border-b border-border/20">
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Operação</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Taxa</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] uppercase tracking-wider">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["PIX Cash-In", "Taxa % + taxa fixa", "Configurável pelo admin"],
                    ["PIX Cash-Out (Saque)", "R$ 5,00 fixo", "Deduzido automaticamente"],
                  ].map(([op, taxa, det]) => (
                    <tr key={op} className="border-t border-border/10 hover:bg-muted/5 transition-colors">
                      <td className="p-3 font-medium text-foreground/80">{op}</td>
                      <td className="p-3 font-mono text-primary font-semibold text-[11px]">{taxa}</td>
                      <td className="p-3 text-muted-foreground/80">{det}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-muted-foreground">
              As taxas são calculadas automaticamente e descontadas no campo <code className="mono-inline">net_amount</code> da transação.
            </p>
          </section>

          {/* 10. SEGURANÇA */}
          <section id="security" ref={registerRef("security")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="10" title="Rate Limits & Segurança" />
            <div className="space-y-2 ml-1">
              {[
                { label: "Rate Limit", desc: "100 requisições por minuto por IP" },
                { label: "SSL/TLS", desc: "Todas as requisições devem usar HTTPS" },
                { label: "Idempotência", desc: "Use checkoutSessionId para evitar cobranças duplicadas" },
                { label: "Webhook Security", desc: "Validação HMAC-SHA256 obrigatória com comparação em tempo constante" },
                { label: "Tokens", desc: "Nunca exponha no frontend. Use apenas server-to-server" },
                { label: "IP Logging", desc: "Envie o IP do pagador no campo ip para auxílio antifraude" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 py-2">
                  <Shield className="h-3.5 w-3.5 text-primary/50 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-muted-foreground"><strong className="text-foreground">{item.label}:</strong> {item.desc}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </PageShell>
  );
}

/* ─── Sub-components ─── */
function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-border/20">
      <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
        <span className="text-[12px] font-bold text-primary-foreground">{number}</span>
      </div>
      <h2 className="text-[16px] font-bold text-foreground tracking-tight">{title}</h2>
    </div>
  );
}

function StepBlock({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-10 pb-6 border-l-2 border-border/20 ml-3 last:border-l-0 last:pb-0">
      <div className="absolute -left-[13px] top-0 h-6 w-6 rounded-full gradient-primary flex items-center justify-center shadow-sm">
        <span className="text-[10px] font-bold text-primary-foreground">{step}</span>
      </div>
      <h4 className="text-[13px] font-semibold text-foreground mb-2">{title}</h4>
      {children}
    </div>
  );
}

function WebhookCodeExamples() {
  const [tab, setTab] = useState<"node" | "python" | "php">("node");
  const [copied, setCopied] = useState(false);

  const codes: Record<string, string> = {
    node: `const crypto = require('crypto');

function verifyWebhookSignature(rawBody, signature, secret) {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(computed, 'hex')
  );
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-podpay-signature'];
  const isValid = verifyWebhookSignature(
    req.rawBody, signature, 'SEU_SECRET'
  );
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const { event, data } = req.body;
  
  switch (event) {
    case 'payment.completed':
      // Liberar acesso ao produto
      break;
    case 'payment.refunded':
      // Revogar acesso
      break;
  }
  
  res.json({ received: true });
});`,
    python: `import hmac, hashlib

def verify_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    computed = hmac.new(
        secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, signature)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('x-podpay-signature')
    if not verify_signature(request.data, signature, 'SEU_SECRET'):
        return jsonify(error='Invalid signature'), 401
    
    payload = request.json
    event = payload['event']
    
    if event == 'payment.completed':
        # Liberar acesso
        pass
    
    return jsonify(received=True)`,
    php: `<?php
$rawBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_PODPAY_SIGNATURE'] ?? '';
$secret = 'SEU_SECRET';

$computed = hash_hmac('sha256', $rawBody, $secret);

if (!hash_equals($computed, $signature)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

$payload = json_decode($rawBody, true);

switch ($payload['event']) {
    case 'payment.completed':
        // Liberar acesso
        break;
    case 'payment.refunded':
        // Revogar acesso
        break;
}

echo json_encode(['received' => true]);
?>`,
  };

  const copy = () => { navigator.clipboard.writeText(codes[tab]); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="rounded-xl border border-border/30 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/20 bg-muted/5 px-4 py-2">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/20">
          {(["node", "python", "php"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all",
                tab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground/50 hover:text-foreground"
              )}
            >
              {t === "node" ? "Node.js" : t === "python" ? "Python" : "PHP"}
            </button>
          ))}
        </div>
        <button onClick={copy} className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-primary transition-colors">
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[11px] font-mono text-foreground/70 leading-relaxed max-h-[400px] overflow-y-auto">
        <code>{codes[tab]}</code>
      </pre>
    </div>
  );
}
