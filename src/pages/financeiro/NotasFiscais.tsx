import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useQueryData";
import { PageShell, PageTitle, Panel } from "@/components/PageShell";
import { FileText, Download, CheckCircle2, Clock, AlertCircle, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

type InvoiceStatus = "emitida" | "pendente" | "erro";

const STATUS_MAP: Record<InvoiceStatus, { label: string; color: string; icon: typeof Clock }> = {
  emitida: { label: "Emitida", color: "text-success", icon: CheckCircle2 },
  pendente: { label: "Pendente", color: "text-warning", icon: Clock },
  erro: { label: "Erro", color: "text-destructive", icon: AlertCircle },
};

export default function NotasFiscais() {
  const { user } = useAuth();
  const { data: transactions = [] } = useTransactions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [autoEmit, setAutoEmit] = useState(false);

  // Generate mock NF-e data from real transactions
  const invoices = useMemo(() => {
    return transactions
      .filter((t) => t.status === "completed")
      .map((t, i) => ({
        id: t.id,
        number: `NF-${String(i + 1).padStart(6, "0")}`,
        customer: t.customer_name || "Cliente",
        email: t.customer_email || "",
        document: t.customer_document || "",
        amount: Number(t.amount),
        date: t.created_at,
        status: (i % 5 === 0 ? "pendente" : "emitida") as InvoiceStatus,
        product: "Produto Digital",
      }))
      .filter((inv) => {
        if (statusFilter !== "all" && inv.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            inv.customer.toLowerCase().includes(q) ||
            inv.number.toLowerCase().includes(q) ||
            inv.email.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [transactions, search, statusFilter]);

  const stats = useMemo(() => {
    const all = transactions.filter((t) => t.status === "completed");
    return {
      total: all.length,
      emitidas: Math.floor(all.length * 0.9),
      pendentes: Math.ceil(all.length * 0.1),
      volume: all.reduce((s, t) => s + Number(t.amount), 0),
    };
  }, [transactions]);

  return (
    <PageShell>
      <PageTitle
        icon={<FileText className="h-6 w-6" />}
        title="Notas Fiscais"
        subtitle="Emissão e gestão de NF-e para suas vendas"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total NF-e", value: stats.total, color: "text-foreground" },
          { label: "Emitidas", value: stats.emitidas, color: "text-success" },
          { label: "Pendentes", value: stats.pendentes, color: "text-warning" },
          {
            label: "Volume Faturado",
            value: `R$ ${stats.volume.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            color: "text-primary",
          },
        ].map((kpi) => (
          <Panel key={kpi.label} className="text-center py-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            <p className={cn("text-2xl font-display font-black mt-1", kpi.color)}>{kpi.value}</p>
          </Panel>
        ))}
      </div>

      {/* Settings */}
      <Panel className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">Emissão Automática</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Emitir NF-e automaticamente após cada venda aprovada
          </p>
        </div>
        <button
          onClick={() => setAutoEmit(!autoEmit)}
          className={cn(
            "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
            autoEmit ? "bg-primary" : "bg-muted/50"
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
              autoEmit ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </Panel>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, número ou e-mail..."
            className="w-full rounded-xl border border-border/50 bg-muted/30 pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "emitida", "pendente", "erro"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-xl px-4 py-2.5 text-xs font-bold transition",
                statusFilter === s
                  ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "all" ? "Todas" : STATUS_MAP[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <Panel className="py-16 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Nenhuma nota fiscal encontrada</p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {invoices.slice(0, 50).map((inv) => {
            const status = STATUS_MAP[inv.status];
            const StatusIcon = status.icon;
            return (
              <Panel key={inv.id} className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{inv.number}</span>
                    <span className="flex items-center gap-1">
                      <StatusIcon className={cn("h-3 w-3", status.color)} />
                      <span className={cn("text-[10px] font-bold uppercase", status.color)}>{status.label}</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {inv.customer} · {inv.document || "Sem CPF"} ·{" "}
                    {new Date(inv.date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <p className="text-sm font-black text-foreground whitespace-nowrap">
                  R$ {inv.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <button className="rounded-xl bg-muted/30 p-2 hover:bg-primary/10 transition" title="Baixar XML">
                  <Download className="h-4 w-4 text-muted-foreground" />
                </button>
              </Panel>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
