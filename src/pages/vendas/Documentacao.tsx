import { useState } from "react";
import DOMPurify from "dompurify";
import { BookOpen, Shield, Zap, Code2, Terminal, Globe, Lock, ExternalLink, Copy, Check, ChevronRight, Hash } from "lucide-react";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "sua-api"}.supabase.co/functions/v1`;

interface DocSection {
  id: string;
  title: string;
  icon: typeof Globe;
  content: string;
}

const sections: DocSection[] = [
  {
    id: "intro", title: "O que é a API Hotzfy?", icon: Globe,
    content: `A Hotzfy é uma plataforma de pagamentos moderna voltada para negócios digitais, que simplifica a gestão e o recebimento de transações online com segurança, agilidade e foco na experiência do usuário.\n\nA API Hotzfy é uma API REST que permite integrar sua aplicação com a plataforma, possibilitando o gerenciamento via código de produtos, ofertas, pedidos e outras funcionalidades.`,
  },
  {
    id: "base-url", title: "URL Base", icon: Terminal,
    content: `Todas as requisições devem ser feitas utilizando esta URL base:\n\n\`\`\`\n${BASE_URL}\n\`\`\``,
  },
  {
    id: "auth", title: "Autenticação", icon: Lock,
    content: `Todas as requisições devem incluir o header de autenticação:\n\n\`\`\`\nAuthorization: Bearer SEU_TOKEN\n\`\`\`\n\nO token pode ser obtido na seção **Configurações → API** do seu painel.`,
  },
  {
    id: "pix-cashin", title: "PIX Cash-In", icon: Terminal,
    content: `### POST /podpay-create-transaction\n\nCria uma cobrança PIX com QR Code.\n\n**Request Body:**\n\`\`\`json\n{\n  "amount": 150.00,\n  "payment_method": "pix",\n  "customer": {\n    "name": "João Silva",\n    "document": "12345678900",\n    "email": "joao@email.com"\n  },\n  "product_id": "uuid-do-produto"\n}\n\`\`\`\n\n**Response (200):**\n\`\`\`json\n{\n  "transaction_id": "uuid",\n  "qr_code": "00020126...",\n  "qr_code_url": "https://...",\n  "expires_at": "2024-01-01T00:30:00Z"\n}\n\`\`\``,
  },
  {
    id: "pix-cashout", title: "PIX Cash-Out (Saques)", icon: Terminal,
    content: `### POST /podpay-cashout\n\nRealiza um saque PIX para a chave cadastrada.\n\n**Request Body:**\n\`\`\`json\n{\n  "amount": 100.00,\n  "pix_key": "email@exemplo.com",\n  "pix_key_type": "email"\n}\n\`\`\`\n\n**Taxa:** R$ 5,00 por operação.\n\n**Response (200):**\n\`\`\`json\n{\n  "withdrawal_id": "uuid",\n  "status": "processing",\n  "net_amount": 95.00\n}\n\`\`\``,
  },
  {
    id: "card", title: "Cartão de Crédito", icon: Terminal,
    content: `### POST /podpay-create-transaction\n\nProcessa pagamento com cartão de crédito.\n\n**Request Body:**\n\`\`\`json\n{\n  "amount": 297.00,\n  "payment_method": "credit_card",\n  "installments": 3,\n  "card": {\n    "number": "4111111111111111",\n    "holder_name": "JOAO SILVA",\n    "exp_month": "12",\n    "exp_year": "2026",\n    "cvv": "123"\n  },\n  "customer": {\n    "name": "João Silva",\n    "document": "12345678900",\n    "email": "joao@email.com"\n  }\n}\n\`\`\`\n\nSuporta parcelamento em até 12x.\n**Taxa:** 4,99% + R$ 2,50 por transação.`,
  },
  {
    id: "boleto", title: "Boleto Bancário", icon: Terminal,
    content: `### POST /podpay-create-transaction\n\nGera um boleto bancário.\n\n**Request Body:**\n\`\`\`json\n{\n  "amount": 197.00,\n  "payment_method": "boleto",\n  "due_date": "2024-02-15",\n  "customer": {\n    "name": "João Silva",\n    "document": "12345678900",\n    "email": "joao@email.com"\n  }\n}\n\`\`\`\n\n**Taxa:** R$ 3,49 fixo por boleto.`,
  },
  {
    id: "webhooks", title: "Webhooks (Postback)", icon: Zap,
    content: `### POST /podpay-postback\n\nReceba notificações em tempo real sobre mudanças de status.\n\n**Eventos disponíveis:**\n- \`payment.approved\` — Pagamento confirmado\n- \`payment.failed\` — Pagamento falhou\n- \`payment.refunded\` — Estorno realizado\n- \`chargeback.received\` — Chargeback recebido\n- \`payout.completed\` — Saque concluído\n- \`payout.failed\` — Saque falhou\n\n**Payload exemplo:**\n\`\`\`json\n{\n  "event": "payment.approved",\n  "transaction_id": "uuid",\n  "amount": 150.00,\n  "payment_method": "pix",\n  "customer_email": "joao@email.com",\n  "timestamp": "2024-01-01T12:00:00Z"\n}\n\`\`\``,
  },
  {
    id: "taxas", title: "Taxas", icon: Shield,
    content: `| Método | Taxa |\n|--------|------|\n| PIX | 1,99% |\n| Cartão de Crédito | 4,99% + R$ 2,50 |\n| Boleto Bancário | R$ 3,49 (fixo) |\n| Saque PIX | R$ 5,00 (fixo) |\n\nAs taxas são descontadas automaticamente do valor bruto da transação.`,
  },
  {
    id: "errors", title: "Códigos de Status HTTP", icon: Shield,
    content: `| Código | Descrição |\n|--------|----------|\n| \`200\` | Sucesso |\n| \`201\` | Recurso criado |\n| \`400\` | Requisição inválida |\n| \`401\` | Não autorizado |\n| \`404\` | Recurso não encontrado |\n| \`429\` | Rate limit excedido |\n| \`500\` | Erro interno do servidor |\n\n**Rate limit:** 100 requisições por minuto.`,
  },
];

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ["h3", "p", "br", "strong", "em", "code", "pre", "span", "div", "table", "thead", "tbody", "tr", "th", "td", "ul", "li"],
  ALLOWED_ATTR: ["class"],
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style"],
  FORBID_ATTR: ["onclick", "onerror", "onload", "onmouseover", "style"],
};

