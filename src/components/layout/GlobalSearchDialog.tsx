import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
} from "lucide-react";

const PAGES = [
  { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { label: "Minhas Vendas", href: "/vendas", icon: DollarSign },
  { label: "Produtos", href: "/vendas/produtos", icon: Package },
  { label: "Checkout", href: "/vendas/checkout", icon: CreditCard },
  { label: "Conteúdo", href: "/vendas/conteudo", icon: Layers },
  { label: "Extrato", href: "/financeiro/extrato", icon: FileText },
  { label: "Saques", href: "/financeiro/saques", icon: ArrowDownToLine },
  { label: "Dados Bancários", href: "/financeiro/dados-bancarios", icon: Building2 },
  { label: "Webhooks", href: "/vendas/webhooks", icon: Webhook },
  { label: "Meu Perfil", href: "/perfil", icon: User },
  { label: "API Docs", href: "/vendas/documentacao", icon: BookOpen },
  { label: "Minhas Compras", href: "/membros", icon: GraduationCap },
];

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

  const search = useCallback(async (q: string) => {
    if (!user?.id || q.length < 2) { setResults([]); return; }

    const term = `%${q}%`;
    const [prodRes, txRes] = await Promise.all([
      supabase.from("products").select("id, name, price, checkout_url").eq("user_id", user.id).ilike("name", term).limit(5),
      supabase.from("transactions").select("id, customer_name, customer_email, amount, status").eq("user_id", user.id).or(`customer_name.ilike.${term},customer_email.ilike.${term}`).limit(5),
    ]);

    const items: SearchResult[] = [];
    prodRes.data?.forEach(p => items.push({
      id: p.id,
      label: p.name,
      sub: `Produto • R$ ${Number(p.price).toFixed(2)}`,
      href: "/vendas/produtos",
      icon: Package,
    }));
    txRes.data?.forEach(t => items.push({
      id: t.id,
      label: t.customer_name || t.customer_email || "Cliente",
      sub: `${t.status === "completed" ? "Aprovada" : t.status} • R$ ${Number(t.amount).toFixed(2)}`,
      href: "/vendas",
      icon: Users,
    }));

    setResults(items);
  }, [user?.id]);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const go = (href: string) => {
    onOpenChange(false);
    navigate(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar produtos, clientes, páginas..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {results.length > 0 && (
          <CommandGroup heading="Resultados">
            {results.map(r => (
              <CommandItem key={r.id} onSelect={() => go(r.href)} className="cursor-pointer">
                <r.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{r.sub}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Páginas">
          {PAGES.filter(p => !query || p.label.toLowerCase().includes(query.toLowerCase())).map(p => (
            <CommandItem key={p.href} onSelect={() => go(p.href)} className="cursor-pointer">
              <p.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{p.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
