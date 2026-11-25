/**
 * Documentação da API (aba Integrações > Documentação e /documentacao, a versão pública).
 * Só descreve o que existe: os webhooks (eventos, formato e assinatura iguais aos do worker) e as chaves.
 * A API de cobranças aparece como prévia "Em breve" porque a função pix-api foi removida e ainda não voltou.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Webhook } from "lucide-react";
import { Seo } from "@/components/Seo";
import { PageHead } from "@/components/seller-ui/PageHead";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { StatusPill } from "@/components/seller-ui/tx";
import { cn } from "@/lib/utils";
import { C, CodeBlock, CodeTabs, DocSection, Endpoint, Note, ParamList, Prose, Steps, Sub } from "@/components/integrations/docs/DocBlocks";
import {
  API_ERRORS, CHARGE_PARAMS, CHARGE_REQUEST, CHARGE_RESPONSE, CHARGE_STATUS, NODE_RECEIVER, PAYMENT_EVENT_EXAMPLE, PAYMENT_FIELDS,
  PAYOUT_EVENT_EXAMPLE, PHP_RECEIVER, PYTHON_RECEIVER, RATE_LIMITS, WEBHOOK_HEADERS,
} from "@/components/integrations/docs/docsData";
import { EVENT_GROUPS, MAX_ATTEMPTS, RETRY_PLAN } from "@/components/integrations/webhookMeta";

export const DOC_SECTIONS = [
  { id: "comecar", label: "Comece por aqui" },
  { id: "autenticacao", label: "Autenticação" },
  { id: "webhooks", label: "Webhooks" },
  { id: "cobrancas", label: "Cobranças PIX" },
  { id: "erros", label: "Erros e limites" },
  { id: "valores", label: "Valores e taxas" },
] as const;

type SectionId = (typeof DOC_SECTIONS)[number]["id"];

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Marca como ativa a seção que está na parte de cima da tela. */
function useActiveSection(): [SectionId, (id: SectionId) => void] {
  const [active, setActive] = useState<SectionId>(DOC_SECTIONS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Set<string>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) { if (e.isIntersecting) seen.add(e.target.id); else seen.delete(e.target.id); }
      const first = DOC_SECTIONS.find((s) => seen.has(s.id));
      if (first) setActive(first.id);
    }, { rootMargin: "-12% 0px -70% 0px" });
    for (const s of DOC_SECTIONS) { const el = document.getElementById(s.id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, []);

  const go = useCallback((id: SectionId) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1) as SectionId;
    if (hash && DOC_SECTIONS.some((s) => s.id === hash)) window.setTimeout(() => go(hash), 150);
  }, [go]);

  return [active, go];
}

