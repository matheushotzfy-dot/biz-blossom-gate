import { useEffect, useState, useCallback, useMemo } from "react";
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
  ArrowDownToLine,
  Building2,
  User,
  BookOpen,
  Search,
  X,
  Trophy,
  MessageSquare,
  Puzzle,
  Ticket,
  Shield,
  ArrowRight,
  Zap,
  Clock,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

const PAGES = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3, category: "principal" },
  { label: "Minhas Vendas", href: "/vendas", icon: DollarSign, category: "vendas" },
  { label: "Produtos", href: "/vendas/produtos", icon: Package, category: "vendas" },
  { label: "Checkout", href: "/vendas/checkout", icon: CreditCard, category: "vendas" },
  { label: "Cupons", href: "/vendas/cupons", icon: Ticket, category: "vendas" },
  { label: "Extrato", href: "/financeiro/extrato", icon: FileText, category: "financeiro" },
  { label: "Financeiro", href: "/financeiro/saques", icon: ArrowDownToLine, category: "financeiro" },
  { label: "Config. Financeiro", href: "/financeiro/config", icon: Building2, category: "financeiro" },
  { label: "Integrações", href: "/integracoes", icon: Puzzle, category: "ferramentas" },
  { label: "Meu Perfil", href: "/perfil", icon: User, category: "conta" },
  { label: "Identidade & KYC", href: "/perfil?tab=identidade", icon: Shield, category: "conta" },
  { label: "Premiações", href: "/premiacoes", icon: Trophy, category: "conta" },
  { label: "Suporte", href: "/suporte", icon: MessageSquare, category: "conta" },
  { label: "API Docs", href: "/vendas/documentacao", icon: BookOpen, category: "ferramentas" },
];

const CATEGORY_LABELS: Record<string, string> = {
  principal: "Geral",
  vendas: "Comercial",
  financeiro: "Bancário",
  ferramentas: "Sistema",
  conta: "Pessoal",
};

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  href: string;
  icon: any;
  type: "product" | "transaction" | "page";
}

