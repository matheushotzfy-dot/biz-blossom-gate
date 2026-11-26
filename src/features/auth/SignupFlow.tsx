import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Mail, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  requestSignup, resendSignupEmail, signInSeller, type SignupFailureKind,
} from "./authApi";
import {
  EMPTY_SIGNUP, PASSWORD_MAX, REFERRAL_OPTIONS, REVENUE_OPTIONS, SEGMENT_OPTIONS, SIGNUP_STEPS, TOTAL_STEPS, ACCOUNT_TYPE_OPTIONS,
  buildSignupRequest, fieldsOfStep, firstInvalidStep, formatDocument, formatPhone, normalizeEmail, stepErrors, suggestEmail,
  summarySections, type SignupField, type SignupForm,
} from "./authModel";
import {
  AuthHeading, ChoiceGroup, FormNotice, PasswordField, PasswordHelp, SelectField, Spinner, TextField,
  linkButtonClass, primaryButtonClass, secondaryButtonClass, useCountdown, type Choice,
} from "./fields";
import type { LoginNotice } from "./LoginForm";

export const VERIFY_RESEND_SECONDS = 60;

type Phase = "form" | "creating" | "signing-in" | "verify";

interface SignupFlowProps {
  onSuccess: () => void;
  onLogin: (email?: string, notice?: LoginNotice) => void;
  onRecover: (email: string) => void;
}

const ACCOUNT_CHOICES: Choice[] = ACCOUNT_TYPE_OPTIONS.map((o) => ({
  ...o,
  icon: o.value === "cnpj" ? <Building2 className="h-[18px] w-[18px]" aria-hidden="true" /> : <User className="h-[18px] w-[18px]" aria-hidden="true" />,
}));