export default function Documentacao({ standalone = false }: { standalone?: boolean }) {
  const [active, go] = useActiveSection();

  return (
    <div className={cn("space-y-5 pb-6 md:space-y-6", !standalone && "vp-fade")}>
      {!standalone && <Seo title="Documentação da API | Vemprapay" description="Como receber eventos por webhook e criar cobranças por API." path="/integracoes?tab=api" noindex />}

      <PageHead
        title="Documentação da API"
        subtitle="Tudo para ligar o seu sistema à Vemprapay: receba cada venda e cada saque por webhook hoje e, quando a API de cobranças abrir, crie cobranças pelo seu servidor."
        actions={standalone ? undefined : (
          <div className="hidden gap-2.5 md:flex">
            <Link to="/integracoes?tab=webhooks" className="vp-ghost !h-11"><Webhook className="h-4 w-4" />Webhooks</Link>
            <Link to="/integracoes?tab=keys" className="vp-ghost !h-11"><KeyRound className="h-4 w-4" />Credenciais de API</Link>
          </div>
        )}
      />

      <div className="lg:hidden">
        <FilterPills<SectionId> label="Seções da documentação" value={active} onChange={go} options={DOC_SECTIONS.map((s) => ({ value: s.id, label: s.label }))} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Seções da documentação" className="sticky top-4 hidden lg:block">
          <ul className="space-y-1">
            {DOC_SECTIONS.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => go(s.id)} aria-current={active === s.id ? "true" : undefined}
                  className={cn("w-full rounded-full px-4 py-2.5 text-left text-[14.5px] font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active === s.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5 md:space-y-6">
          <DocSection id="comecar" title="Comece por aqui" intro="Hoje você já recebe cada venda e cada saque por webhook. A criação de cobranças por API abre quando o processador de pagamentos estiver conectado.">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
              <div className="flex flex-col gap-3 rounded-[22px] border border-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[16px] font-bold text-foreground">Webhooks</h3><StatusPill label="Disponível" tone="ok" /></div>
                <p className="text-[14px] leading-snug text-muted-foreground">Receba pagamentos aprovados, reembolsos, chargebacks e saques no seu servidor, com assinatura e novas tentativas automáticas.</p>
                <Link to="/integracoes?tab=webhooks" className="vp-cta !h-11 mt-auto w-fit">Cadastrar endpoint</Link>
              </div>
              <div className="flex flex-col gap-3 rounded-[22px] border border-border p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[16px] font-bold text-foreground">Cobranças PIX por API</h3><StatusPill label="Em breve" tone="wait" /></div>
                <p className="text-[14px] leading-snug text-muted-foreground">Criar e consultar cobranças pelo seu servidor. Você já pode criar suas chaves, mas elas só passam a valer quando a API abrir.</p>
                <Link to="/integracoes?tab=keys" className="vp-ghost !h-11 mt-auto w-fit">Criar chave</Link>
              </div>
            </div>
            <Sub title="Receber o primeiro webhook em 4 passos">
              <Steps items={[
                { title: "Cadastre o endereço", body: <>Em Webhooks, clique em Novo endpoint, cole a URL <C>https</C> do seu servidor e escolha os eventos.</> },
                { title: "Guarde a chave secreta", body: <>Ela começa com <C>whsec_</C> e aparece uma única vez. Sem ela você não consegue conferir a assinatura.</> },
                { title: "Confira a assinatura e responda", body: <>Valide o cabeçalho <C>X-Venxpay-Signature</C> e responda com status 2xx em até 10 segundos.</> },
                { title: "Envie um teste", body: "No endpoint, use Enviar teste e acompanhe a entrega no histórico." },
              ]} />
            </Sub>
          </DocSection>

          <DocSection id="autenticacao" title="Autenticação" intro="As chaves de API identificam o seu servidor na API de cobranças. Os webhooks não usam essas chaves: eles usam a chave secreta de cada endpoint.">
            <Sub title="Suas chaves">
              <ParamList plain label="Sobre as chaves de API" rows={[
                { name: "Chave pública", type: "pk_live_…", desc: "Identifica a chave. Pode aparecer em logs." },
                { name: "Chave secreta", type: "sk_live_…", desc: "Autentica as chamadas. Aparece uma única vez, quando você cria a chave." },
                { name: "Validade", desc: "Cada chave vale 90 dias. Em Credenciais de API você vê quanto falta." },
                { name: "Limite", desc: "Até 5 chaves por conta. Pausar bloqueia a chave sem apagar. Revogar é definitivo." },
              ]} />
            </Sub>
            <Sub title="Como enviar a chave">
              <Prose>Mande a chave secreta em um destes cabeçalhos. Os dois funcionam do mesmo jeito.</Prose>
              <CodeBlock label="Cabeçalho" code={`Authorization: Bearer sk_live_suachave\n# ou\nX-API-Key: sk_live_suachave`} />
              <Note tone="warn" title="Só no seu servidor">Nunca coloque a chave secreta no navegador, em app de celular ou em repositório. Se ela vazar, revogue em Credenciais de API e crie outra.</Note>
            </Sub>
          </DocSection>

          <DocSection id="webhooks" title="Webhooks" status={{ label: "Disponível", tone: "ok" }} intro="Quando algo acontece na sua conta, a gente envia um POST com JSON para o endereço que você cadastrou. Cada envio vai assinado, para você ter certeza de que veio da Vemprapay.">
            <Sub title="Eventos">
              {EVENT_GROUPS.map((g) => (
                <div key={g.label} className="space-y-2">
                  <p className="text-[13.5px] font-semibold text-muted-foreground">{g.label}</p>
                  <ParamList label={g.label} rows={g.events.map((e) => ({ name: e.key, desc: `${e.label}. ${e.hint}.` }))} />
                </div>
              ))}
              <Prose>O botão Enviar teste dispara <C>webhook.test</C>, com dados de exemplo, só para checar a conexão. Um endpoint sem eventos escolhidos recebe todos.</Prose>
            </Sub>

            <Sub title="Formato do evento">
              <Prose>Eventos de pagamento e de chargeback têm o mesmo formato. Os de saque trazem o valor, a taxa e o tipo do saque.</Prose>
              <CodeBlock label="Pagamento aprovado, payment.approved" code={PAYMENT_EVENT_EXAMPLE} />
              <ParamList label="Campos de um evento de pagamento" rows={PAYMENT_FIELDS.map((f) => ({ name: f.name, type: f.type, desc: f.desc }))} />
              <CodeBlock label="Saque aprovado, payout.approved" code={PAYOUT_EVENT_EXAMPLE} />
            </Sub>

            <Sub title="Cabeçalhos de cada chamada">
              <ParamList label="Cabeçalhos do webhook" rows={WEBHOOK_HEADERS.map(([name, desc]) => ({ name, desc }))} />
            </Sub>

            <Sub title="Conferir a assinatura">
              <Prose>A assinatura é um HMAC-SHA256 em hexadecimal do texto <C>{"<t>.<corpo>"}</C>. A chave é o segredo do endpoint, exatamente como aparece, com o <C>whsec_</C> no começo. Calcule sobre o corpo como ele chegou, antes de converter em objeto.</Prose>
              <Steps items={[
                { title: "Leia t e v1", body: <>O cabeçalho vem como <C>t=1732482632,v1=ab12…</C>. O <C>t</C> é a hora do envio e o <C>v1</C> é a assinatura.</> },
                { title: "Monte o texto assinado", body: <>Junte <C>t</C>, um ponto e o corpo bruto da requisição.</> },
                { title: "Calcule e compare", body: "Gere o HMAC-SHA256 com a chave secreta e compare com o v1 em tempo constante." },
                { title: "Recuse envios velhos", body: "Se o t tiver mais de 5 minutos, trate como inválido. Isso barra repetições de um envio capturado." },
              ]} />
              <CodeTabs label="Linguagem do exemplo" tabs={[
                { id: "node", label: "Node.js", code: NODE_RECEIVER },
                { id: "python", label: "Python", code: PYTHON_RECEIVER },
                { id: "php", label: "PHP", code: PHP_RECEIVER },
              ]} />
              <Note tone="warn" title="Compare em tempo constante">Use <C>timingSafeEqual</C> no Node.js, <C>compare_digest</C> no Python e <C>hash_equals</C> no PHP. Comparar com == revela a assinatura aos poucos.</Note>
            </Sub>

            <Sub title="Entrega e novas tentativas">
              <ParamList plain label="Regras de entrega" rows={[
                { name: "Resposta esperada", desc: "Qualquer status 2xx em até 10 segundos. Outro status, erro ou demora contam como falha." },
                { name: "Novas tentativas", desc: `Até ${MAX_ATTEMPTS} tentativas no total, esperando ${RETRY_PLAN} entre elas. Depois disso a entrega fica como falhou e aparece em Webhooks, na aba Entregas.` },
                { name: "Endereço", desc: "Só https e público. localhost, redes internas e IPs privados não são aceitos." },
                { name: "Redirecionamentos", desc: "Não são seguidos. Cadastre o endereço final." },
                { name: "Repetidos", desc: "O mesmo evento pode chegar mais de uma vez. Use o X-Venxpay-Delivery para ignorar o que você já tratou." },
                { name: "Ordem", desc: "A ordem de chegada pode variar, principalmente quando há nova tentativa. Use o created_at do evento para decidir." },
              ]} />
            </Sub>

            <Sub title="Boas práticas">
              <ul className="max-w-[68ch] list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-foreground/85 marker:text-muted-foreground">
                <li>Responda 2xx logo e processe o resto em segundo plano.</li>
                <li>Guarde a chave secreta em uma variável de ambiente, nunca no código.</li>
                <li>Se suspeitar de vazamento, gire a chave em Webhooks. A anterior para de valer na hora.</li>
                <li>Trate o evento de forma idempotente: receber duas vezes não pode liberar dois pedidos.</li>
              </ul>
            </Sub>
          </DocSection>

          <DocSection id="cobrancas" title="Cobranças PIX" status={{ label: "Em breve", tone: "wait" }} intro="Esta é a prévia da API de cobranças.">
            <Note tone="warn" title="Ainda não está no ar">Nenhuma chamada desta seção responde hoje, e os campos podem mudar antes da abertura. Para saber quando uma venda foi paga, use os webhooks acima.</Note>
            <div className="space-y-2.5">
              <Endpoint method="GET" path="/v1/ping" desc="Testa a chave e a conexão" />
              <Endpoint method="POST" path="/v1/pix/charges" desc="Cria uma cobrança e devolve o código copia e cola" />
              <Endpoint method="GET" path="/v1/pix/charges/{id}" desc="Consulta uma cobrança" />
              <Endpoint method="GET" path="/v1/pix/charges" desc="Lista as cobranças criadas pela API" />
            </div>
            <Sub title="Criar uma cobrança">
              <Prose>Envie um <C>Idempotency-Key</C> (recomendamos um UUID). Reenviar a mesma chave em até 24 horas devolve a resposta original, sem cobrar duas vezes. Valores vão em centavos.</Prose>
              <ParamList label="Campos para criar a cobrança" rows={CHARGE_PARAMS.map((p) => ({ name: p.name, type: p.type, required: p.required, desc: p.desc }))} />
              <CodeBlock label="Exemplo com cURL" code={CHARGE_REQUEST} />
              <CodeBlock label="Resposta, 201 Created" code={CHARGE_RESPONSE} />
            </Sub>
            <Sub title="Consultar e listar">
              <Prose>A consulta devolve a cobrança no mesmo formato da criação, com o status atualizado. A lista aceita <C>limit</C> (de 1 a 100, padrão 20), <C>status</C> e <C>starting_after</C> (o ID da última cobrança da página anterior) e responde com <C>has_more</C> e <C>next_cursor</C>. Prefira os webhooks a consultar em repetição.</Prose>
            </Sub>
            <Sub title="Status da cobrança">
              <ParamList label="Status possíveis" rows={CHARGE_STATUS.map(([name, desc, final]) => ({ name, desc: `${desc}. ${final === "Sim" ? "Status final." : "Ainda pode mudar."}` }))} />
            </Sub>
          </DocSection>

          <DocSection id="erros" title="Erros e limites" status={{ label: "Em breve", tone: "wait" }} intro="Valem para a API de cobranças, quando ela abrir.">
            <Sub title="Formato do erro">
              <Prose>Todo erro vem no mesmo envelope. Guarde o <C>request_id</C>: o suporte usa ele para achar a chamada.</Prose>
              <CodeBlock label="Erro de validação, 400" code={`{\n  "error": {\n    "code": "validation_error",\n    "message": "customer.document must be a valid CPF (11) or CNPJ (14) digit string.",\n    "request_id": "req_1a2b3c4d5e6f7g8h9i0j1k2l",\n    "field": "customer.document"\n  }\n}`} />
            </Sub>
            <Sub title="Códigos de erro">
              <ParamList label="Códigos de erro" rows={API_ERRORS.map(([http, code, when]) => ({ name: code, type: `HTTP ${http}`, desc: when }))} />
            </Sub>
            <Sub title="Limites de uso">
              <ParamList label="Limites de uso" rows={RATE_LIMITS.map(([name, limit, why]) => ({ name, desc: `${limit}. ${why}` }))} />
              <Prose>Ao passar do limite, a resposta é 429 com o horário em que você pode tentar de novo.</Prose>
            </Sub>
          </DocSection>

          <DocSection id="valores" title="Valores e taxas">
            <ParamList plain label="Valores e taxas" rows={[
              { name: "Centavos", desc: <>Na API e nos webhooks, todo valor vem em centavos. <C>4990</C> é R$ 49,90. O painel mostra em reais.</> },
              { name: "Valor líquido", desc: <>O <C>net_amount_cents</C> é o que sobra para você depois das taxas. As taxas da sua conta ficam em Financeiro, Taxas.</> },
              { name: "Saques", desc: <>Saques não passam pela API. Você pede em Financeiro, Saques, e recebe os eventos <C>payout.approved</C> e <C>payout.rejected</C> por webhook.</> },
            ]} />
          </DocSection>
        </div>
      </div>
    </div>
  );
}
