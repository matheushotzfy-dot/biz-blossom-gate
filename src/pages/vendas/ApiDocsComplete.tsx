import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Copy, Check, ArrowLeft, Zap, Shield, Terminal, Globe, Lock, AlertTriangle, Server, Code2 } from "lucide-react";
import { PageShell, Panel, PageTitle } from "@/components/PageShell";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

function CopyBlock({ code, language = "json" }: { code: string; language?: string }) {
 const [copied, setCopied] = useState(false);
 const handleCopy = () => {
 navigator.clipboard.writeText(code);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };
 return (
 <div className="relative group my-3">
 <button
 onClick={handleCopy}
 className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100 z-10"
 >
 {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
 </button>
 <pre className="rounded-xl p-4 overflow-x-auto text-[11px] font-mono bg-muted/30 border border-border/30 text-foreground/70 leading-relaxed">
 <code>{code}</code>
 </pre>
 </div>
 );
}

function DocSection({ id, title, icon: Icon, children, defaultOpen = false }: {
 id: string; title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
 const [open, setOpen] = useState(defaultOpen);
 return (
 <div className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/30 overflow-hidden transition-all duration-200">
 <button
 onClick={() => setOpen(!open)}
 className="w-full flex items-center justify-between p-5 hover:bg-muted/10 transition-colors text-left"
 >
 <span className="font-display font-bold text-sm text-foreground tracking-[-0.02em] flex items-center gap-3">
 <div className="h-8 w-8 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
 <Icon className="h-4 w-4 text-primary" />
 </div>
 {title}
 </span>
 <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
 <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
 </motion.div>
 </button>
 <AnimatePresence>
 {open && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: "auto", opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
 className="overflow-hidden"
 >
 <div className="px-5 pb-5 border-t border-border/20">
 <div className="mt-4 space-y-4 text-sm text-muted-foreground leading-relaxed">{children}</div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "post" | "get" | "success" | "error" | "warn" }) {
 const styles = {
 default: "bg-primary/10 text-primary border-primary/15",
 post: "bg-warning/10 text-warning border-warning/15",
 get: "bg-success/10 text-success border-success/15",
 success: "bg-success/10 text-success border-success/15",
 error: "bg-destructive/10 text-destructive border-destructive/15",
 warn: "bg-warning/10 text-warning border-warning/15",
 };
 return <span className={cn("inline-flex px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border", styles[variant])}>{children}</span>;
}

function ParamTable({ params }: { params: { name: string; type: string; required: boolean; desc: string }[] }) {
 return (
 <div className="rounded-xl border border-border/30 overflow-hidden">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-muted/20">
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Parâmetro</th>
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Tipo</th>
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Obrigatório</th>
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Descrição</th>
 </tr>
 </thead>
 <tbody>
 {params.map((p) => (
 <tr key={p.name} className="border-t border-border/20">
 <td className="p-3 font-mono text-primary font-semibold">{p.name}</td>
 <td className="p-3 font-mono text-muted-foreground/60">{p.type}</td>
 <td className="p-3">{p.required ? <Badge variant="error">Sim</Badge> : <Badge>Não</Badge>}</td>
 <td className="p-3 text-muted-foreground/70">{p.desc}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

export default function ApiDocsComplete() {
 const navigate = useNavigate();

 return (
 <PageShell>
 <div className="flex items-center gap-3 mb-2">
 <Button variant="ghost" size="icon" onClick={() => navigate("/vendas/documentacao")} className="h-9 w-9 rounded-xl">
 <ArrowLeft className="h-4 w-4" />
 </Button>
 <PageTitle icon={<BookOpen className="h-6 w-6" />} title="Documentação da API" subtitle="Integração PIX Cash-In, Cash-Out e Webhooks" />
 </div>

 {/* Quick Info */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 { icon: Globe, label: "Base URL", value: "REST API", tone: "primary" },
 { icon: Shield, label: "Auth", value: "Bearer Token", tone: "success" },
 { icon: Zap, label: "Formato", value: "JSON", tone: "warning" },
 { icon: Lock, label: "SSL", value: "Obrigatório", tone: "destructive" },
 ].map((i) => (
 <div key={i.label} className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/30 p-4">
 <div className="flex items-center gap-3">
 <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", `bg-${i.tone}/8`)}>
 <i.icon className={cn("h-4 w-4", `text-${i.tone}`)} />
 </div>
 <div>
 <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-wider">{i.label}</p>
 <p className="text-sm font-display font-bold text-foreground tracking-[-0.02em]">{i.value}</p>
 </div>
 </div>
 </div>
 ))}
 </div>

 <div className="space-y-3">
 {/* 1. INTRODUÇÃO */}
 <DocSection id="intro" title="1. Introdução & Autenticação" icon={Globe} defaultOpen>
 <p className="text-foreground font-medium">Base URL:</p>
 <CopyBlock code={BASE_URL} />

 <p>Todas as requisições devem incluir o header <code className="px-1.5 py-0.5 rounded-lg text-[11px] font-mono bg-primary/8 text-primary font-semibold">Authorization</code> com seu token de acesso:</p>
 <CopyBlock code={`Authorization: Bearer SEU_TOKEN_AQUI`} />

 <p>Todas as respostas são retornadas em formato JSON. O Content-Type das requisições deve ser <code className="px-1.5 py-0.5 rounded-lg text-[11px] font-mono bg-primary/8 text-primary font-semibold">application/json</code>.</p>

 <div className="p-4 rounded-xl border border-warning/20 bg-warning/[0.04]">
 <p className="text-xs flex items-start gap-2.5">
 <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
 <span><strong className="text-foreground">Importante:</strong> Nunca exponha seu token no frontend ou em repositórios públicos. Todas as chamadas devem ser feitas pelo servidor (backend-to-backend).</span>
 </p>
 </div>
 </DocSection>

 {/* 2. PIX CASH-IN */}
 <DocSection id="pix-cashin" title="2. PIX Cash-In — Criar Cobrança" icon={Terminal}>
 <div className="flex items-center gap-2 mb-2">
 <Badge variant="post">POST</Badge>
 <code className="text-xs font-mono text-foreground/70">{BASE_URL}/podpay-create-transaction</code>
 </div>

 <p>Cria uma cobrança PIX e retorna o QR Code + código copia-e-cola para o pagador.</p>

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Request Body</h4>
 <ParamTable params={[
 { name: "productId", type: "string (UUID)", required: true, desc: "ID do produto cadastrado na plataforma" },
 { name: "paymentMethod", type: "string", required: true, desc: 'Deve ser "pix"' },
 { name: "customerName", type: "string", required: true, desc: "Nome completo do comprador" },
 { name: "customerEmail", type: "string", required: true, desc: "E-mail do comprador" },
 { name: "customerDocument", type: "string", required: true, desc: "CPF ou CNPJ (apenas números ou formatado)" },
 { name: "customerPhone", type: "string", required: false, desc: "Telefone do comprador com DDD" },
 { name: "checkoutSessionId", type: "string", required: false, desc: "ID de sessão para idempotência" },
 { name: "ip", type: "string", required: false, desc: "IP do pagador (antifraude)" },
 ]} />

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Exemplo de Request</h4>
 <CopyBlock code={`curl -X POST ${BASE_URL}/podpay-create-transaction \\
 -H "Authorization: Bearer SEU_TOKEN" \\
 -H "Content-Type: application/json" \\
 -d '{
 "productId": "uuid-do-produto",
 "paymentMethod": "pix",
 "customerName": "João Silva",
 "customerEmail": "joao@email.com",
 "customerDocument": "123.456.789-00",
 "customerPhone": "11999998888"
 }'`} language="bash" />

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Response — Sucesso (200)</h4>
 <CopyBlock code={`{
 "success": true,
 "data": {
 "transactionId": "uuid-da-transacao",
 "podpayId": "id-podpay",
 "status": "waiting_payment",
 "pix": {
 "qrCode": "data:image/png;base64,...",
 "qrCodeText": "00020126580014br.gov.bcb.pix...",
 "expiresAt": "2026-03-03T12:30:00Z"
 },
 "boleto": null,
 "secureUrl": null
 }
}`} />

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Response — Sessão Existente (Idempotência)</h4>
 <p>Se <code className="px-1.5 py-0.5 rounded-lg text-[11px] font-mono bg-primary/8 text-primary font-semibold">checkoutSessionId</code> já tiver uma transação pendente, a API retorna os dados existentes sem criar duplicidade:</p>
 <CopyBlock code={`{
 "success": true,
 "resumed": true,
 "data": {
 "transactionId": "uuid-existente",
 "podpayId": "id-podpay-existente",
 "status": "pending",
 "pix": { "qrCode": "...", "qrCodeText": "..." },
 "boleto": null
 }
}`} />

 <div className="p-4 rounded-xl border border-primary/15 bg-primary/[0.03] mt-3">
 <p className="text-xs"><strong className="text-foreground">PIX expira em 30 minutos.</strong> Após expiração, crie uma nova transação. O QR Code retornado em <code className="font-mono">pix.qrCode</code> é uma imagem Base64 pronta para exibir.</p>
 </div>
 </DocSection>

 {/* 3. PIX CASH-OUT */}
 <DocSection id="pix-cashout" title="3. PIX Cash-Out — Saques" icon={Terminal}>
 <div className="flex items-center gap-2 mb-2">
 <Badge variant="post">POST</Badge>
 <code className="text-xs font-mono text-foreground/70">{BASE_URL}/podpay-cashout</code>
 </div>

 <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/[0.04] mb-3">
 <p className="text-xs flex items-start gap-2.5">
 <Lock className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
 <span><strong className="text-foreground">Apenas Administradores.</strong> Esta rota exige autenticação com token de um usuário com role <code className="font-mono">admin</code>. Tokens de usuários comuns serão rejeitados com 403.</span>
 </p>
 </div>

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Request Body</h4>
 <ParamTable params={[
 { name: "withdrawalId", type: "string (UUID)", required: true, desc: "ID do saque previamente criado na tabela withdrawals" },
 ]} />

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Exemplo de Request</h4>
 <CopyBlock code={`curl -X POST ${BASE_URL}/podpay-cashout \\
 -H "Authorization: Bearer TOKEN_ADMIN" \\
 -H "Content-Type: application/json" \\
 -d '{
 "withdrawalId": "uuid-do-saque"
 }'`} language="bash" />

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Response — Sucesso (200)</h4>
 <CopyBlock code={`{
 "success": true,
 "data": {
 "id": "transfer-id",
 "status": "processing",
 "amount": 10000,
 "method": "pix"
 }
}`} />

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Fluxo de Cash-Out</h4>
 <ol className="list-decimal list-inside space-y-1.5 text-xs">
 <li>Vendedor solicita saque na plataforma → registro criado em <code className="font-mono bg-primary/8 text-primary px-1.5 rounded-lg">withdrawals</code> com status <code className="font-mono">pending</code></li>
 <li>Admin aprova o saque → chama <code className="font-mono bg-primary/8 text-primary px-1.5 rounded-lg">POST /podpay-cashout</code></li>
 <li>A API busca a chave PIX do vendedor no perfil</li>
 <li>Envia transferência via PIX para a chave configurada</li>
 <li>Status atualizado para <code className="font-mono">approved</code></li>
 </ol>

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Tipos de Chave PIX aceitos</h4>
 <div className="rounded-xl border border-border/30 overflow-hidden">
 <table className="w-full text-xs">
 <thead><tr className="bg-muted/20"><th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Valor</th><th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Descrição</th></tr></thead>
 <tbody>
 {[["cpf","CPF do recebedor"],["cnpj","CNPJ do recebedor"],["email","E-mail cadastrado como chave PIX"],["phone / telefone","Telefone com DDD"],["random / aleatoria","Chave aleatória EVP"]].map(([v,d])=>(
 <tr key={v} className="border-t border-border/20">
 <td className="p-3 font-mono text-primary font-semibold">{v}</td>
 <td className="p-3 text-muted-foreground/70">{d}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </DocSection>

 {/* 4. WEBHOOKS */}
 <DocSection id="webhooks" title="4. Webhooks — Notificações em Tempo Real" icon={Zap}>
 <p>Quando o status de um pagamento muda, a plataforma envia um <Badge variant="post">POST</Badge> para a URL configurada no seu painel de webhooks.</p>

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Configuração</h4>
 <ol className="list-decimal list-inside space-y-1.5 text-xs">
 <li>Acesse <strong>Vendas → Webhooks</strong> no painel</li>
 <li>Adicione a URL do seu servidor (HTTPS obrigatório em produção)</li>
 <li>Selecione os eventos que deseja receber</li>
 <li>Copie o <strong>Secret</strong> gerado para validar as assinaturas</li>
 </ol>

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Eventos Disponíveis</h4>
 <div className="rounded-xl border border-border/30 overflow-hidden">
 <table className="w-full text-xs">
 <thead><tr className="bg-muted/20"><th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Evento</th><th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Descrição</th></tr></thead>
 <tbody>
 {[
 ["payment.completed","Pagamento aprovado / confirmado"],
 ["payment.pending","Pagamento pendente (aguardando)"],
 ["payment.failed","Pagamento recusado"],
 ["payment.cancelled","Pagamento cancelado"],
 ["payment.refunded","Reembolso processado"],
 ["payment.chargeback","Chargeback recebido"],
 ["payment.dispute","Disputa / mediação aberta"],
 ].map(([e,d])=>(
 <tr key={e} className="border-t border-border/20">
 <td className="p-3 font-mono text-primary font-semibold">{e}</td>
 <td className="p-3 text-muted-foreground/70">{d}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Payload do Webhook</h4>
 <CopyBlock code={`{
 "event": "payment.completed",
 "data": {
 "transaction_id": "uuid-da-transacao",
 "podpay_payment_id": "id-podpay",
 "status": "completed",
 "product_id": "uuid-do-produto"
 },
 "timestamp": "2026-03-03T10:30:00.000Z"
}`} />

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Verificação de Assinatura (HMAC-SHA256)</h4>
 <p>Cada webhook inclui o header <code className="px-1.5 py-0.5 rounded-lg text-[11px] font-mono bg-primary/8 text-primary font-semibold">x-podpay-signature</code> com a assinatura HMAC-SHA256 do body usando seu Secret.</p>

 <p className="text-foreground font-medium mt-3">Exemplo em Node.js:</p>
 <CopyBlock code={`const crypto = require('crypto');

function verifyWebhookSignature(rawBody, signature, secret) {
 const computed = crypto
 .createHmac('sha256', secret)
 .update(rawBody)
 .digest('hex');
 
 return crypto.timingSafeEqual(
 Buffer.from(signature, 'hex'),
 Buffer.from(computed, 'hex')
 );
}

// No seu endpoint:
app.post('/webhook', (req, res) => {
 const signature = req.headers['x-podpay-signature'];
 const isValid = verifyWebhookSignature(
 req.rawBody, signature, 'SEU_SECRET'
 );
 
 if (!isValid) {
 return res.status(401).json({ error: 'Invalid signature' });
 }
 
 const { event, data } = req.body;
 
 switch (event) {
 case 'payment.completed':
 // Liberar acesso ao produto
 break;
 case 'payment.refunded':
 // Revogar acesso
 break;
 case 'payment.chargeback':
 // Bloquear acesso + alertar admin
 break;
 }
 
 res.json({ received: true });
});`} language="javascript" />

 <p className="text-foreground font-medium mt-3">Exemplo em Python:</p>
 <CopyBlock code={`import hmac, hashlib

def verify_signature(raw_body: bytes, signature: str, secret: str) -> bool:
 computed = hmac.new(
 secret.encode(), raw_body, hashlib.sha256
 ).hexdigest()
 return hmac.compare_digest(computed, signature)

# Flask:
@app.route('/webhook', methods=['POST'])
def webhook():
 signature = request.headers.get('x-podpay-signature')
 if not verify_signature(request.data, signature, 'SEU_SECRET'):
 return jsonify(error='Invalid signature'), 401
 
 payload = request.json
 event = payload['event']
 
 if event == 'payment.completed':
 # Liberar acesso
 pass
 
 return jsonify(received=True)`} language="python" />

 <p className="text-foreground font-medium mt-3">Exemplo em PHP:</p>
 <CopyBlock code={`<?php
$rawBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_PODPAY_SIGNATURE'] ?? '';
$secret = 'SEU_SECRET';

$computed = hash_hmac('sha256', $rawBody, $secret);

if (!hash_equals($computed, $signature)) {
 http_response_code(401);
 echo json_encode(['error' => 'Invalid signature']);
 exit;
}

$payload = json_decode($rawBody, true);
$event = $payload['event'];

switch ($event) {
 case 'payment.completed':
 // Liberar acesso ao produto
 break;
 case 'payment.refunded':
 // Revogar acesso
 break;
}

echo json_encode(['received' => true]);
?>`} language="php" />

 <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/[0.04] mt-3">
 <p className="text-xs flex items-start gap-2.5">
 <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
 <span><strong className="text-foreground">OBRIGATÓRIO:</strong> Sempre valide a assinatura antes de processar o webhook. Webhooks sem assinatura válida devem ser rejeitados com HTTP 401. Utilize comparação em tempo constante para evitar timing attacks.</span>
 </p>
 </div>

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Boas Práticas</h4>
 <ul className="list-disc list-inside space-y-1.5 text-xs">
 <li><strong>Idempotência:</strong> Use o <code className="font-mono">transaction_id</code> para evitar processar o mesmo evento duas vezes</li>
 <li><strong>Retorne 200 rapidamente:</strong> Processe webhooks de forma assíncrona</li>
 <li><strong>HTTPS obrigatório:</strong> Sua URL de webhook deve utilizar HTTPS em produção</li>
 <li><strong>Retry automático:</strong> Se seu endpoint retornar erro (5xx), haverá tentativas de re-envio</li>
 </ul>
 </DocSection>

 {/* 5. STATUS MAPPING */}
 <DocSection id="status" title="5. Mapeamento de Status" icon={Server}>
 <p>A API utiliza os seguintes status internos para transações:</p>
 <div className="rounded-xl border border-border/30 overflow-hidden">
 <table className="w-full text-xs">
 <thead><tr className="bg-muted/20">
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Status Gateway</th>
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Status Interno</th>
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Descrição</th>
 </tr></thead>
 <tbody>
 {[
 ["waiting_payment","pending","Aguardando pagamento do PIX","warn"],
 ["pending","pending","Processando","warn"],
 ["authorized","pending","Autorizado, aguardando captura","warn"],
 ["approved / paid","completed","Pagamento confirmado","success"],
 ["refused / failed","failed","Pagamento recusado","error"],
 ["cancelled","cancelled","Cancelado","error"],
 ["refunded","refunded","Reembolsado","error"],
 ["chargeback","chargeback","Chargeback recebido","error"],
 ["in_protest","dispute","Disputa / mediação","warn"],
 ].map(([gw,internal,desc,variant])=>(
 <tr key={gw} className="border-t border-border/20">
 <td className="p-3 font-mono text-muted-foreground/60">{gw}</td>
 <td className="p-3"><Badge variant={variant as "success"|"error"|"warn"}>{internal}</Badge></td>
 <td className="p-3 text-muted-foreground/70">{desc}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="p-4 rounded-xl border border-primary/15 bg-primary/[0.03] mt-3">
 <p className="text-xs"><strong className="text-foreground">Proteção contra downgrade:</strong> Uma vez que a transação atinge um status final (<code className="font-mono">completed</code>, <code className="font-mono">refunded</code>, <code className="font-mono">chargeback</code>), ela não pode voltar para um status anterior.</p>
 </div>
 </DocSection>

 {/* 6. ERROS */}
 <DocSection id="errors" title="6. Códigos de Erro HTTP" icon={AlertTriangle}>
 <div className="rounded-xl border border-border/30 overflow-hidden">
 <table className="w-full text-xs">
 <thead><tr className="bg-muted/20">
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Código</th>
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Significado</th>
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Ação Recomendada</th>
 </tr></thead>
 <tbody>
 {[
 ["200","Sucesso","Processar resposta normalmente"],
 ["400","Campos obrigatórios faltando ou inválidos","Verificar body da request"],
 ["401","Token ausente ou assinatura inválida","Verificar Authorization header"],
 ["403","Acesso negado (não é admin)","Usar token de admin para rotas restritas"],
 ["404","Recurso não encontrado","Verificar ID enviado"],
 ["409","Transação duplicada","Usar checkoutSessionId para recuperar"],
 ["500","Erro interno do servidor","Tentar novamente"],
 ].map(([code,meaning,action])=>(
 <tr key={code} className="border-t border-border/20">
 <td className="p-3"><Badge variant={Number(code) >= 400 ? "error" : "success"}>{code}</Badge></td>
 <td className="p-3 font-medium text-foreground/80">{meaning}</td>
 <td className="p-3 text-muted-foreground/70">{action}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Formato de Erro</h4>
 <CopyBlock code={`{
 "success": false,
 "error": "Missing required fields"
}`} />
 </DocSection>

 {/* 7. INTEGRAÇÃO */}
 <DocSection id="integration" title="7. Guia de Integração (Cassinos, Sites, Apps)" icon={Code2}>
 <p className="text-foreground font-medium">Fluxo completo para integrar PIX no seu site:</p>

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Passo 1 — Criar produto na plataforma</h4>
 <p>Cadastre seu produto/plano no painel. Anote o <code className="font-mono bg-primary/8 text-primary px-1.5 rounded-lg">productId</code> (UUID).</p>

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Passo 2 — Gerar cobrança PIX</h4>
 <p>Quando o usuário clicar em "Depositar" ou "Pagar", seu backend chama:</p>
 <CopyBlock code={`const response = await fetch('${BASE_URL}/podpay-create-transaction', {
 method: 'POST',
 headers: {
 'Authorization': 'Bearer SEU_TOKEN',
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 productId: 'uuid-do-produto',
 paymentMethod: 'pix',
 customerName: 'Nome do Cliente',
 customerEmail: 'cliente@email.com',
 customerDocument: '12345678900',
 checkoutSessionId: 'session-unica-123',
 }),
});

const { data } = await response.json();
// data.pix.qrCode → imagem QR Code (base64)
// data.pix.qrCodeText → código copia-e-cola`} language="javascript" />

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Passo 3 — Exibir QR Code</h4>
 <CopyBlock code={`<img src="{data.pix.qrCode}" alt="QR Code PIX" />
<input value="{data.pix.qrCodeText}" readonly />
<button onclick="navigator.clipboard.writeText(qrCodeText)">
 Copiar código PIX
</button>`} language="html" />

 <h4 className="text-foreground font-display font-bold mt-4 mb-2 tracking-[-0.02em]">Passo 4 — Configurar Webhook</h4>
 <p>Configure a URL do seu servidor no painel <strong>Vendas → Webhooks</strong> para receber notificações:</p>
 <CopyBlock code={`app.post('/webhook/hotzfy', (req, res) => {
 // 1. Validar assinatura HMAC
 // 2. Verificar evento
 if (req.body.event === 'payment.completed') {
 const { transaction_id } = req.body.data;
 // 3. Creditar saldo / liberar acesso
 creditUserBalance(transaction_id);
 }
 res.json({ received: true });
});`} language="javascript" />

 <div className="p-4 rounded-xl border border-success/20 bg-success/[0.04] mt-3">
 <p className="text-xs flex items-start gap-2.5">
 <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
 <span><strong className="text-foreground">Recomendação:</strong> Use webhooks como método principal e polling como fallback. Webhooks são mais rápidos e eficientes.</span>
 </p>
 </div>
 </DocSection>

 {/* 8. TAXAS */}
 <DocSection id="fees" title="8. Taxas" icon={Lock}>
 <div className="rounded-xl border border-border/30 overflow-hidden">
 <table className="w-full text-xs">
 <thead><tr className="bg-muted/20">
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Operação</th>
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Taxa</th>
 <th className="text-left p-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Detalhes</th>
 </tr></thead>
 <tbody>
 {[
 ["PIX Cash-In","Taxa % + taxa fixa","Configurável pelo admin no painel"],
 ["PIX Cash-Out (Saque)","R$ 5,00 fixo","Deduzido automaticamente do valor do saque"],
 ].map(([op,taxa,det])=>(
 <tr key={op} className="border-t border-border/20">
 <td className="p-3 font-medium text-foreground/80">{op}</td>
 <td className="p-3 font-mono text-primary font-semibold">{taxa}</td>
 <td className="p-3 text-muted-foreground/70">{det}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <p className="text-xs mt-2 text-muted-foreground/60">As taxas são calculadas automaticamente e já descontadas no campo <code className="font-mono bg-primary/8 text-primary px-1.5 rounded-lg">net_amount</code> da transação.</p>
 </DocSection>

 {/* 9. RATE LIMITS */}
 <DocSection id="limits" title="9. Rate Limits & Segurança" icon={Shield}>
 <ul className="list-disc list-inside space-y-2 text-xs">
 <li><strong>Rate Limit:</strong> 100 requisições por minuto por IP</li>
 <li><strong>SSL/TLS:</strong> Todas as requisições devem usar HTTPS</li>
 <li><strong>Idempotência:</strong> Use <code className="font-mono bg-primary/8 text-primary px-1.5 rounded-lg">checkoutSessionId</code> para evitar cobranças duplicadas</li>
 <li><strong>Webhook Security:</strong> Validação HMAC-SHA256 obrigatória com comparação em tempo constante</li>
 <li><strong>Tokens:</strong> Nunca exponha no frontend. Use apenas server-to-server</li>
 <li><strong>IP Logging:</strong> Envie o IP do pagador no campo <code className="font-mono bg-primary/8 text-primary px-1.5 rounded-lg">ip</code> para auxílio antifraude</li>
 </ul>
 </DocSection>
 </div>
 </PageShell>
 );
}
