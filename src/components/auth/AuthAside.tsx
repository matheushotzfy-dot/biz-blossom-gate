import { Bell, Check, ChevronDown, Lock, User } from "lucide-react";
import painelInicio from "@/assets/landing/painel-inicio.webp";
import { cn } from "@/lib/utils";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { AFTER_SIGNUP, SIGNUP_STEPS, STEP_REASONS, type AccountPreview } from "@/features/auth/authModel";
import { Tight } from "@/components/landing-vp/Tight";

/**
 * Painel ao lado do formulário (computador). Muda com a tela:
 * - entrar: a tela real do painel (captura com dados de exemplo, avisado) com o aviso de venda que o painel mostra;
 * - cadastro: a conta se montando com o que a pessoa digita (documento mascarado, senha só como força) e,
 *   embaixo, por que pedimos o dado daquele passo;
 * - recuperação: os três passos e o que muda depois da troca.
 * Tudo aqui precisa ser verdade sobre o produto (sem prazo, número ou selo inventado): o saldo de uma conta nova é R$ 0,00.
 */
export type AsideMode = "login" | "signup" | "recovery";

export interface AuthAsideProps {
  mode?: AsideMode;
  /** Passo atual do cadastro (1 a 6). */
  step?: number;
  /** Prévia da conta enquanto a pessoa preenche o cadastro. */
  preview?: AccountPreview | null;
  className?: string;
}

const RECOVERY_STEPS = [
  { t: "Informe o e-mail da conta", d: "O mesmo que você usa para entrar no painel." },
  { t: "Digite o código", d: "Seis números que chegam nesse e-mail." },
  { t: "Crie a nova senha", d: "Com 8 ou mais caracteres, maiúscula, minúscula e número." },
] as const;

function Brand() {
  return (
    <div className="relative flex items-center gap-2.5">
      <span className="vp-auth-logo-tile"><VenxpayLogo size={30} plate={false} /></span>
      <span className="text-[19px] font-extrabold tracking-[-0.035em]">vemprapay</span>
    </div>
  );
}

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

/** Uma linha da prévia: o valor quando já foi preenchido, um traço cinza quando ainda não. */
function Row({ label, value, active, locked }: { label: string; value: string; active: boolean; locked?: boolean }) {
  return (
    <div className="vp-acct-row" data-active={active ? "" : undefined} data-filled={value ? "" : undefined}>
      <dt>{label}</dt>
      <dd>
        {value ? (
          <>
            <span className="vp-acct-value">{value}</span>
            {locked ? <Lock className="vp-acct-mark" /> : <Check className="vp-acct-mark" />}
          </>
        ) : (
          <span className="vp-acct-bar" />
        )}
      </dd>
    </div>
  );
}

const EMPTY_PREVIEW: AccountPreview = {
  step: 1, typeLabel: "Pessoa física", initials: "", greetingName: "", fullName: "", email: "", phone: "",
  documentLabel: "CPF", documentMasked: "", companyName: "", segmentLabel: "", passwordLevel: 0, passwordLabel: "", ready: false, created: false,
};

/** As linhas da conta (nome, contato, documento, negócio, senha); a do passo atual fica destacada. */
function AccountRows({ preview: p, step }: { preview: AccountPreview; step: number }) {
  const password = p.passwordLevel > 0 ? `•••••••• ${p.passwordLabel.toLowerCase()}` : "";
  return (
    <dl className="vp-acct-rows">
      <Row label="Nome completo" value={p.fullName} active={step === 1} />
      <Row label="WhatsApp" value={p.phone} active={step === 2} />
      <Row label={p.documentLabel} value={p.documentMasked} active={step === 3} locked />
      {p.documentLabel === "CNPJ" && <Row label="Razão social" value={p.companyName} active={step === 3} />}
      <Row label="Você vende" value={p.segmentLabel} active={step === 4} />
      <Row label="Senha" value={password} active={step === 5} locked />
    </dl>
  );
}

const helloOf = (p: AccountPreview) => (p.greetingName ? `${greeting()}, ${p.greetingName}` : "Sua conta");

/** A conta montada com o que a pessoa digitou. Repete o formulário, então fica fora do leitor de tela. */
export function AccountCard({ preview, step }: { preview: AccountPreview; step: number }) {
  const p = preview;
  const chip = p.created ? "Conta criada" : p.ready && step === 6 ? "Pronta para criar" : p.typeLabel;
  return (
    <div className="vp-acct" aria-hidden="true" data-testid="account-preview">
      <div className="vp-acct-head">
        <span className="vp-acct-avatar">{p.initials || <User />}</span>
        <div className="min-w-0 flex-1">
          <p className="vp-acct-hello">{helloOf(p)}</p>
          {p.email ? <p className="vp-acct-sub">{p.email}</p> : <span className="vp-acct-bar mt-1.5" style={{ width: "58%" }} />}
        </div>
        <span className="vp-acct-chip" data-tone={p.created || (p.ready && step === 6) ? "ok" : undefined}>{chip}</span>
      </div>

      <div className="vp-acct-balance">
        <p className="text-[13px] font-semibold text-white/85">Saldo disponível</p>
        <p className="vp-acct-money">R$ <b>0</b>,00</p>
        <p className="text-[12.5px] text-white/80">Sua primeira venda aparece aqui.</p>
      </div>

      <AccountRows preview={p} step={step} />
    </div>
  );
}

/**
 * Celular e tablet (sem o painel ao lado): a mesma conta numa faixa que abre. Fechada, mostra só a saudação e o
 * e-mail, que mudam enquanto a pessoa digita; aberta, as linhas da conta e por que o passo pede o que pede.
 */
