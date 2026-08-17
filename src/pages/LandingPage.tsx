/**
 * HOTZFY — Landing page
 * Direção visual: "infraestrutura de pagamentos de alta tecnologia".
 * Malha técnica, aurora de energia, painéis de vidro, telemetria ao vivo,
 * terminal de API e movimento contínuo — tudo sob o escopo `.tech-scope`
 * (camada TECH LAYER no index.css) para não afetar o resto da plataforma.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Shield, BarChart3, Users, CheckCircle2, Terminal,
  QrCode, Wallet, Code2, Lock, Activity, Menu, X, Minus, Plus, Cpu, Radio, Gauge, Fingerprint,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";
import { HotzfyLogo } from "@/components/HotzfyLogo";

/* ─────────────────────────── dados ─────────────────────────── */

const METRICS = [
  { value: 200, prefix: "R$ ", suffix: "M+", label: "TPV processado" },
  { value: 98.7, suffix: "%", label: "Aprovação PIX", decimals: 1 },
  { value: 99.99, suffix: "%", label: "Uptime da API", decimals: 2 },
  { value: 0, suffix: "", label: "Liquidação de saque", literal: "D+0" },
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

const SECURITY = [
  { icon: Lock, title: "Criptografia ponta a ponta", desc: "TLS 1.3 em trânsito e AES-256 em repouso, com chaves rotacionadas." },
  { icon: Fingerprint, title: "Isolamento por vendedor", desc: "Row Level Security no banco: cada conta acessa somente os próprios dados." },
  { icon: Radio, title: "Webhooks assinados", desc: "HMAC-SHA256 por evento, reentrega automática e log completo de entrega." },
  { icon: Gauge, title: "Observabilidade 24/7", desc: "Monitoramento de adquirentes, alertas de anomalia e trilha de auditoria." },
];

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
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/50 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-primary">
        <span className="tech-pulse h-1.5 w-1.5 rounded-full bg-primary" />
        {eyebrow}
      </p>
      <h2 className="mt-4 text-[30px] sm:text-[38px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground">{title}</h2>
      {desc && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{desc}</p>}
    </div>
  );
}

