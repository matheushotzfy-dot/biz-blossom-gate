/**
 * Webhooks — Ultra-Premium Management
 * @module Webhooks
 * @version 3.0.0 — Fintech Premium Redesign
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebhooks, useInvalidateAll } from "@/hooks/useQueryData";
import { Webhook, Plus, Trash2, ToggleLeft, ToggleRight, Zap, Globe, Shield, Copy, CheckCircle2, Code2, Terminal, Lock, Radio, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

const EVENT_CATEGORIES = [
 {
 label: "Pagamento",
 description: "Eventos de transações financeiras",
 color: "text-success",
 bg: "bg-success/10",
 border: "border-success/20",
 dot: "bg-success",
 events: [
 { key: "payment.approved", label: "Pagamento Aprovado" },
 { key: "payment.failed", label: "Pagamento Falhou" },
 { key: "payment.refunded", label: "Reembolso Realizado" },
 ],
 },
 {
 label: "Disputa",
 description: "Chargebacks e contestações",
 color: "text-destructive",
 bg: "bg-destructive/10",
 border: "border-destructive/20",
 dot: "bg-destructive",
 events: [
 { key: "chargeback.received", label: "Chargeback Recebido" },
 ],
 },
 {
 label: "Assinatura",
 description: "Ciclo de vida das assinaturas",
 color: "text-info",
 bg: "bg-info/10",
 border: "border-info/20",
 dot: "bg-info",
 events: [
 { key: "subscription.canceled", label: "Assinatura Cancelada" },
 ],
 },
 {
 label: "Saque",
 description: "Retiradas e pagamentos",
 color: "text-warning",
 bg: "bg-warning/10",
 border: "border-warning/20",
 dot: "bg-warning",
 events: [
 { key: "payout.approved", label: "Saque Aprovado" },
 { key: "payout.rejected", label: "Saque Rejeitado" },
 ],
 },
];

const ALL_EVENTS = EVENT_CATEGORIES.flatMap((c) => c.events.map(e => e.key));

function getEventCategory(ev: string) {
 return EVENT_CATEGORIES.find((c) => c.events.some(e => e.key === ev));
}

function getEventLabel(ev: string) {
 for (const cat of EVENT_CATEGORIES) {
 const found = cat.events.find(e => e.key === ev);
 if (found) return found.label;
 }
 return ev;
}

const CODE_EXAMPLES = [
 {
 id: "node",
 label: "Node.js",
 icon: "JS",
 code: `const crypto = require('crypto');
const express = require('express');
const app = express();

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 const signature = req.headers['x-webhook-signature'];
 const secret = process.env.WEBHOOK_SECRET;

 const expected = crypto
 .createHmac('sha256', secret)
 .update(req.body)
 .digest('hex');

 // Comparação segura em tempo constante
 const isValid = crypto.timingSafeEqual(
 Buffer.from(signature, 'hex'),
 Buffer.from(expected, 'hex')
 );

 if (!isValid) {
 return res.status(401).json({ error: 'Assinatura inválida' });
 }

 const event = JSON.parse(req.body);

 switch (event.type) {
 case 'payment.approved':
 // Liberar acesso ao produto
 break;
 case 'payment.refunded':
 // Revogar acesso
 break;
 }

 res.status(200).json({ received: true });
});

app.listen(3000);`,
 },
 {
 id: "python",
 label: "Python",
 icon: "PY",
 code: `import os
import hmac
import hashlib
import json
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
 signature = request.headers.get('X-Webhook-Signature')
 secret = os.environ['WEBHOOK_SECRET']

 expected = hmac.new(
 secret.encode('utf-8'),
 request.data,
 hashlib.sha256
 ).hexdigest()

 # Comparação segura em tempo constante
 if not hmac.compare_digest(signature, expected):
 return jsonify({'error': 'Assinatura inválida'}), 401

 event = request.get_json()
 print(f"Evento recebido: {event['type']}")

 if event['type'] == 'payment.approved':
 # Liberar acesso ao produto
 pass
 elif event['type'] == 'payment.refunded':
 # Revogar acesso
 pass

 return jsonify({'received': True}), 200`,
 },
 {
 id: "php",
 label: "PHP",
 icon: "PHP",
 code: `<?php
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'];
$secret = getenv('WEBHOOK_SECRET');

$expected = hash_hmac('sha256', $payload, $secret);

// Comparação segura em tempo constante
if (!hash_equals($expected, $signature)) {
 http_response_code(401);
 echo json_encode(['error' => 'Assinatura inválida']);
 exit;
}

$event = json_decode($payload, true);

switch ($event['type']) {
 case 'payment.approved':
 // Liberar acesso ao produto
 break;
 case 'payment.refunded':
 // Revogar acesso
 break;
}

http_response_code(200);
echo json_encode(['received' => true]);
?>`,
 },
];

const PAYLOAD_EXAMPLE = `{
 "id": "evt_1a2b3c4d5e6f",
 "type": "payment.approved",
 "created_at": "2025-01-15T14:30:00Z",
 "data": {
 "transaction_id": "txn_abc123",
 "amount": 19700,
 "currency": "BRL",
 "payment_method": "pix",
 "customer": {
 "name": "João Silva",
 "email": "joao@email.com",
 "document": "***.***.***-00"
 },
 "product": {
 "id": "prod_xyz",
 "name": "Curso Completo"
 }
 }
}`;

/* ═══ GlowCard ═══ */
function GlowCard({ children, className, glowColor = "primary", delay = 0 }: {
 children: React.ReactNode; className?: string; glowColor?: string; delay?: number;
}) {
 return (
 <motion.div
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay, ease }}
 className={cn("relative group rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden", className)}
 >
 <div className={cn("absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000 blur-[60px] pointer-events-none", `bg-${glowColor}/12`)} />
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
 <div className={cn("absolute bottom-0 left-[10%] right-[10%] h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700", `bg-gradient-to-r from-transparent via-${glowColor}/20 to-transparent`)} />
 <div className="relative z-10">{children}</div>
 </motion.div>
 );
}