export function AccountStrip({ preview, step }: { preview: AccountPreview; step: number }) {
  const p = preview;
  const current = Math.min(Math.max(step, 1), STEP_REASONS.length);
  const reason = STEP_REASONS[current - 1];
  return (
    <details className="auth-mini" data-testid="account-strip">
      <summary>
        <span className="vp-acct-avatar" aria-hidden="true">{p.initials || <User />}</span>
        <span className="min-w-0 flex-1">
          <span className="auth-mini-hello">{helloOf(p)}</span>
          <span className="auth-mini-sub">{p.email || "Seus dados aparecem aqui."}</span>
        </span>
        <span className="auth-mini-more">Ver conta<ChevronDown aria-hidden="true" /></span>
      </summary>
      <div aria-hidden="true"><AccountRows preview={p} step={current} /></div>
      <p className="auth-mini-why"><b>{reason.title}</b> {reason.text}</p>
    </details>
  );
}

/** Revisão: o que vem depois de criar a conta, em ordem. */
export function AfterSignupList({ className, tone = "light" }: { className?: string; tone?: "light" | "green" }) {
  return (
    <ol className={cn("auth-next", className)} data-tone={tone} aria-label="Depois de criar a conta">
      {AFTER_SIGNUP.map((item, index) => (
        <li key={item.title}>
          <span className="auth-next-n" aria-hidden="true">{index + 1}</span>
          <span><b>{item.title}</b> {item.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function AuthAside({ mode = "login", step = 1, preview, className }: AuthAsideProps) {
  const current = Math.min(Math.max(step, 1), STEP_REASONS.length);
  const reason = STEP_REASONS[current - 1];
  const created = !!preview?.created;

  return (
    <aside className={cn("vp-auth-aside relative isolate flex h-full flex-col overflow-hidden px-10 py-9 xl:px-14", className)} aria-label="Sobre a Vemprapay" data-mode={mode}>
      <Brand />

      {mode === "login" && (
        <>
          <div className="relative mt-14 max-w-[470px]">
            <h2 className="vp-auth-title"><Tight>Seu saldo, suas vendas e seus saques, do jeito que estão agora.</Tight></h2>
            <p className="vp-auth-text mt-4">Entre para ver cada venda com o status real e o saldo separado entre disponível, em análise e aguardando liberação.</p>
          </div>
          <figure className="vp-auth-stage" aria-label="Tela real do painel">
            <div className="vp-auth-window">
              <div className="vp-auth-window-bar" aria-hidden="true"><i /><i /><i /><span><Lock />Painel do vendedor</span></div>
              <img src={painelInicio} width={1440} height={900} alt="Painel do vendedor com saldo disponível, vendas de hoje e faturamento" decoding="async" />
            </div>
            <div className="vp-auth-note" aria-hidden="true">
              <span className="vp-auth-note-icon"><Bell /></span>
              <span className="min-w-0"><b>Nova venda aprovada</b><small>Você recebeu R$ 278,42 líquidos.</small></span>
            </div>
            <figcaption>Tela real do painel. Nomes e valores são exemplos.</figcaption>
          </figure>
        </>
      )}

      {mode === "signup" && (
        <div className="relative my-auto flex w-full max-w-[480px] flex-col gap-7 py-8" data-final={!created && current === SIGNUP_STEPS.length ? "" : undefined}>
          <div>
            <h2 className="vp-auth-title"><Tight>{created ? "Falta só confirmar o seu e-mail." : "A sua conta, montada enquanto você preenche."}</Tight></h2>
            <p className="vp-auth-text mt-3">
              {created
                ? "Abra o link que enviamos e entre no painel. Depois é enviar os documentos e montar o primeiro produto."
                : "O que você digita aparece aqui. Nada é criado antes de você confirmar, no último passo."}
            </p>
          </div>
          <AccountCard preview={preview ?? EMPTY_PREVIEW} step={created ? 6 : current} />
          {!created && current < SIGNUP_STEPS.length && (
            <p key={current} className="vp-auth-swap vp-auth-reason" aria-live="polite">
              <span className="vp-auth-reason-n">{current}/{SIGNUP_STEPS.length}</span>
              <span><b>{reason.title}</b> {reason.text}</span>
            </p>
          )}
          {!created && current === SIGNUP_STEPS.length && (
            <div key="next" className="vp-auth-swap">
              <p className="text-[14.5px] font-bold">Depois de criar a conta</p>
              <AfterSignupList tone="green" className="mt-3" />
            </div>
          )}
        </div>
      )}

      {mode === "recovery" && (
        <div className="relative my-auto max-w-[460px] py-10">
          <h2 className="vp-auth-title"><Tight>Recupere o acesso em três passos.</Tight></h2>
          <ol className="vp-auth-steps">
            {RECOVERY_STEPS.map((s, i) => (
              <li key={s.t}>
                <span className="vp-auth-dot" aria-hidden>{i + 1}</span>
                <div><p className="text-[16px] font-bold leading-snug">{s.t}</p><p className="vp-auth-text mt-1 text-[14.5px]">{s.d}</p></div>
              </li>
            ))}
          </ol>
          <p className="vp-auth-text mt-9 rounded-[16px] bg-white/10 px-5 py-4">Depois da troca, todos os aparelhos conectados saem da conta. Quem estava usando a sua senha antiga perde o acesso na hora.</p>
        </div>
      )}
    </aside>
  );
}

export default AuthAside;