export function GlobalSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("global_search_recents");
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  const saveRecent = (q: string) => {
    if (!q) return;
    const next = [q, ...recentSearches.filter(i => i !== q)].slice(0, 3);
    setRecentSearches(next);
    localStorage.setItem("global_search_recents", JSON.stringify(next));
  };

  const filteredPages = useMemo(() => 
    PAGES.filter(p => !query || p.label.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const allItems = useMemo(() => [
    ...results,
    ...filteredPages.map(p => ({ 
      id: p.href, 
      label: p.label, 
      sub: CATEGORY_LABELS[p.category], 
      href: p.href, 
      icon: p.icon,
      type: "page" as const 
    }))
  ], [results, filteredPages]);

  const search = useCallback(async (q: string) => {
    if (!user?.id || q.length < 2) { 
      setResults([]); 
      setIsLoading(false);
      return; 
    }
    
    setIsLoading(true);
    const term = `%${q}%`;
    try {
      const [prodRes, txRes] = await Promise.all([
        supabase.from("products").select("id, name, price").eq("user_id", user.id).ilike("name", term).limit(4),
        supabase.from("transactions").select("id, customer_name, customer_email, amount, status").eq("user_id", user.id).or(`customer_name.ilike.${term},customer_email.ilike.${term}`).limit(4),
      ]);
      
      const items: SearchResult[] = [];
      prodRes.data?.forEach(p => items.push({ 
        id: p.id, 
        label: p.name, 
        sub: `R$ ${Number(p.price).toLocaleString("pt-BR")}`, 
        href: `/vendas/produtos?q=${encodeURIComponent(p.name)}`, 
        icon: Package,
        type: "product"
      }));
      txRes.data?.forEach(t => items.push({ 
        id: t.id, 
        label: t.customer_name || t.customer_email || "Venda", 
        sub: `Transação • R$ ${Number(t.amount).toLocaleString("pt-BR")}`, 
        href: `/vendas?search=${encodeURIComponent(t.customer_email || "")}`, 
        icon: DollarSign,
        type: "transaction"
      }));
      setResults(items);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); setSelectedIdx(0); setIsLoading(false); }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => { setSelectedIdx(0); }, [allItems.length]);

  const go = (href: string) => {
    if (query) saveRecent(query);
    onOpenChange(false);
    navigate(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { 
      e.preventDefault(); 
      setSelectedIdx(i => Math.min(i + 1, allItems.length - 1)); 
    }
    else if (e.key === "ArrowUp") { 
      e.preventDefault(); 
      setSelectedIdx(i => Math.max(i - 1, 0)); 
    }
    else if (e.key === "Enter" && allItems[selectedIdx]) { 
      go(allItems[selectedIdx].href); 
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 border-none bg-transparent shadow-none max-w-2xl ring-0 focus:ring-0 [&>button:last-child]:hidden h-fit flex items-start justify-center pt-24">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full bg-card/90 backdrop-blur-3xl rounded-3xl border border-border/40 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative"
          onKeyDown={handleKeyDown}
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          
          {/* Header */}
          <div className="relative flex items-center h-16 px-5 gap-3 border-b border-border/10">
            <div className="flex h-6 w-6 items-center justify-center text-primary/60">
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              ) : (
                <Search className="h-5 w-5" strokeWidth={2.5} />
              )}
            </div>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquise por vendas, produtos ou navegue..."
              className="flex-1 bg-transparent text-[15px] font-medium text-foreground placeholder:text-muted-foreground/30 outline-none h-full"
            />
            <div className="flex items-center gap-1.5 opacity-40">
              <Command className="h-3 w-3" />
              <span className="text-[10px] font-bold">K</span>
            </div>
            {query && (
              <button onClick={() => setQuery("")} className="ml-2 hover:bg-muted/30 p-1 rounded-md transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex-1 flex min-h-[400px] max-h-[520px]">
            {/* Left Column: Quick Links */}
            <div className="w-[200px] border-r border-border/10 bg-muted/5 p-4 flex flex-col gap-6">
              {!query && recentSearches.length > 0 && (
                <div>
                  <h3 className="px-2 mb-3 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/40">Recentes</h3>
                  <div className="space-y-1">
                    {recentSearches.map((s) => (
                      <button 
                        key={s} 
                        onClick={() => setQuery(s)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-medium text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-colors"
                      >
                        <Clock className="h-3 w-3 opacity-40" />
                        <span className="truncate">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="px-2 mb-3 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/40">Atalhos</h3>
                <div className="space-y-1">
                  {[
                    { label: "Dashboard", href: "/dashboard", icon: Zap },
                    { label: "Novo Produto", href: "/vendas/produtos/novo/editar", icon: Package },
                    { label: "Saldo", href: "/financeiro/saques", icon: DollarSign },
                  ].map(item => (
                    <button 
                      key={item.href}
                      onClick={() => go(item.href)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-medium text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-colors group"
                    >
                      <item.icon className="h-3.5 w-3.5 opacity-40 group-hover:text-primary group-hover:opacity-100 transition-all" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Search & Pages */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="space-y-6">
                {allItems.length > 0 ? (
                  <div className="grid gap-1">
                    {/* Header for dynamic section */}
                    <p className="px-2 mb-2 text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                      {query ? "Correspondências" : "Navegação"}
                    </p>
                    
                    {allItems.map((item, idx) => {
                      const isSelected = idx === selectedIdx;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => go(item.href)}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-150 text-left group border border-transparent",
                            isSelected 
                              ? "bg-primary/10 border-primary/20 shadow-sm" 
                              : "hover:bg-muted/10"
                          )}
                        >
                          <div className={cn(
                            "h-9 w-9 rounded-lg flex items-center justify-center transition-colors shrink-0",
                            isSelected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/40 text-muted-foreground/40"
                          )}>
                            <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-[13.5px] font-semibold leading-none", isSelected ? "text-foreground" : "text-foreground/80")}>
                              {item.label}
                            </p>
                            <p className="text-[11px] font-medium text-muted-foreground/50 mt-1.5">{item.sub}</p>
                          </div>

                          <div className={cn(
                            "opacity-0 -translate-x-2 transition-all",
                            isSelected && "opacity-100 translate-x-0"
                          )}>
                            <ArrowRight className="h-4 w-4 text-primary" strokeWidth={3} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-[300px] flex flex-col items-center justify-center text-center px-8">
                    <div className="h-12 w-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                      <Search className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <p className="text-[14px] font-bold text-muted-foreground/60">Nada encontrado</p>
                    <p className="text-[12px] text-muted-foreground/30 mt-1">Tente usar outros termos ou navegue pelos atalhos laterais.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Shortcuts */}
          <div className="h-12 border-t border-border/10 bg-muted/5 flex items-center justify-between px-5">
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <kbd className="flex h-5 items-center justify-center rounded border border-border/20 bg-background px-1.5 font-mono text-[10px] font-bold text-muted-foreground/40">↑↓</kbd>
                <span className="text-[10px] font-bold text-muted-foreground/20">Mover</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="flex h-5 items-center justify-center rounded border border-border/20 bg-background px-1.5 font-mono text-[10px] font-bold text-muted-foreground/40">↵</kbd>
                <span className="text-[10px] font-bold text-muted-foreground/20">Selecionar</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/20">Hotzfy QuickNav 2.0</span>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
