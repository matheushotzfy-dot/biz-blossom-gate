import { useState } from "react";
import { BookOpen, Search, ChevronDown, ChevronUp, Video, FileText, HelpCircle, Lightbulb, Rocket, CreditCard, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type FAQ = { q: string; a: string };
type Category = { id: string; label: string; icon: any; color: string; faqs: FAQ[] };

const CATEGORIES: Category[] = [
 {
 id: "start", label: "Primeiros Passos", icon: Rocket, color: "text-primary",
 faqs: [
 { q: "Como criar meu primeiro produto?", a: "Acesse Produtos > clique no botão '+' > preencha as informações básicas (nome, preço, descrição) > salve. Depois configure o checkout e o conteúdo de entrega." },
 { q: "Como configurar meu checkout?", a: "No editor do produto, vá até a aba 'Checkout' ou use o Checkout Builder para personalizar cores, banners, timer de urgência e métodos de pagamento aceitos." },
 { q: "Quanto tempo leva para receber meus pagamentos?", a: "Pagamentos via PIX são processados em até 1 dia útil. Cartão de crédito em até 30 dias (período de retenção padrão). Você pode acompanhar tudo no Extrato." },
 ],
 },
 {
 id: "payments", label: "Pagamentos e Saques", icon: CreditCard, color: "text-emerald-500",
 faqs: [
 { q: "Como solicitar um saque?", a: "Vá em Financeiro > Saques > escolha PIX ou Cripto > informe o valor > confirme. O processamento ocorre em até 24h úteis." },
 { q: "Quais são as taxas da plataforma?", a: "A taxa padrão é de 4,99% + R$ 2,50 por transação aprovada. Taxa de saque: R$ 5,00. Confira detalhes em Financeiro > Configurações > Taxas." },
 { q: "Como funciona a retenção?", a: "Uma porcentagem do valor é retida por um período configurável (padrão: 14 dias) como proteção contra chargebacks. Após o período, o valor é liberado automaticamente." },
 ],
 },
 {
 id: "security", label: "Segurança", icon: Shield, color: "text-amber-500",
 faqs: [
 { q: "Meus dados estão seguros?", a: "Sim! Utilizamos criptografia SSL, tokens de acesso seguros e políticas de isolamento de dados (RLS) para garantir que apenas você acesse suas informações." },
 { q: "Como ativar o 2FA?", a: "O 2FA é ativado automaticamente para contas administrativas. Para vendedores, recomendamos usar uma senha forte e manter o e-mail de recuperação atualizado." },
 ],
 },
 {
 id: "tips", label: "Dicas de Vendas", icon: Lightbulb, color: "text-purple-500",
 faqs: [
 { q: "Como aumentar minha taxa de conversão?", a: "1) Ative o timer de urgência no checkout. 2) Use prova social. 3) Configure Order Bumps. 4) Teste variações com A/B Testing. 5) Use cupons automáticos para carrinhos abandonados." },
 { q: "Vale a pena usar afiliados?", a: "Sim! Afiliados podem multiplicar suas vendas sem custo inicial. Configure uma comissão competitiva (20-50%) e ative o Marketplace para atrair parceiros." },
 ],
 },
];

const TUTORIALS = [
 { title: "Criando seu primeiro produto", duration: "5 min", type: "video" },
 { title: "Configurando o Checkout Builder", duration: "8 min", type: "video" },
 { title: "Integrando Webhooks", duration: "12 min", type: "article" },
 { title: "Configurando Cupons Automáticos", duration: "4 min", type: "video" },
 { title: "Usando o A/B Testing", duration: "6 min", type: "article" },
 { title: "Configurando Saques Crypto", duration: "3 min", type: "video" },
];

export default function CentralAjuda() {
 const [search, setSearch] = useState("");
 const [openCat, setOpenCat] = useState<string | null>("start");
 const [openFaq, setOpenFaq] = useState<string | null>(null);

 const filtered = CATEGORIES.map(cat => ({
 ...cat,
 faqs: cat.faqs.filter(f => !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())),
 })).filter(cat => cat.faqs.length > 0);

 return (
 <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
 <div className="text-center">
 <h1 className="text-2xl font-black">Central de Ajuda</h1>
 <p className="mt-1 text-muted-foreground">Encontre respostas para suas dúvidas</p>
 </div>

 <div className="mx-auto max-w-md">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Buscar perguntas..."
 className="rounded-2xl pl-10"
 />
 </div>
 </div>

 <div className="space-y-4">
 {filtered.map(cat => (
 <Card key={cat.id} className="border-border/40 bg-card/60 backdrop-blur-xl">
 <button
 type="button"
 onClick={() => setOpenCat(openCat === cat.id ? null : cat.id)}
 className="flex w-full items-center justify-between p-5 text-left"
 >
 <div className="flex items-center gap-3">
 <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/50 ${cat.color}`}>
 <cat.icon className="h-5 w-5" />
 </div>
 <div>
 <h3 className="font-bold">{cat.label}</h3>
 <p className="text-[11px] text-muted-foreground">{cat.faqs.length} perguntas</p>
 </div>
 </div>
 {openCat === cat.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
 </button>
 {openCat === cat.id && (
 <CardContent className="space-y-2 border-t border-border/30 pt-4">
 {cat.faqs.map((f, i) => {
 const key = `${cat.id}-${i}`;
 return (
 <div key={key} className="rounded-xl bg-muted/15 transition-all">
 <button
 type="button"
 onClick={() => setOpenFaq(openFaq === key ? null : key)}
 className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
 >
 {f.q}
 {openFaq === key ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
 </button>
 {openFaq === key && (
 <p className="px-4 pb-3 text-[13px] leading-relaxed text-muted-foreground">{f.a}</p>
 )}
 </div>
 );
 })}
 </CardContent>
 )}
 </Card>
 ))}
 </div>

 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardHeader className="pb-2">
 <CardTitle className="flex items-center gap-2 text-sm font-bold">
 <BookOpen className="h-4 w-4 text-primary" /> Tutoriais
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
 {TUTORIALS.map(t => (
 <div key={t.title} className="flex items-center gap-3 rounded-xl bg-muted/20 px-4 py-3 transition-all hover:bg-muted/30">
 {t.type === "video" ? <Video className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-amber-500" />}
 <div>
 <p className="text-[13px] font-semibold">{t.title}</p>
 <p className="text-[11px] text-muted-foreground">{t.duration} • {t.type === "video" ? "Vídeo" : "Artigo"}</p>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>
 );
}
