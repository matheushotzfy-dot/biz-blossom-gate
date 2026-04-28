import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 Package,
 CreditCard,
 DollarSign,
 Users,
 FileText,
 BarChart3,
 Layers,
 ArrowDownToLine,
 Building2,
 Webhook,
 User,
 BookOpen,
 GraduationCap,
 Search,
 X,
 Sparkles,
 Trophy,
 MessageSquare,
 Puzzle,
 Ticket,
 Repeat,
 Store,
 Shield,
 ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.16, 1, 0.3, 1] as const;

const PAGES = [
 { label: "Dashboard", href: "/dashboard", icon: BarChart3, category: "principal" },
 { label: "Minhas Vendas", href: "/vendas", icon: DollarSign, category: "vendas" },
 { label: "Produtos", href: "/vendas/produtos", icon: Package, category: "vendas" },
 { label: "Checkout", href: "/vendas/checkout", icon: CreditCard, category: "vendas" },
 { label: "Conteúdo", href: "/vendas/conteudo", icon: Layers, category: "vendas" },
 { label: "Afiliados", href: "/vendas/afiliados", icon: Users, category: "vendas" },
 { label: "Coproduções", href: "/vendas/coproducoes", icon: Users, category: "vendas" },
 { label: "Cupons", href: "/vendas/cupons", icon: Ticket, category: "vendas" },
 { label: "Assinaturas", href: "/vendas/assinaturas", icon: Repeat, category: "vendas" },
 { label: "Extrato", href: "/financeiro/extrato", icon: FileText, category: "financeiro" },
 { label: "Saldo Disponível", href: "/financeiro/saques", icon: ArrowDownToLine, category: "financeiro" },
 { label: "Config. Financeiro", href: "/financeiro/config", icon: Building2, category: "financeiro" },
 { label: "Integrações", href: "/integracoes", icon: Puzzle, category: "ferramentas" },
 { label: "Meu Perfil", href: "/perfil", icon: User, category: "conta" },
 { label: "Identidade & KYC", href: "/perfil?tab=identidade", icon: Shield, category: "conta" },
 { label: "Minhas Compras", href: "/membros", icon: GraduationCap, category: "conta" },
 { label: "Premiações", href: "/premiacoes", icon: Trophy, category: "conta" },
 { label: "Marketplace", href: "/marketplace", icon: Store, category: "conta" },
 { label: "Suporte", href: "/suporte", icon: MessageSquare, category: "conta" },
 { label: "API Docs", href: "/vendas/documentacao", icon: BookOpen, category: "ferramentas" },
];

const CATEGORY_LABELS: Record<string, string> = {
 principal: "Principal",
 vendas: "Vendas",
 financeiro: "Financeiro",
 ferramentas: "Ferramentas",
 conta: "Conta",
};

interface SearchResult {
 id: string;
 label: string;
 sub: string;
 href: string;
 icon: typeof Package;
}

