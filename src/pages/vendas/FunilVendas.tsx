import { useState, useEffect } from "react";
import { Filter, ArrowDown, Eye, CreditCard, CheckCircle2, AlertCircle, Loader2, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState, PageSkeleton } from "@/components/PageShell";
import { isApprovedTransaction } from "@/lib/utils";

interface FunnelStage {
 stage: string;
 icon: React.ElementType;
 value: number;
 color: string;
 pct: number;
}

export default function FunilVendas() {
 const { user } = useAuth();
 const [period, setPeriod] = useState("today");
 const [loading, setLoading] = useState(true);
 const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, failed: 0, refunded: 0 });

 useEffect(() => {
 if (user?.id) loadFunnel();
 }, [user?.id, period]);

 const loadFunnel = async () => {
 setLoading(true);
 const days = period === "today" ? 0 : period === "7d" ? 7 : period === "90d" ? 90 : 30;
 const since = new Date();
 if (days === 0) {
 since.setHours(0, 0, 0, 0);
 } else {
 since.setDate(since.getDate() - days);
 }

 const { data } = await supabase
 .from("transactions")
 .select("status")
 .eq("user_id", user!.id)
 .gte("created_at", since.toISOString());

 if (data) {
 const total = data.length;
 const pending = data.filter(t => t.status === "pending").length;
  const approved = data.filter(t => isApprovedTransaction(t.status)).length;
 const failed = data.filter(t => t.status === "failed" || t.status === "refused").length;
 const refunded = data.filter(t => t.status === "refunded" || t.status === "chargeback").length;
 setStats({ total, pending, approved, failed, refunded });
 }
 setLoading(false);
 };

 const funnelData: FunnelStage[] = [
 {
 stage: "Transações Iniciadas",
 icon: Eye,
 value: stats.total,
 color: "bg-blue-500",
 pct: 100,
 },
 {
 stage: "Pendentes (Aguardando Pgto)",
 icon: CreditCard,
 value: stats.pending,
 color: "bg-amber-500",
 pct: stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0,
 },
 {
 stage: "Aprovadas",
 icon: CheckCircle2,
 value: stats.approved,
 color: "bg-emerald-500",
 pct: stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0,
 },
 {
 stage: "Falharam / Recusadas",
 icon: AlertCircle,
 value: stats.failed,
 color: "bg-destructive",
 pct: stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0,
 },
 ];

 const conversionRate = stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : "0";

 if (loading) {
 return (
 <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
 <PageSkeleton kpis={4} rows={5} />
 </div>
 );
 }

 return (
 <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl font-black">Funil de Vendas</h1>
 <p className="text-sm text-muted-foreground">Dados reais das suas transações</p>
 </div>
 <Select value={period} onValueChange={setPeriod}>
 <SelectTrigger className="w-[140px] rounded-xl"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="today">Hoje</SelectItem>
 <SelectItem value="7d">Últimos 7 dias</SelectItem>
 <SelectItem value="30d">Últimos 30 dias</SelectItem>
 <SelectItem value="90d">Últimos 90 dias</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* KPI cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card className="border-border/40 bg-card/60">
 <CardContent className="p-4">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</p>
 <p className="text-2xl font-black mt-1">{stats.total}</p>
 </CardContent>
 </Card>
 <Card className="border-border/40 bg-card/60">
 <CardContent className="p-4">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Aprovadas</p>
 <p className="text-2xl font-black text-emerald-500 mt-1">{stats.approved}</p>
 </CardContent>
 </Card>
 <Card className="border-border/40 bg-card/60">
 <CardContent className="p-4">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Conversão</p>
 <p className="text-2xl font-black text-primary mt-1">{conversionRate}%</p>
 </CardContent>
 </Card>
 <Card className="border-border/40 bg-card/60">
 <CardContent className="p-4">
 <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Reembolsos</p>
 <p className="text-2xl font-black text-destructive mt-1">{stats.refunded}</p>
 </CardContent>
 </Card>
 </div>

  {stats.total === 0 ? (
  <Card className="border-border/40 bg-card/60">
  <CardContent className="p-0">
  <EmptyState
  icon={<BarChart3 className="h-7 w-7" />}
  title="Nenhuma transação encontrada"
  subtitle="Crie um produto e faça vendas para ver seu funil aqui."
  />
  </CardContent>
  </Card>
  ) : (
 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardHeader className="pb-2">
 <CardTitle className="flex items-center gap-2 text-sm font-bold">
 <Filter className="h-4 w-4 text-primary" /> Funil de Conversão
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-1 py-4">
 {funnelData.map((stage, i) => (
 <div key={stage.stage}>
 <div className="flex items-center gap-4 px-2 py-2">
 <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stage.color}/15`}>
 <stage.icon className={`h-4 w-4 ${stage.color.replace("bg-", "text-")}`} />
 </div>
 <div className="flex-1">
 <div className="mb-1 flex items-center justify-between">
 <span className="text-[13px] font-semibold">{stage.stage}</span>
 <div className="flex items-center gap-3">
 <span className="text-[13px] font-black">{stage.value.toLocaleString("pt-BR")}</span>
 <span className="text-[11px] text-muted-foreground">{stage.pct}%</span>
 </div>
 </div>
 <div className="h-3 rounded-full bg-muted/30">
 <div className={`h-full rounded-full ${stage.color} transition-all duration-700`} style={{ width: `${stage.pct}%` }} />
 </div>
 </div>
 </div>
 {i < funnelData.length - 1 && (
 <div className="flex justify-center py-0.5">
 <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
 </div>
 )}
 </div>
 ))}
 </CardContent>
 </Card>
 )}
 </div>
 );
}