/** contador animado ao entrar na viewport */
function Counter({ to, decimals = 0, prefix = "", suffix = "", literal }: { to: number; decimals?: number; prefix?: string; suffix?: string; literal?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (literal || reduce) { setVal(to); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1200;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(to * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, literal, reduce]);

  return (
    <span ref={ref} className="tech-mono">
      {literal ?? `${prefix}${val.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`}
    </span>
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
    { href: "#infra", label: "Infraestrutura" },
    { href: "#precos", label: "Preços" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300", scrolled ? "border-border/70 bg-background/80 backdrop-blur-xl" : "border-transparent bg-transparent")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <button onClick={() => navigate("/")} className="flex items-center" aria-label="HOTZFY">
          <HotzfyLogo size={28} withWordmark />
        </button>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map(l => (
            <a key={l.href} href={l.href} className="relative text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">{l.label}</a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button onClick={() => navigate("/auth")} className="rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
            Entrar
          </button>
          <button onClick={() => navigate("/auth?mode=signup")} className="tech-cta rounded-lg px-4 py-2 text-[13px] font-bold">
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
            <button onClick={() => navigate("/auth?mode=signup")} className="tech-cta rounded-lg px-3 py-2.5 text-[13px] font-bold">Criar conta</button>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────── console ao vivo ─────────────────────────── */

const FAKE_NAMES = ["Ana C.", "Bruno M.", "Carla S.", "Diego F.", "Eduarda L.", "Felipe R.", "Gabi T.", "Heitor P."];
const FAKE_PRODUCTS = ["Método Escala 7", "Mentoria Black", "Curso Tráfego Pro", "Pack Criativos", "Comunidade VIP"];

type LiveEvent = { id: number; name: string; product: string; amount: number; ms: number };

function useLiveFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    let id = 0;
    const make = (): LiveEvent => ({
      id: id++,
      name: FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)],
      product: FAKE_PRODUCTS[Math.floor(Math.random() * FAKE_PRODUCTS.length)],
      amount: Math.round((Math.random() * 1800 + 97) * 100) / 100,
      ms: Math.floor(Math.random() * 700) + 180,
    });
    setEvents([make(), make(), make(), make()]);
    if (reduce) return;
    const t = setInterval(() => setEvents(prev => [make(), ...prev].slice(0, 4)), 2600);
    return () => clearInterval(t);
  }, [reduce]);

  return events;
}

function LiveConsole() {
  const events = useLiveFeed();
  const bars = useMemo(() => [34, 48, 41, 62, 55, 74, 68, 86, 71, 92, 80, 100], []);
  const total = events.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="tech-panel tech-ring relative overflow-hidden rounded-2xl">
      {/* barra de janela */}
      <div className="relative flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="tech-pulse h-2 w-2 rounded-full bg-primary" />
          <span className="text-[12.5px] font-semibold text-foreground">Console HOTZFY</span>
        </div>
        <span className="tech-mono rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          live
        </span>
      </div>

      {/* telemetria */}
      <div className="tech-scan relative grid grid-cols-3 gap-px border-b border-border/60 bg-border/40">
        {[
          { k: "Aprovação", v: "98,7%" },
          { k: "Latência", v: "312 ms" },
          { k: "Volume/min", v: "R$ 41,2K" },
        ].map(m => (
          <div key={m.k} className="bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{m.k}</p>
            <p className="tech-mono mt-1 text-[16px] font-bold text-foreground">{m.v}</p>
          </div>
        ))}
      </div>

      {/* gráfico */}
      <div className="px-4 pt-4">
        <div className="flex items-end justify-between gap-1.5 h-[92px]">
          {bars.map((b, i) => (
            <motion.span
              key={i}
              initial={{ height: 4, opacity: 0.3 }}
              whileInView={{ height: `${b}%`, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className={cn("w-full rounded-[3px]", i >= bars.length - 3 ? "bg-primary" : "bg-primary/25")}
            />
          ))}
        </div>
      </div>

      {/* feed */}
      <div className="mt-4 border-t border-border/60">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Fluxo de aprovação</span>
          <span className="tech-mono text-[11px] font-bold text-primary">
            + R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="divide-y divide-border/50">
          {events.map(e => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-foreground">{e.name} · {e.product}</p>
                <p className="tech-mono text-[10.5px] text-muted-foreground">PIX aprovado em {e.ms} ms</p>
              </div>
              <span className="tech-mono text-[12.5px] font-bold text-foreground">
                R$ {e.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── terminal de API ─────────────────────────── */

const CODE_LINES = [
  { t: "$ ", c: "curl -X POST https://api.hotzfy.com.br/v1/pix/charges \\", cls: "text-foreground" },
  { t: "  ", c: '-H "Authorization: Bearer sk_live_••••••••" \\', cls: "text-muted-foreground" },
  { t: "  ", c: '-d \'{ "amount": 19700, "customer": { "document": "***" } }\'', cls: "text-muted-foreground" },
  { t: "", c: "", cls: "" },
  { t: "", c: "{", cls: "text-muted-foreground" },
  { t: "", c: '  "id": "txn_9fA2c7",', cls: "text-primary" },
  { t: "", c: '  "status": "pending",', cls: "text-primary" },
  { t: "", c: '  "qr_code": "00020126...5204000053039865802BR",', cls: "text-primary" },
  { t: "", c: '  "expires_in": 900', cls: "text-primary" },
  { t: "", c: "}", cls: "text-muted-foreground" },
];

function ApiTerminal() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(reduce ? CODE_LINES.length : 0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setInterval>;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      timer = setInterval(() => {
        setVisible(v => {
          if (v >= CODE_LINES.length) { clearInterval(timer); return v; }
          return v + 1;
        });
      }, 170);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); clearInterval(timer); };
  }, [reduce]);

  return (
    <div ref={ref} className="tech-panel relative overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Terminal className="h-3.5 w-3.5 text-primary" />
        <span className="tech-mono text-[11.5px] font-semibold text-muted-foreground">hotzfy — api</span>
      </div>
      <pre className="tech-mono overflow-x-auto px-4 py-4 text-[11.5px] leading-[1.85]">
        {CODE_LINES.slice(0, visible).map((l, i) => (
          <div key={i} className={l.cls}>
            <span className="text-primary">{l.t}</span>{l.c || "\u00A0"}
          </div>
        ))}
        {visible < CODE_LINES.length && <span className="tech-pulse inline-block h-[13px] w-[7px] translate-y-[2px] bg-primary" />}
      </pre>
    </div>
  );
}

/* ─────────────────────────── FAQ ─────────────────────────── */

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className={cn("rounded-xl border transition-colors", open ? "border-primary/35 bg-card/70" : "border-border bg-card/30 hover:border-border")}>
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="text-[14.5px] font-semibold text-foreground">{q}</span>
        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", open ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && <p className="px-5 pb-5 text-[14px] leading-relaxed text-muted-foreground">{a}</p>}
    </div>
  );
}

/* ─────────────────────────── página ─────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="tech-scope min-h-screen bg-background text-foreground">
      <Seo
        title="HOTZFY — Infraestrutura de pagamentos PIX para infoprodutos"
        description="Checkout PIX, cartão e boleto com aprovação em segundos, antifraude em tempo real, área de membros, API REST e saque D+0."
        path="/"
        jsonLd={JSONLD}
      />

      <Nav />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
        <div aria-hidden className="tech-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="tech-aurora pointer-events-none absolute inset-x-0 -top-24 h-[520px]" />

        <div className="relative mx-auto max-w-6xl px-5">
          <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_1fr]">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                  <Cpu className="h-3.5 w-3.5" />
                  Infra própria · PIX em tempo real
                </span>
              </Reveal>

              <Reveal delay={0.05}>
                <h1 className="mt-6 text-[40px] sm:text-[58px] font-semibold leading-[1.02] tracking-[-0.04em]">
                  A engenharia de<br />
                  pagamentos que faz<br />
                  <span className="tech-text">seu dinheiro correr.</span>
                </h1>
              </Reveal>

              <Reveal delay={0.1}>
                <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
                  Checkout, antifraude, área de membros, afiliados e saque D+0 em uma única
                  plataforma. Latência baixa, aprovação alta e telemetria de tudo — sem mensalidade.
                </p>
              </Reveal>

              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button onClick={() => navigate("/auth?mode=signup")} className="tech-cta group inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[14px] font-bold">
                    Criar conta grátis
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <a href="#infra" className="inline-flex h-12 items-center gap-2 rounded-xl border border-border px-6 text-[14px] font-semibold text-foreground transition-colors hover:bg-muted">
                    Ver a infraestrutura
                  </a>
                </div>
              </Reveal>

              <Reveal delay={0.2}>
                <div className="mt-9 grid max-w-lg grid-cols-2 gap-x-8 gap-y-4 border-t border-border/70 pt-6 sm:grid-cols-4">
                  {METRICS.map(m => (
                    <div key={m.label}>
                      <p className="text-[19px] font-bold tracking-[-0.02em] text-foreground">
                        <Counter to={m.value} decimals={m.decimals} prefix={m.prefix} suffix={m.suffix} literal={m.literal} />
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.12}>
              <LiveConsole />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════ MARQUEE ═══════════ */}
      <section className="relative overflow-hidden border-y border-border/70 bg-card/25 py-4">
        <div className="flex w-max tech-marquee">
          {[...INTEGRATIONS, ...INTEGRATIONS].map((i, idx) => (
            <span key={idx} className="mx-5 inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] font-semibold text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-primary/70" />
              {i}
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════ RECURSOS (bento) ═══════════ */}
      <section id="recursos" className="relative py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal><SectionHead eyebrow="Plataforma" title="Tudo o que uma operação séria precisa" desc="Módulos integrados, sem gambiarra e sem plugin de terceiro no meio do caminho." /></Reveal>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <article className="tech-panel tech-panel-hover group h-full rounded-2xl p-6 transition-colors">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.02em] text-foreground">{f.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{f.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ INFRAESTRUTURA + API ═══════════ */}
      <section id="infra" className="relative overflow-hidden border-y border-border/70 py-24">
        <div aria-hidden className="tech-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal><SectionHead eyebrow="Infraestrutura" title="Construída como sistema crítico" desc="Cada transação é rastreável do clique ao repasse — com segurança de banco e velocidade de API." /></Reveal>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <div className="grid gap-4 sm:grid-cols-2">
              {SECURITY.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.05}>
                  <div className="tech-panel h-full rounded-2xl p-5">
                    <s.icon className="h-5 w-5 text-primary" strokeWidth={2} />
                    <h3 className="mt-4 text-[14.5px] font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.1}>
              <div className="flex h-full flex-col gap-4">
                <ApiTerminal />
                <div className="tech-panel flex items-center gap-3 rounded-2xl px-5 py-4">
                  <Activity className="h-4 w-4 text-primary" />
                  <p className="text-[13px] text-muted-foreground">
                    Webhooks com assinatura <span className="tech-mono text-foreground">HMAC-SHA256</span>, reentrega automática e log de cada entrega.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════ COMO FUNCIONA ═══════════ */}
      <section id="como-funciona" className="py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal><SectionHead eyebrow="Onboarding" title="Do cadastro à primeira venda" /></Reveal>
          <div className="relative mt-14 grid gap-4 md:grid-cols-3">
            <div aria-hidden className="absolute left-0 right-0 top-[38px] hidden h-px bg-border md:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.07}>
                <div className="relative rounded-2xl border border-border bg-card/40 p-6">
                  <span className="tech-mono inline-flex h-8 items-center rounded-lg border border-primary/30 bg-primary/10 px-2.5 text-[12px] font-bold text-primary">{s.n}</span>
                  <h3 className="mt-4 text-[16px] font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PREÇOS ═══════════ */}
      <section id="precos" className="relative overflow-hidden border-y border-border/70 py-24">
        <div aria-hidden className="tech-aurora pointer-events-none absolute inset-x-0 bottom-0 h-[380px] opacity-70" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal><SectionHead eyebrow="Preços" title="Você só paga quando vende" desc="Sem mensalidade, sem taxa de setup e sem surpresa no extrato." /></Reveal>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.06}>
                <div className={cn("relative h-full rounded-2xl p-6", p.featured ? "tech-panel tech-ring" : "border border-border bg-card/40")}>
                  {p.featured && (
                    <span className="absolute right-5 top-5 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                      Popular
                    </span>
                  )}
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{p.name}</h3>
                  <p className="mt-4 text-[34px] font-semibold leading-none tracking-[-0.03em] text-foreground tech-mono">{p.price}</p>
                  <p className="mt-2 text-[12.5px] text-muted-foreground">{p.note}</p>
                  <div className="my-5 h-px bg-border" />
                  <ul className="space-y-2.5">
                    {p.items.map(it => (
                      <li key={it} className="flex items-start gap-2.5 text-[13.5px] text-muted-foreground">
                        <CheckCircle2 className="mt-[2px] h-4 w-4 shrink-0 text-primary" />
                        {it}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate("/auth?mode=signup")}
                    className={cn("mt-7 inline-flex h-11 w-full items-center justify-center rounded-xl text-[13.5px] font-bold transition-colors",
                      p.featured ? "tech-cta" : "border border-border text-foreground hover:bg-muted")}
                  >
                    Começar agora
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section id="faq" className="py-24">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal><SectionHead eyebrow="Dúvidas" title="Perguntas frequentes" /></Reveal>
          <div className="mt-12 grid gap-2.5">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.04}>
                <FaqItem q={f.q} a={f.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <section className="relative overflow-hidden border-t border-border/70 py-24">
        <div aria-hidden className="tech-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="tech-aurora pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <Reveal>
            <h2 className="text-[32px] sm:text-[42px] font-semibold leading-[1.08] tracking-[-0.035em]">
              Pronto para operar na <span className="tech-text">velocidade do PIX?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Crie sua conta, publique seu produto e receba a primeira venda hoje mesmo.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => navigate("/auth?mode=signup")} className="tech-cta inline-flex h-12 items-center gap-2 rounded-xl px-7 text-[14px] font-bold">
                Criar conta grátis <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => navigate("/documentacao")} className="inline-flex h-12 items-center gap-2 rounded-xl border border-border px-6 text-[14px] font-semibold text-foreground transition-colors hover:bg-muted">
                <Code2 className="h-4 w-4" /> Documentação
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ RODAPÉ ═══════════ */}
      <footer className="border-t border-border/70 bg-card/20">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <HotzfyLogo size={24} withWordmark />
          <div className="flex flex-wrap items-center justify-center gap-5 text-[12.5px] text-muted-foreground">
            <a href="/documentacao" className="hover:text-foreground">Documentação</a>
            <a href="/termos" className="hover:text-foreground">Termos</a>
            <a href="/privacidade" className="hover:text-foreground">Privacidade</a>
            <a href="/status" className="hover:text-foreground">Status</a>
          </div>
          <p className="tech-mono text-[11.5px] text-muted-foreground">© {new Date().getFullYear()} HOTZFY</p>
        </div>
      </footer>
    </div>
  );
}
