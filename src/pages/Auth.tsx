import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Eye, EyeOff, Zap, Shield, TrendingUp } from "lucide-react";
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
    <div className="min-h-screen flex dark">
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-info/5 rounded-full blur-[120px]" />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(220,20%,12%) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
        </div>

        <div className="w-full max-w-md animate-slide-up relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/30">
              <CreditCard className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">PayGate</h1>
              <p className="text-sm text-muted-foreground">Gateway de Pagamentos</p>
            </div>
          </div>

          <div className="bg-card/60 backdrop-blur-2xl rounded-2xl border border-border/30 p-8 shadow-2xl shadow-black/10">
            <h2 className="text-xl font-bold mb-1 text-foreground">
              {isLogin ? "Entrar na sua conta" : "Criar nova conta"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {isLogin ? "Acesse seu painel de controle" : "Preencha os dados para começar"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-foreground">Nome completo</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    className="mt-1.5 bg-muted/30 border-border/30 text-foreground placeholder:text-muted-foreground"
                    required={!isLogin}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-foreground">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="mt-1.5 bg-muted/30 border-border/30 text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-sm font-medium text-foreground">Senha</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-muted/30 border-border/30 text-foreground placeholder:text-muted-foreground"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground font-semibold h-12 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all" disabled={loading}>
                {loading ? "Processando..." : isLogin ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline font-medium"
              >
                {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/20 via-background to-emerald-500/10 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px]" />
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(152,60%,45%,0.1) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        </div>
        <div className="max-w-md relative z-10">
          <h2 className="text-3xl font-bold mb-6 text-foreground">Gerencie seus pagamentos com facilidade</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-card/40 backdrop-blur-xl rounded-xl p-4 border border-border/20">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Zap className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm font-semibold text-foreground">Checkout rápido</p><p className="text-xs text-muted-foreground">PIX, Cartão e Boleto</p></div>
            </div>
            <div className="flex items-center gap-3 bg-card/40 backdrop-blur-xl rounded-xl p-4 border border-border/20">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Shield className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm font-semibold text-foreground">Segurança total</p><p className="text-xs text-muted-foreground">Dados criptografados</p></div>
            </div>
            <div className="flex items-center gap-3 bg-card/40 backdrop-blur-xl rounded-xl p-4 border border-border/20">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm font-semibold text-foreground">Dashboard completo</p><p className="text-xs text-muted-foreground">Métricas em tempo real</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