/* ═══ KPI Tile ═══ */
function KpiTile({ label, value, icon: Icon, color = "primary", delay = 0, sub }: {
 label: string; value: string; icon: any; color?: string; delay?: number; sub?: string;
}) {
 return (
 <GlowCard glowColor={color} delay={delay} className="p-5 shimmer">
 <div className={cn("absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-500", `bg-${color}`)} />
 <div className="flex items-start justify-between mb-3">
 <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110", `bg-${color}/10 border-${color}/12 text-${color}`)}>
 <Icon className="h-4.5 w-4.5" />
 </div>
 </div>
 <p className="text-[9px] font-heading uppercase tracking-[0.2em] text-muted-foreground/35 mb-1.5">{label}</p>
 <span className="text-2xl font-heading tabular-nums tracking-tight text-foreground leading-none">{value}</span>
 {sub && <p className="text-[10px] text-muted-foreground/40 mt-1.5 font-display">{sub}</p>}
 </GlowCard>
 );
}

export default function Webhooks() {
 const { user } = useAuth();
 const { data: webhooks = [], refetch: load } = useWebhooks();
 const invalidateAll = useInvalidateAll();
 const [open, setOpen] = useState(false);
 const [url, setUrl] = useState("");
 const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
 const [copiedId, setCopiedId] = useState<string | null>(null);
 const [activeCodeTab, setActiveCodeTab] = useState("node");
 const [copiedCode, setCopiedCode] = useState(false);
 const [showDocs, setShowDocs] = useState(true);

 const handleCreate = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!user) return;
 if (selectedEvents.length === 0) { toast.error("Selecione pelo menos um evento"); return; }
 
 if (!url.startsWith("https://")) {
 toast.error("URL deve usar HTTPS"); return;
 }
 if (/https:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(url)) {
 toast.error("URL não pode apontar para endereços internos"); return;
 }

 const secret = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
 const { error } = await supabase.from("webhook_configs").insert({ user_id: user.id, url, events: selectedEvents, secret });
 if (error) { toast.error("Erro ao criar webhook"); return; }
 toast.success("Webhook criado com sucesso!"); setOpen(false); setUrl(""); setSelectedEvents([]); invalidateAll(["webhooks"]);
 };

 const toggleActive = async (id: string, current: boolean) => {
 if (!user) return;
 const { error } = await supabase.from("webhook_configs").update({ is_active: !current }).eq("id", id).eq("user_id", user.id);
 if (error) { toast.error("Erro ao atualizar webhook"); return; }
 invalidateAll(["webhooks"]);
 };

 const deleteWebhook = async (id: string) => {
 if (!user) return;
 if (!window.confirm("Tem certeza que deseja excluir este webhook?")) return;
 const { error } = await supabase.from("webhook_configs").delete().eq("id", id).eq("user_id", user.id);
 if (error) { toast.error("Erro ao excluir webhook"); return; }
 toast.success("Webhook removido");
 invalidateAll(["webhooks"]);
 };

 const toggleAll = () => {
 setSelectedEvents(selectedEvents.length === ALL_EVENTS.length ? [] : [...ALL_EVENTS]);
 };

 const copySecret = (secret: string, id: string) => {
 navigator.clipboard.writeText(secret);
 setCopiedId(id);
 setTimeout(() => setCopiedId(null), 2000);
 toast.success("Secret copiado!");
 };

 const copyCode = (code: string) => {
 navigator.clipboard.writeText(code);
 setCopiedCode(true);
 setTimeout(() => setCopiedCode(false), 2000);
 toast.success("Código copiado!");
 };

 const activeCount = webhooks.filter(w => w.is_active).length;
 const totalEvents = webhooks.reduce((acc, w) => acc + (w.events?.length || 0), 0);

 return (
 <div className="mx-auto w-full max-w-[1440px] pb-20 px-1 relative">
 {/* ═══ HERO ═══ */}
 <motion.section
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ duration: 0.6 }}
 className="relative mb-8 rounded-3xl p-6 sm:p-8 border border-border/60 bg-card shadow-sm"
 >
 <div className="absolute -inset-16 pointer-events-none">
 <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-0 -left-16 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[180px]" />
 <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 -right-16 w-[500px] h-[500px] bg-success/6 rounded-full blur-[160px]" />
 <div className="absolute inset-16 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
 </div>

 <div className="relative z-10">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
 <Webhook className="h-4.5 w-4.5 text-primary" />
 </div>
 <div>
 <span className="text-[12px] font-heading uppercase tracking-[0.15em] text-foreground/80">Webhooks</span>
 <p className="text-[10px] text-muted-foreground/40">Notificações em tempo real nos seus endpoints</p>
 </div>
 </div>
 <div className="flex items-center gap-2.5">
 <div className="inline-flex items-center gap-2 rounded-full border border-success/15 bg-success/5 px-3 py-1.5 backdrop-blur-sm">
 <div className="relative">
 <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
 <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-success/40 animate-ping" />
 </div>
 <span className="text-[9px] font-heading uppercase tracking-[0.2em] text-success">{activeCount} Ativo{activeCount !== 1 ? "s" : ""}</span>
 </div>
 <Dialog open={open} onOpenChange={setOpen}>
 <DialogTrigger asChild>
 <button className="h-9 px-5 rounded-full text-[10px] font-heading flex items-center gap-1.5 gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 active:scale-[0.97] transition-all duration-300">
 <Plus className="h-3.5 w-3.5" /> Novo Webhook
 </button>
 </DialogTrigger>
 <DialogContent className="max-w-xl rounded-2xl border-border/60 bg-card/95 backdrop-blur-xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
 <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none rounded-2xl" />
 
 <div className="relative px-6 pt-6 pb-5 border-b border-border/20">
 <DialogHeader>
 <DialogTitle className="font-heading text-lg flex items-center gap-3">
 <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
 <Zap className="h-5 w-5 text-primary-foreground" />
 </div>
 <div>
 <span className="block">Criar Webhook</span>
 <span className="block text-xs font-normal text-muted-foreground mt-0.5">Configure um endpoint para receber eventos</span>
 </div>
 </DialogTitle>
 </DialogHeader>
 </div>

 <form onSubmit={handleCreate} className="relative p-6 space-y-6">
 <div className="space-y-2">
 <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
 <Globe className="h-3.5 w-3.5" /> Endereço do Endpoint
 </Label>
 <div className="relative">
 <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
 <Lock className="h-3.5 w-3.5 text-success" />
 <span className="text-[11px] font-mono text-success font-bold">HTTPS</span>
 <span className="text-border">://</span>
 </div>
 <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="seusite.com/api/webhook" type="url" required className="h-12 rounded-xl border-border/40 font-mono text-sm pl-[105px]" pattern="https://.*" title="URL deve começar com https://" />
 </div>
 <p className="text-[11px] text-muted-foreground/50">Apenas URLs com HTTPS são aceitas por segurança</p>
 </div>

 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
 <Radio className="h-3.5 w-3.5" /> Eventos para Escutar
 </Label>
 <button type="button" onClick={toggleAll} className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/5">
 {selectedEvents.length === ALL_EVENTS.length ? "Desmarcar todos" : "Selecionar todos"}
 </button>
 </div>

 <div className="space-y-4">
 {EVENT_CATEGORIES.map((cat) => (
 <div key={cat.label} className="space-y-2">
 <div className="flex items-center gap-2">
 <span className={cn("h-2 w-2 rounded-full", cat.dot)} />
 <span className={cn("text-[11px] font-bold uppercase tracking-[0.12em]", cat.color)}>{cat.label}</span>
 <span className="text-[10px] text-muted-foreground/40">— {cat.description}</span>
 </div>
 <div className="grid grid-cols-1 gap-1.5">
 {cat.events.map((ev) => {
 const checked = selectedEvents.includes(ev.key);
 return (
 <label key={ev.key} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border group", checked ? `${cat.bg} ${cat.border} shadow-sm` : "bg-muted/10 border-border/20 hover:border-border/40 hover:bg-muted/20")}>
 <Checkbox checked={checked} onCheckedChange={(c) => setSelectedEvents(c ? [...selectedEvents, ev.key] : selectedEvents.filter((e) => e !== ev.key))} className="data-[state=checked]:border-current" />
 <div className="flex-1 min-w-0">
 <span className="text-[13px] font-medium text-foreground/90 block">{ev.label}</span>
 <span className="font-mono text-[10px] text-muted-foreground/50">{ev.key}</span>
 </div>
 {checked && <CheckCircle2 className={cn("h-4 w-4 shrink-0", cat.color)} />}
 </label>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 </div>

 {selectedEvents.length > 0 && (
 <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
 <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
 <span className="text-[12px] text-primary font-medium">{selectedEvents.length} {selectedEvents.length === 1 ? "evento selecionado" : "eventos selecionados"}</span>
 </div>
 )}

 <Button type="submit" disabled={selectedEvents.length === 0 || !url} className="w-full gradient-primary text-primary-foreground font-bold h-12 rounded-xl shadow-xl shadow-primary/15 text-sm disabled:opacity-40">
 <Webhook className="h-4 w-4 mr-2" /> Criar Webhook
 </Button>
 </form>
 </DialogContent>
 </Dialog>
 </div>
 </div>
 </div>
 </motion.section>

 {/* ═══ KPIs ═══ */}
 <div className="grid grid-cols-3 gap-3 mb-6">
 <KpiTile label="Webhooks" value={String(webhooks.length)} icon={Webhook} color="primary" delay={0} sub="configurados" />
 <KpiTile label="Ativos" value={String(activeCount)} icon={Zap} color="success" delay={0.06} sub="recebendo eventos" />
 <KpiTile label="Eventos" value={String(totalEvents)} icon={Radio} color="warning" delay={0.12} sub="monitorados" />
 </div>

 {/* ═══ Webhooks List ═══ */}
 <div className="space-y-3 mb-8">
 {webhooks.length === 0 ? (
 <GlowCard glowColor="primary" className="p-12">
 <div className="text-center">
 <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-muted/10 ring-1 ring-border/10 flex items-center justify-center">
 <Webhook className="h-7 w-7 text-muted-foreground/20" />
 </div>
 <p className="text-[14px] font-heading font-bold text-foreground/60">Nenhum webhook configurado</p>
 <p className="text-[11px] text-muted-foreground/35 mt-1.5">Crie seu primeiro webhook para receber notificações em tempo real</p>
 </div>
 </GlowCard>
 ) : (
 webhooks.map((wh, i) => (
 <GlowCard key={wh.id} glowColor={wh.is_active ? "success" : "muted-foreground"} delay={i * 0.04} className="p-5">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full", wh.is_active ? "bg-success" : "bg-muted-foreground/15")} />
 
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3 min-w-0">
 <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1 transition-all group-hover:scale-110", wh.is_active ? "bg-success/10 ring-success/15 text-success" : "bg-muted/10 ring-border/10 text-muted-foreground/30")}>
 <Webhook className="h-4.5 w-4.5" />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <span className={cn("relative flex h-2 w-2 shrink-0")}>
 {wh.is_active && <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-30" />}
 <span className={cn("relative h-2 w-2 rounded-full", wh.is_active ? "bg-success" : "bg-muted-foreground/20")} />
 </span>
 <span className={cn("text-[9px] font-heading font-bold uppercase tracking-[0.2em]", wh.is_active ? "text-success" : "text-muted-foreground/40")}>
 {wh.is_active ? "Ativo" : "Inativo"}
 </span>
 </div>
 <p className="font-mono text-[12px] text-foreground/70 truncate mt-0.5 max-w-[300px]">{wh.url}</p>
 </div>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => toggleActive(wh.id, wh.is_active)}>
 {wh.is_active ? <ToggleRight className="h-5 w-5 text-success" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground/30" />}
 </Button>
 <Button variant="ghost" size="icon" className="text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-xl h-9 w-9" onClick={() => deleteWebhook(wh.id)}>
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </div>

 <div className="flex flex-wrap gap-1.5 mb-3">
 {(wh.events || []).map((ev: string) => {
 const cat = getEventCategory(ev);
 return (
 <span key={ev} className={cn("text-[9px] px-2.5 py-1 rounded-lg font-heading font-bold ring-1 flex items-center gap-1.5", cat ? `${cat.bg} ring-${cat.dot.replace("bg-", "")}/15 ${cat.color}` : "bg-muted/10 ring-border/10 text-muted-foreground")}>
 <span className={cn("h-1 w-1 rounded-full", cat?.dot || "bg-muted-foreground")} />
 {getEventLabel(ev)}
 </span>
 );
 })}
 </div>

 {wh.secret_masked && (
 <div className="flex items-center gap-2 pt-3 border-t border-border/10">
 <Shield className="h-3 w-3 text-muted-foreground/30 shrink-0" />
 <span className="text-[10px] text-muted-foreground/40 font-heading">Secret:</span>
 <span className="font-mono text-[10px] text-muted-foreground/50">{wh.secret_masked}</span>
 <button onClick={() => copySecret(wh.secret_masked, wh.id)} className="ml-auto text-muted-foreground/30 hover:text-primary transition-colors">
 {copiedId === wh.id ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
 </button>
 </div>
 )}
 </GlowCard>
 ))
 )}
 </div>

 {/* ═══ Documentation Section ═══ */}
 <div className="space-y-4">
 <GlowCard glowColor="primary" className="cursor-pointer" delay={0.2}>
 <button onClick={() => setShowDocs(!showDocs)} className="w-full flex items-center justify-between p-5">
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-xl bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center">
 <Code2 className="h-4 w-4 text-primary" />
 </div>
 <div className="text-left">
 <span className="text-sm font-heading font-bold text-foreground block">Guia de Integração</span>
 <span className="text-[10px] text-muted-foreground/40">Como receber e validar webhooks no seu servidor</span>
 </div>
 </div>
 {showDocs ? <ChevronUp className="h-4 w-4 text-muted-foreground/40" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/40" />}
 </button>
 </GlowCard>

 <AnimatePresence>
 {showDocs && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: "auto" }}
 exit={{ opacity: 0, height: 0 }}
 transition={{ duration: 0.3, ease }}
 className="space-y-4 overflow-hidden"
 >
 {/* How it works */}
 <GlowCard glowColor="info" className="p-5">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-info")} />
 <div className="flex items-center gap-2.5 mb-4">
 <div className="h-8 w-8 rounded-xl bg-info/8 ring-1 ring-info/15 flex items-center justify-center">
 <Shield className="h-4 w-4 text-info" />
 </div>
 <h3 className="text-sm font-heading font-bold text-foreground">Como Funciona</h3>
 </div>
 
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 {[
 { step: "1", title: "Receba o Evento", desc: "Enviamos um POST com o payload JSON para sua URL configurada", color: "primary" },
 { step: "2", title: "Valide a Assinatura", desc: "Verifique o header X-Webhook-Signature com HMAC-SHA256", color: "warning" },
 { step: "3", title: "Processe e Responda", desc: "Retorne status 200 em até 10 segundos para confirmar", color: "success" },
 ].map((item) => (
 <div key={item.step} className="relative p-4 rounded-xl bg-muted/5 ring-1 ring-border/10 space-y-2">
 <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-heading font-black ring-1", `bg-${item.color}/10 ring-${item.color}/15 text-${item.color}`)}>
 {item.step}
 </div>
 <p className="text-[13px] font-heading font-bold text-foreground">{item.title}</p>
 <p className="text-[10px] text-muted-foreground/40 leading-relaxed">{item.desc}</p>
 </div>
 ))}
 </div>
 </GlowCard>

 {/* Payload Example */}
 <GlowCard glowColor="primary" className="p-5">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-primary")} />
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2.5">
 <div className="h-8 w-8 rounded-xl bg-primary/8 ring-1 ring-primary/15 flex items-center justify-center">
 <Terminal className="h-4 w-4 text-primary" />
 </div>
 <h3 className="text-sm font-heading font-bold text-foreground">Exemplo de Payload</h3>
 </div>
 <button onClick={() => copyCode(PAYLOAD_EXAMPLE)} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5 font-heading">
 <Copy className="h-3 w-3" /> Copiar
 </button>
 </div>
 <div className="relative rounded-xl bg-[hsl(var(--background))] border border-border/20 overflow-hidden">
 <div className="flex items-center gap-2 px-4 py-2 border-b border-border/15 bg-muted/5">
 <div className="flex items-center gap-1.5">
 <div className="h-2 w-2 rounded-full bg-destructive/30" />
 <div className="h-2 w-2 rounded-full bg-warning/30" />
 <div className="h-2 w-2 rounded-full bg-success/30" />
 </div>
 <span className="text-[10px] font-mono text-success font-bold ml-2">POST</span>
 <span className="text-[10px] font-mono text-muted-foreground/40">https://seusite.com/webhook</span>
 </div>
 <pre className="p-4 text-[11px] font-mono text-foreground/70 overflow-x-auto leading-relaxed">{PAYLOAD_EXAMPLE}</pre>
 </div>
 <p className="text-[9px] text-muted-foreground/30 mt-2 font-display">Valores monetários são enviados em centavos (ex: 19700 = R$ 197,00)</p>
 </GlowCard>

 {/* Code Examples */}
 <GlowCard glowColor="warning" className="p-5">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-warning")} />
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2.5">
 <div className="h-8 w-8 rounded-xl bg-warning/8 ring-1 ring-warning/15 flex items-center justify-center">
 <Code2 className="h-4 w-4 text-warning" />
 </div>
 <h3 className="text-sm font-heading font-bold text-foreground">Código de Integração</h3>
 </div>
 <button onClick={() => { const ex = CODE_EXAMPLES.find(c => c.id === activeCodeTab); if (ex) copyCode(ex.code); }} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/5 font-heading">
 {copiedCode ? <CheckCircle2 className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
 {copiedCode ? "Copiado!" : "Copiar"}
 </button>
 </div>

 {/* Language Tabs */}
 <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/10 ring-1 ring-border/10 w-fit mb-3">
 {CODE_EXAMPLES.map((ex) => (
 <button key={ex.id} onClick={() => setActiveCodeTab(ex.id)} className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-heading font-bold transition-all", activeCodeTab === ex.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/20")}>
 <span className="font-mono text-[9px] font-bold opacity-70">{ex.icon}</span>
 {ex.label}
 </button>
 ))}
 </div>

 <div className="rounded-xl bg-[hsl(var(--background))] border border-border/20 overflow-hidden">
 <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/15 bg-muted/5">
 <div className="h-2 w-2 rounded-full bg-destructive/30" />
 <div className="h-2 w-2 rounded-full bg-warning/30" />
 <div className="h-2 w-2 rounded-full bg-success/30" />
 <span className="ml-2 text-[10px] font-mono text-muted-foreground/30">webhook-handler.{activeCodeTab === "node" ? "js" : activeCodeTab === "python" ? "py" : "php"}</span>
 </div>
 <pre className="p-4 text-[11px] font-mono text-foreground/70 overflow-x-auto leading-relaxed max-h-[400px] overflow-y-auto">{CODE_EXAMPLES.find(c => c.id === activeCodeTab)?.code}</pre>
 </div>
 </GlowCard>

 {/* Security Note */}
 <GlowCard glowColor="destructive" className="p-4">
 <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-destructive")} />
 <div className="flex items-start gap-3">
 <div className="h-8 w-8 rounded-xl bg-destructive/8 ring-1 ring-destructive/15 flex items-center justify-center shrink-0">
 <Shield className="h-4 w-4 text-destructive" />
 </div>
 <div className="space-y-1">
 <p className="text-[12px] font-heading font-bold text-foreground/70">Segurança</p>
 <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
 Todos os webhooks são assinados com <code className="font-mono text-primary/60 bg-primary/5 px-1.5 py-0.5 rounded-lg text-[9px]">HMAC-SHA256</code>. 
 Sempre valide o header <code className="font-mono text-primary/60 bg-primary/5 px-1.5 py-0.5 rounded-lg text-[9px]">X-Webhook-Signature</code> antes de processar qualquer evento.
 </p>
 </div>
 </div>
 </GlowCard>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 );
}
