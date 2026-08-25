import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight, BarChart3, Check, ChevronDown, Code2, Fingerprint, Gauge,
  GitBranch, LockKeyhole, Menu, Network, Play, QrCode, ShieldCheck, Sparkles,
  TrendingUp, Wallet, X, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { ConversionScene } from "@/components/landing/ConversionScene";
import { PaymentEngine } from "@/components/landing/PaymentEngine";

const NAV = [
  ["Plataforma", "#plataforma"], ["Conversão", "#conversao"],
  ["Infraestrutura", "#infraestrutura"], ["Preços", "#precos"],
] as const;

const FAQ = [
  ["Preciso pagar mensalidade?", "Não. Você paga somente quando uma transação é aprovada, sem custo fixo ou fidelidade."],
  ["Quando o dinheiro fica disponível?", "Vendas PIX são aprovadas em segundos e podem ser liquidadas no mesmo dia, conforme a análise da conta."],
  ["A plataforma inclui área de membros?", "Sim. A liberação do conteúdo acontece automaticamente após a aprovação do pagamento."],
  ["Posso integrar minha própria aplicação?", "Sim. A API REST, os webhooks assinados e a documentação pública cobrem todo o fluxo de cobrança."],
] as const;

const JSONLD = [
  { "@context": "https://schema.org", "@type": "Organization", name: "HOTZFY", url: "https://hotzfy.com.br" },
  { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
];

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, margin: "-12% 0px" });
  const reduce = useReducedMotion();
  return <div ref={ref} className={className}><motion.div initial={reduce ? false : { opacity: 0, y: 42 }} animate={visible ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}>{children}</motion.div></div>;
}

function Wordmark() {
  return <span className="flex items-center gap-2 font-heading text-base font-bold text-foreground"><span className="brand-mark">H</span>HOTZ<span className="text-primary">FY</span></span>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase text-primary"><span className="h-px w-7 bg-primary" />{children}</span>;
}

