import { useState } from "react";
import DOMPurify from "dompurify";
import { BookOpen, ChevronDown, ChevronRight, Shield, Zap, Code2, Terminal, Globe, Lock, ExternalLink } from "lucide-react";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "sua-api"}.supabase.co/functions/v1`;

const sections = [
  { id: "intro", title: "Introdução", icon: Globe, content: `A API Hotzfy permite integrar pagamentos PIX, Cartão e Boleto para seus infoprodutos.\n\n**Base URL:** \`${BASE_URL}\`\n\n**Autenticação:** Header \`Authorization: Bearer SEU_TOKEN\`` },
  { id: "pix-cashin", title: "PIX Cash-In", icon: Terminal, content: `### POST /pix/cashIn\n\n\`\`\`json\n{"amount": 150.00, "customer": {"name": "João", "document": "123...", "email": "j@e.com"}}\n\`\`\`\n\nRetorna QR Code + copiar-cola PIX.` },
  { id: "pix-cashout", title: "PIX Cash-Out", icon: Terminal, content: `### POST /pix/cashOut\n\n\`\`\`json\n{"amount": 100.00, "pix_key": "email@ex.com", "pix_key_type": "email"}\n\`\`\`\n\nTaxa: R$ 5,00 por operação.` },
  { id: "card", title: "Cartão de Crédito", icon: Terminal, content: `### POST /payments/card\n\nSuporta parcelamento em até 12x.\nTaxa: 4,99% + R$ 2,50 por transação.` },
  { id: "boleto", title: "Boleto Bancário", icon: Terminal, content: `### POST /payments/boleto\n\nBoleto com vencimento customizável.\nTaxa: R$ 3,49 fixo.` },
  { id: "webhooks", title: "Webhooks", icon: Zap, content: `Eventos: payment.approved, payment.failed, payment.refunded, chargeback.received, payout.completed, payout.failed` },
  { id: "taxas", title: "Taxas", icon: Lock, content: `PIX: 1,99% | Cartão: 4,99% + R$ 2,50 | Boleto: R$ 3,49 | Saque: R$ 5,00` },
  { id: "erros", title: "Códigos de Erro", icon: Shield, content: `200 Sucesso | 201 Criado | 400 Inválido | 401 Não autorizado | 404 Não encontrado | 429 Rate limit | 500 Erro interno\n\nRate limit: 100 req/min.` },
];

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ["h3", "p", "br", "strong", "em", "code", "pre", "span", "div"],
  ALLOWED_ATTR: ["class"],
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style"],
  FORBID_ATTR: ["onclick", "onerror", "onload", "onmouseover", "style"],
};

function renderMarkdown(content: string): string {
  const html = content
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, _lang, code) =>
      `<pre class="rounded-lg p-4 overflow-x-auto text-xs font-mono my-3 bg-muted border border-border text-foreground/80"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`
    )
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary font-semibold">$1</code>')
    .replace(/### (.+)/g, '<h3 class="text-foreground font-bold text-sm mt-4 mb-2">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground/80">$1</strong>')
    .replace(/\n/g, "<br/>");
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as string;
}

export default function Documentacao() {
  const [openSection, setOpenSection] = useState<string | null>("intro");
  const navigate = useNavigate();

  const featureTone: Record<"primary" | "success" | "info", { bg: string; text: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary" },
    success: { bg: "bg-success/10", text: "text-success" },
    info: { bg: "bg-info/10", text: "text-info" },
  };

  return (
    <PageShell>
      <PageTitle icon={<BookOpen className="h-6 w-6" />} title="API Documentation" subtitle="Integre pagamentos via REST API" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Shield, label: "Segurança", value: "SSL + Token Auth", color: "primary" as const },
          { icon: Zap, label: "Latência", value: "< 200ms", color: "success" as const },
          { icon: Code2, label: "Formato", value: "REST / JSON", color: "info" as const },
        ].map((item) => (
          <Panel key={item.label}>
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${featureTone[item.color].bg}`}>
                <item.icon className={`h-4 w-4 ${featureTone[item.color].text}`} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">{item.label}</p>
                <p className="text-sm font-bold text-foreground">{item.value}</p>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <div className="space-y-2">
        {sections.map((section) => (
          <Panel key={section.id} className="p-0 overflow-hidden">
            <button
              onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left"
            >
              <span className="font-bold text-sm text-foreground flex items-center gap-2.5">
                <section.icon className="h-4 w-4 text-primary" />
                {section.title}
              </span>
              {openSection === section.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {openSection === section.id && (
              <div className="px-4 pb-4 border-t border-border">
                <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }} />
              </div>
            )}
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
