import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Rocket, Eye, EyeOff, Zap, Shield, GraduationCap, BarChart2, CreditCard } from "lucide-react";
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

    // FIX: Rate limiting - lock after 5 failed attempts for 60s
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
        // Strong password validation
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
      {/* Left — Form */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
        <div className="w-full max-w-md relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-display font-extrabold tracking-tight text-foreground">HOTZFY</h1>
              <p className="text-[10px] text-muted-foreground">Plataforma de Infoprodutos</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold mb-1 text-foreground">
              {isLogin ? "Entrar na sua conta" : "Criar nova conta"}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              {isLogin ? "Acesse seu painel de infoprodutor" : "Comece a vender seus infoprodutos"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {!isLogin && (
                <>
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium">Nome completo</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" className="mt-1" required={!isLogin} />
                  </div>
                  <div>
                    <Label htmlFor="nickname" className="text-sm font-medium">Como quer ser chamado?</Label>
                    <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Ex: João, Mari..." className="mt-1" required={!isLogin} />
                  </div>
                  <div>
                    <Label htmlFor="document" className="text-sm font-medium">CPF ou CNPJ</Label>
                    <Input
                      id="document"
                      value={document}
                      onChange={(e) => handleDocumentChange(e.target.value)}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      autoComplete="off"
                      className={`mt-1 ${documentError ? "border-destructive" : ""}`}
                      required={!isLogin}
                    />
                    {documentError && <p className="text-[11px] text-destructive mt-1">{documentError}</p>}
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="mt-1" required />
              </div>
              <div>
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                <div className="relative mt-1">
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {!isLogin && (
                <>
                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar Senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`mt-1 ${confirmPassword && password !== confirmPassword ? "border-destructive" : ""}`}
                      required={!isLogin}
                      minLength={6}
                    />
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-[11px] text-destructive mt-1">As senhas não coincidem</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Onde conheceu a plataforma?</Label>
                    <Select value={referralSource} onValueChange={setReferralSource}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="indicacao">Indicação</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="pesquisa">Pesquisa (Google)</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Button type="submit" className="w-full gradient-primary text-primary-foreground font-semibold h-11" disabled={loading}>
                {loading ? "Processando..." : isLogin ? "Entrar" : "Criar conta grátis"}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-primary hover:underline font-medium">
                {isLogin ? "Não tem conta? Cadastre-se grátis" : "Já tem conta? Entrar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Features */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden bg-muted/30 border-l border-border">
        <div className="max-w-sm relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/15 text-primary text-xs font-semibold mb-6">
            <Zap className="h-3 w-3" /> Plataforma #1 de Infoprodutos
          </div>
          <h2 className="text-3xl font-display font-extrabold mb-3 text-foreground leading-tight">Tudo que você precisa para vender online</h2>
          <p className="text-sm text-muted-foreground mb-8">Checkout otimizado, área de membros, processamento de pagamentos e muito mais.</p>
          
          <div className="space-y-3">
            {[
              { icon: CreditCard, title: "Checkout de Alta Conversão", desc: "PIX, Cartão e Boleto com 1-click" },
              { icon: GraduationCap, title: "Área de Membros", desc: "Entregue cursos e conteúdos premium" },
              { icon: BarChart2, title: "Analytics Completo", desc: "Métricas em tempo real das suas vendas" },
              { icon: Shield, title: "Anti-fraude Integrado", desc: "Proteja seu negócio automaticamente" },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{f.title}</p>
                  <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
