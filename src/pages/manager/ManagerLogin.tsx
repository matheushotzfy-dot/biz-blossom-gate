import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, Eye, EyeOff, Lock, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function ManagerLogin() {
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");
 const navigate = useNavigate();

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 const trimmedEmail = email.trim().toLowerCase();
 if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
 setError("E-mail inválido.");
 return;
 }
 if (password.length < 6) {
 setError("Senha deve ter no mínimo 6 caracteres.");
 return;
 }

 setLoading(true);
 setError("");

 try {
 const { data, error: fnError } = await supabase.functions.invoke("manager-login", {
 body: { email: trimmedEmail, password },
 });

 if (fnError) throw new Error("Erro de conexão.");

 if (!data?.success) {
 setError(data?.error || "Credenciais inválidas ou acesso não autorizado.");
 if (data?.locked) setError("Muitas tentativas. Aguarde 15 minutos.");
 return;
 }

 const { error: sessionError } = await supabase.auth.setSession({
 access_token: data.access_token,
 refresh_token: data.refresh_token,
 });

 if (sessionError) throw sessionError;

 toast.success("Acesso à equipe confirmado.");
 navigate("/gerentes/dashboard");
 } catch {
 setError("Credenciais inválidas ou acesso não autorizado.");
 } finally {
 setLoading(false);
 setPassword("");
 }
 };

 return (
 <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">

 <motion.div
 initial={{ opacity: 0, y: 30 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
 className="relative w-full max-w-[440px] p-6"
 >
 {/* Logo & title */}
 <div className="flex flex-col items-center mb-10">
 <motion.div
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ delay: 0.15, duration: 0.5 }}
 className="relative mb-6"
 >
 <div className="h-[72px] w-[72px] rounded-[20px] bg-primary flex items-center justify-center">
 <Flame className="h-9 w-9 text-primary-foreground" />
 </div>
 <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-accent flex items-center justify-center border-[3px] border-background">
 <Users className="h-3 w-3 text-accent-foreground" />
 </div>
 </motion.div>

 <h1 className="text-[28px] font-bold text-foreground tracking-tight">Painel da Equipe</h1>
 <p className="text-[13px] text-muted-foreground mt-1.5 font-medium tracking-wide">Gestão de Contas · VENXPAY</p>
 </div>

 {/* Card */}
 <div className="bg-card rounded-[28px] border border-border p-8">
 {error && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: "auto" }}
 className="flex items-center gap-2.5 bg-destructive/5 border border-destructive/20 rounded-2xl p-4 mb-6 text-[13px] text-destructive font-medium"
 >
 <AlertTriangle className="h-4 w-4 shrink-0" />
 {error}
 </motion.div>
 )}

 <form onSubmit={handleSubmit} className="space-y-5">
 <div>
 <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">E-mail</Label>
 <Input
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 type="email"
 required
 className="mt-2.5 bg-background border-border h-[52px] text-foreground placeholder:text-muted-foreground rounded-2xl text-[14px] focus:border-primary/40 focus:ring-primary/10 transition-all"
 placeholder="equipe@empresa.com"
 />
 </div>
 <div>
 <Label className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold">Senha</Label>
 <div className="relative mt-2.5">
 <Input
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 type={showPassword ? "text" : "password"}
 required
 minLength={6}
 className="bg-background border-border h-[52px] text-foreground placeholder:text-muted-foreground pr-12 rounded-2xl text-[14px] focus:border-primary/40 focus:ring-primary/10 transition-all"
 placeholder="••••••••"
 />
 <Button type="button" variant="ghost" size="icon" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </Button>
 </div>
 </div>

 <Button
 type="submit"
 className="w-full h-[52px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl transition-colors duration-300 text-[14px]"
 disabled={loading}
 >
 <Lock className="h-4 w-4 mr-2" />
 {loading ? "Autenticando..." : "Acessar Painel"}
 </Button>
 </form>
 </div>

 {/* Footer */}
 <div className="flex items-center justify-center gap-4 mt-8">
 <div className="flex items-center gap-1.5">
 <div className="h-1.5 w-1.5 rounded-full bg-success" />
 <span className="text-[10px] text-muted-foreground font-medium">SSL Ativo</span>
 </div>
 <span className="text-border">•</span>
 <span className="text-[10px] text-muted-foreground font-medium">Proteção ativa</span>
 <span className="text-border">•</span>
 <span className="text-[10px] text-muted-foreground font-medium">Acessos monitorados</span>
 </div>
 </motion.div>
 </div>
 );
}
