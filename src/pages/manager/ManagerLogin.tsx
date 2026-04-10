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

 toast.success("Bem-vindo ao painel de gerente!");
 navigate("/gerentes/dashboard");
 } catch {
 setError("Credenciais inválidas ou acesso não autorizado.");
 } finally {
 setLoading(false);
 setPassword("");
 }
 };

 return (
 <div className="min-h-screen flex items-center justify-center bg-[#040404] relative overflow-hidden">
 {/* Background effects */}
 <div className="absolute inset-0">
 <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(135deg,#040404_0%,#041410_50%,#040404_100%)]" />

 <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.015) 0.5px, transparent 0)", backgroundSize: "40px 40px" }} />
 </div>

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
 <div className="h-[72px] w-[72px] rounded-[20px] bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 flex items-center justify-center shadow-[0_20px_80px_rgba(16,185,129,0.25)]">
 <Flame className="h-9 w-9 text-white" />
 </div>
 <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-[3px] border-[#040404] shadow-lg">
 <Users className="h-3 w-3 text-white" />
 </div>
 </motion.div>

 <h1 className="text-[28px] font-bold text-white tracking-tight">Painel Gerente</h1>
 <p className="text-[13px] text-white/25 mt-1.5 font-medium tracking-wide">Gestão de Contas · HOTZFY</p>
 </div>

 {/* Card */}
 <div className="bg-[#0A0A0F]/90 rounded-[28px] border border-white/[0.05] p-8 shadow-[0_40px_120px_rgba(0,0,0,0.6)] backdrop-blur-xl">
 {error && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: "auto" }}
 className="flex items-center gap-2.5 bg-red-500/[0.06] border border-red-500/15 rounded-2xl p-4 mb-6 text-[13px] text-red-400 font-medium"
 >
 <AlertTriangle className="h-4 w-4 shrink-0" />
 {error}
 </motion.div>
 )}

 <form onSubmit={handleSubmit} className="space-y-5">
 <div>
 <Label className="text-[10px] text-white/30 uppercase tracking-[0.15em] font-semibold">E-mail</Label>
 <Input
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 type="email"
 required
 className="mt-2.5 bg-white/[0.03] border-white/[0.06] h-[52px] text-white placeholder:text-white/12 rounded-2xl text-[14px] focus:border-emerald-500/40 focus:ring-emerald-500/10 transition-all"
 placeholder="gerente@empresa.com"
 />
 </div>
 <div>
 <Label className="text-[10px] text-white/30 uppercase tracking-[0.15em] font-semibold">Senha</Label>
 <div className="relative mt-2.5">
 <Input
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 type={showPassword ? "text" : "password"}
 required
 minLength={6}
 className="bg-white/[0.03] border-white/[0.06] h-[52px] text-white placeholder:text-white/12 pr-12 rounded-2xl text-[14px] focus:border-emerald-500/40 focus:ring-emerald-500/10 transition-all"
 placeholder="••••••••"
 />
 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/15 hover:text-white/40 transition-colors">
 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
 </button>
 </div>
 </div>

 <Button
 type="submit"
 className="w-full h-[52px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-2xl shadow-[0_12px_40px_rgba(16,185,129,0.3)] hover:shadow-[0_16px_60px_rgba(16,185,129,0.4)] transition-all duration-300 text-[14px]"
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
 <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
 <span className="text-[10px] text-white/15 font-medium">SSL Ativo</span>
 </div>
 <span className="text-white/[0.06]">•</span>
 <span className="text-[10px] text-white/15 font-medium">Rate Limit Backend</span>
 <span className="text-white/[0.06]">•</span>
 <span className="text-[10px] text-white/15 font-medium">Acessos monitorados</span>
 </div>
 </motion.div>
 </div>
 );
}
