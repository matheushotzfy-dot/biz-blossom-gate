/**
 * LandingPage — página pública da VENXPAY.
 *
 * Direção: fintech brasileira de infoprodutos. A confiança vem de elementos
 * concretos (produto real, prazos, taxas, integrações, rostos, respostas) e não
 * de efeitos decorativos. Todo o conteúdo é estático/apresentacional — nenhuma
 * consulta é feita a partir daqui.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Banknote, BarChart3, Boxes, ChevronDown,
  Code2, CreditCard, Gift, Headphones, LineChart, LockKeyhole, Menu, Percent,
  PlayCircle, QrCode, ShieldCheck, Sparkles, Star, Users, Wallet, X, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { ProductMock } from "@/components/landing/ProductMock";
import { HeroStage } from "@/components/landing/HeroStage";
import { ConversionScene } from "@/components/landing/ConversionScene";

import producer1 from "@/assets/landing/producer-1.jpg";
import producer2 from "@/assets/landing/producer-2.jpg";
import producer3 from "@/assets/landing/producer-3.jpg";
import logoUtmify from "@/assets/apps/utmify.png";
import logoVoxuy from "@/assets/apps/voxuy.png";
import logoSpedy from "@/assets/apps/spedy.png";
import logoCademi from "@/assets/apps/cademi.png";
import logoMemberkit from "@/assets/apps/memberkit.png";
import logoThemembers from "@/assets/apps/themembers.png";
import logoAstron from "@/assets/apps/astron_members.png";
import logoActive from "@/assets/apps/activecampaign.png";
import logoZapi from "@/assets/apps/zapi.webp";
import logoSms from "@/assets/apps/smsfunnel.png";

/* ------------------------------------------------------------------ dados */

const NAV = [
  ["Taxas", "#taxas"],
  ["Plataforma", "#plataforma"],
  ["Checkout", "#checkout"],
  ["Integrações", "#integracoes"],
  ["Produtores", "#produtores"],
] as const;

const METHODS = [
  { icon: QrCode, name: "Pix", note: "Aprovação em segundos", term: "Liquidação D+0" },
  { icon: CreditCard, name: "Cartão de crédito", note: "Até 12x com antecipação", term: "Recebimento D+2" },
  { icon: Banknote, name: "Boleto bancário", note: "Compensação automática", term: "Recebimento D+1" },
  { icon: Wallet, name: "Carteiras digitais", note: "Apple Pay e Google Pay", term: "Recebimento D+2" },
] as const;

const INTEGRATIONS = [
  { src: logoUtmify, name: "UTMify" },
  { src: logoVoxuy, name: "Voxuy" },
  { src: logoSpedy, name: "Spedy" },
  { src: logoCademi, name: "Cademi" },
  { src: logoMemberkit, name: "Memberkit" },
  { src: logoThemembers, name: "The Members" },
  { src: logoAstron, name: "Astron Members" },
  { src: logoActive, name: "ActiveCampaign" },
  { src: logoZapi, name: "Z-API" },
  { src: logoSms, name: "SMS Funnel" },
] as const;

const FEATURES = [
  { icon: Zap, title: "Saque no mesmo dia", copy: "Solicite pelo painel e receba via Pix em minutos, inclusive fim de semana e feriado." },
  { icon: Users, title: "Afiliados e coprodução", copy: "Comissões divididas automaticamente no momento em que o pagamento é aprovado." },
  { icon: BarChart3, title: "Métricas em tempo real", copy: "Faturamento, aprovação, reembolso e chargeback atualizados a cada transação." },
  { icon: Boxes, title: "Área de membros inclusa", copy: "Liberação automática do conteúdo assim que a compra é confirmada." },
  { icon: ShieldCheck, title: "Antifraude em camadas", copy: "Identidade, dispositivo, IP e velocidade analisados antes da autorização." },
  { icon: Gift, title: "Premiações por marco", copy: "Placas e reconhecimento a cada nova faixa de faturamento na plataforma." },
] as const;

const CHECKOUT_ITEMS = [
  "Order bump e upsell em um clique",
  "Recuperação automática de Pix não pago",
  "Cupons, banners e prova social nativos",
  "Pixels de Meta, Google e TikTok integrados",
  "Checkout responsivo carregando em menos de 1s",
] as const;

