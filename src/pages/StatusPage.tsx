import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertTriangle, Clock, Activity, Server, CreditCard, Shield, Zap, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type ServiceStatus = "operational" | "degraded" | "down" | "checking";

interface ServiceInfo {
 name: string;
 icon: typeof Server;
 status: ServiceStatus;
 latency?: number;
 description: string;
}

const STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
 operational: { label: "Operacional", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20", dotColor: "bg-emerald-500" },
 degraded: { label: "Degradado", color: "text-yellow-400", bgColor: "bg-yellow-500/10 border-yellow-500/20", dotColor: "bg-yellow-500" },
 down: { label: "Indisponível", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20", dotColor: "bg-red-500" },
 checking: { label: "Verificando...", color: "text-white/40", bgColor: "bg-white/5 border-white/10", dotColor: "bg-white/30" },
};

export default function StatusPage() {
 const [services, setServices] = useState<ServiceInfo[]>([
 { name: "Plataforma HOTZFY", icon: Server, status: "checking", description: "Dashboard, gerenciamento de produtos e área do vendedor" },
 { name: "Gateway de Pagamento", icon: CreditCard, status: "checking", description: "Processamento de pagamentos PIX, cartão e boleto" },
 { name: "Autenticação", icon: Shield, status: "checking", description: "Login, registro e gerenciamento de sessões" },
 { name: "Área de Membros", icon: Zap, status: "checking", description: "Acesso a cursos, vídeos e conteúdo digital" },
 { name: "API & Webhooks", icon: Activity, status: "checking", description: "Endpoints de integração e callbacks de postback" },
 ]);
 const [lastChecked, setLastChecked] = useState<Date | null>(null);
 const [overallStatus, setOverallStatus] = useState<ServiceStatus>("checking");

 const checkServices = async () => {
 const newServices: ServiceInfo[] = [...services];

 // Check platform (Supabase connection)
 try {
 const start = Date.now();
 const { error } = await supabase.from("fees").select("id").limit(1);
 const latency = Date.now() - start;
 newServices[0] = { ...newServices[0], status: error ? "degraded" : "operational", latency };
 } catch {
 newServices[0] = { ...newServices[0], status: "down" };
 }

 // Check payment gateway (check if products_public view works - used by checkout)
 try {
 const start = Date.now();
 const { error } = await supabase.from("products_public").select("id").limit(1);
 const latency = Date.now() - start;
 newServices[1] = { ...newServices[1], status: error ? "degraded" : "operational", latency };
 } catch {
 newServices[1] = { ...newServices[1], status: "down" };
 }

 // Check auth
 try {
 const start = Date.now();
 const { error } = await supabase.auth.getSession();
 const latency = Date.now() - start;
 newServices[2] = { ...newServices[2], status: error ? "degraded" : "operational", latency };
 } catch {
 newServices[2] = { ...newServices[2], status: "down" };
 }

 // Check member area (courses table)
 try {
 const start = Date.now();
 const { error } = await supabase.from("courses").select("id").limit(1);
 const latency = Date.now() - start;
 newServices[3] = { ...newServices[3], status: error ? "degraded" : "operational", latency };
 } catch {
 newServices[3] = { ...newServices[3], status: "down" };
 }

 // Check webhooks (webhook_configs table)
 try {
 const start = Date.now();
 const { error } = await supabase.from("acquirers").select("id").limit(1);
 const latency = Date.now() - start;
 newServices[4] = { ...newServices[4], status: error ? "degraded" : "operational", latency };
 } catch {
 newServices[4] = { ...newServices[4], status: "down" };
 }

 setServices(newServices);
 setLastChecked(new Date());

 // Determine overall status
 const statuses = newServices.map(s => s.status);
 if (statuses.some(s => s === "down")) {
 setOverallStatus("down");
 } else if (statuses.some(s => s === "degraded")) {
 setOverallStatus("degraded");
 } else {
 setOverallStatus("operational");
 }
 };

 useEffect(() => {
 checkServices();
 const interval = setInterval(checkServices, 60000); // Re-check every 60s
 return () => clearInterval(interval);
 }, []);

 const overall = STATUS_CONFIG[overallStatus];

 return (
 <div className="min-h-screen bg-[#050505] text-white">
 {/* Header */}
 <header className="border-b border-white/[0.06]">
 <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
 <Activity className="h-5 w-5 text-white" />
 </div>
 <div>
 <h1 className="text-lg font-bold tracking-tight">HOTZFY Status</h1>
 <p className="text-[11px] text-white/30 font-medium">Status dos serviços em tempo real</p>
 </div>
 </div>
 <Link to="/auth" className="flex items-center gap-1.5 text-[12px] text-white/30 hover:text-white/50 transition-colors">
 <ArrowLeft className="h-3.5 w-3.5" />
 Voltar
 </Link>
 </div>
 </header>

 <main className="max-w-3xl mx-auto px-6 py-10">
 {/* Overall Status */}
 <div className={`rounded-2xl border p-6 mb-8 ${overall.bgColor}`}>
 <div className="flex items-center gap-3">
 {overallStatus === "operational" ? (
 <CheckCircle2 className={`h-7 w-7 ${overall.color}`} />
 ) : overallStatus === "degraded" ? (
 <AlertTriangle className={`h-7 w-7 ${overall.color}`} />
 ) : (
 <Clock className={`h-7 w-7 ${overall.color}`} />
 )}
 <div>
 <h2 className={`text-xl font-bold ${overall.color}`}>
 {overallStatus === "operational"
 ? "Todos os sistemas operacionais"
 : overallStatus === "degraded"
 ? "Performance degradada"
 : overallStatus === "down"
 ? "Interrupção parcial"
 : "Verificando serviços..."}
 </h2>
 {lastChecked && (
 <p className="text-[12px] text-white/25 mt-1">
 Última verificação: {lastChecked.toLocaleTimeString("pt-BR")}
 </p>
 )}
 </div>
 </div>
 </div>

 {/* Services List */}
 <div className="space-y-3">
 {services.map((service) => {
 const cfg = STATUS_CONFIG[service.status];
 return (
 <div
 key={service.name}
 className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex items-center gap-4"
 >
 <div className="h-10 w-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
 <service.icon className="h-5 w-5 text-white/40" />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="text-[14px] font-semibold text-white/90">{service.name}</h3>
 <p className="text-[12px] text-white/25 mt-0.5">{service.description}</p>
 </div>
 <div className="flex items-center gap-3 shrink-0">
 {service.latency !== undefined && (
 <span className="text-[11px] text-white/20 font-mono">
 {service.latency}ms
 </span>
 )}
 <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${cfg.bgColor}`}>
 <div className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor} ${service.status === "operational" ? "animate-pulse" : ""}`} />
 <span className={`text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
 </div>
 </div>
 </div>
 );
 })}
 </div>

 {/* Uptime info */}
 <div className="mt-10 text-center">
 <p className="text-[12px] text-white/15 font-medium">
 Status atualizado automaticamente a cada 60 segundos
 </p>
 <p className="text-[11px] text-white/10 mt-1">
 © {new Date().getFullYear()} HOTZFY — Todos os direitos reservados
 </p>
 </div>
 </main>
 </div>
 );
}
