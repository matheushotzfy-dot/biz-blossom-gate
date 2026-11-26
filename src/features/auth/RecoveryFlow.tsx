import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completePasswordReset, requestRecoveryCode } from "./authApi";
import {
  normalizeEmail, validateEmail, validatePassword, validatePasswordConfirmation,
} from "./authModel";
import {
  AuthHeading, FormNotice, PasswordField, PasswordHelp, Spinner, TextField, linkButtonClass, primaryButtonClass,
  secondaryButtonClass, useCountdown,
} from "./fields";

export const RESEND_SECONDS = 30;
export const CODE_LENGTH = 6;

type Stage = "email" | "code" | "done";

interface RecoveryFlowProps {
  initialEmail?: string;
  /** Volta ao login; `email` leva o e-mail digitado para o campo do login e `changed` diz que a senha acabou de ser trocada. */
  onBack: (email?: string, changed?: boolean) => void;
}

export function RecoveryFlow({ initialEmail = "", onBack }: RecoveryFlowProps) {
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [resentAt, setResentAt] = useState(false);

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; password?: string; confirmation?: string }>({});
  const [resetError, setResetError] = useState("");
  const [saving, setSaving] = useState(false);

  const busy = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const cooldown = useCountdown();

  const goToCode = () => {
    setEmail((current) => normalizeEmail(current));
    setStage("code");
    setCode("");
    setFieldErrors({});
    setResetError("");
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  /** Pede o código (primeira vez ou reenvio). */
  const sendCode = async (resend: boolean) => {
    const problem = validateEmail(email);
    setEmailError(problem);
    if (problem) { emailRef.current?.focus(); return; }
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    setSendError("");
    const result = await requestRecoveryCode(email);
    busy.current = false;
    setSending(false);
    if (!result.ok) {
      setSendError(result.message);
      return;
    }
    setEmail(normalizeEmail(email));
    cooldown.start(RESEND_SECONDS);
    setResentAt(resend);
    if (!resend) goToCode();
  };

  const handleEmailSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendCode(false);
  };

  const handleResetSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    const errors = {
      code: code.length === CODE_LENGTH ? undefined : `Digite os ${CODE_LENGTH} números do código.`,
      password: validatePassword(password) || undefined,
      confirmation: validatePasswordConfirmation(password, confirmation) || undefined,
    };
    setFieldErrors(errors);
    setResetError("");
    if (errors.code || errors.password || errors.confirmation) {
      (errors.code ? codeRef : errors.password ? passwordRef : confirmRef).current?.focus();
      return;
    }
    busy.current = true;
    setSaving(true);
    const result = await completePasswordReset({ email, code, password });
    busy.current = false;
    setSaving(false);
    if (result.ok) {
      setPassword("");
      setConfirmation("");
      setStage("done");
      return;
    }
    if (result.kind === "code") setFieldErrors({ code: result.message });
    else if (result.kind === "password") setFieldErrors({ password: result.message });
    else setResetError(result.message);
  };

  /* ───────── 3. pronto ───────── */
  if (stage === "done") {
    return (
      <div>
        <AuthHeading title="Senha alterada" sub="Sua conta está protegida com a nova senha." />
        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-3 rounded-[10px] bg-success/10 px-4 py-4 ring-1 ring-success/30" role="status">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-foreground">
              Por segurança, todos os aparelhos foram desconectados. Entre de novo com a nova senha.
            </p>
          </div>
          <Button type="button" onClick={() => onBack(email, true)} className={primaryButtonClass}>Entrar</Button>
        </div>
      </div>
    );
  }

  /* ───────── 2. código + nova senha ───────── */
  if (stage === "code") {
    return (
      <div>
        <AuthHeading title="Criar nova senha" sub="Digite o código que enviamos e escolha a nova senha." />
        <form onSubmit={handleResetSubmit} noValidate className="mt-6 space-y-4" aria-label="Criar nova senha">
          <div className="flex items-start gap-3 rounded-[10px] bg-muted/60 px-4 py-3 ring-1 ring-border">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Se <span className="font-medium text-foreground [overflow-wrap:anywhere]">{email}</span> tiver conta, o código chega nesse e-mail. Confira também o spam.
            </p>
          </div>

          <TextField
            ref={codeRef}
            id="recovery-code"
            label="Código de verificação"
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH)); if (fieldErrors.code) setFieldErrors((p) => ({ ...p, code: undefined })); }}
            error={fieldErrors.code}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            className="text-center text-[20px] tracking-[0.5em]"
          />

          <div>
            <PasswordField
              ref={passwordRef}
              id="recovery-password"
              label="Nova senha"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })); }}
              error={fieldErrors.password}
              placeholder="Crie uma senha forte"
              autoComplete="new-password"
              maxLength={128}
              visible={showPassword}
              onToggleVisible={() => setShowPassword((v) => !v)}
            />
            <PasswordHelp password={password} />
          </div>

          <PasswordField
            ref={confirmRef}
            id="recovery-confirm"
            label="Confirmar nova senha"
            value={confirmation}
            onChange={(e) => { setConfirmation(e.target.value); if (fieldErrors.confirmation) setFieldErrors((p) => ({ ...p, confirmation: undefined })); }}
            error={fieldErrors.confirmation}
            placeholder="Digite de novo"
            autoComplete="new-password"
            maxLength={128}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((v) => !v)}
          />

          {resetError && <FormNotice tone="error">{resetError}</FormNotice>}
          {sendError && <FormNotice tone="error">{sendError}</FormNotice>}
          {resentAt && !sendError && cooldown.seconds > 0 && <FormNotice tone="info">Pedimos um novo código. Use o mais recente.</FormNotice>}

          <Button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? <><Spinner className="mr-2" />Alterando…</> : "Alterar senha"}
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px]">
            <button type="button" disabled={sending || cooldown.seconds > 0} onClick={() => void sendCode(true)} className={linkButtonClass}>
              {sending ? "Enviando…" : cooldown.seconds > 0 ? `Reenviar código em ${cooldown.seconds} s` : "Reenviar código"}
            </button>
            <button type="button" onClick={() => { setStage("email"); setSendError(""); setResentAt(false); }} className={linkButtonClass}>
              Usar outro e-mail
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* ───────── 1. e-mail ───────── */
  return (
    <div>
      <AuthHeading title="Recuperar acesso" sub="Vamos enviar um código para o e-mail da sua conta." />
      <form onSubmit={handleEmailSubmit} noValidate className="mt-6 space-y-4" aria-label="Recuperar acesso">
        <TextField
          ref={emailRef}
          id="recovery-email"
          label="E-mail da conta"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
          error={emailError}
          placeholder="seu@email.com"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
        />

        {sendError && (
          <FormNotice
            tone="error"
            actions={!validateEmail(email) ? (
              <button type="button" onClick={goToCode} className={`text-[13px] ${linkButtonClass}`}>Já tenho o código</button>
            ) : undefined}
          >
            {sendError}
          </FormNotice>
        )}

        <Button type="submit" disabled={sending} className={primaryButtonClass}>
          {sending ? <><Spinner className="mr-2" />Enviando…</> : "Enviar código"}
        </Button>

        <Button type="button" variant="outline" onClick={() => onBack(normalizeEmail(email))} className={`w-full ${secondaryButtonClass}`}>
          Voltar para o login
        </Button>
      </form>
    </div>
  );
}
