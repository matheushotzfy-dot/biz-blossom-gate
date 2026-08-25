/**
 * HOTZFY — Landing page (v3)
 * Direção: fintech de infraestrutura — hero centralizado, mockup real do
 * produto, seções simétricas, tipografia grande e ritmo vertical constante.
 * Toda a página vive sob `.tech-scope` (camada TECH LAYER no index.css) para
 * manter o clean pass do restante da plataforma intacto.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Shield, BarChart3, Users, CheckCircle2, QrCode, Wallet, Code2,
  Lock, Menu, X, Minus, Plus, Radio, Gauge, Fingerprint, Zap, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";
import { ProductMock } from "@/components/landing/ProductMock";

/* ───────────────────────────── dados ───────────────────────────── */

const NAV_LINKS = [
  { label: "Plataforma", href: "#plataforma" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Segurança", href: "#seguranca" },
  { label: "Preços", href: "#precos" },
  { label: "FAQ", href: "#faq" },
];

const METRICS = [
  { value: "R$ 200M+", label: "TPV processado" },
  { value: "98,7%", label: "Aprovação no PIX" },
  { value: "99,99%", label: "Uptime da API" },
  { value: "D+0", label: "Liquidação de saque" },
];

const FEATURES = [
  { icon: QrCode, title: "Checkout de alta conversão", desc: "PIX instantâneo, cartão em até 12x e boleto no mesmo fluxo, com order bump e upsell nativos." },
  { icon: Shield, title: "Antifraude em tempo real", desc: "Blacklist global, velocity checks, bloqueio por BIN/IP e trilha de decisão por transação." },
  { icon: BarChart3, title: "Analytics sem atraso", desc: "Faturamento, funil, reembolso e chargeback atualizados ao vivo, com filtros por período." },
  { icon: Users, title: "Área de membros", desc: "Liberação automática pós-pagamento, player profissional, progresso, quiz e certificado." },
  { icon: Wallet, title: "Saques e antecipação", desc: "PIX ou cripto, presets rápidos, regras automáticas de saque e histórico auditável." },
  { icon: Code2, title: "API REST e webhooks", desc: "Chaves sk_live_, assinatura HMAC-SHA256, reentrega automática e logs de entrega." },
];

const STEPS = [
  { n: "01", title: "Crie sua conta", desc: "Cadastro em minutos, com verificação de identidade guiada passo a passo." },
  { n: "02", title: "Publique seu produto", desc: "Checkout pronto, link de pagamento e área de membros já inclusos no plano." },
  { n: "03", title: "Receba e saque", desc: "Aprovação em segundos e saque via PIX com liquidação no mesmo dia." },
];

const SECURITY = [
  { icon: Lock, title: "Criptografia ponta a ponta", desc: "TLS 1.3 em trânsito e AES-256 em repouso, com rotação periódica de chaves." },
  { icon: Fingerprint, title: "Isolamento por vendedor", desc: "Row Level Security no banco: cada conta acessa somente os próprios dados." },
  { icon: Radio, title: "Webhooks assinados", desc: "HMAC-SHA256 por evento, reentrega automática e log completo de entrega." },
  { icon: Gauge, title: "Observabilidade 24/7", desc: "Monitoramento de adquirentes, alertas de anomalia e trilha de auditoria." },
];

const PLANS = [
  {
    name: "Start", price: "4,99%", note: "+ R$ 1,00 por transação aprovada",
    items: ["Sem mensalidade", "PIX, cartão e boleto", "Área de membros", "Suporte por chat"],
    featured: false,
  },
  {
    name: "Scale", price: "3,99%", note: "+ R$ 1,00 por transação aprovada",
    items: ["Tudo do Start", "Afiliados e coprodução", "API REST + webhooks", "Gerente de contas"],
    featured: true,
  },
  {
    name: "Enterprise", price: "Sob medida", note: "Condições por volume negociado",
    items: ["Tudo do Scale", "Taxas personalizadas", "Antecipação dedicada", "SLA e suporte prioritário"],
    featured: false,
  },
];

const INTEGRATIONS = [
  "PIX", "Cartão 12x", "Boleto", "API REST", "Webhooks", "Utmify",
  "Meta Pixel", "Google Ads", "TikTok Pixel", "Zapier", "Notazz", "Z-API",
];

const FAQ = [
  { q: "Preciso pagar mensalidade?", a: "Não. Você paga apenas uma taxa por transação aprovada, sem custo fixo mensal e sem fidelidade." },
  { q: "Em quanto tempo recebo o dinheiro?", a: "Vendas no PIX são aprovadas em segundos e os saques são liquidados em D+0, direto na sua chave." },
  { q: "Quais métodos de pagamento estão disponíveis?", a: "PIX, cartão de crédito em até 12x e boleto bancário — todos no mesmo checkout." },
  { q: "Tem área de membros inclusa?", a: "Sim, com liberação automática pós-pagamento, player profissional, progresso, quiz e certificado." },
  { q: "Existe sistema de afiliados?", a: "Sim, com comissões configuráveis, links rastreáveis e divisão automática dos valores na aprovação." },
  { q: "Como funciona a segurança?", a: "Criptografia em trânsito e em repouso, antifraude com blacklist global, velocity checks e auditoria completa de acessos." },
];

const TESTIMONIALS = [
  { name: "Rafael Menezes", role: "Infoprodutor · educação", text: "Migramos 100% do faturamento para a HOTZFY. A aprovação no PIX subiu e o saque no mesmo dia mudou nosso fluxo de caixa." },
  { name: "Camila Duarte", role: "Head de growth · e-learning", text: "O checkout converte melhor que o anterior e o painel entrega os números sem atraso. Parou de ser planilha." },
  { name: "Lucas Ferreira", role: "Coprodutor · lançamentos", text: "Split automático entre coprodutores e afiliados sem dor de cabeça. A API e os webhooks resolveram nossa automação." },
];

const JSONLD = [
  { "@context": "https://schema.org", "@type": "Organization", name: "HOTZFY", url: "https://hotzfy.com.br" },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

/* ───────────────────────────── primitivas ───────────────────────────── */

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-70px" });
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={reduce ? undefined : { opacity: 0, y: 20 }}
        animate={inView && !reduce ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function SectionHead({ eyebrow, title, accent, sub }: { eyebrow: string; title: string; accent?: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {eyebrow}
      </span>
      <h2 className="mt-5 text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[42px]">
        {title} {accent && <span className="tech-text">{accent}</span>}
      </h2>
      {sub && <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="flex items-center justify-center rounded-lg bg-emerald-400/12 font-black text-emerald-300"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        H
      </span>
      <span className="text-[17px] font-black tracking-[-0.04em] text-foreground">
        HOTZ<span className="tech-text">FY</span>
      </span>
    </span>
  );
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className={cn("rounded-2xl border transition-colors", open ? "border-emerald-400/30 bg-foreground/[0.03]" : "border-border/70")}>
      <button onClick={onToggle} className="flex w-full items-center gap-4 px-5 py-4 text-left" aria-expanded={open}>
        <span className="flex-1 text-[14.5px] font-semibold text-foreground">{q}</span>
        {open ? <Minus className="h-4 w-4 shrink-0 text-emerald-300" /> : <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && <p className="px-5 pb-5 text-[14px] leading-relaxed text-muted-foreground">{a}</p>}
    </div>
  );
}

/* ───────────────────────────── página ───────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goSignup = () => navigate("/auth?mode=signup");

  return (
    <div className="tech-scope min-h-screen bg-background text-foreground antialiased">
      <Seo
        title="HOTZFY — Infraestrutura de pagamentos para infoprodutos"
        description="Checkout de alta conversão, antifraude, área de membros, afiliados e saque PIX D+0 em uma única plataforma. Sem mensalidade."
        path="/"
        jsonLd={JSONLD}
      />

      {/* ═══════════ HEADER ═══════════ */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled ? "border-b border-border/70 bg-background/85 backdrop-blur-xl" : "border-b border-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <button onClick={() => navigate("/")} aria-label="HOTZFY" className="shrink-0">
            <Wordmark />
          </button>

          <nav className="mx-auto hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <button onClick={() => navigate("/auth")} className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted">
              Entrar
            </button>
            <button onClick={goSignup} className="tech-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-bold">
              Criar conta <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground lg:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur-xl lg:hidden">
            <div className="grid gap-1">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-muted-foreground">
                  {l.label}
                </a>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => navigate("/auth")} className="rounded-lg border border-border py-2.5 text-[13px] font-semibold">Entrar</button>
              <button onClick={goSignup} className="tech-cta rounded-lg py-2.5 text-[13px] font-bold">Criar conta</button>
            </div>
          </div>
        )}
      </header>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden pb-24 pt-32 sm:pt-40">
        <div aria-hidden className="tech-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="tech-aurora pointer-events-none absolute inset-x-0 top-0 h-[620px]" />

        <div className="relative mx-auto max-w-6xl px-5 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-1.5 text-[12px] font-medium text-emerald-300">
              <span className="tech-pulse h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Infraestrutura de pagamentos para o Brasil
            </span>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="mx-auto mt-7 max-w-4xl text-balance text-[38px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[62px]">
              Venda, receba e escale com <span className="tech-text">pagamentos de verdade</span>
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
              Checkout de alta conversão, antifraude em tempo real, área de membros, afiliados e
              saque PIX no mesmo dia — tudo em uma única plataforma, sem mensalidade.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button onClick={goSignup} className="tech-cta inline-flex h-12 items-center gap-2 rounded-xl px-7 text-[14.5px] font-bold">
                Criar conta grátis <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#plataforma" className="inline-flex h-12 items-center gap-2 rounded-xl border border-border px-6 text-[14.5px] font-semibold text-foreground transition-colors hover:bg-muted">
                Conheça a plataforma
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-col items-center gap-2">
              <div className="flex -space-x-2">
                {["A", "B", "C", "D", "E"].map((c, i) => (
                  <span
                    key={c}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-emerald-400/15 text-[11px] font-bold text-emerald-300"
                    style={{ zIndex: 5 - i }}
                  >
                    {c}
                  </span>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-emerald-400 text-emerald-400" />
                <span className="font-semibold text-foreground">+12.000</span> produtores digitais já operam na HOTZFY
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.3} className="mt-16">
            <ProductMock />
          </Reveal>
        </div>
      </section>

      {/* ═══════════ MÉTRICAS ═══════════ */}
      <section className="border-y border-border/70">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y divide-border/70 px-5 sm:divide-y-0 lg:grid-cols-4">
          {METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i * 0.05} className="px-4 py-9 text-center">
              <p className="tech-mono text-[26px] font-bold tracking-[-0.03em] text-foreground sm:text-[32px]">{m.value}</p>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">{m.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ INTEGRAÇÕES (marquee) ═══════════ */}
      <section className="overflow-hidden border-b border-border/70 py-6">
        <div className="flex w-max tech-marquee items-center gap-10 px-5">
          {[...INTEGRATIONS, ...INTEGRATIONS].map((t, i) => (
            <span key={`${t}-${i}`} className="flex items-center gap-2 whitespace-nowrap text-[13px] font-medium text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-emerald-400/70" /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════ PLATAFORMA ═══════════ */}
      <section id="plataforma" className="py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <SectionHead
              eyebrow="Plataforma"
              title="Uma operação completa,"
              accent="sem peças soltas"
              sub="Módulos integrados de ponta a ponta: da captura da venda ao repasse do dinheiro."
            />
          </Reveal>

          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <div className="tech-panel tech-panel-hover h-full rounded-2xl p-6 transition-colors">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                    <f.icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.02em] text-foreground">{f.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ COMO FUNCIONA ═══════════ */}
      <section id="como-funciona" className="border-y border-border/70 bg-foreground/[0.015] py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal><SectionHead eyebrow="Como funciona" title="Da conta criada à" accent="primeira venda" /></Reveal>
          <div className="mt-14 grid gap-3 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.07}>
                <div className="relative h-full rounded-2xl border border-border/70 p-7">
                  <span className="tech-mono text-[13px] font-bold text-emerald-300">{s.n}</span>
                  <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-foreground">{s.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SEGURANÇA ═══════════ */}
      <section id="seguranca" className="py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
              <Shield className="h-3.5 w-3.5" /> Segurança
            </span>
            <h2 className="mt-5 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
              Infraestrutura pronta para <span className="tech-text">volume alto</span>
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Cada camada foi construída para operar sob carga: isolamento por vendedor, trilha de
              auditoria imutável e monitoramento contínuo das adquirentes.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["LGPD", "TLS 1.3", "AES-256", "HMAC-SHA256", "RLS"].map((t) => (
                <span key={t} className="tech-mono rounded-lg border border-border/70 px-2.5 py-1 text-[11.5px] text-muted-foreground">{t}</span>
              ))}
            </div>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {SECURITY.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.06}>
                <div className="tech-panel h-full rounded-2xl p-5">
                  <s.icon className="h-5 w-5 text-emerald-300" strokeWidth={1.9} />
                  <h3 className="mt-4 text-[14.5px] font-semibold tracking-[-0.02em] text-foreground">{s.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ DEPOIMENTOS ═══════════ */}
      <section className="border-y border-border/70 bg-foreground/[0.015] py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal><SectionHead eyebrow="Clientes" title="Quem opera com a" accent="HOTZFY" /></Reveal>
          <div className="mt-14 grid gap-3 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.06}>
                <figure className="h-full rounded-2xl border border-border/70 bg-background/40 p-6">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className="h-3.5 w-3.5 fill-emerald-400 text-emerald-400" />
                    ))}
                  </div>
                  <blockquote className="mt-4 text-[14px] leading-relaxed text-foreground">“{t.text}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/12 text-[12px] font-bold text-emerald-300">
                      {t.name.charAt(0)}
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold text-foreground">{t.name}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PREÇOS ═══════════ */}
      <section id="precos" className="py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <SectionHead
              eyebrow="Preços"
              title="Sem mensalidade."
              accent="Você paga quando vende"
              sub="Taxa única por transação aprovada. Sem fidelidade, sem letra miúda."
            />
          </Reveal>

          <div className="mt-14 grid items-stretch gap-3 lg:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.06} className="h-full">
                <div
                  className={cn(
                    "flex h-full flex-col rounded-2xl p-7",
                    p.featured ? "tech-panel tech-ring relative border border-emerald-400/30" : "border border-border/70",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">{p.name}</h3>
                    {p.featured && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/12 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-emerald-300">
                        <Zap className="h-3 w-3" /> Popular
                      </span>
                    )}
                  </div>
                  <p className="tech-mono mt-6 text-[38px] font-bold leading-none tracking-[-0.04em] text-foreground">{p.price}</p>
                  <p className="mt-2 text-[12.5px] text-muted-foreground">{p.note}</p>
                  <ul className="mt-7 flex-1 space-y-3">
                    {p.items.map((it) => (
                      <li key={it} className="flex items-start gap-2.5 text-[13.5px] text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" strokeWidth={2} />
                        {it}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={goSignup}
                    className={cn(
                      "mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold transition-colors",
                      p.featured ? "tech-cta" : "border border-border text-foreground hover:bg-muted",
                    )}
                  >
                    Começar agora <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section id="faq" className="border-t border-border/70 py-24">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal><SectionHead eyebrow="Dúvidas" title="Perguntas" accent="frequentes" /></Reveal>
          <div className="mt-12 grid gap-2.5">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.04}>
                <FaqItem q={f.q} a={f.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="relative overflow-hidden border-t border-border/70 py-28">
        <div aria-hidden className="tech-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="tech-aurora pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <Reveal>
            <h2 className="text-balance text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[46px]">
              Pronto para operar na <span className="tech-text">velocidade do PIX?</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">
              Crie sua conta, publique seu produto e receba a primeira venda ainda hoje.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button onClick={goSignup} className="tech-cta inline-flex h-12 items-center gap-2 rounded-xl px-7 text-[14.5px] font-bold">
                Criar conta grátis <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => navigate("/documentacao")} className="inline-flex h-12 items-center gap-2 rounded-xl border border-border px-6 text-[14.5px] font-semibold text-foreground transition-colors hover:bg-muted">
                <Code2 className="h-4 w-4" /> Documentação
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ RODAPÉ ═══════════ */}
      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 py-9 sm:flex-row">
          <Wordmark size={24} />
          <div className="flex flex-wrap items-center justify-center gap-6 text-[12.5px] text-muted-foreground">
            <a href="/documentacao" className="transition-colors hover:text-foreground">Documentação</a>
            <a href="/termos" className="transition-colors hover:text-foreground">Termos</a>
            <a href="/privacidade" className="transition-colors hover:text-foreground">Privacidade</a>
            <a href="/status" className="transition-colors hover:text-foreground">Status</a>
          </div>
          <p className="tech-mono text-[11.5px] text-muted-foreground">© {new Date().getFullYear()} HOTZFY</p>
        </div>
      </footer>
    </div>
  );
}
