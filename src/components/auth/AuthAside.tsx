import painelInicio from "@/assets/landing/painel-inicio.webp";
import { cn } from "@/lib/utils";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { STEP_REASONS } from "@/features/auth/authModel";

/**
 * Painel ao lado do formulário (computador). Muda com a tela:
 * - entrar: a tela real do painel (captura com dados de exemplo, avisado);
 * - cadastro: por que pedimos o dado daquele passo e o que acontece depois do cadastro;
 * - recuperação: os três passos e o que muda depois da troca.
 * Tudo aqui precisa ser verdade sobre o produto (sem prazo, número ou selo inventado).
 */
export type AsideMode = "login" | "signup" | "recovery";

export interface AuthAsideProps {
  mode?: AsideMode;
  /** Passo atual do cadastro (1 a 6). */
  step?: number;
  className?: string;
}

const AFTER_SIGNUP = [
  { t: "Conta criada", d: "Você entra no painel e já pode montar o primeiro produto." },
  { t: "Documentos enviados", d: "Documento com foto e uma selfie, pelo próprio painel. O saque é liberado depois da aprovação." },
  { t: "Produto revisado", d: "A equipe revisa cada produto antes do checkout começar a receber." },
  { t: "Primeira venda", d: "O Pix aprovado entra no saldo, e o saque sai por Pix para a sua chave." },
] as const;

const RECOVERY_STEPS = [
  "Informe o e-mail da sua conta.",
  "Digite o código de 6 números que chega no e-mail.",
  "Crie a nova senha.",
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="vp-auth-logo-tile"><VenxpayLogo size={30} plate={false} /></span>
      <span className="text-[19px] font-extrabold tracking-[-0.035em]">vemprapay</span>
    </div>
  );
}

export function AuthAside({ mode = "login", step = 1, className }: AuthAsideProps) {
  const reason = STEP_REASONS[Math.min(Math.max(step, 1), STEP_REASONS.length) - 1];

  return (
    <aside className={cn("vp-auth-aside relative isolate flex h-full flex-col overflow-hidden px-10 py-9 xl:px-14", className)} aria-label="Sobre a Vemprapay" data-mode={mode}>
      <span aria-hidden className="vp-auth-ring vp-auth-ring-a" />
      <span aria-hidden className="vp-auth-ring vp-auth-ring-b" />
      <Brand />

      {mode === "login" && (
        <>
          <div className="relative mt-14 max-w-[460px]">
            <h2 className="vp-auth-title">Saldo, vendas e saques do jeito que estão agora.</h2>
            <p className="vp-auth-text mt-4">Entre para ver cada venda com o status real e o seu saldo separado entre disponível, em análise e aguardando liberação.</p>
          </div>
          <figure className="vp-auth-shot" aria-label="Tela real do painel">
            <img src={painelInicio} width={1440} height={900} alt="Painel do vendedor com saldo disponível, vendas de hoje e faturamento" decoding="async" />
            <figcaption>Tela real do painel. Nomes e valores são exemplos.</figcaption>
          </figure>
        </>
      )}

      {mode === "signup" && (
        <div className="relative mt-auto flex min-h-0 flex-col gap-10 pb-2 pt-10">
          <div key={step} className="vp-auth-swap max-w-[460px]" aria-live="polite">
            <h2 className="vp-auth-title">{reason.title}</h2>
            <p className="vp-auth-text mt-4">{reason.text}</p>
          </div>
          <div className="vp-auth-after">
            <h3 className="text-[15px] font-bold">Depois do cadastro</h3>
            <ol className="mt-4 grid gap-0">
              {AFTER_SIGNUP.map((item, i) => (
                <li key={item.t} className="vp-auth-after-item" data-current={i === 0 ? "" : undefined}>
                  <span className="vp-auth-dot" aria-hidden>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-bold leading-snug">{item.t}{i === 0 && <span className="vp-auth-here">você está aqui</span>}</p>
                    <p className="vp-auth-text mt-1 text-[13.5px]">{item.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {mode === "recovery" && (
        <div className="relative my-auto max-w-[460px] py-10">
          <h2 className="vp-auth-title">Recupere o acesso em três passos.</h2>
          <ol className="mt-8 grid gap-0">
            {RECOVERY_STEPS.map((t, i) => (
              <li key={t} className="vp-auth-after-item">
                <span className="vp-auth-dot" aria-hidden>{i + 1}</span>
                <p className="pt-1 text-[15px] font-semibold leading-snug">{t}</p>
              </li>
            ))}
          </ol>
          <p className="vp-auth-text mt-8">Depois da troca, todos os aparelhos conectados saem da conta. Quem estava usando a sua senha antiga perde o acesso na hora.</p>
        </div>
      )}
    </aside>
  );
}

export default AuthAside;