const TESTIMONIALS = [
  {
    photo: producer1, name: "Rafael Andrade", role: "Educação · 3 produtos",
    quote: "Migrei sete operações em uma semana. O que mais pesou foi o saque cair no mesmo dia — eu reinvisto em tráfego sem esperar D+30.",
    metric: "R$ 1,2M em 6 meses",
  },
  {
    photo: producer2, name: "Camila Nunes", role: "Mentorias de alto ticket",
    quote: "O checkout mudou o jogo. Order bump e recuperação de Pix trouxeram receita que eu simplesmente perdia antes.",
    metric: "+27% de conversão",
  },
  {
    photo: producer3, name: "Bruno Teixeira", role: "SaaS e comunidades",
    quote: "Integrei minha aplicação pela API em uma tarde. Webhook assinado, documentação limpa e nenhuma surpresa em produção.",
    metric: "98,7% de aprovação",
  },
] as const;

const FAQ = [
  ["Existe mensalidade ou faturamento mínimo?", "Não. Você não paga nada para criar a conta, publicar produtos ou manter a operação ativa. A cobrança acontece apenas sobre vendas aprovadas."],
  ["Quando o dinheiro fica disponível para saque?", "Vendas no Pix são liquidadas em D+0, boleto em D+1 e cartão em D+2 com antecipação. O saque é solicitado no painel e cai via Pix na conta cadastrada."],
  ["A área de membros está inclusa?", "Sim. Cada produto pode ter módulos, aulas, materiais e certificados, com liberação automática assim que o pagamento é aprovado."],
  ["Como funciona o sistema de afiliados?", "Você define a comissão, gera o link e o split é calculado no evento de pagamento. Coprodutores também recebem automaticamente, sem repasse manual."],
  ["Posso integrar minha própria aplicação?", "Sim. A API REST pública, os webhooks assinados com HMAC-SHA256 e a documentação cobrem todo o ciclo: cobrança, aprovação, reembolso e estorno."],
  ["Vocês aceitam produtos físicos e assinaturas?", "Sim, além de infoprodutos a plataforma suporta produtos físicos, recorrência e ofertas com múltiplos preços."],
  ["Qual é o suporte oferecido?", "Atendimento humano por chat e e-mail todos os dias, com fila prioritária para contas em escala e gerente dedicado a partir de determinado volume."],
  ["Meus dados e os dos meus clientes estão seguros?", "Toda a plataforma roda com criptografia em trânsito, isolamento por conta no banco de dados, trilha de auditoria imutável e monitoramento antifraude contínuo."],
] as const;

const JSONLD = [
  { "@context": "https://schema.org", "@type": "Organization", name: "VENXPAY", url: "https://hotzfy.com.br", description: "Plataforma de pagamentos para produtos digitais com checkout de alta conversão e saque no mesmo dia." },
  { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
];

/* ------------------------------------------------------------- utilitários */

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 26 }}
        animate={visible ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-foreground", className)}>
      <span className="lp-brand">H</span>
      venxpay
    </span>
  );
}

function SectionHead({ kicker, title, copy, center }: { kicker: string; title: ReactNode; copy?: string; center?: boolean }) {
  return (
    <Reveal className={cn(center && "text-center")}>
      <span className="lp-kicker">{kicker}</span>
      <h2 className={cn("mt-4 text-[30px] font-extrabold leading-[1.08] text-foreground sm:text-[42px]", center && "mx-auto max-w-3xl")}>
        {title}
      </h2>
      {copy && (
        <p className={cn("mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground", center && "mx-auto")}>{copy}</p>
      )}
    </Reveal>
  );
}


/** Painel real da plataforma que se "desdobra" conforme o scroll avança. */
function UnfoldMock() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 90%", "end 40%"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 24, mass: 0.4 });
  const rotateX = useTransform(smooth, [0, 0.7], [14, 0]);
  const scale = useTransform(smooth, [0, 0.7], [0.93, 1]);
  const opacity = useTransform(smooth, [0, 0.35], [0, 1]);

  return (
    <div ref={ref} className="mt-16" style={{ perspective: 1500 }}>
      <motion.div style={reduce ? undefined : { rotateX, scale, opacity, transformPerspective: 1500 }}>
        <ProductMock floats={false} />
      </motion.div>
    </div>
  );
}

/** Barra fina de progresso de leitura no topo da página. */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return <motion.div aria-hidden className="lp-progress" style={{ scaleX }} />;
}

