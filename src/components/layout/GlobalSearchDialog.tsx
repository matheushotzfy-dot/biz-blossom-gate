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
 { label: "Financeiro", href: "/financeiro/saques", icon: ArrowDownToLine, category: "financeiro" },
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
  <DialogContent className="overflow-hidden p-0 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] border-border/20 bg-card/95 backdrop-blur-3xl max-w-2xl rounded-[2rem] gap-0 [&>button:last-child]:hidden ring-1 ring-white/10">
    {/* Ambient Effects */}
    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-info/[0.05] pointer-events-none" />
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    
    <div className="relative z-10 flex flex-col h-[600px]" onKeyDown={handleKeyDown}>
      {/* ─── PREMIUM SEARCH HEADER ─── */}
      <div className="relative flex items-center gap-4 px-6 py-5 border-b border-border/10 bg-muted/5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Search className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="O que você está procurando hoje?"
          className="flex-1 bg-transparent text-[16px] font-display font-bold text-foreground placeholder:text-muted-foreground/30 outline-none"
        />
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setQuery("")}
                className="h-8 w-8 rounded-xl bg-muted/20 flex items-center justify-center hover:bg-muted/30 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </motion.button>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/20 border border-border/10">
            <span className="text-[10px] font-black text-muted-foreground/40">ESC</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT SIDEBAR: QUICK NAVIGATION (OPÇÕES) ─── */}
        <div className="w-[240px] border-r border-border/10 bg-muted/5 flex flex-col">
          <div className="px-5 py-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-4">Navegação Rápida</h3>
            <div className="space-y-1 overflow-y-auto max-h-[460px] pr-2 no-scrollbar">
              {Object.entries(groupedPages).map(([cat, pages]) => (
                <div key={cat} className="mb-4">
                  <p className="px-2 mb-1.5 text-[9px] font-bold text-primary/60 uppercase tracking-wider">{CATEGORY_LABELS[cat] || cat}</p>
                  <div className="space-y-0.5">
                    {pages.map((p) => {
                      const itemIdx = allItems.findIndex(item => item.href === p.href && item.type === "page");
                      const isSelected = itemIdx === selectedIdx;
                      const Icon = p.icon;
                      return (
                        <button
                          key={p.href}
                          onClick={() => go(p.href)}
                          onMouseEnter={() => setSelectedIdx(itemIdx)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 text-left relative group",
                            isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/10 text-muted-foreground/70"
                          )}
                        >
                          {isSelected && <motion.div layoutId="nav-active" className="absolute inset-0 rounded-xl bg-primary/5 ring-1 ring-primary/20" />}
                          <Icon className={cn("h-3.5 w-3.5 relative z-10", isSelected ? "text-primary" : "text-muted-foreground/40")} />
                          <span className="text-[12px] font-semibold relative z-10 truncate">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── MAIN AREA: DYNAMIC RESULTS (BUSCA) ─── */}
        <div className="flex-1 flex flex-col bg-card/50">
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {results.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Resultados da Busca</h3>
                  <span className="text-[10px] font-medium text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full ring-1 ring-primary/10">
                    {results.length} encontrados
                  </span>
                </div>
                <div className="grid gap-2">
                  {results.map((r, idx) => {
                    const Icon = r.icon;
                    const isSelected = idx === selectedIdx;
                    return (
                      <button
                        key={r.id}
                        onClick={() => go(r.href)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        className={cn(
                          "w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 text-left border relative group",
                          isSelected 
                            ? "bg-primary/[0.03] border-primary/20 shadow-lg shadow-primary/5 ring-1 ring-primary/20" 
                            : "bg-muted/5 border-border/5 hover:bg-muted/10 hover:border-border/10"
                        )}
                      >
                        <div className={cn(
                          "h-11 w-11 rounded-xl flex items-center justify-center ring-1 shrink-0 transition-all",
                          isSelected ? "bg-primary/10 ring-primary/20 text-primary shadow-inner" : "bg-muted/10 ring-border/10 text-muted-foreground/30"
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-[14px] font-display font-bold truncate", isSelected ? "text-foreground" : "text-foreground/80")}>{r.label}</p>
                          <p className="text-[10px] font-medium text-muted-foreground/50 truncate mt-0.5">{r.sub}</p>
                        </div>
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center transition-all",
                          isSelected ? "bg-primary text-primary-foreground scale-100 opacity-100" : "bg-muted/20 text-muted-foreground scale-75 opacity-0"
                        )}>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : query.length >= 2 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="h-16 w-16 rounded-3xl bg-muted/10 flex items-center justify-center mb-4 ring-1 ring-border/10">
                  <Search className="h-8 w-8 text-muted-foreground/20" />
                </div>
                <p className="text-[14px] font-display font-bold text-muted-foreground/40">Nenhum resultado para "{query}"</p>
                <p className="text-[12px] text-muted-foreground/25 mt-1">Tente buscar por produtos, clientes ou IDs de transação.</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-40 group">
                <Sparkles className="h-12 w-12 text-primary/20 mb-4 group-hover:scale-110 transition-transform duration-500" />
                <p className="text-[13px] font-display font-bold text-muted-foreground/40">O que podemos encontrar hoje?</p>
                <p className="text-[11px] text-muted-foreground/25 mt-1 max-w-[200px]">Busque por qualquer coisa na plataforma Hotzfy.</p>
              </div>
            )}
          </div>

          {/* ─── FOOTER ─── */}
          <div className="px-6 py-4 border-t border-border/10 bg-muted/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <kbd className="h-5 px-1.5 rounded-lg bg-muted/20 border border-border/10 text-[9px] font-black text-muted-foreground/40">↑↓</kbd>
                <span className="text-[10px] font-bold text-muted-foreground/30">Navegar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="h-5 px-1.5 rounded-lg bg-muted/20 border border-border/10 text-[9px] font-black text-muted-foreground/40">↵</kbd>
                <span className="text-[10px] font-bold text-muted-foreground/30">Abrir</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/30">Intelligent Search v2</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DialogContent>
 </Dialog>
 );
}
