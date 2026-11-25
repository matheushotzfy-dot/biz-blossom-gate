import { Plus } from "lucide-react";
import { PAYMENT_EVENT_EXAMPLE } from "./docs/docsData";

const STEPS = [
  "Cole a URL do seu servidor e escolha os eventos.",
  "Copie a chave de assinatura. Ela aparece inteira só uma vez.",
  "Envie um teste e veja aqui o que o seu servidor respondeu.",
];

/** Primeiro uso: mostra o que vai chegar (o evento real) em vez de uma tela vazia com um ícone. */
export function WebhookWelcome({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="vp-sheet overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="px-6 py-8 sm:px-9 sm:py-10">
          <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.025em] text-foreground sm:text-[30px]">Receba cada venda no seu sistema</h2>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">
            A cada pagamento, reembolso ou saque a gente envia um POST assinado para a URL que você cadastrar, e tenta de novo se ela não responder. Serve para o seu servidor, Zapier, Make ou n8n.
          </p>
          <ol className="mt-6 space-y-3.5">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-start gap-3.5">
                <span aria-hidden className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[12.5px] font-extrabold text-accent-foreground">{i + 1}</span>
                <span className="text-[14.5px] font-medium leading-snug text-foreground">{s}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="vp-cta mt-8" onClick={onCreate}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Criar endpoint</button>
        </div>
        <div className="min-w-0 bg-muted/60 px-6 py-8 sm:px-9 sm:py-10">
          <p className="mb-3 text-[13.5px] font-semibold text-muted-foreground">Assim chega um pagamento aprovado</p>
          <pre tabIndex={0} aria-label="Exemplo de evento payment.approved" className="max-h-[360px] overflow-auto rounded-[16px] bg-card px-5 py-4 font-mono text-[12.5px] leading-[1.7] text-foreground/90">{PAYMENT_EVENT_EXAMPLE}</pre>
        </div>
      </div>
    </section>
  );
}