/* -------------------------------------------------------------- componente */

export default function LandingPage() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState<number>(0);

  useEffect(() => {
    document.documentElement.classList.add("landing-scroll");
    document.body.classList.add("landing-scroll");
    return () => {
      document.documentElement.classList.remove("landing-scroll");
      document.body.classList.remove("landing-scroll");
    };
  }, []);

  const signup = () => navigate("/auth?mode=signup");

  return (
    <div className="tech-scope lp min-h-screen overflow-x-clip bg-background text-foreground">
      <Seo
        title="VENXPAY — Plataforma de pagamentos para produtos digitais"
        description="Checkout de alta conversão, Pix aprovado em segundos e saque no mesmo dia. Afiliados, área de membros, API e antifraude em uma única plataforma."
        path="/"
        jsonLd={JSONLD}
      />

      <ScrollProgress />

      {/* barra de anúncio */}
      <div className="lp-announce">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-5 py-2 text-[11.5px]">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Saque via Pix liberado todos os dias — inclusive sábado, domingo e feriado.</span>
        </div>
      </div>

      {/* topo */}
      <header className="lp-header">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-8 px-5 lg:px-8">
          <button aria-label="Início" onClick={() => navigate("/")}><Wordmark /></button>
          <nav className="hidden items-center gap-7 lg:flex">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">{label}</a>
            ))}
            <a href="/documentacao" className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">Documentação</a>
          </nav>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <Button variant="ghost" className="h-10 rounded-full px-4 text-[13.5px]" onClick={() => navigate("/auth")}>Entrar</Button>
            <Button className="lp-cta h-10 rounded-full px-5 text-[13.5px]" onClick={signup}>Criar minha conta</Button>
          </div>
          <Button variant="outline" size="icon" className="ml-auto rounded-full lg:hidden" aria-label="Abrir menu" onClick={() => setMenu(!menu)}>
            {menu ? <X /> : <Menu />}
          </Button>
        </div>
        {menu && (
          <div className="border-t border-border bg-background px-5 pb-5 lg:hidden">
            <div className="grid">
              {[...NAV, ["Documentação", "/documentacao"] as const].map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMenu(false)} className="border-b border-border/60 py-3.5 text-[14px] text-muted-foreground">{label}</a>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              <Button variant="outline" className="h-11 rounded-full" onClick={() => navigate("/auth")}>Entrar</Button>
              <Button className="lp-cta h-11 rounded-full" onClick={signup}>Criar minha conta</Button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ---------------------------------------------------------- hero */}
        <section className="lp-hero relative overflow-hidden pt-16 sm:pt-24">
          <div className="lp-hero-glow" aria-hidden />
          <div className="lp-hero-grid" aria-hidden />

          <div className="relative mx-auto max-w-7xl px-5 text-center lg:px-8">
            <Reveal>
              <span className="lp-pill">
                <span className="lp-dot" /> Pix aprovado em 412 ms · aprovação média de 98,7%
              </span>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="mx-auto mt-7 max-w-[15ch] text-[40px] font-extrabold leading-[1.02] text-foreground sm:text-[66px] lg:text-[80px]">
                Venda hoje.<br />
                <span className="lp-highlight">Receba hoje.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mx-auto mt-6 max-w-[52ch] text-[15px] leading-7 text-muted-foreground sm:text-[17px]">
                A plataforma de pagamentos que aprova seu Pix em segundos, libera o saque no mesmo dia
                e entrega checkout, afiliados, área de membros e API sem custo fixo.
              </p>
            </Reveal>

            <Reveal delay={0.16}>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" className="lp-cta h-12 rounded-full px-7 text-[14.5px]" onClick={signup}>
                  Criar minha conta <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 rounded-full px-7 text-[14.5px]">
                  <a href="#taxas"><PlayCircle className="h-4 w-4" /> Ver taxas e prazos</a>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.22}>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[12.5px] text-muted-foreground">
                <span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /> Sem mensalidade</span>
                <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-primary" /> Antifraude incluso</span>
                <span className="flex items-center gap-2"><Headphones className="h-4 w-4 text-primary" /> Suporte humano todos os dias</span>
              </div>
            </Reveal>
          </div>

          {/* malha de liquidação em tempo real */}
          <div className="relative mx-auto mt-16 max-w-[1180px] px-5 pb-20 lg:px-8 lg:pb-28">
            <HeroStage />
          </div>
        </section>

        {/* --------------------------------------------------------- números */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border lg:grid-cols-4">
            {[
              ["+12.000", "produtores ativos"],
              ["R$ 200M+", "processados na plataforma"],
              ["98,7%", "aprovação média no Pix"],
              ["D+0", "saque no mesmo dia"],
            ].map(([value, label], i) => (
              <Reveal key={label} delay={i * 0.05} className="bg-background">
                <div className="px-5 py-9 text-center">
                  <p className="lp-mono text-[26px] font-extrabold text-foreground sm:text-[32px]">{value}</p>
                  <p className="mt-2 text-[12px] text-muted-foreground">{label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------- meios de pagamento */}
        <section id="taxas" className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHead
              center
              kicker="Taxas e prazos"
              title={<>Tudo transparente,<br /><span className="lp-highlight">nada no rodapé.</span></>}
              copy="Você conhece o custo antes de vender e o prazo antes de sacar. Sem taxa de adesão, sem mensalidade, sem fidelidade."
            />

            <div className="mt-14 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
              <Reveal>
                <div className="lp-card h-full p-7 sm:p-9">
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                      <p className="text-[12.5px] text-muted-foreground">Taxa por venda aprovada</p>
                      <p className="mt-3 flex items-end gap-2">
                        <span className="lp-mono text-[54px] font-extrabold leading-none text-foreground sm:text-[68px]">4,99</span>
                        <span className="mb-2 text-[22px] font-bold text-primary">%</span>
                        <span className="mb-2.5 text-[14px] text-muted-foreground">+ R$ 1,00</span>
                      </p>
                      <p className="mt-3 text-[13px] text-muted-foreground">
                        Válida para Pix, cartão e boleto. Volumes acima de R$ 300 mil/mês têm condição negociada.
                      </p>
                    </div>
                    <span className="lp-badge"><Percent className="h-3.5 w-3.5" /> Sem custo fixo</span>
                  </div>

                  <div className="mt-8 grid gap-px bg-border sm:grid-cols-2">
                    {METHODS.map(({ icon: Icon, name, note, term }) => (
                      <div key={name} className="bg-card/60 p-5">
                        <span className="lp-icon"><Icon className="h-4 w-4" /></span>
                        <p className="mt-3.5 text-[14px] font-bold text-foreground">{name}</p>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">{note}</p>
                        <p className="lp-mono mt-3 text-[11.5px] font-semibold text-primary">{term}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <div className="lp-card lp-card-accent flex h-full flex-col p-7 sm:p-9">
                  <span className="lp-kicker">Saque</span>
                  <h3 className="mt-4 text-[26px] font-extrabold leading-tight text-foreground">
                    Pix na sua conta<br />em poucos minutos.
                  </h3>
                  <p className="mt-4 text-[14px] leading-6 text-muted-foreground">
                    Solicite pelo painel a qualquer hora. Sem janela bancária, sem esperar segunda-feira.
                  </p>
                  <div className="mt-7 grid gap-3">
                    {[
                      ["Saques por dia", "ilimitados"],
                      ["Horário", "24 horas, 7 dias"],
                      ["Tempo médio", "3 minutos"],
                      ["Reserva de segurança", "sem retenção surpresa"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between border-b border-border/70 pb-3 last:border-0">
                        <span className="text-[13px] text-muted-foreground">{k}</span>
                        <span className="lp-mono text-[13px] font-bold text-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="lp-cta mt-auto h-11 w-full rounded-full pt-0 text-[14px]" onClick={signup}>
                    Começar agora <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- checkout */}
        <section id="checkout" className="border-y border-border bg-card/40 py-24 sm:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-[1fr_.95fr] lg:px-8">
            <div>
              <SectionHead
                kicker="Checkout"
                title={<>Cada detalhe existe<br /><span className="lp-highlight">para converter.</span></>}
                copy="Um passo, campos mínimos e Pix gerado na hora. O resto — recuperação, order bump, pixels — roda em segundo plano."
              />
              <ul className="mt-9 grid gap-3">
                {CHECKOUT_ITEMS.map((item, i) => (
                  <Reveal key={item} delay={i * 0.05}>
                    <li className="flex items-start gap-3 text-[14px] text-muted-foreground">
                      <span className="lp-check"><BadgeCheck className="h-3.5 w-3.5" /></span>
                      {item}
                    </li>
                  </Reveal>
                ))}
              </ul>
              <div className="mt-9 grid grid-cols-3 gap-px bg-border">
                {[["+27%", "conversão"], ["-31%", "abandono"], ["<1s", "carregamento"]].map(([v, l]) => (
                  <div key={l} className="bg-background px-4 py-5">
                    <p className="lp-mono text-[22px] font-extrabold text-foreground">{v}</p>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <Reveal delay={0.1}><ConversionScene /></Reveal>
          </div>
        </section>

        {/* ----------------------------------------------------- plataforma */}
        <section id="plataforma" className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHead
              center
              kicker="Plataforma"
              title={<>Uma operação inteira,<br /><span className="lp-highlight">sem juntar ferramentas.</span></>}
              copy="Pagamento, entrega, comissão, métrica e suporte no mesmo lugar — conversando entre si desde a primeira venda."
            />
            <div className="mt-14 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, copy }, i) => (
                <Reveal key={title} delay={i * 0.05} className="bg-background">
                  <article className="group h-full p-7 transition-colors hover:bg-card/60">
                    <span className="lp-icon"><Icon className="h-4 w-4" /></span>
                    <h3 className="mt-5 text-[16.5px] font-bold text-foreground">{title}</h3>
                    <p className="mt-2.5 text-[13.5px] leading-6 text-muted-foreground">{copy}</p>
                  </article>
                </Reveal>
              ))}
            </div>

            <UnfoldMock />
          </div>
        </section>

        {/* ---------------------------------------------------- integrações */}
        <section id="integracoes" className="border-y border-border bg-card/40 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHead
              center
              kicker="Integrações"
              title={<>Conecte o que você <span className="lp-highlight">já usa.</span></>}
              copy="Área de membros, automação de WhatsApp, e-mail, rastreio de UTM e notas fiscais em poucos cliques."
            />
          </div>
          <div className="lp-marquee mt-12">
            <div className="lp-marquee-track">
              {[...INTEGRATIONS, ...INTEGRATIONS].map((it, i) => (
                <div key={`${it.name}-${i}`} className="lp-logo">
                  <img src={it.src} alt={`Integração ${it.name}`} loading="lazy" width={120} height={40} />
                </div>
              ))}
            </div>
          </div>
          <div className="mx-auto mt-12 max-w-7xl px-5 text-center lg:px-8">
            <Button variant="outline" className="h-11 rounded-full px-6" onClick={() => navigate("/documentacao")}>
              <Code2 className="h-4 w-4" /> Ver API e webhooks
            </Button>
          </div>
        </section>

        {/* ----------------------------------------------------- produtores */}
        <section id="produtores" className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHead
              kicker="Quem vende com a gente"
              title={<>Operações reais,<br /><span className="lp-highlight">números reais.</span></>}
              copy="Produtores de educação, mentoria, comunidade e software rodando o faturamento diário dentro da VENXPAY."
            />
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {TESTIMONIALS.map((t, i) => (
                <Reveal key={t.name} delay={i * 0.07} className="h-full">
                  <figure className="lp-card flex h-full flex-col overflow-hidden">
                    <img
                      src={t.photo}
                      alt={`Retrato de ${t.name}, produtor na VENXPAY`}
                      loading="lazy"
                      width={768}
                      height={960}
                      className="h-64 w-full object-cover object-top"
                    />
                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex gap-0.5 text-primary">
                        {Array.from({ length: 5 }).map((_, s) => <Star key={s} className="h-3.5 w-3.5 fill-current" />)}
                      </div>
                      <blockquote className="mt-4 flex-1 text-[14px] leading-6 text-foreground/90">“{t.quote}”</blockquote>
                      <figcaption className="mt-6 flex items-center justify-between border-t border-border pt-4">
                        <span>
                          <span className="block text-[13.5px] font-bold text-foreground">{t.name}</span>
                          <span className="block text-[12px] text-muted-foreground">{t.role}</span>
                        </span>
                        <span className="lp-mono text-[12px] font-bold text-primary">{t.metric}</span>
                      </figcaption>
                    </div>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ segurança */}
        <section className="border-y border-border bg-card/40 py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
            <SectionHead
              kicker="Segurança"
              title={<>Seu dinheiro tratado<br /><span className="lp-highlight">como infraestrutura.</span></>}
              copy="Cada transação carrega uma trilha auditável do primeiro clique à liquidação — visível para você, imutável para todo mundo."
            />
            <div className="grid gap-px bg-border sm:grid-cols-2">
              {[
                [LockKeyhole, "Criptografia ponta a ponta", "Dados sensíveis nunca trafegam ou são armazenados em texto puro."],
                [ShieldCheck, "Isolamento por conta", "Políticas de acesso no banco garantem que um vendedor jamais veja o dado de outro."],
                [LineChart, "Trilha de auditoria", "Cada mudança de status registrada com origem, IP e horário."],
                [ArrowUpRight, "Monitoramento 24/7", "Alertas automáticos de chargeback, disputa e comportamento atípico."],
              ].map(([Icon, title, copy], i) => {
                const I = Icon as typeof LockKeyhole;
                return (
                  <Reveal key={title as string} delay={i * 0.05} className="bg-background">
                    <div className="h-full p-6">
                      <span className="lp-icon"><I className="h-4 w-4" /></span>
                      <p className="mt-4 text-[14.5px] font-bold text-foreground">{title as string}</p>
                      <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{copy as string}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ faq */}
        <section className="py-24 sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionHead
                kicker="Perguntas frequentes"
                title={<>Antes de criar<br /><span className="lp-highlight">sua conta.</span></>}
                copy="Se ficar qualquer dúvida, o suporte responde no chat em minutos."
              />
            </div>
            <div className="border-t border-border">
              {FAQ.map(([q, a], i) => (
                <div key={q} className="border-b border-border">
                  <button
                    className="flex w-full items-center justify-between gap-5 py-5 text-left text-[14.5px] font-bold text-foreground"
                    onClick={() => setFaq(faq === i ? -1 : i)}
                    aria-expanded={faq === i}
                  >
                    {q}
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", faq === i && "rotate-180 text-primary")} />
                  </button>
                  {faq === i && (
                    <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="pb-5 pr-8 text-[13.5px] leading-6 text-muted-foreground">
                      {a}
                    </motion.p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ cta final */}
        <section className="relative overflow-hidden py-24 sm:py-32">
          <div className="lp-cta-glow" aria-hidden />
          <div className="relative mx-auto max-w-3xl px-5 text-center">
            <Reveal>
              <span className="lp-pill"><span className="lp-dot" /> Conta criada em menos de 3 minutos</span>
              <h2 className="mt-7 text-[34px] font-extrabold leading-[1.05] text-foreground sm:text-[54px]">
                Comece a vender<br /><span className="lp-highlight">ainda hoje.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground">
                Sem mensalidade, sem burocracia e com o dinheiro caindo no mesmo dia da venda.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" className="lp-cta h-12 rounded-full px-8 text-[14.5px]" onClick={signup}>
                  Criar minha conta <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 rounded-full px-8 text-[14.5px]" onClick={() => navigate("/auth")}>
                  Já tenho conta
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------- rodapé */}
      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Wordmark />
              <p className="mt-4 max-w-xs text-[13px] leading-6 text-muted-foreground">
                Infraestrutura de pagamentos para quem vive de produto digital no Brasil.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Pix", "Cartão", "Boleto", "SSL 256-bit"].map((s) => (
                  <span key={s} className="lp-seal">{s}</span>
                ))}
              </div>
            </div>
            {[
              ["Plataforma", [["Taxas", "#taxas"], ["Checkout", "#checkout"], ["Integrações", "#integracoes"], ["Documentação", "/documentacao"]]],
              ["Conta", [["Entrar", "/auth"], ["Criar conta", "/auth?mode=signup"], ["Status", "/status"]]],
              ["Legal", [["Termos de uso", "/termos-de-uso"], ["Política de privacidade", "/politica-de-privacidade"], ["Política de cookies", "/politica-de-cookies"]]],
            ].map(([title, links]) => (
              <div key={title as string}>
                <p className="text-[12.5px] font-bold uppercase tracking-wide text-foreground">{title as string}</p>
                <ul className="mt-4 grid gap-2.5">
                  {(links as [string, string][]).map(([label, href]) => (
                    <li key={href}><a href={href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">{label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-[11.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} VENXPAY Tecnologia e Pagamentos. Todos os direitos reservados.</p>
            <p>Feito no Brasil · Suporte todos os dias</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
