import { useState } from "react";
import DOMPurify from "dompurify";
import { BookOpen, ChevronDown, ChevronRight, Shield, Zap, Code2 } from "lucide-react";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "sua-api"}.supabase.co/functions/v1`;

const sections = [
  { id: "intro", title: "Introdução", content: `A API PayGate permite integrar pagamentos PIX, Cartão e Boleto.\n\n**Base URL:** \`${BASE_URL}\`\n\n**Autenticação:** Header \`Authorization: Bearer SEU_TOKEN\`` },
  { id: "pix-cashin", title: "PIX Cash-In (Receber)", content: `### POST /pix/cashIn\n\n\`\`\`json\n{"amount": 150.00, "customer": {"name": "João", "document": "123...", "email": "j@e.com"}}\n\`\`\`\n\nRetorna QR Code + copiar-cola PIX.` },
  { id: "pix-cashout", title: "PIX Cash-Out (Enviar)", content: `### POST /pix/cashOut\n\n\`\`\`json\n{"amount": 100.00, "pix_key": "email@ex.com", "pix_key_type": "email"}\n\`\`\`\n\nTaxa: R$ 5,00 por operação.` },
  { id: "card", title: "Cartão de Crédito", content: `### POST /payments/card\n\nSuporta parcelamento em até 12x.\nTaxa: 4,99% + R$ 2,50 por transação.` },
  { id: "boleto", title: "Boleto Bancário", content: `### POST /payments/boleto\n\nBoleto com vencimento customizável.\nTaxa: R$ 3,49 fixo.` },
  { id: "webhooks", title: "Webhooks", content: `Eventos: payment.approved, payment.failed, payment.refunded, chargeback.received, payout.completed, payout.failed` },
  { id: "taxas", title: "Taxas", content: `PIX: 1,99% | Cartão: 4,99% + R$ 2,50 | Boleto: R$ 3,49 | Saque: R$ 5,00` },
  { id: "erros", title: "Códigos de Erro", content: `200 Sucesso | 201 Criado | 400 Inválido | 401 Não autorizado | 404 Não encontrado | 429 Rate limit | 500 Erro interno\n\nRate limit: 100 req/min.` },
];

// Strict DOMPurify config — blocks scripts, event handlers, iframes, dangerous styles
const PURIFY_CONFIG = {
  ALLOWED_TAGS: ["h3", "p", "br", "strong", "em", "code", "pre", "span", "div"],
  ALLOWED_ATTR: ["class"],
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style"],
  FORBID_ATTR: ["onclick", "onerror", "onload", "onmouseover", "style"],
};

function renderMarkdown(content: string): string {
  const html = content
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, _lang, code) =>
      `<pre class="rounded-xl p-4 overflow-x-auto text-[11px] font-mono my-3 bg-muted/50 border border-border text-foreground/70"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`
    )
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded text-[11px] font-mono bg-primary/10 text-primary">$1</code>')
    .replace(/### (.+)/g, '<h3 class="text-foreground font-bold text-[14px] mt-4 mb-2">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground/70">$1</strong>')
    .replace(/\n/g, "<br/>");

  return DOMPurify.sanitize(html, PURIFY_CONFIG) as string;
}

export default function Documentacao() {
  const [openSection, setOpenSection] = useState<string | null>("intro");

  return (
    <PageShell>
      <PageTitle icon={<BookOpen className="h-6 w-6" />} title="API Docs" subtitle="Integre pagamentos PIX, Cartão e Boleto" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[{ icon: Shield, label: "Segurança", value: "SSL + Token Auth" }, { icon: Zap, label: "Latência", value: "< 200ms" }, { icon: Code2, label: "Formato", value: "REST / JSON" }].map((item) => (
          <Panel key={item.label}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary"><item.icon className="h-5 w-5" /></div>
              <div><p className="text-[11px] text-muted-foreground">{item.label}</p><p className="text-[14px] font-bold text-foreground">{item.value}</p></div>
            </div>
          </Panel>
        ))}
      </div>

      <div className="space-y-1.5">
        {sections.map((section) => (
          <Panel key={section.id} className="p-0">
            <button onClick={() => setOpenSection(openSection === section.id ? null : section.id)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left">
              <span className="font-bold text-[13px] text-foreground flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-primary" />{section.title}</span>
              {openSection === section.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {openSection === section.id && (
              <div className="px-4 pb-4 border-t border-border">
                <div
                  className="mt-3 text-[13px] text-muted-foreground whitespace-pre-wrap leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
                />
              </div>
            )}
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
