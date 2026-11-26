import { useRef, useState, type FormEvent } from "react";
import { signInSeller, type LoginFailureKind } from "./authApi";
import { normalizeEmail, validateEmail } from "./authModel";
import {
  AuthHeading, FormNotice, PasswordField, Spinner, TextField, linkButtonClass, primaryButtonClass, useCountdown,
  type NoticeTone,
} from "./fields";
import { Button } from "@/components/ui/button";

/** Depois de tantas senhas erradas seguidas a tela faz uma pausa curta (o servidor tem o limite de verdade). */
export const LOGIN_PAUSE_AFTER = 5;
export const LOGIN_PAUSE_SECONDS = 60;

export interface LoginNotice { tone: NoticeTone; message: string }

interface LoginFormProps {
  initialEmail?: string;
  notice?: LoginNotice | null;
  onSuccess: () => void;
  onCreateAccount: () => void;
  onRecover: (email: string) => void;
}

export function LoginForm({ initialEmail = "", notice, onSuccess, onCreateAccount, onRecover }: LoginFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<{ kind: LoginFailureKind; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const attempts = useRef(0);
  const busy = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const pause = useCountdown();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current || pause.seconds > 0) return;

    const next = {
      email: validateEmail(email) || undefined,
      password: password ? undefined : "Digite sua senha.",
    };
    setErrors(next);
    if (next.email || next.password) {
      setFailure(null);
      (next.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    busy.current = true;
    setLoading(true);
    setFailure(null);
    const result = await signInSeller(email, password);
    busy.current = false;
    if (result.ok) {
      onSuccess();
      return;
    }
    setLoading(false);
    setFailure({ kind: result.kind, message: result.message });
    if (result.kind === "invalid") {
      attempts.current += 1;
      if (attempts.current >= LOGIN_PAUSE_AFTER) {
        attempts.current = 0;
        pause.start(LOGIN_PAUSE_SECONDS);
      }
      passwordRef.current?.focus();
      passwordRef.current?.select();
    }
  };

  const paused = pause.seconds > 0;

  return (
    <div>
      <AuthHeading title="Bem-vindo de volta" sub="Entre para acompanhar sua operação." />

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4" aria-label="Entrar na conta">
        {notice && <FormNotice tone={notice.tone}>{notice.message}</FormNotice>}

        <TextField
          ref={emailRef}
          id="login-email"
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
          error={errors.email}
          placeholder="seu@email.com"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
        />

        <PasswordField
          ref={passwordRef}
          id="login-password"
          label="Senha"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
          error={errors.password}
          placeholder="Digite sua senha"
          autoComplete="current-password"
          visible={showPassword}
          onToggleVisible={() => setShowPassword((v) => !v)}
        />

        <div className="flex justify-end">
          <button type="button" onClick={() => onRecover(normalizeEmail(email))} className={`text-[13px] ${linkButtonClass}`}>
            Esqueceu a senha?
          </button>
        </div>

        {failure && (
          <FormNotice
            tone="error"
            actions={failure.kind === "invalid" ? (
              <button type="button" onClick={() => onRecover(normalizeEmail(email))} className={`text-[13px] ${linkButtonClass}`}>
                Recuperar senha
              </button>
            ) : undefined}
          >
            {failure.message}
          </FormNotice>
        )}

        <Button type="submit" disabled={loading || paused} className={primaryButtonClass}>
          {loading ? <><Spinner className="mr-2" />Entrando…</> : paused ? `Tente de novo em ${pause.seconds} s` : "Entrar"}
        </Button>

        <p className="text-center text-[13px] text-muted-foreground">
          Ainda não tem conta?{" "}
          <button type="button" onClick={onCreateAccount} className={linkButtonClass}>Criar conta</button>
        </p>
      </form>
    </div>
  );
}