export function GlobalSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
 const { user } = useAuth();
 const navigate = useNavigate();
 const [results, setResults] = useState<SearchResult[]>([]);
 const [query, setQuery] = useState("");
 const [selectedIdx, setSelectedIdx] = useState(0);

 const filteredPages = PAGES.filter(p => !query || p.label.toLowerCase().includes(query.toLowerCase()));

 // Build combined list for keyboard nav
 const allItems = [...results.map(r => ({ href: r.href, type: "result" as const })), ...filteredPages.map(p => ({ href: p.href, type: "page" as const }))];

 const search = useCallback(async (q: string) => {
 if (!user?.id || q.length < 2) { setResults([]); return; }
 const term = `%${q}%`;
 const [prodRes, txRes] = await Promise.all([
 supabase.from("products").select("id, name, price, checkout_url").eq("user_id", user.id).ilike("name", term).limit(5),
 supabase.from("transactions").select("id, customer_name, customer_email, amount, status").eq("user_id", user.id).or(`customer_name.ilike.${term},customer_email.ilike.${term}`).limit(5),
 ]);
 const items: SearchResult[] = [];
 prodRes.data?.forEach(p => items.push({ id: p.id, label: p.name, sub: `Produto • R$ ${Number(p.price).toFixed(2)}`, href: "/vendas/produtos", icon: Package }));
 txRes.data?.forEach(t => items.push({ id: t.id, label: t.customer_name || t.customer_email || "Cliente", sub: `${t.status === "completed" ? "Aprovada" : t.status} • R$ ${Number(t.amount).toFixed(2)}`, href: "/vendas", icon: Users }));
 setResults(items);
 }, [user?.id]);

 useEffect(() => {
 if (!open) { setQuery(""); setResults([]); setSelectedIdx(0); }
 }, [open]);

 useEffect(() => {
 const timer = setTimeout(() => search(query), 300);
 return () => clearTimeout(timer);
 }, [query, search]);

 useEffect(() => { setSelectedIdx(0); }, [query, results.length]);

 const go = (href: string) => {
 onOpenChange(false);
 navigate(href);
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, allItems.length - 1)); }
 else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
 else if (e.key === "Enter" && allItems[selectedIdx]) { go(allItems[selectedIdx].href); }
 };

 // Group filtered pages by category
 const groupedPages = filteredPages.reduce<Record<string, typeof PAGES>>((acc, p) => {
 (acc[p.category] ??= []).push(p);
 return acc;
 }, {});

 let globalIdx = results.length; // pages start after results

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="overflow-hidden p-0 shadow-2xl shadow-primary/5 border-border/30 bg-card/98 backdrop-blur-2xl max-w-lg rounded-2xl gap-0 [&>button:last-child]:hidden">
 {/* Ambient */}
 <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none rounded-2xl" />
 <div className="absolute inset-0 opacity-[0.01] pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 0.5px, transparent 0.5px)", backgroundSize: "14px 14px" }} />

 <div className="relative z-10" onKeyDown={handleKeyDown}>
 {/* Search input */}
 <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/20">
 <Search className="h-4 w-4 text-primary/50 shrink-0" />
 <input
 autoFocus
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 placeholder="Buscar produtos, clientes, páginas..."
 className="flex-1 bg-transparent text-[13px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none"
 />
 <button onClick={() => query ? setQuery("") : onOpenChange(false)} className="h-6 w-6 rounded-lg bg-muted/10 flex items-center justify-center hover:bg-muted/20 transition-colors">
 <X className="h-3 w-3 text-muted-foreground/50" />
 </button>
 <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/8 ring-1 ring-border/10 cursor-pointer" onClick={() => onOpenChange(false)}>
 <span className="text-[9px] font-display font-bold text-muted-foreground/30">ESC</span>
 </div>
 </div>

 {/* Results area */}
 <div className="max-h-[380px] overflow-y-auto overscroll-contain py-2 px-2">
 {/* Dynamic results */}
 {results.length > 0 && (
 <div className="mb-2">
 <p className="px-2.5 py-1.5 text-[9px] font-display font-bold uppercase tracking-[0.2em] text-muted-foreground/30">Resultados</p>
 {results.map((r, idx) => {
 const Icon = r.icon;
 const isSelected = idx === selectedIdx;
 return (
 <button
 key={r.id}
 onClick={() => go(r.href)}
 onMouseEnter={() => setSelectedIdx(idx)}
 className={cn(
 "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left group",
 isSelected ? "bg-primary/8 ring-1 ring-primary/15" : "hover:bg-muted/5"
 )}
 >
 <div className={cn(
 "h-8 w-8 rounded-lg flex items-center justify-center ring-1 shrink-0 transition-all",
 isSelected ? "bg-primary/10 ring-primary/15 text-primary" : "bg-muted/5 ring-border/10 text-muted-foreground/30"
 )}>
 <Icon className="h-3.5 w-3.5" />
 </div>
 <div className="flex-1 min-w-0">
 <p className={cn("text-[12px] font-display font-bold truncate", isSelected ? "text-foreground" : "text-foreground/70")}>{r.label}</p>
 <p className="text-[9px] text-muted-foreground/40 truncate">{r.sub}</p>
 </div>
 {isSelected && <ArrowRight className="h-3 w-3 text-primary/40 shrink-0" />}
 </button>
 );
 })}
 </div>
 )}

 {/* Pages grouped by category */}
 {Object.entries(groupedPages).map(([cat, pages]) => {
 const catItems = pages.map((p, pIdx) => {
 const itemIdx = globalIdx++;
 const isSelected = itemIdx === selectedIdx;
 const Icon = p.icon;
 return (
 <button
 key={p.href}
 onClick={() => go(p.href)}
 onMouseEnter={() => setSelectedIdx(itemIdx)}
 className={cn(
 "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left group",
 isSelected ? "bg-primary/8 ring-1 ring-primary/15" : "hover:bg-muted/5"
 )}
 >
 <div className={cn(
 "h-8 w-8 rounded-lg flex items-center justify-center ring-1 shrink-0 transition-all",
 isSelected ? "bg-primary/10 ring-primary/15 text-primary" : "bg-muted/5 ring-border/10 text-muted-foreground/25"
 )}>
 <Icon className="h-3.5 w-3.5" />
 </div>
 <span className={cn(
 "text-[12px] font-display font-semibold flex-1 truncate",
 isSelected ? "text-foreground font-bold" : "text-foreground/60"
 )}>{p.label}</span>
 {isSelected && <ArrowRight className="h-3 w-3 text-primary/40 shrink-0" />}
 </button>
 );
 });

 // Reset globalIdx tracking - we need to recalculate per render
 return (
 <div key={cat} className="mb-1.5">
 <p className="px-2.5 py-1.5 text-[9px] font-display font-bold uppercase tracking-[0.2em] text-muted-foreground/30">
 {CATEGORY_LABELS[cat] || cat}
 </p>
 {catItems}
 </div>
 );
 })}

 {/* Empty state */}
 {query && filteredPages.length === 0 && results.length === 0 && (
 <div className="py-10 text-center">
 <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground/15" />
 <p className="text-[12px] font-display font-bold text-muted-foreground/30">Nenhum resultado</p>
 <p className="text-[10px] text-muted-foreground/20 mt-1">Tente buscar por outro termo</p>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/10">
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1">
 <kbd className="h-5 px-1.5 rounded bg-muted/8 ring-1 ring-border/10 text-[9px] font-display font-bold text-muted-foreground/30 inline-flex items-center">↑↓</kbd>
 <span className="text-[9px] text-muted-foreground/25">navegar</span>
 </div>
 <div className="flex items-center gap-1">
 <kbd className="h-5 px-1.5 rounded bg-muted/8 ring-1 ring-border/10 text-[9px] font-display font-bold text-muted-foreground/30 inline-flex items-center">↵</kbd>
 <span className="text-[9px] text-muted-foreground/25">abrir</span>
 </div>
 </div>
 <div className="flex items-center gap-1.5">
 <Sparkles className="h-3 w-3 text-primary/20" />
 <span className="text-[9px] font-display font-bold text-muted-foreground/20">Busca Inteligente</span>
 </div>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
}
