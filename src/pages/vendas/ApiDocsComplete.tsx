import { useState } from "react";
import {
  ArrowLeft, Code2, Lock, Smartphone, Zap, ArrowDownToLine, AlertTriangle,
  Globe, Shield, Terminal, Rocket, Server, Copy, Check, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

type Lang = "curl" | "node" | "php" | "python";
const LANG_LABEL: Record<Lang, string> = { curl: "cURL", node: "Node.js", php: "PHP", python: "Python" };

function CodeTabs({ samples }: { samples: Partial<Record<Lang, string>> }) {
  const langs = (Object.keys(samples) as Lang[]).filter(l => samples[l]);
  const [active, setActive] = useState<Lang>(langs[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const code = samples[active] || "";
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30">
        <div className="flex">
          {langs.map(l => (
            <button
              key={l}
              onClick={() => setActive(l)}
              className={cn(
                "px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors",
                active === l
                  ? "text-foreground border-primary bg-card"
                  : "text-muted-foreground/60 border-transparent hover:text-foreground"
              )}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
        <button onClick={handleCopy} className="px-4 py-2.5 text-muted-foreground hover:text-primary transition-colors">
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="p-5 overflow-x-auto text-[11px] font-mono leading-relaxed text-foreground/85">
        <code>{samples[active]}</code>
      </pre>
    </div>
  );
}

function Endpoint({ method, path }: { method: "GET" | "POST" | "PUT" | "DELETE"; path: string }) {
  const methodColors: Record<string, string> = {
    GET:    "bg-blue-500/10 text-blue-500 border-blue-500/20",
    POST:   "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    PUT:    "bg-amber-500/10 text-amber-500 border-amber-500/20",
    DELETE: "bg-red-500/10 text-red-500 border-red-500/20",
  };
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/60">
      <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border", methodColors[method])}>
        {method}
      </span>
      <code className="text-[11px] font-mono text-foreground/80 font-bold truncate">{path}</code>
    </div>
  );
}

const SECTIONS = [
  { id: "intro",     label: "Introdução",       icon: Rocket },
  { id: "auth",      label: "Autenticação",     icon: Lock },
  { id: "pix",       label: "Cobrança PIX",     icon: Smartphone },
  { id: "card",      label: "Cobrança Cartão",  icon: Code2 },
  { id: "list",      label: "Listar Transações", icon: Terminal },
  { id: "webhooks",  label: "Webhooks",         icon: Zap },
  { id: "cashout",   label: "Cash-out",         icon: ArrowDownToLine },
  { id: "errors",    label: "Códigos de Erro",  icon: AlertTriangle },
];

export default function ApiDocsComplete() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)}
            className="h-11 w-11 rounded-xl border border-border/60 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">API Reference</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-primary" />
              REST API HOTZFY · v1.0 · Stable
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest">API Online</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Globe,    label: "Protocolo",     value: "HTTPS",  sub: "TLS 1.3 obrigatório" },
          { icon: Shield,   label: "Autenticação",  value: "Bearer", sub: "sk_live_..." },
          { icon: Terminal, label: "Formato",       value: "JSON",   sub: "UTF-8 encoding" },
          { icon: Rocket,   label: "Versão",        value: "v1.0",   sub: "Stable release" },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-card p-8 rounded-[24px] border border-border/60 shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-muted-foreground/60 mb-3">
                  <Icon size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em]">{k.label}</span>
                </div>
                <p className="text-3xl font-black text-foreground tabular-nums tracking-tighter">{k.value}</p>
                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase mt-2 tracking-widest">{k.sub}</p>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] rotate-[-15deg] group-hover:scale-110 transition-transform duration-500">
                <Icon size={160} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Conteúdo */}
        <div className="space-y-6">
          {/* Introdução */}
          <Section id="intro" icon={Rocket} title="Introdução">
            <p className="text-sm text-foreground/80 leading-relaxed">
              A API HOTZFY permite que você processe pagamentos, gerencie clientes e automatize seu negócio
              através de endpoints REST. Toda comunicação acontece via HTTPS retornando JSON.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <InfoCard label="Base URL" value={BASE_URL} mono />
              <InfoCard label="Rate Limit" value="100 req/min" />
            </div>
          </Section>

          {/* Autenticação */}
          <Section id="auth" icon={Lock} title="Autenticação">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Todas as requisições devem incluir sua <code className="text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10">sk_live</code> no header
              <code className="text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10 mx-1">Authorization</code>.
              Gere suas chaves em <strong>Credenciais API</strong>.
            </p>
            <CodeTabs samples={{
              curl: `curl https://api.hotzfy.com/v1/me \\
  -H "Authorization: Bearer sk_live_your_secret_key"`,
              node: `import fetch from "node-fetch";

const res = await fetch("${BASE_URL}/me", {
  headers: { Authorization: "Bearer sk_live_..." }
});
const data = await res.json();`,
              php: `<?php
$ch = curl_init("${BASE_URL}/me");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Authorization: Bearer sk_live_..."
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);`,
              python: `import requests

r = requests.get(
    "${BASE_URL}/me",
    headers={"Authorization": "Bearer sk_live_..."}
)
print(r.json())`,
            }} />
          </Section>

          {/* PIX */}
          <Section id="pix" icon={Smartphone} title="Gerar Cobrança PIX">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Cria uma transação PIX e retorna QR Code + Copia-e-Cola instantaneamente.
              A transação fica <code className="text-primary font-bold">pending</code> até confirmação do banco.
            </p>
            <Endpoint method="POST" path="/podpay-create-transaction" />
            <CodeTabs samples={{
              curl: `curl -X POST "${BASE_URL}/podpay-create-transaction" \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "productId": "7b88-...",
    "customerName": "João Silva",
    "customerEmail": "joao@email.com",
    "customerDocument": "123.456.789-00",
    "paymentMethod": "pix"
  }'`,
              node: `const res = await fetch("${BASE_URL}/podpay-create-transaction", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    productId: "7b88-...",
    customerName: "João Silva",
    customerEmail: "joao@email.com",
    customerDocument: "123.456.789-00",
    paymentMethod: "pix",
  }),
});
const { qrCode, copyPaste, transactionId } = await res.json();`,
              python: `import requests

payload = {
  "productId": "7b88-...",
  "customerName": "João Silva",
  "customerEmail": "joao@email.com",
  "customerDocument": "123.456.789-00",
  "paymentMethod": "pix",
}
r = requests.post(
  "${BASE_URL}/podpay-create-transaction",
  headers={"Authorization": "Bearer sk_live_..."},
  json=payload,
)
print(r.json())`,
            }} />
            <ResponseExample>{`{
  "transactionId": "tx_8f2a...",
  "qrCode": "data:image/png;base64,...",
  "copyPaste": "00020126360014BR.GOV.BCB.PIX...",
  "amount": 9700,
  "expiresAt": "2026-06-01T19:30:00Z"
}`}</ResponseExample>
          </Section>

          {/* Cartão */}
          <Section id="card" icon={Code2} title="Cobrança Cartão de Crédito">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Mesmo endpoint do PIX, mudando <code className="text-primary font-bold">paymentMethod</code> para
              <code className="text-primary font-bold mx-1">credit_card</code> e enviando dados tokenizados.
            </p>
            <Endpoint method="POST" path="/podpay-create-transaction" />
            <CodeTabs samples={{
              curl: `curl -X POST "${BASE_URL}/podpay-create-transaction" \\
  -H "Authorization: Bearer sk_live_..." \\
  -d '{
    "productId": "7b88-...",
    "paymentMethod": "credit_card",
    "installments": 3,
    "card": {
      "number": "4111111111111111",
      "cvv": "123",
      "expiry": "12/28",
      "holderName": "JOAO SILVA"
    }
  }'`,
            }} />
          </Section>

          {/* List */}
          <Section id="list" icon={Terminal} title="Listar Transações">
            <Endpoint method="GET" path="/transactions?limit=50&status=completed" />
            <CodeTabs samples={{
              curl: `curl "${BASE_URL}/transactions?limit=50" \\
  -H "Authorization: Bearer sk_live_..."`,
              node: `const r = await fetch("${BASE_URL}/transactions?limit=50", {
  headers: { Authorization: "Bearer sk_live_..." }
});
const { data, total } = await r.json();`,
            }} />
          </Section>

          {/* Webhooks */}
          <Section id="webhooks" icon={Zap} title="Webhooks">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Configure uma URL pública e receberemos um <code className="text-primary font-bold">POST</code> para cada mudança de status.
              <strong className="block mt-2">Sempre valide a assinatura HMAC-SHA256</strong> no header
              <code className="text-primary font-bold mx-1">x-podpay-signature</code> antes de processar.
            </p>
            <CodeTabs samples={{
              node: `import crypto from "crypto";

app.post("/webhook", (req, res) => {
  const signature = req.headers["x-podpay-signature"];
  const expected = crypto
    .createHmac("sha256", process.env.WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (signature !== expected) {
    return res.status(401).send("Invalid signature");
  }

  // Processar evento
  const { event, data } = req.body;
  if (event === "transaction.completed") {
    // libera acesso ao produto
  }
  res.status(200).send("OK");
});`,
              php: `<?php
$signature = $_SERVER['HTTP_X_PODPAY_SIGNATURE'];
$payload = file_get_contents('php://input');
$expected = hash_hmac('sha256', $payload, getenv('WEBHOOK_SECRET'));

if (!hash_equals($signature, $expected)) {
  http_response_code(401);
  exit('Invalid signature');
}

$event = json_decode($payload, true);
// Processar evento
http_response_code(200);`,
            }} />

            <div className="rounded-xl bg-muted/20 border border-border/60 p-4 mt-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Eventos disponíveis</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "transaction.created", "transaction.completed", "transaction.refunded",
                  "transaction.chargeback", "subscription.created", "subscription.canceled",
                ].map(e => (
                  <code key={e} className="text-[11px] font-mono font-bold text-foreground/80 px-2 py-1 rounded bg-card border border-border/40">
                    {e}
                  </code>
                ))}
              </div>
            </div>
          </Section>

          {/* Cashout */}
          <Section id="cashout" icon={ArrowDownToLine} title="Cash-out (Saque via API)">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Solicita saque programático para uma chave PIX previamente cadastrada. Requer KYC aprovado.
            </p>
            <Endpoint method="POST" path="/withdrawals" />
            <CodeTabs samples={{
              curl: `curl -X POST "${BASE_URL}/withdrawals" \\
  -H "Authorization: Bearer sk_live_..." \\
  -d '{ "amount": 50000, "pixKeyId": "pk_abc..." }'`,
            }} />
          </Section>

          {/* Errors */}
          <Section id="errors" icon={AlertTriangle} title="Códigos de Erro">
            <div className="overflow-x-auto rounded-2xl border border-border/60">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/30 text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 border-b border-border/40">
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Código</th>
                    <th className="px-5 py-3">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-sm">
                  {[
                    ["400", "invalid_request",     "Payload mal formatado ou campos faltando"],
                    ["401", "invalid_api_key",     "sk_live ausente ou inválida"],
                    ["402", "payment_failed",      "Cartão recusado pela bandeira"],
                    ["403", "kyc_required",        "Conta sem KYC aprovado"],
                    ["404", "not_found",           "Recurso não existe"],
                    ["409", "duplicate_request",   "Idempotency key já usada"],
                    ["422", "validation_error",    "Dados não passaram em validação"],
                    ["429", "rate_limit_exceeded", "Mais de 100 req/min"],
                    ["500", "internal_error",      "Erro interno — abra um ticket"],
                  ].map(([s, c, d]) => (
                    <tr key={c} className="hover:bg-muted/10">
                      <td className="px-5 py-3"><code className="font-mono text-[11px] font-black text-amber-500">{s}</code></td>
                      <td className="px-5 py-3"><code className="font-mono text-[11px] font-bold text-foreground">{c}</code></td>
                      <td className="px-5 py-3 text-foreground/80 text-[12px]">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* Sidebar nav */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 bg-card rounded-[24px] border border-border/60 shadow-sm p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-4 px-2">Nesta página</p>
            <nav className="space-y-0.5">
              {SECTIONS.map(s => {
                const Icon = s.icon;
                return (
                  <a key={s.id} href={`#${s.id}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors group">
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-3.5 w-3.5 text-primary/60 group-hover:text-primary" />
                      {s.label}
                    </span>
                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                );
              })}
            </nav>
            <div className="mt-5 pt-5 border-t border-border/40">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <Server className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">API Online</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden scroll-mt-6">
      <div className="p-6 border-b border-border/40 flex items-center gap-3">
        <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <h2 className="font-black text-foreground tracking-tight leading-none uppercase">{title}</h2>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </section>
  );
}

function InfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/20 border border-border/60 p-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className={cn("text-[12px] font-black text-foreground mt-1 truncate", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function ResponseExample({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] overflow-hidden">
      <div className="px-4 py-2 border-b border-emerald-500/20 bg-emerald-500/5">
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">200 OK · Response</span>
      </div>
      <pre className="p-5 overflow-x-auto text-[11px] font-mono leading-relaxed text-foreground/85">
        <code>{children}</code>
      </pre>
    </div>
  );
}
