import { useEffect, useMemo, useState } from "react";
import {
  Power, ShieldAlert, FileDown, StickyNote, Save, Loader2, Database, Users, Banknote, CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PremiumPanel, PremiumMetric, PremiumMetricGrid, premiumTable } from "./AdminPremium";
import { logAdminAction } from "@/lib/auditLog";
import { friendlyError } from "@/lib/friendlyError";
import type { Json, Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export interface AdminToolsTabProps {
  transactions: Tables<"transactions">[];
  profiles: Tables<"profiles">[];
  withdrawals: Tables<"withdrawals">[];
}

interface KillSwitches {
  payments: boolean;
  withdrawals: boolean;
}

const DEFAULT_SWITCHES: KillSwitches = { payments: false, withdrawals: false };

/** Converte linhas em CSV com escape correto (aspas, vírgulas e quebras de linha). */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(";")),
  ].join("\n");
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    toast.error("Nada para exportar neste período.");
    return;
  }
  // BOM garante acentuação correta no Excel (pt-BR).
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${rows.length} registro(s) exportado(s).`);
}

export default function AdminToolsTab({ transactions, profiles, withdrawals }: AdminToolsTabProps) {
  const [switches, setSwitches] = useState<KillSwitches>(DEFAULT_SWITCHES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [noteSeller, setNoteSeller] = useState<string>("");
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [sellerQuery, setSellerQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "kill_switches")
        .maybeSingle();
      if (!active) return;
      if (!error && data?.value && typeof data.value === "object") {
        const v = data.value as Record<string, unknown>;
        setSwitches({ payments: v.payments === true, withdrawals: v.withdrawals === true });
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const persist = async (next: KillSwitches, changed: keyof KillSwitches) => {
    setSaving(true);
    const previous = switches;
    setSwitches(next); // atualização otimista, revertida em caso de erro
    const { error } = await supabase
      .from("platform_settings")
      .upsert([{ key: "kill_switches", value: next as unknown as Json }], { onConflict: "key" });
    setSaving(false);
    if (error) {
      setSwitches(previous);
      toast.error(friendlyError(error));
      return;
    }
    await logAdminAction(
      `kill_switch_${changed}_${next[changed] ? "on" : "off"}`,
      "platform_settings",
      "kill_switches",
      next as unknown as Record<string, never>,
    );
    toast.success(next[changed] ? "Operação pausada." : "Operação reativada.");
  };

  const sellers = useMemo(() => {
    const q = sellerQuery.trim().toLowerCase();
    const list = profiles.filter((p) => !q || `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q));
    return list.slice(0, 40);
  }, [profiles, sellerQuery]);

  const saveNote = async () => {
    if (!noteSeller || noteText.trim().length < 3) {
      toast.error("Selecione um seller e escreva a nota.");
      return;
    }
    setNoteSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setNoteSaving(false);
      toast.error("Sessão expirada.");
      return;
    }
    const { error } = await supabase.from("seller_notes").insert({
      seller_user_id: noteSeller,
      author_user_id: auth.user.id,
      author_role: "admin",
      content: noteText.trim(),
    });
    setNoteSaving(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    await logAdminAction("seller_note_created", "seller_notes", noteSeller);
    setNoteText("");
    toast.success("Nota registrada.");
  };

  const nameOf = (id: string | null) =>
    profiles.find((p) => p.user_id === id)?.full_name || profiles.find((p) => p.user_id === id)?.email || "—";

  const exportTransactions = () =>
    downloadCsv(
      `transacoes-${new Date().toISOString().slice(0, 10)}.csv`,
      transactions.map((t) => ({
        id: t.id,
        criado_em: t.created_at,
        status: t.status,
        valor: t.amount,
        liquido: t.net_amount ?? "",
        seller: nameOf(t.user_id),
        cliente: t.customer_name ?? "",
        email: t.customer_email ?? "",
        documento: t.customer_document ?? "",
        metodo: t.payment_method ?? "",
      })),
    );

  const exportSellers = () =>
    downloadCsv(
      `sellers-${new Date().toISOString().slice(0, 10)}.csv`,
      profiles.map((p) => ({
        id: p.id,
        nome: p.full_name ?? "",
        email: p.email ?? "",
        documento: p.document_number ?? "",
        telefone: p.phone ?? "",
        status: p.account_status ?? "",
        criado_em: p.created_at,
      })),
    );

  const exportWithdrawals = () =>
    downloadCsv(
      `saques-${new Date().toISOString().slice(0, 10)}.csv`,
      withdrawals.map((w) => ({
        id: w.id,
        criado_em: w.created_at,
        seller: nameOf(w.user_id),
        valor: w.amount,
        taxa: w.fee_amount ?? "",
        liquido: w.net_amount ?? "",
        status: w.status,
        metodo: w.withdrawal_type ?? "",
      })),
    );

  return (
    <div className="space-y-5">
      <PremiumMetricGrid cols={4}>
        <PremiumMetric label="Transações" value={String(transactions.length)} icon={CreditCard} tone="primary" sub="no período carregado" />
        <PremiumMetric label="Sellers" value={String(profiles.length)} icon={Users} tone="info" sub="cadastrados" />
        <PremiumMetric label="Saques" value={String(withdrawals.length)} icon={Banknote} tone="warning" sub="no período carregado" />
        <PremiumMetric
          label="Kill switches"
          value={`${Number(switches.payments) + Number(switches.withdrawals)} ativo(s)`}
          icon={Power}
          tone={switches.payments || switches.withdrawals ? "destructive" : "success"}
          sub={switches.payments || switches.withdrawals ? "operação restrita" : "tudo liberado"}
        />
      </PremiumMetricGrid>

      <PremiumPanel title="Kill switches" eyebrow="Controle de emergência" icon={ShieldAlert}>
        <div className="divide-y divide-border/40">
          {([
            {
              key: "payments" as const,
              title: "Pausar geração de PIX",
              desc: "Bloqueia novas cobranças em links de pagamento, checkout e PIX rápido (HTTP 503).",
            },
            {
              key: "withdrawals" as const,
              title: "Pausar solicitações de saque",
              desc: "Impede novos pedidos de saque no painel do seller. Saques em fila continuam processáveis.",
            },
          ]).map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{item.desc}</p>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                {switches[item.key] && (
                  <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                    Pausado
                  </span>
                )}
                <Switch
                  checked={switches[item.key]}
                  disabled={loading || saving}
                  onCheckedChange={(checked) => persist({ ...switches, [item.key]: checked }, item.key)}
                  aria-label={item.title}
                />
              </div>
            </div>
          ))}
        </div>
      </PremiumPanel>

      <PremiumPanel title="Exportações" eyebrow="Dados" icon={FileDown}>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {[
            { label: "Transações", count: transactions.length, onClick: exportTransactions, icon: CreditCard },
            { label: "Sellers", count: profiles.length, onClick: exportSellers, icon: Users },
            { label: "Saques", count: withdrawals.length, onClick: exportWithdrawals, icon: Banknote },
          ].map((x) => (
            <button
              key={x.label}
              onClick={x.onClick}
              className={cn(
                "flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-3.5 text-left",
                "transition-colors hover:border-border hover:bg-muted/30",
              )}
            >
              <span>
                <span className="block text-sm font-semibold text-foreground">{x.label}</span>
                <span className="block text-[11px] tabular-nums text-muted-foreground">{x.count} registro(s) · CSV</span>
              </span>
              <x.icon className="h-4 w-4 shrink-0 opacity-40" />
            </button>
          ))}
        </div>
      </PremiumPanel>

      <PremiumPanel title="Notas internas por seller" eyebrow="Operação" icon={StickyNote}>
        <div className="space-y-4 p-5">
          <Input
            value={sellerQuery}
            onChange={(e) => setSellerQuery(e.target.value)}
            placeholder="Buscar seller por nome ou e-mail…"
          />
          <div className={premiumTable.wrapper} style={{ maxHeight: 220, overflowY: "auto" }}>
            <table className={premiumTable.table}>
              <tbody>
                {sellers.map((p) => (
                  <tr
                    key={p.id}
                    className={cn(premiumTable.row, "cursor-pointer", noteSeller === p.user_id && "bg-primary/5")}
                    onClick={() => setNoteSeller(p.user_id)}
                  >
                    <td className="px-5 py-2.5 text-sm text-foreground">{p.full_name || "—"}</td>
                    <td className="px-5 py-2.5 text-[12px] text-muted-foreground">{p.email}</td>
                    <td className="px-5 py-2.5 text-right text-[11px] font-semibold text-primary">
                      {noteSeller === p.user_id ? "selecionado" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Nota interna (visível apenas para admins e gerentes)…"
            rows={3}
          />
          <Button onClick={saveNote} disabled={noteSaving}>
            {noteSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar nota
          </Button>
        </div>
      </PremiumPanel>

      <p className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
        <Database className="h-3.5 w-3.5 opacity-50" />
        Todas as ações desta aba são registradas na auditoria.
      </p>
    </div>
  );
}
