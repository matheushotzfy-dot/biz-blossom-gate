import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, Eye, EyeOff, Zap, Shield, GraduationCap, BarChart2, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Conta criada com sucesso!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Left — Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-primary/[0.04] rounded-full blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-info/[0.03] rounded-full blur-[120px]" />
        </div>

        <div className="w-full max-w-md animate-slide-up relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-extrabold tracking-tight text-foreground">HOTZFY</h1>
              <p className="text-xs text-muted-foreground">Plataforma de Infoprodutos</p>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-8 shadow-xl">
            <h2 className="text-xl font-display font-bold mb-1 text-foreground">
              {isLogin ? "Entrar na sua conta" : "Criar nova conta"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {isLogin ? "Acesse seu painel de infoprodutor" : "Comece a vender seus infoprodutos"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-foreground">Nome completo</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" className="mt-1.5 bg-muted/30 border-border/40 text-foreground placeholder:text-muted-foreground" required={!isLogin} />
                </div>
              )}
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-foreground">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="mt-1.5 bg-muted/30 border-border/40 text-foreground placeholder:text-muted-foreground" required />
              </div>
              <div>
                <Label htmlFor="password" className="text-sm font-medium text-foreground">Senha</Label>
                <div className="relative mt-1.5">
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-muted/30 border-border/40 text-foreground placeholder:text-muted-foreground" required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full gradient-primary text-primary-foreground font-semibold h-11 rounded-lg shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/25 transition-all" disabled={loading}>
                {loading ? "Processando..." : isLogin ? "Entrar" : "Criar conta grátis"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-primary hover:underline font-medium">
                {isLogin ? "Não tem conta? Cadastre-se grátis" : "Já tem conta? Entrar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Features */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(220 18% 7%), hsl(220 20% 5%))" }}>
        <div className="absolute inset-0">
          <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] bg-primary/[0.06] rounded-full blur-[120px]" />
        </div>
        <div className="max-w-sm relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/15 text-primary text-xs font-semibold mb-6">
            <Zap className="h-3 w-3" /> Plataforma #1 de Infoprodutos
          </div>
          <h2 className="text-3xl font-display font-extrabold mb-3 text-white leading-tight">Tudo que você precisa para vender online</h2>
          <p className="text-sm text-white/50 mb-8">Checkout otimizado, área de membros, processamento de pagamentos e muito mais.</p>
          
          <div className="space-y-3">
            {[
              { icon: CreditCard, title: "Checkout de Alta Conversão", desc: "PIX, Cartão e Boleto com 1-click" },
              { icon: GraduationCap, title: "Área de Membros", desc: "Entregue cursos e conteúdos premium" },
              { icon: BarChart2, title: "Analytics Completo", desc: "Métricas em tempo real das suas vendas" },
              { icon: Shield, title: "Anti-fraude Integrado", desc: "Proteja seu negócio automaticamente" },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-[11px] text-white/40">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
