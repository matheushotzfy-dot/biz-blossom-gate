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
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";

const PAGES = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3, hint: "Visão geral" },
  { label: "Minhas Vendas", href: "/vendas", icon: DollarSign, hint: "Transações" },
  { label: "Produtos", href: "/vendas/produtos", icon: Package, hint: "Catálogo" },
  { label: "Checkout", href: "/vendas/checkout", icon: CreditCard, hint: "Personalização" },
  { label: "Cupons", href: "/vendas/cupons", icon: Ticket, hint: "Descontos" },
  { label: "Extrato", href: "/financeiro/extrato", icon: FileText, hint: "Movimentações" },
  { label: "Financeiro", href: "/financeiro/saques", icon: ArrowDownToLine, hint: "Saques" },
  { label: "Taxas", href: "/perfil", icon: Building2, hint: "Suas taxas" },
  { label: "Integrações", href: "/integracoes", icon: Puzzle, hint: "Apps e webhooks" },
  { label: "Meu Perfil", href: "/perfil", icon: User, hint: "Conta" },
  { label: "Identidade & KYC", href: "/perfil?tab=identidade", icon: Shield, hint: "Verificação" },
  { label: "Premiações", href: "/premiacoes", icon: Trophy, hint: "Conquistas" },
  { label: "Suporte", href: "/suporte", icon: MessageSquare, hint: "Ajuda" },
  { label: "API Docs", href: "/vendas/documentacao", icon: BookOpen, hint: "Desenvolvedores" },
];

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  href: string;
  icon: LucideIcon;
  type: "product" | "transaction" | "page";
}

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  product: "Produto",
  transaction: "Venda",
  page: "Página",
};

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
    ...filteredPages.map(p => ({
      id: p.href,
      label: p.label,
      sub: p.hint,
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

  // Agrupa resultados por tipo para seções com rótulo
  const groups = useMemo(() => {
    const order: SearchResult["type"][] = ["transaction", "product", "page"];
    return order
      .map(type => ({ type, items: allItems.filter(i => i.type === type) }))
      .filter(g => g.items.length > 0);
  }, [allItems]);

  let runningIdx = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-visible p-0 border-none bg-transparent shadow-none w-[calc(100vw-2rem)] max-w-xl ring-0 outline-none focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none [&>button:last-child]:hidden top-[16%] translate-y-0 sm:top-[18%]">
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full bg-card rounded-2xl border border-border/60 overflow-hidden flex flex-col outline-none shadow-[0_24px_80px_-16px_hsl(var(--foreground)/0.25)]"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {/* Campo de busca */}
          <div className="flex items-center h-16 px-5 gap-4">
            <div className="flex h-5 w-5 items-center justify-center text-primary shrink-0">
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-primary/25 border-t-primary rounded-full animate-spin" />
              ) : (
                <Search className="h-[18px] w-[18px]" strokeWidth={2.4} />
              )}
            </div>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar páginas, vendas ou produtos…"
              className="flex-1 bg-transparent text-[15px] font-medium text-foreground placeholder:text-muted-foreground/45 outline-none h-full"
            />
            <kbd className="hidden sm:flex h-6 items-center rounded-md border border-border/70 bg-muted/50 px-2 text-[10px] font-semibold text-muted-foreground/70 tracking-wide">
              ESC
            </kbd>
          </div>

          <div className="h-px bg-border/50 mx-5" />

          {/* Resultados */}
          <div className="overflow-y-auto px-3 py-3 max-h-[420px] min-h-[220px] custom-scrollbar">
            {allItems.length > 0 ? (
              <div className="space-y-4">
                {groups.map(group => (
                  <div key={group.type}>
                    <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">
                      {group.type === "page" ? "Navegação" : group.type === "product" ? "Produtos" : "Vendas"}
                    </p>
                    <div className="grid gap-0.5">
                      {group.items.map(item => {
                        runningIdx += 1;
                        const idx = runningIdx;
                        const isSelected = idx === selectedIdx;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => go(item.href)}
                            onMouseEnter={() => setSelectedIdx(idx)}
                            className={cn(
                              "group w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-150 text-left",
                              isSelected ? "bg-primary/[0.08]" : "hover:bg-muted/40"
                            )}
                          >
                            <div className={cn(
                              "h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0 transition-colors duration-150 border",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/50 text-muted-foreground border-border/50"
                            )}>
                              <Icon className="h-4 w-4" strokeWidth={2.1} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-[13.5px] font-semibold truncate leading-tight",
                                isSelected ? "text-foreground" : "text-foreground/85"
                              )}>
                                {item.label}
                              </p>
                              {item.sub && (
                                <p className="text-[11px] font-medium text-muted-foreground/55 truncate mt-0.5 tabular-nums">
                                  {item.sub}
                                </p>
                              )}
                            </div>

                            <span className={cn(
                              "text-[10px] font-semibold uppercase tracking-wider shrink-0 transition-colors",
                              isSelected ? "text-primary" : "text-muted-foreground/35"
                            )}>
                              {TYPE_LABEL[item.type]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[220px] flex flex-col items-center justify-center text-center px-8">
                <div className="h-11 w-11 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <Search className="h-4.5 w-4.5 h-[18px] w-[18px] text-muted-foreground/40" />
                </div>
                <p className="text-[13px] font-semibold text-muted-foreground/70">Nada encontrado</p>
                <p className="text-[12px] text-muted-foreground/40 mt-1">Tente buscar por outro termo</p>
              </div>
            )}
          </div>

          {/* Rodapé com atalhos */}
          <div className="flex items-center gap-4 border-t border-border/50 px-5 h-11 bg-muted/30">
            <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground/60">
              <kbd className="flex h-5 w-5 items-center justify-center rounded border border-border/70 bg-card"><ArrowUp className="h-2.5 w-2.5" /></kbd>
              <kbd className="flex h-5 w-5 items-center justify-center rounded border border-border/70 bg-card"><ArrowDown className="h-2.5 w-2.5" /></kbd>
              navegar
            </span>
            <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground/60">
              <kbd className="flex h-5 w-5 items-center justify-center rounded border border-border/70 bg-card"><CornerDownLeft className="h-2.5 w-2.5" /></kbd>
              abrir
            </span>
            <span className="ml-auto text-[10.5px] font-medium text-muted-foreground/40 tabular-nums">
              {allItems.length} {allItems.length === 1 ? "resultado" : "resultados"}
            </span>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
