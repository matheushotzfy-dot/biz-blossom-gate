import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import { PageHead } from "@/components/seller-ui/PageHead";
import { StatBand } from "@/components/seller-ui/StatBand";
import { SectionTabs } from "@/components/seller-ui/SectionTabs";
import { FilterPills } from "@/components/seller-ui/FilterPills";
import { SearchField } from "@/components/seller-ui/SearchField";
import { Pager } from "@/components/seller-ui/Pager";
import { Money } from "@/components/home/Money";
import { PaymentLinkDialog } from "@/features/payment-links/PaymentLinkDialog";
import { PaymentLinkList } from "@/features/payment-links/PaymentLinkList";
import type { PaymentLink, PaymentLinkDraft, PaymentLinkPage, PaymentLinkPermissions, PaymentLinkStatus } from "@/features/payment-links/types";

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
  const filters = useMemo(() => [{ value: "all", label: "Todos" }, { value: "active", label: "Ativos" }, { value: "paused", label: "Pausados" }, { value: "expired", label: "Expirados" }, { value: "blocked", label: "Bloqueados" }, { value: "archived", label: "Arquivados" }] as { value: PaymentLinkStatus; label: string }[], []);
  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const clearFilters = () => { setStatus("all"); setSearch(""); setPage(1); };
  const firstLoad = loading && pageData.total === 0;

  return (
    <div className="vp-fade space-y-5 pb-6 md:space-y-6">
      <Seo title="Links de Pagamento | Vemprapay" description="Crie e gerencie links de pagamento avulsos." path="/vendas/link-pagamento" noindex />
      <PaymentLinkDialog open={dialogOpen} busy={busy} permissions={permissions} editing={editing} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }} onSubmit={save} />

      <SectionTabs section="sales" />
      <PageHead
        title="Links de pagamento"
        subtitle="Cobre por Pix ou cartão com um endereço só seu e acompanhe cada acesso."
        actions={<button type="button" className="vp-cta" onClick={openCreate}><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />Criar link</button>}
      />

      <StatBand
        label="Resumo dos links"
        cells={[
          { label: "Receita gerada", featured: true, loading: firstLoad, value: <Money value={Number(pageData.revenue)} centsClassName="opacity-70" />, sub: "Aprovada nos seus links" },
          { label: "Cliques", loading: firstLoad, value: Number(pageData.clicks).toLocaleString("pt-BR"), sub: "Visitas aos links" },
          { label: "Pagamentos", loading: firstLoad, value: Number(pageData.uses).toLocaleString("pt-BR"), meter: conversion, sub: `${conversion.toFixed(1).replace(".", ",")}% dos cliques pagaram` },
          { label: "Links ativos", loading: firstLoad, value: `${pageData.active} de ${pageData.total}`, sub: "Prontos para receber" },
        ]}
      />

      <section className="vp-sheet overflow-hidden" aria-label="Meus links">
        <div className="flex flex-col gap-3 px-5 pb-4 pt-5 sm:px-7 sm:pt-6 lg:flex-row lg:items-center lg:justify-between">
          <FilterPills label="Filtrar links por situação" value={status} options={filters} onChange={(v) => { setStatus(v); setPage(1); }} />
          <SearchField label="Buscar links" value={search} onChange={setSearch} placeholder="Título ou endereço do link" className="lg:w-[320px] lg:shrink-0" />
        </div>
        <PaymentLinkList
          links={pageData.items}
          loading={loading}
          hasAny={pageData.total > 0}
          copiedId={copiedId}
          onCopy={copy}
          onEdit={(link) => { setEditing(link); setDialogOpen(true); }}
          onToggle={(link) => { void mutateLink(link, { is_active: !link.is_active }, link.is_active ? "Link pausado" : "Link ativado"); }}
          onRemove={(link) => { void remove(link); }}
          onCreate={openCreate}
          onClearFilters={clearFilters}
        />
        {pageData.filtered_total > PAGE_SIZE && <Pager page={page} pageSize={PAGE_SIZE} total={pageData.filtered_total} onPage={setPage} loading={loading} />}
      </section>
    </div>
  );
}
