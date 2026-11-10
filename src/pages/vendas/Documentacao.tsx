import { useState, useRef, useEffect, useCallback } from "react";
import { BookOpen, Copy, Check, Zap, Shield, Terminal, Globe, Lock, AlertTriangle, Server, Code2, Hash, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Public API reference for the Venxpay PIX gateway.
 * Endpoint base: `${SUPABASE_URL}/functions/v1/pix-api`
 * Auth:         `Authorization: Bearer sk_live_...` OR `X-API-Key: sk_live_...`
 * Versioned:    `/v1/*`
 */
const BASE_URL = "https://glccldyjevnmoogakqxw.supabase.co/functions/v1/pix-api";

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
  return <span className={cn("inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border", styles[variant])}>{children}</span>;
}

function ParamTable({ params }: { params: { name: string; type: string; required: boolean; desc: string }[] }) {
  return (
    <div className="rounded-xl border border-border/30 overflow-hidden my-3">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-muted/20 border-b border-border/20">
            <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">Parâmetro</th>
            <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">Tipo</th>
            <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">Obrig.</th>
            <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">Descrição</th>
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
  { id: "ping", label: "Ping", icon: Server },
  { id: "create-charge", label: "Criar Cobrança PIX", icon: Terminal },
  { id: "get-charge", label: "Consultar Cobrança", icon: Terminal },
  { id: "list-charges", label: "Listar Cobranças", icon: Terminal },
  { id: "webhooks", label: "Webhooks", icon: Zap },
  { id: "status", label: "Status", icon: Server },
  { id: "errors", label: "Erros", icon: AlertTriangle },
  { id: "ratelimits", label: "Rate Limits", icon: Shield },
  { id: "integration", label: "Guia de Integração", icon: Code2 },
  { id: "fees", label: "Taxas", icon: Hash },
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
    <div className="mx-auto w-full max-w-[1180px] pb-20 px-4 sm:px-6 pt-6 relative">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 pb-5 mb-6 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/70 mb-1.5">
            <BookOpen className="h-3 w-3" />
            <span className="">Integrações</span>
            <span className="text-border">/</span>
            <span className="text-foreground/80">API Docs</span>
          </div>
          <h1 className="text-[22px] font-heading font-bold tracking-[-0.02em] text-foreground">
            Referência da API v1
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            REST · JSON · Bearer <code className="mono-inline">sk_live_...</code> · Idempotência · Webhooks HMAC-SHA256
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> REST/JSON</div>
          <div className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Bearer</div>
          <div className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> HMAC-SHA256</div>
          <div className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> HTTPS</div>
        </div>
      </header>

      <div className="mb-6 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-[12.5px] text-muted-foreground">
        <strong className="text-foreground">Nota:</strong> Valores da API são em centavos (ex.: <code className="mono-inline">amount_cents: 4990</code> = R$ 49,90). O painel mostra em reais.
      </div>

      {/* Layout: Sidebar + Content */}
      <div className="flex gap-6 relative">
        <aside className="hidden lg:block w-[220px] shrink-0">
          <div className="sticky top-24 space-y-0.5">
            <p className="text-[11px] font-medium text-muted-foreground/40 px-3 mb-2">Navegação</p>
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
              A API Venxpay é uma REST API server-to-server para gerar cobranças PIX. Retorna QR Code e código copia-e-cola em uma única chamada, notifica seu backend via webhook quando o pagamento é confirmado e expõe endpoints para consultar e listar cobranças.
            </p>
            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-foreground">Base URL</p>
              <CopyBlock code={BASE_URL} language="url" />
            </div>
            <p className="text-[12px] text-muted-foreground">
              Todas as respostas são JSON UTF-8. Envie <code className="mono-inline">Content-Type: application/json</code> em POSTs. Toda resposta traz um <code className="mono-inline">request_id</code> — inclua ele em pedidos de suporte.
            </p>
          </section>

          {/* 2. AUTENTICAÇÃO */}
          <section id="auth" ref={registerRef("auth")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="2" title="Autenticação" />
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Gere sua chave secreta em <strong>Vendas → Chaves de API</strong>. A chave é exibida uma única vez no momento da criação — armazene em cofre. Envie em qualquer um dos dois headers abaixo (equivalentes):
            </p>
            <CopyBlock code={`Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# ou
X-API-Key: sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`} language="header" />

            <Callout variant="warn" icon={AlertTriangle}>
              <strong>Nunca exponha</strong> a chave <code className="mono-inline">sk_live_</code> no frontend, em repositórios públicos, apps mobile ou logs. Todas as chamadas devem ser <strong>server-to-server</strong>. Se vazar, revogue no painel imediatamente — a chave vira inútil e você pode emitir outra.
            </Callout>

            <p className="text-[12px] text-muted-foreground">
              Opcional: restrinja a chave a IPs específicos no painel. Requisições vindas de outros IPs recebem <code className="mono-inline">403 ip_not_allowed</code>.
            </p>
          </section>

          {/* 3. PING */}
          <section id="ping" ref={registerRef("ping")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="3" title="Ping — Testar credenciais" />
            <div className="flex items-center gap-2.5 mb-1">
              <Badge variant="get">GET</Badge>
              <code className="text-[12px] font-mono text-foreground/70">{BASE_URL}/v1/ping</code>
            </div>
            <p className="text-[13px] text-muted-foreground">Endpoint leve para validar que sua chave está válida e a rede funciona.</p>

            <CopyBlock code={`curl "${BASE_URL}/v1/ping" \\
  -H "Authorization: Bearer sk_live_..."`} language="bash" />

            <CopyBlock code={`{
 "ok": true,
 "api_version": "v1",
 "request_id": "req_1a2b3c4d5e6f7g8h9i0j1k2l",
 "timestamp": "2026-07-13T12:34:56.789Z"
}`} language="json" />
          </section>

          {/* 4. CRIAR COBRANÇA */}
          <section id="create-charge" ref={registerRef("create-charge")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="4" title="Criar Cobrança PIX" />
            <div className="flex items-center gap-2.5 mb-1">
              <Badge variant="post">POST</Badge>
              <code className="text-[12px] font-mono text-foreground/70">{BASE_URL}/v1/pix/charges</code>
            </div>
            <p className="text-[13px] text-muted-foreground">Cria uma cobrança PIX e devolve QR Code + código copia-e-cola prontos para exibir.</p>

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Headers</h4>
            <ParamTable params={[
              { name: "Authorization", type: "string", required: true, desc: "Bearer sk_live_..." },
              { name: "Content-Type", type: "string", required: true, desc: "application/json" },
              { name: "Idempotency-Key", type: "string", required: false, desc: "Chave única (recomendamos UUID v4). Reenvios com a mesma chave devolvem a resposta original." },
            ]} />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Body</h4>
            <ParamTable params={[
              { name: "amount_cents", type: "integer", required: true, desc: "Valor em centavos. Mín 100 (R$ 1,00), máx 9.999.999." },
              { name: "customer.name", type: "string", required: true, desc: "Nome do pagador (2–200 chars)." },
              { name: "customer.email", type: "string", required: true, desc: "E-mail válido do pagador." },
              { name: "customer.document", type: "string", required: true, desc: "CPF (11) ou CNPJ (14) — apenas dígitos ou formatado." },
              { name: "customer.phone", type: "string", required: false, desc: "DDD + número, apenas dígitos." },
              { name: "external_id", type: "string", required: false, desc: "Seu ID interno (pedido, invoice). Até 100 chars. Retorna 409 se duplicado." },
              { name: "expires_in_minutes", type: "integer", required: false, desc: "Expiração do PIX. Padrão 30, mín 5, máx 1440." },
              { name: "metadata", type: "object", required: false, desc: "JSON livre até 4KB. Devolvido em todas as consultas e webhooks." },
              { name: "product_id", type: "uuid", required: false, desc: "Opcional. Vincula a cobrança a um produto ativo da sua conta." },
            ]} />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Exemplo cURL</h4>
            <CopyBlock code={`curl -X POST "${BASE_URL}/v1/pix/charges" \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
 "amount_cents": 4990,
 "customer": {
 "name": "João Silva",
 "email": "joao@email.com",
 "document": "12345678900",
 "phone": "11999998888"
    },
 "external_id": "pedido-2026-000123",
 "expires_in_minutes": 30,
 "metadata": { "pedido": "000123", "origem": "checkout-site" }
  }'`} language="bash" />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Response — 201 Created</h4>
            <CopyBlock code={`{
 "data": {
 "id": "b4b1c1e0-9f6a-4a2c-8f7f-1e2d3c4b5a6d",
 "object": "charge",
 "external_id": "pedido-2026-000123",
 "status": "pending",
 "amount_cents": 4990,
 "net_amount_cents": 4750,
 "payment_method": "pix",
 "customer": {
 "name": "João Silva",
 "email": "joao@email.com",
 "document": "12345678900"
    },
 "pix": {
 "qr_code": "00020126580014br.gov.bcb.pix0136...6304ABCD",
 "copy_paste": "00020126580014br.gov.bcb.pix0136...6304ABCD",
 "expires_at": "2026-07-13T13:04:56.000Z"
    },
 "metadata": { "pedido": "000123", "origem": "checkout-site" },
 "created_at": "2026-07-13T12:34:56.789Z",
 "updated_at": "2026-07-13T12:34:56.789Z"
  }
}`} language="json" />

            <Callout variant="info">
              <strong>QR Code:</strong> o campo <code className="mono-inline">pix.qr_code</code> (= <code className="mono-inline">copy_paste</code>) é o EMV do PIX. Renderize com qualquer biblioteca de QR (ex.: <code className="mono-inline">qrcode</code> no Node, <code className="mono-inline">qrcode.react</code>). O status inicial é <code className="mono-inline">pending</code> e vira <code className="mono-inline">completed</code> assim que o pagamento cai.
            </Callout>

            <Callout variant="success">
              <strong>Idempotência:</strong> reenvie com o mesmo <code className="mono-inline">Idempotency-Key</code> (até 24h) e recebe exatamente a mesma resposta — sem cobrar duas vezes. Se enviar a mesma chave com um body diferente, a API responde <code className="mono-inline">409 idempotency_conflict</code>.
            </Callout>
          </section>

          {/* 5. CONSULTAR */}
          <section id="get-charge" ref={registerRef("get-charge")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="5" title="Consultar Cobrança" />
            <div className="flex items-center gap-2.5 mb-1">
              <Badge variant="get">GET</Badge>
              <code className="text-[12px] font-mono text-foreground/70">{BASE_URL}/v1/pix/charges/{"{id}"}</code>
            </div>
            <p className="text-[13px] text-muted-foreground">Devolve o estado atual da cobrança. Use para polling caso não queira usar webhook.</p>

            <CopyBlock code={`curl "${BASE_URL}/v1/pix/charges/b4b1c1e0-9f6a-4a2c-8f7f-1e2d3c4b5a6d" \\
  -H "Authorization: Bearer sk_live_..."`} language="bash" />

            <p className="text-[12px] text-muted-foreground">Resposta idêntica ao POST de criação, com <code className="mono-inline">status</code> atualizado.</p>
          </section>

          {/* 6. LISTAR */}
          <section id="list-charges" ref={registerRef("list-charges")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="6" title="Listar Cobranças" />
            <div className="flex items-center gap-2.5 mb-1">
              <Badge variant="get">GET</Badge>
              <code className="text-[12px] font-mono text-foreground/70">{BASE_URL}/v1/pix/charges</code>
            </div>
            <p className="text-[13px] text-muted-foreground">Lista as cobranças criadas via API, ordenadas da mais recente para a mais antiga.</p>

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Query params</h4>
            <ParamTable params={[
              { name: "limit", type: "integer", required: false, desc: "1–100. Padrão 20." },
              { name: "status", type: "string", required: false, desc: "Filtra por status (pending, completed, failed, ...)." },
              { name: "starting_after", type: "uuid", required: false, desc: "Cursor: id da última cobrança da página anterior." },
            ]} />

            <CopyBlock code={`curl "${BASE_URL}/v1/pix/charges?limit=50&status=completed" \\
  -H "Authorization: Bearer sk_live_..."`} language="bash" />

            <CopyBlock code={`{
 "data": [ { "id": "...", "object": "charge", "status": "completed", "...": "..." } ],
 "has_more": true,
 "next_cursor": "b4b1c1e0-9f6a-4a2c-8f7f-1e2d3c4b5a6d"
}`} language="json" />
          </section>

          {/* 7. WEBHOOKS */}
          <section id="webhooks" ref={registerRef("webhooks")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="7" title="Webhooks — Notificações em Tempo Real" />
            <p className="text-[13px] text-muted-foreground">
              Quando o status muda (ex.: <code className="mono-inline">pending → completed</code>), enviamos <Badge variant="post">POST</Badge> JSON para as URLs configuradas no seu painel.
            </p>

            <h4 className="text-[13px] font-semibold text-foreground mt-4">Configuração</h4>
            <div className="space-y-2 ml-1">
              {[
 "Acesse Vendas → Webhooks",
 "Adicione a URL HTTPS do seu servidor",
 "Selecione os eventos que quer receber",
 "Copie o Secret gerado — ele é usado para assinar cada webhook",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground pt-0.5">{step}</p>
                </div>
              ))}
            </div>

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Eventos disponíveis</h4>
            <ParamTable params={[
              { name: "payment.completed", type: "event", required: false, desc: "PIX pago e confirmado" },
              { name: "payment.pending", type: "event", required: false, desc: "Aguardando pagamento" },
              { name: "payment.failed", type: "event", required: false, desc: "Falha no pagamento" },
              { name: "payment.cancelled", type: "event", required: false, desc: "Cobrança cancelada" },
              { name: "payment.refunded", type: "event", required: false, desc: "Reembolso processado" },
              { name: "payment.chargeback", type: "event", required: false, desc: "Chargeback recebido" },
              { name: "payment.dispute", type: "event", required: false, desc: "Disputa aberta" },
            ]} />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Payload do webhook</h4>
            <CopyBlock code={`{
 "event": "payment.completed",
 "data": {
 "transaction_id": "b4b1c1e0-9f6a-4a2c-8f7f-1e2d3c4b5a6d",
 "external_id": "pedido-2026-000123",
 "status": "completed",
 "amount_cents": 4990,
 "net_amount_cents": 4750
  },
 "timestamp": "2026-07-13T12:36:12.000Z"
}`} language="json" />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Headers enviados</h4>
            <CopyBlock code={`x-venxpay-signature: <hex HMAC-SHA256 do body>
x-venxpay-event: payment.completed
x-venxpay-delivery: <uuid da entrega>
Content-Type: application/json`} language="header" />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Verificação da assinatura</h4>
            <p className="text-[12px] text-muted-foreground mb-3">
              A assinatura é <code className="mono-inline">HMAC-SHA256(secret, raw_body)</code> em hex. Compare em tempo constante:
            </p>
            <WebhookCodeExamples />

            <Callout variant="error" icon={AlertTriangle}>
              <strong>OBRIGATÓRIO:</strong> valide a assinatura antes de processar. Rejeite com HTTP 401 quando inválida. Sempre use comparação em tempo constante (<code className="mono-inline">timingSafeEqual</code> / <code className="mono-inline">hash_equals</code>) para evitar timing attacks.
            </Callout>

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Boas práticas</h4>
            <ul className="space-y-1.5 ml-1">
              {[
                { label: "Idempotência", desc: "Use transaction_id como chave única para não processar o mesmo evento duas vezes" },
                { label: "Resposta rápida", desc: "Retorne 2xx em até 10s. Processe pesado em background/queue" },
                { label: "HTTPS obrigatório", desc: "URLs http:// são rejeitadas em produção" },
                { label: "Retry automático", desc: "Se você retornar 5xx ou timeout, tentaremos de novo com backoff exponencial" },
              ].map((item) => (
                <li key={item.label} className="flex items-start gap-2 text-[12px]">
                  <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground"><strong className="text-foreground">{item.label}:</strong> {item.desc}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 8. STATUS */}
          <section id="status" ref={registerRef("status")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="8" title="Status possíveis" />
            <div className="rounded-xl border border-border/30 overflow-hidden my-3">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-muted/20 border-b border-border/20">
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">Status</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">Significado</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">Final?</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["pending", "Aguardando pagamento do PIX", "Não", "warn"],
                    ["completed", "PIX pago e confirmado", "Sim", "success"],
                    ["failed", "Falha no processamento", "Sim", "error"],
                    ["cancelled", "Cobrança cancelada / expirada", "Sim", "error"],
                    ["refunded", "Valor reembolsado ao pagador", "Sim", "error"],
                    ["chargeback", "Chargeback recebido", "Sim", "error"],
                    ["dispute", "Disputa aberta / em análise", "Não", "warn"],
                  ].map(([st, desc, final, variant]) => (
                    <tr key={st} className="border-t border-border/10 hover:bg-muted/5 transition-colors">
                      <td className="p-3"><Badge variant={variant as "success" | "error" | "warn"}>{st}</Badge></td>
                      <td className="p-3 text-muted-foreground/80">{desc}</td>
                      <td className="p-3 text-muted-foreground/80">{final}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout variant="info">
              <strong>Proteção contra downgrade:</strong> uma vez em status final (<code className="mono-inline">completed</code>, <code className="mono-inline">refunded</code>, <code className="mono-inline">chargeback</code>), a cobrança não regride. Webhooks contradizendo isso são ignorados no servidor.
            </Callout>
          </section>

          {/* 9. ERROS */}
          <section id="errors" ref={registerRef("errors")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="9" title="Erros" />
            <p className="text-[13px] text-muted-foreground">
              Todos os erros seguem o mesmo envelope. O <code className="mono-inline">request_id</code> ajuda o suporte a rastrear a chamada.
            </p>
            <CopyBlock code={`{
 "error": {
 "code": "validation_error",
 "message": "customer.document must be a valid CPF (11) or CNPJ (14) digit string.",
 "request_id": "req_1a2b3c4d5e6f7g8h9i0j1k2l",
 "field": "customer.document"
  }
}`} language="json" />

            <h4 className="text-[13px] font-semibold text-foreground mt-6">Códigos HTTP e códigos de erro</h4>
            <div className="rounded-xl border border-border/30 overflow-hidden my-3">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-muted/20 border-b border-border/20">
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">HTTP</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">code</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">Quando ocorre</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["400", "invalid_json", "Body não é JSON válido"],
                    ["400", "validation_error", "Campo obrigatório ausente ou inválido (ver campo field)"],
                    ["400", "invalid_idempotency_key", "Idempotency-Key com formato inválido"],
                    ["401", "missing_api_key", "Header Authorization ausente"],
                    ["401", "invalid_api_key", "Chave revogada ou inexistente"],
                    ["403", "ip_not_allowed", "IP fora da allowlist da chave"],
                    ["403", "permission_denied", "Chave sem permissão de escrita"],
                    ["403", "fraud_blocked", "Bloqueado por regras antifraude"],
                    ["404", "not_found", "Cobrança não pertence à sua conta"],
                    ["409", "duplicate_external_id", "Já existe cobrança com esse external_id"],
                    ["409", "idempotency_conflict", "Mesma Idempotency-Key usada com body diferente"],
                    ["413", "payload_too_large", "Body maior que 100KB"],
                    ["415", "unsupported_media_type", "Content-Type não é application/json"],
                    ["429", "rate_limited", "Limite de requisições excedido (ver ratelimits)"],
                    ["502", "provider_error", "Gateway PIX rejeitou temporariamente — pode reenviar"],
                    ["504", "provider_error", "Gateway PIX timeout — pode reenviar"],
                    ["500", "internal_error", "Erro interno — contate suporte com o request_id"],
                  ].map(([http, code, when]) => (
                    <tr key={http + code} className="border-t border-border/10 hover:bg-muted/5 transition-colors">
                      <td className="p-3"><Badge variant={Number(http) >= 500 ? "error" : Number(http) >= 400 ? "warn" : "success"}>{http}</Badge></td>
                      <td className="p-3 font-mono text-primary text-[11px]">{code}</td>
                      <td className="p-3 text-muted-foreground/80">{when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 10. RATE LIMITS */}
          <section id="ratelimits" ref={registerRef("ratelimits")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="10" title="Rate Limits" />
            <p className="text-[13px] text-muted-foreground">Aplicados por IP e por chave. Ao estourar, recebemos <code className="mono-inline">429</code> com <code className="mono-inline">reset_at</code>.</p>
            <ParamTable params={[
              { name: "IP", type: "100 / 10s", required: false, desc: "Anti brute-force em chaves inválidas" },
              { name: "Chave — burst", type: "30 / 10s", required: false, desc: "Pico curto por chave" },
              { name: "Chave — sustentado", type: "600 / 60s", required: false, desc: "Volume por minuto por chave" },
              { name: "Criação de cobranças", type: "60 / 60s", required: false, desc: "Extra em POST /v1/pix/charges" },
            ]} />
          </section>

          {/* 11. GUIA DE INTEGRAÇÃO */}
          <section id="integration" ref={registerRef("integration")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="11" title="Guia de Integração" />
            <p className="text-[13px] text-muted-foreground">Fluxo mínimo para colocar PIX no seu checkout em ~10 minutos.</p>

            <StepBlock step={1} title="Gerar chave sk_live no painel">
              <p className="text-[12px] text-muted-foreground">
                Vendas → Chaves de API → <strong>Nova chave</strong>. Copie e guarde no cofre. Ela não é exibida de novo.
              </p>
            </StepBlock>

            <StepBlock step={2} title="Criar cobrança no seu backend">
              <CopyBlock code={`// Node.js — no seu servidor (nunca no browser)
const res = await fetch('${BASE_URL}/v1/pix/charges', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.Vemprapay_SECRET_KEY}\`,
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  },
  body: JSON.stringify({
    amount_cents: 4990,
    customer: {
      name: 'João Silva',
      email: 'joao@email.com',
      document: '12345678900',
    },
    external_id: pedidoId,
    metadata: { pedidoId },
  }),
});

const { data, error } = await res.json();
if (error) throw new Error(error.message);

// data.pix.copy_paste → string PIX EMV
// data.pix.expires_at → ISO date
// data.id → salve para reconciliar com o webhook`} language="javascript" />
            </StepBlock>

            <StepBlock step={3} title="Exibir o PIX ao comprador">
              <CopyBlock code={`import QRCode from 'qrcode.react';

<QRCode value={pix.copy_paste} size={240} />
<input value={pix.copy_paste} readOnly />
<button onClick={() => navigator.clipboard.writeText(pix.copy_paste)}>
  Copiar código PIX
</button>`} language="jsx" />
            </StepBlock>

            <StepBlock step={4} title="Receber a confirmação por webhook">
              <CopyBlock code={`// Express — Node.js
import crypto from 'crypto';

app.post('/webhook/venxpay', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.header('x-venxpay-signature') || '';
  const computed = crypto
    .createHmac('sha256', process.env.Vemprapay_WEBHOOK_SECRET)
    .update(req.body)  // Buffer bruto
    .digest('hex');

  const valid = signature.length === computed.length &&
    crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computed, 'hex'));

  if (!valid) return res.status(401).json({ error: 'invalid_signature' });

  const { event, data } = JSON.parse(req.body.toString());
  if (event === 'payment.completed') {
    // idempotente: use data.transaction_id como chave
    liberarPedido(data.external_id);
  }
  res.json({ received: true });
});`} language="javascript" />
            </StepBlock>

            <StepBlock step={5} title="(Opcional) Polling como fallback">
              <p className="text-[12px] text-muted-foreground">
                Se o webhook não chegar em 60s, faça <code className="mono-inline">GET /v1/pix/charges/{"{id}"}</code> a cada 5–10s até status virar final. Pare após 30 min (validade do PIX).
              </p>
            </StepBlock>

            <Callout variant="success" icon={Check}>
              <strong>Recomendação:</strong> webhook como principal + polling como fallback. Sempre trate como idempotente usando <code className="mono-inline">transaction_id</code> ou <code className="mono-inline">external_id</code>.
            </Callout>
          </section>

          {/* 12. TAXAS */}
          <section id="fees" ref={registerRef("fees")} className="scroll-mt-24 space-y-4">
            <SectionTitle number="12" title="Taxas" />
            <p className="text-[13px] text-muted-foreground">
              As taxas configuradas na plataforma são aplicadas automaticamente. O campo <code className="mono-inline">amount_cents</code> é o valor cobrado do pagador; o <code className="mono-inline">net_amount_cents</code> é o que cai no seu saldo após taxas.
            </p>
            <div className="rounded-xl border border-border/30 overflow-hidden my-3">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-muted/20 border-b border-border/20">
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">Operação</th>
                    <th className="text-left p-3 font-semibold text-foreground/80 text-[11px] ">Onde ver</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["PIX Cash-In (via API)", "Financeiro → Taxas"],
                    ["Saque PIX (Cash-Out)", "Financeiro → Taxas — processado via dashboard, não via API"],
                  ].map(([op, det]) => (
                    <tr key={op} className="border-t border-border/10 hover:bg-muted/5 transition-colors">
                      <td className="p-3 font-medium text-foreground/80">{op}</td>
                      <td className="p-3 text-muted-foreground/80">{det}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Callout variant="info">
              <strong>Nota:</strong> saques (cash-out) não são expostos na API pública por questão de segurança. Solicite no painel em <strong>Financeiro → Saques</strong>.
            </Callout>
          </section>

        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */
function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-border/20">
      <div className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center ">
        <span className="text-[12px] font-bold text-primary-foreground">{number}</span>
      </div>
      <h2 className="text-[16px] font-bold text-foreground tracking-tight">{title}</h2>
    </div>
  );
}

function StepBlock({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-10 pb-6 border-l-2 border-border/20 ml-3 last:border-l-0 last:pb-0">
      <div className="absolute -left-[13px] top-0 h-6 w-6 rounded-full gradient-primary flex items-center justify-center ">
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
    node: `import crypto from 'crypto';

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.header('x-venxpay-signature') || '';
  const computed = crypto
    .createHmac('sha256', process.env.Vemprapay_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  const valid = signature.length === computed.length &&
    crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(computed, 'hex')
    );

  if (!valid) return res.status(401).json({ error: 'invalid_signature' });

  const { event, data } = JSON.parse(req.body.toString());
  switch (event) {
    case 'payment.completed':  /* liberar pedido */ break;
    case 'payment.refunded':   /* revogar */         break;
  }
  res.json({ received: true });
});`,
    python: `import hmac, hashlib, os
from flask import request, jsonify

@app.route('/webhook', methods=['POST'])
def webhook():
    secret = os.environ['Vemprapay_WEBHOOK_SECRET'].encode()
    signature = request.headers.get('x-venxpay-signature', '')
    computed = hmac.new(secret, request.data, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed, signature):
        return jsonify(error='invalid_signature'), 401

    payload = request.get_json()
    if payload['event'] == 'payment.completed':
        liberar_pedido(payload['data']['external_id'])
    return jsonify(received=True)`,
    php: `<?php
$rawBody   = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_Vemprapay_SIGNATURE'] ?? '';
$secret    = getenv('Vemprapay_WEBHOOK_SECRET');

$computed = hash_hmac('sha256', $rawBody, $secret);

if (!hash_equals($computed, $signature)) {
    http_response_code(401);
    echo json_encode(['error' => 'invalid_signature']);
    exit;
}

$payload = json_decode($rawBody, true);
if ($payload['event'] === 'payment.completed') {
    liberarPedido($payload['data']['external_id']);
}
echo json_encode(['received' => true]);`,
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
                tab === t ? "bg-primary text-primary-foreground " : "text-muted-foreground/50 hover:text-foreground"
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
