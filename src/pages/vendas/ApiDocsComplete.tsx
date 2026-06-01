import { useState } from "react";
import { BookOpen, ChevronDown, Copy, Check, ArrowLeft, Zap, Shield, Terminal, Globe, Lock, AlertTriangle, Code2, Rocket, Server, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/StatCard";

const BASE_URL = `https://glccldyjevnmoogakqxw.supabase.co/functions/v1`;

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-x border-t border-border/60 rounded-t-xl">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{lang}</span>
        <button onClick={handleCopy} className="text-muted-foreground hover:text-primary transition-colors">
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="p-5 bg-card border border-border/60 rounded-b-xl overflow-x-auto text-[11px] font-mono leading-relaxed text-foreground/80">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ApiDocsComplete() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1200px] mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-11 w-11 rounded-xl border border-border/60">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">API Reference</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-primary" />
              Integração via REST para automação completa
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats / Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Protocolo" value="HTTPS" icon={Globe} color="primary" description="TLS 1.3 obrigatório" />
        <StatCard title="Autenticação" value="Bearer" icon={Shield} color="success" description="API Keys (sk_live)" />
        <StatCard title="Formato" value="JSON" icon={Terminal} color="info" description="UTF-8 Encoding" />
        <StatCard title="Version" value="v1.0" icon={Rocket} color="neutral" description="Stable Release" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Main Content */}
        <div className="space-y-12">
          {/* Section: Auth */}
          <section id="auth" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Lock size={16} strokeWidth={2.5} />
              </div>
              <h2 className="text-lg font-black uppercase tracking-tight">Autenticação</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Todas as requisições devem incluir sua chave secreta no header <code className="text-primary font-bold">Authorization</code>.
            </p>
            <CodeBlock 
              lang="http" 
              code={`Authorization: Bearer sk_live_your_secret_key`} 
            />
          </section>

          {/* Section: Create Transaction */}
          <section id="pix" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Smartphone size={16} strokeWidth={2.5} />
              </div>
              <h2 className="text-lg font-black uppercase tracking-tight">Gerar Cobrança PIX</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Crie uma transação e receba o QR Code + Copia e Cola instantaneamente.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/60">
              <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase">POST</span>
              <code className="text-[11px] font-mono text-foreground/70">{BASE_URL}/podpay-create-transaction</code>
            </div>
            
            <CodeBlock 
              lang="curl" 
              code={`curl -X POST "${BASE_URL}/podpay-create-transaction" \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "productId": "7b88...",
    "customerName": "João Silva",
    "customerEmail": "joao@email.com",
    "customerDocument": "123.456.789-00",
    "paymentMethod": "pix"
  }'`} 
            />
          </section>

          {/* Section: Webhooks */}
          <section id="webhooks" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Zap size={16} strokeWidth={2.5} />
              </div>
              <h2 className="text-lg font-black uppercase tracking-tight">Receber Webhooks</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nossa API enviará um POST para sua URL sempre que houver mudança de status. Verifique a assinatura no header <code className="text-primary font-bold">x-podpay-signature</code>.
            </p>
            <CodeBlock 
              lang="javascript (node)" 
              code={`const signature = req.headers['x-podpay-signature'];
const isValid = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex') === signature;`} 
            />
          </section>
        </div>

        {/* Sidebar Nav */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 p-6 rounded-[24px] bg-card border border-border/60 space-y-6">
             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Nesta Página</p>
             <nav className="space-y-2">
                {[
                  { label: "Introdução", id: "intro" },
                  { label: "Autenticação", id: "auth" },
                  { label: "Gerar Pix", id: "pix" },
                  { label: "Webhooks", id: "webhooks" },
                  { label: "Cash-out (API)", id: "cashout" },
                  { label: "Erros Comuns", id: "errors" },
                ].map(link => (
                  <a key={link.id} href={`#${link.id}`} className="block text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">
                    {link.label}
                  </a>
                ))}
             </nav>
             <div className="pt-6 border-t border-border/40">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                   <Server size={14} className="text-primary" />
                   <p className="text-[10px] font-bold text-primary uppercase leading-tight">API Status: Online</p>
                </div>
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
}