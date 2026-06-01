import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions, useProducts } from "@/hooks/useQueryData";
import {
  Search, EyeOff, Eye, Phone, Mail, Clock, Check,
  Download, FileText, ChevronDown, ChevronUp, ArrowUpDown, ArrowUpRight, ArrowDownRight,
  CreditCard, ShoppingCart, MessageCircle, Filter, Zap, LayoutGrid, List as ListIcon,
  Plus, History, BarChart3, TrendingUp, Wallet
} from "lucide-react";
import { TransactionDetailPanel } from "@/components/transactions/TransactionDetailPanel";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { StatCard } from "@/components/StatCard";

const fmt = (v: number) => v === 0 ? "R$ 0,00" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  completed: { label: "Aprovada", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dot: "bg-emerald-500" },
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20", dot: "bg-amber-500" },
  failed: { label: "Falha", cls: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
  expired: { label: "Expirada", cls: "bg-muted text-muted-foreground border-border/60", dot: "bg-muted-foreground/50" },
  refunded: { label: "Reembolso", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20", dot: "bg-blue-500" },
  chargeback: { label: "Chargeback", cls: "bg-red-500/10 text-red-500 border-red-500/20", dot: "bg-red-500" },
};

const METHODS_MAP: Record<string, { label: string; icon: any }> = {
  pix: { label: "Pix", icon: Zap },
  credit_card: { label: "Cartão", icon: CreditCard },
  card: { label: "Cartão", icon: CreditCard },
  boleto: { label: "Boleto", icon: FileText },
};

export default function Vendas() {
  const { user } = useAuth();
  const { data: transactions = [] } = useTransactions();
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState("");
  const [detailTx, setDetailTx] = useState<Tables<"transactions"> | null>(null);
  const [privacyHidden, setPrivacyHidden] = useState(() => localStorage.getItem("privacy_mode") === "true");

  const togglePrivacy = () => {
    setPrivacyHidden(prev => {
      const next = !prev;
      localStorage.setItem("privacy_mode", String(next));
      return next;
    });
  };

  const prodsMap = useMemo(() => {
    const m: Record<string, string> = {};
    products.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.customer_name?.toLowerCase().includes(q) ||
        t.customer_email?.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [transactions, search]);

  const stats = useMemo(() => {
    const approved = transactions.filter(t => t.status === "completed");
    const revenue = approved.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const gross = approved.reduce((acc, t) => acc + Number(t.amount), 0);
    return {
      count: approved.length,
      revenue,
      gross,
      avg: approved.length > 0 ? revenue / approved.length : 0
    };
  }, [transactions]);

  const CENSORED = "••••••";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight">Minhas Vendas</h1>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-primary" />
            Gestão completa de transações e recebíveis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={togglePrivacy}
            className="h-10 px-4 rounded-xl border-border/60 hover:bg-muted/50 font-bold text-xs uppercase tracking-wider gap-2"
          >
            {privacyHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            Privacidade
          </Button>
          <Button className="h-10 px-6 rounded-xl font-black text-xs uppercase tracking-widest gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Faturamento Líquido" 
          value={privacyHidden ? CENSORED : fmt(stats.revenue)} 
          icon={Wallet} 
          color="success" 
          description="Total após taxas"
        />
        <StatCard 
          title="Vendas Aprovadas" 
          value={stats.count} 
          icon={Check} 
          color="primary" 
          description="Pedidos concluídos"
        />
        <StatCard 
          title="Ticket Médio" 
          value={privacyHidden ? CENSORED : fmt(stats.avg)} 
          icon={BarChart3} 
          color="info" 
          description="Média por venda"
        />
        <StatCard 
          title="Volume Bruto" 
          value={privacyHidden ? CENSORED : fmt(stats.gross)} 
          icon={TrendingUp} 
          color="neutral" 
          description="Total processado"
        />
      </div>

      {/* Table Section */}
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/10 rounded-xl flex items-center justify-center text-primary">
              <ShoppingCart size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-black text-foreground tracking-tight leading-none">Transações</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                {filtered.length} Registros encontrados
              </p>
            </div>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
            <input 
              type="text" 
              placeholder="Buscar cliente, e-mail ou ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-11 pr-4 bg-muted/30 border border-border/60 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/30 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 border-b border-border/40">
                <th className="px-8 py-5">Cliente / Produto</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-center">Pagamento</th>
                <th className="px-8 py-5 text-right">Valor</th>
                <th className="px-8 py-5 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <ShoppingCart size={48} strokeWidth={1} />
                      <p className="mt-4 text-[11px] font-black uppercase tracking-widest">Nenhuma transação encontrada</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const status = STATUS_MAP[t.status] || STATUS_MAP.pending;
                  const method = METHODS_MAP[t.payment_method || ""] || { label: t.payment_method, icon: FileText };
                  const MethodIcon = method.icon;
                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => setDetailTx(t)}
                      className="hover:bg-muted/20 transition-colors group cursor-pointer"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 rounded-xl border border-border/40 shrink-0">
                            <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black uppercase">
                              {(t.customer_name || "C").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-foreground truncate">{t.customer_name || "Cliente"}</p>
                            <p className="text-[11px] font-bold text-muted-foreground/60 truncate">
                              {prodsMap[t.product_id || ""] || "Sem produto"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                            status.cls
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                            {status.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-center">
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-muted/40 border border-border/60 text-[10px] font-bold text-muted-foreground/80">
                            <MethodIcon className="h-3.5 w-3.5" />
                            {method.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <p className="text-sm font-black text-foreground tabular-nums tracking-tight">
                          {privacyHidden ? CENSORED : fmt(Number(t.amount))}
                        </p>
                        <p className="text-[10px] font-bold text-emerald-500 tabular-nums">
                          {privacyHidden ? CENSORED : `Líq: ${fmt(Number(t.net_amount))}`}
                        </p>
                      </td>
                      <td className="px-8 py-5 text-right leading-tight">
                        <div className="text-[11px] font-bold text-foreground">
                          {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="text-[10px] font-medium text-muted-foreground/50 mt-1 uppercase">
                          {format(new Date(t.created_at), "HH:mm'h'", { locale: ptBR })}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailTx && (
        <TransactionDetailPanel 
          tx={detailTx} 
          products={prodsMap}
          onClose={() => setDetailTx(null)} 
        />
      )}
    </div>
  );
}