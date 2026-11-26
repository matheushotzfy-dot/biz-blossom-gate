import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, IdCard, Loader2, Lock, MessageSquareText, Percent, RefreshCw, ShieldAlert, User, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogBody, DialogHead, FormField, dialogBox, tabListClass, tabTriggerClass } from "@/components/seller-ui/form";
import { useReason } from "@/components/seller-ui/confirm";
import { cn } from "@/lib/utils";
import { KycReviewPanel, type Decision } from "@/features/kyc/KycReviewPanel";
import { kycReviewKey } from "@/features/kyc/useKycReview";
import { ACCOUNT_STATUS_LABEL, formatPhone, reviewActionError } from "@/features/kyc/kycReviewModel";
import {
  DISPUTE_TYPE, WITHDRAWAL_STATUS, checkFees, day, dayTime, disputeStatus, int, money, parseSellerDetail, staffError,
  type FeeForm, type Portfolio, type SellerDetail,
} from "./staffPanelModel";

type Tab = "resumo" | "verificacao" | "taxas" | "saques" | "disputas" | "notas";

const TONE = { success: "bg-success/15 text-success", warning: "bg-warning/15 text-warning", destructive: "bg-destructive/10 text-destructive", neutral: "bg-muted text-muted-foreground" } as const;
function Tag({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-semibold leading-none", TONE[tone])}>{children}</span>;
}
const statusTone = (s: string): keyof typeof TONE => (s === "approved" ? "success" : s === "rejected" || s === "blocked" ? "destructive" : s === "pending_review" ? "warning" : "neutral");

/** Ficha de um seller da carteira. Cada aba só aparece com a permissão que a libera; o servidor confere tudo de novo. */
export function SellerSheet({ sellerId, portfolio, onClose, onChanged }: { sellerId: string | null; portfolio: Portfolio | null; onClose: () => void; onChanged: () => void }) {
  const [last, setLast] = useState<string | null>(sellerId);
  useEffect(() => { if (sellerId) setLast(sellerId); }, [sellerId]);
  const id = sellerId ?? last;
  return (
    <Dialog open={!!sellerId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={dialogBox("wide")}>
        {id && portfolio && <Body key={id} id={id} portfolio={portfolio} onChanged={onChanged} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ id, portfolio, onChanged }: { id: string; portfolio: Portfolio; onChanged: () => void }) {
  const f = portfolio.flags;
  const q = useQuery({
    queryKey: ["staff-seller", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_staff_seller_detail", { _seller: id });
      if (error) throw error;
      return parseSellerDetail(data);
    },
  });
  const d = q.data;
  const tabs: { id: Tab; label: string; icon: typeof User; show: boolean }[] = [
    { id: "resumo", label: "Resumo", icon: User, show: true },
    { id: "verificacao", label: "Verificação", icon: IdCard, show: f.approveKyc || f.rejectKyc },
    { id: "taxas", label: "Taxas", icon: Percent, show: f.editFees },
    { id: "saques", label: "Saques", icon: Wallet, show: f.freezeWithdrawals || f.viewWithdrawals },
    { id: "disputas", label: "Disputas", icon: ShieldAlert, show: f.viewDisputes },
    { id: "notas", label: "Observações", icon: MessageSquareText, show: f.editNotes },
  ];
  const visible = tabs.filter((t) => t.show);
  const [tab, setTab] = useState<Tab>(() => (d?.seller.status === "pending_review" && (f.approveKyc || f.rejectKyc) ? "verificacao" : "resumo"));
  useEffect(() => { if (d?.seller.status === "pending_review" && (f.approveKyc || f.rejectKyc) && tab === "resumo") setTab("verificacao"); }, [d?.seller.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = d?.seller.name ?? portfolio.sellers.find((s) => s.id === id)?.name ?? portfolio.kycQueue.find((k) => k.id === id)?.name ?? "Seller";
  const changed = () => { void q.refetch(); onChanged(); };

  return (
    <>
      <DialogHead icon={<User className="h-5 w-5" />} title={name}
        subtitle={d ? <span className="inline-flex flex-wrap items-center gap-2">{d.seller.email ?? "Sem e-mail"}<Tag tone={statusTone(d.seller.status)}>{ACCOUNT_STATUS_LABEL[d.seller.status] ?? d.seller.status}</Tag></span> : "Ficha do seller"} />
      <DialogBody>
        {q.isPending ? (
          <p className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Abrindo a ficha…</p>
        ) : q.isError || !d ? (
          <div role="alert" className="flex flex-col items-start gap-3 py-6">
            <p className="text-[14px] font-semibold text-foreground">Não foi possível abrir este seller.</p>
            <p className="text-[13px] text-muted-foreground">{staffError(q.error)} Se ele saiu da sua carteira, atualize a lista.</p>
            <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold" style={{ border: "1px solid hsl(var(--border))" }} onClick={() => void q.refetch()}><RefreshCw className="h-3.5 w-3.5" />Tentar de novo</button>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            {visible.length > 1 && (
              <TabsList className={tabListClass}>
                {visible.map((t) => <TabsTrigger key={t.id} value={t.id} className={tabTriggerClass}><t.icon className="h-4 w-4" />{t.label}</TabsTrigger>)}
              </TabsList>
            )}
            <TabsContent value="resumo" className="mt-5"><Summary d={d} canSee={f.viewSellers} /></TabsContent>
            {(f.approveKyc || f.rejectKyc) && <TabsContent value="verificacao" className="mt-5"><Verification d={d} onChanged={changed} /></TabsContent>}
            {f.editFees && <TabsContent value="taxas" className="mt-5"><Fees d={d} portfolio={portfolio} onChanged={changed} /></TabsContent>}
            {(f.freezeWithdrawals || f.viewWithdrawals) && <TabsContent value="saques" className="mt-5"><Withdrawals d={d} canBlock={f.freezeWithdrawals} onChanged={changed} /></TabsContent>}
            {f.viewDisputes && <TabsContent value="disputas" className="mt-5"><Disputes d={d} /></TabsContent>}
            {f.editNotes && <TabsContent value="notas" className="mt-5"><Notes d={d} onChanged={changed} /></TabsContent>}
          </Tabs>
        )}
      </DialogBody>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-[14px] text-foreground">{children}</dd>
    </div>
  );
}

function Summary({ d, canSee }: { d: SellerDetail; canSee: boolean }) {
  const s = d.seller;
  return (
    <div className="space-y-6">
      {s.status === "rejected" && s.rejectionReason && <p className="rounded-[12px] bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">Verificação reprovada: {s.rejectionReason}</p>}
      {s.balanceFrozen && <p className="flex items-center gap-2 rounded-[12px] bg-warning/10 px-3.5 py-2.5 text-[13px] font-medium text-warning"><Lock className="h-4 w-4" aria-hidden />O dono congelou o saldo deste seller.</p>}
      <section aria-labelledby="sum-since">
        <h3 id="sum-since" className="mb-3 text-[14px] font-semibold text-foreground">Desde que entrou na sua carteira ({day(d.assignedAt)})</h3>
        <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
          <Row label="Vendas pagas"><span className="text-[20px] font-semibold tabular-nums">{int(d.stats.sales)}</span></Row>
          <Row label="Volume pago"><span className="text-[20px] font-semibold tabular-nums">{money(d.stats.volume)}</span></Row>
          <Row label="Líquido do seller"><span className="text-[20px] font-semibold tabular-nums">{money(d.stats.net)}</span></Row>
          <Row label="Tentativas"><span className="text-[20px] font-semibold tabular-nums">{int(d.stats.attempts)}</span></Row>
        </dl>
        <p className="mt-2 text-[12.5px] text-muted-foreground">{d.stats.lastSaleAt ? `Última venda paga em ${dayTime(d.stats.lastSaleAt)}.` : "Nenhuma venda paga desde o vínculo."}</p>
      </section>
      <section aria-labelledby="sum-acc">
        <h3 id="sum-acc" className="mb-3 text-[14px] font-semibold text-foreground">Conta</h3>
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label="E-mail">{s.email ?? "Não informado"}</Row>
          <Row label="Conta criada">{dayTime(s.createdAt)}</Row>
          {canSee ? (
            <>
              <Row label="Telefone">{formatPhone(s.phone) ?? "Não informado"}</Row>
              <Row label={s.documentType === "cnpj" ? "CNPJ" : "CPF"}><span className="tabular-nums">{s.documentMasked ?? "Não informado"}</span></Row>
              <Row label="Último acesso">{dayTime(s.lastLoginAt)}</Row>
            </>
          ) : (
            <p className="text-[12.5px] text-muted-foreground sm:col-span-2">Telefone, documento e último acesso aparecem com a permissão "Ver dados dos sellers".</p>
          )}
        </dl>
      </section>
    </div>
  );
}

function Verification({ d, onChanged }: { d: SellerDetail; onChanged: () => void }) {
  const qc = useQueryClient();
  const id = d.seller.id;
  if (d.seller.status !== "pending_review") {
    return (
      <p className="py-4 text-[14px] text-muted-foreground">
        {d.seller.status === "pending" ? "O seller ainda não enviou os documentos para análise."
          : d.seller.status === "approved" ? "Verificação aprovada."
            : d.seller.status === "rejected" ? "Reprovada. Espera o seller trocar os documentos e enviar de novo."
              : "A verificação não está em análise."}
      </p>
    );
  }
  const decide = async (kind: Decision, why: string): Promise<string | null> => {
    const approve = kind === "approve";
    const { error } = await supabase.rpc("staff_review_kyc", { _seller: id, _approve: approve, _reason: approve ? undefined : why });
    if (error) return reviewActionError(error);
    toast.success(approve ? "Verificação aprovada. O seller foi avisado." : "Verificação reprovada. O seller recebeu o motivo.");
    void qc.invalidateQueries({ queryKey: kycReviewKey(id), refetchType: "none" });
    onChanged();
    return null;
  };
  return <KycReviewPanel sellerId={id} onDecide={decide} />;
}

const asText = (n: number | null) => (n === null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function Fees({ d, portfolio, onChanged }: { d: SellerDetail; portfolio: Portfolio; onChanged: () => void }) {
  const lim = portfolio.feeLimits;
  const [form, setForm] = useState<FeeForm>({ pct: asText(d.fees?.pct ?? null), fixed: asText(d.fees?.fixed ?? null), withdrawal: asText(d.fees?.withdrawal ?? null) });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = checkFees(form, lim);
  const show = tried ? check.errors : {};

  const save = async () => {
    setTried(true); setError(null);
    if (!check.values || busy) return;
    setBusy(true);
    try {
      const { error: e } = await supabase.rpc("set_staff_seller_fees", { _seller: d.seller.id, _percentage: check.values.pct, _fixed: check.values.fixed, _withdrawal: check.values.withdrawal });
      if (e) { setError(staffError(e)); return; }
      toast.success("Taxas do seller atualizadas.");
      onChanged();
    } finally { setBusy(false); }
  };

  const field = (k: keyof FeeForm, label: string, hint: string, suffix: string) => (
    <FormField id={`fee-${k}`} label={label} hint={hint} error={show[k] ?? null}>
      <div className="relative">
        <input id={`fee-${k}`} inputMode="decimal" value={form[k]} onChange={(e) => { setForm((s) => ({ ...s, [k]: e.target.value })); setError(null); }}
          aria-invalid={!!show[k] || undefined} className="vp-field vp-field-lg tabular-nums" style={{ paddingRight: 44 }} placeholder="0,00" />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">{suffix}</span>
      </div>
    </FormField>
  );

  return (
    <div className="space-y-5">
      <p className="text-[13.5px] leading-relaxed text-muted-foreground">
        A taxa de saque passa a valer no próximo saque do seller. As taxas de venda ficam gravadas na conta dele; hoje a plataforma ainda não cobra vendas.
        {lim ? ` Seu piso: ${lim.pct.toLocaleString("pt-BR")}% + ${money(lim.fixed)} por venda e ${money(lim.withdrawal)} por saque.` : ""}
      </p>
      {!lim && <p role="alert" className="rounded-[12px] bg-warning/10 px-3.5 py-2.5 text-[13px] font-medium text-warning">O dono ainda não definiu o seu piso de taxas, então o servidor recusa qualquer mudança.</p>}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
        {field("pct", "Taxa da venda", "Percentual sobre cada venda", "%")}
        {field("fixed", "Taxa fixa da venda", "Em reais, por venda", "R$")}
        {field("withdrawal", "Taxa de saque", "Em reais, por saque", "R$")}
      </div>
      {d.fees?.updatedAt && <p className="text-[12.5px] text-muted-foreground">Última mudança em {dayTime(d.fees.updatedAt)}{d.fees.byMe ? ", feita por você" : ""}.</p>}
      {error && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
      <button type="button" onClick={() => void save()} disabled={busy || !lim} className="vp-cta vp-r12 h-11 px-5">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Salvar taxas
      </button>
    </div>
  );
}

function Withdrawals({ d, canBlock, onChanged }: { d: SellerDetail; canBlock: boolean; onChanged: () => void }) {
  const { ask, dialog } = useReason();
  const [busy, setBusy] = useState(false);
  const b = d.withdrawalBlock;

  const block = async () => {
    const reason = await ask({
      title: "Bloquear os saques deste seller?",
      description: "Novos saques ficam bloqueados para análise. Login, vendas e saldo continuam iguais, e o seller recebe um aviso. Só o dono libera.",
      label: "Motivo", placeholder: "O que você está analisando", minLength: 5, confirmLabel: "Bloquear saques", tone: "danger",
    });
    if (!reason) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_seller_withdrawal_block", { _seller: d.seller.id, _block: true, _reason: reason.trim() });
      if (error) { toast.error(staffError(error)); return; }
      toast.success("Saques bloqueados para análise. O saldo continua do seller.");
      onChanged();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {b && (
        <section aria-labelledby="wd-block" className="rounded-[14px] px-4 py-4" style={{ border: "1px solid hsl(var(--border))" }}>
          <h3 id="wd-block" className="text-[14px] font-semibold text-foreground">Bloqueio de saques para análise</h3>
          {b.active ? (
            <div className="mt-2 space-y-1.5 text-[13.5px]">
              <p className="flex items-center gap-2 font-semibold text-destructive"><Ban className="h-4 w-4" aria-hidden />Saques bloqueados{b.byMe ? " por você" : ""}</p>
              {b.reason && <p className="text-foreground">Motivo: {b.reason}</p>}
              <p className="text-muted-foreground">Desde {dayTime(b.updatedAt)}. Só o dono libera.</p>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13.5px] text-muted-foreground">Sem bloqueio. O seller saca normalmente.</p>
              {canBlock && <button type="button" onClick={() => void block()} disabled={busy} className="vp-cta vp-cta-danger vp-r12 !h-10 px-4 text-[13.5px]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}Bloquear saques</button>}
            </div>
          )}
        </section>
      )}
      {d.withdrawals && (
        <section aria-labelledby="wd-list">
          <h3 id="wd-list" className="mb-2.5 text-[14px] font-semibold text-foreground">Últimos saques desde o vínculo</h3>
          {d.withdrawals.length === 0 ? <p className="text-[13px] text-muted-foreground">Nenhum saque.</p> : (
            <ul className="m-0 space-y-1.5 p-0" style={{ listStyle: "none" }}>
              {d.withdrawals.map((w) => {
                const st = WITHDRAWAL_STATUS[w.status] ?? { label: w.status, tone: "neutral" as const };
                return (
                  <li key={w.id} className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5" style={{ border: "1px solid hsl(var(--border) / .7)" }}>
                    <span className="text-[13px] text-muted-foreground">{dayTime(w.createdAt)}</span>
                    <span className="flex items-center gap-3"><span className="text-[14px] font-semibold tabular-nums">{money(w.amount)}</span><Tag tone={st.tone}>{st.label}</Tag></span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {dialog}
    </div>
  );
}

function Disputes({ d }: { d: SellerDetail }) {
  const list = d.disputes ?? [];
  if (list.length === 0) return <p className="py-4 text-[14px] text-muted-foreground">Nenhuma disputa desde que o seller entrou na sua carteira.</p>;
  return (
    <ul className="m-0 space-y-1.5 p-0" style={{ listStyle: "none" }}>
      {list.map((x) => {
        const st = disputeStatus(x.status);
        return (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] px-3 py-2.5" style={{ border: "1px solid hsl(var(--border) / .7)" }}>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-foreground">{DISPUTE_TYPE[x.type] ?? "Disputa"}</span>
              <span className="block text-[12.5px] text-muted-foreground">Aberta em {dayTime(x.createdAt)}{x.deadline ? `, prazo ${dayTime(x.deadline)}` : ""}</span>
            </span>
            <span className="flex items-center gap-3"><span className="text-[14px] font-semibold tabular-nums">{money(x.amount)}</span><Tag tone={st.tone}>{st.label}</Tag></span>
          </li>
        );
      })}
    </ul>
  );
}

function Notes({ d, onChanged }: { d: SellerDetail; onChanged: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = text.trim();

  const add = async () => {
    if (busy) return;
    if (clean.length < 3) { setError("Escreva pelo menos 3 caracteres."); return; }
    setBusy(true); setError(null);
    try {
      const { error: e } = await supabase.from("seller_notes").insert({ seller_user_id: d.seller.id, author_user_id: user?.id ?? "", content: clean });
      if (e) { setError(staffError(e)); return; }
      setText("");
      onChanged();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <p className="text-[13.5px] text-muted-foreground">Só a equipe e o dono leem. O seller nunca vê. Você vê as observações feitas depois que o seller entrou na sua carteira.</p>
      <div>
        <label htmlFor="staff-note" className="sr-only">Nova observação</label>
        <textarea id="staff-note" value={text} onChange={(e) => { setText(e.target.value); setError(null); }} maxLength={2000} rows={3}
          placeholder="O que vale a equipe saber sobre este seller" className="w-full resize-y rounded-[12px] bg-background px-3.5 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          style={{ border: `1px solid hsl(var(--${error ? "destructive" : "border"}))` }} />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[12px] tabular-nums text-muted-foreground">{clean.length}/2000</span>
          <button type="button" onClick={() => void add()} disabled={busy} className="vp-cta vp-r12 h-10 px-4 text-[13.5px]">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Adicionar observação</button>
        </div>
        {error && <p role="alert" className="mt-1 text-[13px] font-medium text-destructive">{error}</p>}
      </div>
      {(d.notes ?? []).length === 0 ? <p className="text-[13px] text-muted-foreground">Nenhuma observação ainda.</p> : (
        <ul className="m-0 space-y-2 p-0" style={{ listStyle: "none" }}>
          {(d.notes ?? []).map((n) => (
            <li key={n.id} className="rounded-[12px] px-3.5 py-3" style={{ border: "1px solid hsl(var(--border) / .7)" }}>
              <p className="whitespace-pre-wrap break-words text-[14px] text-foreground">{n.content}</p>
              <p className="mt-1.5 text-[12px] text-muted-foreground">{n.mine ? "Você" : n.author}, {dayTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
