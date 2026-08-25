/**
 * Auth — Cinematic split-screen login / signup
 * @module Auth
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Eye, EyeOff, Shield, CheckCircle2, ArrowRight, Lock,
  KeyRound, RotateCcw, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AuthAside } from "@/components/auth/AuthAside";
import { HotzfyLogo } from "@/components/HotzfyLogo";
import { Seo } from "@/components/Seo";
import { friendlyError } from "@/lib/friendlyError";

/* ─────────────────── Document helpers ─────────────────── */
function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) => {
      let r = a; if (b) r += "." + b; if (c) r += "." + c; if (d) r += "-" + d; return r;
    });
  }
  return digits.replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, a, b, c, d, e) => {
    let r = a; if (b) r += "." + b; if (c) r += "." + c; if (d) r += "/" + d; if (e) r += "-" + e; return r;
  });
}
function validateCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0; if (r !== parseInt(d[9])) return false;
  s = 0; for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0; return r === parseInt(d[10]);
}
function validateCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2], w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  let s = 0; for (let i = 0; i < 12; i++) s += parseInt(d[i]) * w1[i];
  let r = s % 11; const d1 = r < 2 ? 0 : 11 - r; if (parseInt(d[12]) !== d1) return false;
  s = 0; for (let i = 0; i < 13; i++) s += parseInt(d[i]) * w2[i];
  r = s % 11; const d2 = r < 2 ? 0 : 11 - r; return parseInt(d[13]) === d2;
}

function getPasswordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++; if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++; if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++; if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { score: 1, label: "Fraca", color: "bg-destructive", text: "text-destructive" };
  if (score <= 4) return { score: 2, label: "Média", color: "bg-warning", text: "text-warning" };
  return { score: 3, label: "Forte", color: "bg-success", text: "text-success" };
}

/** Tipos de conta suportados no cadastro. */
type AccountType = "cpf" | "cnpj";

const ACCOUNT_TYPES: ReadonlyArray<{ value: AccountType; label: string; hint: string; icon: typeof User }> = [
  { value: "cpf", label: "Pessoa física", hint: "Recebo com meu CPF", icon: User },
  { value: "cnpj", label: "Pessoa jurídica", hint: "Tenho empresa aberta", icon: Building2 },
];

const SEGMENTS = [
  { value: "infoproduto", label: "Curso / Infoproduto" },
  { value: "mentoria", label: "Mentoria ou consultoria" },
  { value: "comunidade", label: "Comunidade / Assinatura" },
  { value: "ebook", label: "E-book e materiais digitais" },
  { value: "software", label: "Software ou SaaS" },
  { value: "servico", label: "Prestação de serviço" },
  { value: "fisico", label: "Produto físico" },
  { value: "outro", label: "Outro" },
] as const;

const REVENUE_BANDS = [
  { value: "ate_10k", label: "Até R$ 10 mil" },
  { value: "10k_50k", label: "R$ 10 a 50 mil" },
  { value: "50k_200k", label: "R$ 50 a 200 mil" },
  { value: "acima_200k", label: "Acima de R$ 200 mil" },
] as const;

const STEP_TITLES = [
  { tag: "Identificação", title: "Vamos começar", sub: "Escolha como você vai receber e diga seu nome." },
  { tag: "Contato", title: "Como falamos com você", sub: "Avisos de venda, saque e segurança chegam por aqui." },
  { tag: "Documento", title: "Confirme seu documento", sub: "Necessário para liberar seus recebimentos." },
  { tag: "Operação", title: "Sobre o seu negócio", sub: "Isso ajusta limites e taxas ao seu perfil." },
  { tag: "Segurança", title: "Proteja sua conta", sub: "Uma senha forte e você está pronto." },
  { tag: "Revisão", title: "Tudo certo", sub: "Confira os dados antes de ativar a conta." },
];

const TOTAL_STEPS = STEP_TITLES.length;


