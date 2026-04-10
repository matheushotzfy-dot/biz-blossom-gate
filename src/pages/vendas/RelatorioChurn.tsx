import { useState } from "react";
import { UserMinus, TrendingDown, AlertTriangle, Users, ArrowDown, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts";

const MONTHLY_DATA = [
 { month: "Jul", churn: 2.1, retained: 97.9, lost: 12 },
 { month: "Ago", churn: 3.4, retained: 96.6, lost: 19 },
 { month: "Set", churn: 1.8, retained: 98.2, lost: 10 },
 { month: "Out", churn: 2.9, retained: 97.1, lost: 16 },
 { month: "Nov", churn: 1.5, retained: 98.5, lost: 8 },
 { month: "Dez", churn: 4.2, retained: 95.8, lost: 24 },
];

const REASONS = [
 { reason: "Não usou o produto", pct: 32, count: 29 },
 { reason: "Preço alto", pct: 24, count: 22 },
 { reason: "Encontrou alternativa", pct: 18, count: 16 },
 { reason: "Suporte insatisfatório", pct: 14, count: 13 },
 { reason: "Bug / Problema técnico", pct: 8, count: 7 },
 { reason: "Outros", pct: 4, count: 4 },
];

const AT_RISK = [
 { email: "jo***@gmail.com", product: "Curso Pro", days_inactive: 28, ltv: 394 },
 { email: "ma***@hotmail.com", product: "Mentoria VIP", days_inactive: 21, ltv: 1194 },
 { email: "ca***@outlook.com", product: "Pack Templates", days_inactive: 18, ltv: 147 },
 { email: "pe***@gmail.com", product: "Curso Avançado", days_inactive: 15, ltv: 297 },
];

export default function RelatorioChurn() {
 return (
 <div className="mx-auto w-full max-w-[1180px] space-y-6 p-4 md:p-6">
 <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
 {[
 { label: "Churn Mensal", value: "2.5%", icon: TrendingDown, color: "text-destructive" },
 { label: "Clientes Perdidos", value: "89", icon: UserMinus, color: "text-amber-500" },
 { label: "Em Risco", value: AT_RISK.length, icon: AlertTriangle, color: "text-orange-500" },
 { label: "Retenção Média", value: "97.5%", icon: Users, color: "text-emerald-500" },
 ].map(kpi => (
 <Card key={kpi.label} className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardContent className="flex items-center gap-3 p-4">
 <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/50 ${kpi.color}`}>
 <kpi.icon className="h-5 w-5" />
 </div>
 <div>
 <p className="text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
 <p className="text-lg font-black">{String(kpi.value)}</p>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>

 <div className="grid gap-6 md:grid-cols-2">
 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-bold">Evolução do Churn (%)</CardTitle>
 </CardHeader>
 <CardContent>
 <ResponsiveContainer width="100%" height={220}>
 <AreaChart data={MONTHLY_DATA}>
 <defs>
 <linearGradient id="churnGrad" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
 <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
 <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
 <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
 <Tooltip />
 <Area type="monotone" dataKey="churn" stroke="hsl(var(--destructive))" fill="url(#churnGrad)" strokeWidth={2} />
 </AreaChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>

 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-bold">Motivos de Cancelamento</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {REASONS.map(r => (
 <div key={r.reason} className="flex items-center gap-3">
 <div className="w-32 truncate text-[12px] font-medium">{r.reason}</div>
 <div className="flex-1">
 <div className="h-3 rounded-full bg-muted/50">
 <div className="h-full rounded-full bg-primary/60" style={{ width: `${r.pct}%` }} />
 </div>
 </div>
 <span className="w-12 text-right text-[12px] font-bold">{r.pct}%</span>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>

 <Card className="border-border/40 bg-card/60 backdrop-blur-xl">
 <CardHeader className="pb-2">
 <CardTitle className="flex items-center gap-2 text-sm font-bold">
 <AlertTriangle className="h-4 w-4 text-amber-500" /> Clientes em Risco
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {AT_RISK.map(c => (
 <div key={c.email} className="flex items-center justify-between rounded-xl bg-muted/20 px-4 py-3">
 <div>
 <p className="text-sm font-semibold">{c.email}</p>
 <p className="text-[11px] text-muted-foreground">{c.product} • LTV: R$ {c.ltv}</p>
 </div>
 <Badge variant="destructive" className="text-[10px]">
 <Calendar className="mr-1 h-3 w-3" />
 {c.days_inactive} dias inativo
 </Badge>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>
 );
}
