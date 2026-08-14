/**
 * HOTZFY — Landing page
 * Estética "clean & seca": superfícies planas, bordas hairline, grid simétrico,
 * tipografia sóbria e revelações discretas no scroll.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Shield, Zap, BarChart3, Users, CheckCircle2,
  QrCode, Wallet, Code2, Lock, Layers, Activity, Menu, X, Minus, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";
import { HotzfyLogo } from "@/components/HotzfyLogo";

/* ─────────────────────────── dados ─────────────────────────── */

const METRICS = [
  { value: "R$ 200M+", label: "TPV processado" },
  { value: "98,7%", label: "Aprovação PIX" },
  { value: "99,99%", label: "Uptime da API" },
  { value: "D+0", label: "Liquidação de saque" },
];

const FEATURES = [
  { icon: QrCode, title: "Checkout de alta conversão", desc: "PIX instantâneo, cartão em até 12x e boleto no mesmo fluxo, com order bump e upsell nativos." },
  { icon: Shield, title: "Antifraude em tempo real", desc: "Blacklist global, velocity checks, bloqueio por BIN/IP e trilha completa de decisão por transação." },
  { icon: BarChart3, title: "Analytics sem atraso", desc: "Faturamento, funil, reembolso e chargeback atualizados ao vivo, com filtros por período." },
  { icon: Users, title: "Área de membros", desc: "Liberação automática pós-pagamento, player profissional, progresso, quiz e certificado." },
  { icon: Wallet, title: "Saques e antecipação", desc: "PIX ou cripto, presets rápidos, regras automáticas de saque e histórico auditável." },
  { icon: Code2, title: "API REST e webhooks", desc: "Chaves sk_live_, assinatura HMAC-SHA256, reentrega automática e logs de entrega." },
];

const STEPS = [
  { n: "01", title: "Crie sua conta", desc: "Cadastro em minutos com verificação de identidade guiada." },
  { n: "02", title: "Publique seu produto", desc: "Checkout pronto, link de pagamento e área de membros inclusos." },
  { n: "03", title: "Receba e saque", desc: "Aprovação em segundos e saque PIX com liquidação D+0." },
];

const PLANS = [
  {
    name: "Start", price: "4,99%", note: "+ R$ 1,00 por transação aprovada",
    items: ["Sem mensalidade", "Checkout PIX, cartão e boleto", "Área de membros", "Suporte por chat"],
    featured: false,
  },
  {
    name: "Scale", price: "3,99%", note: "+ R$ 1,00 por transação aprovada",
    items: ["Tudo do Start", "Afiliados e coprodução", "API + webhooks", "Gerente de contas"],
    featured: true,
  },
  {
    name: "Enterprise", price: "Sob medida", note: "Condições por volume negociado",
    items: ["Tudo do Scale", "Taxas personalizadas", "Antecipação dedicada", "SLA e suporte prioritário"],
    featured: false,
  },
];

const INTEGRATIONS = ["PIX", "Cartão 12x", "Boleto", "Webhooks", "API REST", "Utmify", "Meta Pixel", "Google Ads", "TikTok Pixel", "Zapier", "Notazz", "Kiwify Import"];

const FAQ = [
  { q: "Preciso pagar mensalidade?", a: "Não. Você paga apenas uma taxa por transação aprovada, sem custo fixo mensal." },
  { q: "Em quanto tempo recebo o dinheiro?", a: "Vendas no PIX são aprovadas em segundos e os saques são liquidados em D+0." },
  { q: "Quais métodos de pagamento estão disponíveis?", a: "PIX, cartão de crédito em até 12x e boleto, todos no mesmo checkout." },
  { q: "Tem área de membros inclusa?", a: "Sim, com liberação automática, player profissional, progresso, quiz e certificado." },
  { q: "Existe sistema de afiliados?", a: "Sim, com comissões configuráveis, links rastreáveis e divisão automática de valores." },
  { q: "Como funciona a segurança?", a: "Criptografia em trânsito e repouso, antifraude com blacklist global, velocity checks e auditoria de acessos." },
];

const JSONLD = [
  { "@context": "https://schema.org", "@type": "Organization", name: "HOTZFY", url: "https://hotzfy.com.br" },
  { "@context": "https://schema.org", "@type": "WebSite", name: "HOTZFY", url: "https://hotzfy.com.br" },
  { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
];

/* ─────────────────────────── primitivos ─────────────────────────── */

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-[28px] sm:text-[34px] font-semibold leading-[1.15] tracking-[-0.02em] text-foreground">{title}</h2>
      {desc && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{desc}</p>}
    </div>
  );
}

/* ─────────────────────────── navegação ─────────────────────────── */

