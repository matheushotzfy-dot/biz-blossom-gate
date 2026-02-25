import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownToLine, Search, CheckCircle2, XCircle, Clock, Wallet, UserCog, ToggleLeft } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/auditLog";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { AdminPanel, PanelTitle, AdminKpi } from "./AdminOverviewTab";

interface AuditLog {
  id: string; admin_user_id: string; action: string; entity_id: string | null; created_at: string;
}

interface AutoWithdrawConfig {
  id: string; user_id: string; enabled: boolean; max_amount: number; admin_user_id: string;
}

interface Props {
  withdrawals: Tables<"withdrawals">[];
  profiles: Tables<"profiles">[];
  onWithdrawalAction: (id: string, action: "approved" | "rejected") => void;
  fmtCurrency: (v: number) => string;
}

export default function AdminWithdrawalsTab({ withdrawals, profiles, onWithdrawalAction, fmtCurrency }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [autoConfigs, setAutoConfigs] = useState<AutoWithdrawConfig[]>([]);
  const [autoConfigDialog, setAutoConfigDialog] = useState<string | null>(null);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoMaxAmount, setAutoMaxAmount] = useState("100");

  useEffect(() => {
    // Load audit logs for withdrawals
    supabase.from("audit_logs").select("id,admin_user_id,action,entity_id,created_at")
      .or("action.eq.approve_withdrawal,action.eq.reject_withdrawal")
      .order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => { if (data) setAuditLogs(data as AuditLog[]); });

    // Load per-seller auto-withdraw configs
    supabase.from("seller_auto_withdraw").select("*")
      .then(({ data }) => { if (data) setAutoConfigs(data as AutoWithdrawConfig[]); });
  }, []);

  const getAdminName = (adminUserId: string) => {
    const profile = profiles.find(p => p.user_id === adminUserId);
    return profile?.full_name || adminUserId.slice(0, 8);
  };

  const getWithdrawalAudit = (withdrawalId: string) => {
    return auditLogs.find(l => l.entity_id === withdrawalId);
  };

  const getSellerName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || "—";
  const getSellerEmail = (userId: string) => profiles.find(p => p.user_id === userId)?.email || "";
  const getSellerType = (userId: string) => profiles.find(p => p.user_id === userId)?.seller_type || null;
  const getAutoConfig = (userId: string) => autoConfigs.find(c => c.user_id === userId);

  const openAutoConfigDialog = (userId: string) => {
    const config = getAutoConfig(userId);
    setAutoEnabled(config?.enabled ?? false);
    setAutoMaxAmount(String(config?.max_amount ?? 100));
    setAutoConfigDialog(userId);
  };

  const saveAutoConfig = async () => {
    if (!autoConfigDialog || !user) return;
    const payload = {
      user_id: autoConfigDialog,
      enabled: autoEnabled,
      max_amount: Number(autoMaxAmount),
      admin_user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("seller_auto_withdraw")
      .upsert(payload as any, { onConflict: "user_id" });
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Config de auto-aprovação salva!");
    await logAdminAction("update_seller_auto_withdraw", "seller_auto_withdraw", autoConfigDialog, payload as any);
    setAutoConfigDialog(null);
    // Reload
    const { data } = await supabase.from("seller_auto_withdraw").select("*");
    if (data) setAutoConfigs(data as AutoWithdrawConfig[]);
  };

  const SellerTypeBadge = ({ type }: { type: string | null }) => {
    if (type === "black") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">B</span>;
    if (type === "white") return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-muted text-muted-foreground border border-border">W</span>;
    return <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-warning/10 text-warning border border-warning/20">?</span>;
  };

  const pending = withdrawals.filter(w => w.status === "pending");
  const approved = withdrawals.filter(w => w.status === "approved");
  const rejected = withdrawals.filter(w => w.status === "rejected");
  const totalPending = pending.reduce((a, w) => a + Number(w.amount), 0);
  const totalApproved = approved.reduce((a, w) => a + Number(w.amount), 0);
  const totalFees = withdrawals.reduce((a, w) => a + Number(w.fee_amount), 0);
  const autoEnabledCount = autoConfigs.filter(c => c.enabled).length;

  const filtered = withdrawals
    .filter(w => {
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return getSellerName(w.user_id).toLowerCase().includes(s) || w.id.includes(s);
    });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <AdminKpi icon={<ArrowDownToLine className="h-5 w-5" />} label="Total Saques" value={String(withdrawals.length)} sub="Todos" gradient="from-blue-500 to-indigo-600" glowColor="rgba(59,130,246,0.15)" />
        <AdminKpi icon={<Clock className="h-5 w-5" />} label="Pendentes" value={fmtCurrency(totalPending)} sub={`${pending.length} solicitações`} gradient="from-amber-500 to-orange-600" glowColor="rgba(245,158,11,0.15)" alert={pending.length > 0} />
        <AdminKpi icon={<CheckCircle2 className="h-5 w-5" />} label="Aprovados" value={fmtCurrency(totalApproved)} sub={`${approved.length} saques`} gradient="from-emerald-500 to-emerald-600" glowColor="rgba(52,211,153,0.15)" />
        <AdminKpi icon={<XCircle className="h-5 w-5" />} label="Recusados" value={String(rejected.length)} sub="Negados" gradient="from-red-500 to-rose-600" glowColor="rgba(239,68,68,0.15)" />
        <AdminKpi icon={<Wallet className="h-5 w-5" />} label="Taxas Coletadas" value={fmtCurrency(totalFees)} sub="De saques" gradient="from-violet-500 to-purple-600" glowColor="rgba(139,92,246,0.15)" highlight />
        <AdminKpi icon={<ToggleLeft className="h-5 w-5" />} label="Auto-Aprovar" value={`${autoEnabledCount} sellers`} sub="Configurados" gradient="from-cyan-500 to-teal-600" glowColor="rgba(6,182,212,0.15)" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input placeholder="Buscar vendedor..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-10 text-xs rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AdminPanel>
        <PanelTitle color="amber" icon={<ArrowDownToLine className="h-4 w-4" />}>Saques ({filtered.length})</PanelTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              {["ID", "Vendedor", "Tipo", "Valor Bruto", "Taxa", "Líquido", "Status", "Aprovado/Recusado por", "Auto", "Data", "Ações"].map(h => (
                <th key={h} className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(w => {
                const audit = getWithdrawalAudit(w.id);
                const autoConfig = getAutoConfig(w.user_id);
                return (
                  <tr key={w.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${w.status === "pending" ? "bg-warning/[0.03]" : ""}`}>
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">{w.id.slice(0, 8)}</td>
                    <td className="p-3">
                      <div>
                        <p className="text-xs font-bold text-foreground">{getSellerName(w.user_id)}</p>
                        <p className="text-[10px] text-muted-foreground">{getSellerEmail(w.user_id)}</p>
                      </div>
                    </td>
                    <td className="p-3"><SellerTypeBadge type={getSellerType(w.user_id)} /></td>
                    <td className="p-3 text-xs font-extrabold text-foreground">R$ {Number(w.amount).toFixed(2)}</td>
                    <td className="p-3 text-xs text-warning">R$ {Number(w.fee_amount).toFixed(2)}</td>
                    <td className="p-3 text-xs text-primary font-bold">R$ {Number(w.net_amount).toFixed(2)}</td>
                    <td className="p-3"><StatusBadge status={w.status} /></td>
                    <td className="p-3">
                      {audit ? (
                        <div>
                          <p className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                            <UserCog className="h-3 w-3 text-primary" />
                            {getAdminName(audit.admin_user_id)}
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            {new Date(audit.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {autoConfig?.enabled ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          Até R$ {autoConfig.max_amount}
                        </span>
                      ) : (
                        <button onClick={() => openAutoConfigDialog(w.user_id)} className="text-[9px] text-muted-foreground hover:text-foreground underline">
                          Configurar
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</td>
                    <td className="p-3">
                      {w.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-[11px] bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 gap-1 rounded-xl shadow-none" onClick={() => onWithdrawalAction(w.id, "approved")}>
                            <CheckCircle2 className="h-3 w-3" /> Aprovar
                          </Button>
                          <Button size="sm" className="h-7 text-[11px] bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 gap-1 rounded-xl shadow-none" onClick={() => onWithdrawalAction(w.id, "rejected")}>
                            <XCircle className="h-3 w-3" /> Recusar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={11} className="p-10 text-center text-muted-foreground text-xs">Nenhum saque</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {/* Auto-Withdraw Config Dialog */}
      <Dialog open={!!autoConfigDialog} onOpenChange={() => setAutoConfigDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ToggleLeft className="h-5 w-5 text-primary" />
              Auto-Aprovação para Seller
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{autoConfigDialog ? getSellerName(autoConfigDialog) : ""}</strong>
            </p>
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
              <div>
                <p className="text-sm font-semibold">Ativar Auto-Aprovação</p>
                <p className="text-xs text-muted-foreground">Saques deste seller serão auto-aprovados</p>
              </div>
              <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Limite máximo (R$)</Label>
              <Input type="number" step="1" value={autoMaxAmount} onChange={e => setAutoMaxAmount(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Acima desse valor, vai para aprovação manual</p>
            </div>
            <Button onClick={saveAutoConfig} className="w-full gap-2">
              <CheckCircle2 className="h-4 w-4" /> Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
