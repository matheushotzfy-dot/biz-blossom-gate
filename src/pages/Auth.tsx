/**
 * Auth — entrada, cadastro e recuperação de senha (tela dividida: formulário à esquerda, painel institucional à direita).
 * A lógica de cada fluxo mora em `src/features/auth/` (`LoginForm`, `SignupFlow`, `RecoveryFlow`);
 * aqui ficam só o modo da tela, o endereço (`?mode=signup`) e a moldura.
 * @module Auth
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { Lock } from "lucide-react";
import { AuthAside } from "@/components/auth/AuthAside";
import { VenxpayLogo } from "@/components/VenxpayLogo";
import { Seo } from "@/components/Seo";
import { LoginForm, type LoginNotice } from "@/features/auth/LoginForm";
import { RecoveryFlow } from "@/features/auth/RecoveryFlow";
import { SignupFlow } from "@/features/auth/SignupFlow";
import { linkButtonClass } from "@/features/auth/fields";
import type { AccountPreview } from "@/features/auth/authModel";
import "@/features/auth/auth.css";

type Mode = "login" | "signup" | "recovery";

const SEO: Record<Mode, { title: string; description: string }> = {
  login: {
    title: "Entrar — Vemprapay",
    description: "Acesse seu painel Vemprapay: produtos, vendas, saques e área de membros em um só lugar.",
  },
  signup: {
    title: "Criar conta grátis — Vemprapay",
    description: "Crie sua conta Vemprapay grátis e venda com checkout, área de membros, divisão de vendas e saque por Pix.",
  },
  recovery: {
    title: "Recuperar acesso — Vemprapay",
    description: "Recupere o acesso à sua conta Vemprapay com um código enviado por e-mail.",
  },
};

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(() => (searchParams.get("mode") === "signup" ? "signup" : "login"));
  // E-mail e aviso que passam de um fluxo para o outro (ex.: depois de trocar a senha, o login já vem com o e-mail).
  const [carry, setCarry] = useState<{ email: string; notice: LoginNotice | null }>({ email: "", notice: null });
  const modeChanged = useRef(false);
  // Passo do cadastro, para o painel ao lado explicar por que pedimos cada dado.
  const [signupStep, setSignupStep] = useState(1);
  // Prévia da conta que se monta no painel ao lado enquanto a pessoa preenche.
  const [preview, setPreview] = useState<AccountPreview | null>(null);

  const go = (next: Mode, email = "", notice: LoginNotice | null = null) => {
    modeChanged.current = true;
    setCarry({ email, notice });
    setMode(next);
    setSearchParams(next === "signup" ? { mode: "signup" } : {}, { replace: true });
  };

  // Ao trocar de tela por clique, o foco vai para o título novo (leitor de tela e teclado); na abertura da página, não.
  useEffect(() => {
    if (!modeChanged.current) return undefined;
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-auth-heading]")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  const seo = SEO[mode];

  return (
    <MotionConfig reducedMotion="user">
      <div className="auth-shell relative min-h-[100dvh] bg-background text-foreground lg:h-[100dvh] lg:overflow-hidden">
        <div className="auth-mobile-ambient pointer-events-none fixed inset-0 lg:hidden" aria-hidden="true" />
        <Seo title={seo.title} description={seo.description} path="/auth" />

        <div className="relative grid min-h-[100dvh] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,50%)_minmax(0,50%)]">
          {/* ═══ ESQUERDA — formulário ═══ */}
          <div role="main" className="auth-form-panel relative z-10 flex min-h-[100dvh] flex-col px-5 py-6 sm:px-10 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-14 lg:py-7 xl:px-20">
            <a href="/" className="inline-flex w-fit items-center gap-2.5 opacity-95 transition-opacity hover:opacity-100" aria-label="Vemprapay, página inicial">
              <VenxpayLogo size={32} />
              <span className="text-[19px] font-heading font-extrabold tracking-[-0.035em] text-foreground">vempra<span className="text-primary">pay</span></span>
            </a>

            <div className="flex flex-1 flex-col">
              <div className="m-auto w-full max-w-[420px] py-8">
                <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
                  {mode === "login" && (
                    <LoginForm
                      initialEmail={carry.email}
                      notice={carry.notice}
                      onSuccess={() => navigate("/dashboard", { replace: true })}
                      onCreateAccount={() => go("signup")}
                      onRecover={(email) => go("recovery", email)}
                    />
                  )}
                  {mode === "signup" && (
                    <SignupFlow
                      onStepChange={setSignupStep}
                      onPreviewChange={setPreview}
                      onSuccess={() => navigate("/dashboard", { replace: true })}
                      onLogin={(email, notice) => go("login", email ?? "", notice ?? null)}
                      onRecover={(email) => go("recovery", email)}
                    />
                  )}
                  {mode === "recovery" && (
                    <RecoveryFlow
                      initialEmail={carry.email}
                      onBack={(email, changed) => go("login", email ?? "", changed ? { tone: "success", message: "Senha alterada. Entre com a nova senha." } : null)}
                    />
                  )}
                </motion.div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> Conexão protegida (HTTPS)</span>
              <span className="inline-flex items-center gap-3">
                <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className={linkButtonClass}>Termos de Uso</a>
                <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className={linkButtonClass}>Privacidade</a>
              </span>
            </div>
          </div>

          {/* ═══ DIREITA — painel autoral (sem fotos de terceiros) ═══ */}
          <AuthAside className="hidden lg:flex" mode={mode} step={signupStep} preview={preview} />
        </div>
      </div>
    </MotionConfig>
  );
}
