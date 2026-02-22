import { useState } from "react";
import { BookOpen, Copy, ChevronDown, ChevronRight, Shield, Zap, Code2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "sua-api"}.supabase.co/functions/v1`;

const sections = [
  {
    id: "intro",
    title: "Introdução",
    content: `A API PayGate permite integrar pagamentos PIX, Cartão e Boleto diretamente na sua aplicação. Suporta cash-in (recebimentos) e cash-out (saques/transferências via PIX).

**Base URL:** \`${BASE_URL}\`

**Autenticação:** Todas as requisições devem incluir o header:
\`\`\`
Authorization: Bearer SEU_API_TOKEN
Content-Type: application/json
\`\`\``,
  },
  {
    id: "pix-cashin",
    title: "PIX Cash-In (Receber)",
    content: `### Criar Cobrança PIX

\`\`\`http
POST /pix/cashIn
\`\`\`

**Body:**
\`\`\`json
{
  "amount": 150.00,
  "description": "Pagamento do produto X",
  "customer": {
    "name": "João Silva",
    "document": "12345678900",
    "email": "joao@email.com"
  },
  "expiresIn": 3600,
  "webhook_url": "https://seusite.com/webhook"
}
\`\`\`

**Resposta (201):**
\`\`\`json
{
  "id": "txn_abc123",
  "status": "pending",
  "amount": 150.00,
  "pix": {
    "qrcode": "00020126580014br.gov.bcb.pix...",
    "qrcode_base64": "data:image/png;base64,...",
    "expires_at": "2026-02-22T12:00:00Z"
  },
  "created_at": "2026-02-22T11:00:00Z"
}
\`\`\``,
  },
  {
    id: "pix-cashout",
    title: "PIX Cash-Out (Enviar/Sacar)",
    content: `### Realizar Transferência PIX

\`\`\`http
POST /pix/cashOut
\`\`\`

**Body:**
\`\`\`json
{
  "amount": 100.00,
  "pix_key": "email@exemplo.com",
  "pix_key_type": "email",
  "description": "Saque para conta"
}
\`\`\`

**Resposta (201):**
\`\`\`json
{
  "id": "payout_xyz789",
  "status": "processing",
  "amount": 100.00,
  "fee": 5.00,
  "net_amount": 95.00,
  "pix_key": "email@exemplo.com",
  "created_at": "2026-02-22T11:00:00Z"
}
\`\`\`

**Status possíveis:** \`processing\`, \`completed\`, \`failed\``,
  },
  {
    id: "card",
    title: "Cartão de Crédito",
    content: `### Criar Pagamento com Cartão

\`\`\`http
POST /payments/card
\`\`\`

**Body:**
\`\`\`json
{
  "amount": 299.90,
  "installments": 3,
  "card": {
    "number": "4111111111111111",
    "holder_name": "JOAO SILVA",
    "exp_month": "12",
    "exp_year": "2028",
    "cvv": "123"
  },
  "customer": {
    "name": "João Silva",
    "document": "12345678900",
    "email": "joao@email.com"
  },
  "product_id": "prod_abc123"
}
\`\`\`

**Resposta (201):**
\`\`\`json
{
  "id": "txn_card456",
  "status": "approved",
  "amount": 299.90,
  "installments": 3,
  "installment_value": 102.63,
  "fee": {
    "percentage": 4.99,
    "fixed": 2.50,
    "total": 17.47
  },
  "net_amount": 282.43
}
\`\`\``,
  },
  {
    id: "boleto",
    title: "Boleto Bancário",
    content: `### Gerar Boleto

\`\`\`http
POST /payments/boleto
\`\`\`

**Body:**
\`\`\`json
{
  "amount": 500.00,
  "due_date": "2026-03-01",
  "customer": {
    "name": "João Silva",
    "document": "12345678900",
    "email": "joao@email.com"
  }
}
\`\`\`

**Resposta (201):**
\`\`\`json
{
  "id": "txn_bol789",
  "status": "pending",
  "amount": 500.00,
  "boleto": {
    "barcode": "23793.38128...",
    "url": "https://boleto.paygate.com/..."
  },
  "due_date": "2026-03-01",
  "fee": 3.49
}
\`\`\``,
  },
  {
    id: "consultar",
    title: "Consultar Transação",
    content: `### Consultar Status

\`\`\`http
GET /transactions/{transaction_id}
\`\`\`

**Resposta (200):**
\`\`\`json
{
  "id": "txn_abc123",
  "status": "approved",
  "amount": 150.00,
  "payment_method": "pix",
  "fee_amount": 5.48,
  "net_amount": 144.52,
  "customer": {
    "name": "João Silva",
    "email": "joao@email.com"
  },
  "created_at": "2026-02-22T11:00:00Z",
  "paid_at": "2026-02-22T11:02:30Z"
}
\`\`\``,
  },
  {
    id: "webhooks",
    title: "Webhooks",
    content: `### Eventos Disponíveis

| Evento | Descrição |
|--------|-----------|
| \`payment.approved\` | Pagamento aprovado |
| \`payment.failed\` | Pagamento recusado |
| \`payment.refunded\` | Reembolso processado |
| \`payment.chargeback\` | Chargeback recebido |
| \`payout.completed\` | Saque/transferência concluído |
| \`payout.failed\` | Saque/transferência falhou |
| \`subscription.created\` | Assinatura criada |
| \`subscription.canceled\` | Assinatura cancelada |

### Payload do Webhook

\`\`\`json
{
  "event": "payment.approved",
  "data": {
    "id": "txn_abc123",
    "status": "approved",
    "amount": 150.00,
    "payment_method": "pix",
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com"
    }
  },
  "timestamp": "2026-02-22T11:02:30Z",
  "signature": "sha256=abc123..."
}
\`\`\`

**Validação de assinatura:** Use o \`secret\` configurado no webhook para validar o header \`X-Webhook-Signature\`.`,
  },
  {
    id: "taxas",
    title: "Taxas",
    content: `### Tabela de Taxas

| Método | Taxa |
|--------|------|
| PIX | 1,99% |
| Cartão de Crédito | 4,99% + R$ 2,50 |
| Boleto | R$ 3,49 fixo |
| Saque (Cash-Out) | R$ 5,00 fixo |

As taxas são descontadas automaticamente do valor líquido da transação.

**Exemplo:** Venda de R$ 100,00 no cartão
- Taxa: 4,99% × 100 + R$ 2,50 = R$ 7,49
- Líquido: R$ 92,51`,
  },
  {
    id: "erros",
    title: "Códigos de Erro",
    content: `### Códigos HTTP

| Código | Descrição |
|--------|-----------|
| \`200\` | Sucesso |
| \`201\` | Criado com sucesso |
| \`400\` | Requisição inválida |
| \`401\` | Não autorizado |
| \`403\` | Acesso negado |
| \`404\` | Não encontrado |
| \`422\` | Dados inválidos |
| \`429\` | Rate limit excedido |
| \`500\` | Erro interno |

**Rate Limit:** 100 requisições/minuto por API key.`,
  },
];

