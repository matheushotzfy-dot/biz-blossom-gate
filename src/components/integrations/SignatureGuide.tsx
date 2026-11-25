import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Copy, ShieldCheck } from "lucide-react";
import { copyText } from "@/components/seller-ui/copy";
import { cn } from "@/lib/utils";
import { RETRY_PLAN } from "./webhookMeta";

export const VERIFY_SNIPPET = `import crypto from "node:crypto";

// rawBody: o corpo exatamente como chegou, antes de virar objeto
export function isFromVemprapay(rawBody, signatureHeader, secret) {
  const parts = Object.fromEntries(signatureHeader.split(",").map((p) => p.split("=")));
  const expected = crypto.createHmac("sha256", secret).update(\`\${parts.t}.\${rawBody}\`).digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  const a = Buffer.from(parts.v1 ?? "");
  const b = Buffer.from(expected);
  return fresh && a.length === b.length && crypto.timingSafeEqual(a, b);
}`;

const HEADERS: Array<[string, string]> = [
  ["X-Venxpay-Signature", "t=<hora>,v1=<assinatura>"],
  ["X-Venxpay-Event", "Nome do evento, como payment.approved"],
  ["X-Venxpay-Delivery", "ID da entrega, igual em todas as tentativas"],
  ["X-Venxpay-Timestamp", "Hora do envio em segundos"],
];

export function SignatureGuide() {
  const [open, setOpen] = useState(false);
  return (
    <section className="vp-sheet overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="sig-guide" className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-7">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><ShieldCheck className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-foreground">Para quem programa: conferir a assinatura</span>
          <span className="block text-[13.5px] text-muted-foreground">Cada envio leva uma assinatura feita com a chave do endpoint. Confira antes de confiar nos dados.</span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      {open && (
        <div id="sig-guide" className="space-y-5 border-t border-border px-5 py-5 sm:px-7">
          <div>
            <h3 className="mb-2 text-[14px] font-bold text-foreground">Cabeçalhos de cada chamada</h3>
            <dl className="divide-y divide-border overflow-hidden rounded-[16px] border border-border">
              {HEADERS.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-0.5 px-4 py-2.5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                  <dt className="break-all font-mono text-[12.5px] font-semibold text-foreground">{k}</dt>
                  <dd className="text-[13.5px] text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-[14px] font-bold text-foreground">Exemplo em Node.js</h3>
              <button type="button" onClick={() => { void copyText(VERIFY_SNIPPET, "Código copiado."); }} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"><Copy className="h-3.5 w-3.5" />Copiar</button>
            </div>
            <pre tabIndex={0} className="max-h-72 overflow-auto rounded-[16px] bg-muted px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/90">{VERIFY_SNIPPET}</pre>
          </div>
          <ul className="space-y-1.5 text-[13.5px] leading-snug text-muted-foreground">
            <li>Responda com status 2xx em até 10 segundos. Qualquer outra resposta conta como falha.</li>
            <li>Se falhar, tentamos de novo até 5 vezes, esperando {RETRY_PLAN}.</li>
            <li>Pode chegar o mesmo evento mais de uma vez. Use o ID da entrega para ignorar repetidos.</li>
            <li>Testes chegam com <span className="font-mono">"test": true</span> no corpo. Ignore esses no seu sistema de pedidos.</li>
          </ul>
          <Link to="/integracoes?tab=api" className="inline-block text-[13.5px] font-semibold text-primary hover:underline">Ver a documentação completa</Link>
        </div>
      )}
    </section>
  );
}