function Nav() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const links = [
    { href: "#recursos", label: "Recursos" },
    { href: "#como-funciona", label: "Como funciona" },
    { href: "#precos", label: "Preços" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 border-b transition-colors", scrolled ? "border-border bg-background/95 backdrop-blur" : "border-transparent bg-transparent")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <button onClick={() => navigate("/")} className="flex items-center" aria-label="HOTZFY">
          <HotzfyLogo size={28} withWordmark />
        </button>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">{l.label}</a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button onClick={() => navigate("/auth")} className="rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
            Entrar
          </button>
          <button onClick={() => navigate("/auth?mode=signup")} className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            Criar conta
          </button>
        </div>

        <button onClick={() => setOpen(v => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground md:hidden" aria-label="Menu">
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-5 py-4 md:hidden">
          <div className="grid gap-1">
            {links.map(l => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-[14px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">{l.label}</a>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => navigate("/auth")} className="rounded-lg border border-border px-3 py-2.5 text-[13px] font-medium text-foreground">Entrar</button>
            <button onClick={() => navigate("/auth?mode=signup")} className="rounded-lg bg-primary px-3 py-2.5 text-[13px] font-semibold text-primary-foreground">Criar conta</button>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────── mock do produto ─────────────────────────── */

function DashboardMock() {
  const bars = [38, 52, 44, 66, 58, 78, 71, 88, 74, 92, 84, 100];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[12.5px] font-semibold text-foreground">Painel HOTZFY</span>
        </div>
        <span className="rounded-md border border-border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Ao vivo</span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {[
          { l: "Faturamento hoje", v: "R$ 184.320" },
          { l: "Vendas aprovadas", v: "1.284" },
          { l: "Ticket médio", v: "R$ 143,50" },
          { l: "Conversão", v: "7,4%" },
        ].map(k => (
          <div key={k.l} className="bg-card px-4 py-4">
            <p className="text-[11.5px] text-muted-foreground">{k.l}</p>
            <p className="mt-1 font-mono text-[19px] font-semibold tabular-nums text-foreground">{k.v}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 pb-5 pt-4">
        <div className="flex h-32 items-end gap-1.5">
          {bars.map((b, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              whileInView={{ height: `${b}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 rounded-t bg-primary/70"
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Últimas 12 horas</span>
          <span className="font-mono tabular-nums">+18,2% vs ontem</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-3">
        {[
          { n: "Ana Ribeiro", p: "Mentoria Pro", v: "R$ 1.997,00" },
          { n: "Carlos Lima", p: "Curso Avançado", v: "R$ 497,00" },
          { n: "Julia Souza", p: "Combo Anual", v: "R$ 2.480,00" },
        ].map(t => (
          <div key={t.n} className="bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-foreground">{t.n}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">{t.p}</p>
              </div>
              <span className="shrink-0 font-mono text-[12.5px] font-semibold tabular-nums text-primary">{t.v}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── FAQ ─────────────────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left">
        <span className="text-[14px] font-medium text-foreground">{q}</span>
        {open ? <Minus className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && <p className="border-t border-border px-4 py-4 text-[13.5px] leading-relaxed text-muted-foreground">{a}</p>}
    </div>
  );
}

/* ─────────────────────────── página ─────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const yearRef = useRef(new Date().getFullYear());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="HOTZFY — Plataforma de pagamentos e infoprodutos"
        description="Checkout PIX, cartão e boleto com aprovação em segundos, área de membros, afiliados, API e saque D+0. Sem mensalidade."
        jsonLd={JSONLD}
      />
      <Nav />

      <main>
        {/* HERO */}
        <section className="border-b border-border px-5 pb-16 pt-28 sm:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11.5px] font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Infraestrutura de pagamentos brasileira
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-6 text-[36px] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[54px]">
                Venda, receba e escale
                <br className="hidden sm:block" /> com uma stack só
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">
                Checkout de alta conversão, antifraude em tempo real, área de membros e saque PIX no mesmo dia.
                Sem mensalidade, sem burocracia.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <button onClick={() => navigate("/auth?mode=signup")} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto">
                  Criar conta grátis <ArrowRight className="h-4 w-4" />
                </button>
                <a href="/documentacao" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-5 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-muted sm:w-auto">
                  Ver documentação
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.2} className="mx-auto mt-14 max-w-5xl">
            <DashboardMock />
          </Reveal>

          <Reveal delay={0.25} className="mx-auto mt-10 max-w-5xl">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
              {METRICS.map(m => (
                <div key={m.label} className="bg-card px-4 py-5 text-center">
                  <p className="font-mono text-[22px] font-semibold tabular-nums text-foreground">{m.value}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* RECURSOS */}
        <section id="recursos" className="border-b border-border px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHead eyebrow="Recursos" title="Tudo que a operação precisa, em um só lugar" desc="Da primeira venda ao saque, sem depender de cinco ferramentas diferentes." />
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.04} className="bg-card">
                  <div className="h-full px-6 py-7">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border">
                      <f.icon className="h-4 w-4 text-primary" strokeWidth={2} />
                    </div>
                    <h3 className="mt-4 text-[15px] font-semibold text-foreground">{f.title}</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="border-b border-border px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHead eyebrow="Como funciona" title="Três passos para a primeira venda" />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.06}>
                  <div className="h-full rounded-xl border border-border bg-card px-6 py-7">
                    <span className="font-mono text-[12px] font-semibold tabular-nums text-primary">{s.n}</span>
                    <h3 className="mt-3 text-[15.5px] font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* SEGURANÇA + INTEGRAÇÕES */}
        <section className="border-b border-border px-5 py-20">
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-xl border border-border bg-card p-7">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.01em] text-foreground">Segurança de nível bancário</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                  Isolamento total de dados por conta, criptografia de dados sensíveis, trilha de auditoria imutável
                  e políticas de acesso revisadas continuamente.
                </p>
                <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                  {[
                    { icon: Shield, t: "Antifraude ativo" },
                    { icon: Activity, t: "Auditoria imutável" },
                    { icon: Layers, t: "Isolamento por conta" },
                    { icon: Zap, t: "Monitoramento 24/7" },
                  ].map(x => (
                    <div key={x.t} className="flex items-center gap-2.5 bg-card px-4 py-3">
                      <x.icon className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[12.5px] text-foreground">{x.t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <div className="h-full rounded-xl border border-border bg-card p-7">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border">
                  <Code2 className="h-4 w-4 text-primary" />
                </div>
                <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.01em] text-foreground">Integra com o seu stack</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                  Pixels, automações e ERPs conectados em minutos. API REST documentada e webhooks assinados.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {INTEGRATIONS.map(t => (
                    <span key={t} className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground">{t}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* PREÇOS */}
        <section id="precos" className="border-b border-border px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHead eyebrow="Preços" title="Sem mensalidade. Você paga por venda aprovada." desc="Escale o volume e reduza a taxa. Sem letra miúda." />
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {PLANS.map((p, i) => (
                <Reveal key={p.name} delay={i * 0.06}>
                  <div className={cn("flex h-full flex-col rounded-xl border bg-card p-7", p.featured ? "border-primary" : "border-border")}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-semibold text-foreground">{p.name}</h3>
                      {p.featured && <span className="rounded-md bg-primary px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-primary-foreground">Popular</span>}
                    </div>
                    <p className="mt-5 font-mono text-[30px] font-semibold tabular-nums text-foreground">{p.price}</p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">{p.note}</p>
                    <ul className="mt-6 flex-1 space-y-2.5">
                      {p.items.map(it => (
                        <li key={it} className="flex items-start gap-2.5 text-[13.5px] text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          {it}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => navigate("/auth?mode=signup")}
                      className={cn(
                        "mt-7 w-full rounded-lg px-4 py-2.5 text-[13.5px] font-semibold transition-opacity hover:opacity-90",
                        p.featured ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-muted"
                      )}
                    >
                      Começar agora
                    </button>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-border px-5 py-20">
          <div className="mx-auto max-w-4xl">
            <SectionHead eyebrow="FAQ" title="Perguntas frequentes" />
            <div className="mt-12 grid gap-3 md:grid-cols-2">
              {FAQ.map((f, i) => (
                <Reveal key={f.q} delay={i * 0.03}><FaqItem q={f.q} a={f.a} /></Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-b border-border px-5 py-20">
          <Reveal className="mx-auto max-w-4xl">
            <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
              <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-foreground sm:text-[32px]">Pronto para vender com a HOTZFY?</h2>
              <p className="mx-auto mt-3 max-w-lg text-[14.5px] leading-relaxed text-muted-foreground">
                Crie sua conta gratuitamente e publique seu primeiro checkout hoje mesmo.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <button onClick={() => navigate("/auth?mode=signup")} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto">
                  Criar conta grátis <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => navigate("/auth")} className="inline-flex w-full items-center justify-center rounded-lg border border-border px-5 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-muted sm:w-auto">
                  Já tenho conta
                </button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* RODAPÉ */}
      <footer className="px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <HotzfyLogo size={26} withWordmark />
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                Infraestrutura de pagamentos e área de membros para criadores e negócios digitais.
              </p>
            </div>
            {[
              { t: "Produto", l: [["Recursos", "#recursos"], ["Preços", "#precos"], ["Documentação", "/documentacao"], ["Status", "/status"]] },
              { t: "Conta", l: [["Entrar", "/auth"], ["Criar conta", "/auth?mode=signup"]] },
              { t: "Legal", l: [["Termos de uso", "/termos-de-uso"], ["Privacidade", "/politica-de-privacidade"]] },
            ].map(col => (
              <div key={col.t}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{col.t}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.l.map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground">{label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
            <p className="text-[12.5px] text-muted-foreground">© {yearRef.current} HOTZFY. Todos os direitos reservados.</p>
            <p className="text-[12.5px] text-muted-foreground">Feito no Brasil</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
