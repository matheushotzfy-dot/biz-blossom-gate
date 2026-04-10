import { useState } from "react";
import { PageShell, PageTitle, Panel } from "@/components/PageShell";
import { FlaskConical, Plus, BarChart3, ArrowUpRight, Pause, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ABTest = {
 id: string;
 name: string;
 variantA: string;
 variantB: string;
 status: "running" | "paused" | "completed";
 impressionsA: number;
 impressionsB: number;
 conversionsA: number;
 conversionsB: number;
 createdAt: string;
};

const DEMO_TESTS: ABTest[] = [
 {
 id: "1",
 name: "Cor do botão de compra",
 variantA: "Verde (padrão)",
 variantB: "Azul Royal",
 status: "running",
 impressionsA: 1250,
 impressionsB: 1180,
 conversionsA: 87,
 conversionsB: 102,
 createdAt: new Date().toISOString(),
 },
 {
 id: "2",
 name: "Timer de urgência",
 variantA: "Com timer (10min)",
 variantB: "Sem timer",
 status: "completed",
 impressionsA: 3200,
 impressionsB: 3150,
 conversionsA: 256,
 conversionsB: 189,
 createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
 },
];

function convRate(conversions: number, impressions: number) {
 return impressions > 0 ? ((conversions / impressions) * 100).toFixed(2) : "0.00";
}

export default function ABTesting() {
 const [tests] = useState<ABTest[]>(DEMO_TESTS);

 return (
 <PageShell>
 <div className="flex items-center justify-between">
 <PageTitle icon={<FlaskConical className="h-6 w-6" />} title="A/B Testing" subtitle="Teste variações do checkout para otimizar conversões" />
 <button className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90">
 <Plus className="h-4 w-4" />
 Novo Teste
 </button>
 </div>

 {tests.length === 0 ? (
 <Panel className="py-16 text-center">
 <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
 <p className="text-muted-foreground text-sm">Nenhum teste ativo</p>
 </Panel>
 ) : (
 <div className="space-y-4">
 {tests.map((test) => {
 const rateA = Number(convRate(test.conversionsA, test.impressionsA));
 const rateB = Number(convRate(test.conversionsB, test.impressionsB));
 const winner = rateB > rateA ? "B" : rateA > rateB ? "A" : null;
 const uplift = rateA > 0 ? (((Math.max(rateA, rateB) - Math.min(rateA, rateB)) / Math.min(rateA, rateB)) * 100).toFixed(1) : "0.0";

 return (
 <Panel key={test.id}>
 <div className="flex items-start justify-between gap-4 mb-4">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <h3 className="text-base font-bold text-foreground">{test.name}</h3>
 <span className={cn(
 "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
 test.status === "running" ? "bg-success/10 text-success" :
 test.status === "paused" ? "bg-warning/10 text-warning" :
 "bg-muted/30 text-muted-foreground"
 )}>
 {test.status === "running" ? "Ativo" : test.status === "paused" ? "Pausado" : "Concluído"}
 </span>
 </div>
 <p className="text-xs text-muted-foreground">
 Criado em {new Date(test.createdAt).toLocaleDateString("pt-BR")}
 </p>
 </div>
 <div className="flex gap-2">
 {test.status === "running" ? (
 <button className="rounded-xl bg-muted/30 p-2 hover:bg-muted/50 transition"><Pause className="h-4 w-4 text-muted-foreground" /></button>
 ) : test.status === "paused" ? (
 <button className="rounded-xl bg-muted/30 p-2 hover:bg-muted/50 transition"><Play className="h-4 w-4 text-muted-foreground" /></button>
 ) : null}
 <button className="rounded-xl bg-muted/30 p-2 hover:bg-destructive/10 transition"><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 {/* Variant A */}
 <div className={cn("rounded-xl border p-4", winner === "A" ? "border-success/30 bg-success/5" : "border-border/30")}>
 <p className="text-xs font-bold text-muted-foreground mb-1">Variante A</p>
 <p className="text-sm font-bold text-foreground mb-3">{test.variantA}</p>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <p className="text-xs text-muted-foreground">Impressões</p>
 <p className="text-lg font-black text-foreground">{test.impressionsA.toLocaleString()}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Conversão</p>
 <p className="text-lg font-black text-foreground">{rateA}%</p>
 </div>
 </div>
 {winner === "A" && <span className="mt-2 inline-block text-xs font-bold text-success">🏆 Vencedor</span>}
 </div>

 {/* Variant B */}
 <div className={cn("rounded-xl border p-4", winner === "B" ? "border-success/30 bg-success/5" : "border-border/30")}>
 <p className="text-xs font-bold text-muted-foreground mb-1">Variante B</p>
 <p className="text-sm font-bold text-foreground mb-3">{test.variantB}</p>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <p className="text-xs text-muted-foreground">Impressões</p>
 <p className="text-lg font-black text-foreground">{test.impressionsB.toLocaleString()}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Conversão</p>
 <p className="text-lg font-black text-foreground">{rateB}%</p>
 </div>
 </div>
 {winner === "B" && <span className="mt-2 inline-block text-xs font-bold text-success">🏆 Vencedor</span>}
 </div>
 </div>

 {winner && (
 <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/15 px-4 py-2">
 <ArrowUpRight className="h-4 w-4 text-primary" />
 <span className="text-sm font-bold text-primary">
 Variante {winner} com +{uplift}% de uplift
 </span>
 </div>
 )}
 </Panel>
 );
 })}
 </div>
 )}
 </PageShell>
 );
}
