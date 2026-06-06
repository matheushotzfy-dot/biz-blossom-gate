import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Package,
  CreditCard,
  DollarSign,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";

const PAGES = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { label: "Minhas Vendas", href: "/vendas", icon: DollarSign },
  { label: "Produtos", href: "/vendas/produtos", icon: Package },
  { label: "Checkout", href: "/vendas/checkout", icon: CreditCard },
  { label: "Cupons", href: "/vendas/cupons", icon: Ticket },
  { label: "Extrato", href: "/financeiro/extrato", icon: FileText },
  { label: "Financeiro", href: "/financeiro/saques", icon: ArrowDownToLine },
  { label: "Config. Financeiro", href: "/financeiro/config", icon: Building2 },
  { label: "Integrações", href: "/integracoes", icon: Puzzle },
  { label: "Meu Perfil", href: "/perfil", icon: User },
  { label: "Identidade & KYC", href: "/perfil?tab=identidade", icon: Shield },
  { label: "Premiações", href: "/premiacoes", icon: Trophy },
  { label: "Suporte", href: "/suporte", icon: MessageSquare },
  { label: "API Docs", href: "/vendas/documentacao", icon: BookOpen },
];

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

  const filteredPages = useMemo(
    () => PAGES.filter(p => !query || p.label.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const allItems = useMemo(() => [
    ...results,
    ...filteredPages.map(p => ({
      id: p.href,
      label: p.label,
      sub: "",
      href: p.href,
      icon: p.icon,
      type: "page" as const,
    })),
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
        type: "product",
      }));
      txRes.data?.forEach(t => items.push({
        id: t.id,
        label: t.customer_name || t.customer_email || "Venda",
        sub: `R$ ${Number(t.amount).toLocaleString("pt-BR")}`,
        href: `/vendas?search=${encodeURIComponent(t.customer_email || "")}`,
        icon: DollarSign,
        type: "transaction",
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
      <DialogContent className="overflow-hidden p-0 border-none bg-transparent shadow-none max-w-xl ring-0 focus:ring-0 [&>button:last-child]:hidden h-fit flex items-start justify-center pt-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full bg-card/95 backdrop-blur-3xl rounded-2xl border border-border/40 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex items-center h-14 px-4 gap-3 border-b border-border/10">
            <div className="flex h-5 w-5 items-center justify-center text-muted-foreground/60">
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              ) : (
                <Search className="h-4 w-4" strokeWidth={2.5} />
              )}
            </div>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquise por vendas, produtos ou navegue..."
              className="flex-1 bg-transparent text-[14px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none h-full"
            />
            {query && (
              <button onClick={() => setQuery("")} className="hover:bg-muted/30 p-1 rounded-md transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="overflow-y-auto p-2 max-h-[480px] min-h-[200px] custom-scrollbar">
            {allItems.length > 0 ? (
              <div className="grid gap-0.5">
                {allItems.map((item, idx) => {
                  const isSelected = idx === selectedIdx;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => go(item.href)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left",
                        isSelected ? "bg-secondary/80" : "hover:bg-muted/10"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-md flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground/60"
                      )}>
                        <Icon className="h-4 w-4" strokeWidth={2.2} />
                      </div>

                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className={cn("text-[13px] font-semibold truncate", isSelected ? "text-foreground" : "text-foreground/80")}>
                          {item.label}
                        </p>
                        {item.sub && (
                          <span className="text-[11px] font-medium text-muted-foreground/50 tabular-nums truncate">
                            {item.sub}
                          </span>
                        )}
                      </div>

                      {isSelected && <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-center px-8">
                <Search className="h-5 w-5 text-muted-foreground/30 mb-3" />
                <p className="text-[13px] font-semibold text-muted-foreground/60">Nada encontrado</p>
                <p className="text-[12px] text-muted-foreground/30 mt-1">Tente outros termos</p>
              </div>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