function SectionTitle({ eyebrow, children, copy }: { eyebrow: string; children: ReactNode; copy?: string }) {
  return <Reveal><Eyebrow>{eyebrow}</Eyebrow><h2 className="mt-5 max-w-4xl font-heading text-3xl font-semibold leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">{children}</h2>{copy && <p className="mt-6 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{copy}</p>}</Reveal>;
}

function HeroInstrument() {
  const reduce = useReducedMotion();
  return (
    <div className="hero-instrument relative mx-auto w-full max-w-6xl">
      <div className="instrument-axis pointer-events-none absolute inset-x-0 top-1/2 h-px" />
      <motion.div animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 34, repeat: Infinity, ease: "linear" }} className="instrument-ring absolute left-1/2 top-1/2 aspect-square w-[76%] -translate-x-1/2 -translate-y-1/2 sm:w-[56%]" />
      <motion.div animate={reduce ? undefined : { rotate: -360 }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }} className="instrument-ring instrument-ring-inner absolute left-1/2 top-1/2 aspect-square w-[55%] -translate-x-1/2 -translate-y-1/2 sm:w-[38%]" />
      <div className="relative z-10 mx-auto w-[88%] max-w-[780px] border border-border bg-background p-3 sm:p-5">
        <div className="flex items-center justify-between border-b border-border pb-3 font-mono text-[8px] text-muted-foreground sm:text-[10px]"><span>HOTZFY / COMMAND</span><span className="flex items-center gap-2"><span className="engine-status-dot" /> LIVE</span></div>
        <div className="grid gap-px bg-border sm:grid-cols-[1.35fr_.65fr]">
          <div className="bg-card p-4 sm:p-7">
            <p className="font-mono text-[9px] text-muted-foreground">FATURAMENTO LÍQUIDO / HOJE</p>
            <p className="mt-3 font-heading text-3xl font-semibold text-foreground sm:text-5xl">R$ 84.290<span className="text-primary">,42</span></p>
            <div className="mt-7 h-28 sm:h-40"><svg viewBox="0 0 600 180" className="h-full w-full" preserveAspectRatio="none"><defs><linearGradient id="heroChart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(var(--primary))" stopOpacity=".24"/><stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0"/></linearGradient></defs><path d="M0 154 C70 148 88 110 152 119 S250 82 310 96 S396 35 458 56 S534 25 600 12 L600 180 L0 180Z" fill="url(#heroChart)"/><motion.path initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1.8 }} d="M0 154 C70 148 88 110 152 119 S250 82 310 96 S396 35 458 56 S534 25 600 12" fill="none" stroke="hsl(var(--primary))" strokeWidth="2"/></svg></div>
          </div>
          <div className="grid gap-px bg-border">
            {[["APROVAÇÃO PIX", "98,73%", "+2,4%"], ["VENDAS", "547", "+18,6%"], ["TICKET MÉDIO", "R$ 154", "+4,2%"]].map(([l, v, d]) => <div key={l} className="bg-background p-4 sm:p-5"><p className="font-mono text-[8px] text-muted-foreground">{l}</p><div className="mt-2 flex items-end justify-between"><p className="font-heading text-lg font-semibold text-foreground sm:text-xl">{v}</p><span className="text-[9px] text-primary">{d}</span></div></div>)}
          </div>
        </div>
      </div>
      <motion.div animate={reduce ? undefined : { y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity }} className="hero-signal left-0 top-[22%]"><QrCode className="h-4 w-4 text-primary"/><span><b>PIX aprovado</b><small>R$ 1.497,00 · 412 ms</small></span></motion.div>
      <motion.div animate={reduce ? undefined : { y: [0, 8, 0] }} transition={{ duration: 6, repeat: Infinity }} className="hero-signal bottom-[12%] right-0"><Wallet className="h-4 w-4 text-primary"/><span><b>Saldo liberado</b><small>Liquidação D+0</small></span></motion.div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const heroRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 180]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 0.9]);

  useEffect(() => {
    document.documentElement.classList.add("landing-scroll");
    document.body.classList.add("landing-scroll");
    return () => { document.documentElement.classList.remove("landing-scroll"); document.body.classList.remove("landing-scroll"); };
  }, []);

  const signup = () => navigate("/auth?mode=signup");
  return (
    <div className="tech-scope landing-v4 min-h-screen overflow-x-clip bg-background text-foreground">
      <Seo title="HOTZFY — Tecnologia para vender e escalar" description="Checkout de alta conversão, pagamentos, antifraude, afiliados e saques em uma infraestrutura completa para produtos digitais." path="/" jsonLd={JSONLD} />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-5 lg:px-8"><button aria-label="HOTZFY" onClick={() => navigate("/")}><Wordmark /></button><nav className="mx-auto hidden items-center gap-8 lg:flex">{NAV.map(([label, href]) => <a key={href} href={href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">{label}</a>)}</nav><div className="ml-auto hidden gap-2 lg:flex"><Button variant="ghost" onClick={() => navigate("/auth")}>Entrar</Button><Button onClick={signup}>Criar conta <ArrowRight /></Button></div><Button variant="outline" size="icon" className="ml-auto lg:hidden" aria-label="Abrir menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</Button></div>
        {menu && <div className="border-t border-border bg-background p-5 lg:hidden"><div className="grid gap-1">{NAV.map(([label, href]) => <a key={href} href={href} onClick={() => setMenu(false)} className="py-3 text-sm text-muted-foreground">{label}</a>)}</div><Button onClick={signup} className="mt-4 w-full">Criar conta</Button></div>}
      </header>

      <main>
        <section ref={heroRef} className="hero-field relative min-h-[1180px] overflow-hidden pt-32 sm:min-h-[1320px] sm:pt-40">
          <div className="landing-grid absolute inset-0" /><div className="hero-beacon absolute left-1/2 top-0 h-[680px] w-px" />
          <motion.div style={{ y: heroY, scale: heroScale }} className="relative mx-auto max-w-7xl px-5 text-center lg:px-8">
            <Reveal><div className="mx-auto inline-flex items-center gap-2 border border-primary/25 bg-primary/[0.04] px-3 py-2 font-mono text-[9px] uppercase text-primary"><span className="engine-status-dot" /> Infraestrutura ativa · Brasil</div></Reveal>
            <Reveal delay={0.06}><h1 className="mx-auto mt-8 max-w-5xl font-heading text-[44px] font-semibold leading-[.98] text-foreground sm:text-7xl lg:text-[92px]">Mais que pagamentos.<br/><span className="hero-stroke">Potência para escalar.</span></h1></Reveal>
            <Reveal delay={0.12}><p className="mx-auto mt-7 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-lg">Do primeiro clique à liquidação: uma operação financeira de alta performance construída para quem vende produtos digitais.</p></Reveal>
            <Reveal delay={0.18}><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Button size="lg" onClick={signup} className="h-12 px-7">Começar agora <ArrowRight /></Button><Button size="lg" variant="outline" asChild className="h-12 px-7"><a href="#plataforma"><Play className="h-3.5 w-3.5" /> Ver a plataforma</a></Button></div></Reveal>
            <Reveal delay={0.25} className="mt-20 sm:mt-28"><HeroInstrument /></Reveal>
          </motion.div>
        </section>

        <section className="border-y border-border bg-card"><div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-border lg:grid-cols-4 lg:divide-y-0">{[["R$ 200M+", "processados"], ["98,7%", "aprovação PIX"], ["420 ms", "tempo de resposta"], ["D+0", "liquidação"]].map(([v,l],i)=><Reveal key={l} delay={i*.05}><div className="px-5 py-9 text-center"><p className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">{v}</p><p className="mt-2 font-mono text-[9px] uppercase text-muted-foreground">{l}</p></div></Reveal>)}</div></section>

        <section id="plataforma" className="py-28 sm:py-40"><div className="mx-auto max-w-7xl px-5 lg:px-8"><SectionTitle eyebrow="A operação por trás da venda" copy="Cada etapa conversa com a próxima. Sem remendos, sem latência escondida, sem depender de cinco ferramentas diferentes.">Uma venda entra.<br/><span className="text-primary">Toda a estrutura reage.</span></SectionTitle><Reveal className="mt-16 sm:mt-24"><PaymentEngine /></Reveal></div></section>

        <section id="conversao" className="border-y border-border bg-card py-28 sm:py-40"><div className="mx-auto grid max-w-7xl items-center gap-16 px-5 lg:grid-cols-[.9fr_1.1fr] lg:px-8"><div><SectionTitle eyebrow="Checkout que entende intenção" copy="Uma experiência rápida, clara e segura. Order bump, recuperação e pixels trabalham em segundo plano enquanto o comprador vê somente o que importa.">Menos fricção.<br/><span className="text-primary">Mais decisão.</span></SectionTitle><div className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-3">{[["+24,8%", "conversão"], ["-31%", "abandono"], ["12x", "no cartão"]].map(([v,l])=><div key={l} className="bg-background p-4"><p className="font-heading text-xl font-semibold text-foreground">{v}</p><p className="mt-1 text-[10px] text-muted-foreground">{l}</p></div>)}</div></div><ConversionScene /></div></section>

        <section id="infraestrutura" className="relative py-28 sm:py-40"><div className="landing-grid absolute inset-0"/><div className="relative mx-auto max-w-7xl px-5 lg:px-8"><div className="grid gap-14 lg:grid-cols-[.75fr_1.25fr]"><div className="lg:sticky lg:top-28 lg:self-start"><SectionTitle eyebrow="Infraestrutura invisível" copy="A complexidade fica com a gente. Você enxerga uma operação previsível, observável e pronta para volume.">Feita para não<br/><span className="text-primary">virar gargalo.</span></SectionTitle><Button variant="outline" className="mt-8" onClick={() => navigate("/documentacao")}><Code2 /> Explorar documentação</Button></div><div className="grid gap-px border border-border bg-border">{[
            [Network,"Roteamento inteligente","Disponibilidade monitorada e decisão de rota em tempo real para manter cada cobrança no melhor caminho.","ROUTING / 01"],
            [Fingerprint,"Antifraude em camadas","Sinais de identidade, dispositivo, IP e velocidade analisados antes da autorização.","RISK / 02"],
            [GitBranch,"Split automático","Comissões e coproduções calculadas no evento de pagamento, sem planilhas ou repasses manuais.","LEDGER / 03"],
            [Gauge,"Observabilidade contínua","Latência, aprovação, falhas e reentregas visíveis em uma trilha auditável.","OPS / 04"],
          ].map(([Icon,title,copy,tag],i)=><Reveal key={String(title)} delay={i*.06}><article className="group bg-background p-7 sm:p-9"><div className="flex items-start gap-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center border border-border text-primary transition-colors group-hover:border-primary"><Icon className="h-4 w-4"/></span><div><p className="font-mono text-[9px] text-primary">{tag as string}</p><h3 className="mt-3 font-heading text-xl font-semibold text-foreground">{title as string}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{copy as string}</p></div></div></article></Reveal>)}</div></div></div></section>

        <section className="border-y border-border bg-primary py-20 text-primary-foreground"><div className="mx-auto max-w-7xl overflow-hidden px-5 lg:px-8"><motion.div initial={reduce ? false : { x: "12%" }} whileInView={{ x: 0 }} transition={{ duration: 1.2 }} className="font-heading text-[14vw] font-bold leading-none sm:text-[8vw]">VENDA. APROVA. ESCALA.</motion.div><div className="mt-8 flex flex-wrap items-center justify-between gap-5 border-t border-primary-foreground/25 pt-5 font-mono text-[9px]"><span>HOTZFY PAYMENT INFRASTRUCTURE</span><span>LATÊNCIA BAIXA · DISPONIBILIDADE ALTA · DADOS AO VIVO</span></div></div></section>

        <section id="precos" className="py-28 sm:py-40"><div className="mx-auto max-w-7xl px-5 lg:px-8"><SectionTitle eyebrow="Crescimento alinhado" copy="Sem custo fixo para começar. A estrutura acompanha seu volume e as condições evoluem junto com a operação.">Você paga quando vende.<br/><span className="text-primary">Só isso.</span></SectionTitle><div className="mt-16 grid gap-px border border-border bg-border lg:grid-cols-3">{[
          ["Start","4,99%",["PIX, cartão e boleto","Área de membros","Suporte por chat"]],
          ["Scale","3,99%",["Tudo do Start","Afiliados e coprodução","API e webhooks assinados"]],
          ["Enterprise","Sob medida",["Condições por volume","SLA dedicado","Operação personalizada"]],
        ].map(([name,price,items],i)=><Reveal key={String(name)} delay={i*.07} className="h-full"><div className={cn("flex h-full flex-col bg-background p-7 sm:p-9",i===1&&"price-featured")}><div className="flex items-center justify-between"><p className="font-mono text-[10px] text-muted-foreground">PLANO / 0{i+1}</p>{i===1&&<span className="text-[9px] text-primary">MAIS ESCOLHIDO</span>}</div><h3 className="mt-5 font-heading text-xl font-semibold text-foreground">{name as string}</h3><p className="mt-6 font-heading text-4xl font-semibold text-foreground">{price as string}</p><p className="mt-2 text-xs text-muted-foreground">+ R$ 1,00 por venda aprovada</p><ul className="mt-8 flex-1 space-y-3">{(items as string[]).map(it=><li key={it} className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-primary"/>{it}</li>)}</ul><Button variant={i===1?"default":"outline"} className="mt-9 w-full" onClick={signup}>Começar agora <ArrowRight/></Button></div></Reveal>)}</div></div></section>

        <section className="border-y border-border bg-card py-28"><div className="mx-auto grid max-w-7xl gap-16 px-5 lg:grid-cols-2 lg:px-8"><SectionTitle eyebrow="Respostas diretas">Antes de começar,<br/><span className="text-primary">tire suas dúvidas.</span></SectionTitle><div className="border-t border-border">{FAQ.map(([q,a],i)=><div key={q} className="border-b border-border"><button className="flex w-full items-center justify-between gap-5 py-5 text-left font-heading text-sm font-semibold text-foreground" onClick={()=>setOpenFaq(openFaq===i?-1:i)} aria-expanded={openFaq===i}>{q}<ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform",openFaq===i&&"rotate-180")}/></button>{openFaq===i&&<motion.p initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}} className="pb-5 text-sm leading-6 text-muted-foreground">{a}</motion.p>}</div>)}</div></div></section>

        <section className="relative overflow-hidden py-32 sm:py-44"><div className="landing-grid absolute inset-0"/><motion.div animate={reduce?undefined:{rotate:360}} transition={{duration:48,repeat:Infinity,ease:"linear"}} className="cta-orbit absolute left-1/2 top-1/2 aspect-square w-[680px] -translate-x-1/2 -translate-y-1/2"/><div className="relative mx-auto max-w-4xl px-5 text-center"><Reveal><Sparkles className="mx-auto h-5 w-5 text-primary"/><h2 className="mt-7 font-heading text-4xl font-semibold leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">Sua próxima venda<br/>começa <span className="text-primary">agora.</span></h2><p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-muted-foreground">Entre em uma infraestrutura criada para transformar ambição em uma operação previsível.</p><Button size="lg" onClick={signup} className="mt-9 h-12 px-8">Criar minha conta <ArrowRight/></Button></Reveal></div></section>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:flex-row sm:items-center lg:px-8"><Wordmark/><div className="flex flex-wrap gap-5 text-xs text-muted-foreground sm:ml-auto"><a href="/documentacao">Documentação</a><a href="/termos-de-uso">Termos</a><a href="/politica-de-privacidade">Privacidade</a><a href="/status">Status</a></div><p className="font-mono text-[9px] text-muted-foreground">© {new Date().getFullYear()} HOTZFY</p></div></footer>
    </div>
  );
}