export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("cpf");
  const [companyName, setCompanyName] = useState("");
  const [segment, setSegment] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const [recoveryMode, setRecoveryMode] = useState<"idle" | "email" | "code" | "done">("idle");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const navigate = useNavigate();

  const pwStrength = getPasswordStrength(password);
  const newPwStrength = getPasswordStrength(newPassword);

  const documentDigits = document.replace(/\D/g, "");
  const documentValid =
    accountType === "cpf" ? documentDigits.length === 11 && validateCPF(documentDigits)
      : documentDigits.length === 14 && validateCNPJ(documentDigits);

  const passwordRules = [
    { label: "8+ caracteres", ok: password.length >= 8 },
    { label: "1 letra maiúscula", ok: /[A-Z]/.test(password) },
    { label: "1 letra minúscula", ok: /[a-z]/.test(password) },
    { label: "1 número", ok: /\d/.test(password) },
  ];

  const summaryRows = [
    { label: "Tipo de conta", value: accountType === "cnpj" ? "Pessoa jurídica" : "Pessoa física" },
    { label: "Nome", value: fullName },
    ...(accountType === "cnpj" ? [{ label: "Razão social", value: companyName }] : []),
    { label: "Apelido", value: nickname },
    { label: "E-mail", value: email },
    { label: accountType === "cnpj" ? "CNPJ" : "CPF", value: document },
    { label: "WhatsApp", value: phone },
    { label: "Segmento", value: SEGMENTS.find((s) => s.value === segment)?.label ?? "" },
    { label: "Faturamento", value: REVENUE_BANDS.find((b) => b.value === monthlyRevenue)?.label ?? "" },
  ];


  useEffect(() => { setStep(1); }, [isLogin]);
  useEffect(() => { if (!isLogin) setRecoveryMode("idle"); }, [isLogin]);

  const handleRecoveryStart = async () => {
    const targetEmail = recoveryEmail || email;
    if (!targetEmail.includes("@")) { toast.error("Informe um e-mail válido"); return; }
    setRecoveryLoading(true);
    setRecoveryError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setRecoveryEmail(targetEmail);
      setRecoveryMode("code");
      toast.success("Código enviado para seu e-mail!");
    } catch (err: unknown) {
      toast.error((err instanceof Error && friendlyError(err)) || "Erro ao enviar código. Tente novamente.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleRecoveryVerify = async () => {
    if (!recoveryCode.trim()) { setRecoveryError("Informe o código"); return; }
    if (newPassword.length < 8) { setRecoveryError("Senha deve ter no mínimo 8 caracteres"); return; }
    if (newPassword !== confirmNewPassword) { setRecoveryError("As senhas não coincidem"); return; }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) { setRecoveryError("Senha deve ter maiúscula, minúscula e número"); return; }
    setRecoveryLoading(true);
    setRecoveryError("");
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: recoveryEmail,
        token: recoveryCode.trim(),
        type: "recovery",
      });
      if (verifyError) {
        if (verifyError.message?.includes("expired")) setRecoveryError("Código expirado. Solicite um novo.");
        else setRecoveryError("Código inválido!");
        setRecoveryLoading(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      try { await supabase.auth.signOut({ scope: "others" }); } catch (_) { /* noop */ }
      setRecoveryMode("done");
      toast.success("Senha alterada com sucesso! Outros dispositivos foram desconectados.");
      setTimeout(() => {
        setRecoveryMode("idle");
        setRecoveryCode("");
        setNewPassword("");
        setConfirmNewPassword("");
        setRecoveryEmail("");
      }, 3000);
    } catch (err: unknown) {
      setRecoveryError((err instanceof Error && err.message) || "Erro ao alterar senha.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleDocumentChange = (value: string) => {
    const max = accountType === "cnpj" ? 14 : 11;
    const digits = value.replace(/\D/g, "").slice(0, max);
    const formatted = formatDocument(digits);
    setDocument(formatted);
    if (accountType === "cpf") {
      setDocumentError(digits.length === 11 && !validateCPF(digits) ? "CPF inválido" : "");
    } else {
      setDocumentError(digits.length === 14 && !validateCNPJ(digits) ? "CNPJ inválido" : "");
    }
  };

  const canAdvanceStep = (s: number) => {
    if (s === 1) return fullName.trim().length >= 3 && nickname.trim().length >= 2;
    if (s === 2) return email.includes("@") && phone.replace(/\D/g, "").length >= 10;
    if (s === 3) return documentValid && (accountType === "cpf" || companyName.trim().length >= 2);
    if (s === 4) return !!segment && !!monthlyRevenue && !!referralSource;
    if (s === 5) return password.length >= 8 && password === confirmPassword && passwordRules.every((r) => r.ok);
    return acceptTerms;
  };


  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLogin && Date.now() < lockoutUntil) {
      toast.error(`Muitas tentativas. Aguarde ${Math.ceil((lockoutUntil - Date.now()) / 1000)}s.`);
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { data, error: fnError } = await supabase.functions.invoke("gated-login", {
          body: { email: email.toLowerCase().trim(), password, scope: "seller" },
        });
        if (fnError || !data?.success) {
          setLoginAttempts((prev) => {
            const next = prev + 1;
            if (next >= 5) setLockoutUntil(Date.now() + 60000);
            return next;
          });
          toast.error(data?.error || fnError?.message || "E-mail ou senha incorretos.");
          return;
        }
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionError) {
          toast.error(friendlyError(sessionError));
          return;
        }
        setLoginAttempts(0);
        navigate("/dashboard");
      } else {
        if (!acceptTerms) { toast.error("Aceite os Termos de Uso para continuar"); setLoading(false); return; }
        if (password !== confirmPassword) { toast.error("As senhas não coincidem"); setLoading(false); return; }
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) { toast.error("Senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula e número"); setLoading(false); return; }
        const digits = document.replace(/\D/g, "");
        if (digits.length === 11 && !validateCPF(digits)) { toast.error("CPF inválido"); setLoading(false); return; }
        if (digits.length === 14 && !validateCNPJ(digits)) { toast.error("CNPJ inválido"); setLoading(false); return; }
        if (digits.length !== 11 && digits.length !== 14) { toast.error("Informe um CPF ou CNPJ válido"); setLoading(false); return; }
        if (!referralSource) { toast.error("Selecione onde conheceu a plataforma"); setLoading(false); return; }

        const cleanPhone = phone.replace(/\D/g, "");
        const { data: conflict, error: conflictErr } = await supabase.rpc("check_signup_conflicts", {
          _email: email.toLowerCase().trim(),
          _document_number: digits,
          _phone: cleanPhone,
        });
        if (conflictErr) { toast.error("Erro ao verificar dados. Tente novamente."); setLoading(false); return; }
        if (conflict === "email") { toast.error("Este e-mail já está cadastrado. Faça login ou use outro e-mail."); setLoading(false); return; }
        if (conflict === "document") { toast.error("Este CPF/CNPJ já está vinculado a outra conta."); setLoading(false); return; }
        if (conflict === "phone") { toast.error("Este telefone já está vinculado a outra conta."); setLoading(false); return; }

        const { error } = await supabase.auth.signUp({
          email: email.toLowerCase().trim(),
          password,
          options: {
            data: {
              full_name: fullName,
              nickname,
              document_number: digits,
              document_type: digits.length === 11 ? "cpf" : "cnpj",
              phone: cleanPhone,
              referral_source: referralSource,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        let autoConfirmed = false;
        try {
          const { data: cfn } = await supabase.functions.invoke("auto-confirm-signup", {
            body: { email: email.toLowerCase().trim() },
          });
          autoConfirmed = !!(cfn as { confirmed?: boolean } | null)?.confirmed;
        } catch { /* fallback: keep verification flow */ }

        if (autoConfirmed) toast.success("Conta criada com sucesso! Faça login para continuar.");
        else toast.success("Conta criada com sucesso! Verifique seu e-mail para ativar a conta.");
        setIsLogin(true);
        setStep(1);
      }
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || "";
      if (msg.includes("Invalid login")) toast.error("E-mail ou senha incorretos.");
      else if (msg.includes("already registered")) toast.error("Este e-mail já está cadastrado.");
      else if (msg.includes("Email not confirmed")) toast.error("Confirme seu e-mail antes de acessar.");
      else if (msg.includes("duplicate key") || msg.includes("unique")) toast.error("CPF/CNPJ, e-mail ou telefone já cadastrado em outra conta.");
      else toast.error("Instabilidade na rede. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "h-[52px] rounded-[10px] border-border/70 bg-transparent px-4 text-[15px] text-foreground placeholder:text-muted-foreground/50 focus-visible:border-primary/60 focus-visible:ring-0";
  const labelCls = "mb-2 block text-[13px] font-semibold tracking-normal text-foreground/90";

  const heading = isLogin
    ? { title: "Bem-vindo de volta", sub: "Entre para acompanhar sua operação." }
    : STEP_TITLES[step - 1];

  return (
    <div className="min-h-screen bg-[#0a0b0a] text-foreground">
      <Seo
        title={isLogin ? "Entrar — HOTZFY" : "Criar conta grátis — HOTZFY"}
        description={isLogin ? "Acesse seu painel HOTZFY: produtos, vendas, saques e área de membros em um só lugar." : "Crie sua conta HOTZFY gratuitamente e comece a vender infoprodutos com checkout de alta conversão."}
        path="/auth"
      />

      <div className="grid min-h-screen lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)]">
        {/* ═══ LEFT — form ═══ */}
        <div className="relative flex min-h-screen flex-col justify-between px-6 py-10 sm:px-12 lg:px-14">
          <a href="/" className="inline-flex w-fit items-center gap-2.5 opacity-95 transition-opacity hover:opacity-100">
            <HotzfyLogo size={30} />
            <span className="text-[19px] font-heading tracking-[-0.02em] text-foreground">hotzfy</span>
          </a>

          <div className="mx-auto w-full max-w-[420px] py-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? "login-h" : `signup-h-${step}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                <h1 className="text-[30px] font-heading leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[34px]">
                  {recoveryMode !== "idle" && isLogin ? "Recuperar acesso" : heading.title}
                </h1>
                <p className="mt-2 text-[14px] text-muted-foreground">
                  {recoveryMode !== "idle" && isLogin ? "Vamos enviar um código para o seu e-mail." : heading.sub}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Step rail */}
            {!isLogin && (
              <div className="mt-6">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
                    <div key={s} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full bg-primary"
                        initial={false}
                        animate={{ width: s <= step ? "100%" : "0%" }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="uppercase tracking-[0.18em]">{STEP_TITLES[step - 1].tag}</span>
                  <span className="tabular-nums">Etapa {step} de {TOTAL_STEPS}</span>
                </div>
              </div>
            )}


            <div className="mt-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={isLogin ? `login-${recoveryMode}` : `signup-${step}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {isLogin ? (
                    <form onSubmit={handleSubmit}>
                      {recoveryMode === "idle" && (
                        <div className="space-y-5">
                          <div>
                            <Label htmlFor="email" className={labelCls}>E-mail</Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} required />
                          </div>
                          <div>
                            <Label htmlFor="password" className={labelCls}>Senha</Label>
                            <div className="relative">
                              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" className={cn(inputCls, "pr-12")} required minLength={8} />
                              <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
                                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button type="button" onClick={() => { setRecoveryEmail(email); setRecoveryMode("email"); }} className="text-[13px] font-medium text-primary hover:underline underline-offset-4">
                              Esqueceu a senha?
                            </button>
                          </div>
                          <Button type="submit" disabled={loading} className="h-[52px] w-full rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground hover:brightness-105">
                            {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : "Entrar"}
                          </Button>
                          <p className="text-center text-[13px] text-muted-foreground">
                            Ainda não tem conta?{" "}
                            <button type="button" onClick={() => setIsLogin(false)} className="font-medium text-primary hover:underline underline-offset-4">Criar conta</button>
                          </p>
                        </div>
                      )}

                      {recoveryMode === "email" && (
                        <div className="space-y-5">
                          <div>
                            <Label htmlFor="recovery-email" className={labelCls}>E-mail da conta</Label>
                            <Input id="recovery-email" type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} required />
                          </div>
                          <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setRecoveryMode("idle")} className="h-[52px] flex-1 rounded-[10px] border-border/70 bg-transparent text-[15px] font-medium text-muted-foreground hover:text-foreground">
                              Voltar
                            </Button>
                            <Button type="button" onClick={handleRecoveryStart} disabled={recoveryLoading} className="h-[52px] flex-[1.4] rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground hover:brightness-105">
                              {recoveryLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : <>Enviar código <ArrowRight className="ml-2 h-4 w-4" /></>}
                            </Button>
                          </div>
                        </div>
                      )}

                      {recoveryMode === "code" && (
                        <div className="space-y-5">
                          <div className="flex items-center gap-3 rounded-[10px] border border-border/60 px-4 py-3">
                            <KeyRound className="h-4 w-4 shrink-0 text-primary" />
                            <p className="text-[13px] text-muted-foreground">Código enviado para <span className="text-foreground">{recoveryEmail}</span></p>
                          </div>
                          <div>
                            <Label htmlFor="new-password" className={labelCls}>Nova senha</Label>
                            <div className="relative">
                              <Input id="new-password" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className={cn(inputCls, "pr-12")} required minLength={8} />
                              <button type="button" aria-label="Alternar senha" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                              </button>
                            </div>
                            {newPassword.length > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex flex-1 gap-1">
                                  {[1, 2, 3].map((i) => (
                                    <div key={i} className={cn("h-[3px] flex-1 rounded-full", i <= newPwStrength.score ? newPwStrength.color : "bg-white/10")} />
                                  ))}
                                </div>
                                <span className={cn("text-[11px] font-medium", newPwStrength.text)}>{newPwStrength.label}</span>
                              </div>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="confirm-new-password" className={labelCls}>Confirmar nova senha</Label>
                            <Input id="confirm-new-password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Digite novamente" className={cn(inputCls, confirmNewPassword && newPassword !== confirmNewPassword && "border-destructive/60")} required minLength={8} />
                            {confirmNewPassword && newPassword !== confirmNewPassword && <p className="mt-1.5 text-[12px] text-destructive">As senhas não coincidem</p>}
                          </div>
                          <div>
                            <Label htmlFor="recovery-code" className={labelCls}>Código de verificação</Label>
                            <Input id="recovery-code" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" maxLength={6} className={cn(inputCls, "text-center text-[20px] tracking-[0.5em]", recoveryError && "border-destructive/60")} required />
                            {recoveryError && (
                              <p className="mt-1.5 flex items-center gap-1 text-[12px] text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{recoveryError}</p>
                            )}
                          </div>
                          <button type="button" onClick={handleRecoveryStart} disabled={recoveryLoading} className="flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline underline-offset-4">
                            <RotateCcw className="h-3.5 w-3.5" /> Reenviar código
                          </button>
                          <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => { setRecoveryMode("idle"); setRecoveryCode(""); setNewPassword(""); setConfirmNewPassword(""); setRecoveryError(""); }} className="h-[52px] flex-1 rounded-[10px] border-border/70 bg-transparent text-[15px] font-medium text-muted-foreground hover:text-foreground">
                              Cancelar
                            </Button>
                            <Button type="button" onClick={handleRecoveryVerify} disabled={recoveryLoading || recoveryCode.length < 6} className="h-[52px] flex-[1.4] rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground hover:brightness-105">
                              {recoveryLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : "Alterar senha"}
                            </Button>
                          </div>
                        </div>
                      )}

                      {recoveryMode === "done" && (
                        <div className="space-y-4 py-6 text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
                            <CheckCircle2 className="h-7 w-7 text-success" />
                          </div>
                          <div>
                            <p className="text-[17px] font-heading text-foreground">Senha alterada</p>
                            <p className="mt-1 text-[13px] text-muted-foreground">Agora você pode entrar com a nova senha.</p>
                          </div>
                        </div>
                      )}
                    </form>
                  ) : (
                    <div className="space-y-5">
                      {step === 1 && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            {ACCOUNT_TYPES.map((t) => {
                              const Icon = t.icon;
                              const active = accountType === t.value;
                              return (
                                <button
                                  key={t.value}
                                  type="button"
                                  onClick={() => { setAccountType(t.value); setDocument(""); setDocumentError(""); }}
                                  aria-pressed={active}
                                  className={cn(
                                    "group relative rounded-[12px] border p-4 text-left transition-colors duration-200",
                                    active ? "border-primary/70 bg-primary/[0.06]" : "border-border/60 hover:border-border",
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <Icon className={cn("h-[18px] w-[18px]", active ? "text-primary" : "text-muted-foreground")} />
                                    <span className={cn("flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-colors", active ? "border-primary bg-primary" : "border-border/70")}>
                                      {active && <Check className="h-3 w-3 text-primary-foreground" />}
                                    </span>
                                  </div>
                                  <p className="mt-3 text-[14px] font-semibold text-foreground">{t.label}</p>
                                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{t.hint}</p>
                                </button>
                              );
                            })}
                          </div>
                          <div>
                            <Label htmlFor="name" className={labelCls}>Nome completo</Label>
                            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Como está no documento" className={inputCls} required />
                          </div>
                          <div>
                            <Label htmlFor="nickname" className={labelCls}>Como quer ser chamado?</Label>
                            <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Ex: João, Mari..." className={inputCls} required />
                          </div>
                        </>
                      )}

                      {step === 2 && (
                        <>
                          <div>
                            <Label htmlFor="signup-email" className={labelCls}>E-mail</Label>
                            <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} required />
                            <p className="mt-1.5 text-[12px] text-muted-foreground">Enviaremos avisos de venda e saque para este endereço.</p>
                          </div>
                          <div>
                            <Label htmlFor="phone" className={labelCls}>WhatsApp</Label>
                            <Input
                              id="phone"
                              value={phone}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                                let formatted = digits;
                                if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                                if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                                setPhone(formatted);
                              }}
                              placeholder="(11) 99999-9999"
                              inputMode="tel"
                              className={inputCls}
                              required
                            />
                          </div>
                        </>
                      )}

                      {step === 3 && (
                        <>
                          {accountType === "cnpj" && (
                            <div>
                              <Label htmlFor="company" className={labelCls}>Razão social</Label>
                              <Input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nome da empresa no CNPJ" className={inputCls} required />
                            </div>
                          )}
                          <div>
                            <Label htmlFor="document" className={labelCls}>{accountType === "cnpj" ? "CNPJ" : "CPF"}</Label>
                            <div className="relative">
                              <Input
                                id="document"
                                value={document}
                                onChange={(e) => handleDocumentChange(e.target.value)}
                                placeholder={accountType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
                                inputMode="numeric"
                                autoComplete="off"
                                className={cn(inputCls, "pr-11", documentError && "border-destructive/60")}
                                required
                              />
                              {documentValid && (
                                <CheckCircle2 className="absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-success" />
                              )}
                            </div>
                            {documentError && <p className="mt-1.5 flex items-center gap-1 text-[12px] text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{documentError}</p>}
                          </div>
                          <div className="flex items-start gap-3 rounded-[10px] border border-border/60 px-4 py-3">
                            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                              O documento é usado apenas para validar seu recebimento e não pode ser alterado depois. Ele fica criptografado e nunca aparece para seus clientes.
                            </p>
                          </div>
                        </>
                      )}

                      {step === 4 && (
                        <>
                          <div>
                            <Label className={labelCls}>O que você vende?</Label>
                            <Select value={segment} onValueChange={setSegment}>
                              <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione o segmento" /></SelectTrigger>
                              <SelectContent className="rounded-[10px] border-border/70">
                                {SEGMENTS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className={labelCls}>Faturamento mensal estimado</Label>
                            <div className="grid grid-cols-2 gap-2">
                              {REVENUE_BANDS.map((band) => {
                                const active = monthlyRevenue === band.value;
                                return (
                                  <button
                                    key={band.value}
                                    type="button"
                                    onClick={() => setMonthlyRevenue(band.value)}
                                    aria-pressed={active}
                                    className={cn(
                                      "rounded-[10px] border px-3 py-3 text-[13px] font-medium tabular-nums transition-colors duration-200",
                                      active ? "border-primary/70 bg-primary/[0.06] text-foreground" : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
                                    )}
                                  >
                                    {band.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <Label className={labelCls}>Onde conheceu a HOTZFY?</Label>
                            <Select value={referralSource} onValueChange={setReferralSource}>
                              <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
                              <SelectContent className="rounded-[10px] border-border/70">
                                {[
                                  { value: "instagram", label: "Instagram" },
                                  { value: "indicacao", label: "Indicação de amigo" },
                                  { value: "youtube", label: "YouTube" },
                                  { value: "pesquisa", label: "Pesquisa (Google)" },
                                  { value: "tiktok", label: "TikTok" },
                                  { value: "outro", label: "Outro" },
                                ].map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {step === 5 && (
                        <>
                          <div>
                            <Label htmlFor="signup-password" className={labelCls}>Senha</Label>
                            <div className="relative">
                              <Input id="signup-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite a senha desejada" className={cn(inputCls, "pr-12")} required minLength={8} />
                              <button type="button" aria-label="Alternar senha" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                              </button>
                            </div>
                            {password.length > 0 && (
                              <div className="mt-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-1 gap-1">
                                    {[1, 2, 3].map((i) => (
                                      <div key={i} className={cn("h-[3px] flex-1 rounded-full transition-colors", i <= pwStrength.score ? pwStrength.color : "bg-white/10")} />
                                    ))}
                                  </div>
                                  <span className={cn("text-[11px] font-medium", pwStrength.text)}>{pwStrength.label}</span>
                                </div>
                                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                                  {passwordRules.map((rule) => (
                                    <span key={rule.label} className={cn("flex items-center gap-1.5 text-[12px]", rule.ok ? "text-success" : "text-muted-foreground")}>
                                      <Check className={cn("h-3.5 w-3.5", rule.ok ? "opacity-100" : "opacity-30")} />
                                      {rule.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="confirmPassword" className={labelCls}>Confirmar senha</Label>
                            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Digite a senha novamente" className={cn(inputCls, confirmPassword && password !== confirmPassword && "border-destructive/60")} required minLength={8} />
                            {confirmPassword && password !== confirmPassword && <p className="mt-1.5 text-[12px] text-destructive">As senhas não coincidem</p>}
                          </div>
                        </>
                      )}

                      {step === 6 && (
                        <div className="space-y-4">
                          <div className="divide-y divide-border/50 overflow-hidden rounded-[12px] border border-border/60">
                            {summaryRows.map((item) => (
                              <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-3">
                                <span className="text-[13px] text-muted-foreground">{item.label}</span>
                                <span className="max-w-[62%] truncate text-[13px] font-medium text-foreground">{item.value || "—"}</span>
                              </div>
                            ))}
                          </div>
                          <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-border/60 p-4 transition-colors hover:border-border">
                            <input
                              type="checkbox"
                              checked={acceptTerms}
                              onChange={(e) => setAcceptTerms(e.target.checked)}
                              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-primary"
                            />
                            <span className="text-[13px] leading-relaxed text-muted-foreground">
                              Estou ciente e concordo com os <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">Termos de Uso</a> e com a <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">Política de Privacidade</a>.
                            </span>
                          </label>
                        </div>
                      )}


                      <div className="flex gap-3 pt-1">
                        {step > 1 && (
                          <Button type="button" variant="outline" onClick={() => setStep((c) => c - 1)} className="h-[52px] flex-1 rounded-[10px] border-border/70 bg-transparent text-[15px] font-medium text-muted-foreground hover:text-foreground">
                            Voltar
                          </Button>
                        )}
                        {step < TOTAL_STEPS ? (
                          <Button type="button" onClick={() => setStep((c) => c + 1)} disabled={!canAdvanceStep(step)} className="h-[52px] flex-[1.6] rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground hover:brightness-105">
                            Continuar <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>

                        ) : (
                          <Button type="button" onClick={() => handleSubmit()} disabled={loading || !acceptTerms} className="h-[52px] flex-[1.6] rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground hover:brightness-105">
                            {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : "Criar conta"}
                          </Button>
                        )}
                      </div>

                      <p className="text-center text-[13px] text-muted-foreground">
                        Já possui uma conta?{" "}
                        <button type="button" onClick={() => setIsLogin(true)} className="font-medium text-primary hover:underline underline-offset-4">Entrar</button>
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Conexão protegida com SSL 256-bit</span>
            <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> LGPD</span>
          </div>
        </div>

        {/* ═══ RIGHT — painel autoral (sem fotos de terceiros) ═══ */}
        <AuthAside className="hidden min-h-screen lg:block" />

      </div>
    </div>
  );
}
