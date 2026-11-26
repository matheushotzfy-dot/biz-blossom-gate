import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SECURITY_POINTS } from "./landingData";
import { line } from "./lines";
import { Tight } from "./Tight";

const SAMPLE = [
  "{",
  '  "event": "payment.approved",',
  '  "created_at": "2026-11-24T21:10:32Z",',
  '  "data": {',
  '    "id": "b4b1c1e0-9f6a-4a2c-8f7f-1e2d3c4b5a6d",',
  '    "status": "completed",',
  '    "amount_cents": 19700,',
  '    "payment_method": "pix",',
  '    "customer": { "name": "Maria Souza", "email": "maria@exemplo.com" }',
  "  }",
  "}",
];

/** Pinta chaves, textos e números de uma linha de JSON. */
function Tint({ line }: { line: string }) {
  const out: ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(\b\d+\b)/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[3]) out.push(<span key={i++} className="n">{m[3]}</span>);
    else if (m[2]) out.push(<span key={i++}><span className="k">{m[1]}</span>{m[2]}</span>);
    else out.push(<span key={i++} className="s">{m[1]}</span>);
    last = m.index + m[0].length;
  }
  out.push(line.slice(last));
  return <>{out}</>;
}

const FACTS = [
  "Assinatura HMAC-SHA256 em todo envio",
  "Até 5 tentativas, com espera maior a cada falha",
  "Teste ao vivo e reenvio pelo painel",
  "Chaves de API com o segredo mostrado uma única vez",
];

export function SecuritySection() {
  return (
    <section id="seguranca" className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 className="lp-h2 max-w-[16ch] text-foreground"><Tight>Segurança que dá para conferir.</Tight></h2>
          <p className="max-w-[34rem] text-[17px] leading-[1.7] text-muted-foreground lg:justify-self-end">
            Sem selo inventado nem número bonito. Estas são as regras que o painel já aplica hoje, e você vê cada uma delas funcionando na sua conta.
          </p>
        </div>
        <dl className="lp-kit">
          {SECURITY_POINTS.map((s) => (
            <div key={s.t} className="lp-kit-item">
              <dt className="text-[1.1rem] font-extrabold tracking-[-0.025em] text-foreground">{s.t}</dt>
              <dd className="m-0 mt-1.5 text-[15.5px] leading-[1.65] text-muted-foreground">{s.d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 max-w-[44rem] text-[15px] leading-relaxed text-muted-foreground">
          Quer ver se a plataforma está no ar agora? A <Link to="/status" className="lp-link">página de status</Link> confere o servidor, o login e os pagamentos direto do seu navegador.
        </p>
      </div>
    </section>
  );
}

export function DevSection() {
  return (
    <section id="devs" className="bg-card py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div>
            <h2 className="lp-h2 max-w-[16ch] text-foreground">
              <Tight>O seu sistema fica sabendo no mesmo instante.</Tight>
            </h2>
            <p className="mt-6 max-w-[32rem] text-[17px] leading-[1.7] text-muted-foreground">
              Cada venda, reembolso e saque vira um webhook para o endereço que você escolher. Você valida a assinatura, atualiza o pedido e responde 200.
            </p>
            <ul className="m-0 mt-7 grid gap-3 p-0" style={{ listStyle: "none" }}>
              {FACTS.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[15.5px] font-semibold text-foreground">
                  <span aria-hidden className="lp-tick mt-[0.3rem]" />{f}
                </li>
              ))}
            </ul>
            <p className="mt-7 max-w-[32rem] text-[14.5px] leading-relaxed text-muted-foreground">
              A API para criar cobranças pelo seu código ainda não está aberta. Quando abrir, ela entra na documentação.
            </p>
            <Link to="/documentacao" className="lp-link mt-5 inline-block text-[16px]">Ler a documentação</Link>
          </div>

          <div className="lp-code" role="group" aria-label="Exemplo de webhook de pagamento aprovado">
            <div className="lp-line flex items-center justify-between gap-4 px-5 py-3.5" style={line("0 1px 0 hsl(220 16% 16%)")}>
              <span className="font-mono text-[12.5px] font-semibold" style={{ color: "hsl(218 14% 70%)" }}>POST seu-servidor.com.br/webhooks</span>
              <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: "hsl(152 45% 14%)", color: "hsl(150 80% 66%)" }}>Exemplo</span>
            </div>
            <pre tabIndex={0} aria-label="Cabeçalhos e corpo do webhook">
              <code>
                <span className="m">X-Venxpay-Event: </span><span className="s">payment.approved</span>{"\n"}
                <span className="m">X-Venxpay-Signature: </span><span className="s">t=1764019832,v1=9f2c…e41a</span>{"\n"}
                {"\n"}
                {SAMPLE.map((l, i) => <span key={i}><Tint line={l} />{"\n"}</span>)}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