export default function Documentacao() {
  const [openSection, setOpenSection] = useState<string | null>("intro");

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copiado!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> Documentação da API
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Integre pagamentos PIX, Cartão e Boleto — Cash-In e Cash-Out</p>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Segurança</p>
            <p className="text-sm font-semibold">SSL + Token Auth</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Latência</p>
            <p className="text-sm font-semibold">&lt; 200ms média</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Formato</p>
            <p className="text-sm font-semibold">REST / JSON</p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.id} className="bg-card rounded-xl border border-border/50 overflow-hidden">
            <button
              onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
            >
              <span className="font-semibold text-sm flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full" />
                {section.title}
              </span>
              {openSection === section.id ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {openSection === section.id && (
              <div className="px-4 pb-4 border-t border-border/50">
                <div className="prose prose-invert prose-sm max-w-none mt-3">
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: section.content
                        .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
                          `<pre class="bg-muted/50 rounded-lg p-4 overflow-x-auto text-xs font-mono text-foreground border border-border/30 my-3"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`
                        )
                        .replace(/`([^`]+)`/g, '<code class="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono text-primary">$1</code>')
                        .replace(/### (.+)/g, '<h3 class="text-foreground font-semibold text-base mt-4 mb-2">$1</h3>')
                        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
                        .replace(/\|(.+)\|/g, (match) => {
                          const cells = match.split("|").filter(Boolean).map(c => c.trim());
                          if (cells.every(c => /^[-]+$/.test(c))) return "";
                          return `<div class="grid grid-cols-${cells.length} gap-2 py-1 border-b border-border/20 text-xs">${cells.map(c => `<span>${c}</span>`).join("")}</div>`;
                        })
                        .replace(/\n/g, "<br/>")
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
