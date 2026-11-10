import { BadgeCheck, CreditCard, Fingerprint, Gauge, Link2, Lock, QrCode, ShieldCheck, Wallet, Webhook } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STATS = [
  { v: "75%+", l: "de aprovação em Pix e cartão" },
  { v: "Na hora", l: "saque instantâneo via Pix" },
  { v: "24/7", l: "plataforma disponível" },
  { v: "LGPD", l: "dados protegidos de ponta a ponta" },
];

export function StatsStrip() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.l}>
            <p className="font-heading text-[30px] font-extrabold tracking-[-0.03em] text-primary">{s.v}</p>
            <p className="mt-1 text-[14px] font-medium text-muted-foreground">{s.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES: Array<{ i: LucideIcon; t: string; d: string }> = [
  { i: QrCode, t: "Pix que cai na hora", d: "QR Code e copia e cola gerados no checkout, confirmação automática e saldo creditado." },
  { i: CreditCard, t: "Cartão em até 12x", d: "Adquirências exclusivas para manter a aprovação acima de 75%." },
  { i: Wallet, t: "Saque instantâneo", d: "Peça o saque e receba via Pix na sua conta, sem burocracia." },
  { i: Link2, t: "Links de pagamento", d: "Crie um link em segundos e venda pelo WhatsApp, Instagram ou e-mail." },
  { i: Gauge, t: "Checkout que converte", d: "Rápido no celular, com cupons, order bump e o visual da sua marca." },
  { i: Webhook, t: "API e integrações", d: "Webhooks assinados, chaves de API e integrações com as ferramentas que você usa." },
];

export function FeatureGrid() {
  return (
    <section id="recursos" className="bg-background py-20">
      <div className="mx-auto max-w-6xl px-5">
        <SectionTitle kicker="Recursos" title="Tudo o que você precisa para receber" />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ i: I, t, d }) => (
            <article key={t} className="vp-card p-6 transition-colors hover:border-primary/40">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-primary"><I className="h-5 w-5" /></span>
              <h3 className="mt-5 text-[18px] font-bold text-foreground">{t}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "1", t: "Abra sua conta", d: "Cadastro com CPF ou CNPJ em poucos minutos." },
  { n: "2", t: "Envie seus documentos", d: "Verificação segura, analisada em até 24 horas úteis." },
  { n: "3", t: "Comece a vender", d: "Crie produtos, links e receba com Pix e cartão." },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-card py-20">
      <div className="mx-auto max-w-6xl px-5">
        <SectionTitle kicker="Como funciona" title="Da conta aberta à primeira venda" />
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-3xl border border-border bg-background p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary font-heading text-[16px] font-extrabold text-primary-foreground">{s.n}</span>
              <h3 className="mt-5 text-[18px] font-bold text-foreground">{s.t}</h3>
              <p className="mt-2 text-[14.5px] text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const SECURITY: Array<{ i: LucideIcon; t: string }> = [
  { i: ShieldCheck, t: "Antifraude em todas as transações" },
  { i: Lock, t: "Dados criptografados e conformidade com a LGPD" },
  { i: Fingerprint, t: "Verificação de identidade de todos os vendedores" },
  { i: BadgeCheck, t: "Saldo de cada vendedor isolado e auditado" },
];

export function SecuritySection() {
  return (
    <section id="seguranca" className="vp-site-dark py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-primary">Segurança</p>
          <h2 className="mt-3 font-heading text-[34px] font-extrabold leading-tight tracking-[-0.03em]">Seu dinheiro protegido como num banco.</h2>
          <p className="mt-4 text-[16px] leading-relaxed opacity-75">Cada venda passa por análise antifraude, cada saldo é registrado e cada ação sensível exige confirmação.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SECURITY.map(({ i: I, t }) => (
            <li key={t} className="rounded-2xl border border-border p-5">
              <I className="h-5 w-5 text-primary" />
              <p className="mt-3 text-[15px] font-semibold">{t}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-primary">{kicker}</p>
      <h2 className="mt-3 font-heading text-[32px] font-extrabold leading-tight tracking-[-0.03em] text-foreground sm:text-[38px]">{title}</h2>
    </div>
  );
}
