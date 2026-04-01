import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Rocket, Eye, EyeOff, Zap, Shield, GraduationCap, BarChart2, CreditCard, Users, TrendingUp, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d) => {
      let r = a;
      if (b) r += "." + b;
      if (c) r += "." + c;
      if (d) r += "-" + d;
      return r;
    });
  }
  return digits.replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, a, b, c, d, e) => {
    let r = a;
    if (b) r += "." + b;
    if (c) r += "." + c;
    if (d) r += "/" + d;
    if (e) r += "-" + e;
    return r;
  });
}

function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rem = (sum * 10) % 11; if (rem === 10) rem = 0;
  if (rem !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rem = (sum * 10) % 11; if (rem === 10) rem = 0;
  return rem === parseInt(digits[10]);
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let rem = sum % 11; const d1 = rem < 2 ? 0 : 11 - rem;
  if (parseInt(digits[12]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  rem = sum % 11; const d2 = rem < 2 ? 0 : 11 - rem;
  return parseInt(digits[13]) === d2;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number>(0);
  const navigate = useNavigate();

  const handleDocumentChange = (value: string) => {
    const formatted = formatDocument(value);
    setDocument(formatted);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 11) {
      setDocumentError(validateCPF(digits) ? "" : "CPF inválido");
    } else if (digits.length === 14) {
      setDocumentError(validateCNPJ(digits) ? "" : "CNPJ inválido");
    } else {
      setDocumentError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLogin && Date.now() < lockoutUntil) {
      const secsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
      toast.error(`Muitas tentativas. Aguarde ${secsLeft}s.`);
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setLoginAttempts(prev => {
            const next = prev + 1;
            if (next >= 5) setLockoutUntil(Date.now() + 60000);
            return next;
          });
          throw error;
        }
        setLoginAttempts(0);
        navigate("/dashboard");
      } else {
        if (password !== confirmPassword) {
          toast.error("As senhas não coincidem");
          setLoading(false);
          return;
        }
        const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!PASSWORD_REGEX.test(password)) {
          toast.error("Senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula e número");
          setLoading(false);
          return;
        }
        const digits = document.replace(/\D/g, "");
        if (digits.length === 11 && !validateCPF(digits)) {
          toast.error("CPF inválido");
          setLoading(false);
          return;
        }
        if (digits.length === 14 && !validateCNPJ(digits)) {
          toast.error("CNPJ inválido");
          setLoading(false);
          return;
        }
        if (digits.length !== 11 && digits.length !== 14) {
          toast.error("Informe um CPF ou CNPJ válido");
          setLoading(false);
          return;
        }
        if (!referralSource) {
          toast.error("Selecione onde conheceu a plataforma");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              nickname: nickname,
              document_number: digits,
              document_type: digits.length === 11 ? "cpf" : "cnpj",
              phone: phone.replace(/\D/g, ""),
              referral_source: referralSource,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Conta criada com sucesso! Verifique seu e-mail para ativar a conta.");
        setIsLogin(true);
      }
    } catch (error: unknown) {
      const msg = (error as any)?.message || "";
      if (msg.includes("Invalid login")) toast.error("E-mail ou senha incorretos.");
      else if (msg.includes("already registered")) toast.error("Este e-mail já está cadastrado.");
      else if (msg.includes("Email not confirmed")) toast.error("Confirme seu e-mail antes de acessar.");
      else toast.error("Instabilidade na rede. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground overflow-y-auto">
      {/* ─── Left — Form ─── */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-info/6 blur-[100px]" />
        </div>

        <div className="w-full max-w-md relative z-10">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center shadow-xl shadow-primary/20">
              <Rocket className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-black tracking-[-0.04em] text-foreground">HOTZFY</h1>
              <p className="text-[11px] text-muted-foreground/60 font-medium">Plataforma de Infoprodutos</p>
            </div>
          </div>

          {/* Card */}
          <div className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-6 md:p-8 shadow-[0_4px_24px_hsl(var(--foreground)/0.06)]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent rounded-2xl" />

            <div className="relative z-[1]">
              <h2 className="text-xl font-display font-black tracking-[-0.03em] mb-1 text-foreground">
                {isLogin ? "Entrar na sua conta" : "Criar nova conta"}
              </h2>
              <p className="text-[13px] text-muted-foreground/70 mb-6">
                {isLogin ? "Acesse seu painel de infoprodutor" : "Comece a vender seus infoprodutos"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <Label htmlFor="name" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">Nome completo</Label>
                      <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" className="mt-1.5 h-11 rounded-xl border-border/40 bg-card/60" required={!isLogin} />
                    </div>
                    <div>
                      <Label htmlFor="nickname" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">Como quer ser chamado?</Label>
                      <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Ex: João, Mari..." className="mt-1.5 h-11 rounded-xl border-border/40 bg-card/60" required={!isLogin} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="document" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">CPF ou CNPJ</Label>
                        <Input
                          id="document"
                          value={document}
                          onChange={(e) => handleDocumentChange(e.target.value)}
                          placeholder="000.000.000-00"
                          inputMode="numeric"
                          autoComplete="off"
                          className={`mt-1.5 h-11 rounded-xl border-border/40 bg-card/60 ${documentError ? "border-destructive ring-1 ring-destructive/20" : ""}`}
                          required={!isLogin}
                        />
                        {documentError && <p className="text-[10px] text-destructive mt-1 font-medium">{documentError}</p>}
                      </div>
                      <div>
                        <Label htmlFor="phone" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">WhatsApp</Label>
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
                          className="mt-1.5 h-11 rounded-xl border-border/40 bg-card/60"
                          required={!isLogin}
                        />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="email" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="mt-1.5 h-11 rounded-xl border-border/40 bg-card/60" required />
                </div>
                <div>
                  <Label htmlFor="password" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">Senha</Label>
                  <div className="relative mt-1.5">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 rounded-xl border-border/40 bg-card/60 pr-10" required minLength={8} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {!isLogin && (
                    <p className="text-[9px] text-muted-foreground/40 mt-1.5">Mín. 8 caracteres, maiúscula, minúscula e número</p>
                  )}
                </div>
                {!isLogin && (
                  <>
                    <div>
                      <Label htmlFor="confirmPassword" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">Confirmar Senha</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`mt-1.5 h-11 rounded-xl border-border/40 bg-card/60 ${confirmPassword && password !== confirmPassword ? "border-destructive ring-1 ring-destructive/20" : ""}`}
                        required={!isLogin}
                        minLength={6}
                      />
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-[10px] text-destructive mt-1 font-medium">As senhas não coincidem</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">Onde conheceu a plataforma?</Label>
                      <Select value={referralSource} onValueChange={setReferralSource}>
                        <SelectTrigger className="mt-1.5 h-11 rounded-xl border-border/40 bg-card/60">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="indicacao">Indicação</SelectItem>
                          <SelectItem value="youtube">YouTube</SelectItem>
                          <SelectItem value="pesquisa">Pesquisa (Google)</SelectItem>
                          <SelectItem value="tiktok">TikTok</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full gradient-primary text-primary-foreground font-bold h-12 rounded-xl text-sm shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-[1px] transition-all gap-2" disabled={loading}>
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      {isLogin ? "Entrar" : "Criar conta grátis"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center space-y-3">
                <button onClick={() => setIsLogin(!isLogin)} className="text-[13px] text-primary hover:text-primary/80 font-bold transition-colors">
                  {isLogin ? "Não tem conta? Cadastre-se grátis" : "Já tem conta? Entrar"}
                </button>
                <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
                  Ao continuar, você concorda com os{" "}
                  <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/60 transition-colors">Termos de Uso</a> e{" "}
                  <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/60 transition-colors">Política de Privacidade</a>.
                </p>
              </div>

              {/* Trust badges */}
              {isLogin && (
                <div className="mt-6 flex items-center justify-center gap-4 pt-5 border-t border-border/20">
                  {[
                    { icon: Shield, label: "SSL Seguro" },
                    { icon: Zap, label: "Acesso Rápido" },
                    { icon: CheckCircle2, label: "LGPD" },
                  ].map(b => (
                    <div key={b.label} className="flex items-center gap-1.5 text-muted-foreground/30">
                      <b.icon className="h-3 w-3" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">{b.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right — Features (Desktop) ─── */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden">
        {/* Background effects */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-info/[0.03]" />
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-info/8 blur-[100px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }} />
        </div>

        <div className="max-w-sm relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-8 shadow-lg shadow-primary/5">
            <Sparkles className="h-3.5 w-3.5" />
            Plataforma #1 de Infoprodutos
          </div>

          <h2 className="text-4xl font-display font-black mb-4 text-foreground leading-[1.1] tracking-[-0.04em]">
            Tudo que você precisa para{" "}
            <span className="text-gradient">vender online</span>
          </h2>
          <p className="text-[15px] text-muted-foreground/70 mb-10 leading-relaxed">
            Checkout otimizado, área de membros, processamento de pagamentos e ferramentas avançadas de analytics.
          </p>
          
          <div className="space-y-3">
            {[
              { icon: CreditCard, title: "Checkout de Alta Conversão", desc: "PIX, Cartão e Boleto com 1-click", tone: "primary" },
              { icon: GraduationCap, title: "Área de Membros Netflix", desc: "Entregue cursos e conteúdos premium", tone: "info" },
              { icon: BarChart2, title: "Analytics em Tempo Real", desc: "Métricas completas das suas vendas", tone: "warning" },
              { icon: Shield, title: "Anti-fraude Integrado", desc: "Blacklist, velocity check e proteção total", tone: "success" },
            ].map((f) => {
              const toneBg: Record<string, string> = {
                primary: "bg-primary/10 ring-primary/15",
                info: "bg-info/10 ring-info/15",
                warning: "bg-warning/10 ring-warning/15",
                success: "bg-success/10 ring-success/15",
              };
              const toneText: Record<string, string> = {
                primary: "text-primary",
                info: "text-info",
                warning: "text-warning",
                success: "text-success",
              };
              return (
                <div key={f.title} className="group flex items-center gap-4 p-4 rounded-2xl bg-card/50 backdrop-blur-xl border border-border/40 hover:border-border/60 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ring-1 shrink-0 ${toneBg[f.tone]}`}>
                    <f.icon className={`h-5 w-5 ${toneText[f.tone]}`} />
                  </div>
                  <div>
                    <p className="text-[14px] font-display font-bold text-foreground tracking-[-0.02em]">{f.title}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              { value: "10K+", label: "Produtores", icon: Users },
              { value: "R$50M+", label: "Processados", icon: TrendingUp },
              { value: "99.9%", label: "Uptime", icon: Zap },
            ].map(s => (
              <div key={s.label} className="text-center p-3 rounded-xl bg-card/30 backdrop-blur-sm border border-border/20">
                <s.icon className="h-4 w-4 mx-auto mb-1.5 text-primary/60" />
                <p className="text-[16px] font-display font-black text-foreground tracking-[-0.03em]">{s.value}</p>
                <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