function renderMarkdown(content: string): string {
  let html = content;

  // Tables
  html = html.replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/g, (_, header, body) => {
    const headers = header.split("|").map((h: string) => h.trim()).filter(Boolean);
    const rows = body.trim().split("\n").map((row: string) =>
      row.split("|").map((c: string) => c.trim()).filter(Boolean)
    );
    return `<table class="w-full text-sm my-4 border-collapse"><thead><tr>${headers.map((h: string) =>
      `<th class="text-left p-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/60 bg-muted/20">${h}</th>`
    ).join("")}</tr></thead><tbody>${rows.map((row: string[]) =>
      `<tr class="border-b border-border/30">${row.map((c: string) =>
        `<td class="p-3 text-foreground/80">${c}</td>`
      ).join("")}</tr>`
    ).join("")}</tbody></table>`;
  });

  // Code blocks
  html = html.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, _lang, code) =>
    `<pre class="rounded-xl p-4 overflow-x-auto text-xs font-mono my-3 bg-muted/40 border border-border/50 text-foreground/80 leading-relaxed"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md text-xs font-mono bg-primary/8 text-primary font-semibold border border-primary/10">$1</code>');

  // Headers
  html = html.replace(/### (.+)/g, '<h3 class="text-foreground font-display font-bold text-base mt-6 mb-3">$1</h3>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');

  // List items
  html = html.replace(/^- (.+)$/gm, '<li class="flex items-start gap-2 py-1"><span class="text-primary mt-1.5 text-[8px]">●</span><span>$1</span></li>');
  html = html.replace(/(<li[\s\S]*?<\/li>\n?)+/g, '<ul class="my-3 space-y-0.5">$&</ul>');

  // Line breaks
  html = html.replace(/\n\n/g, '<br/><br/>');
  html = html.replace(/\n/g, "<br/>");

  return DOMPurify.sanitize(html, PURIFY_CONFIG) as string;
}

export default function Documentacao() {
  const [activeSection, setActiveSection] = useState("intro");
  const navigate = useNavigate();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <PageShell>
      <PageTitle icon={<BookOpen className="h-6 w-6" />} title="API Documentation" subtitle="Integre pagamentos via REST API" />

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Shield, label: "Segurança", value: "SSL + Token Auth", color: "text-primary", bg: "bg-primary/10" },
          { icon: Zap, label: "Latência", value: "< 200ms", color: "text-success", bg: "bg-success/10" },
          { icon: Code2, label: "Formato", value: "REST / JSON", color: "text-info", bg: "bg-info/10" },
        ].map((item) => (
          <Panel key={item.label}>
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${item.bg}`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">{item.label}</p>
                <p className="text-sm font-bold text-foreground">{item.value}</p>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {/* Main docs layout — sidebar + content like Cakto */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar navigation */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-3">Nesta página</p>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  activeSection === section.id
                    ? "text-primary bg-primary/5 border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-2 border-transparent"
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile nav — horizontal scrollable */}
        <div className="lg:hidden overflow-x-auto -mx-1 px-1 pb-2">
          <div className="flex gap-1.5">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  activeSection === section.id
                    ? "text-primary bg-primary/10 border border-primary/20"
                    : "text-muted-foreground bg-muted/20 border border-border/40 hover:bg-muted/40"
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="min-w-0">
          {sections.map((section) => (
            <div
              key={section.id}
              className={activeSection === section.id ? "animate-fade-in" : "hidden"}
            >
              <Panel className="p-8">
                {/* Section header */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/40">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <section.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-xl font-display font-bold text-foreground">{section.title}</h2>
                </div>

                {/* Rendered content */}
                <div
                  className="text-sm text-muted-foreground leading-relaxed prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
                />
              </Panel>
            </div>
          ))}

          {/* Link para documentação completa */}
          <Panel className="p-5 mt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm text-foreground">Precisa de mais detalhes?</p>
                <p className="text-xs text-muted-foreground mt-1">Documentação completa com exemplos em Node.js, Python e PHP.</p>
              </div>
              <Button onClick={() => navigate("/vendas/documentacao/completa")} className="gap-2 shrink-0 gradient-primary text-primary-foreground">
                <ExternalLink className="h-4 w-4" />
                Ver Documentação Completa
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
