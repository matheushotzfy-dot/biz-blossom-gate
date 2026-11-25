/**
 * Coproduções: o dono convida outro produtor para dividir o valor líquido das vendas de um produto;
 * o convidado aceita ou recusa. A divisão em si roda no servidor (apply_transaction_splits) e só vale
 * para convites aceitos com a conta do parceiro vinculada (co_producer_user_id).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Handshake, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useProducts } from "@/hooks/useQueryData";
import { Seo } from "@/components/Seo";
import { Money } from "@/components/home/Money";
import { PageHead } from "@/components/seller-ui/PageHead";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { StatBand } from "@/components/seller-ui/StatBand";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { SearchField } from "@/components/seller-ui/SearchField";
import { EmptyPanel } from "@/components/seller-ui/EmptyPanel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CoLedger, type CoRow } from "@/components/marketing/CoLedger";
import { InviteDialog, type InviteSaveResult, type InviteTarget, type InviteValues } from "@/components/marketing/InviteDialog";
import { copyText } from "@/components/marketing/copy";
import {
  STATE_META, coErrorMessage, coState, directionOf, holdsProduct, partnerCode, yourPct, type CoDirection, type CoProduction, type CoState,
} from "@/components/marketing/coproMeta";

type DirFilter = "all" | CoDirection;
type StateFilter = "all" | CoState;
type Confirm = { kind: "cancel" | "end" | "reject" | "leave"; row: CoRow } | null;

interface PartnerProduct { id: string; name: string; price: number; image_url: string | null; display_name: string | null }

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export default function Coproducoes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { hidden } = usePrivacyMode();
  const { data: products = [], isLoading: loadingProducts } = useProducts();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [list, setList] = useState<CoProduction[]>([]);
  const [others, setOthers] = useState<Map<string, PartnerProduct>>(new Map());
  const [received, setReceived] = useState<number | null>(null);
  const [passed, setPassed] = useState<number | null>(null);

  const [dir, setDir] = useState<DirFilter>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [q, setQ] = useState("");
  const [invite, setInvite] = useState<InviteTarget | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const email = (user?.email ?? "").toLowerCase();

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(false);
    try {
      const mail = (user.email ?? "").toLowerCase();
      const [byOwner, byUser, byMail, ledger] = await Promise.all([
        supabase.from("co_productions").select("*").eq("owner_user_id", user.id),
        supabase.from("co_productions").select("*").eq("co_producer_user_id", user.id),
        mail ? supabase.from("co_productions").select("*").ilike("co_producer_email", escapeLike(mail)) : Promise.resolve({ data: [], error: null }),
        supabase.from("financial_ledger").select("entry_type, amount").eq("user_id", user.id).in("entry_type", ["split_credit", "split_debit"]).limit(5000),
      ]);
      if (byOwner.error || byUser.error || byMail.error) throw new Error("load");

      // O servidor já filtra por RLS; conferimos de novo aqui porque um admin enxerga tudo.
      const merged = new Map<string, CoProduction>();
      for (const row of [...(byOwner.data ?? []), ...(byUser.data ?? []), ...(byMail.data ?? [])] as unknown as CoProduction[]) {
        if (row.owner_user_id === user.id || row.co_producer_user_id === user.id || (row.co_producer_email ?? "").toLowerCase() === mail) merged.set(row.id, row);
      }
      const rows = [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
      setList(rows);

      if (ledger.error) { setReceived(null); setPassed(null); }
      else {
        const entries = (ledger.data ?? []) as Array<{ entry_type: string; amount: number }>;
        const sum = (t: string) => entries.filter((e) => e.entry_type === t).reduce((s, e) => s + Number(e.amount), 0);
        setReceived(sum("split_credit")); setPassed(sum("split_debit"));
      }

      // Produtos de outros produtores só aparecem pela vitrine pública (ativos).
      const foreign = [...new Set(rows.filter((r) => r.owner_user_id !== user.id).map((r) => r.product_id))];
      if (foreign.length > 0) {
        const { data } = await supabase.from("products_public").select("id, name, price, image_url, display_name").in("id", foreign);
        setOthers(new Map(((data ?? []) as unknown as PartnerProduct[]).map((x) => [x.id, x])));
      } else setOthers(new Map());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const ownById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const rows: CoRow[] = useMemo(() => {
    if (!user) return [];
    return list.map((cp) => {
      const d = directionOf(cp, user.id);
      const own = ownById.get(cp.product_id);
      const other = others.get(cp.product_id);
      return {
        cp, dir: d,
        productName: own?.name ?? other?.name ?? "Produto indisponível",
        productImage: own?.image_url ?? other?.image_url ?? null,
        productPrice: Number(own?.price ?? other?.price ?? 0),
        partner: d === "sent" ? cp.co_producer_email : other?.display_name || `Produtor ${partnerCode(cp.owner_user_id)}`,
        mine: yourPct(cp, d),
      };
    });
  }, [list, user, ownById, others]);

  const counts = useMemo(() => ({
    sent: rows.filter((r) => r.dir === "sent").length,
    received: rows.filter((r) => r.dir === "received").length,
    active: rows.filter((r) => coState(r.cp) === "active").length,
    pending: rows.filter((r) => r.cp.status === "pending").length,
    unlinked: rows.filter((r) => coState(r.cp) === "unlinked").length,
  }), [rows]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => (dir === "all" || r.dir === dir) && (state === "all" || coState(r.cp) === state) && (!term || r.partner.toLowerCase().includes(term) || r.productName.toLowerCase().includes(term)));
  }, [rows, dir, state, q]);

  const eligible = useMemo(() => {
    const busyProducts = new Set(list.filter((c) => c.owner_user_id === user?.id && holdsProduct(c)).map((c) => c.product_id));
    return products.filter((p) => p.status !== "draft" && !busyProducts.has(p.id)).map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }));
  }, [products, list, user]);

  /* ── Efeitos colaterais comuns ── */
  const refresh = async () => {
    void qc.invalidateQueries({ queryKey: ["products"], exact: false });
    await load();
  };

  /** Mantém os campos legados do produto em dia com o que existe de verdade em co_productions. */
  const syncProductFlags = async (productId: string) => {
    if (!user) return;
    const { data } = await supabase.from("co_productions").select("co_producer_email, split_percentage").eq("product_id", productId).eq("owner_user_id", user.id).in("status", ["pending", "accepted"]).order("created_at", { ascending: false }).limit(1);
    const h = ((data ?? []) as Array<{ co_producer_email: string; split_percentage: number }>)[0];
    await supabase.from("products").update(h ? { co_production_enabled: true, co_producer_email: h.co_producer_email, co_production_split: h.split_percentage } : { co_production_enabled: false, co_producer_email: null }).eq("id", productId).eq("user_id", user.id);
  };

  /* ── Convite: criar e alterar ── */
  const saveInvite = async (v: InviteValues): Promise<InviteSaveResult> => {
    if (!user || !invite) return { ok: false, message: "Sua sessão expirou. Entre de novo para continuar." };

    if (invite.mode === "edit") {
      const row = list.find((c) => c.product_id === invite.productId && c.owner_user_id === user.id && c.status === "pending");
      if (!row) return { ok: false, message: "Este convite já foi respondido. Atualize a página para ver a situação." };
      const { error } = await supabase.from("co_productions").update({ split_percentage: v.split }).eq("id", row.id).eq("owner_user_id", user.id).eq("status", "pending");
      if (error) return { ok: false, message: coErrorMessage(error, "Não foi possível alterar a divisão. Tente de novo.") };
      await syncProductFlags(row.product_id);
      await refresh();
      setInvite(null);
      toast.success("Divisão atualizada.");
      return { ok: true };
    }

    const own = ownById.get(v.productId);
    if (!own) return { ok: false, message: "Escolha um dos seus produtos." };
    const { data: dup, error: dupErr } = await supabase.from("co_productions").select("id").eq("product_id", v.productId).in("status", ["pending", "accepted"]);
    if (dupErr) return { ok: false, message: coErrorMessage(dupErr, "Não foi possível conferir o produto. Tente de novo.") };
    if ((dup ?? []).length > 0) return { ok: false, message: "Este produto já tem uma coprodução em andamento." };

    const { error } = await supabase.from("co_productions").insert({ product_id: v.productId, owner_user_id: user.id, co_producer_email: v.email, split_percentage: v.split });
    if (error) return { ok: false, message: coErrorMessage(error, "Não foi possível criar o convite. Tente de novo.") };
    await syncProductFlags(v.productId);
    await refresh();
    setInvite(null);
    toast.success("Convite criado. O parceiro vê em Coproduções ao entrar com esse e-mail.");
    return { ok: true };
  };

  /* ── Respostas do convidado ── */
  const accept = async (r: CoRow) => {
    if (!user || busyId) return;
    setBusyId(r.cp.id);
    const { error } = await supabase.from("co_productions").update({ status: "accepted", co_producer_user_id: user.id, accepted_at: new Date().toISOString() }).eq("id", r.cp.id);
    if (error) { setBusyId(null); toast.error(coErrorMessage(error, "Não foi possível aceitar o convite. Tente de novo.")); return; }
    const { data: back } = await supabase.from("co_productions").select("co_producer_user_id").eq("id", r.cp.id).maybeSingle();
    await load();
    setBusyId(null);
    if ((back as { co_producer_user_id: string | null } | null)?.co_producer_user_id) toast.success("Parceria aceita. Sua parte cai no saldo a cada venda aprovada.");
    else toast.warning("Parceria aceita, mas o servidor ainda não vinculou a sua conta. A divisão só começa depois do vínculo.");
  };

  /* ── Ações com confirmação ── */
  const runConfirm = async () => {
    if (!confirm || !user) return;
    const { kind, row } = confirm;
    setConfirmBusy(true);
    let error: { message?: string } | null = null;
    if (kind === "cancel" || kind === "end") {
      ({ error } = await supabase.from("co_productions").delete().eq("id", row.cp.id).eq("owner_user_id", user.id));
      if (!error) await syncProductFlags(row.cp.product_id);
    } else {
      ({ error } = await supabase.from("co_productions").update({ status: "rejected" }).eq("id", row.cp.id));
    }
    setConfirmBusy(false);
    if (error) { toast.error(coErrorMessage(error, "Não foi possível concluir. Tente de novo.")); return; }
    setConfirm(null);
    await refresh();
    toast.success(kind === "cancel" ? "Convite cancelado." : kind === "end" ? "Parceria encerrada." : kind === "reject" ? "Convite recusado." : "Você saiu da parceria.");
  };

  const reinvite = async (r: CoRow) => {
    if (!user || busyId) return;
    if (list.some((c) => c.id !== r.cp.id && c.product_id === r.cp.product_id && c.owner_user_id === user.id && holdsProduct(c))) { toast.error("Este produto já tem outra coprodução em andamento."); return; }
    setBusyId(r.cp.id);
    const { error } = await supabase.from("co_productions").update({ status: "pending", accepted_at: null }).eq("id", r.cp.id).eq("owner_user_id", user.id);
    if (!error) await syncProductFlags(r.cp.product_id);
    setBusyId(null);
    if (error) { toast.error(coErrorMessage(error, "Não foi possível convidar de novo. Tente de novo.")); return; }
    await refresh();
    toast.success("Convite enviado de novo.");
  };

  const copyEmail = (r: CoRow) => { void copyText(r.cp.co_producer_email, "E-mail copiado."); };

  const confirmCopy = confirm && {
    cancel: { title: confirm.row.cp.status === "rejected" ? "Remover da lista?" : "Cancelar este convite?", text: confirm.row.cp.status === "rejected" ? `A coprodução recusada por ${confirm.row.partner} sai da sua lista. Você pode convidar de novo depois.` : `${confirm.row.partner} deixa de ver o convite. Você pode convidar de novo depois.`, action: confirm.row.cp.status === "rejected" ? "Remover" : "Cancelar convite", back: "Voltar" },
    end: { title: "Encerrar a parceria?", text: `As próximas vendas de ${confirm.row.productName} deixam de ser divididas com ${confirm.row.partner}. O que já foi dividido continua com ele.`, action: "Encerrar parceria", back: "Voltar" },
    reject: { title: "Recusar este convite?", text: `O convite de ${confirm.row.partner} para ${confirm.row.productName} aparece como recusado para o produtor. Ele pode convidar você de novo.`, action: "Recusar convite", back: "Voltar" },
    leave: { title: "Sair da parceria?", text: `Você deixa de receber a divisão das próximas vendas de ${confirm.row.productName}. O que já caiu no seu saldo continua seu.`, action: "Sair da parceria", back: "Ficar" },
  }[confirm.kind];

  const nothing = rows.length === 0;
  const money = (v: number | null) => (v === null ? "—" : <Money value={v} hidden={hidden} centsClassName="opacity-70" />);

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Coproduções | Vemprapay" description="Divida as vendas de um produto com outro produtor." path="/vendas/coproducoes" noindex />

      <SectionTabs section="growth" />
      <PageHead
        title="Coproduções"
        subtitle="Divida o valor das vendas de um produto com outro produtor. A parte dele cai no saldo no momento em que o pagamento é aprovado."
        actions={<button type="button" className="vp-cta" onClick={() => setInvite({ mode: "create" })}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Nova coprodução</button>}
      />

      <StatBand
        label="Resumo das coproduções"
        cells={[
          { label: "Recebido como coprodutor", featured: true, loading: loading, value: money(received), sub: "Sua parte em produtos de outros" },
          { label: "Repassado a parceiros", loading, value: money(passed), sub: "Descontado do seu saldo" },
          { label: "Parcerias ativas", loading, value: String(counts.active), sub: counts.unlinked > 0 ? `${counts.unlinked} aceita${counts.unlinked > 1 ? "s" : ""} sem vínculo` : "Dividindo as vendas" },
          { label: "Aguardando resposta", loading, value: String(counts.pending), sub: `${counts.sent} enviado${counts.sent === 1 ? "" : "s"} e ${counts.received} recebido${counts.received === 1 ? "" : "s"}` },
        ]}
      />

      {counts.unlinked > 0 && (
        <p role="status" className="rounded-[16px] bg-warning/15 px-4 py-3 text-[13.5px] font-medium leading-snug text-warning">
          {counts.unlinked === 1 ? "Há uma parceria aceita" : `Há ${counts.unlinked} parcerias aceitas`} sem a conta do parceiro vinculada. Enquanto isso, a divisão não roda nas vendas.
        </p>
      )}

      {loadError ? (
        <section className="vp-sheet">
          <EmptyPanel icon={<AlertCircle className="h-7 w-7" strokeWidth={1.8} />} title="Não foi possível carregar as coproduções" text="Confira sua conexão e tente de novo. Suas parcerias continuam salvas." action={<button type="button" className="vp-ghost" onClick={() => { setLoading(true); void load(); }}>Tentar de novo</button>} />
        </section>
      ) : (
        <>
          {!nothing && (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <FilterPills<DirFilter> label="Filtrar por quem convidou" value={dir} onChange={setDir} options={[{ value: "all", label: "Todas", count: rows.length }, { value: "sent", label: "Que enviei", count: counts.sent }, { value: "received", label: "Que recebi", count: counts.received }]} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <SearchField label="Buscar coprodução" value={q} onChange={setQ} placeholder="Parceiro ou produto" className="sm:w-[280px]" />
                <Select value={state} onValueChange={(v) => setState(v as StateFilter)}>
                  <SelectTrigger aria-label="Filtrar por situação" className="vp-r16 h-11 sm:w-[210px]"><SelectValue /></SelectTrigger>
                  <SelectContent collisionPadding={16}>
                    <SelectItem value="all">Todas as situações</SelectItem>
                    {(["active", "pending", "unlinked", "rejected"] as CoState[]).map((s) => <SelectItem key={s} value={s}>{STATE_META[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(loading || loadingProducts) && rows.length === 0 ? (
            <div className="space-y-3" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <div key={i} className="vp-skel h-[84px] !rounded-[22px]" />)}</div>
          ) : nothing ? (
            <section className="vp-sheet">
              <EmptyPanel
                icon={<Handshake className="h-7 w-7" strokeWidth={1.8} />}
                title="Divida as vendas com outro produtor"
                text="Convide um parceiro para um produto e a parte dele cai no saldo em cada venda aprovada. Você escolhe a porcentagem."
                action={eligible.length > 0 ? <button type="button" className="vp-cta" onClick={() => setInvite({ mode: "create" })}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Nova coprodução</button> : <Link to="/vendas/produtos" className="vp-cta">Ir para produtos</Link>}
              />
            </section>
          ) : shown.length === 0 ? (
            <section className="vp-sheet">
              <EmptyPanel title="Nenhuma coprodução encontrada" text="Tente outro nome ou limpe os filtros." action={<button type="button" className="vp-ghost" onClick={() => { setQ(""); setDir("all"); setState("all"); }}>Limpar filtros</button>} />
            </section>
          ) : (
            <CoLedger
              rows={shown} busyId={busyId}
              onAccept={(r) => void accept(r)}
              onReject={(r) => setConfirm({ kind: "reject", row: r })}
              onEdit={(r) => setInvite({ mode: "edit", productId: r.cp.product_id, email: r.cp.co_producer_email, split: Number(r.cp.split_percentage) })}
              onCancel={(r) => setConfirm({ kind: r.cp.status === "accepted" ? "end" : "cancel", row: r })}
              onReinvite={(r) => void reinvite(r)}
              onLeave={(r) => setConfirm({ kind: "leave", row: r })}
              onCopyEmail={copyEmail}
            />
          )}
        </>
      )}

      <InviteDialog
        target={invite}
        products={invite?.mode === "edit" ? products.filter((p) => p.id === invite.productId).map((p) => ({ id: p.id, name: p.name, price: Number(p.price) })) : eligible}
        ownEmail={email}
        onOpenChange={(o) => { if (!o) setInvite(null); }}
        onSave={saveInvite}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o && !confirmBusy) setConfirm(null); }}>
        <AlertDialogContent className="rounded-[28px] border-border bg-card p-7 sm:max-w-[460px]">
          <AlertDialogHeader className="gap-3 text-left">
            <span aria-hidden className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive"><Handshake className="h-6 w-6" strokeWidth={1.9} /></span>
            <AlertDialogTitle className="text-[20px] font-extrabold tracking-[-0.03em]">{confirmCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-[14.5px] leading-relaxed">{confirmCopy?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 gap-2 sm:space-x-0">
            <AlertDialogCancel className="vp-ghost !h-12 justify-center" disabled={confirmBusy}>{confirmCopy?.back}</AlertDialogCancel>
            <AlertDialogAction className="vp-cta vp-cta-danger !h-12 justify-center" disabled={confirmBusy} onClick={(e) => { e.preventDefault(); void runConfirm(); }}>{confirmBusy ? "Aguarde…" : confirmCopy?.action}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
