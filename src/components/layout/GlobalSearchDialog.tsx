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
  Trophy,
  MessageSquare,
  Puzzle,
  Ticket,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";

const PAGES = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { label: "Minhas Vendas", href: "/vendas", icon: DollarSign },
  { label: "Produtos", href: "/vendas/produtos", icon: Package },
  { label: "Checkout", href: "/vendas/checkout", icon: CreditCard },
  { label: "Cupons", href: "/vendas/cupons", icon: Ticket },
  { label: "Extrato", href: "/financeiro/extrato", icon: FileText },
  { label: "Financeiro", href: "/financeiro/saques", icon: ArrowDownToLine },
  { label: "Taxas", href: "/perfil", icon: Building2 },
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
  sub?: string;
  href: string;
  icon: LucideIcon;
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

  const allItems = useMemo<SearchResult[]>(() => [
    ...results,
    ...filteredPages.map((p, index) => ({ id: `page:${p.href}:${index}`, label: p.label, href: p.href, icon: p.icon })),
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
        supabase.from("transactions").select("id, customer_name, customer_email, amount").eq("user_id", user.id).or(`customer_name.ilike.${term},customer_email.ilike.${term}`).limit(4),
      ]);

      const items: SearchResult[] = [];
      prodRes.data?.forEach(p => items.push({
        id: p.id,
        label: p.name,
        sub: `R$ ${Number(p.price).toLocaleString("pt-BR")}`,
        href: `/vendas/produtos?q=${encodeURIComponent(p.name)}`,
        icon: Package,
      }));
      txRes.data?.forEach(t => items.push({
        id: t.id,
        label: t.customer_name || t.customer_email || "Venda",
        sub: `R$ ${Number(t.amount).toLocaleString("pt-BR")}`,
        href: `/vendas?search=${encodeURIComponent(t.customer_email || "")}`,
        icon: DollarSign,
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
      <DialogContent className="overflow-visible p-0 border-none bg-transparent shadow-none w-[calc(100vw-2rem)] max-w-lg ring-0 outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="w-full bg-card rounded-2xl border border-border/60 overflow-hidden flex flex-col outline-none shadow-[0_24px_80px_-16px_hsl(var(--foreground)/0.25)]"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {/* Campo de busca */}
          <div className="flex items-center h-14 px-5 gap-3">
            {isLoading ? (
              <div className="h-4 w-4 shrink-0 border-2 border-primary/25 border-t-primary rounded-full animate-spin" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={2.2} />
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/45 outline-none h-full"
            />
          </div>

          <div className="h-px bg-border/50" />

          {/* Resultados — lista única e limpa */}
          <div className="overflow-y-auto py-2 max-h-[380px] min-h-[200px] custom-scrollbar">
            {allItems.length > 0 ? (
              <div>
                {allItems.map((item, idx) => {
                  const isSelected = idx === selectedIdx;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => go(item.href)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors duration-100",
                        isSelected ? "bg-muted/60" : "hover:bg-muted/40"
                      )}
                    >
                      <Icon
                        className={cn("h-4 w-4 shrink-0 transition-colors", isSelected ? "text-primary" : "text-muted-foreground/50")}
                        strokeWidth={2}
                      />
                      <span className={cn(
                        "flex-1 min-w-0 truncate text-[13.5px]",
                        isSelected ? "text-foreground font-medium" : "text-foreground/80"
                      )}>
                        {item.label}
                      </span>
                      {item.sub && (
                        <span className="text-[12px] text-muted-foreground/50 tabular-nums shrink-0">
                          {item.sub}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <p className="text-[13px] text-muted-foreground/50">Nada encontrado</p>
              </div>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