export function SignupFlow({ onSuccess, onLogin, onRecover }: SignupFlowProps) {
  const [form, setForm] = useState<SignupForm>(EMPTY_SIGNUP);
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState<Partial<Record<SignupField, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [failure, setFailure] = useState<{ kind: SignupFailureKind; message: string } | null>(null);
  const [resend, setResend] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [resending, setResending] = useState(false);
  // Quem toca em "Editar" na revisão volta direto para a revisão depois de corrigir.
  const [returnToReview, setReturnToReview] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const firstRender = useRef(true);
  const cooldown = useCountdown();

  const errors = stepErrors(step, form);
  const shown = (field: SignupField): string | undefined => (touched[field] ? errors[field] : undefined);
  const touch = (fields: SignupField[]) =>
    setTouched((current) => ({ ...current, ...Object.fromEntries(fields.map((f) => [f, true])) }));
  const set = <K extends SignupField>(key: K, value: SignupForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  // Cada passo novo leva o foco ao primeiro campo (ou ao título, na revisão), para teclado e leitor de tela.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const target = formRef.current?.querySelector<HTMLElement>("[data-autofocus]")
      ?? document.querySelector<HTMLElement>("[data-auth-heading]");
    target?.focus();
  }, [step]);

  useEffect(() => {
    if (phase === "verify") document.querySelector<HTMLElement>("[data-auth-heading]")?.focus();
  }, [phase]);

  // O erro do envio fica embaixo do formulário: traz para a tela quando aparece.
  useEffect(() => {
    if (failure) failureRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [failure]);

  const focusField = (field: SignupField) => {
    const element = formRef.current?.querySelector<HTMLElement>(`#su-${field}`);
    if (!element) return;
    (element.tagName === "FIELDSET" ? element.querySelector<HTMLElement>("input") : element)?.focus();
  };

  const chooseAccountType = (value: string) => {
    const type = value === "cnpj" ? "cnpj" : "cpf";
    setForm((current) => (current.accountType === type ? current : { ...current, accountType: type, document: "", companyName: "" }));
    setTouched((current) => ({ ...current, document: false, companyName: false }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current || phase !== "form") return;

    const current = stepErrors(step, form);
    const invalid = Object.keys(current) as SignupField[];
    if (invalid.length) {
      touch(invalid);
      focusField(invalid[0]);
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep(returnToReview ? TOTAL_STEPS : step + 1);
      setReturnToReview(false);
      return;
    }

    // Última conferência do formulário inteiro antes de falar com o servidor.
    const badStep = firstInvalidStep(form);
    if (badStep) {
      touch(fieldsOfStep(badStep, form.accountType));
      setStep(badStep);
      return;
    }

    busy.current = true;
    setFailure(null);
    setPhase("creating");
    const result = await requestSignup(buildSignupRequest(form));
    if (!result.ok) {
      busy.current = false;
      setPhase("form");
      setFailure({ kind: result.kind, message: result.message });
      return;
    }
    if (result.requireVerification) {
      busy.current = false;
      cooldown.start(VERIFY_RESEND_SECONDS);
      setPhase("verify");
      return;
    }

    // Confirmação de e-mail desligada: a conta já nasce ativa e a pessoa entra direto.
    setPhase("signing-in");
    const login = await signInSeller(form.email, form.password);
    busy.current = false;
    if (login.ok) {
      toast.success("Conta criada. Bem-vindo!");
      onSuccess();
      return;
    }
    const email = normalizeEmail(form.email);
    onLogin(email, login.kind === "invalid"
      ? { tone: "info", message: "Sua conta foi criada, mas não conseguimos entrar sozinhos. Se este e-mail já tinha conta, use a senha dela ou recupere o acesso." }
      : { tone: "success", message: "Conta criada. Entre com seu e-mail e a senha que você acabou de criar." });
  };

  const handleResend = async () => {
    if (resending || cooldown.seconds > 0) return;
    setResending(true);
    setResend(null);
    const result = await resendSignupEmail(form.email);
    setResending(false);
    if (result.ok) {
      cooldown.start(VERIFY_RESEND_SECONDS);
      setResend({ tone: "info", text: "Enviamos o e-mail de novo. Confira também o spam." });
    } else {
      setResend({ tone: "error", text: result.message });
    }
  };

  /* ───────── confirme seu e-mail ───────── */
  if (phase === "verify") {
    const email = normalizeEmail(form.email);
    return (
      <div>
        <AuthHeading title="Confirme seu e-mail" sub="Falta um passo para ativar a conta." />
        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-3 rounded-[10px] bg-muted/60 px-4 py-4 ring-1 ring-border">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Enviamos um link de confirmação para <span className="font-medium text-foreground [overflow-wrap:anywhere]">{email}</span>. Abra o e-mail e clique no link para ativar a conta. Se não encontrar, olhe o spam.
            </p>
          </div>
          {resend && <FormNotice tone={resend.tone}>{resend.text}</FormNotice>}
          <Button type="button" variant="outline" disabled={resending || cooldown.seconds > 0} onClick={() => void handleResend()} className={`w-full ${secondaryButtonClass}`}>
            {resending ? "Enviando…" : cooldown.seconds > 0 ? `Reenviar e-mail em ${cooldown.seconds} s` : "Reenviar e-mail"}
          </Button>
          <Button type="button" onClick={() => onLogin(email)} className={primaryButtonClass}>Já confirmei, entrar</Button>
          <p className="text-center text-[13px] text-muted-foreground">
            E-mail errado?{" "}
            <button type="button" onClick={() => { setPhase("form"); setStep(2); }} className={linkButtonClass}>Corrigir e-mail</button>
          </p>
        </div>
      </div>
    );
  }

  const heading = SIGNUP_STEPS[step - 1];
  const working = phase !== "form";
  const emailSuggestion = touched.email ? suggestEmail(form.email) : null;
  const isCompany = form.accountType === "cnpj";

  return (
    <div>
      <AuthHeading title={heading.title} sub={heading.sub} />

      <div
        className="mt-5 border-y border-border py-3"
        role="progressbar"
        aria-label="Etapas do cadastro"
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
        aria-valuetext={`Passo ${step} de ${TOTAL_STEPS}: ${heading.tag}`}
      >
        <div className="flex items-center gap-2" aria-hidden="true">
          {SIGNUP_STEPS.map((_, index) => (
            <div key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full bg-primary"
                initial={false}
                animate={{ width: index + 1 <= step ? "100%" : "0%" }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground" aria-hidden="true">
          <span className="font-semibold text-foreground/70">{heading.tag}</span>
          <span className="font-medium tabular-nums">{String(step).padStart(2, "0")} / {String(TOTAL_STEPS).padStart(2, "0")}</span>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-5" aria-label={`Cadastro, passo ${step} de ${TOTAL_STEPS}`}>
        <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
          {step === 1 && (
            <>
              <ChoiceGroup
                id="su-accountType"
                name="accountType"
                legend="Como você vai receber?"
                value={form.accountType}
                onChange={chooseAccountType}
                options={ACCOUNT_CHOICES}
                variant="card"
              />
              <TextField
                id="su-fullName"
                data-autofocus=""
                label={isCompany ? "Nome completo do responsável" : "Nome completo"}
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                onBlur={() => touch(["fullName"])}
                error={shown("fullName")}
                placeholder="Como está no documento"
                autoComplete="name"
                maxLength={120}
              />
              <TextField
                id="su-nickname"
                label="Como quer ser chamado?"
                value={form.nickname}
                onChange={(e) => set("nickname", e.target.value)}
                onBlur={() => touch(["nickname"])}
                error={shown("nickname")}
                placeholder="Ex.: João, Mari…"
                autoComplete="nickname"
                maxLength={30}
              />
            </>
          )}

          {step === 2 && (
            <>
              <TextField
                id="su-email"
                data-autofocus=""
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => touch(["email"])}
                error={shown("email")}
                hint={emailSuggestion ? (
                  <>Você quis dizer{" "}
                    <button type="button" onClick={() => set("email", emailSuggestion)} className={linkButtonClass}>{emailSuggestion}</button>?
                  </>
                ) : "É com ele que você entra na conta e recupera a senha."}
                placeholder="seu@email.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
              />
              <TextField
                id="su-phone"
                label="WhatsApp"
                value={form.phone}
                onChange={(e) => set("phone", formatPhone(e.target.value))}
                onBlur={() => touch(["phone"])}
                error={shown("phone")}
                hint="Com DDD. É o número de contato da conta."
                placeholder="(11) 91234-5678"
                autoComplete="tel-national"
                inputMode="tel"
              />
            </>
          )}

          {step === 3 && (
            <>
              {isCompany && (
                <TextField
                  id="su-companyName"
                  data-autofocus=""
                  label="Razão social"
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  onBlur={() => touch(["companyName"])}
                  error={shown("companyName")}
                  placeholder="Nome da empresa no CNPJ"
                  autoComplete="organization"
                  maxLength={160}
                />
              )}
              <TextField
                id="su-document"
                data-autofocus={isCompany ? undefined : ""}
                label={isCompany ? "CNPJ" : "CPF"}
                value={form.document}
                onChange={(e) => set("document", formatDocument(e.target.value, form.accountType))}
                onBlur={() => touch(["document"])}
                error={shown("document")}
                placeholder={isCompany ? "00.000.000/0000-00" : "000.000.000-00"}
                inputMode="numeric"
                autoComplete="off"
              />
              <div className="flex items-start gap-3 rounded-[10px] bg-muted/50 px-4 py-3 ring-1 ring-border">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  O documento é usado apenas para validar seu recebimento e não pode ser alterado depois. Ele fica criptografado e nunca aparece para seus clientes.
                </p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <SelectField
                id="su-segment"
                data-autofocus=""
                label="O que você vende?"
                value={form.segment}
                onValueChange={(v) => { set("segment", v); touch(["segment"]); }}
                onBlur={() => touch(["segment"])}
                options={SEGMENT_OPTIONS}
                placeholder="Selecione o segmento"
                error={shown("segment")}
              />
              <ChoiceGroup
                id="su-monthlyRevenue"
                name="monthlyRevenue"
                legend="Faturamento mensal estimado"
                value={form.monthlyRevenue}
                onChange={(v) => { set("monthlyRevenue", v); touch(["monthlyRevenue"]); }}
                options={REVENUE_OPTIONS}
                error={shown("monthlyRevenue")}
              />
              <SelectField
                id="su-referralSource"
                label="Onde conheceu a Vemprapay?"
                value={form.referralSource}
                onValueChange={(v) => { set("referralSource", v); touch(["referralSource"]); }}
                onBlur={() => touch(["referralSource"])}
                options={REFERRAL_OPTIONS}
                placeholder="Selecione uma opção"
                error={shown("referralSource")}
              />
            </>
          )}

          {step === 5 && (
            <>
              <div>
                <PasswordField
                  id="su-password"
                  data-autofocus=""
                  label="Senha"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  onBlur={() => touch(["password"])}
                  error={shown("password")}
                  placeholder="Crie uma senha forte"
                  autoComplete="new-password"
                  maxLength={PASSWORD_MAX}
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword((v) => !v)}
                />
                <PasswordHelp password={form.password} />
              </div>
              <PasswordField
                id="su-confirmPassword"
                label="Confirmar senha"
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                onBlur={() => touch(["confirmPassword"])}
                error={shown("confirmPassword")}
                placeholder="Digite a senha de novo"
                autoComplete="new-password"
                maxLength={PASSWORD_MAX}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((v) => !v)}
              />
            </>
          )}

          {step === 6 && (
            <>
              <div className="divide-y divide-border overflow-hidden rounded-[12px] ring-1 ring-border">
                {summarySections(form).map((section) => (
                  <section key={section.title} aria-label={section.title} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[12px] font-semibold text-foreground/70">{section.title}</h2>
                      <button
                        type="button"
                        onClick={() => { setReturnToReview(true); setStep(section.step); }}
                        disabled={working}
                        aria-label={`Editar ${section.title.toLowerCase()}`}
                        className={`text-[12px] ${linkButtonClass}`}
                      >
                        Editar
                      </button>
                    </div>
                    <dl className="mt-1.5 space-y-1">
                      {section.rows.map((row) => (
                        <div key={row.label} className="flex items-baseline justify-between gap-4">
                          <dt className="shrink-0 text-[13px] text-muted-foreground">{row.label}</dt>
                          <dd className="min-w-0 truncate text-right text-[13px] font-medium text-foreground">{row.value || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>

              <div>
                <label className="flex cursor-pointer items-start gap-3 rounded-[10px] p-4 ring-1 ring-border transition-colors hover:bg-muted/30">
                  <input
                    id="su-acceptTerms"
                    type="checkbox"
                    checked={form.acceptTerms}
                    onChange={(e) => { set("acceptTerms", e.target.checked); touch(["acceptTerms"]); }}
                    aria-invalid={shown("acceptTerms") ? true : undefined}
                    aria-describedby={shown("acceptTerms") ? "su-acceptTerms-error" : undefined}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-primary"
                  />
                  <span className="text-[13px] leading-relaxed text-muted-foreground">
                    Li e concordo com os{" "}
                    <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className={linkButtonClass}>Termos de Uso</a>{" "}
                    e com a{" "}
                    <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className={linkButtonClass}>Política de Privacidade</a>.
                  </span>
                </label>
                {shown("acceptTerms") && (
                  <p id="su-acceptTerms-error" role="alert" className="mt-1.5 text-[12.5px] leading-snug text-destructive">{shown("acceptTerms")}</p>
                )}
              </div>

              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Depois de criar a conta, você envia seus documentos para verificação. O saque só é processado depois que ela for aprovada.
              </p>
            </>
          )}

          {failure && (
            <div ref={failureRef}>
              <FormNotice
                tone="error"
                actions={failure.kind === "rejected" ? (
                  <>
                    <button type="button" onClick={() => onLogin(normalizeEmail(form.email))} className={`text-[13px] ${linkButtonClass}`}>Entrar na conta</button>
                    <button type="button" onClick={() => onRecover(normalizeEmail(form.email))} className={`text-[13px] ${linkButtonClass}`}>Recuperar senha</button>
                  </>
                ) : undefined}
              >
                {failure.message}
              </FormNotice>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            {step > 1 && (
              <Button type="button" variant="outline" disabled={working} onClick={() => { setReturnToReview(false); setStep(step - 1); }} className={cn(secondaryButtonClass, "flex-1")}>
                Voltar
              </Button>
            )}
            <Button type="submit" disabled={working} className={cn(primaryButtonClass, step > 1 && "w-auto flex-[1.6]")}>
              {phase === "creating" ? <><Spinner className="mr-2" />Criando conta…</>
                : phase === "signing-in" ? <><Spinner className="mr-2" />Entrando…</>
                : step < TOTAL_STEPS && returnToReview ? "Voltar à revisão"
                : step < TOTAL_STEPS ? <>Continuar <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></>
                : "Criar conta"}
            </Button>
          </div>
        </motion.div>
      </form>

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        Já possui uma conta?{" "}
        <button type="button" onClick={() => onLogin()} disabled={working} className={linkButtonClass}>Entrar</button>
      </p>
    </div>
  );
}
