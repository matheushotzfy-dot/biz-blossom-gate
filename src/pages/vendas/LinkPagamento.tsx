import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Link2, Plus, Power, Search, ShoppingBag, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import { HDShell, HDHeader, HDStat, HDStatGrid, HDCard } from "@/components/hd/HDPage";
import AdminPager from "@/components/admin/AdminPager";
import { PaymentLinkDialog } from "@/features/payment-links/PaymentLinkDialog";
import { PaymentLinkList } from "@/features/payment-links/PaymentLinkList";
import type { PaymentLink, PaymentLinkDraft, PaymentLinkPage, PaymentLinkPermissions, PaymentLinkStatus } from "@/features/payment-links/types";
import { formatCurrency } from "@/lib/utils";

const PAGE_SIZE = 20;
const DEFAULT_PERMISSIONS: PaymentLinkPermissions = { accept_pix: false, accept_card: false, accept_boleto: false };

export default function LinkPagamento() {
  const { user } = useAuth();
  const [pageData, setPageData] = useState<PaymentLinkPage>({ items: [], filtered_total: 0, total: 0, revenue: 0, clicks: 0, uses: 0, active: 0 });
  const [permissions, setPermissions] = useState<PaymentLinkPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentLink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<PaymentLinkStatus>("all");
  const [page, setPage] = useState(1);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!user) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_payment_links_page", { _search: debouncedSearch || null, _status: status, _page: page, _page_size: PAGE_SIZE });
    if (requestId !== requestRef.current) return;
    if (error) toast.error("Não foi possível carregar seus links");
    else setPageData(data as unknown as PaymentLinkPage);
    setLoading(false);
  }, [debouncedSearch, page, status, user]);

  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!user) return;
    void supabase.from("profiles").select("pix_enabled, credit_card_enabled, boleto_enabled").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast.error("Não foi possível validar os métodos liberados"); return; }
      setPermissions({ accept_pix: data.pix_enabled, accept_card: data.credit_card_enabled, accept_boleto: data.boleto_enabled });
    });
  }, [user]);

  const uploadCover = async (file: File) => {
    if (!user) throw new Error("Sessão expirada");
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("payment-link-covers").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error("Falha ao enviar a capa");
    return { path, publicUrl: supabase.storage.from("payment-link-covers").getPublicUrl(path).data.publicUrl };
  };

  const save = async (draft: PaymentLinkDraft, coverFile: File | null) => {
    if (!user) return;
    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      const uploaded = coverFile ? await uploadCover(coverFile) : null;
      uploadedPath = uploaded?.path ?? null;
      const payload = { title: draft.title.trim(), description: draft.description.trim() || null, amount: Number(draft.amount), slug: draft.slug, cover_url: uploaded?.publicUrl ?? editing?.cover_url ?? null, accept_pix: permissions.accept_pix && draft.accept_pix, accept_card: permissions.accept_card && draft.accept_card, accept_boleto: permissions.accept_boleto && draft.accept_boleto, max_uses: draft.max_uses ? Number(draft.max_uses) : null, expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null, pix_expiration_minutes: Number(draft.pix_expiration_minutes), instructions: draft.instructions.trim() || null, redirect_url: draft.redirect_url.trim() || null };
      const result = editing ? await supabase.from("payment_links").update(payload).eq("id", editing.id).eq("user_id", user.id).select("id").maybeSingle() : await supabase.from("payment_links").insert({ ...payload, user_id: user.id } as never).select("id").maybeSingle();
      if (result.error) throw result.error;
      toast.success(editing ? "Link atualizado" : "Link criado");
      setDialogOpen(false); setEditing(null); await load();
    } catch (error) {
      if (uploadedPath) await supabase.storage.from("payment-link-covers").remove([uploadedPath]);
      throw new Error(error instanceof Error ? error.message : "Não foi possível salvar o link");
    } finally { setBusy(false); }
  };

  const mutateLink = async (link: PaymentLink, patch: Partial<PaymentLink>, success: string) => {
    if (!user) return;
    const { data, error } = await supabase.from("payment_links").update(patch).eq("id", link.id).eq("user_id", user.id).select("id").maybeSingle();
    if (error || !data) { toast.error(error?.message || "A alteração não foi aplicada"); return; }
    toast.success(success); await load();
  };

  const remove = async (link: PaymentLink) => {
    if (!user || !window.confirm(link.current_uses > 0 ? "Este link possui histórico e será arquivado. Continuar?" : "Remover este link?")) return;
    if (link.current_uses > 0) { await mutateLink(link, { archived_at: new Date().toISOString(), is_active: false }, "Link arquivado"); return; }
    const { data, error } = await supabase.from("payment_links").delete().eq("id", link.id).eq("user_id", user.id).select("id").maybeSingle();
    if (error || !data) { toast.error(error?.message || "Não foi possível remover o link"); return; }
    toast.success("Link removido"); await load();
  };

  const copy = async (link: PaymentLink) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/pl/${link.slug}`); setCopiedId(link.id); toast.success("Link copiado"); window.setTimeout(() => setCopiedId((id) => id === link.id ? null : id), 1800); }
    catch { toast.error("Não foi possível copiar o link"); }
  };

  const conversion = pageData.clicks > 0 ? (pageData.uses / pageData.clicks) * 100 : 0;
  const filters = useMemo(() => [{ value: "all", label: "Todos" }, { value: "active", label: "Ativos" }, { value: "paused", label: "Pausados" }, { value: "blocked", label: "Bloqueados" }, { value: "expired", label: "Expirados" }, { value: "archived", label: "Arquivados" }] as const, []);

  return <HDShell>
    <Seo title="Links de Pagamento | Venxpay" description="Crie e gerencie links de pagamento avulsos." path="/vendas/link-pagamento" noindex />
    <PaymentLinkDialog open={dialogOpen} busy={busy} permissions={permissions} editing={editing} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }} onSubmit={save} />
    <HDHeader eyebrow="Checkout" title="Links de Pagamento" subtitle="Crie cobranças avulsas e acompanhe cada acesso." actions={<Button className="h-11 gap-2 rounded-xl px-5 font-semibold" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="h-4 w-4" />Criar novo link</Button>} />
    <HDStatGrid><HDStat label="Receita gerada" value={formatCurrency(Number(pageData.revenue))} sub="Total aprovado nos links" icon={TrendingUp} /><HDStat label="Cliques" value={Number(pageData.clicks).toLocaleString("pt-BR")} sub="Visitas registradas" icon={Eye} /><HDStat label="Conversões" value={Number(pageData.uses).toLocaleString("pt-BR")} sub={`${conversion.toFixed(1)}% de conversão`} icon={ShoppingBag} /><HDStat label="Links ativos" value={`${pageData.active}/${pageData.total}`} sub="Disponíveis para acesso" icon={Power} /></HDStatGrid>
    <HDCard title="Meus links" description={`${pageData.filtered_total} resultado${pageData.filtered_total === 1 ? "" : "s"}`}>
      <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-4 sm:flex-row sm:items-center sm:px-6"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título ou endereço" className="h-10 rounded-xl pl-10" /></div><div className="flex gap-1 overflow-x-auto">{filters.map((filter) => <Button key={filter.value} type="button" size="sm" variant={status === filter.value ? "default" : "ghost"} onClick={() => { setStatus(filter.value); setPage(1); }} className="shrink-0 rounded-lg">{filter.label}</Button>)}</div></div>
      <PaymentLinkList links={pageData.items} loading={loading} copiedId={copiedId} onCopy={copy} onEdit={(link) => { setEditing(link); setDialogOpen(true); }} onToggle={(link) => { void mutateLink(link, { is_active: !link.is_active }, link.is_active ? "Link pausado" : "Link ativado"); }} onRemove={(link) => { void remove(link); }} />
      {pageData.filtered_total > PAGE_SIZE && <div className="px-6 pb-5"><AdminPager page={page} pageSize={PAGE_SIZE} totalCount={pageData.filtered_total} onPageChange={setPage} loading={loading} /></div>}
    </HDCard>
  </HDShell>;
}